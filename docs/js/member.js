/* Kaleos: app del miembro (carnet, versículo del día, anuncios, comunidades, pedidos, mayordomía y camino). */
(function () {
  "use strict";
  const K = window.K, { esc, $, $$, ic } = K;
  const M = (K.M = { tab: "inicio", comm: null, ctab: "avisos", feed: "todo", giveTab: "proyectos" });

  // ===== anuncios (con confirmación de asistencia) =====
  const ANN_KINDS = ["invitacion", "recordatorio", "aviso"];
  K.RSVP_L = { si: ["Asistiré", "check"], tal: ["Me interesa", "estrella"], no: ["No podré", "close"] };
  K.anns = () => K.load("anns", async () => {
    const since = new Date(Date.now() - 14 * 86400000).toISOString(), now = new Date(Date.now() - 12 * 3600000).toISOString();
    const list = await K.rows(K.sb.from("kaleos_messages").select("*").eq("church_id", K.me.church_id).is("profile_id", null)
      .in("kind", ANN_KINDS).or(`event_at.gte.${now},and(event_at.is.null,created_at.gte.${since})`).limit(80));
    list.sort((a, b) => (a.event_at || a.created_at).localeCompare(b.event_at || b.created_at));
    const rs = list.length ? await K.rows(K.sb.from("kaleos_rsvp").select("message_id, profile_id, answer").in("message_id", list.map((a) => a.id))) : [];
    return { list, rs };
  });
  const mineOf = (rs, id) => (rs.find((r) => r.message_id === id && r.profile_id === K.me.id) || {}).answer;
  const countOf = (rs, id, k) => rs.filter((r) => r.message_id === id && r.answer === k).length;
  const annDate = (a) => new Date(a.event_at || a.created_at);
  const annTag = (a, comms) => {
    if (a.community_id) { const c = comms.find((x) => x.id === a.community_id); return `<span class="tag">${ic(c ? c.emblem : "comunidades")}${esc(c ? c.name : "Comunidad")}</span>`; }
    if (a.levels && a.levels.length) return `<span class="tag">${ic("camino")}Para ${esc(a.levels.map((l) => K.LV_PL[l] || l).join(" y "))}</span>`;
    return `<span class="tag">${ic("inicio")}Toda la iglesia</span>`;
  };
  K.annRow = (a, rs, comms) => {
    const t = K.artOf(a.id, a.art), d = annDate(a), r = mineOf(rs, a.id), n = countOf(rs, a.id, "si");
    return `<button class="ann" data-ann="${a.id}">
      <span class="thumb">${K.artCv(t.k, t.p, t.s)}<span class="dt"><b>${K.dpart(d, { day: "numeric" })}</b><span>${K.dpart(d, { month: "short" }).replace(".", "")}</span></span></span>
      <span class="ann-t">${annTag(a, comms)}<h3>${esc(a.title)}</h3><span class="meta">${a.event_at ? esc(K.cap(K.fmtWhen(a.event_at))) : "Publicado el " + K.dpart(d, { day: "numeric", month: "long" })}${a.place ? " · " + esc(a.place) : ""}</span>
      ${a.event_at ? `<span class="rs">${r ? `<span class="pill ${r === "si" ? "ok" : r === "tal" ? "warn" : ""}">${r === "si" ? ic("check", "xs") : ""}${K.RSVP_L[r][0]}</span>` : ""}${n ? `<span>${n} ${n === 1 ? "asistirá" : "asistirán"}</span>` : ""}</span>` : ""}</span>
      ${ic("right", "sm go")}</button>`;
  };
  K.openAnn = (a, rs, comms, after) => {
    if (!a) return;
    const t = K.artOf(a.id, a.art), light = K.isLight(t.p), d = a.event_at ? new Date(a.event_at) : null;
    K.sheet(`<div class="evhero ${light ? "light" : "on-art"}">${K.artCv(t.k, t.p, t.s)}${d ? `<span class="evc"><span class="evd"><b>${K.dpart(d, { day: "numeric" })}</b><span>${K.dpart(d, { month: "long" })}<br>${K.dpart(d, { weekday: "long" })}</span></span></span>` : ""}</div>
      <div class="sh"><div style="flex:1;min-width:0"><span class="eyebrow">${esc(K.targetLabel(a, comms))}</span><h2 style="margin-top:6px">${esc(a.title)}</h2></div><button class="iconbtn" data-close aria-label="Cerrar">${ic("close")}</button></div>
      ${d || a.place ? `<div class="list">${d ? `<div class="li">${ic("agenda")}<div class="g"><b>${esc(K.cap(K.dpart(d, { weekday: "long", day: "numeric", month: "long" })))}</b><span class="s">${esc(K.fmtTime(a.event_at))}</span></div></div>` : ""}
        ${a.place ? `<div class="li">${ic("iglesia")}<div class="g"><b>${esc(a.place)}</b><span class="s">Iglesia de Dios E.C. · ${esc(K.churchShort())}</span></div></div>` : ""}</div>` : ""}
      ${a.body ? `<p style="font-size:16px;white-space:pre-line">${esc(a.body)}</p>` : ""}
      ${d ? `<div class="rsvp" role="radiogroup" aria-label="Confirmar asistencia">${Object.entries(K.RSVP_L).map(([k, [l, i]]) => `<button role="radio" aria-checked="false" data-r="${k}">${ic(i)}${l}</button>`).join("")}</div>
        <p class="muted" style="font-size:13px" id="kcount"></p>` : ""}
      <button class="btn sec block" id="ainv">${ic("chat")}Invitar por WhatsApp</button>`, (s) => {
      const paint = () => {
        const m = mineOf(rs, a.id);
        $$("[data-r]", s).forEach((b) => b.setAttribute("aria-checked", b.dataset.r === m));
        const c = $("#kcount", s), si = countOf(rs, a.id, "si"), tal = countOf(rs, a.id, "tal");
        if (c) c.innerHTML = `<b style="color:var(--ink)">${si} ${si === 1 ? "asistirá" : "asistirán"}</b> · ${tal} ${tal === 1 ? "interesado" : "interesados"}`;
      };
      K.on(s, "[data-r]", async (b) => {
        const k = b.dataset.r, prev = mineOf(rs, a.id), i = rs.findIndex((r) => r.message_id === a.id && r.profile_id === K.me.id);
        if (i >= 0) rs.splice(i, 1);
        if (prev !== k) rs.push({ message_id: a.id, profile_id: K.me.id, answer: k });
        paint();
        const q = prev === k ? K.sb.from("kaleos_rsvp").delete().eq("message_id", a.id).eq("profile_id", K.me.id)
          : K.sb.from("kaleos_rsvp").upsert({ message_id: a.id, profile_id: K.me.id, church_id: K.me.church_id, answer: k, updated_at: new Date().toISOString() }, { onConflict: "message_id,profile_id" });
        const { error } = await q;
        if (error) return K.toast(K.errMsg(error), 4000);
        K.toast(prev === k ? "Respuesta quitada" : k === "si" ? "¡Le esperamos! Su pastor ya sabe que asistirá." : "Respuesta guardada");
        if (after) after();
      });
      $("#ainv", s).addEventListener("click", () => {
        const cv = document.createElement("canvas"); K.drawAnn(cv, a);
        K.shareCanvas(cv, `${a.title}${a.event_at ? "\n🗓️ " + K.cap(K.fmtWhen(a.event_at)) : ""}${a.place ? "\n📍 " + a.place : ""}\n\nLe invito: ${K.churchShort()}, Iglesia de Dios E.C.`, "anuncio-kaleos.png");
      });
      paint();
    });
  };

  // ===== mensajes personales del pastor =====
  const inbox = () => K.load("msgs", async () => {
    const [msgs, reads] = await Promise.all([
      K.rows(K.sb.from("kaleos_messages").select("*").eq("church_id", K.me.church_id).eq("profile_id", K.me.id).order("created_at", { ascending: false }).limit(40)),
      K.rows(K.sb.from("kaleos_message_reads").select("message_id").eq("profile_id", K.me.id)),
    ]);
    return { msgs, read: new Set(reads.map((r) => r.message_id)) };
  });
  const unread = async () => { const { msgs, read } = await inbox(); return msgs.filter((x) => !read.has(x.id)).length; };
  async function viewInbox(el) {
    const { msgs, read } = await inbox();
    el.innerHTML = `<div class="sec-h"><h2>Mis mensajes</h2></div>
      <div class="list">${msgs.length ? msgs.map((x, i) => `<button class="li" data-i="${i}">${ic(x.kind === "felicitacion" ? "felicitacion" : x.kind === "recordatorio" ? "agenda" : "avisos")}
        <span class="g"><b>${esc(x.title)}</b><span class="s">${esc((K.MSG_KINDS[x.kind] || K.MSG_KINDS.aviso).n)} · ${K.dpart(x.created_at, { day: "numeric", month: "long" })}</span></span>
        ${read.has(x.id) ? ic("right", "sm") : '<span class="pill warn">Nuevo</span>'}</button>`).join("") : '<p class="empty">Aún no tiene mensajes. Aquí le llegan las felicitaciones, turnos y recordatorios de su pastor.</p>'}</div>`;
    K.on(el, "[data-i]", (b) => openMessage(msgs[b.dataset.i]));
  }
  async function openMessage(x) {
    K.sheet(`${K.head(x.title, (K.MSG_KINDS[x.kind] || K.MSG_KINDS.aviso).n)}
      <canvas class="gcard" aria-label="Imagen del mensaje" hidden></canvas>
      ${x.body ? `<p style="font-size:17px;white-space:pre-line">${esc(x.body)}</p>` : ""}
      ${x.event_at ? `<div class="li">${ic("agenda")}<div class="g"><b>${esc(K.cap(K.fmtWhen(x.event_at)))}</b>${x.place ? `<span class="s">${esc(x.place)}</span>` : ""}</div></div>` : ""}
      <div class="row"><button class="btn sec" style="flex:1" id="ls">${ic("escuchar", "sm")}Escuchar</button><button class="btn sec" style="flex:1" id="sv" hidden>Guardar imagen</button></div>
      <button class="btn block" data-close>Listo</button>`, async (s) => {
      $("#ls", s).addEventListener("click", () => K.speak(`${x.title}. ${x.body || ""}`));
      const cv = $(".gcard", s);
      try {
        if (await K.drawMessageCard(cv, x)) {
          cv.hidden = false; $("#sv", s).hidden = false;
          $("#sv", s).addEventListener("click", () => K.shareCanvas(cv, x.title, "mensaje-kaleos.png"));
        }
      } catch (_) {}
    });
    await K.sb.from("kaleos_message_reads").upsert({ message_id: x.id, profile_id: K.me.id }, { onConflict: "message_id,profile_id", ignoreDuplicates: true });
    K.bust("msgs");
    refreshBadge();
    if (M.tab === "mensajes") K.mount($("#mm"), viewInbox);
  }
  async function refreshBadge() {
    const n = await unread().catch(() => 0);
    const b = $(".ah .avatar");
    if (!b) return;
    let d = $(".ah .badge");
    if (!n) { if (d) d.remove(); return; }
    if (!d) { b.insertAdjacentHTML("afterend", '<b class="badge" style="position:relative;left:-14px;top:-12px;min-width:17px;height:17px;padding:0 5px;border-radius:99px;background:var(--wine);color:#fff;font:700 10.5px/17px var(--f-body)"></b>'); d = $(".ah .badge"); }
    d.textContent = n;
  }

  // ===== mis datos =====
  K.member = {};
  K.member.myData = (welcome) => {
    const me = K.me;
    let ch = me.preferred_channel || "whatsapp";
    K.sheet(`${K.head(welcome === true ? "¡Bienvenido a Kaleos!" : "Mis datos")}
      <p class="muted">${welcome === true ? "Antes de empezar, revise sus datos. Con ellos su pastor le felicita y le avisa de las actividades." : "Con estos datos su pastor le felicita y le avisa de las actividades."}</p>
      <div class="field"><label for="dphone">Teléfono (WhatsApp)</label><input class="inp" id="dphone" inputmode="tel" value="${esc(me.phone || "")}" placeholder="5555 5555"></div>
      <div class="field"><label for="demail">Correo</label><input class="inp" id="demail" type="email" inputmode="email" value="${esc(me.email || "")}" placeholder="nombre@correo.com"></div>
      <div class="grid2"><div class="field"><label for="dbday">Cumpleaños</label><input class="inp" id="dbday" type="date" value="${esc(me.birthday || "")}"></div>
        <div class="field"><label for="dwed">Aniversario de bodas</label><input class="inp" id="dwed" type="date" value="${esc(me.wedding_date || "")}"></div></div>
      <div class="field"><span class="flabel">¿Cómo prefiere recibir los mensajes?</span>
        <div class="chips">${Object.entries(K.CHANNELS).map(([k, l]) => `<button type="button" class="chip" data-ch="${k}" aria-pressed="false">${ic(k === "whatsapp" ? "chat" : k === "correo" ? "sobre" : "kaleos")}${l}</button>`).join("")}</div>
        <span class="fine">Siempre le llegan también a «Mis mensajes» en Kaleos.</span></div>
      <button class="btn block" id="dsave">Guardar mis datos</button>`, (s, close) => {
      const mark = () => $$("[data-ch]", s).forEach((b) => b.setAttribute("aria-pressed", b.dataset.ch === ch));
      K.on(s, "[data-ch]", (b) => { ch = b.dataset.ch; mark(); });
      mark();
      $("#dsave", s).addEventListener("click", async (e) => {
        const f = { p_phone: $("#dphone", s).value.trim(), p_email: $("#demail", s).value.trim(), p_birthday: $("#dbday", s).value || null, p_wedding: $("#dwed", s).value || null, p_channel: ch };
        if (ch === "whatsapp" && !f.p_phone) return K.toast("Escriba su teléfono para recibir por WhatsApp");
        if (ch === "correo" && !f.p_email) return K.toast("Escriba su correo para recibir por correo");
        e.currentTarget.disabled = true;
        const { error } = await K.sb.rpc("kaleos_update_my_contact", f);
        if (error) { e.currentTarget.disabled = false; return K.toast(K.errMsg(error), 4000); }
        Object.assign(me, { phone: f.p_phone || null, email: f.p_email || null, birthday: f.p_birthday, wedding_date: f.p_wedding, preferred_channel: ch, contact_updated_at: new Date().toISOString() });
        K.toast("Datos guardados. ¡Gracias!"); close();
      });
    });
  };

  // ===== Inicio =====
  K.verseOfDay = () => K.load("verse", async () => {
    const since = new Date(Date.now() - 2 * 86400000).toISOString();
    const [v] = await K.rows(K.sb.from("kaleos_verses").select("*").eq("church_id", K.me.church_id).gte("created_at", since).order("created_at", { ascending: false }).limit(1));
    if (!v) return { ...K.defaultVerse(), pastor: false };
    const st = v.style || {};
    return { ...K.defaultVerse(), ...st, ref: v.ref, text: v.body, fmt: st.fmt === "historia" ? "post" : st.fmt || "cuadrado", firma: st.firma !== false, pastor: true };
  }, 300000);
  function carnet(myComms) {
    const me = K.me, li = (K.LV[me.level] || K.LV.adherente).i;
    return `<div class="mc" id="mc" role="button" tabindex="0" aria-label="Mi tarjeta de membresía. Toque para ver el código.">
      <div class="mc-in">
        <div class="mc-f"><canvas data-guil aria-hidden="true"></canvas>
          <div class="mc-c">
            <div class="mc-top"><div><div class="eyebrow">Iglesia de Dios E.C.</div><div class="eyebrow" style="margin-top:3px">${esc(K.churchShort())}</div></div>${K.orbMark("mc-k")}</div>
            <div class="mc-name foil">${esc(me.full_name)}</div>
            <div class="mc-row">
              <div class="mc-lv"><span class="lbl">${me.role === "member" ? "Nivel" : esc(K.ROLE_NAME[me.role])}</span><i>${esc((K.LV[me.level] || K.LV.adherente).n)}</i><div class="ladder">${K.LEVELS.map((_, i) => `<span class="${i <= li ? "on" : ""}"></span>`).join("")}</div></div>
              <div class="mc-code">${esc(me.member_no)}<br><span style="opacity:.6">${me.member_since ? "desde " + String(me.member_since).slice(0, 4) : ""}</span></div>
            </div>
          </div>
        </div>
        <div class="mc-f mc-b"><div class="mc-qr"><div class="qr">${K.qrSvg("KALEOS:" + me.qr_token)}</div><div class="eyebrow" style="color:rgba(244,238,223,.75)">Muéstrelo al ujier · ${esc(me.member_no)}</div></div></div>
      </div>
    </div>
    <div class="mc-hint"><span>Toque la tarjeta para ver su código</span><button class="linkbtn" id="mydata">Mis datos</button></div>
    ${myComms.length ? `<p class="fine" style="margin-top:-18px">${esc(myComms.map((c) => c.name).join(" · "))}</p>` : ""}`;
  }
  async function viewInicio(el) {
    const [{ list, rs }, comms, verse] = await Promise.all([K.anns(), K.communities(), K.verseOfDay()]);
    const mineC = comms.filter((c) => c.mine);
    let items = list;
    if (M.feed === "iglesia") items = items.filter((a) => !a.community_id && !(a.levels && a.levels.length));
    if (M.feed === "comunidades") items = items.filter((a) => a.community_id);
    if (M.feed === "nivel") items = items.filter((a) => a.levels && a.levels.length);
    if (M.feed === "voy") items = items.filter((a) => mineOf(rs, a.id) === "si");
    const bday = K.isBirthday(K.me);
    el.innerHTML = `${bday ? `<div class="banner bday"><span class="eyebrow">Hoy, ${K.fmtDate(K.today(), "dm")}</span><b>¡Feliz cumpleaños, ${esc(K.first(K.me.full_name))}!</b><span>Del pastor y toda la congregación</span></div>` : ""}
      ${carnet(mineC)}
      <section class="stack"><div class="sec-h"><h2>Versículo del día</h2><span class="fine">${esc(K.cap(K.dpart(new Date(), { weekday: "long", day: "numeric", month: "long" })))}</span></div>
        ${K.vcv(verse)}
        <div class="row" style="justify-content:space-between"><span class="row" style="gap:8px;font-size:13px;color:var(--ink-2)">${verse.pastor ? `<span class="avatar" style="width:26px;height:26px;font-size:10px">P</span>Lo eligió su pastor` : "Reina-Valera 1960"}</span><button class="lnk" style="margin:0" id="vshare">${ic("chat")}Compartir</button></div></section>
      <section class="feed">
        <div class="sec-h"><h2>Anuncios</h2>${K.dd("feed", { right: true, options: () => [{ v: "todo", l: "Todo" }, { v: "iglesia", l: "Toda la iglesia" }, { v: "comunidades", l: "Mis comunidades" }, { v: "nivel", l: "Para mi nivel" }, { sep: 1 }, { v: "voy", l: "A los que asistiré", icon: "check" }], value: () => M.feed, pick: (v) => { M.feed = v; K.mount(el, viewInicio); } })}</div>
        <div class="annlist">${items.length ? items.map((a) => K.annRow(a, rs, comms)).join("") : `<p class="empty">${list.length ? "No hay anuncios con este filtro." : "Aún no hay anuncios. Aquí aparecen los cultos, reuniones y actividades."}</p>`}</div>
      </section>`;
    const mc = $("#mc", el);
    const flip = () => { mc.classList.toggle("flip"); };
    mc.addEventListener("click", flip);
    mc.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });
    $("#mydata", el).addEventListener("click", () => K.member.myData());
    $("#vshare", el).addEventListener("click", () => K.shareCanvas($("canvas[data-vc]", el), `«${verse.text}» ${verse.ref}`, "versiculo-del-dia.png"));
    K.on(el, "[data-ann]", (b) => K.openAnn(list.find((a) => String(a.id) === b.dataset.ann), rs, comms, () => { K.bust("anns"); K.mount(el, viewInicio); }));
    if (bday && !M.confetti) { M.confetti = 1; K.confetti(); }
  }

  // ===== Comunidades (miembro y pastor) =====
  const commCover = (c, mine) => {
    const light = K.isLight(c.palette);
    return `<button class="cv ${light ? "light" : "on-art"}" data-comm="${c.id}">${K.artCv(c.style, c.palette, c.seed)}
      <span class="ccontent">${ic(c.emblem)}<h3>${esc(c.name)}</h3><span class="s">${esc(c.subtitle || "")}</span></span>${mine ? '<span class="tagc mine">Integrante</span>' : ""}</button>`;
  };
  // staff = el pastor ve todas y puede escribir la orientación
  K.viewComms = async (el, staff, state) => {
    const comms = await K.communities();
    if (state.comm) return commDetail(el, comms.find((c) => String(c.id) === String(state.comm)), staff, state);
    const mine = staff ? [] : comms.filter((c) => c.mine), other = comms.filter((c) => staff || !c.mine);
    el.innerHTML = `<div class="sec-h"><h2>${staff ? "Comunidades de la iglesia" : "Comunidades"}</h2></div>
      ${!comms.length ? '<p class="note">Las comunidades aparecen cuando se actualiza la base de datos.</p>' : ""}
      ${mine.length ? `<div class="stack"><div class="eyebrow">Mis comunidades</div><div class="cgrid">${mine.map((c) => commCover(c, true)).join("")}</div></div>` : ""}
      ${other.length ? `<div class="stack"><div class="eyebrow">${staff ? "Toque una para ver o escribir una orientación" : "Otras comunidades"}</div><div class="cgrid">${other.map((c) => commCover(c, false)).join("")}</div></div>` : ""}`;
    K.on(el, "[data-comm]", (b) => { state.comm = b.dataset.comm; state.ctab = "avisos"; K.mount(el, K.viewComms, staff, state); scrollTo(0, 0); });
  };
  async function commDetail(el, c, staff, state) {
    if (!c) { state.comm = null; return K.viewComms(el, staff, state); }
    const light = K.isLight(c.palette), mine = staff || c.mine;
    const tabs = [["avisos", "Avisos"], ["reuniones", "Reuniones"], ["orientacion", "Del pastor"], ["integrantes", "Integrantes"]];
    let body = "", anns = [], rs = [], comms = [];
    if (mine && (state.ctab === "avisos" || state.ctab === "reuniones")) {
      ({ list: anns, rs } = await K.anns()); comms = await K.communities();
      if (staff) anns = await K.rows(K.sb.from("kaleos_messages").select("*").eq("community_id", c.id).gte("event_at", new Date(Date.now() - 12 * 3600000).toISOString()).order("event_at").limit(30));
      else anns = anns.filter((a) => a.community_id === c.id);
    }
    if (!mine) body = `<div class="orient"><q>Esta comunidad comparte sus avisos, reuniones y orientaciones solo con sus integrantes.</q><p class="by">Pida unirse y el encargado le confirma.</p></div><button class="btn block" id="join">${ic("plus")}Pedir unirme</button>`;
    else if (state.ctab === "avisos") body = (anns.length ? `<div class="annlist">${anns.map((a) => K.annRow(a, rs, comms)).join("")}</div>` : '<p class="muted">Sin avisos por ahora.</p>') +
      (staff ? `<button class="btn sec block" id="newann">${ic("plus", "sm")}Nuevo aviso para ${esc(c.name)}</button>` : "");
    else if (state.ctab === "reuniones") body = `<div class="list">${[{ t: "Reunión regular", h: c.meets || "Por definir" }, ...anns.filter((a) => a.event_at).map((a) => ({ t: a.title, h: K.cap(K.fmtWhen(a.event_at)) }))].map((r) =>
      `<div class="li">${ic("agenda")}<div class="g"><b>${esc(r.t)}</b><span class="s">${esc(r.h)}</span></div></div>`).join("")}${c.sub_note ? `<div class="li">${ic("c_danza")}<div class="g"><b>${esc(c.sub_note)}</b><span class="s">Ministerio dentro de ${esc(c.name)}</span></div></div>` : ""}</div>`;
    else if (state.ctab === "orientacion") body = `${c.guidance ? `<div class="orient"><q>${esc(c.guidance)}</q><p class="by">Su pastor${c.guidance_at ? " · " + K.dpart(c.guidance_at, { weekday: "long", day: "numeric", month: "long" }) : ""}</p></div>` : '<p class="muted">El pastor aún no ha escrito una orientación para esta comunidad.</p>'}
      ${staff && K.me.role === "pastor" ? `<div class="field"><label for="orientTxt">Nueva orientación para ${esc(c.name)}</label><textarea class="inp" id="orientTxt" placeholder="Unas líneas de ánimo o un aviso para esta comunidad"></textarea></div><button class="btn block" id="orient">${ic("send")}Publicar${c.whatsapp_url ? " y abrir el grupo" : ""}</button>` : ""}`;
    else {
      const { data: ppl } = await K.sb.rpc("kaleos_community_people", { p_id: c.id });
      const list = ppl || [];
      body = `<p class="muted">${list.length} integrantes</p><div class="ppl">${list.slice(0, 24).map((p) => `<span class="p"><span class="avatar">${esc(K.ini(p.full_name))}</span>${esc(K.first(p.full_name))}</span>`).join("")}${list.length > 24 ? `<span class="p" style="padding-left:12px">y ${list.length - 24} más</span>` : ""}</div>`;
    }
    el.innerHTML = `<div class="hero ${light ? "light" : "on-art"}">${K.artCv(c.style, c.palette, c.seed)}
        <div class="hc"><button class="back" id="back">${ic("back", "sm")}Comunidades</button>${ic(c.emblem, "em")}<h1>${esc(c.name)}</h1><p class="s">${esc(c.subtitle || "")}</p></div></div>
      <div class="facts"><div><span class="eyebrow">Encargado</span><b>${esc(c.leader_name || "Por asignar")}</b></div><div><span class="eyebrow">Se reúne</span><b>${esc(c.meets || "—")}</b></div><div><span class="eyebrow">Integrantes</span><b class="num">${c.members}</b></div></div>
      ${mine && c.whatsapp_url ? `<a class="btn sec block" href="${esc(c.whatsapp_url)}" target="_blank" rel="noopener">${ic("chat")}Abrir el grupo de WhatsApp</a>` : ""}
      ${mine ? `<div class="tabs" role="tablist">${tabs.map(([v, l]) => `<button role="tab" aria-selected="${state.ctab === v}" data-ct="${v}">${l}</button>`).join("")}</div>` : ""}
      <div class="stack">${body}</div>`;
    const again = () => K.mount(el, K.viewComms, staff, state);
    $("#back", el).addEventListener("click", () => { state.comm = null; again(); });
    K.on(el, "[data-ct]", (b) => { state.ctab = b.dataset.ct; again(); });
    K.on(el, "[data-ann]", (b) => K.openAnn(anns.find((a) => String(a.id) === b.dataset.ann), rs, comms));
    const nb = $("#newann", el); if (nb) nb.addEventListener("click", () => K.annSheet({ prefill: { community: c.id }, after: () => { K.bust("anns"); again(); } }));
    const jb = $("#join", el);
    if (jb) jb.addEventListener("click", async () => {
      jb.disabled = true;
      const { error } = await K.sb.from("kaleos_prayer_requests").insert({ church_id: K.me.church_id, profile_id: K.me.id, kind: "otro", note: `Quiero unirme a ${c.name}.`, created_by: K.me.id });
      if (error) { jb.disabled = false; return K.toast(K.errMsg(error), 4000); }
      jb.textContent = "Pedido enviado"; K.toast("Su pastor y Secretaría recibieron su pedido");
    });
    const ob = $("#orient", el);
    if (ob) ob.addEventListener("click", async () => {
      const v = $("#orientTxt", el).value.trim();
      if (!v) return K.toast("Escriba la orientación");
      const { error } = await K.sb.from("kaleos_communities").update({ guidance: v, guidance_at: new Date().toISOString() }).eq("id", c.id);
      if (error) return K.toast(K.errMsg(error), 4000);
      K.bust("comms"); K.toast("Orientación publicada");
      if (c.whatsapp_url) { navigator.clipboard?.writeText(v).catch(() => {}); window.open(c.whatsapp_url, "_blank", "noopener"); K.toast("Copiada: péguela en el grupo de WhatsApp", 4000); }
      again();
    });
  }

  // ===== Pedir =====
  K.reqSheet = (kind, after) => {
    const r = K.REQ[kind];
    K.sheet(`${K.head(kind === "otro" ? "Otra cosa" : "Pedir " + r.n.toLowerCase())}
      ${kind === "felicitacion" || kind === "visita" ? `<div class="field"><label for="rf">${kind === "visita" ? "¿A quién visitamos?" : "¿Para quién?"}</label><input class="inp" id="rf" placeholder="Déjelo vacío si es para usted"></div>
      <div class="field"><label for="rd">${kind === "visita" ? "Día que le conviene (opcional)" : "Fecha de la celebración"}</label><input class="inp" id="rd" type="date"></div>` : ""}
      <div class="field"><label for="rn">${kind === "oracion" ? "¿Por qué oramos?" : "Nota para el pastor"}</label><textarea class="inp" id="rn" placeholder="${esc(r.h)}"></textarea></div>
      <button class="btn block" id="rs">${ic("send")}Enviar al pastor</button>`, (s) => {
      $("#rs", s).addEventListener("click", async (e) => {
        const note = $("#rn", s).value.trim(), forName = $("#rf", s) ? $("#rf", s).value.trim() : "", forDate = $("#rd", s) ? $("#rd", s).value : "";
        if (kind === "otro" && !note) return K.toast("Cuéntele al pastor qué necesita");
        e.currentTarget.disabled = true;
        const { error } = await K.sb.from("kaleos_prayer_requests").insert({ church_id: K.me.church_id, profile_id: K.me.id, kind, note: note || null,
          for_name: forName || null, for_date: forDate || null, created_by: K.me.id });
        if (error) { e.currentTarget.disabled = false; return K.toast(K.errMsg(error), 4000); }
        s.innerHTML = `<div class="grab"></div>${K.head("Pedido enviado")}<p style="font-size:17px">Su pastor ya lo tiene en su bandeja${kind === "oracion" ? " y la iglesia ora con usted" : ""}.</p><button class="btn sec block" data-close>Listo</button>`;
        if (after) after();
      });
    });
  };
  async function viewPedir(el) {
    const mine = await K.rows(K.sb.from("kaleos_prayer_requests").select("id, kind, note, for_name, for_date, status, created_at").eq("profile_id", K.me.id).order("created_at", { ascending: false }).limit(20));
    el.innerHTML = `<div class="ask-h"><span class="eyebrow">Pedir al pastor</span><h1 style="margin-top:10px">¿En qué le<span>acompañamos?</span></h1></div>
      <div class="rgrid">${Object.entries(K.REQ).map(([k, r]) => `<button class="rt" data-req="${k}">${ic(r.ic)}<span><b>${r.n}</b><span>${r.h}</span></span></button>`).join("")}</div>
      <section class="stack"><div class="sec-h"><h2 style="font-size:25px">Mis pedidos</h2></div>
      <div class="list">${mine.length ? mine.map((r) => `<div class="li">${ic(K.REQ[r.kind].ic)}<div class="g"><b>${K.REQ[r.kind].n}${r.for_name ? " · " + esc(r.for_name) : ""}</b><span class="s">${K.dpart(r.created_at, { day: "numeric", month: "short" })}${r.note ? " · " + esc(r.note) : ""}</span></div><span class="pill ${K.RSTAT[r.status][1]}">${K.RSTAT[r.status][0]}</span></div>`).join("") : '<p class="empty">Aún no ha hecho pedidos.</p>'}</div></section>`;
    K.on(el, "[data-req]", (b) => K.reqSheet(b.dataset.req, () => K.mount(el, viewPedir)));
  }

  // ===== Mayordomía =====
  const OFFERINGS = [["Gratitud", "Por lo que Dios ha hecho."], ["Siembra", "Una semilla con un propósito."], ["Promesa de fe", "Lo que usted prometió dar."]];
  K.projCard = (f, btn) => `<div class="proj"><span class="thumb" style="aspect-ratio:2.4;border-radius:14px">${K.artCv(f.style, f.palette, f.id + 30)}</span>
    <span class="eyebrow">${esc(f.subtitle || "Proyecto")}${f.until_label ? " · hasta " + esc(f.until_label) : ""}</span><h3>${esc(f.name)}</h3><div class="bar"><i style="width:${K.pct(f.got, f.goal)}%"></i></div>
    <div class="amts"><span><b class="num">${K.Q(f.got)}</b> de ${K.Q(f.goal)}</span><span class="num">${K.pct(f.got, f.goal)} %</span></div>${btn || ""}</div>`;
  K.viewDar = viewDar;
  async function viewDar(el) {
    const [funds, gifts] = await Promise.all([K.funds(), K.rows(K.sb.from("kaleos_gifts").select("*").eq("profile_id", K.me.id).order("created_at", { ascending: false }).limit(20))]);
    const projects = funds.filter((f) => f.kind === "proyecto" && f.active), needs = funds.filter((f) => f.kind === "necesidad" && f.active);
    // el diezmo del pastor va a la oficina territorial, no a la iglesia local
    const tabs = [["proyectos", "Proyectos"], ["donaciones", "Donaciones"], ["ofrendas", "Ofrendas"], ...(K.me.role === "pastor" ? [] : [["diezmos", "Diezmos"]])];
    if (!tabs.some(([v]) => v === M.giveTab)) M.giveTab = "proyectos";
    let body = "";
    if (M.giveTab === "proyectos") body = projects.length ? projects.map((p) => K.projCard(p, `<button class="btn sec" data-give="proyecto|${p.id}">${ic("dar")}Aportar</button>`)).join("") : '<p class="muted">No hay proyectos abiertos.</p>';
    else if (M.giveTab === "donaciones") body = `<p class="muted">Gastos fijos que la iglesia cubre cada mes.</p><div class="list">${needs.map((n) => `<div class="need">${ic(n.emblem || "dar", "lg")}<div><b>${esc(n.name)}</b><span class="muted" style="display:block;font-size:13px">${esc(n.subtitle || "")}</span><div class="bar" style="margin-top:8px"><i style="width:${K.pct(n.got, n.goal)}%"></i></div></div><button class="btn sec sm" data-give="donacion|${n.id}">Donar</button></div>`).join("") || '<p class="muted">Sin necesidades registradas.</p>'}</div>`;
    else if (M.giveTab === "ofrendas") body = `<p class="muted">Ofrendas voluntarias.</p><div class="rgrid">${OFFERINGS.map(([n, h]) => `<button class="rt" data-give="ofrenda|${n}">${ic("dar")}<span><b>${n}</b><span>${h}</span></span></button>`).join("")}</div>`;
    else body = `<div class="orient"><q>Traed todos los diezmos al alfolí.</q><p class="by">Malaquías 3:10</p></div><button class="btn block" data-give="diezmo|General">${ic("dar")}Dar mi diezmo</button><p class="fine">Solo usted, el pastor y Secretaría ven sus aportes.</p>`;
    el.innerHTML = `<div class="give-h"><span class="eyebrow">Mayordomía</span><h1 style="margin-top:10px">Dar con<br><em>alegría</em></h1></div>
      <div class="tabs" role="tablist">${tabs.map(([v, l]) => `<button role="tab" aria-selected="${M.giveTab === v}" data-gt="${v}">${l}</button>`).join("")}</div>
      <div class="stack">${body}</div>
      ${gifts.length ? `<section class="stack" id="mis-aportes"><div class="sec-h"><h2 style="font-size:25px">Mis aportes</h2></div><div class="list">${gifts.map((g) => `<div class="li">${ic(g.method === "sobre" ? "sobre" : "transferencia")}<div class="g"><b>${esc(K.GIFT_KINDS[g.kind])} · ${esc(g.dest)}</b><span class="s">${K.METHODS[g.method]} · ${esc(g.receipt || "")} · ${g.status === "confirmado" ? "Confirmado" : "Por confirmar"}</span></div><b class="num">${K.Q(g.amount)}</b></div>`).join("")}</div></section>` : ""}`;
    K.on(el, "[data-gt]", (b) => { M.giveTab = b.dataset.gt; K.mount(el, viewDar); });
    K.on(el, "[data-give]", (b) => {
      const [kind, x] = b.dataset.give.split("|"), f = funds.find((y) => String(y.id) === x);
      giveSheet(kind, f ? f.name : x, f ? f.id : null, () => { K.bust("funds"); K.mount(el, viewDar); });
    });
  }
  function giveSheet(kind, dest, fundId, after) {
    let method = "transferencia";
    const info = K.church.giving_info;
    const draw = (amt, ref) => `${K.head(K.GIFT_KINDS[kind], dest)}
      <div class="field"><label for="ga">Monto en quetzales</label><input class="inp num" id="ga" inputmode="numeric" value="${esc(amt)}" style="font:600 30px var(--f-disp)"></div>
      <div class="flabel">¿Cómo da?</div>
      <div class="methods" role="radiogroup">${[["transferencia", "Transferencia", "Deposite a la cuenta de la iglesia y escriba el número de boleta."], ["sobre", "Sobre con recibo digital", "Lo entrega en el culto; Secretaría lo confirma y le queda el recibo."], ["tarjeta", "Tarjeta · pronto", "El pago con tarjeta estará disponible más adelante."]]
        .map(([m, l, s]) => `<button class="method" role="radio" aria-checked="${method === m}" data-m="${m}" ${m === "tarjeta" ? 'aria-disabled="true" style="opacity:.55"' : ""}>${ic(m)}<span><b>${l}</b><span>${s}</span></span></button>`).join("")}</div>
      ${method === "transferencia" ? `<div class="note">${info ? esc(info).replace(/\n/g, "<br>") : "Pida a Secretaría el número de cuenta de la iglesia."}</div>
        <div class="field"><label for="gr">Número de boleta o referencia</label><input class="inp mono" id="gr" value="${esc(ref)}" placeholder="Opcional"></div>` : ""}
      <button class="btn block gold" id="gok">Continuar</button>`;
    K.sheet(draw("100", ""), function bind(s) {
      K.on(s, "[data-m]", (b) => {
        if (b.dataset.m === "tarjeta") return K.toast("El pago con tarjeta estará disponible pronto");
        method = b.dataset.m; const a = $("#ga", s).value, r = $("#gr", s) ? $("#gr", s).value : "";
        s.innerHTML = '<div class="grab"></div>' + draw(a, r); bind(s);
      });
      $("#gok", s).addEventListener("click", async (e) => {
        const amount = Math.max(0, parseInt($("#ga", s).value.replace(/\D/g, "")) || 0);
        if (!amount) return K.toast("Escriba el monto");
        e.currentTarget.disabled = true;
        const { data, error } = await K.sb.from("kaleos_gifts").insert({ church_id: K.me.church_id, profile_id: K.me.id, kind, dest, fund_id: fundId, method, amount,
          reference: $("#gr", s) ? $("#gr", s).value.trim() || null : null, status: "pendiente" }).select().single();
        if (error) { e.currentTarget.disabled = false; return K.toast(K.errMsg(error), 4000); }
        s.innerHTML = `<div class="grab"></div>${K.head("Recibo digital")}<div class="receipt"><span class="eyebrow">${esc(K.GIFT_KINDS[kind])} · ${esc(dest)}</span><span class="big num">${K.Q(amount)}</span>
          <span class="mono" style="font-size:13px">${esc(data.receipt || "")} · ${K.fmtDate(data.gift_date)} · ${K.METHODS[method]}</span><span class="muted" style="font-size:13px">${method === "transferencia" ? "Secretaría lo confirma al ver el depósito." : "Entregue el sobre con este número; Secretaría lo ingresa en la Central."}</span></div>
          <button class="btn sec block" data-close>Listo</button>`;
        if (after) after();
      });
    });
  }

  // ===== Mi camino =====
  async function viewCamino(el) {
    const li = (K.LV[K.me.level] || K.LV.adherente).i;
    el.innerHTML = `<div class="path-h"><span class="you">Usted es</span><h1>${esc(K.LEVELS[li][1])}</h1></div>
      <div class="steps">${K.LEVELS.map(([k, n, d], i) => `<div class="step ${i < li ? "done" : i === li ? "now" : "later"}"><span class="dot">${i < li ? ic("check", "xs") : i + 1}</span><div><b>${n}</b><p>${d}</p></div></div>`).join("")}</div>
      <p class="fine">Cada paso lo confirma el pastor. Al subir de nivel, Kaleos le muestra las reuniones y avisos de ese nivel.</p>`;
  }

  // ===== Mi iglesia =====
  async function viewIglesia(el) {
    const [n] = await K.rows(K.sb.from("kaleos_notices").select("*").eq("church_id", K.me.church_id).order("created_at", { ascending: false }).limit(1));
    const ch = K.church;
    el.innerHTML = `<div class="sec-h"><h2>Mi iglesia</h2></div>
      <div class="orient"><q>${esc(ch.mission || "Iglesia de Dios Evangelio Completo")}</q><p class="by">${esc(ch.name || "")}</p></div>
      ${n ? `<div class="stack"><div class="eyebrow">${esc(n.title)}</div><p style="font-size:16px;white-space:pre-line">${esc(n.body)}</p><button class="lnk" id="listen">${ic("escuchar")}Escuchar aviso</button></div>` : ""}
      <div class="list">
        ${n && n.sermon_url ? `<a class="li" href="${esc(n.sermon_url)}" target="_blank" rel="noopener">${ic("versiculos")}<span class="g"><b>${esc(n.sermon_title || "Predicación del domingo")}</b><span class="s">Ver o escuchar</span></span>${ic("right", "sm")}</a>` : ""}
        ${ch.whatsapp_url ? `<a class="li" href="${esc(ch.whatsapp_url)}" target="_blank" rel="noopener">${ic("chat")}<span class="g"><b>Comunidad de WhatsApp</b><span class="s">La comunidad de toda la iglesia</span></span>${ic("right", "sm")}</a>` : ""}
        ${ch.pastor_phone ? `<a class="li" href="tel:${esc(K.phoneDigits(ch.pastor_phone))}">${ic("llamar")}<span class="g"><b>Llamar al pastor</b><span class="s">${esc(ch.pastor_phone)}</span></span>${ic("right", "sm")}</a>` : ""}
      </div>`;
    if (n) $("#listen", el).addEventListener("click", () => K.speak(`${n.title}. ${n.body}`));
  }

  // ===== estructura =====
  const TABS = [["inicio", "Inicio", "inicio"], ["comunidades", "Comunidades", "comunidades"], ["pedir", "Pedir", "pedir"], ["dar", "Mayordomía", "dar"], ["camino", "Mi camino", "camino"]];
  const VIEWS = { inicio: viewInicio, comunidades: (el) => K.viewComms(el, false, M), pedir: viewPedir, dar: viewDar, camino: viewCamino, mensajes: viewInbox, iglesia: viewIglesia, escanear: K.viewScan };
  function go(tab) {
    K.stopScanner();
    M.tab = tab; if (tab === "comunidades") M.comm = null;
    $$(".tb button").forEach((b) => b.setAttribute("aria-current", b.dataset.mt === tab ? "page" : "false"));
    K.mount($("#mm"), VIEWS[tab]); scrollTo(0, 0);
  }
  K.shells.member = {
    render(app) {
      const extra = [{ v: "mensajes", l: "Mis mensajes", icon: "pedidos", go: () => go("mensajes") }, { v: "datos", l: "Mis datos", icon: "editar", go: () => K.member.myData() },
        { v: "iglesia", l: "Mi iglesia", icon: "iglesia", go: () => go("iglesia") },
        ...(K.canScan() && K.me.role === "usher" ? [{ v: "escanear", l: "Registrar asistencia", icon: "escanear", go: () => go("escanear") }] : []),
        ...(K.church.whatsapp_url ? [{ v: "wa", l: "Comunidad de WhatsApp", s: "La comunidad de toda la iglesia", icon: "chat", go: () => window.open(K.church.whatsapp_url, "_blank", "noopener") }] : [])];
      if (!VIEWS[M.tab]) M.tab = "inicio";
      app.innerHTML = `<div class="phone">
        <header class="ah"><div class="wm">${K.orbMark()}<b>Kaleos</b></div>${K.userMenu(extra)}</header>
        <main class="main" id="mm"></main>
        <nav class="tb" style="--n:5" aria-label="Secciones">${TABS.map(([k, l, i]) => `<button data-mt="${k}" aria-current="${M.tab === k ? "page" : "false"}">${ic(i)}${l}</button>`).join("")}</nav>
      </div>`;
      K.on(app, "[data-mt]", (b) => go(b.dataset.mt));
      go(M.tab);
      refreshBadge();
    },
  };
})();
