/* Kaleos: núcleo compartido (sesión, íconos, imágenes generadas, menús, hojas). Vanilla JS, sin compilación.
   Los demás archivos (cards, member, pastor, central) cuelgan sus vistas de window.K. */
(function () {
  "use strict";
  const K = (window.K = {});
  const cfg = (K.cfg = window.KALEOS_CONFIG || {});
  const TZ = (K.TZ = "America/Guatemala");

  // ===== datos fijos =====
  K.LEVELS = [
    ["adherente", "Adherente", "Asiste de vez en cuando. Sube cuando entra al discipulado y se congrega con frecuencia."],
    ["neofito", "Neófito", "Se congrega cada 15 días y está en el discipulado para bautizarse. Sube al bautizarse."],
    ["miembro", "Miembro", "Se congrega cada 7 días y asiste a la escuela de líderes."],
    ["lider", "Líder", "Sirve en un ministerio, se congrega dos veces por semana y es fiel en su diezmo."],
    ["consejero", "Consejero", "El nivel más alto antes del pastor."],
  ];
  K.LV = Object.fromEntries(K.LEVELS.map(([k, n, d], i) => [k, { n, d, i }]));
  K.LV_PL = { adherente: "adherentes", neofito: "neófitos", miembro: "miembros", lider: "líderes", consejero: "consejeros" };
  K.ROLE_NAME = { member: "Miembro", usher: "Ujier", pastor: "Pastor", secretary: "Secretaría" };
  K.REQ = {
    felicitacion: { n: "Felicitación", ic: "felicitacion", h: "Para un cumpleaños, aniversario o un logro." },
    visita: { n: "Visita", ic: "visita", h: "El pastor pasa a verle a usted o a su familia." },
    oracion: { n: "Oración", ic: "oracion", h: "La iglesia ora por su necesidad." },
    otro: { n: "Otra cosa", ic: "otro", h: "Cuéntele al pastor lo que necesita." },
  };
  K.RSTAT = { nueva: ["Nuevo", "warn"], orando: ["En camino", ""], atendida: ["Atendido", "ok"] };
  K.MSG_KINDS = {
    invitacion: { n: "Invitación", head: "¡Le invitamos!", tpl: "noche" },
    recordatorio: { n: "Recordatorio", head: "No lo olvide", tpl: "marfil" },
    felicitacion: { n: "Felicitación", head: "¡Felicidades!", tpl: "fiesta" },
    aviso: { n: "Aviso", head: "Aviso importante", tpl: "olivo" },
  };
  K.CHANNELS = { whatsapp: "WhatsApp", correo: "Correo", app: "Solo en Kaleos" };
  K.GIFT_KINDS = { diezmo: "Diezmo", ofrenda: "Ofrenda", donacion: "Donación", proyecto: "Proyecto" };
  K.METHODS = { transferencia: "Transferencia", tarjeta: "Tarjeta", sobre: "Sobre", efectivo: "Efectivo" };

  // ===== utilidades =====
  const esc = (K.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const $ = (K.$ = (s, r = document) => r.querySelector(s));
  const $$ = (K.$$ = (s, r = document) => [...r.querySelectorAll(s)]);
  K.on = (root, sel, fn, ev = "click") => $$(sel, root).forEach((e) => e.addEventListener(ev, (x) => fn(e, x)));
  const today = (K.today = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ }));
  K.ini = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  K.first = (n) => String(n || "").split(" ")[0];
  K.MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  K.MONTHS_S = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  K.WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  K.fmtDate = (d, style = "long") => {
    if (!d) return "—";
    const [y, m, day] = String(d).slice(0, 10).split("-").map(Number);
    if (style === "dm") return `${day} de ${K.MONTHS[m - 1]}`;
    if (style === "ds") return `${day} ${K.MONTHS_S[m - 1]}`;
    if (style === "my") return `${K.MONTHS_S[m - 1]} ${y}`;
    return `${day} ${K.MONTHS_S[m - 1]} ${y}`;
  };
  K.dpart = (d, o) => new Date(d).toLocaleString("es-GT", { timeZone: TZ, ...o });
  K.fmtWhen = (v) => v ? new Date(v).toLocaleString("es-GT", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }) : "";
  K.fmtTime = (v) => new Date(v).toLocaleTimeString("es-GT", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
  K.dayOf = (v) => new Date(v).toLocaleDateString("en-CA", { timeZone: TZ });
  K.cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  K.addDays = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  K.dayDiff = (a, b) => Math.round((new Date(a + "T12:00:00Z") - new Date(b + "T12:00:00Z")) / 86400000);
  K.weekdayOf = (s) => K.WEEKDAYS[new Date(s + "T12:00:00Z").getUTCDay()];
  // Fecha y hora local de Guatemala (UTC-6, sin horario de verano) a ISO
  K.gtISO = (date, time = "00:00") => new Date(`${date}T${time}:00-06:00`).toISOString();
  K.Q = (n) => "Q " + Number(n || 0).toLocaleString("es-GT", { maximumFractionDigits: 0 });
  K.pct = (a, b) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);
  K.isBirthday = (p) => p && p.birthday && String(p.birthday).slice(5, 10) === today().slice(5, 10);
  K.phoneDigits = (p) => String(p || "").replace(/\D/g, "");
  K.waLink = (phone, text) => {
    let d = K.phoneDigits(phone);
    if (d.length === 8) d = "502" + d; // Guatemala
    return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
  };
  K.waOpen = (text, phone) => window.open(phone ? K.waLink(phone, text) : `https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  K.errMsg = (e) => {
    const m = (e && (e.message || e.error_description || e.error)) || String(e);
    if (/Invalid login/i.test(m)) return "Número o PIN incorrecto.";
    if (/Failed to fetch|NetworkError/i.test(m)) return "Sin conexión. Intente de nuevo.";
    if (/does not exist|schema cache/i.test(m)) return "Falta actualizar la base de datos (pegar el SQL nuevo en Supabase).";
    if (/row-level security|permission denied/i.test(m)) return "No tiene permiso para hacer esto.";
    return m;
  };
  let tt;
  K.toast = (m, ms = 2800) => { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), ms); };
  K.normalizeMemberNo = (v) => {
    const s = String(v || "").trim().toUpperCase().replace(/\s+/g, "");
    if (/^\d+$/.test(s)) return `${cfg.prefix || "LL"}-${s.padStart(4, "0")}`;
    const m = s.match(/^([A-Z]+)-?(\d+)$/);
    return m ? `${m[1]}-${m[2].padStart(4, "0")}` : s;
  };
  const emailFor = (no) => `${no.toLowerCase()}@${cfg.church || "la-linea"}.kaleos.app`;
  K.callAdmin = async (body) => {
    const { data, error } = await K.sb.functions.invoke("kaleos-admin", { body });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); msg = j.error || msg; } catch (_) {}
      throw new Error(msg);
    }
    if (data && data.error) throw new Error(data.error);
    return data;
  };
  K.qrSvg = (text) => { const q = window.qrcode(0, "M"); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); };
  K.speak = (text) => {
    if (!("speechSynthesis" in window)) return K.toast("Este teléfono no puede leer en voz alta");
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-GT";
    const v = speechSynthesis.getVoices().find((x) => x.lang && x.lang.startsWith("es"));
    if (v) u.voice = v;
    u.rate = 0.95; speechSynthesis.speak(u);
  };
  K.confetti = () => {
    const box = document.createElement("div"); box.className = "confetti";
    const cols = ["#B8893B", "#F3DC9B", "#1E2650", "#85304A", "#2D6A86"];
    for (let i = 0; i < 34; i++) {
      const e = document.createElement("i");
      e.style.left = Math.random() * 100 + "%"; e.style.background = cols[i % 5]; e.style.animationDelay = Math.random() * 1.5 + "s";
      box.appendChild(e);
    }
    document.body.appendChild(box); setTimeout(() => box.remove(), 5500);
  };
  // Comparte una imagen (teléfono) o abre WhatsApp con el texto (computadora)
  K.shareCanvas = (cv, text, name, phone) => cv.toBlob(async (b) => {
    const file = b && new File([b], name, { type: "image/png" });
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); } catch (err) { if (err.name !== "AbortError") K.toast(K.errMsg(err)); }
      return;
    }
    if (file) { const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
    K.waOpen(text, phone);
  }, "image/png");

  // ===== caché corta de consultas (se limpia al guardar) =====
  const CACHE = new Map();
  K.load = async (key, fn, ttl = 30000) => {
    const c = CACHE.get(key);
    if (c && Date.now() - c.t < ttl) return c.v;
    const v = await fn();
    CACHE.set(key, { t: Date.now(), v });
    return v;
  };
  K.bust = (...prefixes) => { for (const k of [...CACHE.keys()]) if (!prefixes.length || prefixes.some((p) => k.startsWith(p))) CACHE.delete(k); };
  // Consulta que devuelve [] si la tabla aún no existe (antes de pegar el SQL)
  K.rows = async (q) => { const { data, error } = await q; if (error) { console.warn(error.message); return []; } return data || []; };

  // ===== íconos dibujados para Kaleos =====
  const I = (K.ICONS = {
    kaleos: '<path d="M6.5 3.5v17"/><path d="M17 3.5c-4.2 3-6.4 5.6-6.4 8.5s2.2 5.5 6.4 8.5"/><path d="M20 8.2c-1.3 1-2 2.3-2 3.8s.7 2.8 2 3.8" opacity=".55"/><circle class="d" cx="13.2" cy="12" r="1.25"/>',
    inicio: '<path d="M5 21V10.5a7 7 0 0 1 14 0V21"/><path d="M9.6 21v-5.6a2.4 2.4 0 0 1 4.8 0V21"/><path d="M3 21h18"/><circle class="d" cx="12" cy="8" r="1.15"/>',
    comunidades: '<circle cx="12" cy="6.4" r="2.3"/><circle cx="5.9" cy="12.8" r="2.3"/><circle cx="18.1" cy="12.8" r="2.3"/><path d="M10.4 8.2 7.6 10.9M13.6 8.2l2.8 2.7M8.4 13.5h7.2"/><path d="M2.8 20.5c.6-2.3 1.7-3.4 3.1-3.4s2.5 1.1 3.1 3.4M15 20.5c.6-2.3 1.7-3.4 3.1-3.4s2.5 1.1 3.1 3.4"/><circle class="d" cx="12" cy="18.6" r="1.15"/>',
    pedir: '<path d="M2.5 13.6c2 0 3.3.8 4.5 2.2l1.4 1.6h3.8a1.5 1.5 0 0 0 0-3H9.7"/><path d="M6.6 21.2l1.1-1.3c.6-.6 1.3-.9 2.2-.9h5c1.1 0 1.9-.4 2.6-1.1l3.6-3.6a1.4 1.4 0 0 0-2-2l-3.3 2.6"/><path d="M14.3 9.6c0-2.4 1.8-3.1 1.8-5.4"/><circle class="d" cx="16.1" cy="3" r="1.15"/>',
    dar: '<ellipse cx="12" cy="17.6" rx="7" ry="2.5"/><path d="M5 17.6v1.3c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-1.3"/><path d="M12 15.1V8.4"/><path d="M12 10.9c-3 0-4.6-1.7-4.8-4.6 2.9.1 4.6 1.6 4.8 4.6zM12 9.3c.2-2.9 1.8-4.4 4.8-4.6-.1 2.9-1.8 4.5-4.8 4.6z"/><circle class="d" cx="12" cy="17.6" r="1"/>',
    camino: '<path d="M3 20.5h4.2v-4.2h4.2v-4.2h4.2V7.9h4.2"/><path d="M19.8 7.9V6.2"/><circle class="d" cx="19.8" cy="4.2" r="1.35"/>',
    asistente: '<rect x="7.5" y="2.8" width="9" height="18.4" rx="2.6"/><path d="M10 6.4h4M10 8.7h4M10 11h4"/><circle class="df" cx="12" cy="16.2" r="1.9"/><path d="M19.6 9.2a6.4 6.4 0 0 1 0 5.6M4.4 9.2a6.4 6.4 0 0 0 0 5.6"/>',
    onda: '<path d="M4 10.5v3M8 7.5v9M12 4.5v15M16 7.5v9M20 10.5v3"/>',
    versiculos: '<path d="M4 5.5c2.6-.9 5.3-.7 8 .9v14c-2.7-1.6-5.4-1.8-8-.9z"/><path d="M20 5.5c-2.6-.9-5.3-.7-8 .9v14c2.7-1.6 5.4-1.8 8-.9z"/><path d="M15 9.2c1-.3 2-.3 3 0M15 12.2c1-.3 2-.3 3 0"/><circle class="d" cx="7.6" cy="10.4" r="1.2"/>',
    pedidos: '<rect x="3" y="5.5" width="18" height="13.5" rx="2.2"/><path d="M3.6 7.2l8.4 6.3 8.4-6.3"/><circle class="d" cx="12" cy="16" r="1.3"/>',
    agenda: '<path d="M4 20.2V10a8 3.6 0 0 1 16 0v10.2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4.2 11.2h15.6"/><path d="M8.5 3.2v3M15.5 3.2v3"/><circle class="d" cx="15.6" cy="16" r="1.25"/>',
    hermanos: '<circle cx="9" cy="8.2" r="3.2"/><path d="M2.8 20.2c.5-3.6 3-5.5 6.2-5.5s5.7 1.9 6.2 5.5"/><path d="M15.4 5.2a3 3 0 1 1 .8 5.8M17.6 14.9c2 .6 3.2 2.3 3.6 5.3"/><circle class="d" cx="9" cy="17.6" r="1"/>',
    avisos: '<path d="M3.4 14.2c5.6.9 10.6-1.5 14.1-7.5"/><path d="M4.3 18.4c6.6.4 12.1-2.6 15.6-9"/><path d="M17.5 6.7l2.4 2.7"/><path d="M3.4 14.2c-.9 1.3-.6 3.2.9 4.2"/><circle class="d" cx="20.6" cy="4.1" r="1"/><circle class="d" cx="22" cy="7" r=".75"/>',
    oracion: '<path d="M9 21v-9.4h6V21"/><path d="M6.8 21h10.4"/><path d="M12 11.6v-1.5"/><path class="df" d="M12 9.2c-1.4-.6-2-1.8-1.7-3.2.3-1.1 1-1.9 1.7-3.4.8 1.5 1.7 2.3 1.7 3.7 0 1.4-.6 2.3-1.7 2.9z"/><path d="M10.6 15h2.8" opacity=".5"/>',
    felicitacion: '<path d="M7.2 19.4C4.1 17.4 3 13.9 4 10"/><path d="M16.8 19.4c3.1-2 4.2-5.5 3.2-9.4"/><path d="M5.5 15.6 3.2 16M4.5 12.5l-2-.6M7.6 17.8l-1.3 1.5M18.5 15.6l2.3.4M19.5 12.5l2-.6M16.4 17.8l1.3 1.5"/><path d="m12 6.3 1.3 2.7 3 .4-2.2 2.1.6 2.9-2.7-1.4-2.7 1.4.6-2.9-2.2-2.1 3-.4z"/><circle class="d" cx="12" cy="19.8" r="1.1"/>',
    visita: '<path d="M3.8 11 12 4.4l8.2 6.6"/><path d="M6 9.4V19h12V9.4"/><path d="M10.4 19v-4.6h3.2V19"/><path d="M12 19c.2 1.1-.6 1.7-2.2 2.2"/><circle class="d" cx="12" cy="11.3" r="1.1"/>',
    otro: '<path d="M20.2 3.8C13 4.3 8.5 8.8 7 16"/><path d="M20.2 3.8c-.5 6-4.6 10-10.6 11.3"/><path d="M7 16l-3.2 4.2"/><path d="M11 12l3.6-.5M13 9l3-.2"/><circle class="d" cx="5" cy="21" r=".9"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21M9 21h6"/><circle class="d" cx="12" cy="7.2" r="1"/>',
    send: '<path d="M4 12h14"/><path d="M12.5 6 18.5 12l-6 6"/>',
    chev: '<path d="m7 9.5 5 5 5-5"/>',
    back: '<path d="M14.5 6 8.5 12l6 6"/>',
    right: '<path d="M9.5 6l6 6-6 6"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
    chat: '<path d="M4.2 19.8 5.3 16a8 8 0 1 1 2.9 2.8z"/><path d="M9 9.6c.3 2.3 2.2 4.3 4.6 4.8l1-1.2 1.7.9"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    menu: '<path d="M4 7h16M4 12h10M4 17h16"/><circle class="d" cx="19" cy="12" r="1.2"/>',
    registro: '<path d="M5 4.5h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17.5a3 3 0 0 1 3-3h11"/><path d="M9 8.5h6"/><circle class="d" cx="9" cy="11.5" r=".9"/>',
    informes: '<path d="M4 3.5v17h16.5"/><path d="M8.5 16.5v-4M12.5 16.5V8.5M16.5 16.5v-6"/><circle class="d" cx="12.5" cy="5.5" r="1.1"/>',
    servicios: '<path d="M8 4h6.2l-1 2.5c2.6 1 4 3.4 4 6.5 0 3.8-2.2 7-5 7s-5-3.2-5-7c0-3.1 1.4-5.5 4-6.5z"/><path d="M17.3 9.2c1.9.1 2.9 1.1 2.9 2.5 0 1.5-1.2 2.6-3 2.6"/><circle class="d" cx="12.2" cy="14.5" r="1.1"/>',
    sobre: '<rect x="3" y="6" width="18" height="12.5" rx="1.8"/><path d="M3.5 7.2 12 13l8.5-5.8"/><path d="M14.5 15.5h3.5" opacity=".6"/><circle class="d" cx="12" cy="13" r="1.1"/>',
    proyecto: '<path d="M4 20.5h16"/><path d="M6 20.5V11l6-5 6 5v9.5"/><path d="M12 6V2.5M10.5 3.8h3"/><path d="M10 20.5v-4.5h4v4.5"/><circle class="d" cx="12" cy="12.2" r="1.1"/>',
    editar: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/><circle class="d" cx="5.6" cy="18.4" r=".9"/>',
    tarjeta: '<rect x="3" y="5.5" width="18" height="13" rx="2.4"/><path d="M6.5 15h6"/><circle class="d" cx="16.5" cy="10" r="1.6"/>',
    transferencia: '<path d="M4 8.5h14l-3.5-3.5M20 15.5H6l3.5 3.5"/><circle class="d" cx="12" cy="12" r="1.1"/>',
    escanear: '<path d="M4 8.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3M15.5 4h3A1.5 1.5 0 0 1 20 5.5v3M20 15.5v3a1.5 1.5 0 0 1-1.5 1.5h-3M8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3"/><path d="M4 12h16"/><circle class="d" cx="12" cy="12" r="1.2"/>',
    iglesia: '<path d="M12 2.5v4M10.3 4.2h3.4"/><path d="M5 21V11l7-4.5 7 4.5v10"/><path d="M3 21h18"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/><circle class="d" cx="12" cy="12.3" r="1.1"/>',
    saludos: '<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="m12 8.2 1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z"/><path d="M8 17.5h8" opacity=".6"/><circle class="d" cx="12" cy="11.2" r=".8"/>',
    reporte: '<path d="M6 3.5h8.5L19 8v12.5H6z"/><path d="M14.5 3.5V8H19"/><path d="M9 12.5h7M9 15.5h7M9 9.5h3"/><circle class="d" cx="16" cy="18.4" r=".9"/>',
    llamar: '<path d="M5.5 4h3l1.5 4-2 1.2a10 10 0 0 0 6.8 6.8L16 14l4 1.5v3A1.5 1.5 0 0 1 18.5 20 15 15 0 0 1 4 5.5 1.5 1.5 0 0 1 5.5 4z"/><circle class="d" cx="17" cy="6.5" r="1.1"/>',
    salir: '<path d="M14 4.5h4a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-4"/><path d="M10 8.5 6.5 12l3.5 3.5M6.5 12H15"/><circle class="d" cx="17" cy="12" r="1"/>',
    escuchar: '<path d="M4 10v4h3.5L12 18V6L7.5 10z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/><circle class="d" cx="9.5" cy="12" r=".9"/>',
    estrella: '<path d="m12 4.5 2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z"/>',
    // emblemas de comunidades
    c_emergente: '<path d="M2.5 17.2h19"/><path d="M6.5 17.2a5.5 5.5 0 0 1 11 0"/><path d="M12 8.2V4.8M5.4 10.6 3.8 9M18.6 10.6 20.2 9"/><path d="M8 20.6h8"/><circle class="d" cx="12" cy="14.6" r="1.2"/>',
    c_diaconos: '<path d="M7.8 4h6.4l-1 2.5c2.6 1 4 3.4 4 6.5 0 3.8-2.2 7-5.2 7S6.8 16.8 6.8 13c0-3.1 1.4-5.5 4-6.5z"/><path d="M17.2 9.2c1.9.1 2.9 1.1 2.9 2.5 0 1.5-1.2 2.6-3 2.6"/><path d="M3 21h14" opacity=".6"/><circle class="d" cx="12" cy="13.6" r="1.1"/>',
    c_plata: '<path d="M4 20.5C9 15.4 14 10.2 20 4"/><path d="M8.6 15.8c-2.2-.2-3.5-1.4-3.8-3.4 2 .1 3.4 1.3 3.8 3.4zM12.1 12.2c-2.2-.2-3.5-1.4-3.8-3.4 2 .1 3.4 1.3 3.8 3.4zM10.6 17.7c.3-2.2 1.5-3.4 3.5-3.7-.1 2-1.3 3.4-3.5 3.7zM14.1 14.1c.3-2.2 1.5-3.4 3.5-3.7-.1 2-1.3 3.4-3.5 3.7z"/><circle class="d" cx="16.6" cy="6" r="1.2"/>',
    c_damas: '<path d="M12 21.2v-8.4"/><path d="M12 12.8c-3.5 0-6-2.6-6-7 2.8.3 4.8 1.6 6 4 1.2-2.4 3.2-3.7 6-4 0 4.4-2.5 7-6 7z"/><path d="M12 9.8c-.9-2.3-.9-4.4 0-7 .9 2.6.9 4.7 0 7z"/><path d="M12 18.2c-1.8-1.6-3.6-2-5.5-1.5"/><circle class="d" cx="17.4" cy="17.4" r="1.1"/>',
    c_caballeros: '<path d="M12 3 19 6v5.5c0 4.6-3 7.8-7 9.5-4-1.7-7-4.9-7-9.5V6z"/><path d="M12 7.2v9.6M8.4 11h7.2"/><circle class="d" cx="12" cy="11" r="1.1"/>',
    c_infantil: '<path d="M13 2.8 19.2 9 13 15.2 6.8 9z"/><path d="M6.8 9h12.4M13 2.8v12.4"/><path d="M13 15.2c0 2-2.2 2.2-2.2 4.1 0 1.2.9 1.9 2.2 1.9"/><circle class="d" cx="5" cy="19.5" r="1.1"/>',
    c_misiones: '<circle cx="12" cy="12" r="8.6"/><path d="m12 5.4 2.1 6.6-2.1 6.6-2.1-6.6z"/><path d="M3.4 12h2M18.6 12h2" opacity=".6"/><circle class="d" cx="12" cy="12" r="1.1"/>',
    c_multimedia: '<circle cx="12" cy="12" r="8.6"/><path d="M12 3.4l3 8.6M20.2 9.4l-7.8 5.9M17.2 19l-7.1-6.3M6 18.6l3.1-8.9M3.6 10.2l9.3-1.8"/><circle class="d" cx="12" cy="12" r="1.1"/>',
    c_alabanza: '<path d="M6.8 3.8c-2 2.1-2.5 5.1-1.5 8.1.9 2.6 2.6 4.6 6.7 5.6 4.1-1 5.8-3 6.7-5.6 1-3 .5-6-1.5-8.1"/><path d="M7.4 17.4h9.2M12 17.5V21M9 21h6"/><path d="M9.4 7.6v7.8M12 6.6v9.2M14.6 7.6v7.8"/><circle class="d" cx="12" cy="4" r="1.1"/>',
    c_danza: '<path d="M3.5 18.5c3-6.2 7 2 10-4.2s4-9 7-8.1"/><path d="M3.5 18.5c1 2 3.1 2.6 5.2 1.6"/><circle class="d" cx="20.5" cy="6.2" r="1.1"/>',
  });
  K.ic = (n, c = "") => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${I[n] || I.comunidades}</svg>`;
  const ic = K.ic;
  K.EMBLEMS = ["comunidades", "c_emergente", "c_diaconos", "c_plata", "c_damas", "c_caballeros", "c_infantil", "c_misiones", "c_multimedia", "c_alabanza", "c_danza", "proyecto", "felicitacion", "oracion", "iglesia"];

  // ===== imágenes generadas (estilo YouVersion) =====
  const PAL = (K.PAL = {
    alba: ["#1c2240", "#c8734a", "#f3c47c"], olivo: ["#1b281f", "#6f8a5b", "#ecdfad"], vino: ["#2a1320", "#8b3346", "#eeb08a"],
    mar: ["#0d2030", "#2e6e8e", "#c6e8e2"], ocaso: ["#191634", "#5d418c", "#eaafc6"], oro: ["#17130e", "#8d6622", "#f3d48f"],
    cielo: ["#22365c", "#7fa5cb", "#f5f0e4"], lino: ["#efe8db", "#c3a979", "#30291f"],
  });
  K.PAL_NAMES = { alba: "Alba", olivo: "Olivo", vino: "Vino", mar: "Mar", ocaso: "Ocaso", oro: "Oro", cielo: "Cielo", lino: "Lino" };
  K.ART_KINDS = { cumbres: "Cumbres", luz: "Luz", aurora: "Aurora", olas: "Olas", lienzo: "Lienzo" };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t, al = 1) => { const A = hex(a), B = hex(b); return `rgba(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")},${al})`; };
  const rgba = (h, a) => mix(h, h, 0, a);
  const isLight = (K.isLight = (p) => p === "lino");
  function rng(seed) { let a = (seed * 9301 + 49297) >>> 0 || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  K.rng = rng;
  let NOISE = null;
  function noise() {
    if (NOISE) return NOISE;
    NOISE = document.createElement("canvas"); NOISE.width = NOISE.height = 180;
    const x = NOISE.getContext("2d"), d = x.createImageData(180, 180), R = rng(11);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.floor(R() * 255); d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0); return NOISE;
  }
  function art(ctx, w, h, o) {
    const R = rng(o.seed || 3), [c0, c1, c2] = PAL[o.pal] || PAL.alba, light = isLight(o.pal), u = Math.min(w, h);
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, w * 0.2, h);
    if (light) { g.addColorStop(0, c0); g.addColorStop(1, mix(c0, c1, 0.25)); }
    else { g.addColorStop(0, c0); g.addColorStop(0.58, mix(c0, c1, 0.6)); g.addColorStop(1, c1); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const k = o.kind || "cumbres";
    if (k === "cumbres") {
      const sx = w * (0.28 + R() * 0.44), sy = h * (0.5 + R() * 0.08);
      const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, u * 0.8);
      rg.addColorStop(0, rgba(c2, 0.85)); rg.addColorStop(0.25, rgba(c2, 0.28)); rg.addColorStop(1, rgba(c2, 0));
      ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = rgba(c2, 0.95); ctx.beginPath(); ctx.arc(sx, sy, u * 0.065, 0, 7); ctx.fill();
      for (let i = 0; i < 5; i++) {
        const y0 = h * (0.56 + i * 0.085), f1 = 2 + R() * 3, f2 = 6 + R() * 6, p1 = R() * 6, p2 = R() * 6, a1 = h * (0.05 - i * 0.004), a2 = h * 0.015;
        ctx.beginPath(); ctx.moveTo(0, h);
        for (let x = 0; x <= w + 8; x += w / 90) { const t = x / w; ctx.lineTo(x, y0 - Math.sin(t * f1 + p1) * a1 - Math.abs(Math.sin(t * f2 + p2)) * a2); }
        ctx.lineTo(w, h); ctx.closePath();
        ctx.fillStyle = mix(c1, light ? c2 : c0, 0.3 + i * 0.16, light ? 0.5 : 0.92); ctx.fill();
        const fg = ctx.createLinearGradient(0, y0 - a1, 0, y0 + h * 0.08);
        fg.addColorStop(0, rgba(c2, 0.12)); fg.addColorStop(1, rgba(c2, 0));
        ctx.fillStyle = fg; ctx.fill();
      }
    } else if (k === "aurora") {
      ctx.globalCompositeOperation = light ? "multiply" : "lighter";
      for (let i = 0; i < 6; i++) {
        const x = w * R(), y = h * R() * 0.9, r = u * (0.35 + R() * 0.45), c = i % 2 ? c2 : c1;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, rgba(c, light ? 0.3 : 0.42)); rg.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = Math.max(1, u * 0.0022);
      for (let i = 0; i < 26; i++) {
        ctx.strokeStyle = rgba(light ? c1 : c2, 0.05 + R() * 0.08); ctx.beginPath();
        const y = h * (0.2 + R() * 0.6); ctx.moveTo(-20, y);
        ctx.bezierCurveTo(w * 0.3, y - h * (0.3 * R()), w * 0.7, y + h * (0.3 * R()), w + 20, y - h * 0.1 * R()); ctx.stroke();
      }
    } else if (k === "luz") {
      const ox = w * (0.15 + R() * 0.7), oy = -h * 0.08, lc = light ? "#ffffff" : c2;
      for (let i = 0; i < 11; i++) {
        const a = Math.PI / 2 + (R() - 0.5) * 1.3, spread = 0.03 + R() * 0.07, L = h * 1.5;
        const lg = ctx.createLinearGradient(ox, oy, ox + Math.cos(a) * L, oy + Math.sin(a) * L);
        lg.addColorStop(0, rgba(lc, 0.28)); lg.addColorStop(1, rgba(lc, 0));
        ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(ox, oy);
        ctx.lineTo(ox + Math.cos(a - spread) * L, oy + Math.sin(a - spread) * L);
        ctx.lineTo(ox + Math.cos(a + spread) * L, oy + Math.sin(a + spread) * L); ctx.fill();
      }
      const rg = ctx.createRadialGradient(ox, 0, 0, ox, 0, u * 0.7);
      rg.addColorStop(0, rgba(lc, 0.5)); rg.addColorStop(1, rgba(lc, 0));
      ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 140; i++) { ctx.fillStyle = rgba(light ? c1 : c2, R() * 0.5); ctx.beginPath(); ctx.arc(w * R(), h * R(), u * 0.0035 * R() + 0.4, 0, 7); ctx.fill(); }
    } else if (k === "olas") {
      for (let i = 0; i < 9; i++) {
        const y0 = h * (0.3 + i * 0.085), A = h * (0.02 + R() * 0.03), f = 1.5 + R() * 2.5, p = R() * 6;
        ctx.beginPath(); ctx.moveTo(0, h);
        for (let x = 0; x <= w + 8; x += w / 80) ctx.lineTo(x, y0 + Math.sin((x / w) * f * Math.PI + p) * A);
        ctx.lineTo(w, h); ctx.closePath();
        const lg = ctx.createLinearGradient(0, y0 - A, 0, h);
        lg.addColorStop(0, mix(c1, c0, i / 9, light ? 0.3 : 0.55)); lg.addColorStop(1, rgba(c0, 0.8));
        ctx.fillStyle = lg; ctx.fill();
        ctx.strokeStyle = rgba(light ? c1 : c2, 0.22 - i * 0.015); ctx.lineWidth = Math.max(1, u * 0.002); ctx.stroke();
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const x = w * R(), y = h * R(), r = u * (0.3 + R() * 0.4);
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, rgba(c1, light ? 0.28 : 0.35)); rg.addColorStop(1, rgba(c1, 0));
        ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
      }
      const cx = w * (0.62 + R() * 0.2), cy = h * (0.3 + R() * 0.2);
      ctx.lineWidth = Math.max(1, u * 0.0018);
      for (let i = 1; i < 16; i++) { ctx.strokeStyle = rgba(light ? c1 : c2, 0.1 + (i % 4 === 0 ? 0.16 : 0)); ctx.beginPath(); ctx.arc(cx, cy, u * 0.04 * i, 0, 7); ctx.stroke(); }
    }
    const vg = ctx.createRadialGradient(w / 2, h * 0.45, u * 0.3, w / 2, h / 2, Math.max(w, h) * 0.8);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, light ? "rgba(60,40,10,.10)" : "rgba(0,0,0,.38)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = light ? 0.1 : 0.14;
    ctx.fillStyle = ctx.createPattern(noise(), "repeat"); ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  K.art = art;
  // Arte por defecto para algo que no lo eligió (se deriva del número)
  K.artOf = (n, a) => (a && a.p ? a : { k: Object.keys(K.ART_KINDS)[(n * 3 + 1) % 4], p: Object.keys(PAL)[n % 7], s: (n % 90) + 3 });
  K.artCv = (k, p, s) => `<canvas class="art" data-k="${esc(k)}" data-p="${esc(p)}" data-s="${+s || 1}" aria-hidden="true"></canvas>`;
  K.paint = (root = document) => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    $$("canvas.art", root).forEach((cv) => {
      const w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) return;
      const key = `${w}x${h}`;
      if (cv.dataset.done === key) return;
      cv.dataset.done = key; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
      art(ctx, w, h, { kind: cv.dataset.k, pal: cv.dataset.p, seed: +cv.dataset.s || 1 });
    });
    $$("canvas[data-guil]", root).forEach(guilloche);
    $$("canvas[data-vc]", root).forEach((cv) => { if (!cv.dataset.done && VC[cv.dataset.vc]) { cv.dataset.done = 1; drawVerse(cv, VC[cv.dataset.vc]); } });
  };
  let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => K.paint(), 150); });

  // Versículo o tarjeta con el texto dentro de la imagen, lista para compartir
  const VC = (K.VC = {}); let vcN = 0;
  K.vcv = (o, cls = "vcan") => { const id = "v" + ++vcN; VC[id] = o; return `<canvas class="${cls}" data-vc="${id}" role="img" aria-label="${esc((o.head ? o.head + ". " : "") + o.text + " " + o.ref)}"></canvas>`; };
  function wrap(ctx, text, maxW) {
    const words = String(text).split(/\s+/), lines = []; let l = "";
    for (const w of words) { const t = l ? l + " " + w : w; if (ctx.measureText(t).width > maxW && l) { lines.push(l); l = w; } else l = t; }
    if (l) lines.push(l); return lines;
  }
  K.wrap = wrap;
  const SERIF = '"Cormorant Garamond", Garamond, Georgia, serif', SANS = '"Hanken Grotesk", system-ui, sans-serif';
  K.SERIF = SERIF; K.SANS = SANS;
  function drawVerse(cv, o) {
    const W = 1080, H = o.fmt === "historia" ? 1920 : o.fmt === "post" ? 1350 : 1080;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    art(ctx, W, H, o);
    const P = PAL[o.pal] || PAL.alba, light = isLight(o.pal), ink = light ? P[2] : "#FBF6EC", acc = light ? "#8a6a2c" : P[2];
    const ls = (v) => { if ("letterSpacing" in ctx) ctx.letterSpacing = v; };
    const glow = (on) => { ctx.shadowColor = "rgba(0,0,0,.32)"; ctx.shadowBlur = on && !light ? 34 : 0; };
    const M = 110, maxW = W - M * 2, story = o.fmt === "historia";
    const top = story ? 320 : M + 30, bottom = H - (story ? 340 : M) - (o.firma ? 70 : 0);
    const fit = (fontFn, text, maxH, start, min, lhK = 1.14) => {
      for (let s = start; s >= min; s -= 3) { ctx.font = fontFn(s); const lines = wrap(ctx, text, maxW); if (lines.length * s * lhK <= maxH) return { s, lines, lh: s * lhK }; }
      ctx.font = fontFn(min); return { s: min, lines: wrap(ctx, text, maxW), lh: min * lhK };
    };
    ctx.fillStyle = ink; ctx.textBaseline = "alphabetic"; glow(true);
    let y0 = top;
    if (o.head) {
      ctx.textAlign = "center"; ls("8px"); ctx.font = `600 26px ${SANS}`; ctx.globalAlpha = 0.85;
      ctx.fillText((o.eyebrow || "").toUpperCase(), W / 2, y0 + 20); ctx.globalAlpha = 1; ls("0px");
      const f = fit((s) => `italic 600 ${s}px ${SERIF}`, o.head, 280, 124, 70, 1.0);
      ctx.font = `italic 600 ${f.s}px ${SERIF}`;
      f.lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + 50 + f.s * 0.85 + i * f.lh));
      y0 += 50 + f.lines.length * f.lh + 60;
      glow(false); ctx.fillStyle = acc; ctx.fillRect(W / 2 - 30, y0 - 20, 60, 3); ctx.fillStyle = ink; glow(true);
      y0 += 20;
    }
    const refH = 100, area = bottom - y0 - refH, L = o.head ? "clasico" : o.layout || "clasico";
    if (L === "clasico") {
      const f = fit((s) => `italic 500 ${s}px ${SERIF}`, o.text, area, o.head ? 66 : 104, 40);
      const blockH = f.lines.length * f.lh, start = y0 + Math.max(0, (area - blockH) / 2) + f.s * 0.85;
      ctx.textAlign = "center"; ctx.font = `italic 500 ${f.s}px ${SERIF}`;
      f.lines.forEach((l, i) => ctx.fillText(l, W / 2, start + i * f.lh));
      const ry = start + (f.lines.length - 1) * f.lh + 100;
      glow(false); ctx.fillStyle = acc; ctx.fillRect(W / 2 - 24, ry - 44, 48, 2); ctx.fillStyle = ink;
      ls("7px"); ctx.font = `600 27px ${SANS}`; ctx.fillText(String(o.ref).toUpperCase(), W / 2, ry); ls("0px");
    } else if (L === "editorial") {
      ctx.textAlign = "left"; glow(false);
      ctx.fillStyle = acc; ctx.font = `600 330px ${SERIF}`; ctx.fillText("“", M - 18, y0 + 230); ctx.fillStyle = ink; glow(true);
      const f = fit((s) => `500 ${s}px ${SERIF}`, o.text, area - 190, 92, 40, 1.08);
      ctx.font = `500 ${f.s}px ${SERIF}`;
      const st = y0 + 200 + f.s;
      f.lines.forEach((l, i) => ctx.fillText(l, M, st + i * f.lh));
      const ry = st + (f.lines.length - 1) * f.lh + 100;
      glow(false); ctx.fillStyle = acc; ctx.fillRect(M, ry - 9, 70, 2); ctx.fillStyle = ink;
      ls("6px"); ctx.font = `600 26px ${SANS}`; ctx.fillText(String(o.ref).toUpperCase(), M + 92, ry); ls("0px");
    } else {
      const cut = o.text.search(/[;:,]/), a = cut > 6 && cut < 70 ? o.text.slice(0, cut) : o.text.split(" ").slice(0, 4).join(" ");
      const b = o.text.slice(a.length).replace(/^[;:,.]\s*/, "").trim();
      ctx.textAlign = "center"; ls("6px");
      const fa = fit((s) => `700 ${s}px ${SERIF}`, a.toUpperCase(), area * 0.55, 150, 56, 0.98);
      const fb = b ? fit((s) => `italic 500 ${s}px ${SERIF}`, b, area * 0.4, 58, 32, 1.18) : { lines: [], lh: 0, s: 0 };
      const total = fa.lines.length * fa.lh + (b ? 60 + fb.lines.length * fb.lh : 0);
      let y = y0 + Math.max(0, (area - total) / 2) + fa.s * 0.8;
      ctx.font = `700 ${fa.s}px ${SERIF}`; ls(Math.round(fa.s * 0.05) + "px");
      fa.lines.forEach((l, i) => ctx.fillText(l, W / 2, y + i * fa.lh));
      ls("0px"); y += (fa.lines.length - 1) * fa.lh + 40;
      if (b) { ctx.font = `italic 500 ${fb.s}px ${SERIF}`; fb.lines.forEach((l, i) => ctx.fillText(l, W / 2, y + fb.s + i * fb.lh)); y += fb.s + (fb.lines.length - 1) * fb.lh; }
      glow(false); ls("7px"); ctx.font = `600 27px ${SANS}`; ctx.fillStyle = acc;
      ctx.fillText(String(o.ref).toUpperCase(), W / 2, y + 90); ctx.fillStyle = ink; ls("0px");
    }
    if (o.firma) {
      glow(false); ctx.textAlign = "center"; ctx.globalAlpha = 0.78; ls("6px"); ctx.font = `600 22px ${SANS}`;
      ctx.fillText(`IGLESIA DE DIOS E.C. · ${K.churchShort().toUpperCase()}`, W / 2, H - (story ? 220 : 76)); ctx.globalAlpha = 1; ls("0px");
    }
  }
  K.drawVerse = drawVerse;
  K.redrawVerses = () => $$("canvas[data-vc]").forEach((cv) => VC[cv.dataset.vc] && drawVerse(cv, VC[cv.dataset.vc]));

  // Imagen de un anuncio (1080 × 1350) para compartir en WhatsApp
  K.drawAnn = (cv, a) => {
    const W = 1080, H = 1350; cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d"), t = K.artOf(a.id || 1, a.art);
    art(ctx, W, H, { kind: t.k, pal: t.p, seed: t.s });
    const light = isLight(t.p), ink = light ? "#1d1a14" : "#FBF6EC", acc = light ? "#8a6a2c" : PAL[t.p][2];
    const g = ctx.createLinearGradient(0, H * 0.35, 0, H);
    g.addColorStop(0, "rgba(8,10,22,0)"); g.addColorStop(1, light ? "rgba(255,250,240,.5)" : "rgba(8,10,22,.6)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const ls = (v) => { if ("letterSpacing" in ctx) ctx.letterSpacing = v; };
    ctx.fillStyle = ink; ctx.textAlign = "left";
    ls("8px"); ctx.font = `600 26px ${SANS}`; ctx.globalAlpha = 0.85;
    ctx.fillText(`IGLESIA DE DIOS E.C. · ${K.churchShort().toUpperCase()}`, 96, 130); ctx.globalAlpha = 1; ls("0px");
    let y = H - 120;
    if (a.event_at) {
      const d = new Date(a.event_at);
      ctx.font = `500 230px ${SERIF}`; ctx.fillText(K.dpart(d, { day: "numeric" }), 90, 640);
      ls("8px"); ctx.font = `600 30px ${SANS}`;
      ctx.fillText(`${K.dpart(d, { month: "long" })} · ${K.dpart(d, { weekday: "long" })}`.toUpperCase(), 100, 700);
      ctx.fillText(K.fmtTime(a.event_at).toUpperCase(), 100, 748); ls("0px");
    }
    ctx.font = `italic 600 92px ${SERIF}`;
    const lines = wrap(ctx, a.title || "", W - 200).slice(0, 4);
    const meta = a.place ? a.place : "";
    y = H - 130 - (meta ? 60 : 0) - (lines.length - 1) * 96;
    lines.forEach((l, i) => ctx.fillText(l, 96, y + i * 96));
    ctx.fillStyle = acc; ctx.fillRect(98, y + (lines.length - 1) * 96 + 40, 70, 3); ctx.fillStyle = ink;
    if (meta) { ctx.font = `500 34px ${SANS}`; ctx.fillText(meta, 96, y + (lines.length - 1) * 96 + 110); }
  };

  function guilloche(cv) {
    const w = cv.clientWidth, h = cv.clientHeight; if (!w || cv.dataset.done === w + "") return;
    cv.dataset.done = w + ""; const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = w * dpr; cv.height = h * dpr; const x = cv.getContext("2d"); x.scale(dpr, dpr);
    const cx = w * 0.86, cy = h * 0.18;
    x.lineWidth = 0.6;
    for (let ring = 0; ring < 3; ring++) {
      const Rr = w * (0.28 + ring * 0.12), r = Rr / (5.3 + ring), d = r * (1.6 + ring * 0.3);
      x.strokeStyle = `rgba(216,178,106,${0.22 - ring * 0.05})`; x.beginPath();
      for (let t = 0; t <= Math.PI * 2 * 12; t += 0.01) {
        const X = cx + (Rr - r) * Math.cos(t) + d * Math.cos(((Rr - r) / r) * t), Y = cy + (Rr - r) * Math.sin(t) - d * Math.sin(((Rr - r) / r) * t);
        t ? x.lineTo(X, Y) : x.moveTo(X, Y);
      }
      x.stroke();
    }
    x.strokeStyle = "rgba(216,178,106,.09)";
    for (let i = 0; i < 26; i++) { x.beginPath(); x.moveTo(0, h * 0.62 + i * 3.2); x.bezierCurveTo(w * 0.3, h * 0.5 + i * 3.2, w * 0.6, h * 0.95 + i * 2, w, h * 0.7 + i * 3.4); x.stroke(); }
  }

  // ===== versículo del día (Reina-Valera 1960) =====
  K.VERSES = [
    ["Isaías 43:1", "No temas, porque yo te redimí; te puse nombre, mío eres tú."],
    ["Salmos 118:24", "Este es el día que hizo Jehová; nos gozaremos y alegraremos en él."],
    ["Salmos 23:1", "Jehová es mi pastor; nada me faltará."],
    ["Salmos 119:105", "Lámpara es a mis pies tu palabra, y lumbrera a mi camino."],
    ["Josué 1:9", "Mira que te mando que te esfuerces y seas valiente; no temas ni desmayes, porque Jehová tu Dios estará contigo en dondequiera que vayas."],
    ["Lamentaciones 3:22-23", "Por la misericordia de Jehová no hemos sido consumidos, porque nunca decayeron sus misericordias. Nuevas son cada mañana; grande es tu fidelidad."],
    ["Mateo 11:28", "Venid a mí todos los que estáis trabajados y cargados, y yo os haré descansar."],
    ["Salmos 133:1", "¡Mirad cuán bueno y cuán delicioso es habitar los hermanos juntos en armonía!"],
    ["Filipenses 4:13", "Todo lo puedo en Cristo que me fortalece."],
    ["Salmos 46:1", "Dios es nuestro amparo y fortaleza, nuestro pronto auxilio en las tribulaciones."],
    ["Proverbios 3:5", "Fíate de Jehová de todo tu corazón, y no te apoyes en tu propia prudencia."],
    ["Jeremías 29:11", "Porque yo sé los pensamientos que tengo acerca de vosotros, dice Jehová, pensamientos de paz, y no de mal, para daros el fin que esperáis."],
    ["Romanos 8:28", "Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien, esto es, a los que conforme a su propósito son llamados."],
    ["Salmos 37:5", "Encomienda a Jehová tu camino, y confía en él; y él hará."],
    ["Mateo 6:33", "Mas buscad primeramente el reino de Dios y su justicia, y todas estas cosas os serán añadidas."],
    ["Juan 14:27", "La paz os dejo, mi paz os doy; yo no os la doy como el mundo la da. No se turbe vuestro corazón, ni tenga miedo."],
    ["Números 6:24", "Jehová te bendiga, y te guarde."],
    ["Salmos 121:1-2", "Alzaré mis ojos a los montes; ¿De dónde vendrá mi socorro? Mi socorro viene de Jehová, que hizo los cielos y la tierra."],
    ["Isaías 40:31", "Pero los que esperan a Jehová tendrán nuevas fuerzas; levantarán alas como las águilas; correrán, y no se cansarán; caminarán, y no se fatigarán."],
    ["1 Pedro 2:9", "Mas vosotros sois linaje escogido, real sacerdocio, nación santa, pueblo adquirido por Dios, para que anunciéis las virtudes de aquel que os llamó de las tinieblas a su luz admirable."],
    ["Salmos 27:1", "Jehová es mi luz y mi salvación; ¿de quién temeré?"],
    ["Hebreos 13:8", "Jesucristo es el mismo ayer, y hoy, y por los siglos."],
    ["Juan 3:16", "Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna."],
    ["Salmos 91:1", "El que habita al abrigo del Altísimo morará bajo la sombra del Omnipotente."],
  ];
  K.dayIndex = () => { const t = today(); return Math.round((Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10)) - Date.UTC(2026, 0, 1)) / 86400000); };
  K.defaultVerse = () => {
    const n = K.dayIndex(), [ref, text] = K.VERSES[((n % K.VERSES.length) + K.VERSES.length) % K.VERSES.length];
    const a = K.artOf(n + 2);
    return { ref, text, pal: a.p, kind: a.k, seed: a.s, layout: "clasico", fmt: "cuadrado", firma: true };
  };

  // ===== menús desplegables =====
  const DD = {};
  K.dd = (id, c) => {
    DD[id] = c;
    const opts = c.options(), cur = c.value(), multi = c.multi;
    const sel = multi ? opts.filter((o) => cur.includes(o.v)) : opts.filter((o) => o.v === cur);
    const val = c.display ? c.display(sel) : sel[0]?.l ?? "";
    return `<div class="dd ${c.cls || ""}" data-dd="${id}">
      <button class="dd-btn" type="button" aria-haspopup="menu" aria-expanded="false" data-ddt="${id}" ${c.aria ? `aria-label="${esc(c.aria)}"` : ""}>${c.icon ? ic(c.icon) : ""}${c.label ? `<span class="lab">${esc(c.label)}</span>` : ""}${val ? `<span class="val">${esc(val)}</span>` : ""}${c.btnHtml || ""}${c.noChev ? "" : ic(c.chevIcon || "chev", c.chevIcon ? "" : "chev")}</button>
      <div class="dd-menu ${c.right ? "r" : ""}" role="menu">${c.head ? `<div class="dd-head eyebrow">${esc(c.head)}</div>` : ""}${opts.map((o) => o.sep ? '<div class="dd-sep"></div>' :
        `<button type="button" class="dd-item" role="${multi ? "menuitemcheckbox" : "menuitemradio"}" aria-checked="${multi ? cur.includes(o.v) : o.v === cur}" data-ddp="${id}" data-v="${esc(o.v)}">${o.icon ? ic(o.icon) : "<span></span>"}<span><span class="t">${esc(o.l)}</span>${o.s ? `<span class="s">${esc(o.s)}</span>` : ""}</span>${ic("check", "ck")}</button>`).join("")}</div>
    </div>`;
  };
  const closeDD = () => $$(".dd.open").forEach((d) => { d.classList.remove("open"); $(".dd-btn", d).setAttribute("aria-expanded", "false"); });
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-ddt],[data-ddp]");
    if (!t) { if (!e.target.closest(".dd-menu")) closeDD(); return; }
    if (t.dataset.ddt) {
      const box = t.closest(".dd"), was = box.classList.contains("open");
      closeDD();
      if (!was) {
        box.classList.add("open"); t.setAttribute("aria-expanded", "true");
        // que el menú no se salga de la pantalla
        const m = $(".dd-menu", box), r = m.getBoundingClientRect();
        if (r.right > innerWidth - 8 && !m.classList.contains("r")) m.classList.add("r", "flipx");
        else if (m.classList.contains("flipx") && box.getBoundingClientRect().left + r.width < innerWidth - 8) m.classList.remove("r", "flipx");
      }
      return;
    }
    const c = DD[t.dataset.ddp]; closeDD();
    if (c) c.pick(t.dataset.v);
  });

  // ===== hoja (abajo) y panel lateral =====
  const layer = () => {
    let sc = $("#scrim");
    if (!sc) {
      document.body.insertAdjacentHTML("beforeend", '<div class="scrim" id="scrim" hidden></div>');
      sc = $("#scrim"); sc.addEventListener("click", () => K.closeAll());
    }
    return sc;
  };
  function openLayer(kind, html, onMount) {
    K.closeAll(true);
    const sc = layer();
    const el = document.createElement("div");
    el.className = kind; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
    el.innerHTML = (kind === "sheet" ? '<div class="grab"></div>' : "") + html;
    document.body.appendChild(el); sc.hidden = false;
    requestAnimationFrame(() => { el.classList.add("show"); sc.classList.add("show"); K.paint(el); });
    const close = () => K.closeAll();
    el.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
    if (onMount) onMount(el, close);
    return close;
  }
  K.sheet = (html, onMount) => openLayer("sheet", html, onMount);
  K.drawer = (html, onMount) => openLayer(window.innerWidth >= 700 ? "drawer" : "sheet", html, onMount);
  K.closeAll = (now) => {
    $$(".sheet,.drawer").forEach((e) => { e.classList.remove("show"); if (now) e.remove(); else setTimeout(() => e.remove(), 280); });
    const sc = $("#scrim"); if (sc) { sc.classList.remove("show"); if (now) sc.hidden = true; else setTimeout(() => (sc.hidden = true), 220); }
  };
  K.head = (title, eyebrow) => `<div class="sh"><div style="flex:1;min-width:0">${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ""}<h2${eyebrow ? ' style="margin-top:6px"' : ""}>${esc(title)}</h2></div><button class="iconbtn" data-close aria-label="Cerrar">${ic("close")}</button></div>`;
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeDD(); K.closeAll(); } });

  // ===== sesión =====
  K.sb = null; K.me = null; K.church = {};
  K.churchShort = () => (K.church && (K.church.short_name || K.church.name)) || "La Línea";
  const app = () => $("#app");
  K.isStaff = () => K.me && (K.me.role === "pastor" || K.me.role === "secretary");
  K.canScan = () => K.me && ["usher", "secretary"].includes(K.me.role);
  K.modes = () => {
    const r = K.me.role, m = ["member"];
    if (r === "pastor") m.push("pastor");
    if (r === "secretary") m.push("central"); // el pastor ve las cifras en «Controles»
    return m;
  };
  K.MODE_NAME = { member: "Mi app de miembro", pastor: "App del pastor", central: "Kaleos Central" };
  K.MODE_ICON = { member: "inicio", pastor: "asistente", central: "registro" };

  async function boot() {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
    if (!cfg.url || !cfg.anonKey) { app().innerHTML = `<div class="splash"><h1>Kaleos</h1><p>Falta configurar la conexión con la base de datos.</p></div>`; return; }
    K.sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
    const { data } = await K.sb.auth.getSession();
    if (location.hash === "#instalar") return renderSetup();
    if (!data.session) return renderLogin();
    await K.loadMe();
  }

  K.loadMe = async () => {
    const { data: u } = await K.sb.auth.getUser();
    if (!u || !u.user) return renderLogin();
    const { data: p, error } = await K.sb.from("kaleos_profiles").select("*").eq("id", u.user.id).maybeSingle();
    if (error || !p) { await K.sb.auth.signOut(); return renderLogin("Esta cuenta no pertenece a Kaleos."); }
    if (!p.active) { await K.sb.auth.signOut(); return renderLogin("Esta cuenta está desactivada. Hable con su pastor."); }
    K.me = p;
    if (!p.level) p.level = "adherente"; // antes de pegar el SQL nuevo
    const { data: c } = await K.sb.from("kaleos_churches").select("*").eq("id", p.church_id).single();
    K.church = c || {};
    let mode = null;
    try { mode = localStorage.getItem("kaleos-mode-" + p.id); } catch (_) {}
    if (!K.modes().includes(mode)) mode = p.role === "pastor" ? "pastor" : p.role === "secretary" ? "central" : "member";
    K.setMode(mode);
    if (mode === "member" && "contact_updated_at" in p && !p.contact_updated_at && K.member) setTimeout(() => K.member.myData(true), 700);
  };

  K.setMode = (mode) => {
    if (K.voiceStop) K.voiceStop();
    K.mode = mode;
    try { localStorage.setItem("kaleos-mode-" + K.me.id, mode); } catch (_) {}
    K.closeAll(true);
    K.render();
  };
  // Dibuja el modo actual (cada archivo registra el suyo en K.shells)
  K.render = () => {
    const s = K.shells && K.shells[K.mode];
    if (!s) { app().innerHTML = '<div class="loading"><i></i>Cargando…</div>'; return; }
    s.render(app());
  };
  K.shells = {};
  K.logout = async () => {
    if (!confirm("¿Cerrar sesión en este teléfono?")) return;
    if (K.voiceStop) K.voiceStop();
    await K.sb.auth.signOut(); K.me = null; K.bust(); renderLogin();
  };
  // Muestra una vista asíncrona en un contenedor con aviso de carga y de error
  K.mount = async (el, view, ...args) => {
    const token = (el._tok = (el._tok || 0) + 1);
    el.innerHTML = '<div class="loading"><i></i>Cargando…</div>';
    try {
      await view(el, ...args);
      if (el._tok === token) requestAnimationFrame(() => K.paint(el));
    } catch (e) {
      console.error(e);
      if (el._tok === token) el.innerHTML = `<div class="note warn">${esc(K.errMsg(e))}</div>`;
    }
  };
  // Menú del usuario (avatar): cambiar de modo y salir
  K.userMenu = (extra = [], id = "umenu") => K.dd(id, {
    right: true, cls: "menudd", aria: "Menú", noChev: true, btnHtml: `<span class="avatar">${esc(K.ini(K.me.full_name))}</span>`,
    head: `${K.me.title || ""} ${K.me.full_name}`.trim(),
    options: () => [...extra, ...(extra.length ? [{ sep: 1 }] : []),
      ...K.modes().filter((m) => m !== K.mode).map((m) => ({ v: "mode:" + m, l: K.MODE_NAME[m], icon: K.MODE_ICON[m] })),
      { v: "logout", l: "Cerrar sesión", icon: "salir" }],
    value: () => "",
    pick: (v) => {
      if (v === "logout") return K.logout();
      if (v.startsWith("mode:")) return K.setMode(v.slice(5));
      const x = extra.find((o) => o.v === v); if (x && x.go) x.go();
    },
  });

  // ===== inicio de sesión =====
  function renderLogin(msg) {
    app().innerHTML = `<div class="splash">
      <svg class="mk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" aria-hidden="true">${I.kaleos}</svg>
      <h1>Kaleos</h1><div class="rule"></div>
      <div class="org">Iglesia de Dios E.C.</div><div class="org thin">La Línea</div>
      <form class="login" id="f" autocomplete="on">
        <div class="field"><label for="no">Número de miembro</label>
          <input class="inp" id="no" name="username" autocomplete="username" placeholder="LL-0142" required></div>
        <div class="field"><label for="pin">PIN de 6 números</label>
          <input class="inp" id="pin" name="password" type="password" inputmode="numeric" pattern="\\d{6}" maxlength="6" autocomplete="current-password" placeholder="••••••" required></div>
        <button class="btn" id="go">Entrar</button>
        <div class="help">${msg ? esc(msg) + "<br>" : ""}¿No tiene su número o PIN? Pídalo a su pastor.</div>
      </form></div>`;
    $("#f").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("#go"); btn.disabled = true; btn.textContent = "Entrando…";
      const no = K.normalizeMemberNo($("#no").value);
      const { error } = await K.sb.auth.signInWithPassword({ email: emailFor(no), password: $("#pin").value.trim() });
      if (error) { btn.disabled = false; btn.textContent = "Entrar"; return K.toast(K.errMsg(error)); }
      await K.loadMe();
    });
  }
  K.renderLogin = renderLogin;

  function renderSetup() {
    app().innerHTML = `<div class="splash">
      <svg class="mk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">${I.kaleos}</svg>
      <h1>Kaleos</h1><div class="rule"></div><div class="org">Instalación · primer pastor</div>
      <form class="login" id="f">
        <div class="field"><label for="k">Clave de instalación</label><input class="inp" id="k" required autocomplete="off"></div>
        <div class="field"><label for="n">Nombre del pastor</label><input class="inp" id="n" required placeholder="Juan Pérez"></div>
        <div class="field"><label for="ph">Teléfono</label><input class="inp" id="ph" inputmode="tel" placeholder="5555 5555"></div>
        <div class="field"><label for="pin">Elija un PIN de 6 números</label><input class="inp" id="pin" inputmode="numeric" pattern="\\d{6}" maxlength="6" required></div>
        <button class="btn" id="go">Crear cuenta de pastor</button>
        <div class="help"><a href="./">Volver al inicio</a></div>
      </form></div>`;
    $("#f").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("#go"); btn.disabled = true;
      try {
        const pin = $("#pin").value.trim();
        const r = await K.callAdmin({ action: "bootstrap", setup_key: $("#k").value.trim(), church_slug: cfg.church, full_name: $("#n").value, title: "Pastor", phone: $("#ph").value, pin });
        const { error } = await K.sb.auth.signInWithPassword({ email: emailFor(r.member_no), password: pin });
        if (error) throw error;
        history.replaceState(null, "", location.pathname);
        await K.loadMe();
        K.sheet(`${K.head("Cuenta creada")}<div class="secret"><span class="eyebrow">Su número de miembro</span><b>${esc(r.member_no)}</b></div>
          <p>Entre siempre con este número y su PIN. Ya puede agregar a los hermanos desde <b>Hermanos</b>.</p><button class="btn block" data-close>Entendido</button>`);
      } catch (err) { btn.disabled = false; K.toast(K.errMsg(err), 4000); }
    });
  }

  // ===== datos compartidos =====
  K.communities = () => K.load("comms", async () => {
    const { data, error } = await K.sb.rpc("kaleos_communities_overview");
    if (error) { console.warn(error.message); return []; }
    return data || [];
  });
  K.people = () => K.load("people", () => K.rows(K.sb.from("kaleos_profiles").select("*").eq("church_id", K.me.church_id).order("full_name")));
  K.funds = () => K.load("funds", async () => {
    const [funds, tot] = await Promise.all([
      K.rows(K.sb.from("kaleos_funds").select("*").eq("church_id", K.me.church_id).order("sort")),
      K.sb.rpc("kaleos_fund_totals"),
    ]);
    const t = Object.fromEntries((tot.data || []).map((r) => [r.fund_id, Number(r.total)]));
    return funds.map((f) => ({ ...f, got: t[f.id] || 0, goal: Number(f.goal) }));
  });
  K.levelPill = (k) => k && K.LV[k] ? `<span class="pill lv" style="--c:var(--lv${K.LV[k].i + 1})">${K.LV[k].n}</span>` : "";
  K.targetLabel = (a, comms) => {
    if (a.community_id) { const c = (comms || []).find((x) => x.id === a.community_id); return c ? c.name : "Una comunidad"; }
    if (a.levels && a.levels.length) return "Para " + a.levels.map((l) => K.LV_PL[l] || l).join(" y ");
    if (a.profile_id) return "Personal";
    return "Toda la iglesia";
  };

  // ===== escanear asistencia (ujier y Secretaría) =====
  let stopScanner = null;
  K.stopScanner = () => { if (stopScanner) { stopScanner(); stopScanner = null; } };
  K.viewScan = async (el) => {
    K.stopScanner();
    el.innerHTML = `<div class="sec-h"><h2>Registrar asistencia</h2><span class="fine">${K.fmtDate(today(), "dm")}</span></div>
      <p class="muted" style="margin-top:-14px">Apunte la cámara a la tarjeta del hermano.</p>
      <div class="scanner"><video id="v" playsinline muted></video><div class="frame"></div></div>
      <div id="res"></div>
      <form id="man" class="row"><input class="inp" id="mno" placeholder="O escriba el número: LL-0142" aria-label="Número de miembro"><button class="btn">Registrar</button></form>
      <p class="fine" id="count"></p>`;
    const video = $("#v", el), res = $("#res", el), canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let last = "", lastAt = 0, busy = false, raf = 0, stream = null, alive = true;
    const refreshCount = async () => {
      const { count } = await K.sb.from("kaleos_attendance").select("id", { count: "exact", head: true }).eq("church_id", K.me.church_id).eq("service_date", today());
      const c = $("#count", el); if (c) c.textContent = `Hoy van ${count || 0} hermanos registrados.`;
    };
    const show = (kind, title, sub) => { res.innerHTML = `<div class="result ${kind === "ok" ? "" : kind}"><span class="dot">${kind === "bad" ? "!" : ic("check", "sm")}</span><div>${esc(title)}<span class="s">${esc(sub)}</span></div></div>`; };
    const checkIn = async (code) => {
      busy = true;
      const { data, error } = await K.sb.rpc("kaleos_check_in", { p_code: code });
      busy = false;
      if (error) return show("bad", "No se pudo registrar", K.errMsg(error));
      if (!data.ok) return show("bad", data.error, "Pida al hermano que abra su tarjeta en Kaleos.");
      if (navigator.vibrate) navigator.vibrate(data.new ? 120 : [60, 60, 60]);
      show(data.new ? "ok" : "again", `${data.title || ""} ${data.name}`, data.new ? `Asistencia registrada · ${data.streak} ${data.streak === 1 ? "domingo" : "domingos seguidos"}` : "Ya estaba registrado hoy");
      refreshCount();
    };
    const loop = () => {
      if (!alive) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA && !busy) {
        const w = 480, h = Math.round((video.videoHeight / video.videoWidth) * 480) || 480;
        canvas.width = w; canvas.height = h; ctx.drawImage(video, 0, 0, w, h);
        const qr = window.jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
        if (qr && qr.data) {
          const code = qr.data.replace(/^KALEOS:/, ""), now = Date.now();
          if (code !== last || now - lastAt > 5000) { last = code; lastAt = now; checkIn(code); }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    $("#man", el).addEventListener("submit", (e) => { e.preventDefault(); const v = $("#mno", el).value.trim(); if (v) { checkIn(K.normalizeMemberNo(v)); $("#mno", el).value = ""; } });
    stopScanner = () => { alive = false; cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach((t) => t.stop()); };
    refreshCount();
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      if (!alive) return stream.getTracks().forEach((t) => t.stop());
      video.srcObject = stream; await video.play(); loop();
    } catch (e) {
      $(".scanner", el).outerHTML = `<div class="note">No se pudo abrir la cámara. Permita el acceso a la cámara en el navegador o escriba el número del hermano abajo.</div>`;
    }
  };

  // ===== reporte ministerial del mes (pastor y Secretaría) =====
  K.viewReport = async (el, monthStr) => {
    const month = monthStr || today().slice(0, 7);
    const { data: r, error } = await K.sb.rpc("kaleos_month_report", { p_month: month + "-01" });
    if (error) throw error;
    const { data: saved } = await K.sb.from("kaleos_reports").select("sent_at").eq("church_id", K.me.church_id).eq("month", month + "-01").maybeSingle();
    const ch = K.church, mName = `${K.MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
    const rows = [["Asistencia promedio", r.attendance_avg], ["Cultos registrados", r.services], ["Nuevos miembros", r.new_members],
      ["Bautismos", r.baptisms], ["Visitas pastorales", r.visits], ["Nuevos líderes", r.new_leaders],
      ["Peticiones de oración", r.prayers], ["Hermanos en Kaleos", r.members_total]];
    const pastorName = K.me.role === "pastor" ? K.me.full_name : "";
    const text = `REPORTE MINISTERIAL · ${mName.toUpperCase()}\n${ch.name || ""}\n\n` + rows.map(([l, v]) => `${l}: ${v}`).join("\n") + `\n\n${pastorName ? "Pastor: " + pastorName + "\n" : ""}Generado con Kaleos`;
    el.innerHTML = `<div class="sec-h noprint"><h2>Reporte mensual</h2><input type="month" id="m" value="${month}" class="inp" style="width:auto" aria-label="Mes"></div>
      <p class="fine noprint" style="margin-top:-14px">Se arma solo con lo registrado en Kaleos.</p>
      <div class="report"><span class="eyebrow">Reporte ministerial</span><h3 style="font:600 28px var(--f-disp);text-transform:capitalize;margin:4px 0 8px">${esc(mName)} · ${esc(K.churchShort())}</h3>
        ${rows.map(([l, v]) => `<div class="r">${l} <b class="num">${v}</b></div>`).join("")}</div>
      ${saved && saved.sent_at ? `<div class="result noprint"><span class="dot">${ic("check", "sm")}</span><div>Enviado al ${esc(ch.supervisor_name || "Supervisor de Distrito")}<span class="s">${new Date(saved.sent_at).toLocaleString("es-GT", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" })}</span></div></div>` : ""}
      <div class="noprint" style="display:grid;gap:8px"><button class="btn block" id="send">${ic("send", "sm")}Enviar al ${esc(ch.supervisor_name || "Supervisor de Distrito")}</button>
        <button class="btn sec block" id="pr">Imprimir o guardar PDF</button></div>`;
    $("#m", el).addEventListener("change", (e) => { if (e.target.value) K.mount(el, K.viewReport, e.target.value); });
    $("#pr", el).addEventListener("click", () => window.print());
    $("#send", el).addEventListener("click", () => {
      const subject = `Reporte ministerial ${mName} · ${K.churchShort()}`;
      K.sheet(`${K.head("Enviar reporte")}<p class="muted">Elija cómo enviarlo. Kaleos lo deja marcado como enviado.</p>
        <a class="btn block" data-mark target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text)}">${ic("chat", "sm")}Enviar por WhatsApp</a>
        <a class="btn sec block" data-mark href="mailto:${esc(ch.supervisor_email || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}">Enviar por correo${ch.supervisor_email ? "" : " (falta el correo del supervisor)"}</a>
        <button class="btn sec block" id="cp">Copiar texto</button>`, (s, close) => {
        const mark = async () => {
          await K.sb.from("kaleos_reports").upsert({ church_id: K.me.church_id, month: month + "-01", data: r, sent_at: new Date().toISOString(), sent_by: K.me.id }, { onConflict: "church_id,month" });
          close(); setTimeout(() => K.mount(el, K.viewReport, month), 400);
        };
        K.on(s, "[data-mark]", mark);
        $("#cp", s).addEventListener("click", () => navigator.clipboard.writeText(text).then(() => { K.toast("Reporte copiado"); mark(); }));
      });
    });
  };

  // Arranca cuando todos los archivos se cargaron
  window.addEventListener("DOMContentLoaded", () => {
    boot().catch((e) => { console.error(e); app().innerHTML = `<div class="splash"><h1>Kaleos</h1><p>${esc(K.errMsg(e))}</p></div>`; });
    if (document.fonts) Promise.all(['italic 500 40px "Cormorant Garamond"', '600 40px "Cormorant Garamond"', '700 40px "Cormorant Garamond"', '600 20px "Hanken Grotesk"'].map((f) => document.fonts.load(f).catch(() => {}))).then(K.redrawVerses);
  });
})();
