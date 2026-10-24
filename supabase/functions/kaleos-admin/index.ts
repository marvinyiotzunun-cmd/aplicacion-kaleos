// Kaleos: alta de hermanos y cambio de PIN (requiere la clave de servicio, por eso vive aquí)
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const STAGES = ["visitante", "miembro", "bautizado", "grupo", "sirviendo", "lider"];
const ROLES = ["member", "usher", "pastor"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function newPin() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 1000000).padStart(6, "0");
}

export function memberEmail(slug: string, memberNo: string) {
  return `${memberNo.toLowerCase()}@${slug}.kaleos.app`;
}

async function nextMemberNo(churchId: string, prefix: string) {
  const { data } = await admin.from("kaleos_profiles").select("member_no").eq("church_id", churchId);
  let max = 0;
  for (const r of data ?? []) {
    const n = parseInt(String(r.member_no).split("-")[1] ?? "0", 10);
    if (n > max) max = n;
  }
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

function clean(v: unknown) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

async function createPerson(church: any, b: any, role: string) {
  const fullName = clean(b.full_name);
  if (!fullName) return json({ error: "Falta el nombre" }, 400);
  const stage = STAGES.includes(b.stage) ? b.stage : "visitante";
  const pin = /^\d{6}$/.test(String(b.pin ?? "")) ? String(b.pin) : newPin();

  let memberNo = "";
  let userId = "";
  for (let attempt = 0; attempt < 3 && !userId; attempt++) {
    memberNo = await nextMemberNo(church.id, church.member_prefix);
    const { data, error } = await admin.auth.admin.createUser({
      email: memberEmail(church.slug, memberNo),
      password: pin,
      email_confirm: true,
      user_metadata: { app: "kaleos", church: church.slug, member_no: memberNo },
    });
    if (data?.user) userId = data.user.id;
    else if (!String(error?.message ?? "").toLowerCase().includes("already")) {
      return json({ error: error?.message ?? "No se pudo crear la cuenta" }, 500);
    }
  }
  if (!userId) return json({ error: "No se pudo asignar número de miembro" }, 500);

  const { error: pe } = await admin.from("kaleos_profiles").insert({
    id: userId,
    church_id: church.id,
    member_no: memberNo,
    full_name: fullName,
    title: clean(b.title) ?? "Hno.",
    role,
    stage,
    phone: clean(b.phone),
    birthday: clean(b.birthday),
    member_since: clean(b.member_since),
    baptism_date: clean(b.baptism_date),
    serves_in: clean(b.serves_in),
  });
  if (pe) {
    await admin.auth.admin.deleteUser(userId);
    return json({ error: pe.message }, 400);
  }
  return json({ ok: true, id: userId, member_no: memberNo, pin });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let b: any;
  try { b = await req.json(); } catch { return json({ error: "Cuerpo inválido" }, 400); }

  // Primer pastor: solo con la clave de instalación y si la iglesia aún no tiene pastor
  if (b.action === "bootstrap") {
    const key = Deno.env.get("KALEOS_SETUP_KEY");
    if (!key || b.setup_key !== key) return json({ error: "Clave de instalación incorrecta" }, 403);
    const { data: church } = await admin.from("kaleos_churches").select("*").eq("slug", b.church_slug ?? "la-linea").single();
    if (!church) return json({ error: "Iglesia no encontrada" }, 404);
    const { count } = await admin.from("kaleos_profiles").select("id", { count: "exact", head: true })
      .eq("church_id", church.id).eq("role", "pastor");
    if ((count ?? 0) > 0) return json({ error: "Esta iglesia ya tiene pastor" }, 409);
    return createPerson(church, { ...b, stage: "lider" }, "pastor");
  }

  // El resto exige un pastor con sesión iniciada
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ error: "Sesión no válida" }, 401);
  const { data: me } = await admin.from("kaleos_profiles").select("*").eq("id", u.user.id).single();
  if (!me || me.role !== "pastor" || !me.active) return json({ error: "Solo el pastor" }, 403);
  const { data: church } = await admin.from("kaleos_churches").select("*").eq("id", me.church_id).single();

  if (b.action === "create_member") {
    const role = ROLES.includes(b.role) ? b.role : "member";
    return createPerson(church, b, role);
  }

  if (b.action === "reset_pin") {
    const { data: p } = await admin.from("kaleos_profiles").select("id, church_id, member_no").eq("id", b.profile_id).single();
    if (!p || p.church_id !== me.church_id) return json({ error: "Hermano no encontrado" }, 404);
    const pin = newPin();
    const { error } = await admin.auth.admin.updateUserById(p.id, { password: pin });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, member_no: p.member_no, pin });
  }

  return json({ error: "Acción desconocida" }, 400);
});
