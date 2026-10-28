/* Kaleos Central: Secretaría (personas, comunidades, servicios, avisos, informes) y Mayordomía. */
(function () {
  "use strict";
  const K = window.K, { esc, $, $$, ic } = K;
  const C = (K.C = { view: "secretaria", cs: "personas", pq: "", plv: "todos", pcm: "todos", mt: "todos" });
  const isSec = () => K.me.role === "secretary";
  const ROLES_EDIT = { member: "Miembro", usher: "Ujier", secretary: "Secretaría", pastor: "Pastor" };

  // ===== datos de acceso de un hermano =====
  K.credentialsSheet = (name, phone, no, pin) => {
    const msg = `Bendiciones, ${K.first(name)}. Su tarjeta de membresía de ${K.churchShort()} ya está en Kaleos.\n\nEntre en ${location.origin + location.pathname}\nNúmero de miembro: ${no}\nPIN: ${pin}\n\nGuarde este mensaje.`;
    K.sheet(`${K.head("Tarjeta lista")}<p>Entréguele estos datos a <b>${esc(name)}</b>. El PIN solo se muestra esta vez.</p>
      <div class="secret"><span class="eyebrow">Número de miembro</span><b>${esc(no)}</b><span class="eyebrow" style="margin-top:8px">PIN</span><b>${esc(pin)}</b></div>
      ${phone ? `<a class="btn gold block" target="_blank" rel="noopener" href="${K.waLink(phone, msg)}">${ic("chat", "sm")}Enviar por WhatsApp</a>` : ""}
      <button class="btn sec block" id="cp">Copiar mensaje</button><button class="btn sec block" data-close>Listo</button>`, (s) => {
      $("#cp", s).addEventListener("click", () => navigator.clipboard.writeText(msg).then(() => K.toast("Mensaje copiado")));
    });
  };

  // ===== ficha de una persona (Central y pastor) =====
  K.editPerson = async (p, after) => {
    const comms = await K.communities();
    let mine = [], note = "";
    if (p) {
      const [cm, sn] = await Promise.all([
        K.rows(K.sb.from("kaleos_community_members").select("community_id").eq("profile_id", p.id)),
        K.rows(K.sb.from("kaleos_staff_notes").select("note").eq("profile_id", p.id)),
      ]);
      mine = cm.map((x) => x.community_id); note = (sn[0] && sn[0].note) || "";
    }
    const m = p || { title: "Hno.", level: "adherente", role: "member", active: true, preferred_channel: "whatsapp" };
    const opt = (pairs, v) => pairs.map(([k, l]) => `<option value="${k}" ${k === v ? "selected" : ""}>${l}</option>`).join("");
    const canRole = K.me.role === "pastor" && (!p || p.id !== K.me.id);
    K.drawer(`${K.head(p ? p.full_name : "Nuevo hermano", p ? "Editar registro · " + p.member_no : "Nuevo registro")}
      <div class="grid2" style="grid-template-columns:110px 1fr"><div class="field"><label for="et">Trato</label><select class="inp" id="et">${opt([["Hno.", "Hno."], ["Hna.", "Hna."], ["Joven", "Joven"], ["Pastor", "Pastor"], ["Pastora", "Pastora"]], m.title || "Hno.")}</select></div>
        <div class="field"><label for="en">Nombre completo</label><input class="inp" id="en" value="${esc(m.full_name || "")}"></div></div>
      <div class="grid2"><div class="field"><label for="ep">Teléfono (WhatsApp)</label><input class="inp mono" id="ep" inputmode="tel" value="${esc(m.phone || "")}"></div>
        <div class="field"><label for="ee">Correo</label><input class="inp" id="ee" type="email" value="${esc(m.email || "")}"></div></div>
      <div class="grid2"><div class="field"><label for="el">Nivel</label><select class="inp" id="el">${opt(K.LEVELS.map(([v, l]) => [v, l]), m.level || "adherente")}</select></div>
        <div class="field"><label for="er">Función</label><select class="inp" id="er" ${canRole ? "" : "disabled"}>${opt(Object.entries(ROLES_EDIT), m.role || "member")}</select></div></div>
      <div class="grid2"><div class="field"><label for="eb">Cumpleaños</label><input class="inp" id="eb" type="date" value="${esc(m.birthday || "")}"></div>
        <div class="field"><label for="es">Miembro desde</label><input class="inp" id="es" type="date" value="${esc(m.member_since || "")}"></div></div>
      <div class="grid2"><div class="field"><label for="ebp">Bautismo</label><input class="inp" id="ebp" type="date" value="${esc(m.baptism_date || "")}"></div>
        <div class="field"><label for="ew">Aniversario de bodas</label><input class="inp" id="ew" type="date" value="${esc(m.wedding_date || "")}"></div></div>
      <div class="field"><span class="flabel">Comunidades</span><div class="chips" id="ec">${comms.map((c) => `<button type="button" class="chip" aria-pressed="${mine.includes(c.id)}" data-k="${c.id}">${ic(c.emblem)}${esc(c.name)}</button>`).join("") || '<span class="fine">Aún no hay comunidades.</span>'}</div></div>
      <div class="field"><label for="eo">Nota interna</label><textarea class="inp" id="eo" placeholder="Solo la ven el pastor y Secretaría">${esc(note)}</textarea></div>
      ${p ? `<button class="toggle" role="switch" aria-checked="${!!m.active}" id="ea"><i></i>Activo en Kaleos</button>` : ""}
      <div class="row" style="margin-top:auto"><button class="btn sec" style="flex:1" data-close>Cancelar</button><button class="btn" style="flex:2" id="esave">${ic("check", "sm")}${p ? "Guardar cambios" : "Crear tarjeta"}</button></div>`, (d, close) => {
      K.on(d, "#ec .chip", (c) => c.setAttribute("aria-pressed", c.getAttribute("aria-pressed") !== "true"));
      const ea = $("#ea", d); if (ea) ea.addEventListener("click", () => ea.setAttribute("aria-checked", ea.getAttribute("aria-checked") !== "true"));
      $("#esave", d).addEventListener("click", async (e) => {
        const v = (id) => { const x = $("#" + id, d).value.trim(); return x === "" ? null : x; };
        const f = { title: v("et"), full_name: v("en"), phone: v("ep"), email: v("ee"), level: v("el"), birthday: v("eb"), member_since: v("es"), baptism_date: v("ebp"), wedding_date: v("ew") };
        if (!f.full_name) return K.toast("Escriba el nombre");
        if (canRole) f.role = v("er");
        if (ea) f.active = ea.getAttribute("aria-checked") === "true";
        const want = $$("#ec .chip[aria-pressed='true']", d).map((c) => +c.dataset.k), staffNote = $("#eo", d).value.trim();
        const btn = e.currentTarget; btn.disabled = true;
        try {
          let id = p && p.id, cred = null;
          if (p) {
            const { error } = await K.sb.from("kaleos_profiles").update(f).eq("id", p.id);
            if (error) throw error;
            if (p.id === K.me.id) Object.assign(K.me, f);
          } else {
            const r = await K.callAdmin({ action: "create_member", ...f, role: f.role || "member" });
            id = r.id; cred = r;
            if (id) await K.sb.from("kaleos_profiles").update({ email: f.email, wedding_date: f.wedding_date, level: f.level }).eq("id", id);
          }
          if (id) {
            const add = want.filter((x) => !mine.includes(x)), del = mine.filter((x) => !want.includes(x));
            if (add.length) { const { error } = await K.sb.from("kaleos_community_members").insert(add.map((c) => ({ community_id: c, profile_id: id }))); if (error) throw error; }
            if (del.length) { const { error } = await K.sb.from("kaleos_community_members").delete().eq("profile_id", id).in("community_id", del); if (error) throw error; }
            if (staffNote !== note) await K.sb.from("kaleos_staff_notes").upsert({ profile_id: id, church_id: K.me.church_id, note: staffNote || null, updated_at: new Date().toISOString() });
          }
          K.bust("people", "comms");
          close(); K.toast(p ? "Cambios guardados" : "Hermano agregado");
          if (after) after();
          if (cred) setTimeout(() => K.credentialsSheet(f.full_name, f.phone, cred.member_no, cred.pin), 320);
        } catch (err) { btn.disabled = false; K.toast(K.errMsg(err), 4000); }
      });
    });
  };

  // ===== gráficas =====
  K.barChart = (series, keys, h = 210) => {
    const W = 560, H = h, pl = 46, pb = 26, pt = 18, max = Math.max(1, ...series.map((s) => keys.reduce((a, k) => a + (s[k] || 0), 0)));
    const step = max > 2000 ? Math.ceil(max / 4 / 1000) * 1000 : max > 20 ? Math.ceil(max / 4 / 10) * 10 : Math.ceil(max / 4) || 1, top = step * 4, bw = (W - pl - 6) / Math.max(1, series.length);
    const y = (v) => pt + (H - pt - pb) * (1 - v / top);
    let g = "";
    for (let i = 0; i <= 4; i++) { const v = step * i; g += `<line class="gl" x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end">${v >= 1000 ? v / 1000 + " mil" : v}</text>`; }
    series.forEach((s, i) => {
      let acc = 0; const x = pl + i * bw + bw * 0.2, w = bw * 0.6;
      keys.forEach((k, j) => { const v = s[k] || 0; g += `<rect class="b${j + 1}" x="${x.toFixed(1)}" y="${y(acc + v).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0, y(acc) - y(acc + v)).toFixed(1)}"/>`; acc += v; });
      g += `<text x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${esc(s.l)}</text>`;
      if (keys.length === 1 || i === series.length - 1) g += `<text class="v" x="${x + w / 2}" y="${y(acc) - 6}" text-anchor="middle">${acc >= 1000 ? K.Q(acc) : acc}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
  };
  const hbars = (rows, color) => { const mx = Math.max(1, ...rows.map((r) => r[1])); return rows.map(([n, v, c]) => `<div class="hbar"><span>${esc(n)}</span><div class="bar"><i style="width:${(v / mx) * 100}%;${c || color ? `background:${c || color}` : ""}"></i></div><b class="num" style="text-align:right">${v}</b></div>`).join(""); };

  // ===== Mayordomía: totales =====
  const monthStart = (off = 0) => { const t = K.today(); const d = new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1 + off, 1)); return d.toISOString().slice(0, 10); };
  K.giftKpis = () => K.load("kpis", async () => {
    const rows = await K.rows(K.sb.from("kaleos_gifts").select("kind, method, amount, status, gift_date").eq("church_id", K.me.church_id).gte("gift_date", monthStart(-1)).limit(5000));
    const cur = {}, prev = {}, m0 = monthStart(0);
    for (const g of rows) { if (g.status !== "confirmado") continue; const b = g.gift_date >= m0 ? cur : prev; b[g.kind] = (b[g.kind] || 0) + Number(g.amount); }
    return { cur, prev, rows: rows.filter((g) => g.gift_date >= m0) };
  });
  K.kpiCards = (k) => [["Diezmos", "diezmo"], ["Ofrendas", "ofrenda"], ["Donaciones", "donacion"], ["Proyectos", "proyecto"]].map(([l, t], i) => {
    const a = k.cur[t] || 0, b = k.prev[t] || 0, d = b ? Math.round(((a - b) / b) * 100) : null;
    return `<div class="kpi ${i ? "" : "dark"}"><span class="eyebrow">${l}</span><b>${K.Q(a)}</b><span class="d">${d === null ? "Sin datos del mes pasado" : `<span class="${d >= 0 ? "up" : ""}">${d >= 0 ? "+" : "−"}${Math.abs(d)} %</span> frente a ${K.MONTHS[+monthStart(-1).slice(5, 7) - 1]}`}</span></div>`;
  }).join("");

  // ===== Secretaría =====
  async function cPersonas(el) {
    const [people, comms, cm] = await Promise.all([K.people(), K.communities(), K.rows(K.sb.from("kaleos_community_members").select("community_id, profile_id"))]);
    const last = new Map((await K.rows(K.sb.from("kaleos_attendance").select("profile_id, service_date").eq("church_id", K.me.church_id).gte("service_date", K.addDays(K.today(), -120)).order("service_date", { ascending: false }).limit(5000)))
      .reverse().map((a) => [a.profile_id, a.service_date]));
    const commsOf = (id) => cm.filter((x) => x.profile_id === id).map((x) => comms.find((c) => c.id === x.community_id)).filter(Boolean);
    const draw = () => {
      const q = C.pq.toLowerCase();
      const list = people.filter((p) => (C.plv === "todos" || p.level === C.plv) && (C.pcm === "todos" || commsOf(p.id).some((c) => String(c.id) === C.pcm)) && (p.full_name + " " + p.member_no).toLowerCase().includes(q));
      $("#pc", el).textContent = `${list.length} de ${people.length} personas · toque una fila para editar`;
      $("#pt", el).innerHTML = list.map((p) => `<tr class="click" data-row="${p.id}"><td><div class="who"><span class="avatar">${esc(K.ini(p.full_name))}</span><div><b>${esc(p.full_name)}</b><small>${esc(p.member_no)}${p.role !== "member" ? " · " + K.ROLE_NAME[p.role] : ""}${p.active ? "" : " · inactivo"}</small></div></div></td><td>${K.levelPill(p.level)}</td><td class="muted">${esc(commsOf(p.id).map((c) => c.name).join(", "))}</td><td class="mono" style="font-size:13px">${esc(p.phone || "—")}</td><td class="num">${last.get(p.id) ? K.fmtDate(last.get(p.id), "ds") : "—"}</td><td class="r">${ic("right", "sm")}</td></tr>`).join("");
      K.on($("#pt", el), "[data-row]", (r) => K.editPerson(people.find((p) => p.id === r.dataset.row), () => K.mount(el, cPersonas)));
    };
    el.innerHTML = `<div class="tools"><label class="search">${ic("search")}<input id="pq" placeholder="Buscar nombre o número" value="${esc(C.pq)}" aria-label="Buscar persona"></label>
      ${K.dd("plv", { label: "Nivel", options: () => [{ v: "todos", l: "Todos" }, ...K.LEVELS.map(([v, l]) => ({ v, l }))], value: () => C.plv, pick: (v) => { C.plv = v; K.mount(el, cPersonas); } })}
      ${K.dd("pcm", { label: "Comunidad", options: () => [{ v: "todos", l: "Todas" }, ...comms.map((c) => ({ v: String(c.id), l: c.name, icon: c.emblem }))], value: () => C.pcm, pick: (v) => { C.pcm = v; K.mount(el, cPersonas); } })}
      <button class="btn sm" id="newp" style="margin-left:auto">${ic("plus", "xs")}Nuevo hermano</button></div>
      <p class="fine" id="pc"></p>
      <div class="twrap"><table class="tbl"><thead><tr><th>Nombre</th><th>Nivel</th><th>Comunidades</th><th>Teléfono</th><th>Última asistencia</th><th></th></tr></thead><tbody id="pt"></tbody></table></div>`;
    $("#pq", el).addEventListener("input", (e) => { C.pq = e.target.value; draw(); });
    $("#newp", el).addEventListener("click", () => K.editPerson(null, () => K.mount(el, cPersonas)));
    draw();
  }

  async function cComunidades(el) {
    const comms = await K.communities();
    el.innerHTML = `<div class="twrap"><table class="tbl"><thead><tr><th>Comunidad</th><th>Encargado</th><th>Se reúne</th><th class="r">Integrantes</th><th>WhatsApp</th><th></th></tr></thead><tbody>
      ${comms.map((c) => `<tr class="click" data-row="${c.id}"><td><div class="who">${ic(c.emblem)}<div><b>${esc(c.name)}</b><small style="font-family:var(--f-body)">${esc(c.subtitle || "")}</small></div></div></td><td>${esc(c.leader_name || "—")}</td><td class="muted">${esc(c.meets || "—")}</td><td class="r num">${c.members}</td><td>${c.whatsapp_url ? '<span class="pill ok">Enlazado</span>' : '<span class="pill warn">Sin grupo</span>'}</td><td class="r">${ic("right", "sm")}</td></tr>`).join("") || '<tr><td colspan="6" class="muted">Pegue el SQL nuevo para ver las comunidades.</td></tr>'}</tbody></table></div>
      <div class="row"><button class="btn sec sm" id="newc">${ic("plus", "xs")}Nueva comunidad</button></div>`;
    K.on(el, "[data-row]", (r) => editComm(comms.find((c) => String(c.id) === r.dataset.row), () => K.mount(el, cComunidades)));
    $("#newc", el).addEventListener("click", () => editComm(null, () => K.mount(el, cComunidades)));
  }
  async function editComm(c, after) {
    const people = (await K.people()).filter((p) => p.active);
    const x = c || { name: "", subtitle: "", emblem: "comunidades", palette: "alba", style: "cumbres", seed: 3 };
    K.drawer(`${K.head(c ? c.name : "Nueva comunidad", "Editar comunidad")}
      <span class="thumb ${K.isLight(x.palette) ? "" : "on-art"}" id="cprev" style="aspect-ratio:2.2;border-radius:18px"></span>
      <div class="grid2"><div class="field"><label for="cn">Nombre</label><input class="inp" id="cn" value="${esc(x.name)}"></div>
        <div class="field"><label for="csu">Descripción corta</label><input class="inp" id="csu" value="${esc(x.subtitle || "")}"></div></div>
      <div class="field"><label for="ce">Encargado</label><select class="inp" id="ce"><option value="">Por asignar</option>${people.map((p) => `<option value="${p.id}" ${p.id === x.leader_id ? "selected" : ""}>${esc(p.full_name)}</option>`).join("")}</select></div>
      <div class="field"><label for="cr">Se reúne</label><input class="inp" id="cr" value="${esc(x.meets || "")}" placeholder="Viernes · 7:00 p. m."></div>
      <div class="field"><label for="cw">Enlace del grupo de WhatsApp</label><input class="inp" id="cw" inputmode="url" value="${esc(x.whatsapp_url || "")}" placeholder="https://chat.whatsapp.com/…"></div>
      <div class="field"><label for="csn">Ministerio interno (opcional)</label><input class="inp" id="csn" value="${esc(x.sub_note || "")}" placeholder="Ministerio de Danza"></div>
      <div class="grid2"><div class="field"><label for="cp">Color de portada</label><select class="inp" id="cp">${Object.keys(K.PAL).map((p) => `<option value="${p}" ${p === x.palette ? "selected" : ""}>${K.PAL_NAMES[p]}</option>`).join("")}</select></div>
        <div class="field"><label for="cs">Estilo</label><select class="inp" id="cs">${Object.entries(K.ART_KINDS).map(([k, l]) => `<option value="${k}" ${k === x.style ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>
      <div class="field"><label for="cem">Emblema</label><select class="inp" id="cem">${K.EMBLEMS.map((e) => `<option value="${e}" ${e === x.emblem ? "selected" : ""}>${e.replace("c_", "")}</option>`).join("")}</select></div>
      <div class="row" style="margin-top:auto"><button class="btn sec" style="flex:1" data-close>Cancelar</button><button class="btn" style="flex:2" id="csave">Guardar</button></div>`, (d, close) => {
      const prev = () => {
        const p = $("#cp", d).value, light = K.isLight(p);
        $("#cprev", d).className = "thumb " + (light ? "" : "on-art");
        $("#cprev", d).innerHTML = K.artCv($("#cs", d).value, p, x.seed) + `<span class="dt" style="padding:14px;${light ? "background:none;color:var(--night)" : ""}">${ic($("#cem", d).value)}<b style="margin-left:8px">${esc($("#cn", d).value || "Comunidad")}</b></span>`;
        requestAnimationFrame(() => K.paint(d));
      };
      ["#cp", "#cs", "#cem", "#cn"].forEach((s) => $(s, d).addEventListener("input", prev));
      prev();
      $("#csave", d).addEventListener("click", async () => {
        const v = (id) => $("#" + id, d).value.trim() || null;
        const f = { name: v("cn"), subtitle: v("csu"), leader_id: v("ce"), meets: v("cr"), whatsapp_url: v("cw"), sub_note: v("csn"), palette: v("cp"), style: v("cs"), emblem: v("cem") };
        if (!f.name) return K.toast("Escriba el nombre");
        const q = c ? K.sb.from("kaleos_communities").update(f).eq("id", c.id)
          : K.sb.from("kaleos_communities").insert({ ...f, church_id: K.me.church_id, slug: f.name.normalize("NFD").replace(/[^\w]+/g, "-").toLowerCase().replace(/^-|-$/g, "") + "-" + Date.now().toString(36).slice(-4), sort: 50 });
        const { error } = await q;
        if (error) return K.toast(K.errMsg(error), 4000);
        K.bust("comms"); close(); K.toast(c ? "Comunidad actualizada" : "Comunidad creada"); if (after) after();
      });
    });
  }

  async function cAgenda(el) {
    const [rows, people, comms] = await Promise.all([
      K.rows(K.sb.from("kaleos_services").select("*").eq("church_id", K.me.church_id).gte("service_date", K.addDays(K.today(), -1)).order("service_date").limit(40)),
      K.people(), K.communities(),
    ]);
    const act = people.filter((p) => p.active);
    const sel = (r, f, opts) => `<select class="inp" data-ros="${r.id}:${f}" aria-label="${f}"><option value="">—</option>${opts.map(([v, l]) => `<option value="${v}" ${String(r[f] ?? "") === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
    const P = act.map((p) => [p.id, p.full_name]), CM = comms.map((c) => [c.id, c.name]);
    el.innerHTML = `<p class="muted">Asigne privilegios y servicios. Cada persona recibe su turno en Kaleos y usted lo confirma por WhatsApp.</p>
      <div class="twrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Actividad</th><th>Ujieres</th><th>Alabanza</th><th>Multimedia</th><th>Limpieza</th><th></th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td class="num" style="white-space:nowrap"><b>${esc(K.cap(K.weekdayOf(r.service_date).slice(0, 3)))} ${K.fmtDate(r.service_date, "ds")}</b></td><td>${esc(r.activity)}</td><td>${sel(r, "usher_id", P)}</td><td>${sel(r, "worship_id", P)}</td><td>${sel(r, "media_id", P)}</td><td>${sel(r, "cleaning_id", CM)}</td><td>${r.notified_at ? '<span class="pill ok">Avisado</span>' : `<button class="iconbtn" data-del="${r.id}" aria-label="Quitar">${ic("close")}</button>`}</td></tr>`).join("") || '<tr><td colspan="7" class="muted">Agregue el primer culto o actividad.</td></tr>'}</tbody></table></div>
      <form class="row" id="addsv" style="flex-wrap:wrap"><input class="inp" type="date" id="sd" value="${K.today()}" style="width:auto" aria-label="Fecha"><input class="inp" id="sa" placeholder="Culto de oración, Santa Cena…" style="flex:1;min-width:180px" aria-label="Actividad"><button class="btn sec">${ic("plus", "sm")}Agregar</button></form>
      <div class="row"><button class="btn" id="notify">${ic("send", "sm")}Avisar turnos a cada persona</button></div>`;
    K.on(el, "[data-ros]", async (s) => {
      const [id, f] = s.dataset.ros.split(":"), { error } = await K.sb.from("kaleos_services").update({ [f]: s.value || null, notified_at: null }).eq("id", id);
      if (error) return K.toast(K.errMsg(error));
      K.toast("Turno asignado");
    }, "change");
    K.on(el, "[data-del]", async (b) => { await K.sb.from("kaleos_services").delete().eq("id", b.dataset.del); K.mount(el, cAgenda); });
    $("#addsv", el).addEventListener("submit", async (e) => {
      e.preventDefault();
      const a = $("#sa", el).value.trim(); if (!a) return K.toast("Escriba la actividad");
      const { error } = await K.sb.from("kaleos_services").insert({ church_id: K.me.church_id, service_date: $("#sd", el).value || K.today(), activity: a });
      if (error) return K.toast(K.errMsg(error), 4000);
      K.mount(el, cAgenda);
    });
    $("#notify", el).addEventListener("click", async (e) => {
      const fresh = await K.rows(K.sb.from("kaleos_services").select("*").eq("church_id", K.me.church_id).gte("service_date", K.today()).is("notified_at", null).order("service_date"));
      if (!fresh.length) return K.toast("No hay turnos nuevos por avisar");
      e.currentTarget.disabled = true;
      const msgs = [], wa = [], ROLE = { usher_id: "ujier", worship_id: "alabanza", media_id: "multimedia" };
      for (const r of fresh) {
        const when = `${K.cap(K.weekdayOf(r.service_date))} ${K.fmtDate(r.service_date, "dm")}`;
        for (const f of Object.keys(ROLE)) {
          const p = act.find((x) => x.id === r[f]); if (!p) continue;
          const body = `Le corresponde servir en ${ROLE[f]} el ${when} (${r.activity}). Si no puede, avise a Secretaría con tiempo.`;
          msgs.push({ church_id: K.me.church_id, profile_id: p.id, kind: "recordatorio", title: `Su turno: ${r.activity}`, body, created_by: K.me.id });
          if (p.phone) wa.push({ n: p.full_name, phone: p.phone, text: `Bendiciones, ${K.first(p.full_name)}. ${body}` });
        }
        const c = comms.find((x) => x.id === r.cleaning_id);
        if (c) msgs.push({ church_id: K.me.church_id, profile_id: null, community_id: c.id, kind: "aviso", title: `Limpieza: ${r.activity}`, body: `A ${c.name} le toca la limpieza del templo para el ${when}.`, event_at: K.gtISO(r.service_date, "08:00"), created_by: K.me.id });
      }
      if (msgs.length) { const { error } = await K.sb.from("kaleos_messages").insert(msgs); if (error) { e.currentTarget.disabled = false; return K.toast(K.errMsg(error), 4000); } }
      await K.sb.from("kaleos_services").update({ notified_at: new Date().toISOString() }).in("id", fresh.map((r) => r.id));
      K.bust("anns", "upcoming");
      K.sheet(`${K.head("Turnos avisados", msgs.length + " avisos en Kaleos")}<p class="muted">Ya les llegó a «Mis mensajes». Confírmelo por WhatsApp a cada uno:</p>
        <div class="list">${wa.map((w) => `<div class="li"><span class="avatar">${esc(K.ini(w.n))}</span><div class="g"><b>${esc(w.n)}</b><span class="s">${esc(w.phone)}</span></div><a class="btn sm" href="${K.waLink(w.phone, w.text)}" target="_blank" rel="noopener">${ic("chat", "xs")}Enviar</a></div>`).join("") || '<p class="muted">Nadie tiene teléfono registrado.</p>'}</div>
        <button class="btn sec block" data-close>Listo</button>`);
      K.mount(el, cAgenda);
    });
  }

  async function cAvisos(el) {
    const [list, comms] = await Promise.all([
      K.rows(K.sb.from("kaleos_messages").select("*").eq("church_id", K.me.church_id).is("profile_id", null).gte("created_at", new Date(Date.now() - 60 * 86400000).toISOString()).order("created_at", { ascending: false }).limit(80)),
      K.communities(),
    ]);
    const rs = list.length ? await K.rows(K.sb.from("kaleos_rsvp").select("message_id, answer").in("message_id", list.map((a) => a.id))) : [];
    const now = Date.now();
    el.innerHTML = `<div class="tools"><button class="btn sm" id="newa">${ic("plus", "xs")}Nuevo aviso</button></div>
      <div class="twrap"><table class="tbl"><thead><tr><th>Aviso</th><th>Para</th><th>Fecha</th><th class="r">Asistirán</th><th>Estado</th><th></th></tr></thead><tbody>
      ${list.map((a) => { const t = K.artOf(a.id, a.art); return `<tr class="click" data-row="${a.id}"><td><div class="who"><span class="thumb" style="width:44px;border-radius:10px;flex:none">${K.artCv(t.k, t.p, t.s)}</span><b>${esc(a.title)}</b></div></td><td class="muted">${esc(K.targetLabel(a, comms))}</td><td class="num" style="white-space:nowrap">${a.event_at ? esc(K.dpart(a.event_at, { weekday: "short", day: "numeric", month: "short" })) : "—"}</td><td class="r num">${rs.filter((r) => r.message_id === a.id && r.answer === "si").length}</td><td>${a.event_at && new Date(a.event_at) < now ? '<span class="pill">Pasado</span>' : '<span class="pill ok">Publicado</span>'}</td><td class="r">${ic("right", "sm")}</td></tr>`; }).join("") || '<tr><td colspan="6" class="muted">Aún no hay avisos.</td></tr>'}</tbody></table></div>`;
    $("#newa", el).addEventListener("click", () => K.annSheet({ after: () => K.mount(el, cAvisos) }));
    K.on(el, "[data-row]", async (r) => {
      const a = list.find((x) => String(x.id) === r.dataset.row);
      const who = await K.rows(K.sb.from("kaleos_rsvp").select("answer, who:kaleos_profiles!profile_id(full_name)").eq("message_id", a.id));
      const block = (k, l) => { const arr = who.filter((x) => x.answer === k); return `<div><div class="eyebrow">${l} (${arr.length})</div><div class="ppl" style="margin-top:8px">${arr.map((x) => `<span class="p"><span class="avatar">${esc(K.ini(x.who?.full_name))}</span>${esc(x.who?.full_name || "")}</span>`).join("") || '<span class="muted">Nadie aún.</span>'}</div></div>`; };
      K.drawer(`${K.head(a.title, K.targetLabel(a, comms))}<canvas class="gcard" id="ac"></canvas>
        ${a.event_at ? `<p class="muted">${esc(K.cap(K.fmtWhen(a.event_at)))}${a.place ? " · " + esc(a.place) : ""}</p>` : ""}${a.body ? `<p style="white-space:pre-line">${esc(a.body)}</p>` : ""}
        ${block("si", "Asistirán")}${block("tal", "Les interesa")}${block("no", "No podrán")}
        <div class="row" style="margin-top:auto"><button class="btn sec" style="flex:1" id="adel">Borrar</button><button class="btn" style="flex:2" id="ash">${ic("chat", "sm")}Compartir de nuevo</button></div>`, (d, close) => {
        const cv = $("#ac", d); K.drawAnn(cv, a);
        $("#ash", d).addEventListener("click", () => K.shareCanvas(cv, `${a.title}${a.event_at ? "\n🗓️ " + K.cap(K.fmtWhen(a.event_at)) : ""}${a.place ? "\n📍 " + a.place : ""}`, "aviso-kaleos.png"));
        $("#adel", d).addEventListener("click", async () => {
          if (!confirm("¿Borrar este aviso? Desaparece de la app de los hermanos.")) return;
          const { error } = await K.sb.from("kaleos_messages").delete().eq("id", a.id);
          if (error) return K.toast(K.errMsg(error));
          K.bust("anns", "upcoming"); close(); K.mount(el, cAvisos);
        });
      });
    });
  }

  async function cInformes(el) {
    const [wk, people, comms, reqs] = await Promise.all([
      K.sb.rpc("kaleos_attendance_weeks", { p_weeks: 8 }), K.people(), K.communities(),
      K.rows(K.sb.from("kaleos_prayer_requests").select("kind").eq("church_id", K.me.church_id).gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())),
    ]);
    const att = (wk.data || []).map((r) => ({ l: K.fmtDate(r.service_date, "ds"), a: Number(r.people) }));
    const act = people.filter((p) => p.active);
    const lv = K.LEVELS.map(([k, n], i) => [n, act.filter((p) => p.level === k).length, `var(--lv${i + 1})`]);
    const rq = Object.entries(K.REQ).map(([k, r]) => [r.n, reqs.filter((x) => x.kind === k).length]);
    const big = [...comms].sort((a, b) => b.members - a.members).slice(0, 6).map((c) => [c.name, c.members]);
    const trend = att.length >= 2 && att[att.length - 2].a ? Math.round(((att[att.length - 1].a - att[att.length - 2].a) / att[att.length - 2].a) * 100) : null;
    el.innerHTML = `<div class="panels">
      <div class="panel"><div class="sec-h"><h3>Asistencia por culto</h3>${trend !== null ? `<span class="pill ${trend >= 0 ? "ok" : "warn"}">${trend >= 0 ? "+" : "−"}${Math.abs(trend)} % último culto</span>` : ""}</div>${att.length ? K.barChart(att, ["a"]) : '<p class="muted">Aún no hay asistencia registrada.</p>'}<p class="fine">Personas registradas con su tarjeta al entrar (últimas 8 semanas).</p></div>
      <div class="panel"><h3>Hermanos por nivel</h3>${hbars(lv)}<p class="fine">${act.length} activos en Kaleos.</p></div>
      <div class="panel"><h3>Pedidos de los últimos 30 días</h3>${hbars(rq)}<p class="fine">${reqs.length} pedidos.</p></div>
      <div class="panel"><h3>Comunidades más grandes</h3>${big.length ? hbars(big, "var(--sea)") : '<p class="muted">Sin comunidades.</p>'}</div>
    </div>`;
  }

  // ===== Mayordomía =====
  const GIFT_SELECT = "*, who:kaleos_profiles!profile_id(full_name, phone)";
  async function confirmGift(id, after) {
    const { data, error } = await K.sb.from("kaleos_gifts").update({ status: "confirmado", confirmed_by: K.me.id, confirmed_at: new Date().toISOString() }).eq("id", id).select(GIFT_SELECT).single();
    if (error) return K.toast(K.errMsg(error), 4000);
    K.bust("kpis", "funds");
    if (data.who && data.who.phone) {
      const text = `Bendiciones, ${K.first(data.who.full_name)}. Recibimos su ${K.GIFT_KINDS[data.kind].toLowerCase()} de ${K.Q(data.amount)} (${data.dest}). Recibo ${data.receipt}. ¡Gracias por dar con alegría!`;
      K.sheet(`${K.head("Confirmado", data.receipt)}<p>El recibo ya aparece en «Mis aportes» de ${esc(K.first(data.who.full_name))}.</p>
        <a class="btn gold block" href="${K.waLink(data.who.phone, text)}" target="_blank" rel="noopener">${ic("chat", "sm")}Enviar el recibo por WhatsApp</a><button class="btn sec block" data-close>Listo</button>`);
    } else K.toast("Confirmado");
    if (after) after();
  }
  async function cResumen(el) {
    const k = await K.giftKpis();
    const pend = await K.rows(K.sb.from("kaleos_gifts").select(GIFT_SELECT).eq("church_id", K.me.church_id).eq("status", "pendiente").order("created_at").limit(50));
    const wk = [1, 8, 15, 22].map((d, i) => ({ l: "Semana " + (i + 1), a: 0, b: 0, c: 0, d: 0, from: d, to: i === 3 ? 31 : d + 6 }));
    const map = { diezmo: "a", ofrenda: "b", donacion: "c", proyecto: "d" };
    for (const g of k.rows) { if (g.status !== "confirmado") continue; const day = +g.gift_date.slice(8), w = wk.find((x) => day >= x.from && day <= x.to); w[map[g.kind]] += Number(g.amount); }
    const meth = {}; let tot = 0;
    for (const g of k.rows) { meth[g.method] = (meth[g.method] || 0) + Number(g.amount); tot += Number(g.amount); }
    el.innerHTML = `<div class="kpis">${K.kpiCards(k)}</div>
      <div class="panels"><div class="panel"><h3>Ingresos por semana</h3>${K.barChart(wk, ["a", "b", "c", "d"])}
        <div class="legend"><span><i style="background:var(--accent)"></i>Diezmos</span><span><i style="background:var(--sea)"></i>Ofrendas</span><span><i style="background:var(--wine)"></i>Donaciones</span><span><i style="background:var(--ink-3)"></i>Proyectos</span></div></div>
      <div class="panel"><h3>Cómo dan los hermanos</h3>${tot ? Object.entries(meth).sort((a, b) => b[1] - a[1]).map(([m, v]) => `<div class="hbar"><span>${K.METHODS[m]}</span><div class="bar"><i style="width:${K.pct(v, tot)}%"></i></div><b class="num" style="text-align:right">${K.pct(v, tot)} %</b></div>`).join("") : '<p class="muted">Aún no hay aportes este mes.</p>'}
        <div class="hr"></div><div class="sec-h"><h3 style="font-size:20px">Por confirmar</h3><span class="pill warn">${pend.length}</span></div>
        <div class="list">${pend.map((g) => `<div class="li" style="padding:10px 0"><div class="g"><b>${esc(g.who ? g.who.full_name : "Anónimo")}</b><span class="s">${K.GIFT_KINDS[g.kind]} · ${esc(g.dest)} · ${K.METHODS[g.method]} · ${esc(g.receipt || "")}${g.reference ? " · Ref. " + esc(g.reference) : ""}</span></div><b class="num">${K.Q(g.amount)}</b>${isSec() ? `<button class="btn sm" data-conf="${g.id}">Confirmar</button>` : ""}</div>`).join("") || '<p class="muted">Todo confirmado.</p>'}</div></div></div>`;
    K.on(el, "[data-conf]", (b) => { b.disabled = true; confirmGift(b.dataset.conf, () => K.mount(el, cResumen)); });
  }
  async function cMovimientos(el) {
    let q = K.sb.from("kaleos_gifts").select(GIFT_SELECT).eq("church_id", K.me.church_id).order("gift_date", { ascending: false }).order("id", { ascending: false }).limit(200);
    if (C.mt !== "todos") q = q.eq("kind", C.mt);
    const list = await K.rows(q);
    el.innerHTML = `<div class="tools">${K.dd("mt", { label: "Tipo", options: () => [{ v: "todos", l: "Todos" }, ...Object.entries(K.GIFT_KINDS).map(([v, l]) => ({ v, l }))], value: () => C.mt, pick: (v) => { C.mt = v; K.mount(el, cMovimientos); } })}
      ${isSec() ? `<button class="btn sm" id="sobre" style="margin-left:auto">${ic("sobre", "sm")}Registrar sobre o aporte</button>` : ""}</div>
      <div class="twrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Hermano</th><th>Tipo</th><th>Destino</th><th>Método</th><th class="r">Monto</th><th>Recibo</th><th>Estado</th></tr></thead><tbody>
      ${list.map((g) => `<tr><td class="num">${K.fmtDate(g.gift_date, "ds")}</td><td><b style="font-weight:600">${esc(g.who ? g.who.full_name : "Anónimo")}</b></td><td>${K.GIFT_KINDS[g.kind]}</td><td class="muted">${esc(g.dest)}</td><td>${K.METHODS[g.method]}</td><td class="r num"><b>${K.Q(g.amount)}</b></td><td class="mono" style="font-size:12.5px">${esc(g.receipt || "")}</td><td>${g.status === "confirmado" ? '<span class="pill ok">Confirmado</span>' : isSec() ? `<button class="pill warn" data-conf="${g.id}">Por confirmar</button>` : '<span class="pill warn">Por confirmar</span>'}</td></tr>`).join("") || '<tr><td colspan="8" class="muted">Aún no hay movimientos.</td></tr>'}</tbody></table></div>`;
    K.on(el, "[data-conf]", (b) => confirmGift(b.dataset.conf, () => K.mount(el, cMovimientos)));
    const sb = $("#sobre", el); if (sb) sb.addEventListener("click", () => sobreDrawer(() => K.mount(el, cMovimientos)));
  }
  async function sobreDrawer(after) {
    const [people, funds] = await Promise.all([K.people(), K.funds()]);
    const dests = [["General", ""], ["Gratitud", ""], ["Siembra", ""], ["Promesa de fe", ""], ...funds.filter((f) => f.active).map((f) => [f.name, f.id])];
    K.drawer(`${K.head("Registrar aporte", "Mayordomía")}<p class="muted" style="margin-top:-8px">El hermano ve su recibo digital en «Mis aportes».</p>
      <div class="field"><label for="sw">Hermano</label><select class="inp" id="sw"><option value="">Anónimo</option>${people.filter((p) => p.active).map((p) => `<option value="${p.id}">${esc(p.full_name)}</option>`).join("")}</select></div>
      <div class="grid2"><div class="field"><label for="stp">Tipo</label><select class="inp" id="stp">${Object.entries(K.GIFT_KINDS).map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></div>
        <div class="field"><label for="sa">Monto (Q)</label><input class="inp num" id="sa" inputmode="numeric" placeholder="250"></div></div>
      <div class="field"><label for="sd">Destino</label><select class="inp" id="sd">${dests.map(([n, id], i) => `<option value="${i}">${esc(n)}</option>`).join("")}</select></div>
      <div class="grid2"><div class="field"><label for="sm">Método</label><select class="inp" id="sm"><option value="sobre">Sobre</option><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option></select></div>
        <div class="field"><label for="sn">Número de sobre o boleta</label><input class="inp mono" id="sn" placeholder="Automático"></div></div>
      <div class="field"><label for="sdt">Fecha</label><input class="inp" id="sdt" type="date" value="${K.today()}"></div>
      <div class="row" style="margin-top:auto"><button class="btn sec" style="flex:1" data-close>Cancelar</button><button class="btn" style="flex:2" id="ssave">${ic("check", "sm")}Registrar</button></div>`, (d, close) => {
      $("#stp", d).addEventListener("change", () => { const k = $("#stp", d).value; const i = dests.findIndex(([, id]) => { const f = funds.find((x) => x.id === id); return f && (k === "proyecto" ? f.kind === "proyecto" : k === "donacion" ? f.kind === "necesidad" : false); }); $("#sd", d).value = String(i >= 0 ? i : k === "ofrenda" ? 1 : 0); });
      $("#ssave", d).addEventListener("click", async (e) => {
        const amount = parseInt($("#sa", d).value.replace(/\D/g, "")) || 0;
        if (!amount) return K.toast("Escriba el monto");
        const [dest, fid] = dests[+$("#sd", d).value], m = $("#sm", d).value, num = $("#sn", d).value.trim();
        e.currentTarget.disabled = true;
        const { data, error } = await K.sb.from("kaleos_gifts").insert({ church_id: K.me.church_id, profile_id: $("#sw", d).value || null, kind: $("#stp", d).value, dest, fund_id: fid || null,
          method: m, amount, receipt: m === "sobre" && num ? num : null, reference: m !== "sobre" && num ? num : null, gift_date: $("#sdt", d).value || K.today(),
          status: "confirmado", confirmed_by: K.me.id, confirmed_at: new Date().toISOString() }).select().single();
        if (error) { e.currentTarget.disabled = false; return K.toast(K.errMsg(error), 4000); }
        K.bust("kpis", "funds"); close(); K.toast(`Registrado · recibo ${data.receipt}`);
        const p = people.find((x) => x.id === data.profile_id);
        if (p && p.phone) setTimeout(() => K.sheet(`${K.head("Recibo " + data.receipt)}<p>Ya aparece en «Mis aportes» de ${esc(K.first(p.full_name))}.</p>
          <a class="btn gold block" target="_blank" rel="noopener" href="${K.waLink(p.phone, `Bendiciones, ${K.first(p.full_name)}. Recibimos su ${K.GIFT_KINDS[data.kind].toLowerCase()} de ${K.Q(amount)} (${dest}). Recibo ${data.receipt}. ¡Gracias por dar con alegría!`)}">${ic("chat", "sm")}Enviar recibo por WhatsApp</a><button class="btn sec block" data-close>Listo</button>`), 320);
        if (after) after();
      });
    });
  }
  async function cProyectos(el) {
    const funds = await K.funds();
    const proj = funds.filter((f) => f.kind === "proyecto"), needs = funds.filter((f) => f.kind === "necesidad");
    const card = (f) => `<div class="proj ${isSec() ? "listbtn" : ""}" ${isSec() ? `data-fund="${f.id}"` : ""} style="${f.active ? "" : "opacity:.55"}"><span class="thumb" style="aspect-ratio:2;border-radius:14px">${K.artCv(f.style, f.palette, f.id + 30)}</span><span class="eyebrow">${esc(f.subtitle || "")}${f.active ? "" : " · cerrado"}</span><h3>${esc(f.name)}</h3>
      <div class="bar"><i style="width:${K.pct(f.got, f.goal)}%"></i></div><div class="amts"><span><b class="num">${K.Q(f.got)}</b> de ${K.Q(f.goal)}</span><span>${esc(f.until_label || "")}</span></div></div>`;
    el.innerHTML = `${isSec() ? `<div class="tools"><button class="btn sm" id="newf">${ic("plus", "xs")}Nuevo proyecto o necesidad</button></div>` : ""}
      <div class="eyebrow">Proyectos</div><div class="pgrid">${proj.map(card).join("") || '<p class="muted">Sin proyectos.</p>'}</div>
      <div class="eyebrow">Donaciones para gastos fijos</div><div class="pgrid">${needs.map(card).join("") || '<p class="muted">Sin necesidades.</p>'}</div>`;
    K.on(el, "[data-fund]", (b) => fundDrawer(funds.find((f) => String(f.id) === b.dataset.fund), () => K.mount(el, cProyectos)));
    const nf = $("#newf", el); if (nf) nf.addEventListener("click", () => fundDrawer(null, () => K.mount(el, cProyectos)));
  }
  function fundDrawer(f, after) {
    const x = f || { kind: "proyecto", name: "", subtitle: "", goal: 0, until_label: "", palette: "cielo", style: "cumbres", emblem: "proyecto", active: true };
    K.drawer(`${K.head(f ? f.name : "Nuevo", "Mayordomía")}
      <div class="field"><label for="fk">Tipo</label><select class="inp" id="fk"><option value="proyecto" ${x.kind === "proyecto" ? "selected" : ""}>Proyecto (construcción, misiones, cultos especiales)</option><option value="necesidad" ${x.kind === "necesidad" ? "selected" : ""}>Necesidad fija (niños, ancianos, becas)</option></select></div>
      <div class="field"><label for="fn">Nombre</label><input class="inp" id="fn" value="${esc(x.name)}"></div>
      <div class="field"><label for="fs">Descripción corta</label><input class="inp" id="fs" value="${esc(x.subtitle || "")}"></div>
      <div class="grid2"><div class="field"><label for="fg">Meta (Q)</label><input class="inp num" id="fg" inputmode="numeric" value="${Number(x.goal) || ""}"></div>
        <div class="field"><label for="fu">Hasta</label><input class="inp" id="fu" value="${esc(x.until_label || "")}" placeholder="marzo 2027 · cada mes"></div></div>
      <div class="grid2"><div class="field"><label for="fp">Color</label><select class="inp" id="fp">${Object.keys(K.PAL).map((p) => `<option value="${p}" ${p === x.palette ? "selected" : ""}>${K.PAL_NAMES[p]}</option>`).join("")}</select></div>
        <div class="field"><label for="fst">Estilo</label><select class="inp" id="fst">${Object.entries(K.ART_KINDS).map(([k, l]) => `<option value="${k}" ${k === x.style ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>
      <button class="toggle" role="switch" aria-checked="${!!x.active}" id="fa"><i></i>Abierto para recibir aportes</button>
      <div class="row" style="margin-top:auto"><button class="btn sec" style="flex:1" data-close>Cancelar</button><button class="btn" style="flex:2" id="fsave">Guardar</button></div>`, (d, close) => {
      $("#fa", d).addEventListener("click", (e) => e.currentTarget.setAttribute("aria-checked", e.currentTarget.getAttribute("aria-checked") !== "true"));
      $("#fsave", d).addEventListener("click", async () => {
        const v = (id) => $("#" + id, d).value.trim() || null;
        const row = { kind: v("fk"), name: v("fn"), subtitle: v("fs"), goal: parseInt(($("#fg", d).value || "0").replace(/\D/g, "")) || 0, until_label: v("fu"), palette: v("fp"), style: v("fst"), active: $("#fa", d).getAttribute("aria-checked") === "true" };
        if (!row.name) return K.toast("Escriba el nombre");
        const { error } = f ? await K.sb.from("kaleos_funds").update(row).eq("id", f.id) : await K.sb.from("kaleos_funds").insert({ ...row, church_id: K.me.church_id, emblem: row.kind === "proyecto" ? "proyecto" : "dar", sort: 50 });
        if (error) return K.toast(K.errMsg(error), 4000);
        K.bust("funds"); close(); K.toast("Guardado"); if (after) after();
      });
    });
  }

  // ===== estructura =====
  const SECS = {
    secretaria: [["personas", "Personas", "hermanos"], ["comunidades", "Comunidades", "comunidades"], ["agenda", "Agenda y servicios", "servicios"], ["avisos", "Avisos", "avisos"], ["informes", "Informes", "informes"], ["asistencia", "Asistencia", "escanear"], ["reporte", "Reporte mensual", "reporte"]],
    mayordomia: [["resumen", "Resumen del mes", "informes"], ["movimientos", "Movimientos", "sobre"], ["proyectos", "Proyectos", "proyecto"]],
  };
  const month = () => K.MONTHS[+K.today().slice(5, 7) - 1];
  const TITLE = { personas: () => "Registro de <em>personas</em>", comunidades: () => "Comunidades", agenda: () => "Agenda y <em>servicios</em>", avisos: () => "Avisos", informes: () => `Informes de <em>${month()}</em>`,
    asistencia: () => "Registrar <em>asistencia</em>", reporte: () => "Reporte <em>mensual</em>", resumen: () => `Mayordomía, <em>${month()}</em>`, movimientos: () => "Movimientos", proyectos: () => "Proyectos" };
  const VIEWS = { personas: cPersonas, comunidades: cComunidades, agenda: cAgenda, avisos: cAvisos, informes: cInformes, asistencia: K.viewScan, reporte: K.viewReport, resumen: cResumen, movimientos: cMovimientos, proyectos: cProyectos };
  const seg = () => `<div class="seg">${[["secretaria", "Secretaría", "registro"], ["mayordomia", "Mayordomía", "dar"]].map(([k, l, i]) => `<button data-cv="${k}" aria-pressed="${C.view === k}">${ic(i)}${l}</button>`).join("")}</div>`;
  function render(app) {
    const secs = SECS[C.view];
    if (!secs.find((s) => s[0] === C.cs)) C.cs = secs[0][0];
    const cur = secs.find((s) => s[0] === C.cs);
    app.innerHTML = `<div class="desk">
      <aside class="side"><div class="wm row" style="gap:8px">${ic("kaleos")}<div><b>Kaleos</b><span>Central</span></div></div>
        ${seg()}
        <nav aria-label="Secciones"><span class="eyebrow">${C.view === "secretaria" ? "Secretaría" : "Mayordomía"}</span>${secs.map(([k, l, i]) => `<button class="nv" data-cs="${k}" aria-current="${C.cs === k ? "page" : "false"}">${ic(i)}${l}</button>`).join("")}</nav>
        <div class="duty" style="margin-top:auto"><span class="eyebrow">En Central</span><b style="margin-top:6px">${esc(`${K.me.title || ""} ${K.me.full_name}`.trim())}</b><span class="muted" style="font-size:12.5px">${K.me.role === "pastor" ? "Pastor" : "Secretaría y tesorería"}</span></div>
        <div class="modes">${K.userMenu()}</div></aside>
      <section class="dmain">
        <div class="mob-nav">${seg()}${K.dd("csec", { icon: cur[2], options: () => secs.map(([v, l, i]) => ({ v, l, icon: i })), value: () => C.cs, pick: (v) => { C.cs = v; render(app); } })}<span style="margin-left:auto"></span>${K.userMenu([], "umenu2")}</div>
        <div class="dtop"><h1>${TITLE[C.cs]()}</h1></div>
        <div id="cm" class="stack" style="gap:18px"></div>
      </section></div>`;
    K.on(app, "[data-cv]", (b) => { C.view = b.dataset.cv; C.cs = SECS[C.view][0][0]; render(app); });
    K.on(app, "[data-cs]", (b) => { C.cs = b.dataset.cs; render(app); });
    K.stopScanner();
    K.mount($("#cm", app), VIEWS[C.cs]);
    scrollTo(0, 0);
  }
  K.shells.central = { render };
  // vistas de solo lectura para «Controles» del pastor
  Object.assign(K, { viewIncome: cResumen, viewStats: cInformes, viewProjects: cProyectos });
})();
