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
    if (role === "pastor") return [["panel", "🏠", "Panel"], ["hermanos", "👥", "Hermanos"], ["escanear", "📷", "Escanear"], ["reporte", "📊", "Reporte"], ["iglesia", "⛪", "Iglesia"]];
    const t = [["tarjeta", "🪪", "Tarjeta"], ["camino", "🛤️", "Camino"]];
    if (role === "usher") t.push(["escanear", "📷", "Escanear"]);
    t.push(["iglesia", "⛪", "Iglesia"]);
    return t;
  }

  function renderShell(start) {
    const tabs = tabsFor(me.role);
    app.innerHTML = `<main class="page" id="page"></main>
      <nav class="tabs" aria-label="Secciones"><div class="in">${tabs.map(([k, i, l]) =>
        `<button class="tab" data-tab="${k}"><i aria-hidden="true">${i}</i>${l}</button>`).join("")}</div></nav>`;
    app.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
    go(start);
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
    const views = { tarjeta: viewCard, camino: viewPath, iglesia: me.role === "pastor" ? viewChurchAdmin : viewChurch,
      escanear: viewScan, panel: viewPanel, hermanos: viewMembers, reporte: viewReport };
    Promise.resolve(views[name]($("#body"))).catch((e) => { $("#body").innerHTML = `<p class="muted">${esc(errMsg(e))}</p>`; });
  }

  // ===== hermano: tarjeta =====
  const isBirthday = (p) => p.birthday && String(p.birthday).slice(5, 10) === today().slice(5, 10);

  async function viewCard(el) {
    const bday = isBirthday(me);
    const { data: streak } = await sb.rpc("kaleos_my_streak");
    const v = VERSES[new Date().getFullYear() % VERSES.length];
    const first = me.full_name.split(" ")[0];
    el.innerHTML = `
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
      ${streak > 0 ? `<div class="streak"><div class="dot">★</div><div>${streak} ${streak === 1 ? "domingo" : "domingos seguidos"}<div class="small">¡Gracias por congregarse!</div></div></div>` : ""}`;
    if (bday) { confetti(); $("#pray").addEventListener("click", askPrayer); }
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
    const { error } = await sb.from("kaleos_prayer_requests").insert({ church_id: me.church_id, profile_id: me.id });
    if (btn) btn.disabled = false;
    if (error) return toast(errMsg(error));
    sheet("Petición enviada", `<p style="font-size:19px;margin:0">Su pastor ya recibió su petición. La iglesia está orando por usted. 🙏</p>
      <div class="field"><label for="pn">Si desea, cuéntele por qué orar (opcional)</label><textarea id="pn"></textarea></div>
      <button class="btn" id="pns">Agregar detalle</button><button class="btn sec" data-close>Listo</button>`, (s, close) => {
      $("#pns", s).addEventListener("click", async () => {
        const note = $("#pn", s).value.trim();
        if (!note) return close();
        await sb.from("kaleos_prayer_requests").insert({ church_id: me.church_id, profile_id: me.id, note });
        toast("Detalle enviado"); close();
      });
    });
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
    const t = today().slice(5, 10);
    const list = (arr, fn, empty) => arr.length ? arr.map(fn).join("") : `<div class="empty">${empty}</div>`;
    const daysAgo = (d) => Math.round((new Date(today()) - new Date(d)) / 86400000);
    el.innerHTML = `<h2 class="t">Panel del pastor</h2><div class="small">${p.members_total} hermanos en Kaleos</div>
      <div class="tile"><div class="lab c">Cuidar</div>
        ${list(p.birthdays, (b) => `<div class="row"><span class="grow">🎂 ${esc(b.name)} ${String(b.birthday).slice(5, 10) === t ? "cumple hoy" : "cumple el " + fmtDate(b.birthday, "dm")}</span>
          ${b.phone ? `<a class="pill solid" target="_blank" rel="noopener" href="${waLink(b.phone, `¡Feliz cumpleaños, ${b.name.split(" ")[0]}! «Jehová te bendiga, y te guarde» (Números 6:24). Con cariño, su pastor y la iglesia de La Línea.`)}">Felicitar</a>` : ""}</div>`, "Nadie cumple años esta semana.")}
        ${list(p.absent, (a) => `<div class="row"><span class="grow">${esc(a.name)} · ${Math.floor(daysAgo(a.last) / 7)} domingos sin venir</span>
          <button class="pill w" data-visit="${a.id}" data-name="${esc(a.name)}">Visitar</button></div>`, "Nadie lleva 3 domingos sin venir.")}
        <div class="row"><span class="grow">${p.prayers_new} ${p.prayers_new === 1 ? "petición de oración nueva" : "peticiones de oración nuevas"}</span><button class="pill b" id="prayers">Ver</button></div>
      </div>
      <div class="tile"><div class="lab f">Formar</div>
        <div class="row"><span class="grow">Listos para bautismo</span><button class="pill g" data-who="ready_baptism">${p.ready_baptism.length}</button></div>
        <div class="row"><span class="grow">Sirviendo, listos para liderar</span><button class="pill g" data-who="ready_lead">${p.ready_lead.length}</button></div>
        <div class="row"><span class="grow">Visitantes sin seguimiento</span><button class="pill w" data-who="visitors_no_follow">${p.visitors_no_follow.length}</button></div>
      </div>
      <div class="tile"><div class="lab r">Reportar</div>
        <div class="row"><span class="grow">Reporte de ${MONTHS[Number(month.slice(5, 7)) - 1]}: ${rep.services} cultos registrados, ${rep.visits} visitas</span><button class="pill b" id="torep">Abrir</button></div>
      </div>`;
    el.querySelectorAll("[data-visit]").forEach((b) => b.addEventListener("click", () => visitSheet(b.dataset.visit, b.dataset.name, () => go("panel"))));
    $("#prayers", el).addEventListener("click", prayersSheet);
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

  async function prayersSheet() {
    const { data } = await sb.from("kaleos_prayer_requests").select("id, note, status, created_at, kaleos_profiles(full_name, phone)")
      .eq("church_id", me.church_id).order("created_at", { ascending: false }).limit(50);
    const next = { nueva: ["orando", "Orando"], orando: ["atendida", "Atendida"], atendida: null };
    sheet("Peticiones de oración", `<div class="list">${(data || []).length ? data.map((r) => `
      <div class="item" style="cursor:default;flex-wrap:wrap"><div class="grow"><b>${esc(r.kaleos_profiles?.full_name || "")}</b>
        <span>${new Date(r.created_at).toLocaleString("es-GT", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" })} · ${esc(r.status)}</span>
        ${r.note ? `<div style="margin-top:4px">${esc(r.note)}</div>` : ""}</div>
        ${r.kaleos_profiles?.phone ? `<a class="pill b" href="tel:${phoneDigits(r.kaleos_profiles.phone)}">Llamar</a>` : ""}
        ${next[r.status] ? `<button class="pill g" data-id="${r.id}" data-to="${next[r.status][0]}">${next[r.status][1]}</button>` : ""}</div>`).join("") : '<div class="empty">No hay peticiones todavía.</div>'}</div>`,
      (s, close) => s.querySelectorAll("[data-to]").forEach((b) => b.addEventListener("click", async () => {
        await sb.from("kaleos_prayer_requests").update({ status: b.dataset.to }).eq("id", b.dataset.id);
        close(); prayersSheet(); if (tab === "panel") go("panel");
      })));
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
      <div class="field"><label for="fserves">Sirve en</label><input id="fserves" value="${esc(m.serves_in || "")}" placeholder="Damas Dorcas, alabanza, ujieres…"></div>`;
  }
  function readFields(s) {
    const v = (id) => { const x = $("#" + id, s).value.trim(); return x === "" ? null : x; };
    return { title: v("ftitle"), full_name: v("fname"), stage: v("fstage"), role: v("frole"), phone: v("fphone"),
      birthday: v("fbday"), member_since: v("fsince"), baptism_date: v("fbap"), serves_in: v("fserves") };
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
      <button class="btn sec" id="pr">🙏 Peticiones de oración</button>`;
    $("#mycard", el).addEventListener("click", () => { $("#body").innerHTML = ""; viewCard($("#body")); });
    $("#back", el).addEventListener("click", () => { $("#body").innerHTML = ""; viewChurch($("#body")); });
    $("#pr", el).addEventListener("click", prayersSheet);
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
