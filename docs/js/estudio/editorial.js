/* Estudio · familia Editorial: piezas como la portada o una página de una revista elegante, una hoja de
   calendario, una cita destacada o una invitación de papelería fina.
   Cada plantilla tiene su propia letra y su propio gesto; todo el texto que hay que leer va a 26 px o más
   (en el 1080) para que se lea en la miniatura del celular. */
(function () {
  "use strict";
  const E = window.K && window.K.EST; if (!E) return;
  const MES = E.MONTHS || ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const up = (s) => String(s || "").toUpperCase();
  const capi = (s) => { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); };

  // ===== ayudantes de la familia =====
  // fecha de la pieza: { dia, mes (0-11), wd (0-6 o -1), y } o null si no hay fecha
  function fechaDe(d) {
    const hoy = new Date();
    if (d.kind === "ann") {
      if (!d.date) return null;
      return { dia: String(d.day), mes: MES.indexOf(String(d.month).toLowerCase()), wd: DIAS.indexOf(String(d.weekday).toLowerCase()), y: d.date.getFullYear() };
    }
    const s = String((d.kind === "card" ? d.kicker : d.eyebrow) || "").toLowerCase();
    const m = MES.findIndex((x) => s.includes(x)), n = (s.match(/\d{1,2}/) || [])[0];
    if (m >= 0 && n) { const y = hoy.getFullYear(); return { dia: String(+n), mes: m, wd: new Date(y, m, +n).getDay(), y }; }
    if (d.kind === "verse") return { dia: String(hoy.getDate()), mes: hoy.getMonth(), wd: hoy.getDay(), y: hoy.getFullYear() };
    return null;
  }
  // mes y año de la pieza (de su fecha, o de hoy): «Noviembre 2026»
  function mesAno(d) {
    const f = fechaDe(d), hoy = new Date();
    let m = f && f.mes >= 0 ? f.mes : -1;
    if (m < 0) { const s = String(d.kicker || d.eyebrow || "").toLowerCase(); m = MES.findIndex((x) => s.includes(x)); }
    if (m < 0) m = hoy.getMonth();
    return `${capi(MES[m])} ${f ? f.y : hoy.getFullYear()}`;
  }
  const cabecera = (d) => `${d.churchShort} · ${mesAno(d)}`;

  // letra pequeña de palo seco, en mayúsculas y espaciada (se achica un poco si no cabe en maxW)
  function caps(g, s, x, y, o = {}) {
    const fam = o.fam || "Montserrat", w = o.w || 700, t = up(s), spOf = (z) => o.sp ?? Math.round(z * 0.16);
    let size = o.size || 26;
    if (o.maxW) while (size > (o.min || 18) && g.measure(t, g.F(fam, size, w), spOf(size)) > o.maxW) size--;
    return g.text(t, x, y, { font: g.F(fam, size, w), color: o.color, sp: spOf(size), align: o.align, alpha: o.alpha });
  }
  // filete
  function rule(g, x, y, w, color, lw = 2, alpha = 1) { const c = g.ctx; c.save(); c.globalAlpha = alpha; c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), lw); c.restore(); }
  // reparte las líneas para que queden parejas (sin viudas: nunca una palabra sola en la última línea)
  function equilibra(g, f, s, maxW) {
    const n = f.lines.length; if (n < 2 || /…$/.test(f.lines[n - 1])) return f;
    // solo cuando la última línea queda coja (una palabra sola o muy corta)
    const ws = f.lines.map((l) => g.measure(l, f.font, f.sp)), last = f.lines[n - 1];
    if (last.includes(" ") && ws[n - 1] > Math.max(...ws) * 0.42) return f;
    let lo = maxW * 0.62, hi = maxW;
    for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (g.wrap(s, f.font, mid, f.sp).length <= n) hi = mid; else lo = mid; }
    const lines = g.wrap(s, f.font, hi + 0.5, f.sp);
    return lines.length === n ? { ...f, lines } : f;
  }
  // un bloque de texto que sabe su alto (para apilar): { h, gap, draw(top) }
  function bloque(g, s, fontFn, o = {}) {
    let f = g.fit(s, fontFn, o); if (o.bal !== false) f = equilibra(g, f, s, o.maxW || g.W * 0.8);
    const asc = f.size * (o.asc ?? 0.76), desc = f.size * (o.desc ?? 0.24);
    return { f, gap: o.gap || 0, flex: o.flex || 0, h: asc + (f.lines.length - 1) * f.lh + desc,
      draw: (top) => g.lines(f.lines, o.x, top + asc, f.lh, { font: f.font, color: o.color, align: o.align, sp: f.sp, alpha: o.alpha }) };
  }
  function capsB(g, s, o = {}) { const z = o.size || 26; return { gap: o.gap || 0, flex: o.flex || 0, h: z * 0.76, draw: (top) => caps(g, s, o.x, top + z * 0.74, o) }; }
  const hueco = (h, flex = 0) => ({ h, gap: 0, flex, draw() {} });
  const raya = (g, x, w, color, lw, gap) => ({ h: lw, gap, draw: (y) => rule(g, x, y, w, color, lw) });
  const alto = (it) => it.reduce((a, b) => a + b.h + (b.gap || 0), 0);
  // prueba tamaños (k de kmax a 0.5) hasta que la pila cabe en «avail»
  function encaja(build, avail, kmax = 1) {
    let it = null;
    for (let k = kmax; k >= 0.5; k -= 0.04) { it = build(k); if (alto(it) <= avail) return { it, t: alto(it), k }; }
    return { it, t: alto(it), k: 0.5 };
  }
  // apila de arriba abajo; «extra» se reparte entre los bloques con flex (para repartir en tercios)
  function apilar(it, top, extra = 0) {
    const fl = it.reduce((a, b) => a + (b.flex || 0), 0);
    let y = top; for (const b of it) { y += (b.gap || 0) + (fl && extra > 0 ? (extra * (b.flex || 0)) / fl : 0); b.draw(y); y += b.h; } return y;
  }

  // foto en duotono: las sombras toman «dark» y las luces «light» (así cada tema sigue siendo distinto)
  function duo(g, x, y, w, h, dark, light, o = {}) {
    if (!g.photo(x, y, w, h, { treat: "bn", focusX: o.fx, focusY: o.fy ?? 0.35, path: o.path })) return false;
    const c = g.ctx; c.save(); c.beginPath(); if (o.path) o.path(c); else c.rect(x, y, w, h); c.clip();
    c.globalCompositeOperation = "multiply"; c.fillStyle = light; c.fillRect(x, y, w, h);
    c.globalCompositeOperation = "screen"; c.fillStyle = dark; c.fillRect(x, y, w, h);
    c.restore(); return true;
  }
  // oscurecido vertical solo donde va el texto (de y0 transparente a y1 con «a»)
  function velo(g, y0, y1, a, color = "#000000") {
    const c = g.ctx, lg = c.createLinearGradient(0, y0, 0, y1);
    lg.addColorStop(0, g.rgba(color, 0)); lg.addColorStop(1, g.rgba(color, a));
    c.save(); c.fillStyle = lg; c.fillRect(0, Math.min(y0, y1), g.W, Math.abs(y1 - y0)); c.restore();
  }

  // texto con letra capitular repartido en columnas; sin «draw» solo mide. Devuelve { ok, h, size }
  function capitular(g, text, o) {
    const { F } = g;
    text = String(text || "").trim().replace(/^[«"“]+/, "").replace(/[»"”]+(?=[\s.,]|$)/, "");
    const m = text.match(/^([¡¿(]*)([^\s])([\s\S]*)$/); if (!m) return { ok: true, h: 0, size: o.start };
    const letter = m[2].toUpperCase(), rest = (m[1] + m[3]).trim() ? m[1] + m[3] : "";
    const cols = o.cols || 1, dl = o.dropLines || 3;
    let res = null;
    for (let s = o.start; s >= (o.floor ?? o.min); s -= 1) {
      const lh = s * (o.lh || 1.4), dropSize = ((dl - 1) * lh + s * 0.7) / 0.7;
      const df = F(o.dropFam || "DM Serif Display", dropSize), dw = g.measure(letter, df) + s * 0.45, font = F(o.fam || "Fraunces", s, o.w || 400);
      const words = rest.split(/\s+/).filter(Boolean), lines = []; let l = "";
      const wid = () => (lines.length < dl ? o.colW - dw : o.colW);
      const glued = !/^\s/.test(rest);
      words.forEach((w, i) => {
        const t = l ? l + " " + w : w;
        if (g.measure(t, font) > wid() && l) { lines.push(l); l = w; } else l = t;
        if (i === 0 && !glued) l = " " + l.trim();
      });
      if (l) lines.push(l.trim());
      const per = Math.max(Math.ceil(lines.length / cols), Math.min(dl, lines.length));
      const h = Math.max(per * lh, dropSize * 0.7 + s * 0.3);
      res = { ok: h <= o.maxH && s >= o.min, h, size: s, lines, per, lh, df, dw, font, dropSize };
      if (h <= o.maxH) break;
    }
    if (o.draw) {
      const { lines, per, lh, df, dw, font, size } = res, b0 = o.y + size * 0.7;
      g.text(letter, o.x - size * 0.04, b0 + (dl - 1) * lh, { font: df, color: o.acc });
      lines.forEach((l, i) => {
        const c = Math.floor(i / per), r = i % per;
        g.text(l, o.x + c * (o.colW + o.gap) + (c === 0 && r < dl ? dw : 0), b0 + r * lh, { font, color: o.color, alpha: o.alpha });
      });
    }
    return res;
  }
  // bloque de cuerpo de texto: con capitular si es largo (80 letras o más), en dos columnas solo si pasa de 250
  function cuerpo(g, text, o) {
    text = String(text || "").trim();
    if (text.length < 80) return bloque(g, text, (s) => g.F(o.fam || "Fraunces", s, o.w || 400), { x: o.x, color: o.color, maxW: o.width, maxLines: 5, start: o.size * 1.25, min: Math.min(o.size, 40), lh: 1.18, gap: o.gap });
    const cols = text.length > 250 ? 2 : 1, colW = cols === 1 ? o.width : (o.width - 48) / 2;
    const base = { x: o.x, colW, gap: 48, cols, start: Math.round(o.size), min: Math.round(o.size), floor: Math.round(o.size), maxH: 1e9, lh: 1.34, color: o.color, acc: o.acc, fam: o.fam, w: o.w };
    const r = capitular(g, text, base);
    return { gap: o.gap || 0, h: r.h, draw: (y) => capitular(g, text, { ...base, y, draw: true }) };
  }

  // una palabra o número relleno con la foto en duotono (negro y el color de acento), con contorno del acento
  function letraFoto(g, s, x, y, font, acc) {
    const img = g.img, c = document.createElement("canvas"); c.width = g.W; c.height = g.H;
    const x2 = c.getContext("2d"); x2.font = font; x2.textBaseline = "alphabetic"; x2.fillStyle = "#000"; x2.fillText(s, x, y);
    const mm = x2.measureText(s), by = y - mm.actualBoundingBoxAscent, bw = mm.width, bh = mm.actualBoundingBoxAscent + mm.actualBoundingBoxDescent;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, sc = Math.max(bw / iw, bh / ih), dw = iw * sc, dh = ih * sc;
    x2.globalCompositeOperation = "source-in"; x2.filter = "grayscale(1) contrast(1.25) brightness(1.18)";
    x2.drawImage(img, x + (bw - dw) / 2, by + (bh - dh) * 0.35, dw, dh); x2.filter = "none";
    x2.globalCompositeOperation = "multiply"; x2.fillStyle = acc; x2.fillRect(0, 0, g.W, g.H);
    x2.globalCompositeOperation = "screen"; x2.fillStyle = g.mix(acc, "#000000", 0.78); x2.fillRect(0, 0, g.W, g.H);
    x2.globalCompositeOperation = "destination-in"; x2.fillStyle = "#000"; x2.fillText(s, x, y);
    g.ctx.drawImage(c, 0, 0);
    g.text(s, x, y, { font, color: null, stroke: acc, strokeW: 4 });
  }

  // adorno: dos anillos entrelazados (bodas)
  function anillos(ctx, cx, cy, r, color, lw = 3) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(cx - r * 0.55, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + r * 0.55, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // adorno: cruz sencilla centrada en cx,cy
  function cruz(ctx, cx, cy, h, color, lw) {
    ctx.save(); ctx.fillStyle = color; ctx.fillRect(cx - lw / 2, cy - h / 2, lw, h); ctx.fillRect(cx - h * 0.3, cy - h * 0.18 - lw / 2, h * 0.6, lw); ctx.restore();
  }

  // =====================================================================
  // «Portada»: cabecera de revista enorme, foto a sangre (duotono del tema) o arco grande de color, titular abajo
  E.add({
    id: "edi-revista", name: "Portada", family: "editorial", fonts: ["Playfair Display", "Montserrat"],
    themes: {
      marino: { name: "Marino y oro", bg: "#0d1b3d", ink: "#f6f1e6", acc: "#f2c85b" },
      papel: { name: "Papel y bermellón", bg: "#f2ede3", ink: "#17171a", acc: "#c43d2b" },
      rubi: { name: "Rubí", bg: "#561226", ink: "#fbefe7", acc: "#f3b79c" },
      oliva: { name: "Oliva", bg: "#2c3623", ink: "#f2eddc", acc: "#dcb65e" },
      niebla: { name: "Niebla azul", bg: "#dde4ea", ink: "#13213d", acc: "#2d5fa8" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 72, story = H > 1500, sq = H < 1200, foto = g.photoOn, PF = "Playfair Display";
      const ink = foto ? "#fbf8f2" : th.ink, acc = foto && g.lum(th.acc) < 0.5 ? g.mix(th.acc, "#ffffff", 0.5) : th.acc;
      const dark = foto || g.lum(th.bg) < 0.5;
      if (foto) {
        // duotono con el color del tema: sombras del fondo (o la tinta) y luces del acento
        const sombra = g.lum(th.bg) < 0.5 ? g.mix(th.bg, "#000000", 0.3) : g.mix(th.ink, "#000000", 0.15);
        duo(g, 0, 0, W, H, sombra, g.mix(th.acc, "#ffffff", 0.2), { fy: 0.3 });
        g.grain(0.06);
      } else g.paper(th.bg, { fibers: 0.3, grain: 0.05 });

      // cabecera de la revista (más baja en el cuadrado)
      const top = story ? 150 : sq ? 46 : 56, fecha = mesAno(d);
      const sec = d.kind === "card" ? "Edición especial" : d.kind === "ann" ? "Agenda" : (d.eyebrow || "Palabra diaria");
      const cab = [];
      let sy, coverTop;
      if (sq) {
        const mh = g.fit(d.churchShort, (s) => F(PF, s, 900), { maxW: W * 0.56, maxLines: 1, start: 100, min: 64 });
        const base = top + mh.size * 0.74;
        cab.push(() => g.text(mh.lines[0], M - 4, base, { font: mh.font, color: ink }));
        cab.push(() => caps(g, fecha, W - M, base - 38, { size: 26, color: ink, align: "right", maxW: W * 0.34 }));
        cab.push(() => caps(g, sec, W - M, base, { size: 26, color: acc, align: "right", maxW: W * 0.34 }));
        sy = base + 22; coverTop = sy + 56;
      } else {
        cab.push(() => caps(g, d.church, M, top + 22, { size: 26, color: ink, alpha: 0.9, maxW: W - 2 * M }));
        const mh = g.fit(d.churchShort, (s) => F(PF, s, 900), { maxW: W - 2 * M + 8, maxLines: 1, start: 300, min: 110 });
        const mBase = top + 44 + mh.size * 0.74;
        cab.push(() => g.text(mh.lines[0], M - 6, mBase, { font: mh.font, color: ink }));
        sy = mBase + 30;
        cab.push(() => caps(g, fecha, M, sy + 50, { size: 26, color: ink, maxW: W / 2 - M }));
        cab.push(() => caps(g, sec, W - M, sy + 50, { size: 26, color: acc, align: "right", maxW: W / 2 - M }));
        coverTop = sy + 110;
      }
      const cabecera = () => { cab.forEach((f) => f()); rule(g, M, sy, W - 2 * M, acc, 5); };
      // con foto: oscurecido solo bajo la cabecera y bajo el bloque de texto; el centro de la foto queda limpio
      const sombras = (textTop) => {
        velo(g, coverTop + 110, 0, 0.72);
        velo(g, textTop - 240, textTop + 30, 0.74);
        ctx.save(); ctx.fillStyle = "rgba(0,0,0,.74)"; ctx.fillRect(0, textTop + 30, W, H); ctx.restore();
      };

      // sin foto: un arco grande de color que sale por el borde derecho (la «foto» de la portada)
      const arco = (limY) => {
        if (foto) return;
        const ay = coverTop, ah = limY - ay, aw = Math.round(W * 0.46), ax = W - Math.round(aw * 0.8), r = aw / 2;
        if (ah < r + 60) return;
        const path = (inset) => { ctx.beginPath(); ctx.moveTo(ax + inset, ay + ah); ctx.lineTo(ax + inset, ay + r); ctx.arc(ax + r, ay + r, r - inset, Math.PI, 0); ctx.lineTo(ax + aw - inset, ay + ah); };
        ctx.save(); path(0); ctx.closePath(); ctx.fillStyle = g.mix(th.bg, th.ink, dark ? 0.1 : 0.08); ctx.fill();
        path(26); ctx.strokeStyle = th.acc; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
        const ch = Math.min(ah * 0.42, r * 0.9, 260);
        cruz(ctx, ax + r, ay + Math.min(Math.max(r, ah * 0.45), ah - ch / 2 - 30), ch, th.acc, 7);
      };

      if (d.kind === "card") {
        // línea de portada: el versículo, en una columna estrecha arriba a la izquierda
        const cw = Math.round(W * 0.5) - M - 30;
        const cv = g.fit(`«${d.verse}»`, (s) => F(PF, s, 500, true), { maxW: cw, maxLines: 7, start: 36, min: 30, lh: 1.25 });
        const ruleY = H - M - 170, colW = (W - 2 * M) / 3;
        // con foto, el versículo baja al bloque del titular para que la foto se vea entera en el centro
        const coverBot = foto ? coverTop : coverTop + 46 + (cv.lines.length - 1) * cv.lh + 60;
        const bot = ruleY - 46;
        const { it, t } = encaja((k) => [
          ...(foto ? [bloque(g, `«${d.verse}» ${d.ref}`, (s) => F(PF, s, 500, true), { x: M, color: ink, maxW: W - 2 * M, maxLines: 3, start: 34, min: 30, lh: 1.22, gap: 0 }), hueco(36)] : []),
          bloque(g, d.headline, (s) => F(PF, s, 700, true), { x: M, color: acc, maxW: W - 2 * M, maxLines: 2, start: 84 * k, min: 44, lh: 1.05 }),
          bloque(g, d.name, (s) => F(PF, s, 900), { x: M - 4, color: ink, maxW: W - 2 * M, maxLines: 3, start: 140 * k, min: 60, lh: 0.98, gap: 16 }),
          bloque(g, d.line, (s) => F("Montserrat", s, 500), { x: M, color: ink, maxW: W - 2 * M - 120, maxLines: 2, start: 32, min: 30, lh: 1.3, gap: 28 }),
        ], foto ? Math.min(bot - coverBot - 30, H * 0.36) : bot - coverBot - 30, foto ? 1 : 1.3);
        if (foto) sombras(bot - t);
        cabecera();
        if (!foto) {
          caps(g, "Para meditar", M, coverTop + 18, { size: 24, color: acc });
          const yy = g.lines(cv.lines, M, coverTop + 46 + cv.size * 0.8, cv.lh, { font: cv.font, color: ink });
          caps(g, d.ref, M, yy + 48, { size: 26, color: ink, maxW: cw });
        }
        rule(g, M, ruleY, W - 2 * M, ink, 1.5, 0.6);
        caps(g, "Con cariño", M, ruleY + 42, { size: 24, color: acc });
        const sg = g.fit(d.signature, (s) => F(PF, s, 500, true), { maxW: colW * 1.5, maxLines: 1, start: 38, min: 30 });
        g.text(sg.lines[0], M, ruleY + 88, { font: sg.font, color: ink });
        const fr = g.fit(capi(d.from), (s) => F("Montserrat", s, 500), { maxW: colW * 1.5, maxLines: 2, start: 28, min: 26, lh: 1.25 });
        g.lines(fr.lines, M, ruleY + 128, fr.lh, { font: fr.font, color: ink, alpha: 0.9 });
        const fx = M + colW * 1.65;
        caps(g, "Fecha", fx, ruleY + 42, { size: 24, color: acc });
        const kf = g.fit(capi(d.kicker), (s) => F(PF, s, 500, true), { maxW: W - M - 110 - fx, maxLines: 2, start: 38, min: 30, lh: 1.1 });
        g.lines(kf.lines, fx, ruleY + 88, kf.lh, { font: kf.font, color: ink });
        g.logo(W - M, ruleY + 34, 70, { white: dark, align: "right" });
        arco(bot - t - 40); apilar(it, bot - t);
      } else if (d.kind === "ann") {
        const cols = d.date ? [["Fecha", capi(d.when)], ["Hora", d.time]] : [["Fecha", "Por anunciar"]];
        if (d.place) cols.push(["Lugar", d.place]);
        const ruleY = H - M - 196, gap = 36, n = cols.length;
        const ws = cols.map(([l]) => (l === "Lugar" ? 1.4 : l === "Hora" ? 0.75 : 1)), sw = ws.reduce((a, b) => a + b, 0);
        const bot = ruleY - 50;
        const { it, t } = encaja((k) => [
          bloque(g, d.date ? "Le invitamos" : "Muy pronto", (s) => F(PF, s, 700, true), { x: M, color: acc, maxW: W - 2 * M, maxLines: 1, start: 64 * k, min: 40 }),
          bloque(g, d.title, (s) => F(PF, s, 900), { x: M - 4, color: ink, maxW: W - 2 * M, maxLines: 4, start: 156 * k, min: 64, lh: 0.98, gap: 18 }),
        ], foto ? Math.min(bot - coverTop - 120, H * 0.3) : bot - coverTop - 120, foto ? 1 : 1.3);
        if (foto) sombras(bot - t);
        cabecera();
        rule(g, M, ruleY, W - 2 * M, ink, 1.5, 0.6);
        let x = M;
        cols.forEach(([l, v], i) => {
          const cw = ((W - 2 * M - gap * (n - 1)) * ws[i]) / sw;
          caps(g, l, x, ruleY + 42, { size: 24, color: acc });
          const vf = g.fit(v, (s) => F(PF, s, 500, true), { maxW: cw, maxLines: 4, start: 38, min: 30, lh: 1.12 });
          g.lines(vf.lines, x, ruleY + 88, vf.lh, { font: vf.font, color: ink });
          x += cw + gap;
        });
        g.logo(M, coverTop, 76, { white: dark, align: "left" });
        arco(bot - t - 40); apilar(it, bot - t);
      } else {
        const bot = H - (story ? 230 : M + 4);
        const { it, t } = encaja((k) => [
          ...(d.head ? [bloque(g, d.head, (s) => F(PF, s, 700, true), { x: M, color: acc, maxW: W - 2 * M, maxLines: 2, start: 76 * k, min: 44, lh: 1.05, gap: 0 })] : []),
          bloque(g, d.text, (s) => F(PF, s, 700), { x: M - 2, color: ink, maxW: W - 2 * M, maxLines: 10, start: (story ? 112 : 100) * k, min: 40, lh: 1.1, gap: d.head ? 26 : 0 }),
          capsB(g, d.ref, { x: M, size: 30, color: acc, gap: 40 }),
        ], foto ? Math.min(bot - 90 - coverTop, H * (sq ? 0.5 : 0.46)) : bot - 90 - coverTop - 40, 1.4);
        if (foto) sombras(bot - 90 - t);
        cabecera();
        if (d.firma) caps(g, d.church, M, bot, { size: 26, color: ink, alpha: 0.9, maxW: W - 2 * M - 120 });
        g.logo(W - M, bot - 52, 62, { white: dark, align: "right" });
        arco(bot - 90 - t - 50); apilar(it, bot - 90 - t);
      }
    },
  });

  // =====================================================================
  // «Página interior»: folio arriba, titular, y el cuerpo con letra capitular; la ficha del evento a dos columnas
  E.add({
    id: "edi-capitular", name: "Página interior", family: "editorial", fonts: ["DM Serif Display", "Fraunces", "Work Sans"],
    themes: {
      crema: { name: "Crema y bermellón", bg: "#f4efe6", ink: "#1d1b18", acc: "#b3402c" },
      marino: { name: "Marino y oro", bg: "#0d1b3d", ink: "#f3ecdf", acc: "#f2c85b" },
      vino: { name: "Vino y rosa", bg: "#4a1424", ink: "#f8ece6", acc: "#f0a98f" },
      tinta: { name: "Tinta y ámbar", bg: "#17191d", ink: "#eeeae0", acc: "#e7a83e" },
      blanco: { name: "Blanco y azul", bg: "#fbfaf7", ink: "#121417", acc: "#2d5fa8" },
    },
    draw(g) {
      const { W, H, th, d, F } = g, M = 90, story = H > 1500, sq = H < 1200, foto = g.photoOn, dark = g.lum(th.bg) < 0.5, DS = "DM Serif Display", FR = "Fraunces", WS = "Work Sans";
      g.paper(th.bg, { fibers: 0.35, grain: 0.05 });
      const top = story ? 140 : sq ? 50 : 56, TW = W - 2 * M;
      const sec = d.kind === "card" ? "Celebración" : d.kind === "ann" ? "Agenda" : "Lectura";
      caps(g, cabecera(d), M, top + 26, { size: 26, color: th.ink, alpha: 0.85, fam: WS, w: 600, maxW: TW - 250 });
      caps(g, sec, W - M, top + 26, { size: 26, color: th.acc, align: "right", fam: WS, w: 600, maxW: 230 });
      rule(g, M, top + 50, TW, th.ink, 1.5, 0.45);
      const footY = H - (story ? 140 : 50);
      rule(g, M, footY - 52, TW, th.ink, 1.5, 0.45);
      caps(g, d.church, M, footY - 10, { size: 24, color: th.ink, alpha: 0.8, fam: WS, w: 600, maxW: TW - 110 });
      g.logo(W - M, footY - 40, 44, { white: dark, align: "right", alpha: 0.95 });
      let y0 = top + 50 + (story ? 80 : sq ? 40 : 54);
      const y1 = footY - 52 - (story ? 60 : 36);
      // foto de apertura: a lo ancho, como mucho un tercio del alto
      if (foto) { const ph = Math.round(H * (story ? 0.3 : sq ? 0.25 : 0.27)); g.photo(M, y0, TW, ph, { treat: "suave", focusY: 0.32 }); y0 += ph + (story ? 50 : 40); }
      const acento = (gap) => raya(g, M, 120, th.acc, 4, gap);
      let build, kmax = 1.3;
      if (d.kind === "card") {
        build = (k) => [
          capsB(g, d.kicker || "Celebración", { x: M, size: 26, color: th.ink, alpha: 0.8, fam: WS, w: 600 }),
          bloque(g, d.headline, (s) => F(DS, s, 400, true), { x: M, color: th.acc, maxW: TW, maxLines: 2, start: 64 * k, min: 40, lh: 1.05, gap: 26 }),
          bloque(g, d.name, (s) => F(DS, s), { x: M - 3, color: th.ink, maxW: TW, maxLines: 3, start: 120 * Math.min(k, 1.15), min: 54, lh: 1.0, gap: 8 }),
          bloque(g, d.line, (s) => F(FR, s, 400, true), { x: M, color: th.ink, maxW: TW - 60, maxLines: 2, start: 40 * k, min: 30, lh: 1.22, gap: 20 }),
          acento(34),
          cuerpo(g, d.verse, { x: M, width: TW, size: Math.max(30, 44 * k), color: th.ink, acc: th.acc, gap: 34 }),
          capsB(g, d.ref, { x: M, size: 28, color: th.acc, fam: WS, w: 600, gap: 24 }),
          bloque(g, `Con cariño, ${d.signature}`, (s) => F(FR, s, 400, true), { x: M, color: th.ink, maxW: TW, maxLines: 2, start: 40, min: 30, lh: 1.15, gap: 44 }),
          ...(d.from ? [bloque(g, capi(d.from), (s) => F(WS, s, 400), { x: M, color: th.ink, alpha: 0.85, maxW: TW, maxLines: 2, start: 30, min: 28, lh: 1.25, gap: 8 })] : []),
        ];
      } else if (d.kind === "ann") {
        // ficha a dos columnas: el día grande de acento a la izquierda; hora y lugar a la derecha
        const ficha = (k) => {
          const cl = Math.round(TW * 0.4), xr = M + cl + 50, cr = W - M - xr;
          const L = [], Rr = [];
          if (d.date) {
            const nf = g.fit(d.day, (s) => F(DS, s), { maxW: cl, maxLines: 1, start: 250 * k, min: 120 });
            L.push({ h: nf.size * 0.72, draw: (y) => g.text(d.day, M - 6, y + nf.size * 0.72, { font: nf.font, color: th.acc }) });
            L.push(bloque(g, d.month, (s) => F(FR, s, 400, true), { x: M, color: th.ink, maxW: cl, maxLines: 1, start: 50, min: 34, gap: 22 }));
            L.push(capsB(g, d.weekday, { x: M, size: 26, color: th.ink, alpha: 0.85, fam: WS, w: 600, gap: 16, maxW: cl }));
            Rr.push(capsB(g, "Hora", { x: xr, size: 24, color: th.acc, fam: WS, w: 600 }));
            Rr.push(bloque(g, d.time, (s) => F(FR, s, 700), { x: xr, color: th.ink, maxW: cr, maxLines: 1, start: 52, min: 44, gap: 16 }));
          } else L.push(bloque(g, "Fecha por anunciar", (s) => F(FR, s, 400, true), { x: M, color: th.acc, maxW: d.place ? cl : TW, maxLines: 2, start: 60 * k, min: 40, lh: 1.1 }));
          if (d.place) {
            Rr.push(capsB(g, "Lugar", { x: xr, size: 24, color: th.acc, fam: WS, w: 600, gap: Rr.length ? 40 : 0 }));
            Rr.push(bloque(g, d.place, (s) => F(FR, s, 400), { x: xr, color: th.ink, maxW: cr, maxLines: 4, start: 38, min: 30, lh: 1.2, gap: 16 }));
          }
          const h = Math.max(alto(L), alto(Rr));
          return { h, gap: 44, draw: (y) => { apilar(L, y); apilar(Rr, y); } };
        };
        build = (k) => [
          capsB(g, d.eyebrow || "Le invitamos", { x: M, size: 26, color: th.acc, fam: WS, w: 600 }),
          bloque(g, d.title, (s) => F(DS, s), { x: M - 3, color: th.ink, maxW: TW, maxLines: 4, start: 126 * k, min: 56, lh: 1.0, gap: 26 }),
          acento(40),
          ficha(k),
          ...(d.body ? [cuerpo(g, d.body, { x: M, width: TW, size: Math.max(30, 38 * k), color: th.ink, acc: th.acc, gap: 44 })] : []),
        ];
        kmax = 1.5;
      } else {
        // en el versículo el saludo no se achica: lo que se ajusta es el cuerpo
        const headSize = story ? 120 : sq ? 84 : 104;
        build = (k) => [
          capsB(g, d.eyebrow || "Lectura del día", { x: M, size: 26, color: th.acc, fam: WS, w: 600, maxW: TW }),
          bloque(g, d.head || "Palabra para hoy", (s) => F(DS, s), { x: M - 3, color: th.ink, maxW: TW, maxLines: 2, start: headSize, min: 56, lh: 1.0, gap: 24 }),
          capsB(g, `${d.ref} · Reina-Valera 1960`, { x: M, size: 26, color: th.ink, alpha: 0.85, gap: 22, fam: WS, w: 600, maxW: TW }),
          acento(36),
          cuerpo(g, d.text, { x: M, width: TW, size: Math.max(32, (story ? 72 : 60) * k), color: th.ink, acc: th.acc, gap: 40 }),
        ];
        kmax = 1.6;
      }
      const { it, t } = encaja(build, y1 - y0, kmax);
      apilar(it, y0 + Math.max(0, (y1 - y0 - t) * (story || (d.kind === "ann" && !d.date) ? 0.45 : 0.3)));
    },
  });

  // =====================================================================
  // «Cita»: fondo claro, texto negro y comillas de color colgadas en el margen; el aviso va sin comillas,
  // con el día enorme en Abril Fatface. Con foto: duotono a sangre arriba y el texto sobre color plano abajo.
  E.add({
    id: "edi-cita", name: "Cita destacada", family: "editorial", fonts: ["Abril Fatface", "DM Serif Display", "Montserrat"],
    themes: {
      linea: { name: "Marino y oro", bg: "#f7f3ea", ink: "#0d1b3d", acc: "#2d5fa8", acc2: "#f2c85b" },
      hueso: { name: "Hueso y teja", bg: "#efe9dd", ink: "#1d1d1b", acc: "#b5502a" },
      terracota: { name: "Terracota", bg: "#f3e4d6", ink: "#2a140c", acc: "#9a3f22" },
      menta: { name: "Menta y pizarra", bg: "#e2eee7", ink: "#1b2629", acc: "#2b7a60" },
      mostaza: { name: "Mostaza", bg: "#efcf73", ink: "#1f1a10", acc: "#8a2b1d" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 84, story = H > 1500, sq = H < 1200, foto = g.photoOn, DS = "DM Serif Display", AF = "Abril Fatface", MS = "Montserrat";
      const acc2 = th.acc2 || th.acc;
      g.paper(th.bg, { fibers: 0.35, grain: 0.05 });
      let y = story ? 140 : sq ? 60 : 70;
      if (foto) {
        const fh = Math.round(H * (story ? 0.38 : d.kind === "card" ? 0.3 : sq ? 0.34 : 0.36));
        duo(g, 0, 0, W, fh, g.mix(th.ink, "#000000", 0.1), g.mix(th.bg, "#ffffff", 0.35), { fy: 0.32 });
        rule(g, 0, fh, W, acc2, 10);
        y = fh + (story ? 80 : 56);
      }
      const bot = H - (story ? 130 : 60);
      const logoY = (h) => g.logo(W - M, bot - h + 4, h, { align: "right" });

      // cita con la comilla de apertura colgada en el margen y la de cierre pequeña al final
      const TX = M + 92, TW = W - M - TX;
      const cita = (s, size, o = {}) => {
        s = String(s || "").trim().replace(/^[«"“]+/, "").replace(/[»"”]+$/, "");
        const close = "”", fontFn = (z) => F(DS, z);
        let f = g.fit(s, fontFn, { maxW: TW - size * 0.45, maxLines: o.maxLines || 9, start: size, min: o.min || 34, lh: 1.14 });
        f = equilibra(g, f, s, TW - size * 0.45);
        const asc = f.size * 0.76, h = asc + (f.lines.length - 1) * f.lh + f.size * 0.24;
        return { h, gap: o.gap || 0, draw: (top) => {
          const qf = F(AF, Math.min(f.size * 2.3, 260)); ctx.font = qf; const qm = ctx.measureText("“");
          g.text("“", TX - 22 - qm.width, top + qm.actualBoundingBoxAscent - f.size * 0.02, { font: qf, color: th.acc });
          const last = g.lines(f.lines, TX, top + asc, f.lh, { font: f.font, color: th.ink });
          const lw = g.measure(f.lines[f.lines.length - 1], f.font);
          g.text(close, TX + lw + f.size * 0.06, last, { font: F(AF, f.size), color: th.acc });
        } };
      };
      const atrib = (s, gap) => ({ h: 30, gap, draw: (yy) => { rule(g, TX, yy + 12, 56, acc2 === th.acc ? th.acc : acc2, 6); caps(g, s, TX + 78, yy + 24, { size: 30, color: th.ink, maxW: TW - 78 }); } });

      if (d.kind === "card") {
        // pie: firma
        const sg = g.fit(d.signature, (s) => F(DS, s, 400, true), { maxW: TW - 130, maxLines: 1, start: 48, min: 34 });
        const fr = g.fit(capi(d.from), (s) => F(MS, s, 500), { maxW: TW - 130, maxLines: 2, start: 28, min: 26, lh: 1.25 });
        const fy = bot - (fr.lines.length - 1) * fr.lh;
        g.lines(fr.lines, TX, fy, fr.lh, { font: fr.font, color: th.ink, alpha: 0.9 });
        g.text(sg.lines[0], TX, fy - fr.size - 22, { font: sg.font, color: th.ink });
        logoY(64);
        const ruleY = fy - fr.size - 22 - sg.size - 40;
        rule(g, TX, ruleY, TW, th.ink, 1.5, 0.35);
        const { it, t } = encaja((k) => [
          capsB(g, d.kicker, { x: TX, size: 26, color: th.acc, maxW: TW }),
          bloque(g, d.headline, (s) => F(DS, s, 400, true), { x: TX, color: th.acc, maxW: TW, maxLines: 2, start: 66 * k, min: 40, lh: 1.05, gap: 18 }),
          bloque(g, d.name, (s) => F(DS, s), { x: TX - 3, color: th.ink, maxW: TW, maxLines: 3, start: 108 * k, min: 52, lh: 1.0, gap: 8 }),
          bloque(g, d.line, (s) => F(MS, s, 500), { x: TX, color: th.ink, alpha: 0.9, maxW: TW, maxLines: 2, start: 30, min: 28, lh: 1.3, gap: 18 }),
          cita(d.verse, Math.max(34, 50 * k), { gap: 54, maxLines: 6 }),
          atrib(d.ref, 34),
        ], ruleY - 44 - y, 1.6);
        apilar(it, y + Math.max(0, (ruleY - 44 - y - t) * 0.5));
      } else if (d.kind === "ann") {
        // aviso: sin comillas; el día enorme en el color de acento y la ficha alineada al título
        const ch = g.fit(d.church, (s) => F(MS, s, 700), { maxW: W - 2 * M - 120, maxLines: 1, start: 26, min: 22 });
        caps(g, d.church, M, bot, { size: ch.size, color: th.ink, alpha: 0.85, maxW: W - 2 * M - 120 });
        logoY(58);
        const dia = (k) => {
          if (!d.date) {
            const z = 170 * k;
            return { h: z * 0.74 + 60, gap: 0, draw: (yy) => { g.text("Pronto", M - 4, yy + z * 0.74, { font: F(AF, z), color: th.acc }); caps(g, "Fecha por anunciar", M, yy + z * 0.74 + 56, { size: 30, color: th.ink, maxW: W - 2 * M }); } };
          }
          const z = Math.min(300 * k, 330), df = F(AF, z), dw = g.measure(d.day, df), sx = M + dw + 34, sw = W - M - sx;
          const mf = g.fit(d.month, (s) => F(DS, s, 400, true), { maxW: sw, maxLines: 1, start: Math.min(72, z * 0.3), min: 40 });
          return { h: z * 0.72, gap: 0, draw: (yy) => {
            const base = yy + z * 0.72;
            g.text(d.day, M - 6, base, { font: df, color: th.acc });
            g.text(mf.lines[0], sx, base - 52, { font: mf.font, color: th.ink });
            caps(g, d.weekday, sx, base, { size: 30, color: th.ink, maxW: sw });
          } };
        };
        const area = bot - 90 - y;
        const build = (k) => [
          dia(k),
          hueco(0, 1),
          bloque(g, d.title, (s) => F(DS, s), { x: M - 3, color: th.ink, maxW: W - 2 * M, maxLines: 4, start: 150 * k, min: 64, lh: 1.02, gap: 54 }),
          ...(d.date ? [{ h: 40, gap: 40, draw: (yy) => { rule(g, M, yy + 4, 12, th.acc, 36); g.text(d.time, M + 34, yy + 36, { font: F(MS, 46, 700), color: th.ink }); } }] : []),
          ...(d.place ? [bloque(g, d.place, (s) => F(DS, s, 400, true), { x: d.date ? M + 34 : M, color: th.ink, maxW: W - 2 * M - 34, maxLines: 3, start: 44, min: 34, lh: 1.15, gap: d.date ? 22 : 40 })] : []),
        ];
        const { it, t } = encaja(build, area, 1.3);
        apilar(it, y, area - t);
      } else {
        if (d.firma) caps(g, d.church, TX, bot, { size: 26, color: th.ink, alpha: 0.85, maxW: TW - 120 });
        logoY(54);
        const area = bot - 90 - y;
        const { it, t } = encaja((k) => [
          ...(d.eyebrow ? [capsB(g, d.eyebrow, { x: TX, size: 26, color: th.acc, maxW: TW })] : []),
          ...(d.head ? [bloque(g, d.head, (s) => F(DS, s, 400, true), { x: TX, color: th.acc, maxW: TW, maxLines: 2, start: 70, min: 44, lh: 1.05, gap: d.eyebrow ? 20 : 0 })] : []),
          cita(d.text, (story ? 104 : sq ? 92 : 96) * k, { gap: d.head || d.eyebrow ? 70 : 0, maxLines: 10, min: 40 }),
          atrib(d.ref, 50),
        ], area, 1.4);
        apilar(it, y + Math.max(0, (area - t) * (foto ? 0.3 : 0.42)));
      }
    },
  });

  // =====================================================================
  // «Índice»: el sumario de una revista: números grandes en cursiva de acento y filas con filetes.
  // Sin cabecera de revista; con foto, una «portada del índice» a sangre arriba en duotono del papel.
  function filas(g, rows, x0, y0, y1, th, o = {}) {
    const { F, W } = g, numW = o.numW || 150, tx = x0 + numW, tw = W - x0 - tx, numS = o.numSize || 80;
    let best = null;
    for (let k = o.grow || 1.6; k >= 0.45; k -= 0.05) {
      const pad = Math.max(14, 28 * Math.min(k, 1.2));
      const fs = rows.map((r) => { const s = r.text, f = g.fit(s, (z) => F(r.fam || "Playfair Display", z, r.w || 500, !!r.it), { maxW: tw, maxLines: r.maxLines || 3, start: r.start * k, min: r.min || 30, lh: r.lh || 1.15 }); return equilibra(g, f, s, tw); });
      const rowHs = fs.map((f, i) => Math.max((rows[i].label ? 40 : 0) + f.size * 0.76 + (f.lines.length - 1) * f.lh + f.size * 0.24, numS * 0.74) + 2 * pad);
      best = { fs, rowHs, pad, tot: rowHs.reduce((a, b) => a + b, 0) };
      if (best.tot <= y1 - y0) { best.k = k; break; }
    }
    if (o.dry) return best.tot <= y1 - y0 && (best.k ?? 0) >= (o.kmin || 0);
    const extra = Math.max(0, Math.min((y1 - y0 - best.tot) / rows.length, o.maxExtra ?? 60));
    let y = y0;
    rows.forEach((r, i) => {
      const f = best.fs[i], pad = best.pad + extra / 2;
      rule(g, x0, y, W - 2 * x0, th.ink, i ? 1.5 : 4, i ? 0.4 : 1);
      g.text(r.num ?? String(i + 1).padStart(2, "0"), x0, y + pad + numS * 0.72, { font: F("Playfair Display", numS, 700, true), color: th.acc });
      let ty = y + pad;
      if (r.label) { caps(g, r.label, tx, ty + 20, { size: 24, fam: "Hanken Grotesk", w: 700, color: th.ink, alpha: 0.8, maxW: tw }); ty += 40; }
      g.lines(f.lines, tx, ty + f.size * 0.76, f.lh, { font: f.font, color: th.ink });
      y += best.rowHs[i] + extra;
    });
    rule(g, x0, y, W - 2 * x0, th.ink, 1.5, 0.4);
    return y;
  }
  E.add({
    id: "edi-indice", name: "Índice", family: "editorial", fonts: ["Playfair Display", "Hanken Grotesk"],
    themes: {
      papel: { name: "Papel y carmín", bg: "#f5f1ea", ink: "#1a1a1a", acc: "#b5122e" },
      marino: { name: "Marino y oro", bg: "#0d1b3d", ink: "#f4eee2", acc: "#f2c85b" },
      arena: { name: "Arena", bg: "#ece2cf", ink: "#2b2118", acc: "#8a5a2b" },
      pino: { name: "Pino y durazno", bg: "#1d3a2c", ink: "#f0e9d6", acc: "#f0a072" },
      cielo: { name: "Cielo claro", bg: "#e6edf5", ink: "#0f1e3a", acc: "#2d5fa8" },
    },
    draw(g) {
      const { W, H, th, d, F } = g, M = 80, story = H > 1500, sq = H < 1200, foto = g.photoOn, dark = g.lum(th.bg) < 0.5, PF = "Playfair Display", HG = "Hanken Grotesk";
      g.paper(th.bg, { fibers: 0.3, grain: 0.05 });
      const top = story ? 130 : sq ? 56 : 64;
      const bot = H - (story ? 120 : sq ? 50 : 56), rowsBot = bot - 54;
      // las filas de cada pieza
      let rows, ext = {};
      if (d.kind === "card") {
        rows = [
          { label: "Para", text: d.name, w: 900, start: 100, min: 48, maxLines: 2, lh: 1.02 },
          { label: "Motivo", text: d.line, it: true, start: 44, min: 32, maxLines: 2 },
          { label: `La Palabra · ${d.ref}`, text: `«${d.verse}»`, start: 36, min: 30, maxLines: 5, lh: 1.24 },
          { label: "Con cariño", text: `${d.signature}, ${d.from}`, it: true, start: 38, min: 30, maxLines: 2 },
        ];
      } else if (d.kind === "ann") {
        // el título del evento es la fila 01, a gran tamaño; «Agenda» queda como etiqueta
        rows = [{ label: "Evento", text: d.title, w: 900, start: 104, min: 54, maxLines: 4, lh: 1.0 }];
        if (d.date) rows.push({ label: "Fecha", text: capi(d.when), start: 54, min: 36, maxLines: 2 }, { label: "Hora", text: d.time, w: 700, start: 60, min: 44, maxLines: 1 });
        else rows.push({ label: "Fecha", text: "Por anunciar", it: true, start: 54, min: 36, maxLines: 1 });
        if (d.place) rows.push({ label: "Lugar", text: d.place, start: 46, min: 32, maxLines: 3 });
        if (!d.date) rows.push({ label: "Muy pronto", text: d.place ? "Le avisaremos la fecha por este medio." : "Le avisaremos la fecha y el lugar por este medio.", it: true, start: 44, min: 32, maxLines: 3 });
        ext = { maxExtra: 90 };
      } else {
        // el versículo va seguido, en una sola entrada; la cita y la firma en sus propias filas
        rows = [
          { label: "Lectura", text: d.text, start: story ? 76 : sq ? 54 : 64, min: 34, maxLines: 9, lh: 1.16 },
          { label: "Cita · Reina-Valera 1960", text: d.ref, w: 700, it: true, start: story ? 60 : 50, min: 36, maxLines: 1 },
        ];
        if (d.firma) rows.push({ label: "De parte de", text: d.church, start: 36, min: 30, maxLines: 2 });
        ext = { maxExtra: story ? 140 : 60 };
      }
      // etiqueta y titular (en el aviso, el titular es el propio evento, en la fila 01)
      const label = d.kind === "card" ? "En esta edición" : d.kind === "ann" ? `Agenda · ${d.month || "próximamente"}` : (d.eyebrow || "Lectura del día");
      const titular = d.kind === "card" ? d.headline : d.kind === "verse" ? (d.head || "Para hoy") : "";
      const plan = (ph, conTit) => {
        const head = [capsB(g, conTit || d.kind !== "card" ? label : d.headline, { x: M, size: 26, fam: HG, w: 700, color: th.acc, maxW: W - 2 * M })];
        if (titular && conTit) head.push(bloque(g, titular, (s) => F(PF, s, 900), { x: M - 4, color: th.ink, maxW: W - 2 * M, maxLines: 2, start: story ? 120 : sq ? 90 : 104, min: 60, lh: 0.98, gap: 22 }));
        const y0 = ph ? ph + (story ? 70 : 46) : top;
        return { ph, head, y0, rowsTop: y0 + alto(head) + (story ? 64 : sq ? 36 : 44) };
      };
      // con foto: «portada del índice» a sangre arriba; si no cabe, primero se achica la foto, luego se quita
      // el titular y, al final, la foto (nunca se encoge todo)
      let p = plan(0, true);
      if (foto) {
        const base = Math.round(H * (sq ? 0.4 : story ? 0.34 : 0.36));
        const b2 = Math.round(base * 0.78);
        const ops = [[base, true, 0.85], [b2, true, 0.85], [base, false, 0.85], [b2, false, 0.85], [b2, false, 0], [0, true, 0]];
        for (const [ph, ct, km] of ops) { p = plan(ph, ct); if (filas(g, rows, M, p.rowsTop, rowsBot, th, { ...ext, dry: true, kmin: km })) break; }
        if (p.ph) {
          const sombra = dark ? g.mix(th.bg, "#000000", 0.35) : th.ink, luz = dark ? g.mix(th.ink, th.acc, 0.25) : th.bg;
          duo(g, 0, 0, W, p.ph, sombra, luz, { fy: 0.3 });
        }
      }
      caps(g, d.church, M, bot, { size: 24, fam: HG, w: 700, color: th.ink, alpha: 0.8, maxW: W - 2 * M - 120 });
      g.logo(W - M, bot - 40, 46, { white: dark, align: "right" });
      apilar(p.head, p.y0);
      filas(g, rows, M, p.rowsTop, rowsBot, th, ext);
    },
  });

  // =====================================================================
  // «Número»: hoja de calendario de taco: mes, fila de días de la semana con el día marcado y un número gigante
  E.add({
    id: "edi-numero", name: "Número gigante", family: "editorial", fonts: ["Fraunces", "Work Sans"],
    themes: {
      blanco: { name: "Blanco y bermellón", bg: "#fbfaf7", ink: "#151515", acc: "#d2452f" },
      marino: { name: "Marino y oro", bg: "#0d1b3d", ink: "#f5efe2", acc: "#f2c85b" },
      hueso: { name: "Hueso y azul", bg: "#f1ebe0", ink: "#1c2a44", acc: "#2d5fa8" },
      salvia: { name: "Salvia y ladrillo", bg: "#e2e8de", ink: "#1d2b22", acc: "#b4572f" },
      lino: { name: "Lino y ciruela", bg: "#f4eee6", ink: "#231a22", acc: "#7a2f5d" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 80, story = H > 1500, sq = H < 1200, foto = g.photoOn, dark = g.lum(th.bg) < 0.5, FR = "Fraunces", WS = "Work Sans";
      g.paper(th.bg, { fibers: 0.22, grain: 0.045, mottle: 0.5 });
      const f = fechaDe(d), top = story ? 140 : sq ? 50 : 60;
      // cabecera de calendario: mes y año, y la semana con el día marcado
      caps(g, f ? `${MES[f.mes] || ""} ${f.y}` : "Fecha por anunciar", M, top + 30, { size: 34, fam: WS, w: 600, color: th.ink, maxW: W - 2 * M - 140, sp: 6 });
      g.logo(W - M, top - 4, 46, { white: dark, align: "right" });
      const ry = top + 56, cw = (W - 2 * M) / 7, rh = sq ? 60 : 68;
      rule(g, M, ry, W - 2 * M, th.ink, 2, 0.8); rule(g, M, ry + rh, W - 2 * M, th.ink, 1.5, 0.45);
      ["D", "L", "M", "M", "J", "V", "S"].forEach((l, i) => {
        const cx = M + cw * (i + 0.5), on = f && f.wd === i;
        if (i) rule(g, M + cw * i, ry + 14, 1.5, th.ink, rh - 28, 0.25);
        if (on) { ctx.save(); ctx.fillStyle = th.acc; ctx.beginPath(); ctx.arc(cx, ry + rh / 2, rh * 0.36, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
        g.text(l, cx, ry + rh / 2 + 11, { font: F(WS, 32, 600), color: on ? th.bg : th.ink, align: "center", alpha: on ? 1 : 0.75 });
      });
      let y = ry + rh + (story ? 90 : sq ? 30 : 50);

      // número gigante dentro de una caja; devuelve sus bordes
      const numero = (s, x, yy, maxW, maxH, font = (z) => F(FR, z, 900)) => {
        ctx.font = font(100); const m = ctx.measureText(s), hh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
        const size = Math.max(60, Math.min((maxH / hh) * 100, (maxW / (m.actualBoundingBoxRight + m.actualBoundingBoxLeft)) * 100, story ? 1000 : 820));
        const fo = font(size); ctx.font = fo; const m2 = ctx.measureText(s);
        const bx = x + m2.actualBoundingBoxLeft, base = yy + m2.actualBoundingBoxAscent;
        if (foto) letraFoto(g, s, bx, base, fo, th.acc);
        else g.text(s, bx, base, { font: fo, color: th.acc });
        return { right: bx + m2.actualBoundingBoxRight, bottom: base + m2.actualBoundingBoxDescent, base, top: yy, size };
      };
      // texto junto al número, alineado a su base
      const lado = (n, a, b) => {
        const x = n.right + 34, w = W - M - x; if (w < 160) return false;
        const t = g.fit(a, (s) => F(FR, s, 400, true), { maxW: w, maxLines: 2, start: 72, min: 40, lh: 1.05 });
        const yy = n.base - (b ? 50 : 0) - (t.lines.length - 1) * t.lh;
        g.lines(t.lines, x, yy, t.lh, { font: t.font, color: th.ink });
        if (b) caps(g, b, x + 2, n.base, { size: 28, fam: WS, w: 600, color: th.ink, maxW: w });
        return true;
      };

      if (d.kind === "card") {
        const anos = d.occasion === "bodas" && (String(d.line).match(/(\d+)\s*años?/i) || [])[1];
        const ini = (String(d.name).replace(/^(hn[oa]s?|hermano|hermana|sr|sra|pastor)\.?\s+/i, "")[0] || "★").toUpperCase();
        const s = anos || (f && f.dia) || ini, side = anos ? "años" : f ? MES[f.mes] : "";
        const fb = H - M;
        // pie: el versículo a lo ancho (a 32 px) con su cita, y la firma en una fila aparte
        const sg = g.fit(d.signature, (z) => F(FR, z, 400, true), { maxW: (W - 2 * M) * 0.5, maxLines: 1, start: 42, min: 32 });
        const sgw = g.measure(sg.lines[0], sg.font);
        const fr = g.fit(capi(d.from), (z) => F(WS, z, 500), { maxW: W - 2 * M - sgw - 40, maxLines: 2, start: 30, min: 28, lh: 1.2 });
        g.text(sg.lines[0], M, fb, { font: sg.font, color: th.ink });
        g.lines(fr.lines, W - M, fb - (fr.lines.length - 1) * fr.lh, fr.lh, { font: fr.font, color: th.ink, align: "right", alpha: 0.9 });
        const sTop = fb - sg.size * 0.8 - (fr.lines.length - 1) * fr.lh;
        rule(g, M, sTop - 30, W - 2 * M, th.ink, 1.5, 0.35);
        caps(g, d.ref, M, sTop - 72, { size: 26, fam: WS, w: 600, color: th.acc, maxW: W - 2 * M });
        const vs = g.fit(`«${d.verse}»`, (z) => F(WS, z, 400), { maxW: W - 2 * M, maxLines: 5, start: 34, min: 30, lh: 1.3 });
        const vl = equilibra(g, vs, `«${d.verse}»`, W - 2 * M).lines;
        const vy0 = sTop - 118 - (vl.length - 1) * vs.lh;
        g.lines(vl, M, vy0, vs.lh, { font: vs.font, color: th.ink });
        const ruleY = vy0 - vs.size - 40;
        rule(g, M, ruleY, W - 2 * M, th.ink, 1.5, 0.6);
        const { it, t } = encaja((k) => [
          bloque(g, d.headline, (z) => F(FR, z, 400, true), { x: M, color: th.ink, maxW: W - 2 * M, maxLines: 2, start: 62 * k, min: 40, lh: 1.05 }),
          bloque(g, d.name, (z) => F(FR, z, 700), { x: M - 3, color: th.ink, maxW: W - 2 * M, maxLines: 3, start: 100 * k, min: 50, lh: 1.0, gap: 12 }),
          bloque(g, d.line, (z) => F(WS, z, 400), { x: M, color: th.ink, alpha: 0.9, maxW: W - 2 * M, maxLines: 2, start: 32, min: 30, lh: 1.3, gap: 22 }),
        ], (ruleY - 50 - y) * 0.5);
        const tTop = ruleY - 50 - t;
        const n = numero(s, M, y, s.length > 1 ? W - 2 * M - 300 : W * 0.5, tTop - 50 - y);
        if (side) lado(n, side, anos ? "de bendición" : f ? DIAS[f.wd] : "");
        apilar(it, tTop);
      } else if (d.kind === "ann") {
        const fb = H - M;
        caps(g, d.church, M, fb, { size: 24, fam: WS, w: 600, color: th.ink, alpha: 0.85, maxW: W - 2 * M });
        const ruleY = fb - 52;
        rule(g, M, ruleY, W - 2 * M, th.ink, 1.5, 0.6);
        // el título, la hora (grande, debajo del título) y el lugar, de abajo hacia arriba
        const { it, t } = encaja((k) => [
          bloque(g, d.title, (z) => F(FR, z, 700), { x: M - 3, color: th.ink, maxW: W - 2 * M, maxLines: 4, start: 112 * k, min: 54, lh: 1.0 }),
          ...(d.date ? [bloque(g, `${capi(d.weekday)} · ${d.time}`, (z) => F(FR, z, 400, true), { x: M, color: th.acc, maxW: W - 2 * M, maxLines: 1, start: 56 * Math.min(k, 1.1), min: 44, gap: 24 })] : []),
          ...(d.place ? [bloque(g, d.place, (z) => F(WS, z, 400), { x: M, color: th.ink, maxW: W - 2 * M - 40, maxLines: 3, start: 34, min: 30, lh: 1.28, gap: 22 })] : []),
        ], (ruleY - 46 - y) * 0.56, 1.3);
        const tTop = ruleY - 46 - t;
        if (d.date) {
          const wide = d.day.length > 1, n = numero(d.day, M, y, wide ? W - 2 * M - 330 : W * 0.42, tTop - 70 - y);
          if (!lado(n, d.month, d.weekday)) g.text(d.month, M, n.bottom + 60, { font: F(FR, 56, 400, true), color: th.ink });
          rule(g, M, tTop - 40, 120, th.acc, 4);
        } else {
          const n = numero("pronto", M, y, W - 2 * M, Math.min(300, tTop - 140 - y), (z) => F(FR, z, 400, true));
          caps(g, "Fecha por anunciar", M, n.bottom + 64, { size: 30, fam: WS, w: 600, color: th.ink });
        }
        apilar(it, tTop);
      } else {
        // versículo: el número gigante es el día de hoy; la cita va grande en cursiva al pie del texto
        const bot = H - (story ? 200 : sq ? 56 : M);
        if (d.firma) caps(g, d.church, M, bot, { size: 24, fam: WS, w: 600, color: th.ink, alpha: 0.85, maxW: W - 2 * M });
        const tb = bot - (d.firma ? 64 : 0);
        const { it, t } = encaja((k) => [
          ...(d.head ? [bloque(g, d.head, (z) => F(FR, z, 400, true), { x: M, color: th.ink, maxW: W - 2 * M, maxLines: 2, start: 60, min: 40, lh: 1.05 })] : []),
          bloque(g, d.text, (z) => F(FR, z, 400), { x: M, color: th.ink, maxW: W - 2 * M, maxLines: 10, start: (story ? 76 : 66) * k, min: 34, lh: 1.2, gap: d.head ? 30 : 0 }),
          bloque(g, d.ref, (z) => F(FR, z, 400, true), { x: M, color: th.acc, maxW: W - 2 * M, maxLines: 1, start: (story ? 64 : sq ? 46 : 56) * Math.min(k, 1.1), min: 36, gap: 26 }),
        ], (tb - 40 - y) * (sq ? 0.6 : 0.56), 1.3);
        const tTop = tb - t;
        const n = numero(f.dia, M, y, f.dia.length > 1 ? W - 2 * M - 330 : W * 0.4, tTop - 60 - y);
        lado(n, MES[f.mes], DIAS[f.wd]);
        apilar(it, tTop);
      }
    },
  });

  // =====================================================================
  // «Invitación»: tarjeta de papel algodón sobre la mesa, alineada a la izquierda, con el título en versalitas
  // grandes y un solo gesto: el sello de lacre (con el día del evento). Sin marcos ni adornos repetidos.
  E.add({
    id: "edi-invitacion", name: "Invitación fina", family: "editorial", fonts: ["Cormorant Garamond", "Montserrat"],
    themes: {
      marfil: { name: "Marfil y lacre", bg: "#b7a687", card: "#fbf6ea", ink: "#2b2420", acc: "#9e2a22" },
      piedra: { name: "Gris piedra", bg: "#2f3133", card: "#d9d6ce", ink: "#1d1f22", acc: "#2f5640" },
      linea: { name: "Marino y oro", bg: "#2d5fa8", card: "#0d1b3d", ink: "#f4ecd8", acc: "#f2c85b" },
      rosa: { name: "Rosa y vino", bg: "#d9bdb2", card: "#fff7f2", ink: "#3d2224", acc: "#7d2238" },
      salvia: { name: "Salvia y oliva", bg: "#7d8b72", card: "#eef0e3", ink: "#243020", acc: "#55662a" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F, R } = g, story = H > 1500, sq = H < 1200, foto = g.photoOn, CG = "Cormorant Garamond", MS = "Montserrat";
      const cardDark = g.lum(th.card) < 0.5;
      // la mesa (o la foto, que queda visible arriba)
      g.paper(th.bg, { fibers: 0.3, grain: 0.06 });
      const mx = foto ? 40 : sq ? 56 : 64, cX = mx, cW = W - 2 * mx, pad = sq ? 64 : 76, TX = cX + pad, maxW = cW - 2 * pad;
      const padT = sq ? 104 : 124, padB = sq ? 60 : 72;
      const c = { x: TX };
      const lab = (s, gap = 0, o = {}) => capsB(g, s, { ...c, size: 28, color: o.color || th.ink, alpha: o.alpha ?? 0.9, gap, maxW, min: 22, sp: 4 });
      const T = (s, z) => g.F(CG, z, 700);
      let build, sello;
      if (d.kind === "card") {
        const f = fechaDe(d);
        sello = d.occasion === "bodas" ? { rings: true } : f ? { n: f.dia, s: MES[f.mes].slice(0, 3) } : { cross: true };
        build = (k) => [
          lab(d.kicker, 0, { color: th.acc, alpha: 1 }),
          bloque(g, d.headline, (s) => F(CG, s, 600, true), { ...c, color: th.acc, maxW, maxLines: 2, start: 66 * k, min: 42, lh: 1.02, gap: 18 }),
          bloque(g, up(d.name), (s) => T(d.name, s), { ...c, color: th.ink, maxW, maxLines: 3, start: 92 * k, min: 46, lh: 1.04, gap: 14, sp: (z) => Math.round(z * 0.05) }),
          hueco(0, 1),
          raya(g, TX, 90, th.acc, 3, 34),
          bloque(g, d.line, (s) => F(CG, s, 500, true), { ...c, color: th.ink, maxW, maxLines: 2, start: 46 * k, min: 34, lh: 1.12, gap: 28 }),
          bloque(g, `«${d.verse}»`, (s) => F(CG, s, 600), { ...c, color: th.ink, maxW, maxLines: 6, start: 38 * k, min: 32, lh: 1.2, gap: 24 }),
          lab(d.ref, 18, { color: th.acc, alpha: 1 }),
          hueco(0, 1),
          bloque(g, d.signature, (s) => F(CG, s, 600, true), { ...c, color: th.ink, maxW: maxW - 110, maxLines: 1, start: 52 * k, min: 38, gap: 40 }),
          bloque(g, capi(d.from), (s) => F(MS, s, 500), { ...c, color: th.ink, alpha: 0.9, maxW: maxW - 110, maxLines: 2, start: 30, min: 28, lh: 1.25, gap: 10 }),
        ];
      } else if (d.kind === "ann") {
        sello = d.date ? { n: d.day, s: String(d.month).slice(0, 3) } : { cross: true };
        build = (k) => [
          lab(d.church, 0, { alpha: 0.9 }),
          bloque(g, "tiene el gusto de invitarle a", (s) => F(CG, s, 500, true), { ...c, color: th.ink, maxW, maxLines: 1, start: 46 * k, min: 34, gap: 22 }),
          bloque(g, up(d.title), (s) => T(d.title, s), { ...c, color: th.acc, maxW, maxLines: 4, start: 104 * k, min: 50, lh: 1.04, gap: 22, sp: (z) => Math.round(z * 0.05) }),
          hueco(0, 1),
          raya(g, TX, 90, th.acc, 3, 34),
          ...(d.date ? [
            bloque(g, capi(d.when), (s) => F(CG, s, 600, true), { ...c, color: th.ink, maxW, maxLines: 2, start: 54 * k, min: 42, lh: 1.08, gap: 26 }),
            bloque(g, d.time.toUpperCase(), (s) => F(MS, s, 700), { ...c, color: th.acc, maxW, maxLines: 1, start: 46 * Math.min(k, 1.1), min: 40, gap: 18, sp: 2 }),
          ] : [bloque(g, "Fecha por anunciar", (s) => F(CG, s, 600, true), { ...c, color: th.ink, maxW, maxLines: 1, start: 54 * k, min: 42, gap: 26 })]),
          ...(d.place ? [bloque(g, d.place, (s) => F(CG, s, 600), { ...c, color: th.ink, maxW: maxW - 110, maxLines: 3, start: 42 * k, min: 34, lh: 1.12, gap: 24 })] : []),
          hueco(0, 1),
        ];
      } else {
        sello = { cross: true };
        build = (k) => [
          ...(d.eyebrow ? [lab(d.eyebrow, 0, { color: th.acc, alpha: 1 })] : []),
          ...(d.head ? [bloque(g, d.head, (s) => F(CG, s, 600, true), { ...c, color: th.acc, maxW, maxLines: 2, start: 72, min: 46, lh: 1.02, gap: d.eyebrow ? 18 : 0 })] : []),
          hueco(0, 1),
          bloque(g, d.text, (s) => F(CG, s, 700), { ...c, color: th.ink, maxW, maxLines: 12, start: (story ? 88 : sq ? 74 : 80) * k, min: 38, lh: 1.12, gap: d.head || d.eyebrow ? 34 : 0 }),
          raya(g, TX, 90, th.acc, 3, 40),
          lab(d.ref, 28, { color: th.acc, alpha: 1 }),
          hueco(0, 1),
          ...(d.firma ? [bloque(g, d.church, (s) => F(MS, s, 500), { ...c, color: th.ink, alpha: 0.9, maxW: maxW - 110, maxLines: 1, start: 30, min: 26, gap: 30 })] : []),
        ];
      }
      // tamaño de la tarjeta: sin foto ocupa la mesa; con foto es más baja y va abajo, para que la foto se vea
      let cY, cH, fit;
      if (foto) {
        const maxCH = Math.round(H * (story ? 0.5 : sq ? 0.62 : 0.6)), minCH = Math.round(H * 0.42);
        fit = encaja(build, maxCH - padT - padB, 1.2);
        cH = Math.max(minCH, Math.min(maxCH, fit.t + padT + padB)); cY = H - mx - cH;
        // la foto entera queda arriba de la tarjeta (así no tapa caras)
        g.photo(0, 0, W, cY + 60, { treat: "calido", focusY: 0.4 }); g.grain(0.05);
      } else {
        cY = story ? 170 : sq ? 92 : 110; cH = H - cY - (story ? 120 : sq ? 56 : 64);
        fit = encaja(build, cH - padT - padB, story ? 1.3 : 1.5);
      }
      // la tarjeta con canto de papel algodón (un poco irregular) y sombra suave
      const edge = () => {
        ctx.beginPath(); const j = () => (R() - 0.5) * 2.4; ctx.moveTo(cX, cY);
        for (let x = cX; x < cX + cW; x += 12) ctx.lineTo(x, cY + j());
        for (let y = cY; y < cY + cH; y += 12) ctx.lineTo(cX + cW + j(), y);
        for (let x = cX + cW; x > cX; x -= 12) ctx.lineTo(x, cY + cH + j());
        for (let y = cY + cH; y > cY; y -= 12) ctx.lineTo(cX + j(), y);
        ctx.closePath();
      };
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = 36; ctx.shadowOffsetY = 12; ctx.fillStyle = th.card; edge(); ctx.fill(); ctx.restore();
      ctx.save(); edge(); ctx.clip(); g.paper(th.card, { fibers: 0.45, grain: 0.04, mottle: 0.6 }); ctx.restore();
      apilar(fit.it, cY + padT, cH - padT - padB - fit.t);
      g.logo(cX + cW - pad + 10, cY + cH - padB - 52 + 10, 52, { white: cardDark, align: "right", alpha: 0.95 });
      // el sello de lacre, montado sobre el canto de arriba
      const sr = sq ? 78 : story ? 100 : 90, sx = cX + cW - pad - sr + 10, sy = cY + 10;
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6; ctx.fillStyle = th.acc;
      ctx.beginPath(); for (let i = 0; i <= 28; i++) { const a = (i / 28) * Math.PI * 2, r = sr * (1 + (R() - 0.5) * 0.09); i ? ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r) : ctx.moveTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill(); ctx.restore();
      const hondo = g.mix(th.acc, "#000000", 0.28), relieve = g.lum(th.acc) > 0.55 ? g.mix(th.acc, "#000000", 0.62) : g.mix(th.acc, "#ffffff", 0.62);
      ctx.save(); ctx.strokeStyle = hondo; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(sx, sy, sr * 0.74, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = g.rgba("#ffffff", 0.25); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(sx, sy, sr * 0.9, Math.PI * 1.05, Math.PI * 1.55); ctx.stroke(); ctx.restore();
      if (sello.n) {
        const nf = F(CG, sr * 0.7, 700);
        g.text(sello.n, sx, sy + sr * 0.1, { font: nf, color: relieve, align: "center" });
        g.text(up(sello.s), sx, sy + sr * 0.46, { font: F(MS, sr * 0.2, 700), color: relieve, align: "center", sp: 3 });
      } else if (sello.rings) anillos(ctx, sx, sy, sr * 0.3, relieve, 5);
      else cruz(ctx, sx, sy, sr * 0.8, relieve, 8);
    },
  });
})();
