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

// Lo que el asistente sabe de La Línea (de su Facebook y su grupo de WhatsApp; igual que docs/js/iglesia.js)
const IGLESIA = `Iglesia de Dios E.C. "La Línea", 0 calle 4-08, La Línea Zona 6, Quetzaltenango (Región 4, Distrito Quetzaltenango No. 2). Fundada en 1987; antes se llamaba «Tabernáculo de Alabanza»; aniversario a mediados de julio.
Lema: «¡Proclamar las buenas nuevas de salvación! ¡Cristo es el Señor!». Lema de la denominación: «¡Adelante Iglesia de Dios!».
Reuniones: culto dominical (hora por confirmar); Culto de Misiones el último domingo del mes; Semana de Oración y clamor la primera semana de cada mes, lunes a viernes 7:00 p. m.;
Discipulado infantil martes 7:00 p. m.; Discipulado cristiano jueves 6:30 p. m.; Servicio de jóvenes sábado 6:00 p. m.
Fechas: 13 abr aniversario de la Iglesia de Dios en Guatemala; 15 ago Noche de fogata; 19 ago aniversario de la Iglesia de Dios; fin de agosto Día de la Biblia y Reconocimiento Pastoral;
13-15 sep Mañana Nacionalista; 1 oct Día del Niño; 31 oct Reforma Protestante; noviembre Clausura del Discipulado. Campaña: proyecto misionero Cartagena (Colombia).
Tema de noviembre 2026: «No se turbe vuestro corazón» (Juan 14:1).
Saludo del pastor cada mañana: «Que la gracia y la paz de nuestro Señor Jesucristo estén siempre con ustedes amados hermanos. ¡Buenos días!»
Tono del pastor en WhatsApp: cercano, en primera persona, con exclamaciones («¡Les esperamos!», «Cordialmente invitados», «Sigamos adelante»), trata de Hno./Hna., «con usted y familia», sin emojis en avisos y sin firma.
Reglas: versículos siempre Reina-Valera 1960 («texto» Libro cap:vers); niños nunca en primer plano; salud y ofrendas con nombre solo en privado, nunca al grupo de toda la iglesia.`;

// La misma lista cerrada que entiende el cerebro local de la app (docs/js/cerebro.js)
const ACTIONS = ["hoy", "cumple", "pedidos", "aviso", "recordatorio", "versiculo", "tarjeta", "buscar", "cifras", "ir", "saludo_dia", "contestar", "info", "ayuda", "responder"];
const ESTILOS = ["cumbres", "luz", "aurora", "olas", "lienzo", "estrellas", "vitral", "trigal", "acuarela", "petalos", "cruz", "geometria", "papiro"];
const COLORES = ["alba", "olivo", "vino", "mar", "ocaso", "oro", "cielo", "lino", "tinta", "esmeralda", "coral", "granate", "noche", "trigo", "rosa", "perla", "linea"];
const SECCIONES = ["asistente", "versiculos", "pedidos", "agenda", "hermanos", "comunidades", "saludos", "mayordomia", "controles", "reporte", "iglesia"];

const SYSTEM = `Eres el asistente de Kaleos, la app pastoral de la iglesia de abajo, en Guatemala.
Hablas en español de Guatemala, de "usted", cálido y breve (una o dos frases).
Elige UNA acción de esta lista (no inventes otras) y llena solo los args que apliquen; los demás van en null:
- "hoy": agenda de un día o varios. args.dia (AAAA-MM-DD) y args.dias (1 a 7). «¿Qué tengo el sábado?» → dia del sábado, dias 1. «Agenda de la semana» → dias 7.
- "cumple": quién cumple años. args.dias (1 hoy, 7 semana, 31 mes).
- "pedidos": pedidos pendientes. args.tipo: oracion, visita, felicitacion u otro (o null para todos).
- "aviso": preparar un aviso o invitación. args.title (corto, sin la fecha), args.body, args.when (ISO con -06:00, solo si dijo la hora), args.date (AAAA-MM-DD si dijo el día sin hora), args.place, args.community (slug, solo de la lista dada).
  Si pide una reunión fija, pon args.pieza: oracion (Semana de Oración), misiones (Culto de Misiones), discipulado, infantil (Discipulado infantil), jovenes, tema (Tema del mes): la app calcula la fecha.
- "recordatorio": recordatorio privado del pastor. args.title y args.when (ISO con -06:00; si solo dijo el día, a las 09:00).
- "versiculo": imagen con un versículo. args.ref y args.text (Reina-Valera 1960, exacto; si no está seguro del texto, deje text en null), args.estilo, args.color, args.formato (cuadrado, post, historia = estado de WhatsApp).
- "tarjeta": tarjeta de felicitación para un hermano. args.nombre.
- "buscar": datos de un hermano. args.nombre y args.dato (telefono, cumple, nivel o todo).
- "cifras": ofrendas, diezmos, donaciones y proyectos del mes.
- "ir": abrir una sección. args.seccion.
- "saludo_dia": el saludo de la mañana para el grupo de WhatsApp con el versículo del día.
- "contestar": preparar una respuesta personal a un hermano. args.nombre y args.gracias (true si es para agradecer).
- "info": datos de la iglesia. args.tema: horario (con args.reunion: dominical, misiones, oracion, infantil, discipulado, jovenes), lema, direccion, tema o calendario.
- "ayuda": qué puede hacer el asistente.
- "responder": contestar con los datos dados, sin acción.
Nunca envías nada: la app le pide confirmación al pastor. Si no sabe algo, dígalo. No da consejería ni enseñanza: Kaleos es solo informativo.
Si un aviso para toda la iglesia menciona salud u ofrendas de una persona con nombre, recuérdelo en reply (va en privado).

${IGLESIA}`;

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
                required: ["title", "body", "when", "date", "place", "community", "pieza", "ref", "text", "estilo", "color", "formato", "dia", "dias", "tipo", "nombre", "dato", "seccion", "gracias", "tema", "reunion"],
                properties: {
                  title: { type: ["string", "null"] }, body: { type: ["string", "null"] }, when: { type: ["string", "null"] }, date: { type: ["string", "null"] },
                  place: { type: ["string", "null"] }, community: { type: ["string", "null"] },
                  pieza: { type: ["string", "null"], enum: ["oracion", "misiones", "discipulado", "infantil", "jovenes", "tema", null] },
                  ref: { type: ["string", "null"] }, text: { type: ["string", "null"] },
                  estilo: { type: ["string", "null"], enum: [...ESTILOS, null] }, color: { type: ["string", "null"], enum: [...COLORES, null] },
                  formato: { type: ["string", "null"], enum: ["cuadrado", "post", "historia", null] },
                  dia: { type: ["string", "null"] }, dias: { type: ["integer", "null"] },
                  tipo: { type: ["string", "null"], enum: ["oracion", "visita", "felicitacion", "otro", null] },
                  nombre: { type: ["string", "null"] }, dato: { type: ["string", "null"], enum: ["telefono", "cumple", "nivel", "todo", null] },
                  seccion: { type: ["string", "null"], enum: [...SECCIONES, null] }, gracias: { type: ["boolean", "null"] },
                  tema: { type: ["string", "null"], enum: ["horario", "lema", "direccion", "tema", "calendario", null] },
                  reunion: { type: ["string", "null"], enum: ["dominical", "misiones", "oracion", "infantil", "discipulado", "jovenes", null] },
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
    // quita los args vacíos para que la app use sus valores por defecto
    a.args = Object.fromEntries(Object.entries(a.args ?? {}).filter(([, v]) => v !== null && v !== ""));
    return json(a);
  } catch {
    return json({ action: "responder", reply: "No le entendí bien. ¿Me lo dice de otra forma?", args: {} });
  }
});
