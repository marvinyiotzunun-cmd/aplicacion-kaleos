/* Supabase simulado para las pruebas de Kaleos (sin red).
   Reemplaza a vendor/supabase.js durante las pruebas. Imita las reglas (RLS), las restricciones
   y las funciones de la base que la app usa, para que las pruebas detecten pedidos que la base real rechazaría.
   Cuentas: pastor LL-0001/246810 · Secretaría LL-0002/135790 · miembro LL-0003/112233 · miembro con cumpleaños LL-0004/444444 */
(function () {
  "use strict";
  const TZ = "America/Guatemala";
  const today = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const addDays = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const T = today();
  const at = (day, hm) => new Date(`${addDays(T, day)}T${hm}:00-06:00`).toISOString();
  const md = (day) => addDays(T, day).slice(5);
  const ago = (h) => new Date(Date.now() - h * 3600000).toISOString();
  const uuid = () => "u-" + Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-4);
  const CH = "ch-1";
  const LS = "kaleos-mock-db", LU = "kaleos-mock-uid";

  // ===== datos de ejemplo =====
  function seed() {
    const P = (id, no, name, title, extra) => ({ id, church_id: CH, member_no: no, full_name: name, title, role: "member", stage: "visitante", level: "miembro", active: true,
      phone: "5" + no.slice(4) + "1234", email: null, birthday: null, wedding_date: null, baptism_date: null, member_since: "2015-03-01", serves_in: null,
      qr_token: "qr-" + no.toLowerCase(), preferred_channel: "whatsapp", contact_updated_at: ago(100), created_at: ago(2000), ...extra });
    const profiles = [
      P("p-01", "LL-0001", "Samuel Cifuentes", "Pastor", { role: "pastor", level: "consejero", birthday: "1975-04-12" }),
      P("p-02", "LL-0002", "Rebeca Morales", "Hna.", { role: "secretary", level: "lider" }),
      P("p-03", "LL-0003", "Pedro Ajú", "Hno.", { level: "miembro", birthday: "1968-" + md(2), email: "pedro@ejemplo.com" }),
      P("p-04", "LL-0004", "Marta Xicará", "Hna.", { level: "neofito", birthday: "1990-" + md(0), contact_updated_at: null, phone: null }),
      P("p-05", "LL-0005", "José Tzoc", "Hno.", { level: "consejero", wedding_date: "2001-" + md(4) }),
      P("p-06", "LL-0006", "Ana Lucía Pérez", "Hna.", { level: "neofito", birthday: "2004-" + md(6), preferred_channel: "correo", email: "ana@ejemplo.com" }),
      P("p-07", "LL-0007", "Daniel Coyoy", "Hno.", { level: "adherente", phone: null }),
      P("p-08", "LL-0008", "Esther Quiché", "Hna.", { level: "miembro", baptism_date: "2016-" + md(1) }),
      P("p-09", "LL-0009", "Rubén García", "Hno.", { level: "lider", active: false }),
    ];
    const comm = (id, slug, name, subtitle, emblem, palette, style, seed, sort, extra) => ({ id, church_id: CH, slug, name, subtitle, emblem, palette, style, seed, sort, leader_id: null, meets: null,
      whatsapp_url: null, guidance: null, guidance_at: null, sub_note: null, created_at: ago(500), ...extra });
    const T0 = {
      kaleos_churches: [{ id: CH, slug: "la-linea", name: "Iglesia de Dios Evangelio Completo de La Línea", short_name: "La Línea", mission: "Hacer discípulos que amen a Dios.", member_prefix: "LL",
        pastor_phone: "5555 1234", supervisor_name: "Supervisor de Distrito", supervisor_email: "supervisor@ejemplo.org", greeting_signature: null, whatsapp_url: "https://chat.whatsapp.com/ejemplo",
        giving_info: "Banrural · Monetaria 300-000000-0", created_at: ago(5000) }],
      kaleos_profiles: profiles,
      kaleos_communities: [
        comm(1, "emergente", "Generación Emergente", "Jóvenes", "c_emergente", "alba", "cumbres", 4, 1, { leader_id: "p-03", meets: "Viernes 19:00", whatsapp_url: "https://chat.whatsapp.com/jovenes", guidance: "Oremos por los que estudian.", guidance_at: ago(30) }),
        comm(2, "diaconos", "Diáconos", "Servidores", "c_diaconos", "oro", "luz", 7, 2),
        comm(3, "plata", "Cabellos de Plata", "Ancianos", "c_plata", "lino", "lienzo", 2, 3),
        comm(4, "damas", "Damas", "Mujeres de la iglesia", "c_damas", "vino", "aurora", 9, 4),
        comm(9, "alabanza", "Alabanza", "Con su ministerio de Danza", "c_alabanza", "ocaso", "olas", 8, 9, { sub_note: "Ministerio de Danza" }),
      ],
      kaleos_community_members: [{ community_id: 1, profile_id: "p-03" }, { community_id: 2, profile_id: "p-03" }, { community_id: 4, profile_id: "p-04" }, { community_id: 1, profile_id: "p-06" }],
      kaleos_prayer_requests: [
        { id: 1, church_id: CH, profile_id: "p-04", kind: "oracion", status: "nueva", note: "Por la salud de mi mamá.", for_name: null, for_date: null, created_at: ago(3), created_by: "p-04", done_at: null },
        { id: 2, church_id: CH, profile_id: "p-07", kind: "visita", status: "nueva", note: "Mi esposa está enferma.", for_name: null, for_date: T, created_at: ago(20), created_by: "p-07", done_at: null },
        { id: 3, church_id: CH, profile_id: "p-06", kind: "felicitacion", status: "nueva", note: "Graduación", for_name: null, for_date: addDays(T, 3), created_at: ago(30), created_by: "p-06", done_at: null },
        { id: 4, church_id: CH, profile_id: "p-03", kind: "oracion", status: "orando", note: "Por trabajo.", for_name: null, for_date: null, created_at: ago(50), created_by: "p-03", done_at: null },
        { id: 5, church_id: CH, profile_id: "p-08", kind: "visita", status: "atendida", note: "Visita a la familia.", for_name: null, for_date: null, created_at: ago(120), created_by: "p-08", done_at: ago(100) },
      ],
      kaleos_messages: [
        { id: 101, church_id: CH, profile_id: null, kind: "invitacion", title: "Culto de oración", body: "Le esperamos para orar juntos.", place: "Templo", event_at: at(0, "19:00"), community_id: null, levels: null, art: null, card: null, created_by: "p-01", created_at: ago(48) },
        { id: 102, church_id: CH, profile_id: null, kind: "invitacion", title: "Vigilia de jóvenes", body: "Generación Emergente.", place: "Templo", event_at: at(1, "20:00"), community_id: 1, levels: null, art: null, card: null, created_by: "p-01", created_at: ago(40) },
        { id: 103, church_id: CH, profile_id: null, kind: "recordatorio", title: "Reunión de damas", body: "", place: "Salón", event_at: at(2, "15:00"), community_id: 4, levels: null, art: null, card: null, created_by: "p-01", created_at: ago(30) },
        { id: 104, church_id: CH, profile_id: null, kind: "invitacion", title: "Culto dominical <b>Santa Cena</b>", body: "Santa Cena.", place: "Templo <i>central</i>", event_at: at(3, "10:00"), community_id: null, levels: null, art: null, card: null, created_by: "p-01", created_at: ago(30) },
        { id: 105, church_id: CH, profile_id: null, kind: "invitacion", title: "Escuela de líderes", body: "", place: "Salón", event_at: at(5, "19:00"), community_id: null, levels: ["miembro"], art: null, card: null, created_by: "p-01", created_at: ago(30) },
        { id: 106, church_id: CH, profile_id: null, kind: "aviso", title: "Aviso sin fecha", body: "Traer Biblia.", place: null, event_at: null, community_id: null, levels: null, art: null, card: null, created_by: "p-01", created_at: ago(10) },
        { id: 107, church_id: CH, profile_id: "p-03", kind: "felicitacion", title: "Cumpleaños", body: "¡Feliz cumpleaños, Pedro!", place: null, event_at: null, community_id: null, levels: null, art: null,
          card: { tpl: "fiesta", c: { kicker: "1 de enero", headline: "¡Feliz cumpleaños!", line: "Damos gracias a Dios", name: "Hno. Pedro Ajú", verse: "Jehová te bendiga.", ref: "Números 6:24", date: T, signature: "Pastor Samuel", from: "y toda la familia", church: "Iglesia de Dios E.C. · La Línea", seed: "x" } }, created_by: "p-01", created_at: ago(5) },
        { id: 108, church_id: CH, profile_id: "p-03", kind: "recordatorio", title: "Su turno: Culto", body: "Le corresponde servir.", place: null, event_at: null, community_id: null, levels: null, art: null, card: null, created_by: "p-02", created_at: ago(6) },
      ],
      kaleos_message_reads: [],
      kaleos_rsvp: [{ message_id: 101, profile_id: "p-06", church_id: CH, answer: "si", updated_at: ago(2) }],
      kaleos_reminders: [
        { id: 201, church_id: CH, owner_id: "p-01", title: "Llamar al hno. Rubén", due_at: at(0, "11:00"), done: false, created_at: ago(30) },
        { id: 202, church_id: CH, owner_id: "p-01", title: "Preparar la predicación", due_at: at(-1, "08:00"), done: false, created_at: ago(30) },
        { id: 203, church_id: CH, owner_id: "p-02", title: "Recordatorio de Secretaría", due_at: at(0, "09:00"), done: false, created_at: ago(30) },
      ],
      kaleos_logbook: [{ id: 301, church_id: CH, profile_id: "p-03", author_id: "p-01", note: "Conversamos sobre su ministerio.", created_at: ago(24 * 6) }],
      kaleos_visits: [{ id: 401, church_id: CH, profile_id: "p-03", pastor_id: "p-01", visited_on: addDays(T, -20), note: "Oramos por su hijo.", created_at: ago(480) }],
      kaleos_attendance: [{ id: 1, church_id: CH, profile_id: "p-03", service_date: addDays(T, -7), scanned_at: ago(168), scanned_by: "p-02" }, { id: 2, church_id: CH, profile_id: "p-05", service_date: addDays(T, -7), scanned_at: ago(168), scanned_by: "p-02" }],
      kaleos_notices: [{ id: 1, church_id: CH, title: "Aviso de la semana", body: "Vigilia el viernes a las 19:00.", sermon_title: "El buen pastor", sermon_url: "https://youtube.com/watch?v=x", created_by: "p-01", created_at: ago(72) }],
      kaleos_special_dates: [{ id: 1, church_id: CH, profile_id: "p-08", label: "Graduación", event_date: addDays(T, 5), yearly: false, created_by: "p-01", created_at: ago(5) }],
      kaleos_greetings: [], kaleos_verses: [], kaleos_reports: [], kaleos_staff_notes: [], kaleos_steps: [],
      kaleos_services: [{ id: 1, church_id: CH, service_date: addDays(T, 2), activity: "Culto de oración", usher_id: "p-03", worship_id: null, media_id: null, cleaning_id: 4, notified_at: null, created_at: ago(5) }],
      kaleos_funds: [
        [1, "proyecto", "Techo del templo", "Construcción", 85000, "marzo 2027", "cielo", "cumbres", "proyecto", true],
        [2, "proyecto", "Equipo misionero", "Misiones", 12000, "20 de noviembre", "ocaso", "cumbres", "c_misiones", true],
        [3, "proyecto", "Proyecto cerrado", "Viejo", 5000, "2025", "oro", "luz", "proyecto", false],
        [4, "necesidad", "Niños", "Refacción del domingo", 1500, "cada mes", "cielo", "luz", "c_infantil", true],
        [5, "necesidad", "Ancianos", "Transporte", 1800, "cada mes", "lino", "lienzo", "c_plata", true],
      ].map(([id, kind, name, subtitle, goal, until_label, palette, style, emblem, active]) => ({ id, church_id: CH, kind, name, subtitle, goal, until_label, palette, style, emblem, active, sort: id, created_at: ago(500) })),
      kaleos_gifts: [],
    };
    const m0 = T.slice(0, 8);
    let gid = 1;
    const g = (pid, kind, dest, fund, method, amount, status, date) => T0.kaleos_gifts.push({ id: gid, church_id: CH, profile_id: pid, kind, dest, fund_id: fund, method, amount, reference: null,
      receipt: (method === "sobre" ? "S-" : "R-") + String(gid++).padStart(5, "0"), status, gift_date: date, created_by: pid, confirmed_by: status === "confirmado" ? "p-02" : null, confirmed_at: null, created_at: date + "T16:00:00Z" });
    g("p-03", "diezmo", "General", null, "transferencia", 900, "confirmado", m0 + "01");
    g("p-05", "ofrenda", "Gratitud", null, "sobre", 250, "confirmado", m0 + "01");
    g("p-03", "proyecto", "Techo del templo", 1, "transferencia", 1200, "confirmado", m0 + "01");
    g("p-06", "donacion", "Niños", 4, "efectivo", 300, "confirmado", addDays(m0 + "01", -3));
    g("p-04", "diezmo", "General", null, "transferencia", 450, "pendiente", T);
    g(null, "ofrenda", "General", null, "sobre", 100, "pendiente", T);
    const pins = { "p-01": "246810", "p-02": "135790", "p-03": "112233", "p-04": "444444", "p-05": "555555", "p-06": "666666", "p-07": "777777", "p-08": "888888", "p-09": "999999" };
    return { tables: T0, pins, seq: 1000 };
  }

  let DB;
  try { DB = JSON.parse(localStorage.getItem(LS)); } catch (_) {}
  if (!DB || !DB.tables) DB = seed();
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(DB)); } catch (_) {} };
  const tb = (n) => DB.tables[n] || (DB.tables[n] = []);
  const LOG = (window.__MOCK_LOG = []);
  window.__MOCK = { get db() { return DB; }, reset() { localStorage.removeItem(LS); localStorage.removeItem(LU); }, save };

  // ===== sesión =====
  let uid = null;
  try { uid = localStorage.getItem(LU); } catch (_) {}
  const me = () => uid && tb("kaleos_profiles").find((p) => p.id === uid && p.active);
  const role = () => (me() || {}).role || null;
  const church = () => (me() || {}).church_id || null;
  const isPastor = () => role() === "pastor", isSec = () => role() === "secretary", isStaff = () => isPastor() || isSec();
  const inComm = (cid) => tb("kaleos_community_members").some((m) => m.community_id === cid && m.profile_id === uid);
  const profOf = (id) => tb("kaleos_profiles").find((p) => p.id === id);
  const sameChurchProfile = (id) => { const p = profOf(id); return p && p.church_id === church(); };
  const commOf = (id) => tb("kaleos_communities").find((c) => c.id === id);

  // ===== reglas (copiadas de las migraciones) =====
  const own = (r) => r.profile_id === uid;
  const RLS = {
    kaleos_churches: { select: (r) => r.id === church(), update: (r) => r.id === church() && isStaff(), check: (r) => r.id === church() },
    kaleos_profiles: { select: (r) => r.id === uid || (r.church_id === church() && isStaff()), update: (r) => r.church_id === church() && isStaff(), check: (r) => r.church_id === church() },
    kaleos_attendance: { select: (r) => own(r) || (r.church_id === church() && ["pastor", "usher", "secretary"].includes(role())) },
    kaleos_prayer_requests: {
      select: (r) => own(r) || (r.church_id === church() && isPastor()),
      insert: (r) => r.church_id === church() && (own(r) || (isPastor() && sameChurchProfile(r.profile_id))),
      update: (r) => (r.church_id === church() && isPastor()) || (own(r) && r.status === "nueva"),
      check: (r) => r.church_id === church(),
    },
    kaleos_notices: { select: (r) => r.church_id === church(), all: (r) => r.church_id === church() && isPastor() },
    kaleos_visits: { select: (r) => r.church_id === church() && isStaff(), all: (r) => r.church_id === church() && isPastor() },
    kaleos_reports: { all: (r) => r.church_id === church() && isPastor() },
    kaleos_special_dates: { all: (r) => r.church_id === church() && isPastor() },
    kaleos_greetings: { all: (r) => r.church_id === church() && isPastor() },
    kaleos_messages: {
      select: (r) => r.church_id === church() && (isStaff() || r.profile_id === uid || (r.profile_id == null && (r.community_id == null || inComm(r.community_id)) && (r.levels == null || r.levels.includes((me() || {}).level)))),
      all: (r) => r.church_id === church() && isStaff(),
    },
    kaleos_message_reads: { all: (r) => own(r), check: (r) => { const m = tb("kaleos_messages").find((x) => x.id === r.message_id); return own(r) && m && m.church_id === church() && (m.profile_id == null || m.profile_id === uid); } },
    kaleos_rsvp: { select: (r) => r.church_id === church(), all: (r) => own(r), check: (r) => { const m = tb("kaleos_messages").find((x) => x.id === r.message_id); return own(r) && r.church_id === church() && m && m.church_id === church() && m.profile_id == null; } },
    kaleos_communities: { select: (r) => r.church_id === church(), all: (r) => r.church_id === church() && isStaff() },
    kaleos_community_members: { select: (r) => own(r) || (isStaff() && (commOf(r.community_id) || {}).church_id === church()), all: (r) => isStaff() && (commOf(r.community_id) || {}).church_id === church() },
    kaleos_verses: { select: (r) => r.church_id === church(), all: (r) => r.church_id === church() && isStaff() },
    kaleos_reminders: { all: (r) => r.owner_id === uid, check: (r) => r.owner_id === uid && r.church_id === church() },
    kaleos_logbook: { all: (r) => r.church_id === church() && isPastor() },
    kaleos_staff_notes: { all: (r) => r.church_id === church() && isStaff() },
    kaleos_services: { all: (r) => r.church_id === church() && isStaff() },
    kaleos_funds: { select: (r) => r.church_id === church(), all: (r) => r.church_id === church() && isSec() },
    kaleos_gifts: {
      select: (r) => r.church_id === church() && (own(r) || isStaff()),
      insert: (r) => r.church_id === church() && ((own(r) && r.status === "pendiente" && ["transferencia", "sobre"].includes(r.method)) || isSec()),
      all: (r) => r.church_id === church() && isSec(),
    },
    kaleos_steps: { select: (r) => own(r) || isPastor() },
  };
  const allow = (t, op, r) => {
    const p = RLS[t]; if (!p) return false;
    const f = p[op] || (op === "check" ? p.insert || p.all : null) || (op !== "select" ? p.all : null) || (op === "select" ? p.all : null);
    return f ? !!f(r) : false;
  };
  const DEFAULTS = {
    kaleos_reminders: () => ({ owner_id: uid, done: false }),
    kaleos_logbook: () => ({ author_id: uid }),
    kaleos_gifts: () => ({ created_by: uid, status: "pendiente", dest: "General", gift_date: T, receipt: null }),
    kaleos_prayer_requests: () => ({ kind: "oracion", status: "nueva", done_at: null }),
    kaleos_messages: () => ({ kind: "aviso", profile_id: null, community_id: null, levels: null, art: null, card: null }),
    kaleos_attendance: () => ({ service_date: T }),
    kaleos_special_dates: () => ({ yearly: false }),
    kaleos_funds: () => ({ goal: 0, active: true, sort: 0 }),
  };
  const PK = { kaleos_message_reads: ["message_id", "profile_id"], kaleos_rsvp: ["message_id", "profile_id"], kaleos_community_members: ["community_id", "profile_id"], kaleos_staff_notes: ["profile_id"] };
  const CHECKS = {
    kaleos_profiles: (r) => (["member", "usher", "pastor", "secretary"].includes(r.role) ? null : "kaleos_profiles_role_check") || (["adherente", "neofito", "miembro", "lider", "consejero"].includes(r.level) ? null : "level check") || (r.full_name ? null : "null value in column full_name"),
    kaleos_prayer_requests: (r) => (["felicitacion", "visita", "oracion", "otro"].includes(r.kind) ? null : "kind check") || (["nueva", "orando", "atendida"].includes(r.status) ? null : "status check"),
    kaleos_messages: (r) => (["felicitacion", "invitacion", "recordatorio", "aviso"].includes(r.kind) ? null : "kind check") || (r.title ? null : "null value in column title"),
    kaleos_gifts: (r) => (["diezmo", "ofrenda", "donacion", "proyecto"].includes(r.kind) ? null : "kind check") || (["transferencia", "tarjeta", "sobre", "efectivo"].includes(r.method) ? null : "method check") || (Number(r.amount) > 0 ? null : "amount check") || (["pendiente", "confirmado"].includes(r.status) ? null : "status check"),
    kaleos_rsvp: (r) => (["si", "tal", "no"].includes(r.answer) ? null : "answer check"),
    kaleos_funds: (r) => (["proyecto", "necesidad"].includes(r.kind) ? null : "kind check") || (r.name ? null : "null name"),
    kaleos_reminders: (r) => (r.title && r.due_at && !isNaN(new Date(r.due_at)) ? null : "invalid reminder"),
    kaleos_services: (r) => (r.activity && r.service_date ? null : "null activity"),
    kaleos_communities: (r) => (r.name && r.slug ? null : "null name"),
    kaleos_visits: (r) => (r.profile_id ? null : "null profile"),
  };
  const DATE_COLS = ["birthday", "wedding_date", "baptism_date", "member_since", "for_date", "service_date", "visited_on", "event_date", "gift_date", "occasion_date", "month"];
  const validate = (t, r) => {
    for (const c of DATE_COLS) if (r[c] != null && (typeof r[c] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r[c]) || isNaN(new Date(r[c] + "T12:00:00Z")))) return `invalid input syntax for type date: "${r[c]}"`;
    if (r.church_id !== undefined && t !== "kaleos_churches" && !tb("kaleos_churches").some((c) => c.id === r.church_id)) return "violates foreign key constraint (church_id)";
    return CHECKS[t] ? CHECKS[t](r) : null;
  };
  const TRIGGERS = {
    kaleos_gifts: { insert: (r) => { if (!r.receipt || !String(r.receipt).trim()) r.receipt = (r.method === "sobre" ? "S-" : "R-") + String(r.id).padStart(5, "0"); } },
    kaleos_profiles: { update: (n, o) => { if (uid && !isPastor() && n.role !== o.role) return "Solo el pastor cambia el perfil de una persona"; } },
  };
  const err = (message, code) => ({ message, code: code || "42501", details: null, hint: null });

  // ===== constructor de consultas =====
  const parseSel = (s) => {
    const embeds = [];
    const re = /(\w+):(\w+)!(\w+)\(([^)]*)\)/g; let m;
    while ((m = re.exec(s || ""))) embeds.push({ alias: m[1], table: m[2], fk: m[3], cols: m[4].split(",").map((x) => x.trim()) });
    const plain = String(s || "*").replace(re, "").split(",").map((x) => x.trim()).filter(Boolean);
    return { embeds, cols: plain };
  };
  const cmp = (a, b) => (a == null && b == null ? 0 : a == null ? 1 : b == null ? -1 : typeof a === "number" && typeof b === "number" ? a - b : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
  const coerce = (v) => (v === "null" ? null : v === "true" ? true : v === "false" ? false : v);
  function orFilter(expr) {
    // admite la forma que usa la app: a.op.v,and(b.op.v,c.op.v)
    const parts = []; let depth = 0, cur = "";
    for (const ch of expr) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && !depth) { parts.push(cur); cur = ""; } else cur += ch; }
    if (cur) parts.push(cur);
    const one = (p) => {
      const am = p.match(/^and\((.*)\)$/);
      if (am) { const sub = []; let d = 0, c = ""; for (const ch of am[1]) { if (ch === "(") d++; if (ch === ")") d--; if (ch === "," && !d) { sub.push(c); c = ""; } else c += ch; } if (c) sub.push(c); const fs = sub.map(one); return (r) => fs.every((f) => f(r)); }
      const [col, op, ...rest] = p.split("."); const v = coerce(rest.join("."));
      return (r) => OPS[op](r[col], v);
    };
    const fs = parts.map(one);
    return (r) => fs.some((f) => f(r));
  }
  const OPS = {
    eq: (a, b) => a != null && String(a) === String(b), neq: (a, b) => a == null || String(a) !== String(b), is: (a, b) => (a ?? null) === b,
    gte: (a, b) => a != null && cmp(a, b) >= 0, lte: (a, b) => a != null && cmp(a, b) <= 0, gt: (a, b) => a != null && cmp(a, b) > 0, lt: (a, b) => a != null && cmp(a, b) < 0,
  };
  function Q(table) {
    const st = { table, f: [], order: [], limit: null, single: null, op: "select", head: false, count: null, payload: null, sel: null, returning: false, opts: {} };
    const api = {
      select(s, o) { if (st.op === "select") st.sel = s || "*"; else { st.returning = true; st.sel = s || "*"; } if (o && o.head) st.head = true; if (o && o.count) st.count = o.count; return api; },
      eq(c, v) { st.f.push((r) => OPS.eq(r[c], v)); return api; },
      neq(c, v) { st.f.push((r) => OPS.neq(r[c], v)); return api; },
      is(c, v) { st.f.push((r) => OPS.is(r[c], v)); return api; },
      gte(c, v) { st.f.push((r) => OPS.gte(r[c], v)); return api; },
      lte(c, v) { st.f.push((r) => OPS.lte(r[c], v)); return api; },
      gt(c, v) { st.f.push((r) => OPS.gt(r[c], v)); return api; },
      lt(c, v) { st.f.push((r) => OPS.lt(r[c], v)); return api; },
      in(c, vs) { st.f.push((r) => vs.map(String).includes(String(r[c]))); return api; },
      not(c, op, v) { st.f.push((r) => !OPS[op](r[c], coerce(v))); return api; },
      or(expr) { st.f.push(orFilter(expr)); return api; },
      order(c, o) { st.order.push([c, !(o && o.ascending === false)]); return api; },
      limit(n) { st.limit = n; return api; },
      maybeSingle() { st.single = "maybe"; return api; }, single() { st.single = "one"; return api; },
      insert(p) { st.op = "insert"; st.payload = p; return api; },
      upsert(p, o) { st.op = "upsert"; st.payload = p; st.opts = o || {}; return api; },
      update(p) { st.op = "update"; st.payload = p; return api; },
      delete() { st.op = "delete"; return api; },
      then(res, rej) { return new Promise((ok) => setTimeout(ok, 15)).then(() => run(st)).then(res, rej); },
    };
    return api;
  }
  const shape = (st, rows) => {
    const { embeds, cols } = parseSel(st.sel);
    return rows.map((r) => {
      const o = cols.includes("*") || !cols.length ? { ...r } : Object.fromEntries(cols.map((c) => [c, r[c]]));
      for (const e of embeds) { const t = tb(e.table).find((x) => x.id === r[e.fk] && allow(e.table, "select", x)); o[e.alias] = t ? Object.fromEntries(e.cols.map((c) => [c, t[c]])) : null; }
      return JSON.parse(JSON.stringify(o));
    });
  };
  const finish = (st, rows, extra = {}) => {
    if (st.single === "one" && rows.length !== 1) return { data: null, error: err("JSON object requested, multiple (or no) rows returned", "PGRST116"), ...extra };
    if (st.single) return { data: rows[0] || null, error: null, ...extra };
    return { data: rows, error: null, ...extra };
  };
  function run(st) {
    const t = st.table;
    if (!uid) return { data: null, error: err("JWT expired / sin sesión", "401") };
    if (!(t in DB.tables) && !RLS[t]) return { data: null, error: err(`relation "public.${t}" does not exist`, "42P01") };
    LOG.push({ t, op: st.op, payload: st.payload });
    const rows = tb(t);
    if (st.op === "insert" || st.op === "upsert") {
      const list = Array.isArray(st.payload) ? st.payload : [st.payload];
      const out = [], staged = [];
      for (const raw of list) {
        let r = { ...(DEFAULTS[t] ? DEFAULTS[t]() : {}), ...JSON.parse(JSON.stringify(raw)) };
        const keys = (st.opts.onConflict ? st.opts.onConflict.split(",") : PK[t]) || null;
        const existing = st.op === "upsert" && keys ? rows.find((x) => keys.every((k) => String(x[k]) === String(r[k]))) : null;
        if (existing) {
          if (st.opts.ignoreDuplicates) continue;
          if (!allow(t, "update", existing)) return { data: null, error: err("new row violates row-level security policy (USING expression) for table " + t) };
          const n = { ...existing, ...r };
          const ve = validate(t, n); if (ve) return { data: null, error: err(ve, "23514") };
          if (!allow(t, "check", n)) return { data: null, error: err("new row violates row-level security policy for table " + t) };
          staged.push(() => Object.assign(existing, n)); out.push(n); continue;
        }
        if (PK[t] && rows.some((x) => PK[t].every((k) => String(x[k]) === String(r[k])))) return { data: null, error: err("duplicate key value violates unique constraint", "23505") };
        if (!PK[t] && !("id" in r)) r.id = ["kaleos_profiles", "kaleos_churches"].includes(t) ? uuid() : ++DB.seq;
        if (!r.created_at && t !== "kaleos_message_reads") r.created_at = new Date().toISOString();
        const ve = validate(t, r); if (ve) return { data: null, error: err(ve, "23514") };
        if (!allow(t, "check", r) && !(RLS[t] && RLS[t].insert && RLS[t].insert(r))) return { data: null, error: err("new row violates row-level security policy for table \"" + t + "\"") };
        if (RLS[t] && RLS[t].insert && !RLS[t].insert(r)) return { data: null, error: err("new row violates row-level security policy for table \"" + t + "\"") };
        if (TRIGGERS[t] && TRIGGERS[t].insert) TRIGGERS[t].insert(r);
        staged.push(() => rows.push(r)); out.push(r);
      }
      staged.forEach((f) => f()); save();
      if (!st.returning) return { data: null, error: null };
      return finish(st, shape(st, out.filter((r) => allow(t, "select", r))));
    }
    let vis = rows.filter((r) => allow(t, st.op === "select" ? "select" : st.op, r) && (st.op === "select" || allow(t, "select", r) || true));
    vis = vis.filter((r) => st.f.every((f) => f(r)));
    if (st.op === "update") {
      const out = [];
      for (const r of vis) {
        const n = { ...r, ...JSON.parse(JSON.stringify(st.payload)) };
        const ve = validate(t, n); if (ve) return { data: null, error: err(ve, "23514") };
        if (!allow(t, "check", n)) return { data: null, error: err("new row violates row-level security policy for table \"" + t + "\"") };
        const te = TRIGGERS[t] && TRIGGERS[t].update && TRIGGERS[t].update(n, r); if (te) return { data: null, error: err(te, "P0001") };
        out.push([r, n]);
      }
      out.forEach(([r, n]) => Object.assign(r, n)); save();
      if (!st.returning) return { data: null, error: null };
      return finish(st, shape(st, out.map(([r]) => r)));
    }
    if (st.op === "delete") { for (const r of vis) rows.splice(rows.indexOf(r), 1); save(); return { data: null, error: null }; }
    for (const [c, asc] of [...st.order].reverse()) vis = [...vis].sort((a, b) => cmp(a[c], b[c]) * (asc ? 1 : -1));
    const count = vis.length;
    if (st.limit) vis = vis.slice(0, st.limit);
    if (st.head) return { data: null, count, error: null };
    return finish(st, shape(st, vis), { count });
  }

  // ===== funciones de la base =====
  const myComms = () => tb("kaleos_communities").filter((c) => c.church_id === church());
  const RPC = {
    kaleos_communities_overview: () => myComms().sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)).map((c) => ({ ...c,
      leader_name: (profOf(c.leader_id) || {}).full_name || null,
      members: tb("kaleos_community_members").filter((m) => m.community_id === c.id && (profOf(m.profile_id) || {}).active).length, mine: inComm(c.id) })),
    kaleos_community_people: ({ p_id }) => (isStaff() || inComm(+p_id) ? tb("kaleos_community_members").filter((m) => m.community_id === +p_id).map((m) => profOf(m.profile_id)).filter((p) => p && p.active)
      .map((p) => ({ id: p.id, full_name: p.full_name, title: p.title })).sort((a, b) => a.full_name.localeCompare(b.full_name)) : []),
    kaleos_fund_totals: () => { const t = {}; for (const g of tb("kaleos_gifts")) if (g.church_id === church() && g.fund_id && g.status === "confirmado") t[g.fund_id] = (t[g.fund_id] || 0) + Number(g.amount); return Object.entries(t).map(([fund_id, total]) => ({ fund_id: +fund_id, total })); },
    kaleos_attendance_weeks: ({ p_weeks = 8 }) => { if (!isStaff()) return []; const from = addDays(T, -p_weeks * 7), m = {}; for (const a of tb("kaleos_attendance")) if (a.church_id === church() && a.service_date > from) m[a.service_date] = (m[a.service_date] || 0) + 1; return Object.keys(m).sort().map((d) => ({ service_date: d, people: m[d] })); },
    kaleos_month_report: ({ p_month }) => {
      if (!isStaff()) throw err("Solo el pastor o Secretaría", "P0001");
      const m0 = String(p_month).slice(0, 7), A = tb("kaleos_attendance").filter((a) => a.church_id === church() && a.service_date.startsWith(m0));
      const days = new Set(A.map((a) => a.service_date));
      return { month: m0 + "-01", attendance_avg: days.size ? Math.round(A.length / days.size) : 0, services: days.size, new_members: 0,
        baptisms: tb("kaleos_profiles").filter((p) => p.church_id === church() && String(p.baptism_date || "").startsWith(m0)).length,
        visits: tb("kaleos_visits").filter((v) => v.church_id === church() && v.visited_on.startsWith(m0)).length, new_leaders: 0,
        prayers: tb("kaleos_prayer_requests").filter((r) => r.church_id === church() && r.kind === "oracion" && r.created_at.slice(0, 7) === m0).length,
        requests: tb("kaleos_prayer_requests").filter((r) => r.church_id === church() && r.created_at.slice(0, 7) === m0).length,
        members_total: tb("kaleos_profiles").filter((p) => p.church_id === church() && p.active).length };
    },
    kaleos_check_in: ({ p_code }) => {
      if (!["usher", "pastor", "secretary"].includes(role())) throw err("Solo el ujier, Secretaría o el pastor pueden registrar asistencia", "P0001");
      const c = String(p_code).trim();
      const p = tb("kaleos_profiles").find((x) => x.church_id === church() && x.active && (x.qr_token === c.toLowerCase() || x.member_no.toUpperCase() === c.toUpperCase()));
      if (!p) return { ok: false, error: "Código no reconocido" };
      const A = tb("kaleos_attendance"), dup = A.some((a) => a.profile_id === p.id && a.service_date === T);
      if (!dup) A.push({ id: ++DB.seq, church_id: church(), profile_id: p.id, service_date: T, scanned_at: new Date().toISOString(), scanned_by: uid });
      save();
      return { ok: true, new: !dup, name: p.full_name, title: p.title, member_no: p.member_no, streak: 1 };
    },
    kaleos_update_my_contact: ({ p_phone, p_email, p_birthday, p_wedding, p_channel }) => {
      if (!["whatsapp", "correo", "app"].includes(p_channel)) throw err("Medio no válido", "P0001");
      const p = me(); const n = { ...p, phone: (p_phone || "").trim() || null, email: (p_email || "").trim() || null, birthday: p_birthday, wedding_date: p_wedding, preferred_channel: p_channel, contact_updated_at: new Date().toISOString() };
      const ve = validate("kaleos_profiles", n); if (ve) throw err(ve, "22007");
      Object.assign(p, n); save(); return null;
    },
  };

  // ===== funciones (Edge Functions) =====
  const httpErr = (status, body) => { const e = new Error("Edge Function returned a non-2xx status code"); e.name = "FunctionsHttpError"; e.context = new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); return { data: null, error: e }; };
  const FN = {
    "kaleos-admin": (b) => {
      const LEVELS = ["adherente", "neofito", "miembro", "lider", "consejero"];
      const create = (rl) => {
        if (!b.full_name || !String(b.full_name).trim()) return httpErr(400, { error: "Falta el nombre" });
        const ps = tb("kaleos_profiles"), n = Math.max(0, ...ps.map((p) => parseInt(p.member_no.split("-")[1], 10) || 0)) + 1, no = "LL-" + String(n).padStart(4, "0"), id = uuid();
        const pin = /^\d{6}$/.test(String(b.pin || "")) ? String(b.pin) : String(100000 + Math.floor(Math.random() * 899999));
        const row = { id, church_id: CH, member_no: no, full_name: String(b.full_name).trim(), title: b.title || "Hno.", role: rl, stage: "visitante", level: LEVELS.includes(b.level) ? b.level : "adherente",
          phone: b.phone || null, email: null, birthday: b.birthday || null, member_since: b.member_since || null, baptism_date: b.baptism_date || null, wedding_date: null, serves_in: null,
          qr_token: "qr-" + no.toLowerCase(), active: true, preferred_channel: "whatsapp", contact_updated_at: null, created_at: new Date().toISOString() };
        const ve = validate("kaleos_profiles", row); if (ve) return httpErr(400, { error: ve });
        ps.push(row); DB.pins[id] = pin; save();
        return { data: { ok: true, id, member_no: no, pin }, error: null };
      };
      if (b.action === "bootstrap") return httpErr(409, { error: "Esta iglesia ya tiene pastor" });
      if (!isStaff()) return httpErr(403, { error: "Solo el pastor o Secretaría" });
      if (b.action === "create_member") { let rl = ["member", "usher", "pastor", "secretary"].includes(b.role) ? b.role : "member"; if (!isPastor() && (rl === "pastor" || rl === "secretary")) rl = "member"; return create(rl); }
      if (b.action === "reset_pin") {
        const p = profOf(b.profile_id); if (!p || p.church_id !== church()) return httpErr(404, { error: "Hermano no encontrado" });
        if (!isPastor() && p.id !== uid && ["pastor", "secretary"].includes(p.role)) return httpErr(403, { error: "Solo el pastor cambia el PIN del pastor o de Secretaría" });
        const pin = String(100000 + Math.floor(Math.random() * 899999)); DB.pins[p.id] = pin; save();
        return { data: { ok: true, member_no: p.member_no, pin }, error: null };
      }
      return httpErr(400, { error: "Acción desconocida" });
    },
    "kaleos-asistente": () => (role() === "pastor" ? httpErr(503, { error: "sin_clave" }) : httpErr(403, { error: "Solo el pastor" })),
    "kaleos-voz": () => httpErr(503, { error: "sin_clave" }),
  };

  // ===== cliente =====
  const user = () => (uid ? { id: uid, email: (profOf(uid) || {}).member_no?.toLowerCase() + "@la-linea.kaleos.app" } : null);
  window.supabase = {
    createClient() {
      return {
        from: Q,
        rpc: async (n, a) => {
          await new Promise((ok) => setTimeout(ok, 15));
          LOG.push({ rpc: n, args: a });
          if (!uid) return { data: null, error: err("sin sesión", "401") };
          if (!RPC[n]) return { data: null, error: err(`Could not find the function public.${n} in the schema cache`, "PGRST202") };
          try { return { data: RPC[n](a || {}), error: null }; } catch (e) { return { data: null, error: e.message ? e : err(String(e)) }; }
        },
        auth: {
          getSession: async () => ({ data: { session: uid ? { user: user(), access_token: "x" } : null }, error: null }),
          getUser: async () => ({ data: { user: user() }, error: uid ? null : err("no user") }),
          signOut: async () => { uid = null; try { localStorage.removeItem(LU); } catch (_) {} return { error: null }; },
          signInWithPassword: async ({ email, password }) => {
            await new Promise((ok) => setTimeout(ok, 30));
            const no = String(email).split("@")[0].toUpperCase(), p = tb("kaleos_profiles").find((x) => x.member_no === no);
            if (!p || DB.pins[p.id] !== password) return { data: {}, error: { message: "Invalid login credentials", status: 400 } };
            uid = p.id; try { localStorage.setItem(LU, uid); } catch (_) {}
            return { data: { user: user(), session: { access_token: "x" } }, error: null };
          },
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        },
        functions: { invoke: async (name, { body } = {}) => { await new Promise((ok) => setTimeout(ok, 20)); LOG.push({ fn: name, body }); return FN[name] ? FN[name](body || {}) : httpErr(404, { error: "Function not found" }); } },
      };
    },
  };
})();
