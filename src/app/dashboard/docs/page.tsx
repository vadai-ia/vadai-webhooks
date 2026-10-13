import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { CodeTabs } from "@/components/dashboard/code-tabs";
import { StatusBadge } from "@/components/dashboard/status-badge";

export const dynamic = "force-dynamic";

/**
 * Guía de recepción: todo lo que un sistema externo necesita para mandar
 * datos a /in/[token]. Lo que hace cada webhook con el payload vive en su
 * handler; aquí sólo se documenta la entrada.
 *
 * Todo lo descrito sale del comportamiento real de `src/app/in/[token]/route.ts`
 * y `src/lib/webhook-runner.ts` — si cambian, actualizar esta página.
 */

const SECTIONS = [
  { id: "como-funciona", title: "Cómo funciona" },
  { id: "conectar", title: "Conectar un sistema" },
  { id: "formato", title: "Formato del envío" },
  { id: "respuestas", title: "Respuestas" },
  { id: "sync", title: "Modo síncrono" },
  { id: "estados", title: "Estados" },
  { id: "reintentos", title: "Reintentos y duplicados" },
  { id: "seguridad", title: "Seguridad" },
  { id: "ejemplos", title: "Ejemplos" },
  { id: "diagnostico", title: "Diagnóstico" },
  { id: "checklist", title: "Texto para el cliente" },
] as const;

export default async function DocsPage({
  searchParams,
}: {
  searchParams: Promise<{ webhook?: string }>;
}) {
  const { webhook } = await searchParams;
  const sb = await createClient();

  const { data: configs } = await sb
    .from("vw_configs")
    .select("slug, name, token")
    .neq("status", "archived")
    .order("name", { ascending: true });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const selected = (configs ?? []).find((c) => c.slug === webhook) ?? null;
  const url = selected
    ? `${appUrl}/in/${selected.token}`
    : `${appUrl}/in/wh_TU_TOKEN`;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={selected ? `/dashboard/${selected.slug}` : "/dashboard"}
          className="inline-flex items-center gap-1.5 text-sm text-vadai-muted hover:text-vadai-text transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {selected ? selected.name : "Webhooks"}
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-vadai-text">
          Guía de recepción
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-vadai-muted">
          Cómo un sistema externo le manda datos a VADAI Webhooks. Lo que cada
          webhook hace con esos datos vive en su handler; aquí está todo lo de
          la entrada: formato, respuestas, estados, reintentos y seguridad.
        </p>
      </div>

      <WebhookPicker
        configs={(configs ?? []).map((c) => ({ slug: c.slug, name: c.name }))}
        selected={selected?.slug ?? null}
      />

      <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav className="hidden lg:block">
          <ul className="sticky top-20 space-y-1 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block rounded px-2 py-1 text-vadai-muted hover:bg-vadai-navy-light/40 hover:text-vadai-text transition-colors"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 max-w-3xl space-y-12">
          <Section id="como-funciona" title="Cómo funciona">
            <P>
              Cada webhook tiene una URL única. Todos los sistemas mandan al
              mismo endpoint universal; lo único que cambia es el token:
            </P>
            <CodeTabs snippets={[{ label: "URL", code: url }]} />
            <P>
              El token (<Code>wh_</Code> + 32 caracteres) identifica al webhook
              y es su única credencial. No hay URLs distintas por cliente ni
              por sistema.
            </P>
            <ol className="space-y-2 text-sm text-vadai-text">
              {[
                "El sistema externo hace un POST con un JSON a la URL.",
                "Se guarda la ejecución: payload, headers, IP de origen, user-agent y tamaño.",
                "Se responde 200 de inmediato con el número de ejecución.",
                "Si el webhook está Activo, su handler procesa en segundo plano y deja resultado, errores y línea de tiempo en el dashboard.",
              ].map((t, i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-vadai-cyan/40 text-[11px] text-vadai-cyan">
                    {i + 1}
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="conectar" title="Conectar un sistema">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-vadai-text marker:text-vadai-muted">
              <li>
                Crea el webhook con <b>Nuevo webhook</b>. Nace en{" "}
                <StatusBadge status="pending_handler" />: ya recibe y guarda,
                pero todavía no procesa.
              </li>
              <li>
                Comparte con el equipo del cliente la URL y el{" "}
                <a href="#checklist" className="text-vadai-cyan hover:text-vadai-cyan-light">
                  texto para el cliente
                </a>{" "}
                de esta guía.
              </li>
              <li>
                Pide un envío de prueba con datos reales y revisa en el detalle
                de la ejecución el payload, los headers y la IP.
              </li>
              <li>
                Desarrollo escribe el handler en{" "}
                <Code>src/handlers/&lt;slug&gt;.ts</Code> usando ese payload
                como referencia, lo registra en <Code>_registry.ts</Code> y
                despliega.
              </li>
              <li>
                Dale <b>Activar</b>. Desde ese momento cada envío se procesa.
              </li>
            </ol>
            <Note>
              Lo que llegó antes de activar queda como{" "}
              <StatusBadge status="pending" /> y hoy no se procesa solo. Lo
              que llega con el webhook pausado sí se puede reprocesar desde el
              panel amarillo del detalle del webhook.
            </Note>
          </Section>

          <Section id="formato" title="Formato del envío">
            <Table
              head={["Campo", "Valor"]}
              rows={[
                ["Método", <>Sólo <Code>POST</Code>. Cualquier otro método responde 405.</>],
                ["URL", <>Siempre con <Code>https://</Code>. Ver sección de seguridad.</>],
                ["Header", <><Code>Content-Type: application/json</Code></>],
                ["Body", "JSON válido en UTF-8: objeto o arreglo. La forma exacta la define el handler de cada webhook."],
                ["Tamaño", "La app no impone límite; mantén cada envío por debajo de 1 MB."],
                ["Query", <><Code>?sync=1</Code> opcional para esperar el resultado (ver modo síncrono).</>],
                ["Autenticación", "Ninguna adicional: el token en la URL es la credencial."],
              ]}
            />
            <Note>
              Form-data, <Code>x-www-form-urlencoded</Code>, XML o un body
              vacío responden 400 y <b>no se guardan</b>: no aparecen en el
              dashboard.
            </Note>
            <P>
              Para que el handler pueda detectar duplicados y ordenar eventos,
              cada envío debería traer un ID único y estable del evento y su
              fecha en ISO 8601:
            </P>
            <CodeTabs
              snippets={[
                {
                  label: "Payload recomendado",
                  code: JSON.stringify(
                    {
                      evento: "orden.creada",
                      id: "ORD-1001",
                      fecha: "2026-10-13T12:30:00-06:00",
                      datos: { cliente: "Juan Pérez", total: 250.5 },
                    },
                    null,
                    2
                  ),
                },
              ]}
            />
          </Section>

          <Section id="respuestas" title="Respuestas">
            <Table
              head={["Código", "Cuándo", "¿Se guarda?", "¿Reintentar?"]}
              rows={[
                [<Code key="c">200</Code>, <>Recibido. El <Code>status</Code> del body dice si se procesa (ver abajo).</>, "Sí", "No"],
                [<Code key="c">400</Code>, <>El body no es JSON válido. <Code>{`{"error":"Invalid JSON"}`}</Code></>, "No", "No — corregir el formato"],
                [<Code key="c">404</Code>, <>El token no existe: URL mal copiada. <Code>{`{"error":"Webhook not found"}`}</Code></>, "No", "No — corregir la URL"],
                [<Code key="c">405</Code>, "Se usó un método distinto de POST.", "No", "No — usar POST"],
                [<Code key="c">410</Code>, <>Webhook archivado. <Code>{`{"error":"Gone"}`}</Code></>, "No", "No"],
                [<Code key="c">500</Code>, <>Falla de nuestro lado al guardar. <Code>{`{"error":"Internal"}`}</Code></>, "No", "Sí, con espera"],
                [<Code key="c">301</Code>, <>Se mandó a <Code>http://</Code>. Redirige a https.</>, "No", "Usar https://"],
              ]}
            />
            <P>
              El body de un 200 trae el número de ejecución y el estado con el
              que quedó guardada:
            </P>
            <Table
              head={["status", "Significa"]}
              rows={[
                [<Code key="s">received</Code>, "Webhook activo: se está procesando en segundo plano."],
                [<Code key="s">pending</Code>, "El webhook aún no tiene handler. Guardado, sin procesar."],
                [<Code key="s">skipped_paused</Code>, "El webhook está pausado. Guardado, sin procesar."],
              ]}
            />
            <Note>
              Un 200 significa <b>guardado</b>, no <b>procesado</b>. Si el
              handler falla después, el emisor no se entera: se ve en el
              dashboard y se corrige del lado de VADAI.
            </Note>
          </Section>

          <Section id="sync" title="Modo síncrono">
            <P>
              Agregando <Code>?sync=1</Code> a la URL, la respuesta espera a
              que termine el handler y trae su resultado. Sirve para n8n o Make
              cuando el siguiente paso necesita la salida.
            </P>
            <CodeTabs
              snippets={[
                {
                  label: "Respuesta con ?sync=1",
                  code: JSON.stringify(
                    {
                      ok: true,
                      execution_id: 13185,
                      status: "completed",
                      result: { "...": "lo que devuelva el handler" },
                      error: null,
                    },
                    null,
                    2
                  ),
                },
              ]}
            />
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-vadai-text marker:text-vadai-muted">
              <li>
                <Code>ok</Code> es <Code>true</Code> con{" "}
                <Code>completed</Code>, <Code>completed_with_warning</Code> o{" "}
                <Code>skipped_duplicate</Code>, y <Code>false</Code> si falló.
                El HTTP sigue siendo 200 aunque el handler falle: revisa{" "}
                <Code>ok</Code>, no el código.
              </li>
              <li>
                Sólo espera si el webhook está Activo. Si no, responde igual
                que el modo normal.
              </li>
              <li>
                Tarda lo que tarde el handler (en GENCO, de 10 a 60 segundos).
                Configura un timeout de al menos 2 minutos.
              </li>
            </ul>
          </Section>

          <Section id="estados" title="Estados">
            <H3>Del webhook — qué pasa con lo que llega</H3>
            <Table
              head={["Estado", "Respuesta", "Qué pasa"]}
              rows={[
                [<StatusBadge key="b" status="pending_handler" />, "200 · pending", "Se guarda, no se procesa."],
                [<StatusBadge key="b" status="active" />, "200 · received", "Se guarda y se procesa."],
                [<StatusBadge key="b" status="paused" />, "200 · skipped_paused", "Se guarda, no se procesa. Se puede reprocesar después."],
                [<StatusBadge key="b" status="archived" />, "410", "No se guarda."],
              ]}
            />
            <H3>De cada ejecución</H3>
            <Table
              head={["Estado", "Significa"]}
              rows={[
                [<StatusBadge key="b" status="received" />, "Guardada, esperando al handler."],
                [<StatusBadge key="b" status="processing" />, "El handler está corriendo."],
                [<StatusBadge key="b" status="completed" />, "Terminó bien."],
                [<StatusBadge key="b" status="completed_with_warning" />, "Terminó, pero algo requiere revisión (por ejemplo, una de varias ventas falló)."],
                [<StatusBadge key="b" status="failed" />, "Falló. El detalle muestra el error y la línea de tiempo."],
                [<StatusBadge key="b" status="skipped_duplicate" />, "Ya existía una ejecución completada con la misma llave; no se procesó de nuevo."],
                [<StatusBadge key="b" status="pending" />, "Llegó cuando el webhook no tenía handler."],
                [<StatusBadge key="b" status="skipped_paused" />, "Llegó con el webhook pausado."],
              ]}
            />
          </Section>

          <Section id="reintentos" title="Reintentos y duplicados">
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-vadai-text marker:text-vadai-muted">
              <li>
                El emisor debe reintentar sólo errores de red, timeouts y 5xx,
                con espera creciente: 1 min, 5 min, 30 min.
              </li>
              <li>
                Los 4xx no se reintentan: indican URL o formato incorrectos y
                no se arreglan solos.
              </li>
              <li>
                Un 200 no se reintenta. Aunque el procesamiento falle, la
                ejecución ya está guardada y se resuelve desde aquí.
              </li>
              <li>
                Cada handler define una llave de idempotencia a partir del
                payload (GENCO usa empresa + estación + número de orden). Si
                llega otra vez un evento cuya llave ya se completó, queda como{" "}
                <StatusBadge status="skipped_duplicate" /> sin efectos. Por
                eso el ID estable por evento importa: con él, reenviar es
                seguro.
              </li>
            </ul>
          </Section>

          <Section id="seguridad" title="Seguridad">
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-vadai-text marker:text-vadai-muted">
              <li>
                <b>La URL es la contraseña.</b> Quien la tenga puede enviar.
                No la publiques en repositorios, tickets ni capturas.
              </li>
              <li>
                <b>Sólo https.</b> Un envío a <Code>http://</Code> recibe un
                301, y varios clientes convierten el POST en GET al seguir la
                redirección: el envío se pierde con un 405.
              </li>
              <li>
                <b>Todos los headers se guardan</b> y se ven en el dashboard.
                No mandes llaves de API ni <Code>Authorization</Code>: no se
                validan y quedarían guardadas.
              </li>
              <li>
                <b>El payload completo se guarda sin caducidad.</b> Manda sólo
                lo necesario; nunca números de tarjeta ni contraseñas.
              </li>
              <li>
                <b>Si una URL se filtra:</b> hoy no hay botón para rotar el
                token. Pide a desarrollo que lo cambie en{" "}
                <Code>vw_configs.token</Code> y entrega la URL nueva.
              </li>
              <li>
                De cada envío se registran la IP de origen y el user-agent.
              </li>
            </ul>
          </Section>

          <Section id="ejemplos" title="Ejemplos">
            <CodeTabs snippets={exampleSnippets(url)} />
            <H3>Respuestas</H3>
            <CodeTabs
              snippets={[
                {
                  label: "200",
                  code: JSON.stringify(
                    { ok: true, execution_id: 13185, status: "received" },
                    null,
                    2
                  ),
                },
                { label: "404", code: `{ "error": "Webhook not found" }` },
                { label: "400", code: `{ "error": "Invalid JSON" }` },
                { label: "410", code: `{ "error": "Gone" }` },
              ]}
            />
          </Section>

          <Section id="diagnostico" title="Diagnóstico">
            <Table
              wrapFirst
              head={["Síntoma", "Causa probable", "Qué hacer"]}
              rows={[
                ["El emisor dice que envió pero no aparece nada", "Los 400, 404 y 405 no se guardan. Casi siempre es la URL mal copiada o http://.", "Pide el código HTTP que recibió el emisor."],
                ["Dejaron de llegar envíos", "El sistema origen borró o cambió la URL en su configuración.", "Revisa la configuración de webhooks del sistema origen."],
                [<StatusBadge key="b" status="skipped_paused" />, "Webhook pausado.", "Activar y usar Reprocesar en el detalle del webhook."],
                [<StatusBadge key="b" status="pending" />, "Aún no hay handler.", "Desarrollo crea el handler; luego Activar."],
                [<StatusBadge key="b" status="failed" />, "Error en el handler o en el sistema destino.", "Abre la ejecución: error, stack y línea de tiempo."],
                [<>Falló con <Code>Invalid payload schema</Code></>, "El JSON no tiene la forma que espera el handler; el emisor cambió el formato.", "Compara el payload contra el schema del handler."],
                [<StatusBadge key="b" status="skipped_duplicate" />, "El emisor reenvió un evento ya procesado.", "Nada: está funcionando como debe."],
                ["El emisor recibe 410", "El webhook está archivado.", "Crear uno nuevo o pedir a desarrollo que lo reactive."],
              ]}
            />
          </Section>

          <Section id="checklist" title="Texto para el cliente">
            <P>
              Listo para pegar en un correo o mensaje al equipo que va a
              integrar.{" "}
              {selected
                ? `Ya incluye la URL real de ${selected.name}.`
                : "Elige un webhook arriba para que incluya su URL real."}
            </P>
            <CodeTabs
              snippets={[{ label: "Texto para compartir", code: clientText(url) }]}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}

function exampleSnippets(url: string) {
  const body = `{"evento":"orden.creada","id":"ORD-1001","total":250.5}`;
  return [
    {
      label: "cURL",
      code: `curl -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -d '${body}'`,
    },
    {
      label: "JavaScript",
      code: `const res = await fetch("${url}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ evento: "orden.creada", id: "ORD-1001", total: 250.5 }),
  signal: AbortSignal.timeout(30_000),
});

if (res.status >= 500) {
  // reintentar con espera creciente (1 min, 5 min, 30 min)
}
const data = await res.json(); // { ok, execution_id, status }`,
    },
    {
      label: "Python",
      code: `import requests

r = requests.post(
    "${url}",
    json={"evento": "orden.creada", "id": "ORD-1001", "total": 250.5},
    timeout=30,
)

if r.status_code >= 500:
    pass  # reintentar con espera creciente (1 min, 5 min, 30 min)
print(r.json())  # {"ok": true, "execution_id": ..., "status": "received"}`,
    },
    {
      label: "n8n / Make",
      code: `Nodo: HTTP Request (n8n) · HTTP > Make a request (Make)

Método:        POST
URL:           ${url}
Body:          JSON (Content-Type: application/json)
Timeout:       30 s  (120 s si agregas ?sync=1 a la URL)

Para usar la salida del handler en el siguiente paso:
URL:           ${url}?sync=1
Leer:          ok, status, result`,
    },
  ];
}

function clientText(url: string) {
  return `Integración con VADAI Webhooks

URL:     ${url}
Método:  POST
Header:  Content-Type: application/json
Body:    JSON en UTF-8

Requisitos
1. Usar siempre https:// (nunca http://).
2. Incluir en cada evento un ID único y estable (por ejemplo, el número de orden) y la fecha en formato ISO 8601.
3. Cualquier respuesta 200 es un envío exitoso.
4. Reintentar sólo errores de red, timeouts o respuestas 5xx, con espera creciente (1 min, 5 min, 30 min).
5. No reintentar respuestas 4xx: indican URL o formato incorrectos.
6. Timeout recomendado: 30 segundos.
7. No enviar llaves, contraseñas ni datos de tarjeta, ni en el body ni en los headers.
8. Tratar la URL como una contraseña: no publicarla.

Envío de prueba
curl -X POST "${url}" -H "Content-Type: application/json" -d '{"prueba": true}'`;
}

function WebhookPicker({
  configs,
  selected,
}: {
  configs: { slug: string; name: string }[];
  selected: string | null;
}) {
  if (configs.length === 0) return null;
  const chip = "rounded-md border px-2.5 py-1 text-xs transition-colors";
  const on = "border-vadai-cyan/50 bg-vadai-cyan/10 text-vadai-cyan";
  const off =
    "border-vadai-navy-light text-vadai-muted hover:text-vadai-text hover:border-vadai-cyan/40";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-vadai-navy-light bg-vadai-navy-mid px-4 py-3">
      <span className="text-xs text-vadai-muted">Ejemplos con la URL de:</span>
      <Link href="/dashboard/docs" className={cn(chip, selected ? off : on)}>
        Genérica
      </Link>
      {configs.map((c) => (
        <Link
          key={c.slug}
          href={`/dashboard/docs?webhook=${c.slug}`}
          className={cn(chip, selected === c.slug ? on : off)}
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <h2 className="border-b border-vadai-navy-light pb-2 text-lg font-semibold text-vadai-text">
        {title}
      </h2>
      {children}
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="pt-2 text-sm font-medium text-vadai-text">{children}</h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-vadai-text">{children}</p>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-vadai-navy-light/60 px-1.5 py-0.5 font-mono text-[0.8em] text-vadai-cyan-light">
      {children}
    </code>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-vadai-warning/30 bg-vadai-warning/10 px-4 py-3 text-sm leading-relaxed text-vadai-text">
      {children}
    </div>
  );
}

function Table({
  head,
  rows,
  wrapFirst = false,
}: {
  head: string[];
  rows: React.ReactNode[][];
  wrapFirst?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-vadai-navy-light">
      <table className="w-full text-sm">
        <thead className="bg-vadai-navy-light/30 text-left text-xs uppercase tracking-wide text-vadai-muted">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-vadai-navy-light/50 align-top">
              {r.map((cell, j) => (
                <td
                  key={j}
                  className={cn(
                    "px-4 py-2.5",
                    j === 0 ? "text-vadai-text" : "text-vadai-muted",
                    j === 0 && !wrapFirst && "whitespace-nowrap"
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
