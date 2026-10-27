/* Kaleos: app de cuidado pastoral. Vanilla JS, sin compilación. */
(function () {
  "use strict";

  const cfg = window.KALEOS_CONFIG || {};
  const app = document.getElementById("app");
  const TZ = "America/Guatemala";
  const STAGES = [
    ["visitante", "Visitante"], ["miembro", "Miembro"], ["bautizado", "Bautizado"],
    ["grupo", "En un grupo"], ["sirviendo", "Sirviendo"], ["lider", "Líder"],
  ];
  const STAGE_NAME = Object.fromEntries(STAGES);
  const ROLE_NAME = { member: "Miembro", usher: "Ujier", pastor: "Pastor" };
  // Pedidos de los hermanos: [ícono, nombre, ayuda para la nota]
  const REQ_KINDS = {
    felicitacion: ["🎉", "Felicitación", "¿Qué celebramos? Cumpleaños, graduación, aniversario…"],
    visita: ["🏠", "Visita", "¿Qué día y hora le conviene? ¿Algún motivo?"],
    oracion: ["🙏", "Oración", "¿Por qué desea que oremos? (opcional)"],
    otro: ["✉️", "Otro", "Cuéntele al pastor qué necesita"],
  };
  const REQ_STATUS = { nueva: "Nuevo", orando: "En camino", atendida: "Atendido" };
  const VERSES = [
    ["«Jehová te bendiga, y te guarde.»", "Números 6:24"],
    ["«Enséñanos de tal modo a contar nuestros días, que traigamos al corazón sabiduría.»", "Salmos 90:12"],
    ["«Porque yo sé los pensamientos que tengo acerca de vosotros… para daros el fin que esperáis.»", "Jeremías 29:11"],
    ["«Este es el día que hizo Jehová; nos gozaremos y alegraremos en él.»", "Salmos 118:24"],
  ];

  let sb = null;
  let me = null;      // perfil del usuario
  let church = null;  // iglesia del usuario
  let tab = null;
  let stopScanner = null;

  // ===== utilidades =====
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (sel, root = document) => root.querySelector(sel);
  const today = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const initials = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const MONTHS_S = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sep.", "oct.", "nov.", "dic."];
  function fmtDate(d, style = "long") {
    if (!d) return "—";
    const [y, m, day] = String(d).slice(0, 10).split("-").map(Number);
    if (style === "dm") return `${day} de ${MONTHS[m - 1]}`;
    if (style === "my") return `${MONTHS_S[m - 1]} ${y}`;
    return `${day} ${MONTHS_S[m - 1]} ${y}`;
  }
  const phoneDigits = (p) => String(p || "").replace(/\D/g, "");
  const waLink = (phone, text) => {
    let d = phoneDigits(phone);
    if (d.length === 8) d = "502" + d; // Guatemala
    return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
  };
  function toast(msg, ms = 2600) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove("show"), ms);
  }
  function normalizeMemberNo(v) {
    const s = String(v || "").trim().toUpperCase().replace(/\s+/g, "");
    if (/^\d+$/.test(s)) return `${cfg.prefix || "LL"}-${s.padStart(4, "0")}`;
    const m = s.match(/^([A-Z]+)-?(\d+)$/);
    return m ? `${m[1]}-${m[2].padStart(4, "0")}` : s;
  }
  const emailFor = (no) => `${no.toLowerCase()}@${cfg.church || "la-linea"}.kaleos.app`;
  function errMsg(e) {
    const m = (e && (e.message || e.error_description || e.error)) || String(e);
    if (/Invalid login/i.test(m)) return "Número o PIN incorrecto.";
    if (/Failed to fetch|NetworkError/i.test(m)) return "Sin conexión. Intente de nuevo.";
    return m;
  }
  async function callAdmin(body) {
    const { data, error } = await sb.functions.invoke("kaleos-admin", { body });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); msg = j.error || msg; } catch (_) {}
      throw new Error(msg);
    }
    if (data && data.error) throw new Error(data.error);
    return data;
  }

  function sheet(title, html, onMount) {
    const bg = document.createElement("div");
    bg.className = "sheet-bg";
    bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sh"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Cerrar">✕</button></div>${html}</div>`;
    const close = () => bg.remove();
    bg.addEventListener("click", (e) => { if (e.target === bg || e.target.closest("[data-close]")) close(); });
    document.body.appendChild(bg);
    if (onMount) onMount(bg.querySelector(".sheet"), close);
    return close;
  }

  function qrSvg(text) {
    const q = window.qrcode(0, "M");
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }

  // ===== arranque =====
  async function boot() {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
    if (!cfg.url || !cfg.anonKey) {
      app.innerHTML = `<div class="splash"><h1>Kaleos</h1><p>Falta configurar la conexión con la base de datos.</p></div>`;
      return;
    }
    sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
    const { data } = await sb.auth.getSession();
    if (location.hash === "#instalar") return renderSetup();
    if (!data.session) return renderLogin();
    await loadMe();
  }

  async function loadMe() {
    const { data: u } = await sb.auth.getUser();
    if (!u || !u.user) return renderLogin();
    const { data: p, error } = await sb.from("kaleos_profiles").select("*").eq("id", u.user.id).maybeSingle();
    if (error || !p) {
      await sb.auth.signOut();
      return renderLogin("Esta cuenta no pertenece a Kaleos.");
    }
    if (!p.active) {
      await sb.auth.signOut();
      return renderLogin("Esta cuenta está desactivada. Hable con su pastor.");
    }
    me = p;
    const { data: c } = await sb.from("kaleos_churches").select("*").eq("id", p.church_id).single();
    church = c || {};
    renderShell(me.role === "pastor" ? "panel" : "tarjeta");
    // Primera vez que el hermano entra: le pedimos sus datos de contacto
    if (me.role !== "pastor" && "contact_updated_at" in me && !me.contact_updated_at) setTimeout(() => myDataSheet(true), 600);
  }

  // ===== inicio de sesión =====
  function renderLogin(msg) {
    app.innerHTML = `<div class="splash">
      <img src="./img/mark-w.png" alt="" class="mk"><h1>Kaleos</h1><div class="rule"></div>
      <div class="org">IGLESIA DE DIOS E.C.</div><div class="org thin">La Línea</div>
      <form class="login" id="f" autocomplete="on">
        <div class="field"><label for="no">Número de miembro</label>
          <input id="no" name="username" inputmode="text" autocomplete="username" placeholder="LL-0142" required></div>
        <div class="field"><label for="pin">PIN de 6 números</label>
          <input id="pin" name="password" type="password" inputmode="numeric" pattern="\\d{6}" maxlength="6" autocomplete="current-password" placeholder="••••••" required></div>
        <button class="btn" id="go">Entrar</button>
        <div class="help">${msg ? esc(msg) + "<br>" : ""}¿No tiene su número o PIN? Pídalo a su pastor.</div>
      </form></div>`;
    $("#f").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("#go");
      btn.disabled = true; btn.textContent = "Entrando…";
      const no = normalizeMemberNo($("#no").value);
      const { error } = await sb.auth.signInWithPassword({ email: emailFor(no), password: $("#pin").value.trim() });
      if (error) { btn.disabled = false; btn.textContent = "Entrar"; return toast(errMsg(error)); }
      await loadMe();
    });
  }

  function renderSetup() {
    app.innerHTML = `<div class="splash">
      <img src="./img/mark-w.png" alt="" class="mk"><h1>Kaleos</h1><div class="rule"></div>
      <div class="org">INSTALACIÓN · PRIMER PASTOR</div>
      <form class="login" id="f">
        <div class="field"><label for="k">Clave de instalación</label><input id="k" required autocomplete="off"></div>
        <div class="field"><label for="n">Nombre del pastor</label><input id="n" required placeholder="Pastor Juan Pérez"></div>
        <div class="field"><label for="ph">Teléfono</label><input id="ph" inputmode="tel" placeholder="5555 5555"></div>
        <div class="field"><label for="pin">Elija un PIN de 6 números</label><input id="pin" inputmode="numeric" pattern="\\d{6}" maxlength="6" required></div>
        <button class="btn" id="go">Crear cuenta de pastor</button>
        <div class="help"><a href="./">Volver al inicio</a></div>
      </form></div>`;
    $("#f").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("#go"); btn.disabled = true;
      try {
        const pin = $("#pin").value.trim();
        const r = await callAdmin({ action: "bootstrap", setup_key: $("#k").value.trim(), church_slug: cfg.church,
          full_name: $("#n").value, title: "Pastor", phone: $("#ph").value, pin });
        const { error } = await sb.auth.signInWithPassword({ email: emailFor(r.member_no), password: pin });
        if (error) throw error;
        history.replaceState(null, "", location.pathname);
        await loadMe();
        sheet("Cuenta creada", `<div class="secret"><span class="small">Su número de miembro</span><b>${esc(r.member_no)}</b></div>
          <p>Entre siempre con este número y su PIN. Ya puede agregar a los hermanos desde <b>Hermanos</b>.</p>
          <button class="btn" data-close>Entendido</button>`);
      } catch (err) { btn.disabled = false; toast(errMsg(err), 4000); }
    });
  }

  // ===== estructura con pestañas =====
  function tabsFor(role) {
    if (role === "pastor") return [["panel", "panel", "Panel"], ["pedidos", "mensajes", "Pedidos"], ["hermanos", "hermanos", "Hermanos"], ["saludos", "saludos", "Saludos"], ["escanear", "escanear", "Escanear"], ["reporte", "reporte", "Reporte"], ["iglesia", "iglesia", "Iglesia"]];
    const t = [["tarjeta", "inicio", "Inicio"], ["mensajes", "mensajes", "Mensajes"], ["pedir", "pedir", "Pedir"], ["camino", "camino", "Camino"]];
    if (role === "usher") t.push(["escanear", "escanear", "Escanear"]);
    t.push(["iglesia", "iglesia", "Iglesia"]);
    return t;
  }

  function renderShell(start) {
    const role = me.role;
    const tabs = tabsFor(role);
    app.innerHTML = `<main class="page" id="page"></main>
      <nav class="tabs" aria-label="Secciones"><div class="in">${tabs.map(([k, i, l]) =>
        `<button class="tab" data-tab="${k}">${icon(i)}${l}</button>`).join("")}</div></nav>`;
    app.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
    go(start);
    if (role !== "pastor") refreshInboxBadge();
  }

  function header() {
    return `<header class="top"><img src="./img/logo.png" alt="La Línea, Iglesia de Dios E.C."><span class="brand">Kaleos</span>
      <div class="who"><b>${esc(me.title)} ${esc(me.full_name.split(" ")[0])}</b>${ROLE_NAME[me.role]}</div>
      <button class="icon-btn" id="logout" aria-label="Salir" title="Salir">⎋</button></header>`;
  }

  function go(name) {
    if (stopScanner) { stopScanner(); stopScanner = null; }
    tab = name;
    app.querySelectorAll(".tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
    const page = $("#page");
    page.innerHTML = header() + `<div id="body"><p class="muted">Cargando…</p></div>`;
    $("#logout").addEventListener("click", async () => {
      if (!confirm("¿Cerrar sesión en este teléfono?")) return;
      await sb.auth.signOut(); me = null; renderLogin();
    });
    window.scrollTo(0, 0);
    const views = { tarjeta: viewHome, camino: viewPath, iglesia: me.role === "pastor" ? viewChurchAdmin : viewChurch,
      escanear: viewScan, panel: viewPanel, hermanos: viewMembers, reporte: viewReport, saludos: viewGreetings, mensajes: viewInbox,
      pedir: viewAsk, pedidos: viewRequests };
    Promise.resolve(views[name]($("#body"))).catch((e) => { $("#body").innerHTML = `<p class="muted">${esc(errMsg(e))}</p>`; });
  }

  // ===== íconos propios de Kaleos (trazos dibujados para la app, sin librerías) =====
  const ICONS = {
    inicio: '<path d="M5 21V10.5a7 7 0 0 1 14 0V21"/><path d="M9.6 21v-5.6a2.4 2.4 0 0 1 4.8 0V21"/><path d="M3 21h18"/><circle class="d" cx="12" cy="8" r="1.15"/>',
    mensajes: '<rect x="3" y="5.5" width="18" height="13.5" rx="2.2"/><path d="M3.6 7.2l8.4 6.3 8.4-6.3"/><circle class="d" cx="12" cy="16" r="1.3"/>',
    pedir: '<path d="M2.5 13.6c2 0 3.3.8 4.5 2.2l1.4 1.6h3.8a1.5 1.5 0 0 0 0-3H9.7"/><path d="M6.6 21.2l1.1-1.3c.6-.6 1.3-.9 2.2-.9h5c1.1 0 1.9-.4 2.6-1.1l3.6-3.6a1.4 1.4 0 0 0-2-2l-3.3 2.6"/><path d="M14.3 9.6c0-2.4 1.8-3.1 1.8-5.4"/><circle class="d" cx="16.1" cy="3" r="1.15"/>',
    camino: '<path d="M3 20.5h4.2v-4.2h4.2v-4.2h4.2V7.9h4.2"/><path d="M19.8 7.9V6.2"/><circle class="d" cx="19.8" cy="4.2" r="1.35"/>',
    escanear: '<path d="M4 8.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3M15.5 4h3A1.5 1.5 0 0 1 20 5.5v3M20 15.5v3a1.5 1.5 0 0 1-1.5 1.5h-3M8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3"/><path d="M4 12h16"/><circle class="d" cx="12" cy="12" r="1.2"/>',
    iglesia: '<path d="M12 2.5v4M10.3 4.2h3.4"/><path d="M5 21V11l7-4.5 7 4.5v10"/><path d="M3 21h18"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/><circle class="d" cx="12" cy="12.3" r="1.1"/>',
    hermanos: '<circle cx="9" cy="8.2" r="3.2"/><path d="M2.8 20.2c.5-3.6 3-5.5 6.2-5.5s5.7 1.9 6.2 5.5"/><path d="M15.4 5.2a3 3 0 1 1 .8 5.8M17.6 14.9c2 .6 3.2 2.3 3.6 5.3"/><circle class="d" cx="9" cy="17.6" r="1"/>',
    saludos: '<path d="M7.2 19.4C4.1 17.4 3 13.9 4 10"/><path d="M16.8 19.4c3.1-2 4.2-5.5 3.2-9.4"/><path d="M5.5 15.6 3.2 16M4.5 12.5l-2-.6M7.6 17.8l-1.3 1.5M18.5 15.6l2.3.4M19.5 12.5l2-.6M16.4 17.8l1.3 1.5"/><path d="m12 6.3 1.3 2.7 3 .4-2.2 2.1.6 2.9-2.7-1.4-2.7 1.4.6-2.9-2.2-2.1 3-.4z"/><circle class="d" cx="12" cy="19.8" r="1.1"/>',
    reporte: '<path d="M4 3.5v17h16.5"/><path d="M8.5 16.5v-4M12.5 16.5V8.5M16.5 16.5v-6"/><circle class="d" cx="12.5" cy="5.5" r="1.1"/>',
    panel: '<path d="M2.8 14.4c0 2.1 3.7 3.4 8.2 3.4 3.4 0 5.9-.9 7.4-2.4l2.9-2.7h-7.1c-2-1.5-5-1.6-7.6-1-2.1.5-3.8 1.4-3.8 2.7z"/><path d="M8.2 17.7l-.9 2.8h7.5l-.9-2.8"/><path class="d" d="M20.3 10.7c-1.3-.6-1.9-1.7-1.6-3.1.2-1 .9-1.8 1.4-2.9.6 1.1 1.5 1.9 1.5 3.3 0 1.3-.5 2.1-1.3 2.7z"/>',
    kaleos: '<path d="M6.5 3.5v17"/><path d="M17 3.5c-4.2 3-6.4 5.6-6.4 8.5s2.2 5.5 6.4 8.5"/><path d="M20 8.2c-1.3 1-2 2.3-2 3.8s.7 2.8 2 3.8" opacity=".55"/><circle class="d" cx="13.2" cy="12" r="1.25"/>',
    agenda: '<path d="M4 20.2V10a8 3.6 0 0 1 16 0v10.2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4.2 11.2h15.6"/><path d="M8.5 3.2v3M15.5 3.2v3"/><circle class="d" cx="15.6" cy="16" r="1.25"/>',
    lugar: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle class="d" cx="12" cy="10" r="2"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    estrella: '<path d="m12 4.5 2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z"/>',
    no: '<path d="M6 6l12 12M18 6 6 18"/>',
    chat: '<path d="M4.2 19.8 5.3 16a8 8 0 1 1 2.9 2.8z"/><path d="M9 9.6c.3 2.3 2.2 4.3 4.6 4.8l1-1.2 1.7.9"/>',
    flecha: '<path d="M9.5 6l6 6-6 6"/>',
    datos: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/><circle class="d" cx="5.6" cy="18.4" r=".9"/>',
  };
  const icon = (n, c = "") => `<svg class="ki ${c}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ""}</svg>`;

  // ===== imágenes generadas (luz, cumbres, aurora, olas) para el versículo y los anuncios =====
  const ART_PAL = {
    alba: ["#1c2240", "#c8734a", "#f3c47c"], olivo: ["#1b281f", "#6f8a5b", "#ecdfad"], vino: ["#2a1320", "#8b3346", "#eeb08a"],
    mar: ["#0d2030", "#2e6e8e", "#c6e8e2"], ocaso: ["#191634", "#5d418c", "#eaafc6"], oro: ["#17130e", "#8d6622", "#f3d48f"], cielo: ["#22365c", "#7fa5cb", "#f5f0e4"],
  };
  const ART_KINDS = ["cumbres", "luz", "aurora", "olas"];
  const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mixRgba = (a, b, t, al = 1) => { const A = hexRgb(a), B = hexRgb(b); return `rgba(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")},${al})`; };
  const alpha = (h, a) => mixRgba(h, h, 0, a);
  function rng(seed) { let a = (seed * 9301 + 49297) >>> 0 || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  let grain = null;
  function grainCanvas() {
    if (grain) return grain;
    grain = document.createElement("canvas"); grain.width = grain.height = 160;
    const x = grain.getContext("2d"), d = x.createImageData(160, 160), R = rng(11);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.floor(R() * 255); d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0); return grain;
  }
  function paintArt(ctx, w, h, o) {
    const R = rng(o.seed || 3), [c0, c1, c2] = ART_PAL[o.pal] || ART_PAL.alba, u = Math.min(w, h);
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, w * 0.2, h);
    g.addColorStop(0, c0); g.addColorStop(0.58, mixRgba(c0, c1, 0.6)); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    if (o.kind === "cumbres") {
      const sx = w * (0.28 + R() * 0.44), sy = h * (0.5 + R() * 0.08);
      const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, u * 0.8);
      rg.addColorStop(0, alpha(c2, 0.85)); rg.addColorStop(0.25, alpha(c2, 0.28)); rg.addColorStop(1, alpha(c2, 0));
      ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = alpha(c2, 0.95); ctx.beginPath(); ctx.arc(sx, sy, u * 0.065, 0, 7); ctx.fill();
      for (let i = 0; i < 5; i++) {
        const y0 = h * (0.56 + i * 0.085), f1 = 2 + R() * 3, f2 = 6 + R() * 6, p1 = R() * 6, p2 = R() * 6, a1 = h * (0.05 - i * 0.004), a2 = h * 0.015;
        ctx.beginPath(); ctx.moveTo(0, h);
        for (let x = 0; x <= w + 8; x += w / 90) { const t = x / w; ctx.lineTo(x, y0 - Math.sin(t * f1 + p1) * a1 - Math.abs(Math.sin(t * f2 + p2)) * a2); }
        ctx.lineTo(w, h); ctx.closePath();
        ctx.fillStyle = mixRgba(c1, c0, 0.3 + i * 0.16, 0.92); ctx.fill();
      }
    } else if (o.kind === "aurora") {
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 6; i++) {
        const x = w * R(), y = h * R() * 0.9, r = u * (0.35 + R() * 0.45), c = i % 2 ? c2 : c1;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, alpha(c, 0.42)); rg.addColorStop(1, alpha(c, 0));
        ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
      }
      ctx.globalCompositeOperation = "source-over"; ctx.lineWidth = Math.max(1, u * 0.0022);
      for (let i = 0; i < 26; i++) {
        ctx.strokeStyle = alpha(c2, 0.05 + R() * 0.08); ctx.beginPath();
        const y = h * (0.2 + R() * 0.6); ctx.moveTo(-20, y);
        ctx.bezierCurveTo(w * 0.3, y - h * 0.3 * R(), w * 0.7, y + h * 0.3 * R(), w + 20, y - h * 0.1 * R()); ctx.stroke();
      }
    } else if (o.kind === "luz") {
      const ox = w * (0.15 + R() * 0.7), oy = -h * 0.08;
      for (let i = 0; i < 11; i++) {
        const a = Math.PI / 2 + (R() - 0.5) * 1.3, sp = 0.03 + R() * 0.07, L = h * 1.5;
        const lg = ctx.createLinearGradient(ox, oy, ox + Math.cos(a) * L, oy + Math.sin(a) * L);
        lg.addColorStop(0, alpha(c2, 0.28)); lg.addColorStop(1, alpha(c2, 0));
        ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(ox, oy);
        ctx.lineTo(ox + Math.cos(a - sp) * L, oy + Math.sin(a - sp) * L); ctx.lineTo(ox + Math.cos(a + sp) * L, oy + Math.sin(a + sp) * L); ctx.fill();
      }
      const rg = ctx.createRadialGradient(ox, 0, 0, ox, 0, u * 0.7);
      rg.addColorStop(0, alpha(c2, 0.5)); rg.addColorStop(1, alpha(c2, 0));
      ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 140; i++) { ctx.fillStyle = alpha(c2, R() * 0.5); ctx.beginPath(); ctx.arc(w * R(), h * R(), u * 0.0035 * R() + 0.4, 0, 7); ctx.fill(); }
    } else {
      for (let i = 0; i < 9; i++) {
        const y0 = h * (0.3 + i * 0.085), A = h * (0.02 + R() * 0.03), f = 1.5 + R() * 2.5, p = R() * 6;
        ctx.beginPath(); ctx.moveTo(0, h);
        for (let x = 0; x <= w + 8; x += w / 80) ctx.lineTo(x, y0 + Math.sin((x / w) * f * Math.PI + p) * A);
        ctx.lineTo(w, h); ctx.closePath();
        const lg = ctx.createLinearGradient(0, y0 - A, 0, h);
        lg.addColorStop(0, mixRgba(c1, c0, i / 9, 0.55)); lg.addColorStop(1, alpha(c0, 0.8));
        ctx.fillStyle = lg; ctx.fill();
        ctx.strokeStyle = alpha(c2, 0.22 - i * 0.015); ctx.lineWidth = Math.max(1, u * 0.002); ctx.stroke();
      }
    }
    const vg = ctx.createRadialGradient(w / 2, h * 0.45, u * 0.3, w / 2, h / 2, Math.max(w, h) * 0.8);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.38)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = 0.14;
    ctx.fillStyle = ctx.createPattern(grainCanvas(), "repeat"); ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  const artFor = (n) => ({ pal: Object.keys(ART_PAL)[n % 7], kind: ART_KINDS[(n * 3 + 1) % 4], seed: n + 3 });
  // Pinta los lienzos con data-art cuando ya tienen tamaño en pantalla
  function paintArtIn(root) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    root.querySelectorAll("canvas[data-art]").forEach((cv) => {
      const w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h || cv.dataset.done) return;
      cv.dataset.done = 1; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
      paintArt(ctx, w, h, artFor(Number(cv.dataset.art) || 0));
    });
  }

  // ===== versículo del día (cambia cada día; Reina-Valera 1960) =====
  const DAY_VERSES = [
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
  ];
  const dayIndex = () => { const t = today(); return Math.round((Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10)) - Date.UTC(2026, 0, 1)) / 86400000); };
  function wrapLines(ctx, text, maxW) {
    const words = text.split(/\s+/), lines = []; let l = "";
    for (const w of words) { const t = l ? l + " " + w : w; if (ctx.measureText(t).width > maxW && l) { lines.push(l); l = w; } else l = t; }
    if (l) lines.push(l); return lines;
  }
  function drawDayVerse(cv) {
    const n = dayIndex(), [ref, text] = DAY_VERSES[((n % DAY_VERSES.length) + DAY_VERSES.length) % DAY_VERSES.length];
    const W = 1080, H = 1080, M = 120, serif = '"Cormorant Garamond", Georgia, serif', sans = "Archivo, Arial, sans-serif";
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d"), art = artFor(n + 2);
    paintArt(ctx, W, H, art);
    const acc = ART_PAL[art.pal][2], ls = (v) => { if ("letterSpacing" in ctx) ctx.letterSpacing = v; };
    let s = 104, lines;
    for (; s >= 42; s -= 3) { ctx.font = `italic 500 ${s}px ${serif}`; lines = wrapLines(ctx, text, W - M * 2); if (lines.length * s * 1.14 <= H - 420) break; }
    const lh = s * 1.14, start = (H - lines.length * lh) / 2 + s * 0.7 - 30;
    ctx.textAlign = "center"; ctx.fillStyle = "#FBF6EC"; ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = 34;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, start + i * lh));
    const ry = start + (lines.length - 1) * lh + 100;
    ctx.shadowBlur = 0; ctx.fillStyle = acc; ctx.fillRect(W / 2 - 24, ry - 44, 48, 2); ctx.fillStyle = "#FBF6EC";
    ls("7px"); ctx.font = `700 27px ${sans}`; ctx.fillText(ref.toUpperCase(), W / 2, ry);
    ctx.globalAlpha = 0.78; ls("6px"); ctx.font = `700 21px ${sans}`;
    ctx.fillText(`IGLESIA DE DIOS E.C. · ${churchShort().toUpperCase()}`, W / 2, H - 76); ctx.globalAlpha = 1; ls("0px");
    return { ref, text };
  }

  // Grabado fino del carnet (líneas doradas como en un billete)
  function engrave(cv) {
    const w = cv.clientWidth, h = cv.clientHeight; if (!w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = w * dpr; cv.height = h * dpr; const x = cv.getContext("2d"); x.scale(dpr, dpr);
    const cx = w * 0.86, cy = h * 0.18; x.lineWidth = 0.6;
    for (let ring = 0; ring < 3; ring++) {
      const Rr = w * (0.28 + ring * 0.12), r = Rr / (5.3 + ring), d = r * (1.6 + ring * 0.3);
      x.strokeStyle = `rgba(216,178,106,${0.22 - ring * 0.05})`; x.beginPath();
      for (let t = 0; t <= Math.PI * 24; t += 0.01) {
        const X = cx + (Rr - r) * Math.cos(t) + d * Math.cos(((Rr - r) / r) * t), Y = cy + (Rr - r) * Math.sin(t) - d * Math.sin(((Rr - r) / r) * t);
        t ? x.lineTo(X, Y) : x.moveTo(X, Y);
      }
      x.stroke();
    }
    x.strokeStyle = "rgba(216,178,106,.09)";
    for (let i = 0; i < 26; i++) { x.beginPath(); x.moveTo(0, h * 0.62 + i * 3.2); x.bezierCurveTo(w * 0.3, h * 0.5 + i * 3.2, w * 0.6, h * 0.95 + i * 2, w, h * 0.7 + i * 3.4); x.stroke(); }
  }

  // ===== hermano: inicio (carnet, versículo del día y anuncios) =====
  const RSVP = { si: ["Asistiré", "check"], tal: ["Me interesa", "estrella"], no: ["No podré", "no"] };
  const ANN_KINDS = ["invitacion", "recordatorio", "aviso"];
  let rsvpReady = true; // falso si la tabla de asistencia aún no existe en la base

  async function homeData() {
    const since = new Date(Date.now() - 14 * 86400000).toISOString(), now = Date.now() - 12 * 3600000;
    const { data } = await sb.from("kaleos_messages").select("*").eq("church_id", me.church_id).is("profile_id", null)
      .in("kind", ANN_KINDS).or(`event_at.gte.${new Date(now).toISOString()},and(event_at.is.null,created_at.gte.${since})`).limit(40);
    const anns = (data || []).sort((a, b) => (a.event_at || a.created_at).localeCompare(b.event_at || b.created_at));
    let rs = [];
    if (anns.length) {
      const r = await sb.from("kaleos_rsvp").select("message_id, profile_id, answer").in("message_id", anns.map((a) => a.id));
      rsvpReady = !r.error; rs = r.data || [];
    }
    return { anns, rs };
  }
  const annWhen = (a) => a.event_at ? new Date(a.event_at) : null;
  const dpart = (d, o) => d.toLocaleString("es-GT", { timeZone: TZ, ...o });

  async function viewHome(el) {
    const bday = isBirthday(me);
    const [{ anns, rs }, unread] = await Promise.all([homeData(), unreadMessages()]);
    const personal = unread.filter((x) => x.profile_id);
    const mine = (id) => (rs.find((r) => r.message_id === id && r.profile_id === me.id) || {}).answer;
    const going = (id) => rs.filter((r) => r.message_id === id && r.answer === "si").length;
    const stageI = STAGES.findIndex(([k]) => k === me.stage);
    el.innerHTML = `${personal.length ? `<button class="big-btn news" id="news"><i>${icon("mensajes")}</i>${personal.length === 1 ? "Tiene un mensaje del pastor" : `Tiene ${personal.length} mensajes del pastor`}</button>` : ""}
      ${bday ? `<div class="kb-bday"><span class="eyebrow">Hoy, ${fmtDate(today(), "dm")}</span><b>¡Feliz cumpleaños, ${esc(me.full_name.split(" ")[0])}!</b><span>Del pastor y toda la congregación</span></div>` : ""}
      <div class="kc" id="kc" role="button" tabindex="0" aria-label="Mi carnet. Toque para ver el código del ujier.">
        <div class="kc-in">
          <div class="kc-f"><canvas class="kc-g" aria-hidden="true"></canvas>
            <div class="kc-c">
              <div class="kc-top"><div><span>Iglesia de Dios E.C.</span><span>${esc(churchShort())}</span></div>${icon("kaleos", "kc-k")}</div>
              <div class="kc-name">${esc(me.full_name)}</div>
              <div class="kc-row"><div class="kc-lv"><span>${ROLE_NAME[me.role]}</span><i>${esc(STAGE_NAME[me.stage] || "")}</i>
                <div class="ladder">${STAGES.map((_, i) => `<b class="${i <= stageI ? "on" : ""}"></b>`).join("")}</div></div>
                <div class="kc-no">${esc(me.member_no)}<br><small>${me.member_since ? "desde " + String(me.member_since).slice(0, 4) : ""}</small></div></div>
            </div></div>
          <div class="kc-f kc-b"><div class="kc-qr"><div class="qr">${qrSvg("KALEOS:" + me.qr_token)}</div><span>Muéstrelo al ujier · ${esc(me.member_no)}</span></div></div>
        </div>
      </div>
      <div class="kc-hint"><span>Toque el carnet para ver su código</span><button class="linkish" id="mydata">Mis datos</button></div>

      <section class="ksec"><div class="ksec-h"><h2>Versículo del día</h2><span>${fmtDate(today(), "dm")}</span></div>
        <canvas class="kverse" id="kverse" role="img"></canvas>
        <div class="kc-hint"><span></span><button class="linkish" id="vshare">${icon("chat")}Compartir</button></div></section>

      <section class="ksec"><div class="ksec-h"><h2>Anuncios</h2><span>${anns.length ? anns.length + (anns.length === 1 ? " próximo" : " próximos") : ""}</span></div>
        ${anns.length ? `<div class="kann">${anns.map((a) => {
          const d = annWhen(a) || new Date(a.created_at), r = mine(a.id), n = going(a.id);
          return `<button class="kann-i" data-ann="${a.id}">
            <span class="kthumb"><canvas data-art="${a.id}" aria-hidden="true"></canvas><span class="kdt"><b>${dpart(d, { day: "numeric" })}</b><span>${dpart(d, { month: "short" }).replace(".", "")}</span></span></span>
            <span class="kann-t"><span class="ktag">${esc(KINDS[a.kind].name)}</span><b>${esc(a.title)}</b>
              <span class="kmeta">${a.event_at ? esc(fmtWhen(a.event_at)) : "Publicado el " + dpart(d, { day: "numeric", month: "long" })}</span>
              ${rsvpReady && a.event_at ? `<span class="krs">${r ? `<span class="kpill ${r}">${RSVP[r][0]}</span>` : ""}${n ? `<span>${n} ${n === 1 ? "asistirá" : "asistirán"}</span>` : ""}</span>` : ""}</span>
            ${icon("flecha", "go")}</button>`;
        }).join("")}</div>` : '<div class="empty">Aún no hay anuncios. Aquí aparecerán los cultos, reuniones y actividades que comparta su pastor.</div>'}
      </section>`;
    paintArtIn(el);
    const kc = $("#kc", el);
    const flip = () => kc.classList.toggle("flip");
    kc.addEventListener("click", flip);
    kc.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });
    requestAnimationFrame(() => engrave($(".kc-g", el)));
    const vcv = $("#kverse", el);
    const draw = () => { const v = drawDayVerse(vcv); vcv.setAttribute("aria-label", `${v.text} ${v.ref}`); return v; };
    let verse = draw();
    if (document.fonts) Promise.all(['italic 500 60px "Cormorant Garamond"', '700 20px Archivo'].map((f) => document.fonts.load(f).catch(() => {}))).then(() => { if (vcv.isConnected) verse = draw(); });
    $("#vshare", el).addEventListener("click", () => shareCanvas(vcv, `«${verse.text}» ${verse.ref}`, "versiculo-del-dia.png"));
    $("#mydata", el).addEventListener("click", myDataSheet);
    if (personal.length) $("#news", el).addEventListener("click", () => go("mensajes"));
    el.querySelectorAll("[data-ann]").forEach((b) => b.addEventListener("click", () => openAnn(anns.find((a) => String(a.id) === b.dataset.ann), rs)));
    if (bday) confetti();
  }

  function shareCanvas(cv, text, name) {
    cv.toBlob(async (b) => {
      const file = b && new File([b], name, { type: "image/png" });
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], text }); } catch (err) { if (err.name !== "AbortError") toast(errMsg(err)); }
        return;
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    }, "image/png");
  }

  async function openAnn(a, rs) {
    if (!a) return;
    const mineOf = () => (rs.find((r) => r.message_id === a.id && r.profile_id === me.id) || {}).answer;
    const count = (k) => rs.filter((r) => r.message_id === a.id && r.answer === k).length;
    if (a.card) { try { await cardReady(); } catch (_) {} }
    const d = annWhen(a);
    sheet(KINDS[a.kind].name, `${a.card && cardAssets ? '<canvas class="gcard" aria-label="Imagen del anuncio"></canvas>' : `<div class="khero"><canvas data-art="${a.id}" aria-hidden="true"></canvas>${d ? `<span class="kdt big"><b>${dpart(d, { day: "numeric" })}</b><span>${dpart(d, { month: "long" })}<br>${dpart(d, { weekday: "long" })}</span></span>` : ""}</div>`}
      <h2 class="kh">${esc(a.title)}</h2>
      ${d ? `<div class="kfact">${icon("agenda")}<div><b>${esc(fmtWhen(a.event_at))}</b><span>${esc(churchShort())}</span></div></div>` : ""}
      ${a.body ? `<div class="kbody">${esc(a.body)}</div>` : ""}
      ${rsvpReady && d ? `<div class="krsvp" role="radiogroup" aria-label="Confirmar asistencia">${Object.entries(RSVP).map(([k, [l, i]]) => `<button role="radio" aria-checked="false" data-r="${k}">${icon(i)}${l}</button>`).join("")}</div>
        <div class="kcount" id="kcount"></div>` : ""}
      <button class="btn sec" id="ainv">Invitar por WhatsApp</button>`, (s) => {
      const cv = $(".gcard", s);
      if (cv) renderCard(cv, a.card.tpl, a.card.c); else paintArtIn(s);
      const paint = () => {
        const m = mineOf();
        s.querySelectorAll("[data-r]").forEach((b) => b.setAttribute("aria-checked", b.dataset.r === m));
        const c = $("#kcount", s);
        if (c) c.innerHTML = `<b>${count("si")} ${count("si") === 1 ? "asistirá" : "asistirán"}</b> · ${count("tal")} ${count("tal") === 1 ? "interesado" : "interesados"}`;
      };
      s.querySelectorAll("[data-r]").forEach((b) => b.addEventListener("click", async () => {
        const k = b.dataset.r, prev = mineOf();
        const i = rs.findIndex((r) => r.message_id === a.id && r.profile_id === me.id);
        if (i >= 0) rs.splice(i, 1);
        if (prev !== k) rs.push({ message_id: a.id, profile_id: me.id, answer: k });
        paint();
        const q = prev === k ? sb.from("kaleos_rsvp").delete().eq("message_id", a.id).eq("profile_id", me.id)
          : sb.from("kaleos_rsvp").upsert({ message_id: a.id, profile_id: me.id, church_id: me.church_id, answer: k, updated_at: new Date().toISOString() }, { onConflict: "message_id,profile_id" });
        const { error } = await q;
        if (error) return toast(errMsg(error), 4000);
        toast(prev === k ? "Respuesta quitada" : k === "si" ? "¡Le esperamos! Su pastor ya sabe que asistirá." : "Respuesta guardada");
        if (tab === "tarjeta") go("tarjeta");
      }));
      $("#ainv", s).addEventListener("click", () => {
        const text = `${a.title}${a.event_at ? "\n🗓️ " + fmtWhen(a.event_at) : ""}\n\nLe invito: ${churchShort()}, Iglesia de Dios E.C.`;
        if (cv) shareCanvas(cv, text, "anuncio-kaleos.png");
        else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
      });
      paint();
    });
  }

  // ===== pastor: quién confirmó asistencia =====
  async function rsvpTile() {
    const { data: msgs } = await sb.from("kaleos_messages").select("id, title, event_at").eq("church_id", me.church_id).is("profile_id", null)
      .gte("event_at", new Date(Date.now() - 12 * 3600000).toISOString()).order("event_at").limit(6);
    if (!msgs || !msgs.length) return { html: "", bind: () => {} };
    const { data: rs, error } = await sb.from("kaleos_rsvp").select("message_id, answer, who:kaleos_profiles!profile_id(full_name)").in("message_id", msgs.map((m) => m.id));
    if (error) return { html: "", bind: () => {} };
    const of = (id, k) => (rs || []).filter((r) => r.message_id === id && r.answer === k);
    return {
      html: `<div class="tile"><div class="lab c">Asistencia confirmada</div>${msgs.map((m) => `<div class="row"><span class="grow">${esc(m.title)} · ${esc(fmtWhen(m.event_at))}</span>
        <button class="pill g" data-rsvp="${m.id}">${of(m.id, "si").length} ${of(m.id, "si").length === 1 ? "asistirá" : "asistirán"}</button></div>`).join("")}</div>`,
      bind: (el) => el.querySelectorAll("[data-rsvp]").forEach((b) => b.addEventListener("click", () => {
        const m = msgs.find((x) => String(x.id) === b.dataset.rsvp);
        const block = (k, l) => { const arr = of(m.id, k); return `<div class="small">${l} (${arr.length})</div><div class="list">${arr.length ? arr.map((r) => `<div class="item" style="cursor:default"><div class="avatar sm">${esc(initials(r.who && r.who.full_name))}</div><div class="grow"><b>${esc(r.who ? r.who.full_name : "")}</b></div></div>`).join("") : '<div class="empty">Nadie aún.</div>'}</div>`; };
        sheet(m.title, `<div class="small">${esc(fmtWhen(m.event_at))}</div>${block("si", "Asistirán")}${block("tal", "Les interesa")}${block("no", "No podrán")}`);
      })),
    };
  }

  // ===== hermano: tarjeta =====
  const isBirthday = (p) => p.birthday && String(p.birthday).slice(5, 10) === today().slice(5, 10);

  async function viewCard(el) {
    const bday = isBirthday(me);
    const { data: streak } = await sb.rpc("kaleos_my_streak");
    const v = VERSES[new Date().getFullYear() % VERSES.length];
    const first = me.full_name.split(" ")[0];
    const unread = await unreadMessages();
    el.innerHTML = `${unread.length ? `<button class="big-btn news" id="news"><i>📬</i>${unread.length === 1 ? "Tiene un mensaje nuevo del pastor" : `Tiene ${unread.length} mensajes nuevos del pastor`}</button>` : ""}
      ${bday ? `<div class="small">Hoy, ${fmtDate(today(), "dm")}</div>
      <div class="card bday"><div class="head"><img src="./img/logo.png" alt=""><span class="badge">HOY</span></div>
        <div class="greet">¡Feliz cumpleaños, ${esc(first)}!</div>
        <div class="verse">${esc(v[0])} ${esc(v[1])}</div>
        <div class="from">Del pastor y toda la congregación</div></div>
      <button class="big-btn" id="pray"><i>🙏</i>Pedir oración</button>` : ""}
      <div class="small">Mi membresía</div>
      <div class="card">
        <div class="head"><img src="./img/logo.png" alt=""><span class="badge ${me.role}">${ROLE_NAME[me.role].toUpperCase()}</span></div>
        <div class="whoami"><div class="avatar">${esc(initials(me.full_name))}</div>
          <div><div class="name">${esc(me.title)} ${esc(me.full_name)}</div><div class="role">${esc(STAGE_NAME[me.stage])}</div>
          <div class="num">Nº ${esc(me.member_no)}</div></div></div>
        <div class="meta">
          <div><span>Miembro desde</span><strong>${me.member_since ? fmtDate(me.member_since, "my") : "—"}</strong></div>
          <div><span>Bautismo</span><strong>${me.baptism_date ? fmtDate(me.baptism_date) : "—"}</strong></div>
          <div><span>Sirve en</span><strong>${esc(me.serves_in || "—")}</strong></div>
          <div><span>Cumpleaños</span><strong>${me.birthday ? fmtDate(me.birthday, "dm") : "—"}</strong></div>
        </div>
        <div class="qrwrap"><div class="qr">${qrSvg("KALEOS:" + me.qr_token)}</div>
          <p>Muestre este código al ujier al entrar.</p></div>
      </div>
      <button class="big-btn" id="mydata"><i>✏️</i>Mis datos y cómo recibir mensajes</button>
      ${streak > 0 ? `<div class="streak"><div class="dot">★</div><div>${streak} ${streak === 1 ? "domingo" : "domingos seguidos"}<div class="small">¡Gracias por congregarse!</div></div></div>` : ""}`;
    if (bday) { confetti(); $("#pray").addEventListener("click", askPrayer); }
    if (unread.length) $("#news").addEventListener("click", () => go("mensajes"));
    $("#mydata").addEventListener("click", myDataSheet);
  }

  function confetti() {
    const box = document.createElement("div");
    box.className = "confetti";
    const cols = ["#1F5BC4", "#3E5BA9", "#1E2747", "#9DB7E8", "#7B808A"];
    for (let i = 0; i < 30; i++) {
      const e = document.createElement("i");
      e.style.left = Math.random() * 100 + "%";
      e.style.background = cols[i % 5];
      e.style.animationDelay = Math.random() * 1.5 + "s";
      box.appendChild(e);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 5500);
  }

  async function askPrayer(ev) {
    const btn = ev && ev.currentTarget;
    if (btn) btn.disabled = true;
    const { data: req, error } = await sb.from("kaleos_prayer_requests").insert({ church_id: me.church_id, profile_id: me.id, kind: "oracion", created_by: me.id })
      .select("id").single();
    if (btn) btn.disabled = false;
    if (error) return toast(errMsg(error));
    sheet("Petición enviada", `<p style="font-size:19px;margin:0">Su pastor ya recibió su petición. La iglesia está orando por usted. 🙏</p>
      <div class="field"><label for="pn">Si desea, cuéntele por qué orar (opcional)</label><textarea id="pn"></textarea></div>
      <button class="btn" id="pns">Agregar detalle</button><button class="btn sec" data-close>Listo</button>`, (s, close) => {
      $("#pns", s).addEventListener("click", async () => {
        const note = $("#pn", s).value.trim();
        if (!note) return close();
        await sb.from("kaleos_prayer_requests").update({ note }).eq("id", req.id);
        toast("Detalle enviado"); close();
      });
    });
  }

  // Cada hermano mantiene al día sus datos de contacto y elige cómo recibir los mensajes del pastor
  function myDataSheet(welcome) {
    let ch = me.preferred_channel || "whatsapp";
    sheet(welcome === true ? "¡Bienvenido a Kaleos!" : "Mis datos", `<p class="muted" style="margin:0">${welcome === true
      ? "Antes de empezar, revise sus datos. Con ellos su pastor le felicita y le avisa de las actividades."
      : "Con estos datos su pastor le felicita y le avisa de las actividades."}</p>
      <div class="field"><label for="dphone">Teléfono (WhatsApp)</label><input id="dphone" inputmode="tel" value="${esc(me.phone || "")}" placeholder="5555 5555"></div>
      <div class="field"><label for="demail">Correo</label><input id="demail" type="email" inputmode="email" value="${esc(me.email || "")}" placeholder="nombre@correo.com"></div>
      <div class="grid2"><div class="field"><label for="dbday">Cumpleaños</label><input id="dbday" type="date" value="${esc(me.birthday || "")}"></div>
        <div class="field"><label for="dwed">Aniversario de bodas</label><input id="dwed" type="date" value="${esc(me.wedding_date || "")}"></div></div>
      <div class="field"><label>¿Cómo prefiere recibir los mensajes?</label>
        <div class="chips">${Object.entries(CHANNELS).map(([k, l]) => `<button class="chip" data-ch="${k}">${k === "whatsapp" ? "💬 " : k === "correo" ? "✉️ " : "📬 "}${l}</button>`).join("")}</div>
        <span class="small">Siempre le llegan también a la pestaña Mensajes de Kaleos.</span></div>
      <button class="btn" id="dsave">Guardar mis datos</button>`, (s, close) => {
      const mark = () => s.querySelectorAll("[data-ch]").forEach((b) => b.classList.toggle("on", b.dataset.ch === ch));
      s.querySelectorAll("[data-ch]").forEach((b) => b.addEventListener("click", () => { ch = b.dataset.ch; mark(); }));
      mark();
      $("#dsave", s).addEventListener("click", async (e) => {
        const f = { p_phone: $("#dphone", s).value.trim(), p_email: $("#demail", s).value.trim(),
          p_birthday: $("#dbday", s).value || null, p_wedding: $("#dwed", s).value || null, p_channel: ch };
        if (ch === "whatsapp" && !f.p_phone) return toast("Escriba su teléfono para recibir por WhatsApp");
        if (ch === "correo" && !f.p_email) return toast("Escriba su correo para recibir por correo");
        e.currentTarget.disabled = true;
        const { error } = await sb.rpc("kaleos_update_my_contact", f);
        if (error) { e.currentTarget.disabled = false; return toast(errMsg(error), 4000); }
        Object.assign(me, { phone: f.p_phone || null, email: f.p_email || null, birthday: f.p_birthday, wedding_date: f.p_wedding, preferred_channel: ch, contact_updated_at: new Date().toISOString() });
        toast("Datos guardados. ¡Gracias!"); close(); if (tab === "tarjeta") go("tarjeta");
      });
    });
  }

  // ===== hermano: mensajes del pastor =====
  async function inboxData() {
    const [{ data: msgs, error }, { data: reads }] = await Promise.all([
      sb.from("kaleos_messages").select("*").eq("church_id", me.church_id).order("created_at", { ascending: false }).limit(40),
      sb.from("kaleos_message_reads").select("message_id").eq("profile_id", me.id),
    ]);
    if (error) return { msgs: [], read: new Set() };
    return { msgs: (msgs || []).filter((x) => !x.profile_id || x.profile_id === me.id), read: new Set((reads || []).map((r) => r.message_id)) };
  }
  async function unreadMessages() {
    if (me.role === "pastor") return [];
    const { msgs, read } = await inboxData();
    return msgs.filter((x) => !read.has(x.id));
  }
  async function refreshInboxBadge() {
    const n = (await unreadMessages()).length;
    const b = app.querySelector('.tab[data-tab="mensajes"]');
    if (!b) return;
    let d = b.querySelector(".count");
    if (!n) { if (d) d.remove(); return; }
    if (!d) { d = document.createElement("b"); d.className = "count"; b.appendChild(d); }
    d.textContent = n;
  }

  async function viewInbox(el) {
    const { msgs, read } = await inboxData();
    const kindOf = (k) => KINDS[k] || KINDS.aviso;
    el.innerHTML = `<h2 class="t">Mensajes del pastor</h2>
      <div class="list">${msgs.length ? msgs.map((x, i) => `<button class="item${read.has(x.id) ? "" : " unread"}" data-i="${i}">
        <div class="avatar sm">${kindOf(x.kind).icon}</div>
        <div class="grow"><b>${esc(x.title)}</b><span>${esc(kindOf(x.kind).name)} · ${new Date(x.created_at).toLocaleDateString("es-GT", { timeZone: TZ, day: "numeric", month: "long" })}</span></div>
        ${read.has(x.id) ? "›" : '<span class="new">NUEVO</span>'}</button>`).join("") : '<div class="empty">Aún no tiene mensajes. Aquí le llegarán las felicitaciones, invitaciones y recordatorios de su pastor.</div>'}</div>`;
    el.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => openMessage(msgs[b.dataset.i], () => go("mensajes"))));
  }

  async function openMessage(x, after) {
    if (x.card) { try { await cardReady(); } catch (_) {} }
    sheet(x.title, `${x.card && cardAssets ? '<canvas class="gcard" aria-label="Tarjeta"></canvas>' : ""}
      <div class="notice" style="background:var(--white);border-color:var(--line);font-size:17px">${esc(x.body || "")}</div>
      ${x.event_at ? `<div class="small">🗓️ ${esc(fmtWhen(x.event_at))}</div>` : ""}
      <div class="grid2">${x.card && cardAssets ? '<button class="btn sec" id="sv">Guardar imagen</button>' : ""}<button class="btn sec" id="ls">▶ Escuchar</button></div>
      <button class="btn" data-close>Listo</button>`, (s) => {
      const cv = $(".gcard", s);
      if (cv) {
        renderCard(cv, x.card.tpl, x.card.c);
        $("#sv", s).addEventListener("click", () => cv.toBlob((b) => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(b); a.download = "tarjeta-kaleos.png";
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        }, "image/png"));
      }
      $("#ls", s).addEventListener("click", () => speak(`${x.title}. ${x.body || ""}`));
    });
    await sb.from("kaleos_message_reads").upsert({ message_id: x.id, profile_id: me.id }, { onConflict: "message_id,profile_id", ignoreDuplicates: true });
    refreshInboxBadge();
    if (after && tab === "mensajes") after();
  }

  // ===== hermano: camino =====
  async function viewPath(el, profile = me) {
    const { data: steps } = await sb.from("kaleos_steps").select("step, achieved_on").eq("profile_id", profile.id);
    const got = Object.fromEntries((steps || []).map((s) => [s.step, s.achieved_on]));
    const cur = STAGES.findIndex(([k]) => k === profile.stage);
    el.innerHTML = `<h2 class="t">Mi camino en la iglesia</h2>
      <div class="path">${STAGES.map(([k, l], i) => {
        const done = i <= cur;
        const cls = done ? "step done" : i === cur + 1 ? "step now" : "step";
        const when = done ? (got[k] ? String(got[k]).slice(0, 4) : "✓") : i === cur + 1 ? "siguiente paso" : "";
        return `<div class="${cls}"><div class="seal">${done ? "✓" : i + 1}</div>${l}<small>${when}</small></div>`;
      }).join("")}</div>
      <p class="muted">Cada paso lo sella su pastor. Si cree que ya dio el siguiente, háblelo con él.</p>`;
  }

  // ===== hermano: reverso / iglesia =====
  async function latestNotice() {
    const { data } = await sb.from("kaleos_notices").select("*").eq("church_id", me.church_id).order("created_at", { ascending: false }).limit(1);
    return (data && data[0]) || null;
  }

  async function viewChurch(el) {
    const n = await latestNotice();
    el.innerHTML = `<div class="small">Reverso de la tarjeta</div>
      <div class="card back">
        <div class="bk-h"><img src="./img/mark-w.png" alt=""><h4>NUESTRA MISIÓN</h4></div>
        <p>${esc(church.mission || "")}</p><hr>
        <div class="notice"><b>${esc(n ? n.title : "Aviso de la semana")}</b><br>${n ? esc(n.body) : "Aún no hay avisos."}
          ${n ? `<br><button class="listen" id="listen">▶ Escuchar aviso</button>` : ""}</div>
      </div>
      ${n && n.sermon_url ? `<a class="big-btn" href="${esc(n.sermon_url)}" target="_blank" rel="noopener"><i>📖</i>${esc(n.sermon_title || "Predicación del domingo")}</a>` : ""}
      ${church.pastor_phone ? `<a class="big-btn" href="tel:${esc(phoneDigits(church.pastor_phone))}"><i>📞</i>Llamar al pastor</a>` : ""}
      <button class="big-btn" id="pray"><i>🙏</i>Pedir oración</button>`;
    $("#pray", el).addEventListener("click", askPrayer);
    if (n) $("#listen", el).addEventListener("click", () => speak(`${n.title}. ${n.body}`));
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return toast("Este teléfono no puede leer en voz alta");
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-GT";
    const v = speechSynthesis.getVoices().find((x) => x.lang && x.lang.startsWith("es"));
    if (v) u.voice = v;
    u.rate = 0.95;
    speechSynthesis.speak(u);
  }

  // ===== ujier: escanear =====
  async function viewScan(el) {
    el.innerHTML = `<h2 class="t">Registrar asistencia</h2>
      <div class="small">${fmtDate(today(), "dm")} · apunte la cámara al código del hermano</div>
      <div class="scanner"><video id="v" playsinline muted></video><div class="frame"></div></div>
      <div id="res"></div>
      <form id="man" class="grid2" style="grid-template-columns:1fr auto">
        <input class="search" id="mno" placeholder="O escriba el número: LL-0142" aria-label="Número de miembro">
        <button class="btn sm">Registrar</button></form>
      <div class="small" id="count"></div>`;
    const video = $("#v", el);
    const res = $("#res", el);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let last = "", lastAt = 0, busy = false, raf = 0, stream = null, alive = true;

    async function refreshCount() {
      const { count } = await sb.from("kaleos_attendance").select("id", { count: "exact", head: true })
        .eq("church_id", me.church_id).eq("service_date", today());
      const c = $("#count", el); if (c) c.textContent = `Hoy van ${count || 0} hermanos registrados.`;
    }
    async function checkIn(code) {
      busy = true;
      const { data, error } = await sb.rpc("kaleos_check_in", { p_code: code });
      busy = false;
      if (error) return show("bad", "No se pudo registrar", errMsg(error));
      if (!data.ok) return show("bad", data.error, "Pida al hermano que abra su tarjeta en Kaleos.");
      if (navigator.vibrate) navigator.vibrate(data.new ? 120 : [60, 60, 60]);
      show(data.new ? "ok" : "again", `${data.title || ""} ${data.name}`,
        data.new ? `Asistencia registrada · ${data.streak} ${data.streak === 1 ? "domingo" : "domingos seguidos"}` : "Ya estaba registrado hoy");
      refreshCount();
    }
    function show(kind, title, sub) {
      res.innerHTML = `<div class="result ${kind === "ok" ? "" : kind}"><div class="dot">${kind === "bad" ? "!" : "✓"}</div>
        <div>${esc(title)}<div class="small">${esc(sub)}</div></div></div>`;
    }
    function loop() {
      if (!alive) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA && !busy) {
        const w = 480, h = Math.round((video.videoHeight / video.videoWidth) * 480) || 480;
        canvas.width = w; canvas.height = h;
        ctx.drawImage(video, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        const qr = window.jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
        if (qr && qr.data) {
          const code = qr.data.replace(/^KALEOS:/, "");
          const now = Date.now();
          if (code !== last || now - lastAt > 5000) { last = code; lastAt = now; checkIn(code); }
        }
      }
      raf = requestAnimationFrame(loop);
    }
    $("#man", el).addEventListener("submit", (e) => {
      e.preventDefault();
      const v = $("#mno", el).value.trim();
      if (v) { checkIn(normalizeMemberNo(v)); $("#mno", el).value = ""; }
    });
    stopScanner = () => { alive = false; cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach((t) => t.stop()); };
    refreshCount();
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      if (!alive) return stream.getTracks().forEach((t) => t.stop());
      video.srcObject = stream;
      await video.play();
      loop();
    } catch (e) {
      $(".scanner", el).outerHTML = `<div class="tile"><b>No se pudo abrir la cámara.</b><span class="muted">Permita el acceso a la cámara en el navegador o escriba el número del hermano abajo.</span></div>`;
    }
  }

  // ===== pastor: panel =====
  async function viewPanel(el) {
    const { data: p, error } = await sb.rpc("kaleos_pastor_panel");
    if (error) throw error;
    const month = today().slice(0, 7) + "-01";
    const { data: rep } = await sb.rpc("kaleos_month_report", { p_month: month });
    const rt = await rsvpTile();
    const t = today().slice(5, 10);
    const list = (arr, fn, empty) => arr.length ? arr.map(fn).join("") : `<div class="empty">${empty}</div>`;
    const daysAgo = (d) => Math.round((new Date(today()) - new Date(d)) / 86400000);
    el.innerHTML = `<h2 class="t">Panel del pastor</h2><div class="small">${p.members_total} hermanos en Kaleos</div>
      <div class="tile"><div class="lab c">Cuidar</div>
        ${list(p.birthdays, (b) => `<div class="row"><span class="grow">🎂 ${esc(b.name)} ${String(b.birthday).slice(5, 10) === t ? "cumple hoy" : "cumple el " + fmtDate(b.birthday, "dm")}</span>
          <button class="pill solid" data-greet="${b.id}">Felicitar</button></div>`, "Nadie cumple años esta semana.")}
        ${list(p.absent, (a) => `<div class="row"><span class="grow">${esc(a.name)} · ${Math.floor(daysAgo(a.last) / 7)} domingos sin venir</span>
          <button class="pill w" data-visit="${a.id}" data-name="${esc(a.name)}">Visitar</button></div>`, "Nadie lleva 3 domingos sin venir.")}
        <div class="row"><span class="grow">📥 ${p.prayers_new} ${p.prayers_new === 1 ? "pedido nuevo" : "pedidos nuevos"} de los hermanos</span><button class="pill b" id="prayers">Ver</button></div>
      </div>
      ${rt.html}
      <div class="tile"><div class="lab f">Formar</div>
        <div class="row"><span class="grow">Listos para bautismo</span><button class="pill g" data-who="ready_baptism">${p.ready_baptism.length}</button></div>
        <div class="row"><span class="grow">Sirviendo, listos para liderar</span><button class="pill g" data-who="ready_lead">${p.ready_lead.length}</button></div>
        <div class="row"><span class="grow">Visitantes sin seguimiento</span><button class="pill w" data-who="visitors_no_follow">${p.visitors_no_follow.length}</button></div>
      </div>
      <div class="tile"><div class="lab r">Reportar</div>
        <div class="row"><span class="grow">Reporte de ${MONTHS[Number(month.slice(5, 7)) - 1]}: ${rep.services} cultos registrados, ${rep.visits} visitas</span><button class="pill b" id="torep">Abrir</button></div>
      </div>`;
    el.querySelectorAll("[data-visit]").forEach((b) => b.addEventListener("click", () => visitSheet(b.dataset.visit, b.dataset.name, () => go("panel"))));
    el.querySelectorAll("[data-greet]").forEach((btn) => btn.addEventListener("click", () => {
      const b = p.birthdays.find((x) => x.id === btn.dataset.greet);
      const md = String(b.birthday).slice(5, 10);
      let d = today().slice(0, 4) + "-" + md;
      if (d < today()) d = (Number(today().slice(0, 4)) + 1) + "-" + md;
      greetSheet({ kind: "cumple", key: "cumple", date: d, m: { id: b.id, full_name: b.name, title: b.title, phone: b.phone } });
    }));
    $("#prayers", el).addEventListener("click", () => go("pedidos"));
    rt.bind(el);
    $("#torep", el).addEventListener("click", () => go("reporte"));
    const titles = { ready_baptism: "Listos para bautismo", ready_lead: "Listos para liderar", visitors_no_follow: "Visitantes sin seguimiento" };
    el.querySelectorAll("[data-who]").forEach((b) => b.addEventListener("click", () => {
      const arr = p[b.dataset.who];
      sheet(titles[b.dataset.who], `<div class="list">${arr.length ? arr.map((x) => `<button class="item" data-id="${x.id}"><div class="avatar sm">${esc(initials(x.name))}</div><div class="grow"><b>${esc(x.name)}</b></div>›</button>`).join("") : '<div class="empty">Nadie por ahora.</div>'}</div>`,
        (s, close) => s.querySelectorAll("[data-id]").forEach((i) => i.addEventListener("click", () => { close(); openMember(i.dataset.id); })));
    }));
  }

  function visitSheet(id, name, after) {
    sheet(`Visita a ${name}`, `<div class="field"><label for="vd">Fecha</label><input id="vd" type="date" value="${today()}"></div>
      <div class="field"><label for="vn">Nota (privada del pastor)</label><textarea id="vn" placeholder="Cómo está la familia, por qué orar…"></textarea></div>
      <button class="btn" id="vs">Registrar visita</button>`, (s, close) => {
      $("#vs", s).addEventListener("click", async () => {
        const { error } = await sb.from("kaleos_visits").insert({ church_id: me.church_id, profile_id: id, pastor_id: me.id,
          visited_on: $("#vd", s).value || today(), note: $("#vn", s).value.trim() || null });
        if (error) return toast(errMsg(error));
        toast("Visita registrada"); close(); if (after) after();
      });
    });
  }

  // ===== pedidos: felicitación, visita, oración u otro =====
  const reqWhen = (r) => new Date(r.created_at).toLocaleString("es-GT", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" });
  const reqFor = (r) => [r.for_name ? "Para " + r.for_name : "", r.for_date ? fmtDate(r.for_date, "dm") : ""].filter(Boolean).join(" · ");
  const REQ_SELECT = "id, kind, note, for_name, for_date, status, created_at, profile_id, who:kaleos_profiles!profile_id(id, full_name, title, phone)";

  // Formulario de pedido. Con pastor = lista de hermanos, el pastor lo anota en nombre de alguien.
  function requestSheet(kind, after, pastor) {
    const [icon, name, hint] = REQ_KINDS[kind];
    const opts = pastor ? pastor.filter((m) => m.active).sort((a, b) => a.full_name.localeCompare(b.full_name))
      .map((m) => `<option value="${m.id}">${esc(m.full_name)}</option>`).join("") : "";
    sheet(`${icon} ${pastor ? "Nuevo pedido" : "Pedir " + name.toLowerCase()}`, `
      ${pastor ? `<div class="chips" id="rk">${Object.entries(REQ_KINDS).map(([k, [i, l]]) => `<button class="chip${k === kind ? " on" : ""}" data-k="${k}">${i} ${l}</button>`).join("")}</div>
        <div class="field"><label for="rw">¿Quién lo pide?</label><select id="rw"><option value="">Elija un hermano…</option>${opts}<option value="otro">Otra persona (no está en Kaleos)</option></select></div>` : ""}
      <div class="field" id="rff"><label for="rf">¿Para quién?</label><input id="rf" placeholder="${pastor ? "Nombre, si es para otra persona" : "Déjelo vacío si es para usted"}"></div>
      <div class="field" id="rdf"><label for="rd">${kind === "visita" ? "Fecha que le conviene (opcional)" : "Fecha de la celebración"}</label><input id="rd" type="date"></div>
      <div class="field"><label for="rn">Nota</label><textarea id="rn" placeholder="${esc(hint)}"></textarea></div>
      <button class="btn" id="rs">${pastor ? "Guardar pedido" : "Enviar al pastor"}</button>`, (s, close) => {
      const show = () => {
        $("#rff", s).style.display = kind === "oracion" || kind === "otro" ? (pastor ? "" : "none") : "";
        $("#rdf", s).style.display = kind === "felicitacion" || kind === "visita" ? "" : "none";
        $("#rdf label", s).textContent = kind === "visita" ? "Fecha que le conviene (opcional)" : "Fecha de la celebración";
        $("#rn", s).placeholder = REQ_KINDS[kind][2];
        if (pastor) s.querySelectorAll("[data-k]").forEach((b) => b.classList.toggle("on", b.dataset.k === kind));
      };
      if (pastor) s.querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => { kind = b.dataset.k; show(); }));
      show();
      $("#rs", s).addEventListener("click", async () => {
        const note = $("#rn", s).value.trim(), forName = $("#rf", s).value.trim();
        let who = pastor ? $("#rw", s).value : me.id;
        if (!who) return toast("Elija quién lo pide");
        if (who === "otro") {
          if (!forName) return toast("Escriba el nombre de la persona");
          who = me.id;
        }
        if (kind === "otro" && !note) return toast("Cuéntele al pastor qué necesita");
        const btn = $("#rs", s);
        btn.disabled = true;
        const { error } = await sb.from("kaleos_prayer_requests").insert({ church_id: me.church_id, profile_id: who || me.id, kind,
          note: note || null, for_name: forName || null, for_date: (kind === "felicitacion" || kind === "visita") && $("#rd", s).value || null, created_by: me.id });
        btn.disabled = false;
        if (error) return toast(errMsg(error), 4000);
        close();
        if (pastor) toast("Pedido guardado");
        else sheet("Pedido enviado", `<p style="font-size:19px;margin:0">Su pastor ya recibió su pedido. ${kind === "oracion" ? "La iglesia está orando por usted. 🙏" : "Pronto le atenderá. 🙌"}</p>
          <button class="btn sec" data-close>Listo</button>`);
        if (after) after();
      });
    });
  }

  // ----- hermano: pedir -----
  async function viewAsk(el) {
    const { data } = await sb.from("kaleos_prayer_requests").select("id, kind, note, for_name, for_date, status, created_at")
      .eq("profile_id", me.id).order("created_at", { ascending: false }).limit(20);
    const mine = data || [];
    el.innerHTML = `<h2 class="t">¿Qué necesita?</h2>
      <div class="small">Su pastor recibe el pedido al instante.</div>
      ${Object.entries(REQ_KINDS).map(([k, [i, l]]) => `<button class="big-btn" data-kind="${k}"><i>${i}</i>${k === "otro" ? "Otra cosa" : "Pedir " + l.toLowerCase()}</button>`).join("")}
      <div class="small" style="margin-top:18px">Mis pedidos</div>
      <div class="list">${mine.length ? mine.map((r) => `<div class="item" style="cursor:default"><div class="avatar sm">${REQ_KINDS[r.kind][0]}</div>
        <div class="grow"><b>${REQ_KINDS[r.kind][1]}${reqFor(r) ? " · " + esc(reqFor(r)) : ""}</b><span>${reqWhen(r)}</span>
        ${r.note ? `<div style="margin-top:4px">${esc(r.note)}</div>` : ""}</div>
        <span class="pill ${r.status === "atendida" ? "g" : r.status === "orando" ? "b" : "w"}">${REQ_STATUS[r.status]}</span></div>`).join("")
        : '<div class="empty">Aún no ha hecho pedidos.</div>'}</div>`;
    el.querySelectorAll("[data-kind]").forEach((b) => b.addEventListener("click", () => requestSheet(b.dataset.kind, () => go("pedir"))));
  }

  // ----- pastor: bandeja de pedidos -----
  let reqFilter = "todos";
  async function viewRequests(el) {
    const [{ data, error }, { data: members }] = await Promise.all([
      sb.from("kaleos_prayer_requests").select(REQ_SELECT).eq("church_id", me.church_id).order("created_at", { ascending: false }).limit(150),
      membersCache.length ? Promise.resolve({ data: membersCache }) : sb.from("kaleos_profiles").select("*").eq("church_id", me.church_id).order("full_name"),
    ]);
    if (error) throw error;
    if (!membersCache.length) membersCache = members || [];
    const all = (data || []).filter((r) => reqFilter === "todos" || r.kind === reqFilter);
    const open = all.filter((r) => r.status !== "atendida");
    const done = all.filter((r) => r.status === "atendida").slice(0, 20);
    const count = (k) => (data || []).filter((r) => r.status !== "atendida" && (k === "todos" || r.kind === k)).length;
    const item = (r) => {
      const who = r.who || {};
      const self = r.profile_id === me.id;
      const acts = [];
      if (who.phone && !self) acts.push(`<a class="pill b" href="tel:${phoneDigits(who.phone)}">Llamar</a>`,
        `<a class="pill b" href="${waLink(who.phone, "")}" target="_blank" rel="noopener">WhatsApp</a>`);
      if (r.status !== "atendida") {
        if (r.kind === "felicitacion" && !r.for_name && !self) acts.push(`<button class="pill solid" data-card="${r.id}">Hacer tarjeta</button>`);
        if (r.kind === "visita" && !self) acts.push(`<button class="pill solid" data-visit="${r.id}">Registrar visita</button>`);
        if (r.status === "nueva") acts.push(`<button class="pill w" data-id="${r.id}" data-to="orando">${r.kind === "oracion" ? "Orando" : "En camino"}</button>`);
        acts.push(`<button class="pill g" data-id="${r.id}" data-to="atendida">✓ Atendido</button>`);
      } else acts.push(`<button class="pill w" data-id="${r.id}" data-to="nueva">Reabrir</button>`);
      return `<div class="item" style="cursor:default;flex-wrap:wrap"><div class="avatar sm">${REQ_KINDS[r.kind][0]}</div>
        <div class="grow"><b>${REQ_KINDS[r.kind][1]} · ${esc(self ? (r.for_name || "Anotado por usted") : who.full_name || "")}</b>
          <span>${[self ? "" : reqFor(r), self && r.for_date ? fmtDate(r.for_date, "dm") : "", reqWhen(r), REQ_STATUS[r.status]].filter(Boolean).map(esc).join(" · ")}</span>
          ${r.note ? `<div style="margin-top:4px">${esc(r.note)}</div>` : ""}</div>
        <div class="chips" style="width:100%;justify-content:flex-end;gap:6px">${acts.join("")}</div></div>`;
    };
    el.innerHTML = `<h2 class="t">Pedidos de los hermanos</h2>
      <div class="small">${count("todos")} ${count("todos") === 1 ? "pendiente" : "pendientes"}</div>
      <button class="btn" id="radd">＋ Agregar pedido</button>
      <div class="chips" style="margin:10px 0">${[["todos", "Todos"], ...Object.entries(REQ_KINDS).map(([k, [i, l]]) => [k, `${i} ${l}`])]
        .map(([k, l]) => `<button class="chip${reqFilter === k ? " on" : ""}" data-f="${k}">${l}${count(k) ? ` (${count(k)})` : ""}</button>`).join("")}</div>
      <div class="list">${open.length ? open.map(item).join("") : '<div class="empty">No hay pedidos pendientes.</div>'}</div>
      ${done.length ? `<div class="small" style="margin-top:18px">Atendidos</div><div class="list">${done.map(item).join("")}</div>` : ""}`;
    const byId = (id) => (data || []).find((r) => String(r.id) === String(id));
    const setStatus = async (id, to) => {
      const { error: e } = await sb.from("kaleos_prayer_requests").update({ status: to, done_at: to === "atendida" ? new Date().toISOString() : null }).eq("id", id);
      if (e) return toast(errMsg(e));
      if (tab === "pedidos") go("pedidos");
    };
    $("#radd", el).addEventListener("click", () => requestSheet(reqFilter === "todos" ? "oracion" : reqFilter, () => go("pedidos"), membersCache));
    el.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { reqFilter = b.dataset.f; go("pedidos"); }));
    el.querySelectorAll("[data-to]").forEach((b) => b.addEventListener("click", () => setStatus(b.dataset.id, b.dataset.to)));
    el.querySelectorAll("[data-visit]").forEach((b) => b.addEventListener("click", () => {
      const r = byId(b.dataset.visit);
      visitSheet(r.who.id, r.who.full_name, () => setStatus(r.id, "atendida"));
    }));
    el.querySelectorAll("[data-card]").forEach((b) => b.addEventListener("click", () => {
      const r = byId(b.dataset.card);
      const label = r.note && r.note.length <= 60 ? r.note : "un día especial";
      greetSheet({ kind: "especial", key: "pedido:" + r.id, date: r.for_date || today(), label, m: r.who }, () => setStatus(r.id, "atendida"));
    }));
  }

  // ===== pastor: hermanos =====
  let membersCache = [];
  async function viewMembers(el) {
    const { data, error } = await sb.from("kaleos_profiles").select("*").eq("church_id", me.church_id).order("full_name");
    if (error) throw error;
    membersCache = data || [];
    el.innerHTML = `<h2 class="t">Hermanos</h2>
      <button class="btn" id="add">＋ Agregar hermano</button>
      <input class="search" id="q" placeholder="Buscar por nombre o número" aria-label="Buscar">
      <div class="list" id="lst"></div>`;
    const draw = () => {
      const q = $("#q", el).value.trim().toLowerCase();
      const rows = membersCache.filter((m) => !q || m.full_name.toLowerCase().includes(q) || m.member_no.toLowerCase().includes(q));
      $("#lst", el).innerHTML = rows.map((m) => `<button class="item" data-id="${m.id}"><div class="avatar sm">${esc(initials(m.full_name))}</div>
        <div class="grow"><b>${esc(m.full_name)}</b><span>${esc(m.member_no)} · ${esc(STAGE_NAME[m.stage])}${m.role !== "member" ? " · " + ROLE_NAME[m.role] : ""}${m.active ? "" : " · inactivo"}</span></div>›</button>`).join("")
        || '<div class="empty">No hay hermanos con ese nombre.</div>';
      $("#lst", el).querySelectorAll("[data-id]").forEach((b) => b.addEventListener("click", () => openMember(b.dataset.id)));
    };
    $("#q", el).addEventListener("input", draw);
    $("#add", el).addEventListener("click", () => memberForm(null));
    draw();
  }

  function memberFields(m = {}) {
    const opt = (pairs, v) => pairs.map(([k, l]) => `<option value="${k}" ${k === v ? "selected" : ""}>${l}</option>`).join("");
    return `<div class="grid2" style="grid-template-columns:110px 1fr">
        <div class="field"><label for="ftitle">Trato</label><select id="ftitle">${opt([["Hno.", "Hno."], ["Hna.", "Hna."], ["Pastor", "Pastor"], ["Pastora", "Pastora"], ["Joven", "Joven"]], m.title || "Hno.")}</select></div>
        <div class="field"><label for="fname">Nombre completo</label><input id="fname" value="${esc(m.full_name || "")}" required></div></div>
      <div class="grid2">
        <div class="field"><label for="fstage">Etapa</label><select id="fstage">${opt(STAGES, m.stage || "visitante")}</select></div>
        <div class="field"><label for="frole">Función</label><select id="frole">${opt(Object.entries(ROLE_NAME), m.role || "member")}</select></div></div>
      <div class="grid2">
        <div class="field"><label for="fphone">Teléfono</label><input id="fphone" inputmode="tel" value="${esc(m.phone || "")}"></div>
        <div class="field"><label for="fbday">Cumpleaños</label><input id="fbday" type="date" value="${esc(m.birthday || "")}"></div></div>
      <div class="grid2">
        <div class="field"><label for="fsince">Miembro desde</label><input id="fsince" type="date" value="${esc(m.member_since || "")}"></div>
        <div class="field"><label for="fbap">Bautismo</label><input id="fbap" type="date" value="${esc(m.baptism_date || "")}"></div></div>
      <div class="field"><label for="femail">Correo (opcional, para enviarle mensajes)</label><input id="femail" type="email" inputmode="email" value="${esc(m.email || "")}"></div>
      <div class="field"><label for="fchan">Prefiere recibir los mensajes por</label><select id="fchan">${opt(Object.entries(CHANNELS), m.preferred_channel || "whatsapp")}</select></div>
      <div class="field"><label for="fwed">Aniversario de bodas (si es casado)</label><input id="fwed" type="date" value="${esc(m.wedding_date || "")}"></div>
      <div class="field"><label for="fserves">Sirve en</label><input id="fserves" value="${esc(m.serves_in || "")}" placeholder="Damas Dorcas, alabanza, ujieres…"></div>`;
  }
  function readFields(s) {
    const v = (id) => { const x = $("#" + id, s).value.trim(); return x === "" ? null : x; };
    return { title: v("ftitle"), full_name: v("fname"), stage: v("fstage"), role: v("frole"), phone: v("fphone"),
      birthday: v("fbday"), member_since: v("fsince"), baptism_date: v("fbap"), wedding_date: v("fwed"), email: v("femail"), preferred_channel: v("fchan"), serves_in: v("fserves") };
  }

  function memberForm(m) {
    sheet(m ? "Editar hermano" : "Agregar hermano", memberFields(m || {}) +
      (m ? `<label class="row" style="justify-content:flex-start;gap:8px"><input type="checkbox" id="factive" ${m.active ? "checked" : ""}> Activo en Kaleos</label>` : "") +
      `<button class="btn" id="save">${m ? "Guardar cambios" : "Crear tarjeta"}</button>`, (s, close) => {
      $("#save", s).addEventListener("click", async (e) => {
        const f = readFields(s);
        if (!f.full_name) return toast("Escriba el nombre");
        e.currentTarget.disabled = true;
        try {
          if (m) {
            f.active = $("#factive", s).checked;
            if (m.id === me.id && f.role !== "pastor") throw new Error("No puede quitarse a sí mismo la función de pastor");
            const { error } = await sb.from("kaleos_profiles").update(f).eq("id", m.id);
            if (error) throw error;
            toast("Cambios guardados"); close();
            if (m.id === me.id) Object.assign(me, f);
            go("hermanos");
          } else {
            const r = await callAdmin({ action: "create_member", ...f });
            if (r.id) await sb.from("kaleos_profiles").update({ wedding_date: f.wedding_date, email: f.email, preferred_channel: f.preferred_channel }).eq("id", r.id);
            close(); go("hermanos"); credentialsSheet(f.full_name, f.phone, r.member_no, r.pin);
          }
        } catch (err) { e.currentTarget.disabled = false; toast(errMsg(err), 4000); }
      });
    });
  }

  function credentialsSheet(name, phone, no, pin) {
    const msg = `Bendiciones, ${name.split(" ")[0]}. Su tarjeta de membresía de La Línea ya está en Kaleos.\n\nEntre en ${location.origin + location.pathname}\nNúmero de miembro: ${no}\nPIN: ${pin}\n\nGuarde este mensaje.`;
    sheet("Tarjeta lista", `<p style="margin:0">Entréguele estos datos a <b>${esc(name)}</b>. El PIN solo se muestra esta vez.</p>
      <div class="secret"><span class="small">Número de miembro</span><b>${esc(no)}</b><span class="small">PIN</span><b>${esc(pin)}</b></div>
      ${phone ? `<a class="btn ok" style="text-align:center;text-decoration:none" target="_blank" rel="noopener" href="${waLink(phone, msg)}">Enviar por WhatsApp</a>` : ""}
      <button class="btn sec" id="cp">Copiar mensaje</button><button class="btn sec" data-close>Listo</button>`, (s) => {
      $("#cp", s).addEventListener("click", () => navigator.clipboard.writeText(msg).then(() => toast("Mensaje copiado")));
    });
  }

  async function openMember(id) {
    let m = membersCache.find((x) => x.id === id);
    if (!m) { const { data } = await sb.from("kaleos_profiles").select("*").eq("id", id).single(); m = data; }
    if (!m) return;
    const [{ data: att }, { data: vis }] = await Promise.all([
      sb.from("kaleos_attendance").select("service_date").eq("profile_id", id).order("service_date", { ascending: false }).limit(1),
      sb.from("kaleos_visits").select("visited_on, note").eq("profile_id", id).order("visited_on", { ascending: false }).limit(3),
    ]);
    const lastAtt = att && att[0] ? fmtDate(att[0].service_date) : "nunca";
    sheet(m.full_name, `<div class="card" style="box-shadow:none"><div class="whoami" style="margin-top:0"><div class="avatar">${esc(initials(m.full_name))}</div>
        <div><div class="name">${esc(m.title)} ${esc(m.full_name)}</div><div class="role">${esc(STAGE_NAME[m.stage])} · ${ROLE_NAME[m.role]}</div><div class="num">Nº ${esc(m.member_no)}</div></div></div>
        <div class="meta"><div><span>Última asistencia</span><strong>${lastAtt}</strong></div><div><span>Teléfono</span><strong>${esc(m.phone || "—")}</strong></div></div></div>
      ${vis && vis.length ? `<div class="tile"><div class="lab c">Últimas visitas</div>${vis.map((v) => `<div class="row"><span class="grow">${fmtDate(v.visited_on)}${v.note ? " · " + esc(v.note) : ""}</span></div>`).join("")}</div>` : ""}
      <div class="grid2">
        <button class="btn sec" id="ed">Editar</button><button class="btn sec" id="vi">Registrar visita</button>
        ${m.phone ? `<a class="btn sec" style="text-align:center;text-decoration:none" href="tel:${phoneDigits(m.phone)}">Llamar</a>` : ""}
        <button class="btn sec" id="pin">Nuevo PIN</button></div>`, (s, close) => {
      $("#ed", s).addEventListener("click", () => { close(); memberForm(m); });
      $("#vi", s).addEventListener("click", () => { close(); visitSheet(m.id, m.full_name); });
      $("#pin", s).addEventListener("click", async () => {
        if (!confirm(`¿Crear un PIN nuevo para ${m.full_name}? El anterior dejará de funcionar.`)) return;
        try { const r = await callAdmin({ action: "reset_pin", profile_id: m.id }); close(); credentialsSheet(m.full_name, m.phone, r.member_no, r.pin); }
        catch (err) { toast(errMsg(err)); }
      });
    });
  }

  // ===== pastor: saludos (tarjetas personalizadas en nombre del pastor) =====
  const OCCASIONS = {
    cumple: { icon: "🎂", name: "Cumpleaños", tpl: "fiesta" },
    bautismo: { icon: "🕊️", name: "Aniversario de bautismo", tpl: "marfil" },
    iglesia: { icon: "⛪", name: "Aniversario en la iglesia", tpl: "noche" },
    bodas: { icon: "💍", name: "Aniversario de bodas", tpl: "olivo" },
    especial: { icon: "⭐", name: "Fecha especial", tpl: "noche" },
  };
  // Reina-Valera 1960, versos cortos para que quepan en la tarjeta
  const GREET_VERSES = {
    cumple: [
      ["Jehová te bendiga, y te guarde; Jehová haga resplandecer su rostro sobre ti.", "Números 6:24-25"],
      ["Te dé conforme al deseo de tu corazón, y cumpla todo tu consejo.", "Salmos 20:4"],
      ["Este es el día que hizo Jehová; nos gozaremos y alegraremos en él.", "Salmos 118:24"],
      ["Enséñanos de tal modo a contar nuestros días, que traigamos al corazón sabiduría.", "Salmos 90:12"],
      ["Tú coronas el año con tus bienes, y tus nubes destilan grosura.", "Salmos 65:11"],
    ],
    bautismo: [
      ["De modo que si alguno está en Cristo, nueva criatura es; las cosas viejas pasaron; he aquí todas son hechas nuevas.", "2 Corintios 5:17"],
      ["Así también nosotros andemos en vida nueva.", "Romanos 6:4"],
      ["Con Cristo estoy juntamente crucificado, y ya no vivo yo, mas vive Cristo en mí.", "Gálatas 2:20"],
    ],
    iglesia: [
      ["Doy gracias a mi Dios siempre que me acuerdo de vosotros.", "Filipenses 1:3"],
      ["¡Mirad cuán bueno y cuán delicioso es habitar los hermanos juntos en armonía!", "Salmos 133:1"],
      ["Estando persuadido de esto, que el que comenzó en vosotros la buena obra, la perfeccionará.", "Filipenses 1:6"],
    ],
    bodas: [
      ["Y cordón de tres dobleces no se rompe pronto.", "Eclesiastés 4:12"],
      ["Todo lo sufre, todo lo cree, todo lo espera, todo lo soporta.", "1 Corintios 13:7"],
      ["Por tanto, lo que Dios juntó, no lo separe el hombre.", "Marcos 10:9"],
    ],
    especial: [
      ["Grandes cosas ha hecho Jehová con nosotros; estaremos alegres.", "Salmos 126:3"],
      ["Jehová te bendiga, y te guarde.", "Números 6:24"],
      ["Encomienda a Jehová tu camino, y confía en él; y él hará.", "Salmos 37:5"],
    ],
  };
  const addDays = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dayDiff = (a, b) => Math.round((new Date(a + "T12:00:00Z") - new Date(b + "T12:00:00Z")) / 86400000);
  function whenLabel(d) {
    const n = dayDiff(d, today());
    return n === 0 ? "hoy" : n === 1 ? "mañana" : n === -1 ? "ayer" : n > 0 ? `en ${n} días` : `hace ${-n} días`;
  }
  const yrs = (n) => `${n} ${n === 1 ? "año" : "años"}`;
  function hashStr(s) {
    let h = 2166136261;
    for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Fechas de los próximos días (y de los últimos 3, por si quedó alguno sin enviar)
  function occasionsFor(members, specials, from = -3, to = 14) {
    const out = [];
    const t = today();
    for (let i = from; i <= to; i++) {
      const d = addDays(t, i), md = d.slice(5), y = Number(d.slice(0, 4));
      for (const m of members) {
        if (!m.active || m.id === me.id) continue;
        if (m.birthday && String(m.birthday).slice(5, 10) === md) out.push({ kind: "cumple", key: "cumple", date: d, m });
        for (const [kind, f] of [["bautismo", "baptism_date"], ["iglesia", "member_since"], ["bodas", "wedding_date"]]) {
          const v = m[f] && String(m[f]);
          if (v && v.slice(5, 10) === md && y > Number(v.slice(0, 4))) out.push({ kind, key: kind, date: d, m, years: y - Number(v.slice(0, 4)) });
        }
      }
      for (const sp of specials) {
        const m = members.find((x) => x.id === sp.profile_id);
        const v = String(sp.event_date);
        if (!m || !m.active) continue;
        if (sp.yearly ? v.slice(5, 10) === md && y >= Number(v.slice(0, 4)) : v === d) {
          out.push({ kind: "especial", key: "especial:" + sp.id, date: d, m, label: sp.label, years: sp.yearly ? y - Number(v.slice(0, 4)) : 0 });
        }
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.m.full_name.localeCompare(b.m.full_name));
  }

  const greetSignature = () => church.greeting_signature || `${me.title || "Pastor"} ${me.full_name}`;
  const churchShort = () => church.short_name || church.name || "La Línea";

  function cardText(o, vi = 0) {
    const n = o.years;
    const T = {
      cumple: [fmtDate(o.date, "dm"), "¡Feliz cumpleaños!", "Damos gracias a Dios por su vida"],
      bautismo: ["Aniversario de bautismo", "Vida nueva", `${yrs(n)} de su bautismo`],
      iglesia: ["Aniversario en la iglesia", "¡Gracias!", `${yrs(n)} siendo parte de nuestra familia`],
      bodas: ["Aniversario de bodas", "¡Feliz aniversario!", `${yrs(n)} de matrimonio junto a su ${/^(Hna\.|Pastora)$/.test(o.m.title || "") ? "esposo" : "esposa"}`],
      especial: [o.label || "Fecha especial", "¡Felicidades!", n > 0 ? `${yrs(n)} de este día especial` : "Celebramos con usted este día"],
    }[o.kind];
    const vs = GREET_VERSES[o.kind];
    const v = vs[(hashStr(o.m.id + o.date) + vi) % vs.length];
    return { kicker: T[0], headline: T[1], line: T[2], name: `${o.m.title ? o.m.title + " " : ""}${o.m.full_name}`,
      verse: v[0], ref: v[1], date: o.date, signature: greetSignature(), from: `y toda la familia de ${churchShort()}`,
      church: `Iglesia de Dios E.C. · ${churchShort()}`, seed: o.m.id + o.key + o.date };
  }

  function greetMessage(o) {
    const first = o.m.full_name.split(" ")[0], sig = greetSignature(), igl = churchShort();
    const n = o.years;
    return {
      cumple: `¡Feliz cumpleaños, ${first}! 🎂\n\nHoy damos gracias a Dios por su vida. Que el Señor le bendiga y le guarde en este nuevo año.\n\nCon cariño,\n${sig} y la familia de ${igl}`,
      bautismo: `¡Bendiciones, ${first}! 🕊️\n\nHoy se cumplen ${yrs(n)} de su bautismo. Damos gracias a Dios por su fidelidad y por la vida nueva que tiene en Cristo.\n\nCon cariño,\n${sig}`,
      iglesia: `${first}, hoy cumple ${yrs(n)} siendo parte de la familia de ${igl}. ⛪\n\nGracias por su fidelidad, su servicio y su cariño. Que Dios le siga bendiciendo.\n\nCon cariño,\n${sig}`,
      bodas: `¡Feliz aniversario de bodas, ${first}! 💍\n\nHoy celebramos ${yrs(n)} de matrimonio. Que el Señor siga siendo el centro de su hogar.\n\nCon cariño,\n${sig} y la familia de ${igl}`,
      especial: `¡Felicidades, ${first}! ⭐\n\nHoy celebramos con usted: ${o.label || "un día especial"}. Que Dios le bendiga grandemente.\n\nCon cariño,\n${sig}`,
    }[o.kind];
  }

  // ----- dibujo de la tarjeta (1080 × 1350, formato ideal para WhatsApp) -----
  const CW = 1080, CH = 1350;
  const GOLD = "#C9A55C", GOLD_L = "#E8D3A0", GOLD_D = "#A8843A";
  const SERIF = '"Cormorant Garamond", Georgia, serif', SCRIPT = '"Mr Dafoe", "Brush Script MT", cursive', SANS = "Archivo, Arial, sans-serif";
  let cardAssets = null;
  const loadImg = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });
  async function cardReady() {
    if (cardAssets) return cardAssets;
    try {
      await Promise.all([`600 80px ${SERIF}`, `italic 500 40px ${SERIF}`, `80px ${SCRIPT}`, `700 30px ${SANS}`, `800 30px ${SANS}`]
        .map((f) => document.fonts.load(f)));
    } catch (_) {}
    const [logo, markW] = await Promise.all(["./img/logo.png", "./img/mark-w.png"].map(loadImg));
    return (cardAssets = { logo, markW });
  }

  function wrapLines(ctx, text, maxW) {
    const lines = [];
    let cur = "";
    for (const w of String(text).split(/\s+/)) {
      const t = cur ? cur + " " + w : w;
      if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function fitFont(ctx, text, font, size, maxW, maxLines, minSize) {
    for (let sz = size; sz > minSize; sz -= 4) {
      ctx.font = font(sz);
      const l = wrapLines(ctx, text, maxW);
      if (l.length <= maxLines && l.every((x) => ctx.measureText(x).width <= maxW)) return { size: sz, lines: l };
    }
    ctx.font = font(minSize);
    return { size: minSize, lines: wrapLines(ctx, text, maxW) };
  }
  // Texto con espaciado entre letras (no todos los navegadores tienen letterSpacing en canvas)
  function spaced(ctx, text, x, y, sp, align = "center") {
    const chars = [...text];
    const w = chars.reduce((a, c) => a + ctx.measureText(c).width, 0) + sp * (chars.length - 1);
    let cx = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    const prev = ctx.textAlign;
    ctx.textAlign = "left";
    for (const c of chars) { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + sp; }
    ctx.textAlign = prev;
  }
  function diamond(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
  }
  const ruleCenter = (color) => (ctx, x, y) => {
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 170, y); ctx.lineTo(x - 22, y); ctx.moveTo(x + 22, y); ctx.lineTo(x + 170, y); ctx.stroke();
    diamond(ctx, x, y, 8, color);
  };
  const ruleLeft = (color) => (ctx, x, y) => {
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 170, y); ctx.stroke();
    diamond(ctx, x + 190, y, 8, color);
  };

  // Acomoda el texto: primero mide, luego lo centra en el espacio disponible
  function runFlow(ctx, c, o, dry, y0) {
    const put = (t, x, y) => { if (!dry) ctx.fillText(t, x, y); };
    let y = y0;
    ctx.textAlign = o.align; ctx.textBaseline = "alphabetic";
    ctx.font = `700 25px ${SANS}`; ctx.fillStyle = o.kicker;
    y += 25; if (!dry) spaced(ctx, c.kicker.toUpperCase(), o.x, y, 7, o.align);
    const h = fitFont(ctx, c.headline, (sz) => `${sz}px ${SCRIPT}`, o.headSize || 132, o.maxW, 1, 76);
    ctx.font = `${h.size}px ${SCRIPT}`; ctx.fillStyle = o.head;
    y += h.size; put(h.lines[0], o.x, y);
    y += Math.round(h.size * 0.38) + 6; if (!dry && o.rule) o.rule(ctx, o.x, y); y += 22;
    const nm = fitFont(ctx, c.name, (sz) => `600 ${sz}px ${SERIF}`, 88, o.maxW, 2, 54);
    ctx.font = `600 ${nm.size}px ${SERIF}`; ctx.fillStyle = o.name;
    for (const l of nm.lines) { y += nm.size; put(l, o.x, y); }
    ctx.font = `italic 500 42px ${SERIF}`; ctx.fillStyle = o.line; y += 8;
    for (const l of wrapLines(ctx, c.line, o.maxW)) { y += 50; put(l, o.x, y); }
    y += 46;
    const vx = o.verseX ?? o.x, vTop = y;
    ctx.font = `italic 500 36px ${SERIF}`; ctx.fillStyle = o.verse;
    for (const l of wrapLines(ctx, `«${c.verse}»`, o.verseW || o.maxW)) { y += 46; put(l, vx, y); }
    y += 42; ctx.font = `700 19px ${SANS}`; ctx.fillStyle = o.ref;
    if (!dry) spaced(ctx, c.ref.toUpperCase(), vx, y, 5, o.align);
    if (!dry && o.bar) o.bar(ctx, vTop + 14, y + 6);
    return y - y0 + 6;
  }
  function composeText(ctx, c, o) {
    const h = runFlow(ctx, c, o, true, 0);
    runFlow(ctx, c, o, false, o.top + Math.max(0, (o.bottom - o.top - h) / 2));
  }
  function drawSig(ctx, c, x, align, col, sub, y = CH - 190) {
    ctx.textAlign = align; ctx.fillStyle = col;
    const f = fitFont(ctx, c.signature, (sz) => `${sz}px ${SCRIPT}`, 76, 780, 1, 44);
    ctx.font = `${f.size}px ${SCRIPT}`; ctx.fillText(c.signature, x, y);
    ctx.font = `700 18px ${SANS}`; ctx.fillStyle = sub;
    spaced(ctx, c.from.toUpperCase(), x, y + 50, 5, align);
  }
  function drawLogo(ctx, img, x, y, h, align = "center") {
    const w = (img.width * h) / img.height;
    ctx.drawImage(img, align === "center" ? x - w / 2 : x, y, w, h);
  }
  function archPath(ctx, x, y, w, h) {
    const r = w / 2;
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + r);
    ctx.arc(x + r, y + r, r, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath();
  }
  // Rama de olivo: tallo curvo con hojas alternadas
  function olive(ctx, R, p0, p1, p2, leaf, stem) {
    ctx.strokeStyle = stem; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]); ctx.stroke();
    let side = 1;
    for (let t = 0.1; t < 0.97; t += 0.075) {
      const u = 1 - t;
      const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
      const dx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]), dy = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
      const len = 78 - t * 34 + R() * 10;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(dy, dx) + side * (0.7 + R() * 0.15));
      ctx.beginPath(); ctx.ellipse(len / 2, 0, len / 2, len * 0.17, 0, 0, Math.PI * 2);
      ctx.fillStyle = R() < 0.22 ? "rgba(201,165,92,.75)" : leaf; ctx.fill();
      ctx.restore();
      side = -side;
    }
  }

  const TEMPLATES = {
    noche: { name: "Noche", draw(ctx, c, a) {
      const g = ctx.createRadialGradient(CW / 2, CH * 0.42, 80, CW / 2, CH / 2, CH * 0.78);
      g.addColorStop(0, "#2A3866"); g.addColorStop(1, "#121831");
      ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
      ctx.save(); ctx.globalAlpha = 0.05; ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.moveTo(CW * 0.58, 0); ctx.lineTo(CW * 0.7, 0); ctx.lineTo(CW * 0.2, CH); ctx.lineTo(CW * 0.08, CH); ctx.fill(); ctx.restore();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.strokeRect(54, 54, CW - 108, CH - 108);
      ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5; ctx.strokeRect(72, 72, CW - 144, CH - 144); ctx.globalAlpha = 1;
      for (const [x, y] of [[54, 54], [CW - 54, 54], [54, CH - 54], [CW - 54, CH - 54]]) diamond(ctx, x, y, 13, GOLD);
      drawLogo(ctx, a.markW, CW / 2, 118, 104);
      ctx.font = `700 20px ${SANS}`; ctx.fillStyle = GOLD_L; spaced(ctx, c.church.toUpperCase(), CW / 2, 262, 6);
      composeText(ctx, c, { x: CW / 2, align: "center", maxW: 860, verseW: 780, top: 300, bottom: 1085,
        kicker: GOLD, head: "#fff", name: "#fff", line: "rgba(255,255,255,.82)", verse: GOLD_L, ref: GOLD, rule: ruleCenter(GOLD) });
      drawSig(ctx, c, CW / 2, "center", "#fff", GOLD_L);
    } },
    marfil: { name: "Marfil", draw(ctx, c, a, R) {
      ctx.fillStyle = "#F3EDE1"; ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = "rgba(120,96,50,.06)";
      for (let i = 0; i < 1600; i++) ctx.fillRect(R() * CW, R() * CH, 1.8, 1.8);
      const ax = 96, ay = 90, aw = CW - 192, ah = CH - 180;
      ctx.save(); ctx.shadowColor = "rgba(30,39,71,.16)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 14;
      archPath(ctx, ax, ay, aw, ah); ctx.fillStyle = "#FFFDF8"; ctx.fill(); ctx.restore();
      ctx.save(); archPath(ctx, ax, ay, aw, ah); ctx.clip();
      ctx.strokeStyle = "rgba(31,91,196,.07)"; ctx.lineWidth = 2;
      const rays = 30 + Math.floor(R() * 8);
      for (let k = 0; k <= rays; k++) {
        const ang = Math.PI * (0.08 + (0.84 * k) / rays);
        ctx.beginPath(); ctx.moveTo(CW / 2, ay - 60); ctx.lineTo(CW / 2 + Math.cos(ang) * 1800, ay - 60 + Math.sin(ang) * 1800); ctx.stroke();
      }
      ctx.restore();
      archPath(ctx, ax, ay, aw, ah); ctx.strokeStyle = "#1F5BC4"; ctx.lineWidth = 3; ctx.stroke();
      archPath(ctx, ax + 18, ay + 18, aw - 36, ah - 36); ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5; ctx.stroke();
      drawLogo(ctx, a.logo, CW / 2, 175, 92);
      composeText(ctx, c, { x: CW / 2, align: "center", maxW: 720, verseW: 690, top: 300, bottom: 1060,
        kicker: "#1F5BC4", head: "#1F5BC4", name: "#1E2747", line: "#5E6782", verse: "#3E5BA9", ref: GOLD_D, rule: ruleCenter(GOLD) });
      drawSig(ctx, c, CW / 2, "center", "#1E2747", GOLD_D, CH - 210);
    } },
    fiesta: { name: "Fiesta", draw(ctx, c, a, R) {
      const g = ctx.createLinearGradient(0, 0, CW, CH);
      g.addColorStop(0, "#2468D6"); g.addColorStop(0.5, "#3E5BA9"); g.addColorStop(1, "#1E2747");
      ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = "rgba(255,255,255,.08)";
      for (const [a0, a1] of [[0.48, 0.56], [0.74, 0.77]]) {
        ctx.beginPath(); ctx.moveTo(CW * a0 + 300, 0); ctx.lineTo(CW * a1 + 300, 0); ctx.lineTo(CW * a1 - 500, CH); ctx.lineTo(CW * a0 - 500, CH); ctx.fill();
      }
      const cols = [GOLD, GOLD_L, "#fff", "#9DB7E8"];
      for (let i = 0; i < 110; i++) {
        const top = R() < 0.55;
        const x = R() * CW, y = top ? R() * 300 : CH - R() * 100;
        if (top && x > CW - 290 && y > 70 && y < 280) continue;
        ctx.save(); ctx.translate(x, y); ctx.rotate(R() * Math.PI); ctx.globalAlpha = 0.55 + R() * 0.45;
        ctx.fillStyle = cols[Math.floor(R() * cols.length)];
        const sz = 7 + R() * 14;
        if (R() < 0.35) { ctx.beginPath(); ctx.arc(0, 0, sz / 2.4, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(-sz / 2, -sz / 5, sz, sz / 2.5);
        ctx.restore();
      }
      drawLogo(ctx, a.markW, 110, 96, 96, "left");
      const [, mm, dd] = c.date.split("-").map(Number);
      ctx.beginPath(); ctx.arc(CW - 170, 172, 84, 0, Math.PI * 2); ctx.fillStyle = GOLD; ctx.fill();
      ctx.beginPath(); ctx.arc(CW - 170, 172, 72, 0, Math.PI * 2); ctx.strokeStyle = "rgba(30,39,71,.35)"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "#1E2747"; ctx.textAlign = "center"; ctx.font = `800 64px ${SANS}`; ctx.fillText(String(dd), CW - 170, 188);
      ctx.font = `700 18px ${SANS}`; spaced(ctx, MONTHS_S[mm - 1].replace(".", "").toUpperCase(), CW - 170, 218, 4);
      composeText(ctx, c, { x: CW / 2, align: "center", maxW: 880, verseW: 800, top: 300, bottom: 1080, headSize: 150,
        kicker: GOLD_L, head: "#fff", name: "#fff", line: "rgba(255,255,255,.86)", verse: "#DCE6FA", ref: GOLD_L, rule: ruleCenter(GOLD_L) });
      drawSig(ctx, c, CW / 2, "center", "#fff", GOLD_L);
    } },
    olivo: { name: "Olivo", draw(ctx, c, a, R) {
      ctx.fillStyle = "#FBFAF6"; ctx.fillRect(0, 0, CW, CH);
      ctx.strokeStyle = "rgba(30,39,71,.10)"; ctx.lineWidth = 2; ctx.strokeRect(40, 40, CW - 80, CH - 80);
      olive(ctx, R, [CW + 30, 360], [CW - 110, 90], [CW - 440, 30], "rgba(126,145,112,.85)", "#7E9170");
      olive(ctx, R, [CW + 30, CH - 400], [CW - 60, CH - 90], [CW - 360, CH + 20], "rgba(126,145,112,.7)", "#7E9170");
      drawLogo(ctx, a.logo, 120, 100, 84, "left");
      const X = 120;
      composeText(ctx, c, { x: X, align: "left", maxW: 760, verseX: X + 34, verseW: 700, top: 260, bottom: 1080,
        kicker: GOLD_D, head: "#1F5BC4", name: "#1E2747", line: "#5E6782", verse: "#3E5BA9", ref: GOLD_D, rule: ruleLeft(GOLD),
        bar: (cx, y0, y1) => { cx.fillStyle = GOLD; cx.fillRect(X, y0 - 30, 4, y1 - y0 + 14); } });
      drawSig(ctx, c, X, "left", "#1E2747", GOLD_D);
    } },
  };

  function renderCard(canvas, tpl, c) {
    canvas.width = CW; canvas.height = CH;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CW, CH);
    TEMPLATES[tpl].draw(ctx, c, cardAssets, rng(hashStr(c.seed)));
  }

  async function logGreeting(o, tpl, message) {
    const { error } = await sb.from("kaleos_greetings").upsert({ church_id: me.church_id, profile_id: o.m.id, occasion: o.key,
      occasion_date: o.date, template: tpl, message, sent_by: me.id, sent_at: new Date().toISOString() }, { onConflict: "profile_id,occasion,occasion_date" });
    if (error) throw error;
  }

  // Cómo prefiere recibir cada hermano lo que envía el pastor (lo elige él mismo en «Mis datos»)
  const CHANNELS = { whatsapp: "WhatsApp", correo: "Correo", app: "Solo en Kaleos" };
  // Medio real para un hermano: su preferido si tiene el dato; si no, el que tenga; si no, solo Kaleos
  function channelFor(m) {
    const has = { whatsapp: !!(m && m.phone), correo: !!(m && m.email), app: true };
    const pref = (m && m.preferred_channel) || "whatsapp";
    if (has[pref]) return pref;
    return has.whatsapp ? "whatsapp" : has.correo ? "correo" : "app";
  }
  function deliveryNote(to, all) {
    if (to) {
      const ch = channelFor(to);
      return `Le llega a ${esc(to.full_name.split(" ")[0])} en su app de Kaleos` +
        (ch === "whatsapp" ? ` y por <b>WhatsApp</b> (${esc(to.phone)}).` : ch === "correo" ? ` y por <b>correo</b> (${esc(to.email)}).` : ".");
    }
    const mail = all.filter((m) => channelFor(m) === "correo").length;
    return `Le llega a toda la iglesia en la app de Kaleos y usted lo comparte en la <b>comunidad de WhatsApp</b>` +
      (mail ? `; luego se abre el correo para ${mail} ${mail === 1 ? "hermano que prefiere" : "hermanos que prefieren"} correo.` : ".");
  }

  // Hoja de envío común: vista previa de la tarjeta, mensaje y un solo botón «Enviar»
  async function sendSheet(opt) {
    try { await cardReady(); } catch (_) { return toast("No se pudo preparar la tarjeta. Revise la conexión."); }
    let to0 = opt.to || null;
    if (to0) { // datos al día del hermano (teléfono, correo, medio preferido)
      const { data } = await sb.from("kaleos_profiles").select("*").eq("id", to0.id).maybeSingle();
      if (data) to0 = data;
    }
    let tpl = opt.tpl, vi = 0, file = null, msgEdited = false;
    const slug = (to0 ? to0.full_name.split(" ")[0] : opt.fileName || "kaleos").normalize("NFD").replace(/[^\w]/g, "").toLowerCase() || "kaleos";
    const fname = `tarjeta-${slug}.png`;
    sheet(opt.title, `${opt.sub || ""}${opt.extraHtml || ""}
      <canvas class="gcard" aria-label="Vista previa de la tarjeta"></canvas>
      <div class="chips">${Object.entries(TEMPLATES).map(([k, t]) => `<button class="chip" data-tpl="${k}">${t.name}</button>`).join("")}
        <button class="chip" id="ov">↻ Otro versículo</button></div>
      <div class="field"><label for="gm">Mensaje que acompaña la tarjeta</label><textarea id="gm" rows="7"></textarea></div>
      ${opt.sent ? `<div class="result"><div class="dot">✓</div><div>Ya se envió<div class="small">${new Date(opt.sent).toLocaleString("es-GT", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" })}</div></div></div>` : ""}
      <button class="btn ok big-send" id="go">Enviar</button>
      <div class="small" id="how" style="text-align:center"></div>
      <button class="linkish" id="gd">Descargar la imagen</button>`, (s, close) => {
      const cv = $(".gcard", s), gm = $("#gm", s);
      const target = () => (opt.target ? opt.target(s) : to0);
      const draw = () => {
        file = null;
        renderCard(cv, tpl, opt.card(vi, s));
        s.querySelectorAll("[data-tpl]").forEach((b) => b.classList.toggle("on", b.dataset.tpl === tpl));
        cv.toBlob((b) => { if (b) file = new File([b], fname, { type: "image/png" }); }, "image/png");
        if (!msgEdited) gm.value = opt.message(s);
        $("#how", s).innerHTML = deliveryNote(target(), opt.recipients || []);
      };
      const download = () => {
        if (!file) return toast("Un momento, la tarjeta se está preparando…");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file); a.download = file.name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      };
      const share = async (text, phone) => {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], text }); } catch (err) { if (err.name !== "AbortError") toast(errMsg(err), 4000); }
          return;
        }
        // Computadora: se descarga la imagen y se abre el chat con el mensaje escrito
        download();
        window.open(phone ? waLink(phone, text) : `https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
      };
      const mail = (emails, bcc, text) => {
        const body = `${text}\n\nVea la tarjeta en Kaleos: ${location.origin + location.pathname}`;
        const subject = opt.msgTitle(s) + " · " + churchShort();
        location.href = `mailto:${bcc ? "" : encodeURIComponent(emails[0])}?${bcc ? "bcc=" + encodeURIComponent(emails.join(",")) + "&" : ""}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      };
      gm.addEventListener("input", () => { msgEdited = true; });
      s.querySelectorAll("[data-tpl]").forEach((b) => b.addEventListener("click", () => { tpl = b.dataset.tpl; draw(); }));
      $("#ov", s).addEventListener("click", () => { vi++; draw(); });
      $("#gd", s).addEventListener("click", download);
      if (opt.bind) opt.bind(s, draw);
      $("#go", s).addEventListener("click", async (e) => {
        if (!file) return toast("Un momento, la tarjeta se está preparando…");
        const btn = e.currentTarget, to = target(), text = gm.value;
        btn.disabled = true;
        // 1) Siempre queda en el buzón «Mensajes» de la app
        const { error } = await sb.from("kaleos_messages").insert({ church_id: me.church_id, profile_id: to ? to.id : null,
          kind: opt.kind(s), title: opt.msgTitle(s), body: text, card: { tpl, c: opt.card(vi, s) },
          event_at: opt.eventAt ? opt.eventAt(s) : null, created_by: me.id });
        if (error) { btn.disabled = false; return toast(errMsg(error), 4000); }
        // 2) Además, por el medio que cada hermano prefiere
        if (to) {
          const ch = channelFor(to);
          if (ch === "whatsapp") await share(text, to.phone);
          else if (ch === "correo") mail([to.email], false, text);
        } else {
          await share(text, null);
          const emails = (opt.recipients || []).filter((m) => channelFor(m) === "correo").map((m) => m.email);
          if (emails.length) mail(emails, true, text);
        }
        if (opt.log) { try { await opt.log(tpl, text); } catch (err) { toast(errMsg(err), 4000); } }
        toast(to ? `Enviado a ${to.full_name.split(" ")[0]}` : "Enviado a toda la iglesia");
        close(); if (opt.after) opt.after();
      });
      draw();
    });
  }

  function greetSheet(o, after) {
    return sendSheet({
      title: `${OCCASIONS[o.kind].icon} ${o.m.full_name}`,
      sub: `<div class="small">${esc(o.label || OCCASIONS[o.kind].name)}${o.years ? " · " + yrs(o.years) : ""} · ${fmtDate(o.date, "dm")} (${whenLabel(o.date)})</div>`,
      tpl: OCCASIONS[o.kind].tpl, to: o.m, sent: o.sent, after,
      card: (vi) => cardText(o, vi), message: () => greetMessage(o),
      kind: () => "felicitacion", msgTitle: () => o.label || OCCASIONS[o.kind].name,
      log: (tpl, text) => logGreeting(o, tpl, text),
    });
  }

  // Invitaciones, recordatorios, avisos y felicitaciones libres (a un hermano o a toda la iglesia)
  const KINDS = {
    invitacion: { name: "Invitación", icon: "📣", head: "¡Le invitamos!", tpl: "noche" },
    recordatorio: { name: "Recordatorio", icon: "⏰", head: "No lo olvide", tpl: "marfil" },
    felicitacion: { name: "Felicitación", icon: "🎉", head: "¡Felicidades!", tpl: "fiesta" },
    aviso: { name: "Aviso", icon: "📢", head: "Aviso importante", tpl: "olivo" },
  };
  function fmtWhen(v) {
    if (!v) return "";
    const d = new Date(v);
    return d.toLocaleString("es-GT", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
  }
  function composeSheet(members) {
    const active = members.filter((m) => m.active).sort((a, b) => a.full_name.localeCompare(b.full_name));
    const val = (s, id) => $("#" + id, s).value.trim();
    const target = (s) => active.find((m) => m.id === $("#mto", s).value) || null;
    let headEdited = false;
    const card = (vi, s) => {
      const k = val(s, "mkind"), when = val(s, "mwhen"), where = val(s, "mwhere");
      const vs = GREET_VERSES.especial;
      const v = vs[(hashStr(val(s, "mwhat")) + vi) % vs.length];
      return { kicker: KINDS[k].name, headline: val(s, "mhead") || KINDS[k].head, name: val(s, "mwhat") || "Escriba aquí el motivo",
        line: [fmtWhen(when), where].filter(Boolean).join(" · ") || churchShort(), verse: v[0], ref: v[1],
        date: when ? when.slice(0, 10) : today(), signature: greetSignature(), from: `y toda la familia de ${churchShort()}`,
        church: `Iglesia de Dios E.C. · ${churchShort()}`, seed: k + val(s, "mwhat") };
    };
    const message = (s) => {
      const k = val(s, "mkind"), to = target(s), when = val(s, "mwhen"), where = val(s, "mwhere");
      return `${to ? `Hola, ${to.full_name.split(" ")[0]}. ` : "Querida familia de " + churchShort() + ": "}${KINDS[k].icon} ${val(s, "mhead") || KINDS[k].head}\n\n` +
        `${val(s, "mwhat") || ""}\n${when ? "🗓️ " + fmtWhen(when) + "\n" : ""}${where ? "📍 " + where + "\n" : ""}\nCon cariño,\n${greetSignature()}`;
    };
    return sendSheet({
      title: "✉️ Nuevo mensaje",
      extraHtml: `<div class="grid2">
          <div class="field"><label for="mkind">Tipo</label><select id="mkind">${Object.entries(KINDS).map(([k, x]) => `<option value="${k}">${x.icon} ${x.name}</option>`).join("")}</select></div>
          <div class="field"><label for="mto">Para</label><select id="mto"><option value="">Toda la iglesia</option>${active.map((m) => `<option value="${m.id}">${esc(m.full_name)}</option>`).join("")}</select></div></div>
        <div class="field"><label for="mwhat">¿Qué? (aparece grande en la tarjeta)</label><input id="mwhat" placeholder="Vigilia de oración, culto de jóvenes, Santa Cena…"></div>
        <div class="grid2"><div class="field"><label for="mwhen">¿Cuándo? (opcional)</label><input id="mwhen" type="datetime-local"></div>
          <div class="field"><label for="mwhere">¿Dónde? (opcional)</label><input id="mwhere" placeholder="Templo La Línea"></div></div>
        <div class="field"><label for="mhead">Frase de la tarjeta</label><input id="mhead" value="${esc(KINDS.invitacion.head)}"></div>`,
      tpl: KINDS.invitacion.tpl, fileName: "mensaje", recipients: active,
      target,
      card, message,
      kind: (s) => val(s, "mkind"), msgTitle: (s) => val(s, "mwhat") || KINDS[val(s, "mkind")].name,
      eventAt: (s) => (val(s, "mwhen") ? new Date(val(s, "mwhen")).toISOString() : null),
      after: () => go("saludos"),
      bind: (s, draw) => {
        $("#mkind", s).addEventListener("change", () => {
          if (!headEdited) $("#mhead", s).value = KINDS[val(s, "mkind")].head;
          s.querySelectorAll("[data-tpl]").forEach((b) => { if (b.dataset.tpl === KINDS[val(s, "mkind")].tpl) b.click(); });
          draw();
        });
        $("#mhead", s).addEventListener("input", () => { headEdited = true; });
        let t = 0;
        for (const id of ["mto", "mwhat", "mwhen", "mwhere", "mhead"]) {
          $("#" + id, s).addEventListener("input", () => { clearTimeout(t); t = setTimeout(draw, 250); });
          $("#" + id, s).addEventListener("change", draw);
        }
      },
    });
  }

  function specialSheet(members, after) {
    const opts = members.filter((m) => m.active).sort((a, b) => a.full_name.localeCompare(b.full_name))
      .map((m) => `<option value="${m.id}">${esc(m.full_name)}</option>`).join("");
    sheet("Fecha especial", `<div class="field"><label for="sm">Hermano</label><select id="sm">${opts}</select></div>
      <div class="field"><label for="sl">¿Qué celebramos?</label><input id="sl" list="sll" placeholder="Graduación, nacimiento de su bebé…">
        <datalist id="sll"><option value="Graduación"><option value="Nacimiento de su bebé"><option value="Quince años de su hija">
        <option value="Recuperación de su salud"><option value="Nuevo trabajo"><option value="Aniversario de su ministerio"></datalist></div>
      <div class="field"><label for="sd">Fecha</label><input id="sd" type="date" value="${today()}"></div>
      <label class="row" style="justify-content:flex-start;gap:8px"><input type="checkbox" id="sy"> Se repite cada año</label>
      <button class="btn" id="ss">Guardar</button>`, (s, close) => {
      $("#ss", s).addEventListener("click", async () => {
        const label = $("#sl", s).value.trim(), date = $("#sd", s).value;
        if (!label || !date) return toast("Escriba qué celebramos y la fecha");
        const { error } = await sb.from("kaleos_special_dates").insert({ church_id: me.church_id, profile_id: $("#sm", s).value,
          label, event_date: date, yearly: $("#sy", s).checked, created_by: me.id });
        if (error) return toast(errMsg(error), 4000);
        toast("Fecha guardada"); close(); if (after) after();
      });
    });
  }

  async function viewGreetings(el) {
    const [{ data: members, error }, sp, gr] = await Promise.all([
      sb.from("kaleos_profiles").select("*").eq("church_id", me.church_id),
      sb.from("kaleos_special_dates").select("*").eq("church_id", me.church_id),
      sb.from("kaleos_greetings").select("profile_id, occasion, occasion_date, sent_at").eq("church_id", me.church_id).gte("occasion_date", addDays(today(), -7)),
    ]);
    if (error) throw error;
    const ready = !sp.error && !gr.error;
    const sent = new Map((gr.data || []).map((g) => [`${g.profile_id}|${g.occasion}|${g.occasion_date}`, g.sent_at]));
    const list = occasionsFor(members || [], sp.data || []).map((o) => ({ ...o, sent: sent.get(`${o.m.id}|${o.key}|${o.date}`) }));
    const pending = list.filter((o) => !o.sent).length;
    el.innerHTML = `<h2 class="t">Saludos del pastor</h2>
      <div class="small">Tarjetas para cumpleaños, aniversarios, invitaciones y recordatorios. Usted revisa cada una y la envía por WhatsApp, correo o a la app de los hermanos.</div>
      <button class="btn" id="newmsg">✉️ Nuevo mensaje: invitación, recordatorio o aviso</button>
      ${ready ? "" : `<div class="tile"><b>Falta activar Saludos en la base de datos.</b><span class="muted">Puede preparar tarjetas, pero aún no se guardan las fechas especiales ni cuáles ya se enviaron.</span></div>`}
      <div class="tile"><div class="lab c">Próximos 14 días${pending ? ` · ${pending} por enviar` : ""}</div>
        ${list.length ? list.map((o, i) => `<div class="row"><span class="grow">${OCCASIONS[o.kind].icon} <b>${esc(o.m.full_name)}</b>
          <span class="small" style="display:block">${esc(o.label || OCCASIONS[o.kind].name)}${o.years ? " · " + yrs(o.years) : ""} · ${fmtDate(o.date, "dm")} (${whenLabel(o.date)})</span></span>
          <button class="pill ${o.sent ? "g" : "solid"}" data-i="${i}">${o.sent ? "Enviado ✓" : "Preparar"}</button></div>`).join("")
          : `<div class="empty">No hay fechas en los próximos 14 días.</div>`}
      </div>
      <button class="btn sec" id="addsp">＋ Agregar fecha especial</button>
      <div class="tile"><div class="lab r">Firma de las tarjetas</div>
        <div class="field"><label for="sig">Así aparece al pie de cada tarjeta</label><input id="sig" value="${esc(greetSignature())}"></div>
        <button class="btn sm" id="ssig">Guardar firma</button></div>
      <div class="small">Consejo: agregue el aniversario de bodas en la ficha de cada hermano (Hermanos › Editar).</div>`;
    el.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => greetSheet(list[b.dataset.i], () => go("saludos"))));
    $("#newmsg", el).addEventListener("click", () => composeSheet(members || []));
    $("#addsp", el).addEventListener("click", () => specialSheet(members || [], () => go("saludos")));
    $("#ssig", el).addEventListener("click", async () => {
      const v = $("#sig", el).value.trim() || null;
      const { data, error: e } = await sb.from("kaleos_churches").update({ greeting_signature: v }).eq("id", me.church_id).select().single();
      if (e) return toast(errMsg(e), 4000);
      church = data; toast("Firma guardada");
    });
  }

  // ===== pastor: reporte =====
  async function viewReport(el, monthStr) {
    const month = monthStr || today().slice(0, 7);
    const { data: r, error } = await sb.rpc("kaleos_month_report", { p_month: month + "-01" });
    if (error) throw error;
    const { data: saved } = await sb.from("kaleos_reports").select("sent_at").eq("church_id", me.church_id).eq("month", month + "-01").maybeSingle();
    const mName = `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
    const rows = [["Asistencia promedio", r.attendance_avg], ["Cultos registrados", r.services], ["Nuevos miembros", r.new_members],
      ["Bautismos", r.baptisms], ["Visitas pastorales", r.visits], ["Nuevos líderes", r.new_leaders],
      ["Peticiones de oración", r.prayers], ["Hermanos en Kaleos", r.members_total]];
    const text = `REPORTE MINISTERIAL · ${mName.toUpperCase()}\n${church.name}\n\n` + rows.map(([l, v]) => `${l}: ${v}`).join("\n") +
      `\n\nPastor: ${me.full_name}\nGenerado con Kaleos`;
    el.innerHTML = `<div class="row noprint"><h2 class="t">Reporte mensual</h2>
        <input type="month" id="m" value="${month}" class="search" style="width:auto;padding:8px" aria-label="Mes"></div>
      <div class="small noprint">Se arma solo con lo registrado en Kaleos.</div>
      <div class="report"><div class="rh"><img src="./img/logo.png" alt=""><h5>REPORTE<br>MINISTERIAL</h5></div>
        <div class="small" style="text-transform:capitalize">${esc(mName)} · ${esc(church.short_name || church.name)}</div>
        ${rows.map(([l, v]) => `<div class="r">${l} <b>${v}</b></div>`).join("")}
        <div class="small" style="margin-top:6px">Pastor: ${esc(me.full_name)}</div>
      </div>
      ${saved && saved.sent_at ? `<div class="result noprint"><div class="dot">✓</div><div>Enviado al ${esc(church.supervisor_name || "Supervisor de Distrito")}<div class="small">${new Date(saved.sent_at).toLocaleString("es-GT", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" })}</div></div></div>` : ""}
      <div class="noprint" style="display:flex;flex-direction:column;gap:10px">
        <button class="btn" id="send">Enviar al ${esc(church.supervisor_name || "Supervisor de Distrito")}</button>
        <button class="btn sec" id="pr">Imprimir o guardar PDF</button></div>`;
    $("#m", el).addEventListener("change", (e) => { if (e.target.value) viewReport(el, e.target.value); });
    $("#pr", el).addEventListener("click", () => window.print());
    $("#send", el).addEventListener("click", () => {
      const subject = `Reporte ministerial ${mName} · ${church.short_name || church.name}`;
      sheet("Enviar reporte", `<p style="margin:0">Elija cómo enviarlo. Kaleos lo deja marcado como enviado.</p>
        <a class="btn ok" style="text-align:center;text-decoration:none" data-mark target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text)}">Enviar por WhatsApp</a>
        <a class="btn" style="text-align:center;text-decoration:none" data-mark href="mailto:${esc(church.supervisor_email || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}">Enviar por correo${church.supervisor_email ? "" : " (configure el correo en Iglesia)"}</a>
        <button class="btn sec" id="cp">Copiar texto</button>`, (s, close) => {
        const mark = async () => {
          await sb.from("kaleos_reports").upsert({ church_id: me.church_id, month: month + "-01", data: r, sent_at: new Date().toISOString(), sent_by: me.id }, { onConflict: "church_id,month" });
          close(); setTimeout(() => viewReport(el, month), 400);
        };
        s.querySelectorAll("[data-mark]").forEach((a) => a.addEventListener("click", mark));
        $("#cp", s).addEventListener("click", () => navigator.clipboard.writeText(text).then(() => { toast("Reporte copiado"); mark(); }));
      });
    });
  }

  // ===== pastor: iglesia =====
  async function viewChurchAdmin(el) {
    const n = await latestNotice();
    el.innerHTML = `<h2 class="t">Iglesia</h2>
      <div class="grid2"><button class="btn sec" id="mycard">🪪 Mi tarjeta</button><button class="btn sec" id="back">Ver reverso</button></div>
      <div class="tile"><div class="lab c">Aviso de la semana</div>
        ${n ? `<div class="small">Actual: ${esc(n.title)} · ${new Date(n.created_at).toLocaleDateString("es-GT", { timeZone: TZ })}</div>` : ""}
        <div class="field"><label for="nt">Título</label><input id="nt" value="Aviso de la semana"></div>
        <div class="field"><label for="nb">Aviso</label><textarea id="nb" placeholder="Vigilia de oración, viernes 23 a las 19:00."></textarea></div>
        <div class="field"><label for="st">Predicación del domingo (título)</label><input id="st" value="${esc(n?.sermon_title || "")}"></div>
        <div class="field"><label for="su">Enlace a la predicación (YouTube, Facebook…)</label><input id="su" inputmode="url" value="${esc(n?.sermon_url || "")}"></div>
        <button class="btn" id="pub">Publicar aviso</button></div>
      <div class="tile"><div class="lab r">Datos de la iglesia</div>
        <div class="field"><label for="cn">Nombre</label><input id="cn" value="${esc(church.name || "")}"></div>
        <div class="field"><label for="cm">Misión (reverso de la tarjeta)</label><textarea id="cm">${esc(church.mission || "")}</textarea></div>
        <div class="field"><label for="cp">Teléfono del pastor (botón «Llamar al pastor»)</label><input id="cp" inputmode="tel" value="${esc(church.pastor_phone || "")}"></div>
        <div class="grid2"><div class="field"><label for="sn">Supervisor</label><input id="sn" value="${esc(church.supervisor_name || "")}"></div>
          <div class="field"><label for="se">Correo del supervisor</label><input id="se" type="email" value="${esc(church.supervisor_email || "")}"></div></div>
        <button class="btn" id="sv">Guardar datos</button></div>
      <button class="btn sec" id="pr">📥 Pedidos de los hermanos</button>`;
    $("#mycard", el).addEventListener("click", () => { $("#body").innerHTML = ""; viewCard($("#body")); });
    $("#back", el).addEventListener("click", () => { $("#body").innerHTML = ""; viewChurch($("#body")); });
    $("#pr", el).addEventListener("click", () => go("pedidos"));
    $("#pub", el).addEventListener("click", async () => {
      const body = $("#nb", el).value.trim();
      if (!body) return toast("Escriba el aviso");
      const { error } = await sb.from("kaleos_notices").insert({ church_id: me.church_id, created_by: me.id, title: $("#nt", el).value.trim() || "Aviso de la semana",
        body, sermon_title: $("#st", el).value.trim() || null, sermon_url: $("#su", el).value.trim() || null });
      if (error) return toast(errMsg(error));
      toast("Aviso publicado"); go("iglesia");
    });
    $("#sv", el).addEventListener("click", async () => {
      const f = { name: $("#cn", el).value.trim(), mission: $("#cm", el).value.trim(), pastor_phone: $("#cp", el).value.trim() || null,
        supervisor_name: $("#sn", el).value.trim() || "Supervisor de Distrito", supervisor_email: $("#se", el).value.trim() || null };
      const { data, error } = await sb.from("kaleos_churches").update(f).eq("id", me.church_id).select().single();
      if (error) return toast(errMsg(error));
      church = data; toast("Datos guardados");
    });
  }

  boot();
})();
