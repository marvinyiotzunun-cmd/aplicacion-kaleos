// Kaleos: convierte en voz humana (ElevenLabs) lo que dice el asistente o un aviso.
// La clave ELEVENLABS_API_KEY nunca sale de aquí; el teléfono solo recibe el audio (mp3).
// Si no hay clave responde 503 «sin_clave» y la app usa la mejor voz del navegador.
// Secretos: ELEVENLABS_API_KEY (obligatorio), ELEVENLABS_VOICE_ID (opcional, por defecto Michelle, guatemalteca),
// ELEVENLABS_MODEL (opcional, por defecto eleven_flash_v2_5: rápida y la más barata).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Voces probadas para Kaleos (2026-11-11). El pastor elige una en la app; solo se aceptan estas.
const VOCES: Record<string, string> = {
  michelle: "MbMvLOFbicjtQwgx0j2r", // mujer, acento guatemalteco
  ana: "m7yTemJqdIqrcNleANfX", // mujer, mexicana neutra
  antonio: "htFfPSZGJwjBv1CL0aMD", // hombre joven, latino neutro
  roberto: "gUzzwyvvop8GQmnl2Akf", // hombre maduro, barítono mexicano
};
const MAX = 700; // caracteres por pedido, para cuidar los créditos

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  const key = Deno.env.get("ELEVENLABS_API_KEY");
  if (!key) return json({ error: "sin_clave" }, 503);

  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const { data: u } = await sb.auth.getUser(auth.replace("Bearer ", ""));
  if (!u?.user) return json({ error: "Sesión no válida" }, 401);

  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? "").replace(/\s+/g, " ").trim().slice(0, MAX);
  if (!text) return json({ error: "Falta el texto" }, 400);
  const voice = VOCES[String(body.voz ?? "")] ?? Deno.env.get("ELEVENLABS_VOICE_ID") ?? VOCES.michelle;

  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: Deno.env.get("ELEVENLABS_MODEL") ?? "eleven_flash_v2_5",
      language_code: "es",
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true, speed: 1.0 },
    }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    const msg = e?.detail?.message ?? e?.detail ?? "ElevenLabs no respondió";
    return json({ error: typeof msg === "string" ? msg : "ElevenLabs no respondió" }, 502);
  }
  return new Response(r.body, { headers: { ...cors, "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
});
