import { z } from "zod";
import { createOdooClientFromConfig, type OdooClient } from "@/lib/odoo/client";
import type {
  WebhookHandler,
  HandlerContext,
  HandlerResult,
} from "./_types";

// =============================================================
// Schema del payload
// =============================================================
//
// Este webhook se dispara por un cron externo (N8N) una vez al día.
// No requiere payload — aceptamos cualquier objeto JSON, opcionalmente
// con `date` (ISO) para forzar la fecha base. Útil para probar fechas
// específicas sin esperar al cron.

const PayloadSchema = z
  .object({
    date: z.string().optional(),
  })
  .passthrough();

type Payload = z.infer<typeof PayloadSchema>;


// =============================================================
// Empleado en Odoo (subset que leemos)
// =============================================================

interface OdooEmployee {
  id: number;
  name: string;
  birthday: string | false;
  work_email: string | false;
  mobile_phone: string | false;
  job_title: string | false;
  department_id: [number, string] | false;
}

interface CumpleEntry {
  id: number;
  nombre: string;
  fecha_nacimiento: string;       // YYYY-MM-DD
  mes_dia: string;                // MM-DD (comparación año-agnóstica)
  fecha_cumple_legible: string;   // ej "30 de mayo"
  edad_cumple: number;            // edad que cumple en el año target
  puesto: string | null;
  departamento: string | null;
  email_trabajo: string | null;
  telefono: string | null;
}


// =============================================================
// Helpers de fecha (zona horaria America/Mexico_City)
// =============================================================

const TZ = "America/Mexico_City";

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const DIAS_SEMANA_ES = [
  "domingo", "lunes", "martes", "miércoles",
  "jueves", "viernes", "sábado",
];

/** Devuelve {year, month, day, weekday} para una fecha en TZ Mexico_City. */
function partsInMexico(d: Date): {
  year: number;
  month: number;
  day: number;
  weekday: number; // 0=domingo … 6=sábado
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wdMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: wdMap[get("weekday")] ?? 0,
  };
}

/** "MM-DD" a partir de {month, day}. */
function mmdd(month: number, day: number): string {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "30 de mayo", "1 de enero", etc. */
function legibleMD(month: number, day: number): string {
  return `${day} de ${MESES_ES[month - 1]}`;
}

/** "lunes, 19 de mayo de 2026" para fechas concretas. */
function legibleFull(parts: {
  year: number; month: number; day: number; weekday: number;
}): string {
  return `${DIAS_SEMANA_ES[parts.weekday]}, ${legibleMD(parts.month, parts.day)} de ${parts.year}`;
}

/**
 * Suma `days` días a una fecha y devuelve los componentes en TZ
 * Mexico_City. El shift se hace en UTC (ms) y luego se proyecta a la
 * TZ — así sortemos saltos por DST (que en MX ya no aplica, pero por
 * higiene).
 */
function shiftDays(base: Date, days: number) {
  return partsInMexico(new Date(base.getTime() + days * 86_400_000));
}

function ageTurning(birthdayIso: string, targetYear: number): number {
  return targetYear - Number(birthdayIso.slice(0, 4));
}


// =============================================================
// Construcción de entries
// =============================================================

function toEntry(emp: OdooEmployee): Omit<CumpleEntry, "edad_cumple"> | null {
  if (!emp.birthday) return null;
  const iso = emp.birthday;
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  if (!m || !d) return null;
  return {
    id: emp.id,
    nombre: emp.name,
    fecha_nacimiento: iso,
    mes_dia: mmdd(m, d),
    fecha_cumple_legible: legibleMD(m, d),
    puesto: emp.job_title || null,
    departamento: emp.department_id ? emp.department_id[1] : null,
    email_trabajo: emp.work_email || null,
    telefono: emp.mobile_phone || null,
  };
}


// =============================================================
// Cliente Odoo VADAI
// =============================================================

/**
 * Cliente Odoo apuntado al tenant interno de VADAI.
 * Las credenciales viven en `ODOO_VADAI_*` — completamente independientes
 * de `ODOO_*` (que las usa genco-soft-odoo contra otro tenant).
 */
function createVadaiOdooClient(): OdooClient {
  const url = process.env.ODOO_VADAI_URL;
  const db = process.env.ODOO_VADAI_DB;
  const user = process.env.ODOO_VADAI_USER;
  const apiKey = process.env.ODOO_VADAI_API_KEY;
  if (!url || !db || !user || !apiKey) {
    throw new Error(
      "vadai-cumpleanos requires ODOO_VADAI_URL, ODOO_VADAI_DB, " +
        "ODOO_VADAI_USER, ODOO_VADAI_API_KEY env vars"
    );
  }
  return createOdooClientFromConfig({ url, db, user, apiKey });
}

async function fetchEmployees(ctx: HandlerContext): Promise<OdooEmployee[]> {
  const odoo = createVadaiOdooClient();

  const employees = await odoo.executeKw<OdooEmployee[]>(
    "hr.employee",
    "search_read",
    [
      [
        ["active", "=", true],
        ["birthday", "!=", false],
      ],
    ],
    {
      fields: [
        "id",
        "name",
        "birthday",
        "work_email",
        "mobile_phone",
        "job_title",
        "department_id",
      ],
      order: "name asc",
    }
  );

  await ctx.logger.step(
    "odoo_empleados_obtenidos",
    "success",
    `${employees.length} empleados activos con fecha de nacimiento`,
    { total: employees.length }
  );

  return employees;
}


// =============================================================
// Handler
// =============================================================

export const handler: WebhookHandler<Payload> = {
  slug: "vadai-cumpleanos",
  description:
    "Cumpleaños del equipo VADAI: devuelve los cumpleaños de mañana (para " +
    "notificar 1 día antes) y la lista completa de cumpleaños del mes en " +
    "curso. Incluye flag `es_primer_dia_del_mes` para que el flujo de N8N " +
    "decida si manda el resumen mensual.",
  schema: PayloadSchema,

  // No deduplicamos: dos triggers el mismo día son legítimos (re-cron
  // manual, retry de N8N). El costo es bajo (1 search_read).
  getIdempotencyKey: () => null,

  async process(payload, ctx): Promise<HandlerResult> {
    // Fecha base: payload.date si vino, si no `now`.
    const baseDate = payload.date ? new Date(payload.date) : new Date();
    if (Number.isNaN(baseDate.getTime())) {
      throw new Error(`payload.date inválido: '${payload.date}'`);
    }

    const hoy = partsInMexico(baseDate);
    const manana = shiftDays(baseDate, 1);

    const hoyMD = mmdd(hoy.month, hoy.day);
    const mananaMD = mmdd(manana.month, manana.day);
    const esPrimerDiaDelMes = hoy.day === 1;
    const mesActualStr = String(hoy.month).padStart(2, "0");

    await ctx.logger.step("contexto_fecha", "info", null, {
      hoy: `${hoy.year}-${hoyMD}`,
      manana: `${manana.year}-${mananaMD}`,
      es_primer_dia_del_mes: esPrimerDiaDelMes,
      zona_horaria: TZ,
    });

    // 1. Empleados con birthday set
    const empleados = await fetchEmployees(ctx);
    const entries = empleados
      .map(toEntry)
      .filter((e): e is NonNullable<ReturnType<typeof toEntry>> => e !== null);

    // 2. Cumpleaños de mañana — para notificar HOY, un día antes.
    const cumplesManana: CumpleEntry[] = entries
      .filter((e) => e.mes_dia === mananaMD)
      .map((e) => ({
        ...e,
        edad_cumple: ageTurning(e.fecha_nacimiento, manana.year),
      }));

    // 3. Cumpleaños del mes en curso — siempre, ordenados por día.
    //    El flag `es_primer_dia_del_mes` deja al flujo de N8N decidir si
    //    dispara la notificación de resumen mensual.
    const cumplesDelMes: CumpleEntry[] = entries
      .filter((e) => e.mes_dia.startsWith(`${mesActualStr}-`))
      .map((e) => ({
        ...e,
        edad_cumple: ageTurning(e.fecha_nacimiento, hoy.year),
      }))
      .sort((a, b) => a.mes_dia.localeCompare(b.mes_dia));

    // 4. Logs cosméticos para el timeline
    await ctx.logger.step(
      "cumples_manana",
      cumplesManana.length > 0 ? "success" : "info",
      cumplesManana.length > 0
        ? `${cumplesManana.length} cumpleaños mañana`
        : "Sin cumpleaños mañana",
      {
        fecha: `${manana.year}-${mananaMD}`,
        nombres: cumplesManana.map((c) => c.nombre),
      }
    );

    await ctx.logger.step(
      "cumples_del_mes",
      "info",
      `${cumplesDelMes.length} cumpleaños en ${MESES_ES[hoy.month - 1]}`,
      {
        mes: MESES_ES[hoy.month - 1],
        nombres: cumplesDelMes.map((c) => c.nombre),
      }
    );

    return {
      summary: {
        zona_horaria: TZ,
        hoy: `${hoy.year}-${hoyMD}`,
        hoy_legible: legibleFull(hoy),
        manana: `${manana.year}-${mananaMD}`,
        manana_legible: legibleFull(manana),
        mes_actual: MESES_ES[hoy.month - 1],
        es_primer_dia_del_mes: esPrimerDiaDelMes,

        total_empleados_con_cumple: entries.length,

        // Para notificación 1-día-antes
        total_cumples_manana: cumplesManana.length,
        cumples_manana: cumplesManana,

        // Para resumen mensual (mirá `es_primer_dia_del_mes` para decidir
        // si lo mandás o no en este disparo)
        total_cumples_del_mes: cumplesDelMes.length,
        cumples_del_mes: cumplesDelMes,
      },
    };
  },
};
