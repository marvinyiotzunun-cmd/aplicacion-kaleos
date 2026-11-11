/* Kaleos Estudio: el selector de diseños que usan la tarjeta, el aviso y el versículo.
   K.estPicker(host, { kind, value, sample, fmt, photo, pick }) dibuja:
   familias → miniaturas de cada plantilla → colores de la elegida → foto (ninguna, de la iglesia o del celular). */
(function () {
  "use strict";
  const K = window.K, E = K.EST; if (!E) return;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // lista de fotos de la iglesia (docs/img/fotos/fotos.json: [{ id, src, name }])
  let fotosP = null;
  E.loadFotos = () => fotosP || (fotosP = fetch("./img/fotos/fotos.json").then((r) => (r.ok ? r.json() : [])).catch(() => [])
    .then((list) => { (Array.isArray(list) ? list : []).forEach((f) => { if (f && f.id && f.src) E.FOTOS[f.id] = { src: "./img/fotos/" + f.src.replace(/^.*\//, ""), name: f.name || "" }; }); return E.FOTOS; }));

  // foto del celular: se achica a 1600 px y solo vive en este aparato
  E.pickPhoto = () => new Promise((ok) => {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
    inp.onchange = () => {
      const f = inp.files && inp.files[0]; if (!f) return ok(null);
      const url = URL.createObjectURL(f), img = new Image();
      img.onload = () => {
        const s = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); E.photo = c; ok(c);
      };
      img.onerror = () => { URL.revokeObjectURL(url); ok(null); };
      img.src = url;
    };
    inp.click();
  });

  // miniaturas: se dibujan de a una para no trabar el celular
  const queue = []; let busy = false, big = null;
  function pump() {
    if (busy) return; const job = queue.shift(); if (!job) return; busy = true;
    const run = () => {
      try {
        if (job.cv.isConnected) {
          big = big || document.createElement("canvas");
          E.render(big, job.kind, job.key, job.src, { fmt: job.fmt, seed: "mini", photo: job.photo });
          const w = job.cv.clientWidth || 96, dpr = Math.min(2, devicePixelRatio || 1);
          job.cv.width = Math.round(w * dpr); job.cv.height = Math.round((w * big.height / big.width) * dpr);
          const x = job.cv.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(big, 0, 0, job.cv.width, job.cv.height);
        }
      } catch (_) {}
      busy = false; setTimeout(pump, 0);
    };
    (window.requestIdleCallback || ((f) => setTimeout(f, 16)))(run, { timeout: 300 });
  }
  const thumb = (cv, job) => { job.cv = cv; queue.push(job); pump(); };

  K.estPicker = (host, o) => {
    const kind = o.kind;
    let fam = "", cur = E.is(o.value()) && E.parse(o.value()) || E.parse(E.random(kind));
    const st = { foto: E.fotoOf(o.value()) || "", phone: null };
    E.ready();
    const ts = () => E.list(kind).filter((t) => !fam || t.family === fam);
    const famsUsed = () => [...new Set(E.list(kind).map((t) => t.family))];
    const sw = (th) => { const c = Object.values(th).filter((v) => typeof v === "string" && /^#/.test(v)).slice(0, 3); return `linear-gradient(135deg,${c[0] || "#ccc"} 0 50%,${c[1] || c[0] || "#999"} 50% 75%,${c[2] || c[1] || "#666"} 75%)`; };
    const key = () => E.key(cur.id, cur.theme, st.phone ? "" : st.foto);
    const photo = () => st.phone || undefined;
    const emit = () => o.pick(key(), photo());
    const paint = () => {
      const t = E.T[cur.id];
      host.innerHTML = `<div class="est">
        <div class="chips est-fam" role="tablist">${["", ...famsUsed()].map((f) => `<button type="button" class="chip" data-ef="${f}" aria-pressed="${fam === f}">${f ? esc(E.FAMILIES[f] || f) : "Todas"}</button>`).join("")}</div>
        <div class="est-grid">${ts().map((x) => `<button type="button" class="est-t" data-et="${x.id}" aria-pressed="${x.id === cur.id}" aria-label="${esc(x.name)}"><canvas></canvas><span>${esc(x.name)}</span></button>`).join("")}</div>
        <span class="flabel">Colores de «${esc(t.name)}»</span>
        <div class="pals est-th">${Object.entries(t.themes).map(([k, th]) => `<button type="button" class="pal" data-eh="${k}" aria-pressed="${k === cur.theme}" aria-label="${esc(th.name || k)}" title="${esc(th.name || k)}" style="background:${sw(th)}"></button>`).join("")}</div>
        <span class="flabel">Foto</span>
        <div class="est-ph"><button type="button" class="est-f" data-ep="" aria-pressed="${!st.foto && !st.phone}">Sin foto</button>${Object.entries(E.FOTOS).map(([id, f]) => `<button type="button" class="est-f img" data-ep="${esc(id)}" aria-pressed="${st.foto === id && !st.phone}" aria-label="${esc(f.name || "Foto de la iglesia")}" style="background-image:url('${esc(f.src)}')"></button>`).join("")}<button type="button" class="est-f" data-ep="@cel" aria-pressed="${!!st.phone}">Del celular</button></div>
        ${st.phone ? '<p class="fine">La foto del celular va en la imagen que usted comparte; en la app los hermanos ven el diseño sin ella.</p>' : ""}
        <button type="button" class="btn sec sm" data-er>Sorpréndame</button>
        <p class="fine">${E.count(kind).toLocaleString("es-GT")} diseños del Estudio, hechos a mano.</p></div>`;
      host.querySelectorAll("[data-et]").forEach((b) => { const id = b.dataset.et, th = id === cur.id ? cur.theme : Object.keys(E.T[id].themes)[0]; thumb(b.querySelector("canvas"), { kind, key: E.key(id, th, st.phone ? "" : st.foto), src: o.sample(), fmt: o.fmt ? o.fmt() : undefined, photo: photo() }); });
    };
    host.onclick = async (e) => {
      const b = e.target.closest("button"); if (!b || !host.contains(b)) return;
      if (b.dataset.ef !== undefined) { fam = b.dataset.ef; queue.length = 0; return paint(); }
      if (b.dataset.et) { cur = { id: b.dataset.et, theme: E.T[b.dataset.et].themes[cur.theme] ? cur.theme : Object.keys(E.T[b.dataset.et].themes)[0] }; emit(); return paint(); }
      if (b.dataset.eh) { cur.theme = b.dataset.eh; emit(); return paint(); }
      if (b.dataset.ep !== undefined) {
        if (b.dataset.ep === "@cel") { const c = await E.pickPhoto(); if (!c) return; st.phone = c; st.foto = ""; }
        else { st.phone = null; st.foto = b.dataset.ep; }
        queue.length = 0; emit(); return paint();
      }
      if (b.dataset.er !== undefined) { cur = E.parse(E.random(kind, key())); emit(); return paint(); }
    };
    paint();
    E.loadFotos().then(() => { if (host.isConnected && Object.keys(E.FOTOS).length) paint(); });
    return { refresh: () => { queue.length = 0; paint(); }, key, photo };
  };
})();

// al abrir la app: letras, logo y fotos del Estudio listos, y se vuelven a dibujar los versículos
addEventListener("load", () => setTimeout(() => {
  const K = window.K; if (!K || !K.EST || !K.cardReady) return;
  K.cardReady().then(() => { if (K.redrawVerses) K.redrawVerses(); }).catch(() => {});
}, 300));
