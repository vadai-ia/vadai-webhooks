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
// Este webhook se dispara por un cron externo (Make / GitHub Actions /
// etc.) una vez al día. No necesita payload — aceptamos cualquier objeto
// JSON, opcionalmente con un `date` ISO para forzar la fecha base
// (útil para pruebas manuales sin esperar al cron).

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

interface BirthdayEntry {
  id: number;
  name: string;
  birthday: string;           // YYYY-MM-DD (fecha de nacimiento original)
  month_day: string;          // MM-DD (para comparar año-agnóstico)
  age_turning: number;        // Edad que cumple este año
  job_title: string | null;
  department: string | null;
  work_email: string | null;
  mobile_phone: string | null;
}


// =============================================================
// Helpers de fecha (zona horaria Mexico_City)
// =============================================================

const TZ = "America/Mexico_City";

/** Devuelve {year, month, day} para una fecha en TZ Mexico_City. */
function partsInMexico(d: Date): { year: number; month: number; day: number } {
  // Intl con type=parts nos da los componentes locales en la TZ pedida,
  // sin tener que parsear strings.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** "MM-DD" a partir de {month, day}. */
function mmdd(month: number, day: number): string {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Suma `days` días a una fecha y devuelve los componentes resultantes
 * en TZ Mexico_City. Hacemos el shift en UTC (suma de ms) y después
 * proyectamos a la TZ — esto evita los saltos por DST.
 */
function shiftDays(base: Date, days: number): { year: number; month: number; day: number } {
  const shifted = new Date(base.getTime() + days * 86_400_000);
  return partsInMexico(shifted);
}

/**
 * Edad que un empleado cumple en `targetYear` dado su `birthday`
 * en formato YYYY-MM-DD.
 */
function ageTurning(birthdayIso: string, targetYear: number): number {
  const birthYear = Number(birthdayIso.slice(0, 4));
  return targetYear - birthYear;
}

function toEntry(emp: OdooEmployee): BirthdayEntry | null {
  if (!emp.birthday) return null;
  const iso = emp.birthday;
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  if (!m || !d) return null;
  return {
    id: emp.id,
    name: emp.name,
    birthday: iso,
    month_day: mmdd(m, d),
    age_turning: 0, // se rellena al filtrar contra el año target
    job_title: emp.job_title || null,
    department: emp.department_id ? emp.department_id[1] : null,
    work_email: emp.work_email || null,
    mobile_phone: emp.mobile_phone || null,
  };
}


// =============================================================
// Handler
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
    "odoo_employees_fetched",
    "success",
    `${employees.length} empleados activos con birthday set`,
    { count: employees.length }
  );

  return employees;
}

export const handler: WebhookHandler<Payload> = {
  slug: "vadai-cumpleanos",
  description:
    "Cumpleaños del equipo VADAI: devuelve cumpleaños de mañana " +
    "(para notificar 1 día antes) y, si hoy es día 1 del mes, " +
    "la lista completa de cumpleaños del mes en curso.",
  schema: PayloadSchema,

  // No deduplicamos: dos triggers el mismo día son legítimos (re-cron
  // manual, retry desde Make). El costo es bajo (1 search_read).
  getIdempotencyKey: () => null,

  async process(payload, ctx): Promise<HandlerResult> {
    // Fecha base: payload.date (ISO) si vino, si no `now`.
    const baseDate = payload.date ? new Date(payload.date) : new Date();
    if (Number.isNaN(baseDate.getTime())) {
      throw new Error(`payload.date inválido: '${payload.date}'`);
    }

    const today = partsInMexico(baseDate);
    const tomorrow = shiftDays(baseDate, 1);

    const todayMD = mmdd(today.month, today.day);
    const tomorrowMD = mmdd(tomorrow.month, tomorrow.day);
    const isFirstOfMonth = today.day === 1;

    await ctx.logger.step("date_context", "info", null, {
      today: `${today.year}-${todayMD}`,
      tomorrow: `${tomorrow.year}-${tomorrowMD}`,
      is_first_of_month: isFirstOfMonth,
      timezone: TZ,
    });

    // 1. Traer empleados con birthday
    const employees = await fetchEmployees(ctx);

    const entries = employees
      .map(toEntry)
      .filter((e): e is BirthdayEntry => e !== null);

    // 2. Cumpleaños de mañana — para mandar la notificación HOY,
    //    un día antes.
    const tomorrowBirthdays: BirthdayEntry[] = entries
      .filter((e) => e.month_day === tomorrowMD)
      .map((e) => ({ ...e, age_turning: ageTurning(e.birthday, tomorrow.year) }));

    // 3. Bonus: si hoy es día 1, listado del mes completo ordenado
    //    por día.
    const monthStr = String(today.month).padStart(2, "0");
    const monthBirthdays: BirthdayEntry[] = isFirstOfMonth
      ? entries
          .filter((e) => e.month_day.startsWith(`${monthStr}-`))
          .map((e) => ({
            ...e,
            age_turning: ageTurning(e.birthday, today.year),
          }))
          .sort((a, b) => a.month_day.localeCompare(b.month_day))
      : [];

    // 4. Logs de pasos (cosméticos pero útiles en el timeline)
    if (tomorrowBirthdays.length > 0) {
      await ctx.logger.step(
        "tomorrow_birthdays",
        "success",
        `${tomorrowBirthdays.length} cumpleaños mañana`,
        { date: `${tomorrow.year}-${tomorrowMD}`, employees: tomorrowBirthdays.map((b) => b.name) }
      );
    } else {
      await ctx.logger.step(
        "tomorrow_birthdays",
        "info",
        "Sin cumpleaños mañana",
        { date: `${tomorrow.year}-${tomorrowMD}` }
      );
    }

    if (isFirstOfMonth) {
      await ctx.logger.step(
        "month_birthdays",
        "success",
        `${monthBirthdays.length} cumpleaños este mes`,
        { month: monthStr, employees: monthBirthdays.map((b) => b.name) }
      );
    }

    return {
      summary: {
        timezone: TZ,
        today: `${today.year}-${todayMD}`,
        tomorrow: `${tomorrow.year}-${tomorrowMD}`,
        is_first_of_month: isFirstOfMonth,
        total_employees_with_birthday: entries.length,
        tomorrow_birthdays: tomorrowBirthdays,
        month_birthdays: monthBirthdays,
      },
    };
  },
};
