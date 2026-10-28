// Kaleos: asistente del pastor con ChatGPT (OpenAI).
// Solo elige una acción de una lista cerrada; la app la muestra y nada se envía sin el «sí» del pastor.
// Necesita el secreto OPENAI_API_KEY (y opcionalmente OPENAI_MODEL) en las Edge Functions de Supabase.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const ACTIONS = ["hoy", "cumple", "pedidos", "aviso", "recordatorio", "versiculo", "responder"];

const SYSTEM = `Eres el asistente de Kaleos, la app pastoral de una iglesia evangélica en Guatemala.
Hablas en español sencillo y respetuoso, de "usted", en frases cortas.
Solo puedes elegir UNA de estas acciones (no inventes otras):
- "hoy": resumir la agenda del día (actividades, cumpleaños, pedidos).
- "cumple": mostrar quién cumple años para preparar tarjetas.
- "pedidos": mostrar pedidos pendientes (oración, visita, felicitación).
- "aviso": preparar un aviso o invitación para la iglesia o una comunidad. Llena args.title, args.body, args.when (ISO, hora de Guatemala, si la dice), args.place y args.community (slug, solo de la lista dada).
- "recordatorio": guardar un recordatorio privado del pastor. Llena args.title y args.when (ISO).
- "versiculo": abrir el estudio para hacer una imagen con un versículo. Si el pastor nombra uno, pon args.ref y args.text (Reina-Valera 1960).
- "responder": contestar algo con los datos dados, sin acción.
Nunca envías nada: la app le pide confirmación al pastor. Si no sabes algo, dilo. No des consejería ni enseñanza: Kaleos es solo informativo.`;

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
  const { data: me } = await sb.from("kaleos_profiles").select("id, role, full_name, church_id").eq("id", u.user.id).single();
  if (!me || me.role !== "pastor") return json({ error: "Solo el pastor" }, 403);

  let b: { text?: string; history?: { who: string; text: string }[] };
  try { b = await req.json(); } catch { return json({ error: "Cuerpo inválido" }, 400); }
  const text = String(b.text ?? "").slice(0, 800);
  if (!text.trim()) return json({ error: "Escriba su pedido" }, 400);

  // Lo que el asistente puede saber (todo pasa por las reglas de la base: solo lo que el pastor ya ve)
  const now = new Date();
  const [reqs, msgs, comms, rems, people] = await Promise.all([
    sb.from("kaleos_prayer_requests").select("kind, note, for_name, for_date, status, created_at, who:kaleos_profiles!profile_id(full_name)")
      .eq("church_id", me.church_id).neq("status", "atendida").order("created_at", { ascending: false }).limit(20),
    sb.from("kaleos_messages").select("title, event_at, place").eq("church_id", me.church_id).is("profile_id", null)
      .gte("event_at", now.toISOString()).order("event_at").limit(15),
    sb.from("kaleos_communities").select("slug, name").eq("church_id", me.church_id).order("sort"),
    sb.from("kaleos_reminders").select("title, due_at").eq("owner_id", me.id).eq("done", false).order("due_at").limit(10),
    sb.from("kaleos_profiles").select("full_name, birthday").eq("church_id", me.church_id).eq("active", true).not("birthday", "is", null),
  ]);
  const md = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Guatemala" }).slice(5);
  const soon = new Set(Array.from({ length: 8 }, (_, i) => md(new Date(now.getTime() + i * 86400000))));
  const context = {
    ahora: now.toLocaleString("es-GT", { timeZone: "America/Guatemala", dateStyle: "full", timeStyle: "short" }),
    pastor: me.full_name,
    pedidos_pendientes: (reqs.data ?? []).map((r: any) => ({ tipo: r.kind, de: r.who?.full_name, nota: r.note, para: r.for_name, fecha: r.for_date, estado: r.status })),
    proximas_actividades: msgs.data ?? [],
    comunidades: comms.data ?? [],
    recordatorios: rems.data ?? [],
    cumpleanos_proximos: (people.data ?? []).filter((p: any) => soon.has(String(p.birthday).slice(5, 10)))
      .map((p: any) => ({ nombre: p.full_name, dia: String(p.birthday).slice(5, 10) })),
  };

  const history = (b.history ?? []).slice(-6).map((h) => ({ role: h.who === "me" ? "user" : "assistant", content: String(h.text).slice(0, 600) }));
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "system", content: "Datos de Kaleos: " + JSON.stringify(context) },
        ...history,
        { role: "user", content: text },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "accion", strict: true,
          schema: {
            type: "object", additionalProperties: false, required: ["action", "reply", "args"],
            properties: {
              action: { type: "string", enum: ACTIONS },
              reply: { type: "string" },
              args: {
                type: "object", additionalProperties: false,
                required: ["title", "body", "when", "place", "community", "ref", "text"],
                properties: {
                  title: { type: ["string", "null"] }, body: { type: ["string", "null"] }, when: { type: ["string", "null"] },
                  place: { type: ["string", "null"] }, community: { type: ["string", "null"] },
                  ref: { type: ["string", "null"] }, text: { type: ["string", "null"] },
                },
              },
            },
          },
        },
      },
    }),
  });
  if (!r.ok) return json({ error: "ChatGPT no respondió (" + r.status + ")" }, 502);
  const out = await r.json();
  try {
    const a = JSON.parse(out.choices[0].message.content);
    if (!ACTIONS.includes(a.action)) a.action = "responder";
    return json(a);
  } catch {
    return json({ action: "responder", reply: "No le entendí bien. ¿Me lo dice de otra forma?", args: {} });
  }
});
