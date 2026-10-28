/* Kaleos: app del pastor (asistente, versículos, pedidos, agenda, hermanos, comunidades, mayordomía, saludos). */
(function () {
  "use strict";
  const K = window.K, { esc, $, $$, ic } = K;
  const P = (K.P = { sec: "asistente", ctl: "ingresos", chat: [], reqF: "todos", day: null, hq: "", hl: "todos", comm: null, ctab: "avisos",
    studio: { v: 0, custom: false, ctext: "", cref: "", kind: "cumbres", pal: "alba", layout: "clasico", fmt: "cuadrado", firma: true, seed: 3 } });

  const REQ_SELECT = "id, kind, note, for_name, for_date, status, created_at, profile_id, who:kaleos_profiles!profile_id(id, full_name, title, phone, birthday)";
  const requests = () => K.load("reqs", () => K.rows(K.sb.from("kaleos_prayer_requests").select(REQ_SELECT).eq("church_id", K.me.church_id).order("created_at", { ascending: false }).limit(150)));
  const upcoming = () => K.load("upcoming", () => K.rows(K.sb.from("kaleos_messages").select("*").eq("church_id", K.me.church_id).is("profile_id", null)
    .gte("event_at", new Date(Date.now() - 6 * 3600000).toISOString()).lte("event_at", new Date(Date.now() + 21 * 86400000).toISOString()).order("event_at").limit(60)));
  const reminders = () => K.load("rems", () => K.rows(K.sb.from("kaleos_reminders").select("*").eq("owner_id", K.me.id).eq("done", false).order("due_at").limit(60)));
  const bdaysWithin = (people, days) => {
    const t = K.today(), set = new Map(Array.from({ length: days }, (_, i) => [K.addDays(t, i).slice(5), i]));
    return people.filter((p) => p.active && p.birthday && set.has(String(p.birthday).slice(5, 10)) && p.id !== K.me.id)
      .map((p) => ({ p, in: set.get(String(p.birthday).slice(5, 10)) })).sort((a, b) => a.in - b.in);
  };
  const age = (b) => { if (!b) return null; const t = K.today(); let a = +t.slice(0, 4) - +String(b).slice(0, 4); if (t.slice(5) < String(b).slice(5, 10)) a--; return a; };

  // ===== Asistente =====
  const SUGG = [["hoy", "¿Qué tengo hoy?"], ["cumple", "¿Quién cumple años esta semana?"], ["pedidos", "Pedidos pendientes"], ["aviso", "Preparar un aviso"], ["versiculo", "Hacer una imagen con un versículo"]];
  const kmsg = (html, data) => ({ who: "k", html, data });
  function classify(raw) {
    const t = raw.toLowerCase();
    if (/cumple/.test(t)) return { action: "cumple" };
    if (/pedido|oraci|orar|visita/.test(t)) return { action: "pedidos" };
    if (/recu[eé]rd|recordatorio|anota/.test(t)) return { action: "recordatorio", args: { title: K.cap(raw.replace(/^(recu[eé]rdame( que)?|recordatorio:?|anota)\s*/i, "")) } };
    if (/avis|invit|anunci/.test(t)) return { action: "aviso", args: {} };
    if (/vers|imagen|flyer|diseñ/.test(t)) return { action: "versiculo", args: {} };
    if (/hoy|agenda|tengo|día|semana/.test(t)) return { action: "hoy" };
    return { action: "responder", reply: "Puedo ayudarle con su agenda, los pedidos, los cumpleaños, avisos, recordatorios y versículos. Pruebe con una de las sugerencias de abajo." };
  }
  async function answer(a) {
    const [people, reqs, evs, rems] = await Promise.all([K.people(), requests(), upcoming(), reminders()]);
    const t = K.today(), open = reqs.filter((r) => r.status !== "atendida"), nuevos = reqs.filter((r) => r.status === "nueva");
    const pre = a.reply ? `<p>${esc(a.reply)}</p>` : "";
    if (a.action === "hoy") {
      const items = [
        ...evs.filter((e) => K.dayOf(e.event_at) === t).map((e) => [K.fmtTime(e.event_at), e.title, e.place || "Actividad"]),
        ...rems.filter((r) => K.dayOf(r.due_at) <= t).map((r) => [K.dayOf(r.due_at) < t ? "Pendiente" : K.fmtTime(r.due_at), r.title, "Recordatorio"]),
        ...bdaysWithin(people, 1).map(({ p }) => ["Todo el día", "Cumpleaños de " + p.full_name, "Felicitar"]),
        ...open.filter((r) => r.kind === "visita").map((r) => [r.for_date ? K.fmtDate(r.for_date, "ds") : "Visita", "Visita a " + (r.for_name || r.who?.full_name || ""), esc(r.note || "Pidió visita")]),
      ];
      const next = evs.find((e) => K.dayOf(e.event_at) > t);
      return kmsg(`${pre || `<p>Esto tiene hoy, ${esc(K.dpart(new Date(), { weekday: "long", day: "numeric" }))}:</p>`}<div class="rich">
        ${items.length ? items.map(([h, ti, s], i) => `<div class="tl" ${i === items.length - 1 ? 'style="border-bottom:0"' : ""}><span class="h">${esc(h)}</span><span><b>${esc(ti)}</b><br><span class="muted" style="font-size:13px">${s}</span></span></div>`).join("") : `<p class="muted">Nada agendado para hoy.${next ? ` Lo próximo: <b>${esc(next.title)}</b>, ${esc(K.fmtWhen(next.event_at))}.` : ""}</p>`}
        <div class="acts">${nuevos.length ? `<button class="btn sm" data-go="pedidos">${ic("pedidos", "sm")}Ver ${nuevos.length} ${nuevos.length === 1 ? "pedido nuevo" : "pedidos nuevos"}</button>` : ""}<button class="btn sec sm" data-go="agenda">Abrir agenda</button></div></div>`);
    }
    if (a.action === "cumple") {
      const list = bdaysWithin(people, 8);
      return kmsg(`${pre || `<p>${list.length ? `Estos hermanos cumplen años en los próximos días. ¿Les preparo una tarjeta?` : "Nadie cumple años en los próximos 7 días."}</p>`}${list.length ? `<div class="rich">
        ${list.map(({ p, in: n }) => `<div class="li"><span class="avatar">${esc(K.ini(p.full_name))}</span><div class="g"><b>${esc(p.full_name)}</b><span class="s">${n === 0 ? "Hoy" : n === 1 ? "Mañana" : K.fmtDate(p.birthday, "dm")}${age(p.birthday) ? " · " + (age(p.birthday) + (n ? 1 : 0)) + " años" : ""}</span></div><button class="btn sm" data-card="${p.id}">Preparar tarjeta</button></div>`).join("")}</div>` : ""}`);
    }
    if (a.action === "pedidos") {
      return kmsg(`${pre || `<p>${open.length ? `Tiene ${open.length} ${open.length === 1 ? "pedido abierto" : "pedidos abiertos"}:` : "No tiene pedidos pendientes."}</p>`}${open.length ? `<div class="rich">${open.slice(0, 6).map((r) => `<div class="li">${ic(K.REQ[r.kind].ic)}<div class="g"><b>${esc(K.REQ[r.kind].n)} · ${esc(r.who?.full_name || "")}</b><span class="s">${esc(r.note || r.for_name || "")}</span></div><span class="pill ${K.RSTAT[r.status][1]}">${K.RSTAT[r.status][0]}</span></div>`).join("")}
        <div class="acts"><button class="btn sm" data-go="pedidos">Abrir pedidos</button></div></div>` : ""}`);
    }
    if (a.action === "aviso") {
      const g = a.args || {};
      const comms = await K.communities(), c = comms.find((x) => x.slug === g.community);
      const has = g.title || g.when;
      return kmsg(`${pre || `<p>${has ? "Preparé este aviso. Revíselo antes de enviarlo:" : "Abro el editor de avisos para que escriba el título, la fecha y para quién es."}</p>`}${has ? `<div class="rich">
        <div class="li"><div class="g"><b>${esc(g.title || "Aviso")}</b><span class="s">${[g.when ? K.cap(K.fmtWhen(g.when)) : "", g.place || ""].filter(Boolean).map(esc).join(" · ")}${g.body ? "<br>" + esc(g.body) : ""}</span></div></div>
        <div class="li"><div class="g"><span class="s">Se enviará a</span><div class="chips" style="margin-top:6px"><span class="chip">${ic("kaleos")}${esc(c ? c.name + " · " + c.members + " integrantes" : "Toda la iglesia")}</span><span class="chip">${ic("chat")}WhatsApp</span></div></div></div>
        <div class="acts"><button class="btn sm gold" data-ann="1">${ic("send", "sm")}Revisar y enviar</button></div></div>` : `<div class="row"><button class="btn sm gold" data-ann="1">${ic("avisos", "sm")}Abrir editor</button></div>`}`, { ann: { ...g, community: c ? c.id : null } });
    }
    if (a.action === "recordatorio") {
      const g = a.args || {}, when = g.when || K.gtISO(K.addDays(K.today(), 1), "09:00");
      return kmsg(`${pre || "<p>¿Guardo este recordatorio?</p>"}<div class="rich"><div class="li">${ic("agenda")}<div class="g"><b>${esc(g.title || "Recordatorio")}</b><span class="s">${esc(K.cap(K.fmtWhen(when)))}</span></div></div>
        <div class="acts"><button class="btn sm gold" data-rem="1">${ic("check", "sm")}Sí, guardarlo</button><button class="btn sec sm" data-remedit="1">Cambiar</button></div></div>`, { rem: { title: g.title || "Recordatorio", when } });
    }
    if (a.action === "versiculo") {
      const g = a.args || {};
      return kmsg(`${pre || "<p>Abro el estudio de versículos. Elija el texto, el estilo y la composición; yo preparo la imagen.</p>"}<div class="row"><button class="btn sm gold" data-vers="1">${ic("versiculos", "sm")}Abrir estudio</button></div>`, { vers: g });
    }
    return kmsg(`<p>${esc(a.reply || "No le entendí bien. ¿Me lo dice de otra forma?")}</p>`);
  }
  async function ask(el, text, key) {
    P.chat.push({ who: "me", html: esc(text), text }, { who: "k", typing: true });
    drawChat(el);
    let a = key ? { action: key } : null;
    if (!a) {
      try {
        const history = P.chat.filter((m) => !m.typing).slice(-7, -1).map((m) => ({ who: m.who, text: m.text || (m.html || "").replace(/<[^>]+>/g, " ").slice(0, 400) }));
        const { data, error } = await K.sb.functions.invoke("kaleos-asistente", { body: { text, history } });
        if (error || !data || data.error) throw error || new Error(data && data.error);
        a = data;
      } catch (_) { a = classify(text); }
    }
    let m;
    try { m = await answer(a); } catch (e) { m = kmsg(`<p>${esc(K.errMsg(e))}</p>`); }
    m.text = (a.reply || "").slice(0, 400);
    P.chat.pop(); P.chat.push(m);
    drawChat(el);
  }
  function drawChat(el) {
    const box = $("#chat", el); if (!box) return;
    box.innerHTML = P.chat.map((m, i) => m.who === "me" ? `<div class="msg me">${m.html}</div>` :
      `<div class="msg k" data-mi="${i}"><span class="who">${ic("asistente")}</span><div class="body">${m.typing ? '<span class="typing"><i></i><i></i><i></i></span>' : m.html}</div></div>`).join("") + '<span id="chatEnd"></span>';
    K.paint(box);
    requestAnimationFrame(() => { const c = $("#chatEnd", el); if (c) c.scrollIntoView({ block: "center", behavior: "smooth" }); });
  }
  async function viewAsistente(el) {
    const [people, reqs, evs] = await Promise.all([K.people(), requests(), upcoming()]);
    const nuevos = reqs.filter((r) => r.status === "nueva").length, today = bdaysWithin(people, 1), next = evs.find((e) => new Date(e.event_at) > new Date());
    const h = +new Date().toLocaleString("en-US", { timeZone: K.TZ, hour: "numeric", hour12: false });
    if (!P.chat.length) P.chat.push(kmsg(`<p>Tengo listo su resumen del día. ¿Por dónde empezamos?</p>`));
    el.innerHTML = `<div class="greet"><span class="eyebrow">${esc(K.cap(K.dpart(new Date(), { weekday: "long", day: "numeric", month: "long" })))}</span><h1><em>${h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches"},</em><br><span>${esc((K.me.title || "pastor").toLowerCase())}.</span></h1></div>
      <div class="brief">
        <button class="bc dark" data-ask="pedidos" data-q="¿Qué pedidos tengo?">${ic("pedidos")}<span><b class="num">${nuevos}</b><span>${nuevos === 1 ? "pedido nuevo espera" : "pedidos nuevos esperan"} su respuesta</span></span></button>
        <button class="bc" data-ask="cumple" data-q="¿Quién cumple años?">${ic("felicitacion")}<span><b class="num">${today.length}</b><span>${today.length ? "cumpleaños hoy: " + esc(today.map(({ p }) => K.first(p.full_name)).join(" y ")) : "cumpleaños hoy"}</span></span></button>
        <button class="bc" data-ask="hoy" data-q="¿Qué tengo hoy?">${ic("agenda")}<span><b>${next ? esc(K.cap(K.dpart(next.event_at, { weekday: "long" }))) : "Agenda"}</b><span>${next ? esc(next.title) + " · " + esc(K.fmtTime(next.event_at)) : "Sin actividades próximas"}</span></span></button>
      </div>
      <div class="chat" id="chat" aria-live="polite"></div>
      <div class="sugg">${SUGG.map(([k, l]) => `<button class="chip" data-ask="${k}" data-q="${esc(l)}">${esc(l)}</button>`).join("")}</div>
      <form class="askbar" id="askf"><input id="askq" placeholder="Pregúntele a Kaleos…" autocomplete="off" aria-label="Escriba su pedido"><button type="button" class="dict" id="mic" aria-label="Dictar">${ic("mic")}</button><button type="button" class="voice" id="voz" aria-label="Conversar por voz">${ic("onda")}</button><button class="send" aria-label="Enviar" hidden>${ic("send")}</button></form>
      <p class="fine">Toque ${ic("onda", "xs")} para conversar con Kaleos por voz. Solo hace lo que la app permite, y nada se envía sin su «sí».</p>`;
    drawChat(el);
    K.on(el, ".brief [data-ask], .sugg [data-ask]", (b) => ask(el, b.dataset.q, b.dataset.ask));
    const q = $("#askq", el), sendB = $("#askf .send", el), vozB = $("#voz", el);
    q.addEventListener("input", () => { const t = !!q.value.trim(); sendB.hidden = !t; vozB.hidden = t; });
    vozB.addEventListener("click", () => K.voiceStart());
    $("#askf", el).addEventListener("submit", (e) => { e.preventDefault(); const v = $("#askq", el).value.trim(); if (v) { q.value = ""; q.dispatchEvent(new Event("input")); ask(el, v); } });
    $("#mic", el).addEventListener("click", () => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return K.toast("Este navegador no permite dictar. Escriba su pedido.");
      const r = new SR(); r.lang = "es-GT"; r.interimResults = false;
      const b = $("#mic", el); b.classList.add("on"); K.toast("Le escucho…");
      r.onresult = (e) => { const v = e.results[0][0].transcript; if (v) ask(el, v); };
      r.onend = () => b.classList.remove("on");
      r.onerror = () => { b.classList.remove("on"); K.toast("No le escuché. Intente de nuevo."); };
      r.start();
    });
    // acciones dentro de las respuestas
    $("#chat", el).addEventListener("click", async (e) => {
      const t = e.target.closest("button"); if (!t) return;
      const m = P.chat[+(t.closest("[data-mi]") || {}).dataset?.mi] || {};
      if (t.dataset.go) return setSec(t.dataset.go);
      if (t.dataset.card) { const p = (await K.people()).find((x) => x.id === t.dataset.card); if (p) K.greetBirthday(p); return; }
      if (t.dataset.ann) return K.annSheet({ prefill: m.data && m.data.ann, after: () => { K.bust("upcoming"); P.chat.push(kmsg("<p><b>Listo.</b> El aviso quedó publicado en Kaleos.</p>")); drawChat(el); } });
      if (t.dataset.rem) {
        t.disabled = true;
        const r = m.data.rem, { error } = await K.sb.from("kaleos_reminders").insert({ church_id: K.me.church_id, title: r.title, due_at: r.when });
        if (error) { t.disabled = false; return K.toast(K.errMsg(error), 4000); }
        K.bust("rems"); P.chat.push(kmsg(`<p><b>Guardado.</b> Le aparece en su agenda.</p>`)); drawChat(el); return;
      }
      if (t.dataset.remedit) return reminderSheet(m.data.rem, () => { P.chat.push(kmsg("<p><b>Guardado.</b> Le aparece en su agenda.</p>")); drawChat(el); });
      if (t.dataset.vers) {
        const g = (m.data && m.data.vers) || {};
        if (g.text) Object.assign(P.studio, { custom: true, ctext: g.text, cref: g.ref || "" });
        return setSec("versiculos");
      }
    });
  }

  // ===== Estudio de versículos =====
  const studioOpts = () => {
    const st = P.studio, [ref, text] = st.custom ? [st.cref || "Referencia", st.ctext || "Escriba aquí el versículo que quiere compartir."] : K.VERSES[st.v];
    return { text, ref, pal: st.pal, kind: st.kind, layout: st.layout, fmt: st.fmt, firma: st.firma, seed: st.seed };
  };
  function viewVersiculos(el) {
    const st = P.studio;
    const draw = () => {
      el.innerHTML = `<div class="studio">
        <div class="studio-h"><span class="eyebrow">Estudio de versículos</span><h1 style="margin-top:8px">La Palabra,<br><em>bien presentada.</em></h1></div>
        <div class="prev ${st.fmt === "historia" ? "tall" : ""}">${K.vcv(studioOpts(), "")}</div>
        <div class="ctl"><span class="flabel">Versículo</span>${K.dd("verse", { icon: "versiculos", options: () => [...K.VERSES.map(([r, t], i) => ({ v: String(i), l: r, s: t.length > 60 ? t.slice(0, 58) + "…" : t })), { sep: 1 }, { v: "custom", l: "Escribir otro versículo", icon: "otro" }], value: () => (st.custom ? "custom" : String(st.v)), pick: (v) => { if (v === "custom") st.custom = true; else { st.custom = false; st.v = +v; } draw(); } })}
          ${st.custom ? `<input class="inp" id="cref" placeholder="Referencia, por ejemplo: Romanos 8:28" value="${esc(st.cref)}" aria-label="Referencia"><textarea class="inp" id="ctext" placeholder="Texto del versículo (Reina-Valera 1960)" aria-label="Texto del versículo">${esc(st.ctext)}</textarea>` : ""}</div>
        <div class="ctl" style="align-items:stretch"><span class="flabel">Estilo de imagen</span><div class="styles">${Object.entries(K.ART_KINDS).map(([k, l]) => `<button class="sty" data-st="${k}" aria-pressed="${st.kind === k}"><span class="sw">${K.artCv(k, st.pal, st.seed)}</span>${l}</button>`).join("")}</div></div>
        <div class="ctl"><span class="flabel">Color · ${K.PAL_NAMES[st.pal]}</span><div class="pals">${Object.keys(K.PAL).map((p) => `<button class="pal" data-sp="${p}" aria-pressed="${st.pal === p}" aria-label="${K.PAL_NAMES[p]}" style="background:linear-gradient(135deg,${K.PAL[p][0]},${K.PAL[p][1]} 60%,${K.PAL[p][2]})"></button>`).join("")}</div></div>
        <div class="ctl"><span class="flabel">Composición</span><div class="seg">${[["clasico", "Clásica"], ["editorial", "Editorial"], ["monumental", "Monumental"]].map(([k, l]) => `<button data-sl="${k}" aria-pressed="${st.layout === k}">${l}</button>`).join("")}</div></div>
        <div class="row" style="flex-wrap:wrap">${K.dd("fmt", { label: "Formato", options: () => [{ v: "cuadrado", l: "Cuadrado", s: "Kaleos y Facebook" }, { v: "post", l: "Vertical 4:5", s: "Publicación" }, { v: "historia", l: "Estado de WhatsApp", s: "Pantalla completa 9:16" }], value: () => st.fmt, pick: (v) => { st.fmt = v; draw(); } })}
          <button class="toggle" role="switch" aria-checked="${st.firma}" id="firma"><i></i>Firma de la iglesia</button></div>
        <div style="display:grid;gap:8px"><button class="btn gold block" id="vpub">${ic("kaleos")}Publicar como versículo del día</button>
          <div class="row"><button class="btn sec" style="flex:1" id="vwa">${ic("chat")}A WhatsApp</button><button class="btn sec" style="flex:1" id="vseed">${ic("editar")}Otra variación</button></div></div>
      </div>`;
      K.paint(el);
      K.on(el, "[data-st]", (b) => { st.kind = b.dataset.st; draw(); });
      K.on(el, "[data-sp]", (b) => { st.pal = b.dataset.sp; draw(); });
      K.on(el, "[data-sl]", (b) => { st.layout = b.dataset.sl; draw(); });
      $("#firma", el).addEventListener("click", () => { st.firma = !st.firma; draw(); });
      $("#vseed", el).addEventListener("click", () => { st.seed = 1 + Math.floor(Math.random() * 90); draw(); });
      const redraw = () => { const cv = $(".prev canvas", el); if (cv) { K.VC[cv.dataset.vc] = studioOpts(); K.drawVerse(cv, K.VC[cv.dataset.vc]); } };
      ["cref", "ctext"].forEach((id) => { const i = $("#" + id, el); if (i) i.addEventListener("input", () => { st[id] = i.value; redraw(); }); });
      $("#vwa", el).addEventListener("click", () => { const o = studioOpts(); K.shareCanvas($(".prev canvas", el), `«${o.text}» ${o.ref}`, "versiculo-kaleos.png"); });
      $("#vpub", el).addEventListener("click", async (e) => {
        const o = studioOpts();
        if (st.custom && (!st.ctext.trim() || !st.cref.trim())) return K.toast("Escriba el versículo y su referencia");
        e.currentTarget.disabled = true;
        const { error } = await K.sb.from("kaleos_verses").insert({ church_id: K.me.church_id, ref: o.ref, body: o.text, created_by: K.me.id,
          style: { pal: o.pal, kind: o.kind, layout: o.layout, fmt: o.fmt, firma: o.firma, seed: o.seed } });
        e.currentTarget.disabled = false;
        if (error) return K.toast(K.errMsg(error), 4000);
        K.bust("verse"); K.toast("Publicado. Los hermanos lo ven hoy en su Inicio.");
      });
    };
    draw();
  }

  // ===== Pedidos =====
  async function viewPedidos(el) {
    const all = await requests();
    const list = all.filter((r) => P.reqF === "todos" || r.kind === P.reqF);
    const open = list.filter((r) => r.status !== "atendida"), done = list.filter((r) => r.status === "atendida").slice(0, 20);
    const item = (r) => {
      const who = r.who || {}, self = r.profile_id === K.me.id, acts = [];
      if (r.status !== "atendida") {
        if (r.kind === "felicitacion" && !r.for_name && !self) acts.push(`<button class="btn sm" data-card="${r.id}">Hacer tarjeta</button>`);
        if (r.kind === "visita" && !self) acts.push(`<button class="btn sm" data-visit="${r.id}">Registrar visita</button>`);
        if (r.status === "nueva") acts.push(`<button class="btn sec sm" data-rs="${r.id}:orando">${r.kind === "oracion" ? "Orando" : "En camino"}</button>`);
        acts.push(`<button class="btn sec sm" data-rs="${r.id}:atendida">${ic("check", "xs")}Atendido</button>`);
      } else acts.push(`<button class="btn sec sm" data-rs="${r.id}:nueva">Reabrir</button>`);
      if (who.phone && !self) acts.push(`<a class="btn sec sm" href="${K.waLink(who.phone, "")}" target="_blank" rel="noopener">${ic("chat", "xs")}WhatsApp</a>`);
      return `<div class="req"><span class="k">${ic(K.REQ[r.kind].ic)}</span><div><div class="row" style="justify-content:space-between;align-items:flex-start"><h3>${K.REQ[r.kind].n} · ${esc(self ? r.for_name || "Anotado por usted" : who.full_name || "")}</h3><span class="pill ${K.RSTAT[r.status][1]}">${K.RSTAT[r.status][0]}</span></div>
        <p class="muted" style="font-size:13px;margin-top:2px">${[r.for_name && !self ? "Para " + r.for_name : "", r.for_date ? K.fmtDate(r.for_date, "dm") : "", new Date(r.created_at).toLocaleString("es-GT", { timeZone: K.TZ, dateStyle: "medium", timeStyle: "short" })].filter(Boolean).map(esc).join(" · ")}</p>${r.note ? `<p style="margin-top:6px">${esc(r.note)}</p>` : ""}
        <div class="acts">${acts.join("")}</div></div></div>`;
    };
    el.innerHTML = `<div class="sec-h"><h2>Pedidos</h2>${K.dd("reqF", { right: true, options: () => [{ v: "todos", l: "Todos" }, ...Object.entries(K.REQ).map(([v, r]) => ({ v, l: r.n, icon: r.ic }))], value: () => P.reqF, pick: (v) => { P.reqF = v; K.mount(el, viewPedidos); } })}</div>
      <div>${open.length ? open.map(item).join("") : '<p class="empty">No hay pedidos pendientes.</p>'}</div>
      ${done.length ? `<div class="stack"><div class="eyebrow">Atendidos</div><div>${done.map(item).join("")}</div></div>` : ""}`;
    const byId = (id) => all.find((r) => String(r.id) === String(id));
    const setStatus = async (id, to) => {
      const { error } = await K.sb.from("kaleos_prayer_requests").update({ status: to, done_at: to === "atendida" ? new Date().toISOString() : null }).eq("id", id);
      if (error) return K.toast(K.errMsg(error));
      K.bust("reqs"); K.toast(to === "atendida" ? "Marcado como atendido" : "Actualizado"); K.mount(el, viewPedidos);
    };
    K.on(el, "[data-rs]", (b) => { const [id, st] = b.dataset.rs.split(":"); setStatus(id, st); });
    K.on(el, "[data-visit]", (b) => { const r = byId(b.dataset.visit); K.visitSheet(r.who, () => setStatus(r.id, "atendida")); });
    K.on(el, "[data-card]", (b) => {
      const r = byId(b.dataset.card), label = r.note && r.note.length <= 60 ? r.note : "un día especial";
      K.greetSheet({ kind: "especial", key: "pedido:" + r.id, date: r.for_date || K.today(), label, m: r.who }, () => setStatus(r.id, "atendida"));
    });
  }
  K.visitSheet = (m, after) => {
    K.sheet(`${K.head("Visita a " + m.full_name)}<div class="field"><label for="vd">Fecha</label><input class="inp" id="vd" type="date" value="${K.today()}"></div>
      <div class="field"><label for="vn">Nota (privada del pastor)</label><textarea class="inp" id="vn" placeholder="Cómo está la familia, por qué orar…"></textarea></div>
      <button class="btn block" id="vs">Registrar visita</button>`, (s, close) => {
      $("#vs", s).addEventListener("click", async () => {
        const { error } = await K.sb.from("kaleos_visits").insert({ church_id: K.me.church_id, profile_id: m.id, pastor_id: K.me.id, visited_on: $("#vd", s).value || K.today(), note: $("#vn", s).value.trim() || null });
        if (error) return K.toast(K.errMsg(error));
        K.toast("Visita registrada"); close(); if (after) after();
      });
    });
  };

  // ===== Agenda =====
  function reminderSheet(pre, after) {
    const w = pre && pre.when ? new Date(pre.when) : null;
    K.sheet(`${K.head("Nuevo recordatorio")}<div class="field"><label for="rt1">¿Qué?</label><input class="inp" id="rt1" value="${esc((pre && pre.title) || "")}" placeholder="Llamar a la hna. Marta"></div>
      <div class="grid2"><div class="field"><label for="rt2">Día</label><input class="inp" type="date" id="rt2" value="${w ? K.dayOf(w) : P.day || K.today()}"></div>
        <div class="field"><label for="rt3">Hora</label><input class="inp" type="time" id="rt3" value="${w ? w.toLocaleTimeString("en-GB", { timeZone: K.TZ, hour: "2-digit", minute: "2-digit" }) : "09:00"}"></div></div>
      <button class="btn block" id="rok">Guardar</button><p class="fine">Solo usted ve sus recordatorios.</p>`, (s, close) => {
      $("#rok", s).addEventListener("click", async () => {
        const title = $("#rt1", s).value.trim(); if (!title) return K.toast("Escriba qué le recuerdo");
        const { error } = await K.sb.from("kaleos_reminders").insert({ church_id: K.me.church_id, title, due_at: K.gtISO($("#rt2", s).value || K.today(), $("#rt3", s).value || "09:00") });
        if (error) return K.toast(K.errMsg(error), 4000);
        K.bust("rems"); K.toast("Recordatorio guardado"); close(); if (after) after();
      });
    });
  }
  async function viewAgenda(el) {
    const [people, reqs, evs, rems, comms] = await Promise.all([K.people(), requests(), upcoming(), reminders(), K.communities()]);
    const t = K.today(); if (!P.day) P.day = t;
    const days = Array.from({ length: 7 }, (_, i) => K.addDays(t, i));
    const itemsOf = (d) => [
      ...evs.filter((e) => K.dayOf(e.event_at) === d).map((e) => ({ h: K.fmtTime(e.event_at), t: e.title, k: e.community_id ? (comms.find((c) => c.id === e.community_id) || {}).name || "Comunidad" : e.levels ? "Reunión" : "Iglesia", ann: e.id })),
      ...rems.filter((r) => K.dayOf(r.due_at) === d || (d === t && K.dayOf(r.due_at) < t)).map((r) => ({ h: K.dayOf(r.due_at) < t ? "Pendiente" : K.fmtTime(r.due_at), t: r.title, k: "Recordatorio", rem: r.id })),
      ...reqs.filter((r) => r.kind === "visita" && r.status !== "atendida" && r.for_date === d).map((r) => ({ h: "Visita", t: "Visita a " + (r.for_name || r.who?.full_name || ""), k: "Pedido" })),
      ...people.filter((p) => p.active && p.birthday && String(p.birthday).slice(5, 10) === d.slice(5)).map((p) => ({ h: "Todo el día", t: "Cumpleaños de " + p.full_name, k: "Felicitar", bday: p.id })),
    ].sort((a, b) => a.h.localeCompare(b.h));
    el.innerHTML = `<div class="sec-h"><h2>Agenda</h2><button class="btn sm" id="newrem">${ic("plus", "xs")}Recordatorio</button></div>
      <div class="week">${days.map((d) => `<button class="wd" data-day="${d}" aria-pressed="${P.day === d}">${K.cap(K.weekdayOf(d).slice(0, 3))}<b>${+d.slice(8)}</b><i class="${itemsOf(d).length ? "" : "no"}"></i></button>`).join("")}</div>
      <div><div class="dayh">${esc(K.cap(K.weekdayOf(P.day)))} ${+P.day.slice(8)} de ${K.MONTHS[+P.day.slice(5, 7) - 1]}</div>
      ${itemsOf(P.day).map((x) => `<div class="ev"><span class="h">${esc(x.h)}</span><div style="flex:1"><span class="tag">${esc(x.k)}</span><h3>${esc(x.t)}</h3></div>${x.rem ? `<button class="btn sec sm" data-done="${x.rem}">${ic("check", "xs")}Hecho</button>` : x.bday ? `<button class="btn sm" data-bday="${x.bday}">Felicitar</button>` : ""}</div>`).join("") || '<p class="muted">Nada agendado.</p>'}</div>
      <button class="btn sec block" id="newann">${ic("avisos", "sm")}Nuevo aviso o invitación</button>`;
    K.on(el, "[data-day]", (b) => { P.day = b.dataset.day; K.mount(el, viewAgenda); });
    $("#newrem", el).addEventListener("click", () => reminderSheet(null, () => K.mount(el, viewAgenda)));
    $("#newann", el).addEventListener("click", () => K.annSheet({ prefill: { when: K.gtISO(P.day, "19:00") }, after: () => { K.bust("upcoming"); K.mount(el, viewAgenda); } }));
    K.on(el, "[data-bday]", (b) => { const p = people.find((x) => x.id === b.dataset.bday); if (p) K.greetBirthday(p); });
    K.on(el, "[data-done]", async (b) => {
      const { error } = await K.sb.from("kaleos_reminders").update({ done: true }).eq("id", b.dataset.done);
      if (error) return K.toast(K.errMsg(error));
      K.bust("rems"); K.mount(el, viewAgenda);
    });
  }

  // ===== Hermanos =====
  async function viewHermanos(el) {
    const people = await K.people();
    const draw = () => {
      const q = P.hq.toLowerCase();
      const list = people.filter((p) => (P.hl === "todos" || p.level === P.hl) && (p.full_name + " " + p.member_no).toLowerCase().includes(q));
      $("#hl", el).innerHTML = list.map((p) => `<button class="li" data-person="${p.id}"><span class="avatar">${esc(K.ini(p.full_name))}</span><span class="g"><b>${esc(p.full_name)}</b><span class="s">${esc(p.member_no)}${p.role !== "member" ? " · " + K.ROLE_NAME[p.role] : ""}${p.active ? "" : " · inactivo"}</span></span>${K.levelPill(p.level)}</button>`).join("") || '<p class="empty">Nadie con ese nombre.</p>';
      K.on($("#hl", el), "[data-person]", (b) => personSheet(b.dataset.person, () => K.mount(el, viewHermanos)));
    };
    el.innerHTML = `<div class="sec-h"><h2>Hermanos</h2>${K.dd("hl", { right: true, options: () => [{ v: "todos", l: "Todos los niveles" }, ...K.LEVELS.map(([v, l]) => ({ v, l }))], value: () => P.hl, pick: (v) => { P.hl = v; K.mount(el, viewHermanos); } })}</div>
      <div class="row"><label class="search" style="max-width:none;flex:1">${ic("search")}<input id="hq" placeholder="Buscar por nombre o número" value="${esc(P.hq)}" aria-label="Buscar hermano"></label><button class="btn sm" id="add">${ic("plus", "xs")}Agregar</button></div>
      <p class="fine" style="margin-top:-14px">${people.filter((p) => p.active).length} hermanos en Kaleos</p>
      <div class="list" id="hl"></div>`;
    $("#hq", el).addEventListener("input", (e) => { P.hq = e.target.value; draw(); });
    $("#add", el).addEventListener("click", () => K.editPerson(null, () => K.mount(el, viewHermanos)));
    draw();
  }
  async function personSheet(id, after) {
    const p = (await K.people()).find((x) => x.id === id); if (!p) return;
    const [att, logs, vis, comms] = await Promise.all([
      K.rows(K.sb.from("kaleos_attendance").select("service_date").eq("profile_id", id).order("service_date", { ascending: false }).limit(1)),
      K.rows(K.sb.from("kaleos_logbook").select("*").eq("profile_id", id).order("created_at", { ascending: false }).limit(10)),
      K.rows(K.sb.from("kaleos_visits").select("visited_on, note").eq("profile_id", id).order("visited_on", { ascending: false }).limit(5)),
      K.rows(K.sb.from("kaleos_community_members").select("community_id").eq("profile_id", id)),
    ]);
    const all = await K.communities(), mine = all.filter((c) => comms.some((x) => x.community_id === c.id));
    let setLevel = () => {};
    const entries = [...logs.map((l) => ({ d: l.created_at.slice(0, 10), t: "Nota", n: l.note, i: "editar" })), ...vis.map((v) => ({ d: v.visited_on, t: "Visita", n: v.note || "", i: "visita" }))].sort((a, b) => b.d.localeCompare(a.d));
    K.sheet(`<div class="sh"><div class="row" style="flex:1;min-width:0"><span class="avatar lg">${esc(K.ini(p.full_name))}</span><div><h2 style="font-size:28px">${esc(p.full_name)}</h2><span class="mono muted" style="font-size:12px">${esc(p.member_no)}</span></div></div><button class="iconbtn" data-close aria-label="Cerrar">${ic("close")}</button></div>
      <div class="facts"><div><span class="eyebrow">Nivel</span><b>${esc((K.LV[p.level] || K.LV.adherente).n)}</b></div><div><span class="eyebrow">Asistió</span><b>${att[0] ? K.fmtDate(att[0].service_date, "ds") : "Nunca"}</b></div><div><span class="eyebrow">Teléfono</span><b class="mono" style="font-size:12.5px">${esc(p.phone || "—")}</b></div></div>
      <div class="row" style="justify-content:space-between;flex-wrap:wrap"><span class="muted" style="font-size:13px">${mine.length ? ic("comunidades", "xs") + " " + esc(mine.map((c) => c.name).join(" · ")) : "Sin comunidad"}</span>${K.dd("plv", { right: true, label: "Nivel", options: () => K.LEVELS.map(([v, l, d]) => ({ v, l, s: d.split(".")[0] })), value: () => p.level, pick: (v) => setLevel(v) })}</div>
      <div><div class="eyebrow">Bitácora</div><div class="list">${entries.length ? entries.map((x) => `<div class="li">${ic(x.i)}<div class="g"><b>${x.t}</b><span class="s">${esc(x.n)}${x.n ? " · " : ""}${K.fmtDate(x.d, "ds")}</span></div></div>`).join("") : '<p class="muted">Aún no hay notas.</p>'}</div></div>
      <div class="field"><label for="bnote">Anotar en la bitácora</label><textarea class="inp" id="bnote" placeholder="Qué conversaron, qué necesita, a qué quedaron"></textarea></div>
      <div class="row"><button class="btn" style="flex:1" id="bsave">${ic("editar")}Guardar nota</button><button class="btn sec" style="flex:1" id="bvis">${ic("visita")}Visita</button></div>
      <div class="row" style="flex-wrap:wrap">${p.phone ? `<a class="btn sec sm" href="${K.waLink(p.phone, "")}" target="_blank" rel="noopener">${ic("chat", "xs")}WhatsApp</a><a class="btn sec sm" href="tel:${esc(K.phoneDigits(p.phone))}">${ic("llamar", "xs")}Llamar</a>` : ""}
        <button class="btn sec sm" id="bed">${ic("editar", "xs")}Editar datos</button><button class="btn sec sm" id="bpin">Nuevo PIN</button></div>`, (s, close) => {
      setLevel = async (v) => {
        const { error } = await K.sb.from("kaleos_profiles").update({ level: v }).eq("id", p.id);
        if (error) return K.toast(K.errMsg(error), 4000);
        p.level = v; K.bust("people"); K.toast(`Ahora es ${K.LV[v].n}`); close(); if (after) after();
      };
      $("#bsave", s).addEventListener("click", async () => {
        const note = $("#bnote", s).value.trim(); if (!note) return K.toast("Escriba la nota");
        const { error } = await K.sb.from("kaleos_logbook").insert({ church_id: K.me.church_id, profile_id: p.id, note });
        if (error) return K.toast(K.errMsg(error), 4000);
        K.toast("Nota guardada en la bitácora"); personSheet(id, after);
      });
      $("#bvis", s).addEventListener("click", () => K.visitSheet(p, () => personSheet(id, after)));
      $("#bed", s).addEventListener("click", () => { close(); setTimeout(() => K.editPerson(p, after), 300); });
      $("#bpin", s).addEventListener("click", async () => {
        if (!confirm(`¿Crear un PIN nuevo para ${p.full_name}? El anterior dejará de funcionar.`)) return;
        try { const r = await K.callAdmin({ action: "reset_pin", profile_id: p.id }); K.credentialsSheet(p.full_name, p.phone, r.member_no, r.pin); }
        catch (err) { K.toast(K.errMsg(err)); }
      });
    });
  }

  // ===== Mayordomía: el pastor también da (sin diezmo) =====
  async function viewMayordomia(el) {
    await K.viewDar(el);
    el.insertAdjacentHTML("beforeend", `<p class="fine">Su diezmo se entrega a la oficina territorial. Las cifras de la iglesia están en «Controles».</p>`);
  }

  // ===== Controles: solo ver lo que Secretaría registra en la Central =====
  const CTL = [["ingresos", "Ingresos", "viewIncome"], ["estadisticas", "Estadísticas", "viewStats"], ["proyectos", "Proyectos", "viewProjects"]];
  async function viewControles(el) {
    if (!CTL.some(([v]) => v === P.ctl)) P.ctl = "ingresos";
    el.innerHTML = `<div class="sec-h"><h2>Controles</h2><span class="pill">${esc(K.cap(K.MONTHS[+K.today().slice(5, 7) - 1]))}</span></div>
      <div class="tabs" role="tablist">${CTL.map(([v, l]) => `<button role="tab" aria-selected="${P.ctl === v}" data-ctl="${v}">${l}</button>`).join("")}</div>
      <div id="ctlb" class="stack ctl-view"></div>
      <p class="fine">Solo para ver. Los datos los registra Secretaría en Kaleos Central.</p>`;
    K.on(el, "[data-ctl]", (b) => { P.ctl = b.dataset.ctl; K.mount(el, viewControles); });
    K.mount($("#ctlb", el), K[CTL.find(([v]) => v === P.ctl)[2]]);
  }

  // ===== Iglesia (datos y aviso de la semana) =====
  async function viewIglesia(el) {
    const [n] = await K.rows(K.sb.from("kaleos_notices").select("*").eq("church_id", K.me.church_id).order("created_at", { ascending: false }).limit(1));
    const ch = K.church;
    el.innerHTML = `<div class="sec-h"><h2>Iglesia</h2></div>
      <div class="stack"><div class="eyebrow">Aviso de la semana (en «Mi iglesia»)</div>
        ${n ? `<p class="fine">Actual: ${esc(n.title)} · ${K.dpart(n.created_at, { day: "numeric", month: "long" })}</p>` : ""}
        <div class="field"><label for="nt">Título</label><input class="inp" id="nt" value="Aviso de la semana"></div>
        <div class="field"><label for="nb">Aviso</label><textarea class="inp" id="nb" placeholder="Vigilia de oración, viernes a las 19:00."></textarea></div>
        <div class="grid2"><div class="field"><label for="st">Predicación (título)</label><input class="inp" id="st" value="${esc(n?.sermon_title || "")}"></div>
          <div class="field"><label for="su">Enlace (YouTube, Facebook…)</label><input class="inp" id="su" inputmode="url" value="${esc(n?.sermon_url || "")}"></div></div>
        <button class="btn block" id="pub">Publicar aviso</button></div>
      <div class="hr"></div>
      <div class="stack"><div class="eyebrow">Datos de la iglesia</div>
        <div class="field"><label for="cn">Nombre</label><input class="inp" id="cn" value="${esc(ch.name || "")}"></div>
        <div class="field"><label for="cm">Misión</label><textarea class="inp" id="cm">${esc(ch.mission || "")}</textarea></div>
        <div class="field"><label for="cw">Enlace de la comunidad de WhatsApp</label><input class="inp" id="cw" inputmode="url" value="${esc(ch.whatsapp_url || "")}" placeholder="https://chat.whatsapp.com/…"></div>
        <div class="field"><label for="cg">Cuenta para transferencias (la ven los hermanos al dar)</label><textarea class="inp" id="cg" placeholder="Banco, tipo y número de cuenta, a nombre de…">${esc(ch.giving_info || "")}</textarea></div>
        <div class="field"><label for="cp">Teléfono del pastor</label><input class="inp" id="cp" inputmode="tel" value="${esc(ch.pastor_phone || "")}"></div>
        <div class="grid2"><div class="field"><label for="sn">Supervisor</label><input class="inp" id="sn" value="${esc(ch.supervisor_name || "")}"></div>
          <div class="field"><label for="se">Correo del supervisor</label><input class="inp" id="se" type="email" value="${esc(ch.supervisor_email || "")}"></div></div>
        <button class="btn block" id="sv">Guardar datos</button></div>`;
    $("#pub", el).addEventListener("click", async () => {
      const body = $("#nb", el).value.trim(); if (!body) return K.toast("Escriba el aviso");
      const { error } = await K.sb.from("kaleos_notices").insert({ church_id: K.me.church_id, created_by: K.me.id, title: $("#nt", el).value.trim() || "Aviso de la semana",
        body, sermon_title: $("#st", el).value.trim() || null, sermon_url: $("#su", el).value.trim() || null });
      if (error) return K.toast(K.errMsg(error));
      K.toast("Aviso publicado"); K.mount(el, viewIglesia);
    });
    $("#sv", el).addEventListener("click", async () => {
      const v = (id) => $("#" + id, el).value.trim() || null;
      const f = { name: v("cn"), mission: v("cm"), whatsapp_url: v("cw"), giving_info: v("cg"), pastor_phone: v("cp"), supervisor_name: v("sn") || "Supervisor de Distrito", supervisor_email: v("se") };
      const { data, error } = await K.sb.from("kaleos_churches").update(f).eq("id", K.me.church_id).select().single();
      if (error) return K.toast(K.errMsg(error));
      K.church = data; K.toast("Datos guardados");
    });
  }

  // ===== estructura =====
  const SECS = [
    ["asistente", "Asistente", "asistente", () => "Pídale lo que necesite"],
    ["versiculos", "Versículos", "versiculos", () => "Diseñe el versículo del día"],
    ["pedidos", "Pedidos", "pedidos", () => "Oración, visitas y felicitaciones"],
    ["agenda", "Agenda", "agenda", () => "Cultos, reuniones y recordatorios"],
    ["hermanos", "Hermanos", "hermanos", () => "Bitácora y niveles"],
    ["comunidades", "Comunidades", "comunidades", () => "Avisos y orientaciones"],
    ["saludos", "Saludos", "saludos", () => "Tarjetas de cumpleaños y aniversarios"],
    ["mayordomia", "Mayordomía", "dar", () => "Ofrendar, donar y proyectos"],
    ["controles", "Controles", "informes", () => "Estadísticas, ingresos y proyectos"],
    ["reporte", "Reporte", "reporte", () => "Reporte ministerial del mes"],
    ["iglesia", "Iglesia", "iglesia", () => "Aviso de la semana y datos"],
  ];
  const VIEWS = { asistente: viewAsistente, versiculos: viewVersiculos, pedidos: viewPedidos, agenda: viewAgenda, hermanos: viewHermanos,
    comunidades: (el) => K.viewComms(el, true, P), saludos: K.viewGreetings, mayordomia: viewMayordomia, controles: viewControles, reporte: K.viewReport, iglesia: viewIglesia };
  function header() {
    return K.dd("psec", { cls: "secdd", icon: SECS.find((s) => s[0] === P.sec)[2], options: () => SECS.map(([v, l, i, s]) => ({ v, l, icon: i, s: s() })), value: () => P.sec, pick: (v) => setSec(v) }) +
      `<span style="margin-left:auto"></span>${K.userMenu()}`;
  }
  function setSec(v) {
    if (!VIEWS[v]) return;
    if (v === "comunidades") P.comm = null;
    P.sec = v; $("#ph").innerHTML = header();
    K.mount($("#pm"), VIEWS[v]); scrollTo(0, 0);
  }
  K.pastorGo = setSec;
  K.pastorSecs = SECS.map(([v, l]) => [v, l]);
  // lo que usa la conversación por voz (voz.js)
  K.pastorData = { requests, upcoming, reminders, bdaysWithin, age, ask: (text) => { const el = $("#pm"); if (P.sec === "asistente" && el) return ask(el, text); } };
  K.shells.pastor = {
    render(app) {
      if (!VIEWS[P.sec]) P.sec = "asistente";
      app.innerHTML = `<div class="phone"><header class="ah" id="ph"></header><main class="main" id="pm"></main></div>`;
      setSec(P.sec);
    },
  };
})();
