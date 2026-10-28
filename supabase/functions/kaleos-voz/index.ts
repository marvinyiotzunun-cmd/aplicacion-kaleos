// Kaleos: pase de voz en tiempo real para el asistente del pastor (OpenAI Realtime, como el modo de voz de ChatGPT).
// La clave OPENAI_API_KEY nunca sale de aquí: el teléfono recibe un pase temporal y habla directo con OpenAI.
// Las acciones (herramientas) solo son las que la app del pastor ya permite; la app las ejecuta con las reglas de la base.
// Secretos: OPENAI_API_KEY (obligatorio), OPENAI_REALTIME_MODEL (opcional, por defecto gpt-realtime), OPENAI_VOICE (opcional, por defecto marin).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SECCIONES = ["asistente", "versiculos", "pedidos", "agenda", "hermanos", "comunidades", "saludos", "mayordomia", "controles", "reporte", "iglesia"];
const fn = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []) =>
  ({ type: "function", name, description, parameters: { type: "object", properties, required } });
const TOOLS = [
  fn("ir_a", "Abrir una sección de la app del pastor en la pantalla.", { seccion: { type: "string", enum: SECCIONES } }, ["seccion"]),
  fn("ver_agenda", "Leer actividades, recordatorios, visitas y cumpleaños de hoy o de los próximos días.", { dias: { type: "integer", minimum: 1, maximum: 7 } }),
  fn("ver_pedidos", "Leer los pedidos pendientes de los hermanos (oración, visita, felicitación, otro)."),
  fn("ver_cumpleanos", "Leer quién cumple años en los próximos días.", { dias: { type: "integer", minimum: 1, maximum: 31 } }),
  fn("ver_cifras", "Leer las cifras de mayordomía del mes (confirmadas por Secretaría) y el avance de los proyectos."),
  fn("buscar_hermano", "Buscar un hermano por nombre: nivel, número, cumpleaños y si tiene teléfono.", { nombre: { type: "string" } }, ["nombre"]),
  fn("crear_recordatorio", "Guardar un recordatorio privado del pastor. Antes, confirme en voz alta qué y cuándo, y espere su sí.",
    { titulo: { type: "string" }, cuando: { type: "string", description: "Fecha y hora ISO 8601 con zona -06:00 (Guatemala)" } }, ["titulo"]),
  fn("preparar_aviso", "Abrir en pantalla el editor de un aviso o invitación ya llenado. El pastor lo revisa y lo envía él mismo.", {
    titulo: { type: "string" }, detalle: { type: "string" }, cuando: { type: "string", description: "ISO 8601 con zona -06:00" },
    lugar: { type: "string" }, comunidad: { type: "string", description: "slug de una comunidad de la lista, o vacío para toda la iglesia" },
  }, ["titulo"]),
  fn("disenar_versiculo", "Diseñar en pantalla una imagen con un versículo (Reina-Valera 1960).", {
    referencia: { type: "string" }, texto: { type: "string" },
    estilo: { type: "string", enum: ["cumbres", "luz", "aurora", "olas", "lienzo"] },
    color: { type: "string", enum: ["alba", "olivo", "vino", "mar", "ocaso", "oro", "cielo", "lino"] },
    formato: { type: "string", enum: ["cuadrado", "post", "historia"], description: "historia = estado de WhatsApp" },
  }),
  fn("preparar_tarjeta", "Abrir en pantalla la tarjeta de felicitación para un hermano. El pastor la envía él mismo.", { nombre: { type: "string" } }, ["nombre"]),
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return json({ error: "sin_clave" }, 503);

  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const { data: u } = await sb.auth.getUser(auth.replace("Bearer ", ""));
  if (!u?.user) return json({ error: "Sesión no válida" }, 401);
  const { data: me } = await sb.from("kaleos_profiles").select("id, role, full_name, title, church_id").eq("id", u.user.id).single();
  if (!me || me.role !== "pastor") return json({ error: "Solo el pastor" }, 403);
  const [{ data: church }, { data: comms }] = await Promise.all([
    sb.from("kaleos_churches").select("name").eq("id", me.church_id).single(),
    sb.from("kaleos_communities").select("slug, name").eq("church_id", me.church_id).order("sort"),
  ]);

  const ahora = new Date().toLocaleString("es-GT", { timeZone: "America/Guatemala", dateStyle: "full", timeStyle: "short" });
  const instructions = `Eres Kaleos, el asistente de voz del ${me.title || "pastor"} ${me.full_name}, de ${church?.name || "la iglesia"} (Guatemala).
Ahora es ${ahora} (hora de Guatemala, zona -06:00).
Hablas en español de Guatemala, de "usted", cálido y breve: una o dos frases por turno, como en una llamada.
Para saber algo, usa las herramientas; nunca inventes nombres, cifras ni fechas.
Puedes abrir secciones de la app (ir_a), leer su agenda, pedidos, cumpleaños, hermanos y cifras, guardar recordatorios,
y preparar en pantalla avisos, tarjetas e imágenes de versículos. Nada se envía solo: lo que preparas queda en pantalla y el pastor lo envía.
Antes de guardar un recordatorio, repite qué y cuándo, y espera su "sí".
Kaleos es solo informativo: no das consejería ni enseñanza. Las cifras las registra Secretaría; tú solo las lees.
Comunidades (slug: nombre): ${(comms ?? []).map((c: any) => `${c.slug}: ${c.name}`).join("; ") || "ninguna"}.
Secciones: ${SECCIONES.join(", ")}.`;

  const r = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      expires_after: { anchor: "created_at", seconds: 60 },
      session: {
        type: "realtime",
        model: Deno.env.get("OPENAI_REALTIME_MODEL") ?? "gpt-realtime",
        instructions,
        tools: TOOLS,
        tool_choice: "auto",
        audio: {
          input: { transcription: { model: "gpt-4o-mini-transcribe", language: "es" }, turn_detection: { type: "semantic_vad" } },
          output: { voice: Deno.env.get("OPENAI_VOICE") ?? "marin" },
        },
      },
    }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok || !out.value) return json({ error: out?.error?.message ?? "OpenAI no respondió" }, 502);
  return json({ token: out.value, expires_at: out.expires_at });
});
