/* Estudio · familia Tipográfica: afiches de letra grande, como los de una imprenta de barrio. */
(function () {
  "use strict";
  const E = window.K && window.K.EST; if (!E) return;

  // ===== ayudantes de la familia =====
  const limpio = (s) => String(s || "").replace(/[¡!¿?]/g, "").trim();
  const palabras = (s) => limpio(s).split(/\s+/).filter(Boolean);
  const ultima = (s) => { const w = palabras(s); return w[w.length - 1] || ""; };
  const antes = (s) => { const w = palabras(s); return w.slice(0, -1).join(" "); };
  const letras = (w) => String(w || "").replace(/[^\p{L}]/gu, "").length;
  // la palabra más larga (para el eco y los recortes)
  const larga = (s) => palabras(s).reduce((a, w) => (letras(w) > letras(a) ? w : a), "").replace(/[,;:.]+$/, "");
  // «Lamentaciones 3:22-23» → ["Lamentaciones", "3:22-23"]
  const cita = (ref) => { const m = String(ref || "").trim().match(/^(.*?)\s*(\d+(?:\s*[:.,\-–]\s*\d+)*)$/); return m && m[1] ? [m[1].trim(), m[2].replace(/\s+/g, "")] : [String(ref || "").trim(), ""]; };
  // «7 de noviembre» → ["7", "noviembre"]
  const fecha = (k) => { const m = String(k || "").trim().match(/^(\d{1,2})\s+de\s+(.+)$/i); return m ? [m[1], m[2]] : null; };
  const cap = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
  const conTilde = (s) => /[ÁÉÍÓÚÑÜ]/.test(String(s || ""));
  // parte una palabra muy larga en dos por una sílaba cerca de la mitad, con guion: ANIVERSARIOS → ANIVER- / SARIOS
  function partir(w, max = 11) {
    const s = String(w || "").toUpperCase(); if ([...s].length <= max) return [s];
    const V = "AEIOUÁÉÍÓÚÜ", F = "AEOÁÉÓÍÚ", grupo = ["BL", "BR", "CL", "CR", "DR", "FL", "FR", "GL", "GR", "PL", "PR", "TR", "CH", "LL", "RR"];
    const v = (c) => !!c && V.includes(c);
    let best = -1, bd = 99;
    for (let i = 2; i <= s.length - 2; i++) {
      const a = s[i - 1], b = s[i], c = s[i + 1];
      let ok = false;
      if (v(a) && !v(b) && v(c)) ok = true; // V|CV
      else if (!v(a) && !v(b) && v(s[i - 2]) && (v(c) || grupo.includes(b + c)) && !grupo.includes(a + b)) ok = true; // VC|CV
      else if (F.includes(a) && F.includes(b)) ok = true; // hiato
      const dd = Math.abs(i - s.length / 2);
      if (ok && dd < bd) { bd = dd; best = i; }
    }
    return best > 0 ? [s.slice(0, best) + "-", s.slice(best)] : [s];
  }
  // alto de mayúscula real de una fuente
  const altoH = (ctx, font) => { ctx.font = font; return ctx.measureText("H").actualBoundingBoxAscent; };
  // interlineado (en «em») para mayúsculas con tildes: deja el alto de la tilde y un poco de aire entre líneas
  const lhTilde = (ctx, fam, min = 1.0, max = 1.14) => {
    ctx.font = `400 100px "${fam}"`;
    const a = ctx.measureText("ÁÉÍÓÚÑ").actualBoundingBoxAscent, dsc = ctx.measureText("Q,;").actualBoundingBoxDescent;
    return Math.max(min, Math.min(max, (a + dsc * 0.6 + 6) / 100));
  };
  // palabras cortas (de, y, la…) que no deben quedar solas al final de una línea: se pegan a la siguiente
  const CORTA = /^(de|del|la|las|el|los|y|e|o|u|a|al|en|por|con|para|mi|tu|su|sus|que|un|una|no|ni|se)$/i;
  const trozos = (s) => {
    const w = String(s || "").split(/\s+/).filter(Boolean), out = [];
    for (let i = 0; i < w.length; i++) { let t = w[i]; while (CORTA.test(w[i].replace(/[^\p{L}]/gu, "")) && i < w.length - 1) { i++; t += " " + w[i]; } out.push(t); }
    return out;
  };
  const wrapT = (g, s, font, maxW, sp = 0) => {
    const out = []; let l = "";
    for (const w of trozos(s)) { const t = l ? l + " " + w : w; if (g.measure(t, font, sp) > maxW && l) { out.push(l); l = w; } else l = t; }
    if (l) out.push(l); return out;
  };
  // como g.fit, pero sin dejar «de», «y» o «la» solos en una línea
  const fitT = (g, s, fontFn, o = {}) => {
    const { maxW = g.W * 0.8, maxH = g.H, maxLines = 6, start = 120, min = 24, lh = 1.1, sp = 0, step = 2 } = o;
    for (let size = start; size >= min; size -= step) {
      const font = fontFn(size), spx = typeof sp === "function" ? sp(size) : sp, lines = wrapT(g, s, font, maxW, spx);
      if (lines.length <= maxLines && lines.length * size * lh <= maxH && lines.every((l) => g.measure(l, font, spx) <= maxW)) return { size, lines, lh: size * lh, h: lines.length * size * lh, font, sp: spx };
    }
    return g.fit(s, fontFn, o);
  };
  // ¿el texto cupo entero (sin cortar con «…»)?
  const entero = (f, maxH) => !f.lines.some((l) => /…$/.test(l)) && (maxH == null || f.h <= maxH + 1);
  // duotono de verdad: las sombras toman el color oscuro y las luces el claro
  function duo(g, x, y, w, h, o = {}) {
    const img = g.img; if (!img) return false;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height; if (!iw || !ih) return false;
    const cw = Math.max(1, Math.ceil(w)), chh = Math.max(1, Math.ceil(h));
    const s = Math.max(w / iw, h / ih), dw = iw * s, dh = ih * s, fx = o.focusX ?? 0.5, fy = o.focusY ?? 0.42;
    const capa = (color, filtro) => {
      const c = document.createElement("canvas"); c.width = cw; c.height = chh; const k = c.getContext("2d");
      k.fillStyle = color; k.fillRect(0, 0, cw, chh); k.globalCompositeOperation = "multiply";
      k.filter = filtro; k.drawImage(img, (w - dw) * fx, (h - dh) * fy, dw, dh); k.filter = "none"; return c;
    };
    const luz = capa(o.light || "#ffffff", "grayscale(1) contrast(1.15)"), sombra = capa(o.dark || "#000000", "grayscale(1) contrast(1.15) invert(1)");
    const k = luz.getContext("2d"); k.globalCompositeOperation = "lighter"; k.drawImage(sombra, 0, 0);
    const { ctx } = g; ctx.save(); ctx.beginPath(); if (o.path) o.path(ctx); else ctx.rect(x, y, w, h); ctx.clip();
    ctx.drawImage(luz, x, y); ctx.restore(); return true;
  }
  // el logo de la iglesia en un solo color (el de la tinta del tema)
  function logoT(g, x, y, h, color, o = {}) {
    const img = g.assets.markW; if (!img || !img.width) { g.logo(x, y, h, o); return; }
    const w = (img.width * h) / img.height, c = document.createElement("canvas"); c.width = Math.ceil(w); c.height = Math.ceil(h);
    const k = c.getContext("2d"); k.drawImage(img, 0, 0, w, h); k.globalCompositeOperation = "source-in"; k.fillStyle = color; k.fillRect(0, 0, w, h);
    const ax = o.align === "left" ? x : o.align === "right" ? x - w : x - w / 2;
    g.ctx.save(); g.ctx.globalAlpha = o.alpha ?? 1; g.ctx.drawImage(c, ax, y); g.ctx.restore();
  }

  // «Cartel»: letra condensada apilada, un trazo de pincel detrás del nombre y una palabra en caligrafía encima
  E.add({
    id: "tip-cartel", name: "Cartel", family: "tipografica", fonts: ["Anton", "Yellowtail", "Work Sans", "Oswald"],
    themes: {
      marino: { name: "Marino y oro", bg: "#10204a", ink: "#f6efe1", acc: "#f2c85b", alt: "#7fa7e0" },
      crema: { name: "Crema y tinta", bg: "#f1e7d3", ink: "#1b1d2c", acc: "#d2452f", alt: "#2d5fa8" },
      bosque: { name: "Bosque", bg: "#173326", ink: "#f3ecd8", acc: "#e9a23b", alt: "#a8c79a" },
      vino: { name: "Vino", bg: "#4a1426", ink: "#fbeee6", acc: "#ffb48a", alt: "#f2c85b" },
      cielo: { name: "Cielo", bg: "#cfe3f2", ink: "#0f2240", acc: "#e4572e", alt: "#2d5fa8" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 84;
      const oscuro = g.lum(th.bg) < 0.5;
      // con foto: la foto en blanco y negro teñida con el color del tema (multiplicar) y un velo ligero
      if (g.photoOn && g.photo(0, 0, W, H, { treat: "bn", focusX: 0.3 })) {
        ctx.save();
        if (oscuro) { ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = g.mix(th.bg, "#ffffff", 0.25); ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = "source-over"; }
        const vg = ctx.createLinearGradient(0, 0, 0, H);
        vg.addColorStop(0, g.rgba(th.bg, oscuro ? 0.55 : 0.78)); vg.addColorStop(0.5, g.rgba(th.bg, oscuro ? 0.42 : 0.68)); vg.addColorStop(1, g.rgba(th.bg, oscuro ? 0.38 : 0.62));
        ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H); ctx.restore();
        g.grain(0.07);
      } else g.paper(th.bg, { fibers: 0.45, grain: 0.07 });
      const onAcc = g.lum(th.acc) > 0.55 ? "#141414" : "#fff";
      const LH = lhTilde(ctx, "Anton");
      // filete fino de imprenta
      ctx.strokeStyle = g.rgba(th.ink, 0.35); ctx.lineWidth = 2; ctx.strokeRect(36, 36, W - 72, H - 72);
      const top = (left, right) => {
        g.text(left.toUpperCase(), M, 104, { font: F("Oswald", 24, 500), color: th.ink, sp: 5, alpha: 0.85 });
        if (right) g.text(right.toUpperCase(), W - M, 104, { font: F("Oswald", 24, 500), color: th.acc, sp: 5, align: "right" });
      };
      // líneas en Anton, estiradas a lo alto (k) como la letra de madera; devuelve la y de abajo
      const estirado = (fit, x, yTop, k, colorOf) => {
        ctx.font = fit.font; const a0 = ctx.measureText(fit.lines[0]).actualBoundingBoxAscent;
        ctx.save(); ctx.translate(0, yTop); ctx.scale(1, k);
        fit.lines.forEach((l, i) => g.text(l, x, a0 + i * fit.lh, { font: fit.font, color: colorOf(i) }));
        ctx.restore();
        return yTop + (a0 + (fit.lines.length - 1) * fit.lh) * k;
      };
      if (d.kind === "card") {
        top(d.church, d.kicker);
        const [lead, main] = g.splitHead(d.headline.replace(/[¡!]/g, ""));
        // primero el bloque de abajo (nombre, frase, versículo), pegado a la firma
        const nm = g.fit(d.name, (s) => F("Oswald", s, 700), { maxW: W - 2 * M - 60, maxLines: 2, start: 82, min: 44, lh: 1.08 });
        const ln = g.fit(d.line, (s) => F("Work Sans", s, 400), { maxW: W - 2 * M, maxLines: 2, start: 42, min: 28, lh: 1.25 });
        let vs = d.verse ? g.fit(`«${d.verse}»`, (s) => F("Work Sans", s, 400), { maxW: W - 2 * M - 260, maxLines: 5, start: 32, min: 24, lh: 1.35, maxH: 230 }) : null;
        if (vs && !entero(vs, 230)) vs = null;
        const refY = H - 240;
        let yv = vs ? refY - 46 - (vs.lines.length - 1) * vs.lh : refY + 40;
        const lnLast = yv - (vs ? vs.size + 70 : 60), lnFirst = lnLast - (ln.lines.length - 1) * ln.lh;
        const nmLast = lnFirst - ln.size - 76, nmFirst = nmLast - (nm.lines.length - 1) * (nm.lh + 18);
        const blockTop = nmFirst - nm.size * 0.92 - 16;
        // el titular llena la columna que queda arriba
        const hz0 = lead ? 250 : 170, hz1 = blockTop - 70;
        const big = g.fit(main.toUpperCase(), (s) => F("Anton", s), { maxW: W - 2 * M, maxLines: 3, start: 260, min: 100, lh: LH, maxH: (hz1 - hz0) / 1.0 });
        ctx.font = big.font;
        const a0 = ctx.measureText(big.lines[0]).actualBoundingBoxAscent, hN = a0 + (big.lines.length - 1) * big.lh;
        const k = Math.max(1, Math.min(1.3, (hz1 - hz0) / hN)), sobra = Math.max(0, hz1 - hz0 - hN * k);
        const bigTop = hz0 + sobra * 0.3;
        estirado(big, M - 4, bigTop, k, () => th.ink);
        if (lead) g.text(lead.toLowerCase(), M + 10, bigTop + 34, { font: F("Yellowtail", 120), color: th.acc, rotate: -0.08, shadow: { color: g.rgba(th.bg, 0.6), blur: 0, x: 3, y: 3 } });
        // el nombre sobre un trazo de pincel
        nm.lines.forEach((l, i) => {
          const w = g.measure(l, nm.font) + 60, yy = nmFirst + i * (nm.lh + 18);
          g.brush(M - 20, yy - nm.size * 0.92, w, nm.size * 1.22, th.acc, { angle: -0.012 });
          g.text(l, M + 10, yy, { font: nm.font, color: onAcc });
        });
        g.lines(ln.lines, M, lnFirst, ln.lh, { font: ln.font, color: th.ink, alpha: 0.9 });
        // versículo en una columna estrecha con raya
        if (vs) {
          ctx.fillStyle = th.acc; ctx.fillRect(M, yv - vs.size, 6, vs.h + 30);
          const vy = g.lines(vs.lines, M + 30, yv, vs.lh, { font: vs.font, color: th.ink, alpha: 0.85 });
          g.text(d.ref.toUpperCase(), M + 30, vy + 46, { font: F("Oswald", 22, 500), color: th.acc, sp: 4 });
        }
        // firma
        g.text(d.signature, W - M, H - 150, { font: F("Yellowtail", 66), color: th.ink, align: "right", rotate: -0.03 });
        g.text(d.from.toUpperCase(), W - M, H - 96, { font: F("Oswald", 20, 500), color: th.acc, sp: 4, align: "right" });
        g.logo(M, H - 190, 96, { white: oscuro, align: "left" });
      } else if (d.kind === "ann") {
        top(d.church, d.date ? d.weekday : "Le invitamos");
        let y = 200;
        if (d.date) {
          // día enorme en contorno, mes en caligrafía encima
          g.text(d.day, M - 10, y + 360, { font: F("Anton", 470), color: null, stroke: th.acc, strokeW: 5 });
          g.text(d.month, M + 40, y + 120, { font: F("Yellowtail", 120), color: th.ink, rotate: -0.07 });
          const tx = M + g.measure(d.day, F("Anton", 470)) + 30;
          g.text(d.time.toUpperCase(), tx, y + 300, { font: F("Oswald", 46, 700), color: th.ink });
          g.text("HORA", tx, y + 340, { font: F("Oswald", 22, 500), color: th.acc, sp: 6 });
          y += 440;
        } else y += 120;
        const pl = d.place ? g.fit(d.place, (s) => F("Work Sans", s, 600), { maxW: W - 2 * M - 80, maxLines: 2, start: 36, min: 24, lh: 1.2 }) : null;
        const room = H - y - 250 - (pl ? pl.h + 60 : 0);
        const t = fitT(g, d.title.toUpperCase(), (s) => F("Anton", s), { maxW: W - 2 * M, maxLines: 4, start: d.date ? 170 : 220, min: 80, lh: LH, maxH: room });
        // sin fecha, el título se centra en el espacio que queda
        if (!d.date) y += Math.max(0, room - t.h) * 0.4;
        y += t.size * 0.85;
        y = g.lines(t.lines, M - 4, y, t.lh, { font: t.font, color: th.ink });
        if (pl) {
          y += 90;
          ctx.fillStyle = th.acc; ctx.beginPath(); ctx.arc(M + 14, y - pl.size * 0.35, 12, 0, Math.PI * 2); ctx.fill();
          g.lines(pl.lines, M + 46, y, pl.lh, { font: pl.font, color: th.ink });
        }
        g.brush(M - 20, H - 170, 520, 70, th.acc, { angle: -0.01 });
        g.text("¡LE ESPERAMOS!", M + 10, H - 118, { font: F("Anton", 50), color: onAcc, sp: 3 });
        g.logo(W - M, H - 200, 110, { white: oscuro, align: "right" });
      } else {
        const story = g.fmt === "historia", topY = story ? 260 : 150, botY = H - (story ? 300 : 150);
        let area0 = topY + 20;
        if (d.head) {
          g.text((d.eyebrow || d.church).toUpperCase(), M, topY, { font: F("Oswald", 26, 500), color: th.acc, sp: 5 });
          const hd = g.fit(d.head, (s) => F("Yellowtail", s), { maxW: W - 2 * M, maxLines: 2, start: 130, min: 70, lh: 1 });
          const hy = g.lines(hd.lines, M, topY + 40 + hd.size * 0.9, hd.lh, { font: hd.font, color: th.ink, rotate: -0.04 });
          area0 = hy + hd.size * 0.45 + 50; // deja aire bajo los rasgos de la caligrafía
        } else g.text(d.church.toUpperCase(), M, topY - 40, { font: F("Oswald", 24, 500), color: th.ink, sp: 5, alpha: 0.8 });
        const area1 = H - (story ? 250 : 110) - (d.firma ? 50 : 0);
        const v = g.fit(d.text.toUpperCase(), (s) => F("Anton", s), { maxW: W - 2 * M, maxH: area1 - area0 - 110, maxLines: 14, start: story ? 190 : 200, min: 44, lh: LH });
        // el bloque (versículo + cita) se centra en el alto disponible
        const bloque = v.h + 110;
        let y = area0 + Math.max(0, (area1 - area0 - bloque) * 0.45) + v.size * 0.86;
        // la primera línea en el color de acento
        v.lines.forEach((l, i) => g.text(l, M - 3, y + i * v.lh, { font: v.font, color: i === 0 ? th.acc : th.ink }));
        y += (v.lines.length - 1) * v.lh + 90;
        const rf = story ? 40 : 34, rw = g.measure(d.ref.toUpperCase(), F("Oswald", rf, 700), 4) + 60;
        g.brush(M - 20, y - rf * 1.3, rw, rf * 1.8, th.acc);
        g.text(d.ref.toUpperCase(), M + 10, y, { font: F("Oswald", rf, 700), color: onAcc, sp: 4 });
        if (d.firma) g.text(d.church.toUpperCase(), W - M, H - (story ? 200 : 76), { font: F("Oswald", 20, 500), color: th.ink, sp: 5, align: "right", alpha: 0.8 });
      }
    },
  });

  // «Retícula»: afiche suizo. Un bloque de color con el titular en grotesca muy negra, pegado a la base del bloque,
  // un cuadro de otro color que se monta sobre la esquina y una tabla de datos alineada a la retícula de seis columnas.
  E.add({
    id: "tip-reticula", name: "Retícula", family: "tipografica", fonts: ["Archivo Black", "Hanken Grotesk"],
    themes: {
      marino: { name: "Marino y oro", bg: "#0d1b3d", ink: "#f4f1ea", acc: "#2d5fa8", alt: "#f2c85b", hi: "#f2c85b" },
      papel: { name: "Rojo suizo", bg: "#eeebe3", ink: "#161616", acc: "#e2412b", alt: "#161616", hi: "#e2412b" },
      mostaza: { name: "Mostaza y pino", bg: "#f3ead6", ink: "#1d2420", acc: "#e3a21f", alt: "#24594a", hi: "#24594a" },
      noche: { name: "Noche y coral", bg: "#151515", ink: "#f2f0ea", acc: "#ff5a36", alt: "#f2f0ea", hi: "#ff8a6b" },
      menta: { name: "Menta", bg: "#dbeae2", ink: "#11302a", acc: "#11302a", alt: "#f08a65", hi: "#c4532c" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 64, CW = (W - 2 * M) / 6;
      g.paper(th.bg, { fibers: 0.22, grain: 0.05, mottle: 0.5 });
      const on = (c) => (g.lum(c) > 0.55 ? "#151515" : "#ffffff");
      const story = d.kind === "verse" && g.fmt === "historia";
      const top = story ? 236 : 100;
      const lab = (s, x, y, o = {}) => g.text(String(s).toUpperCase(), x, y, { font: F("Hanken Grotesk", o.size || 22, 700), color: o.color || th.ink, sp: 2.5, alpha: o.alpha ?? 0.92, align: o.align });
      const rule = (y, a = 0.55, w = 2) => { ctx.fillStyle = g.rgba(th.ink, a); ctx.fillRect(M, y, W - 2 * M, w); };
      const ticks = (y) => { ctx.fillStyle = g.rgba(th.ink, 0.55); for (let i = 0; i <= 6; i++) ctx.fillRect(M + i * CW - (i === 6 ? 2 : 0), y - 8, 2, 10); };
      const tc = on(th.acc);
      // titular: grotesca negra, apretada, en minúsculas
      const negra = (s, o) => fitT(g, s, (z) => F("Archivo Black", z), { lh: 0.98, sp: (z) => -z * 0.04, ...o });
      // el bloque de color; con foto, la foto en duotono del color del bloque ocupa la parte de arriba
      const bloque = (x, y, w, h, fotoH) => {
        ctx.fillStyle = th.acc; ctx.fillRect(x, y, w, h);
        if (fotoH > 40) {
          const light = g.lum(th.acc) > 0.3 ? th.acc : g.mix(th.acc, "#ffffff", 0.55), dark = g.mix(th.acc, "#000000", 0.72);
          duo(g, x, y, w, fotoH, { dark, light, focusY: 0.55 });
        }
      };
      const cruz = (cx, cy, s, c) => { ctx.fillStyle = c; ctx.fillRect(cx - s * 0.09, cy - s * 0.5, s * 0.18, s); ctx.fillRect(cx - s * 0.34, cy - s * 0.24, s * 0.68, s * 0.18); };
      // el cuadro: número grande arriba a la izquierda y palabra pequeña abajo (o una cruz)
      const cuadro = (x, y, side, big, small) => {
        ctx.fillStyle = th.alt; ctx.fillRect(x, y, side, side);
        const c = on(th.alt), p = side * 0.1;
        if (!big) { cruz(x + side / 2, y + side / 2, side * 0.46, c); return; }
        const b = g.fit(big, (z) => F("Archivo Black", z), { maxW: side - 2 * p, maxLines: 1, start: side * 0.62, min: 30, sp: (z) => -z * 0.04 });
        g.text(big, x + p - b.size * 0.03, y + p + b.size * 0.72, { font: b.font, color: c, sp: b.sp });
        if (small) {
          const sm = g.fit(small.toUpperCase(), (z) => F("Hanken Grotesk", z, 800), { maxW: side - 2 * p, maxLines: 2, start: 26, min: 18, lh: 1.15, sp: 2 });
          g.lines(sm.lines, x + p, y + side - p - (sm.lines.length - 1) * sm.lh, sm.lh, { font: sm.font, color: c, sp: 2 });
        }
      };
      // tabla de datos: [etiqueta, valor]; devuelve la y final
      const tabla = (rows, y, maxY) => {
        rows.forEach(([k, v]) => {
          rule(y, 0.4);
          lab(k, M, y + 44, { color: th.hi, alpha: 1 });
          const t = g.fit(v, (s) => F("Hanken Grotesk", s, 700), { maxW: 4 * CW - 6, maxLines: 2, start: 40, min: 30, lh: 1.18, maxH: Math.max(48, maxY - y - 30) });
          g.lines(t.lines, M + 2 * CW, y + 30 + t.size * 0.78, t.lh, { font: t.font, color: th.ink });
          y += Math.max(84, t.h + 40);
        });
        return y;
      };
      const tablaAlto = (rows) => rows.reduce((a, [, v]) => a + (g.measure(v, F("Hanken Grotesk", 40, 700)) > 4 * CW - 6 ? 132 : 84), 0);
      const logo = (x, y, h, align) => g.logo(x, y, h, { white: g.lum(th.bg) < 0.5, align });
      lab(d.church, M, top);
      ticks(top + 24); rule(top + 24);
      const bx = M, by = top + 56, bw = W - 2 * M, P = 44;
      if (d.kind === "card") {
        const kp = fecha(d.kicker);
        const foto = g.photoOn;
        // primero se mide lo de abajo; el aire que sobra agranda el cuadro de la fecha (y baja el titular)
        const nm = g.fit(d.name, (s) => F("Archivo Black", s), { maxW: W - 2 * M, maxLines: 2, start: 92, min: 44, lh: 1.04, sp: (s) => -s * 0.03 });
        const sg = g.fit(d.signature, (s) => F("Hanken Grotesk", s, 800), { maxW: 2 * CW - 6, maxLines: 2, start: 32, min: 26, lh: 1.15 });
        const fr = g.fit(d.from, (s) => F("Hanken Grotesk", s, 500), { maxW: 2 * CW - 6, maxLines: 3, start: 26, min: 22, lh: 1.28 });
        const hd = negra(d.headline.toLowerCase(), { maxW: bw - 2 * P, maxLines: 3, start: 240, min: 80, maxH: 330 });
        const plan = (side, fMin = 330) => {
          const sy = by - side * 0.22;
          const ln = g.fit(d.line, (s) => F("Hanken Grotesk", s, 600), { maxW: foto ? W - 2 * M : bw - side - P - 40, maxLines: 3, start: 34, min: 26, lh: 1.22 });
          const headTop = Math.max(by + (foto ? 0 : P + ln.h + 40), sy + side + 36, foto ? by + fMin : 0);
          const bh = headTop - by + hd.h + P - hd.size * 0.2;
          const fin = by + bh + 56 + (foto ? ln.h + 34 : 0) + nm.h + 44 + 96 + sg.h + fr.h + 40;
          return { side, sy, ln, headTop, bh, fin, fMin };
        };
        // el versículo usa el alto que queda (a 30 px como mínimo); si no cabe, solo la cita
        const LIM = H - 150, vMin = 140;
        let L = plan(2 * CW), over = L.fin + vMin - LIM;
        if (over > 0 && foto) { L = plan(2 * CW, Math.max(0, 330 - over)); over = L.fin + vMin - LIM; }
        if (over > 0) L = plan(Math.max(1.5 * CW, 2 * CW - over / 0.78), L.fMin);
        const vmax = LIM - (L.fin - (sg.h + fr.h + 40)) - 48;
        let vs = g.fit(`«${d.verse}»`, (s) => F("Hanken Grotesk", s, 500), { maxW: 4 * CW - 40, maxLines: 7, start: 36, min: 30, lh: 1.32, maxH: vmax });
        if (!entero(vs, vmax)) vs = null;
        const sobra = Math.min(vmax - (vs ? vs.h : 0), LIM - L.fin);
        if (sobra > 30) L = plan(Math.min(3 * CW, L.side + sobra / 0.78), L.fMin);
        const { side, sy, ln, headTop, bh } = L, sx = W - M - side;
        bloque(bx, by, bw, bh, foto ? headTop - by - 24 : 0);
        if (!foto) { g.lines(ln.lines, bx + P, by + P + ln.size * 0.8, ln.lh, { font: ln.font, color: tc, alpha: 0.95 }); if (!kp && d.kicker) lab(d.kicker, bx + P, by + P + ln.h + ln.size * 0.8 + 20, { color: tc, size: 20 }); }
        g.lines(hd.lines, bx + P - 4, headTop + hd.size * 0.74, hd.lh, { font: hd.font, color: tc, sp: hd.sp });
        cuadro(sx, sy, side, kp ? kp[0] : "", kp ? kp[1] : "");
        // el nombre debajo del bloque, a todo el ancho
        let y = by + bh + 56;
        if (foto) { y = g.lines(ln.lines, M, y + ln.size * 0.8, ln.lh, { font: ln.font, color: th.ink, alpha: 0.9 }) + 34; }
        y = g.lines(nm.lines, M - 2, y + nm.size * 0.74, nm.lh, { font: nm.font, color: th.ink, sp: nm.sp }) + 44;
        rule(y, 0.55);
        lab("Palabra", M, y + 42, { color: th.hi, alpha: 1 });
        lab("Con cariño", M + 4 * CW, y + 42, { color: th.hi, alpha: 1 });
        const vy0 = y + 96;
        if (vs) {
          const vy = g.lines(vs.lines, M, vy0, vs.lh, { font: vs.font, color: th.ink, alpha: 0.9 });
          lab(d.ref, M, vy + 48, { color: th.ink, alpha: 1 });
        } else lab(d.ref, M, vy0, { color: th.ink, alpha: 1, size: 26 });
        const sgy = g.lines(sg.lines, M + 4 * CW, vy0, sg.lh, { font: sg.font, color: th.ink });
        g.lines(fr.lines, M + 4 * CW, sgy + 40, fr.lh, { font: fr.font, color: th.ink, alpha: 0.85 });
        logo(W - M, H - 64 - 64, 64, "right");
      } else if (d.kind === "ann") {
        const foto = g.photoOn;
        const rows = [];
        if (d.date) { rows.push(["Cuándo", `${cap(d.weekday)} ${d.day} de ${d.month}`]); rows.push(["Hora", d.time]); }
        if (d.place) rows.push(["Dónde", d.place]);
        if (rows.length < 2) rows.push(["Invita", d.church]);
        const rh = tablaAlto(rows);
        const head = (side) => Math.max(by + P + 60, by - side * 0.22 + side + 36, foto ? by + 330 : 0);
        const maxT = H - 110 - rh - 60 - P - head(2 * CW);
        const tt = negra(d.title.toLowerCase(), { maxW: bw - 2 * P, maxLines: 4, start: 230, min: 64, maxH: maxT });
        const fin0 = head(2 * CW) + tt.h + P - tt.size * 0.2 + 50 + (foto ? 44 : 0) + rh;
        const side = Math.min(3 * CW, 2 * CW + Math.max(0, H - 120 - fin0) / 0.78), sy = by - side * 0.22, sx = W - M - side;
        const headTop = head(side);
        const bh = headTop - by + tt.h + P - tt.size * 0.2;
        bloque(bx, by, bw, bh, foto ? headTop - by - 24 : 0);
        if (!foto) lab("Le invitamos", bx + P, by + P + 18, { color: tc, alpha: 1 });
        g.lines(tt.lines, bx + P - 4, headTop + tt.size * 0.74, tt.lh, { font: tt.font, color: tc, sp: tt.sp });
        cuadro(sx, sy, side, d.date ? d.day : "", d.date ? d.month : "");
        let y = by + bh + 50;
        if (foto) { lab("Le invitamos", M, y + 10, { color: th.hi, alpha: 1 }); y += 44; }
        tabla(rows, y, H - 110);
        logo(W - M, H - 64 - 60, 60, "right");
      } else {
        const bot = H - (story ? 300 : 64);
        if (d.eyebrow) lab(d.eyebrow, W - M, top, { align: "right", color: th.hi, alpha: 1 });
        let y0 = by;
        let hd = null;
        if (d.head) hd = negra(d.head.toLowerCase(), { maxW: W - 2 * M, maxLines: 2, start: 120, min: 56 });
        const sd = story ? 2 * CW : g.fmt === "post" ? 1.7 * CW : 1.5 * CW;
        const foot = d.firma ? 0 : 0;
        // el bloque se ajusta al alto del texto; el cuadro con la cita cuelga de su esquina de abajo
        const headH = hd ? hd.h + 30 : 0;
        const maxBottom = bot - sd / 2 - foot;
        const fotoH = g.photoOn ? Math.min(story ? 420 : 300, (maxBottom - y0 - headH) * 0.32) : 0;
        const tMax = maxBottom - (y0 + headH) - fotoH - P - (sd / 2 + 30);
        const v = g.fit(d.text, (s) => F("Hanken Grotesk", s, 800), { maxW: bw - 2 * P, maxLines: 14, start: story ? 120 : 110, min: 30, lh: 1.14, maxH: tMax, sp: (s) => -s * 0.015 });
        const bh = fotoH + P + v.h + sd / 2 + 30 - v.size * 0.14;
        // lo que sobra se reparte: un poco arriba y el resto abajo
        const libre = Math.max(0, maxBottom - (y0 + headH + bh));
        y0 += libre * 0.4;
        if (hd) g.lines(hd.lines, M - 2, y0 + hd.size * 0.74, hd.lh, { font: hd.font, color: th.ink, sp: hd.sp });
        const byy = y0 + headH;
        bloque(bx, byy, bw, bh, fotoH);
        g.lines(v.lines, bx + P, byy + fotoH + P + v.size * 0.76, v.lh, { font: v.font, color: tc, sp: v.sp });
        const [book, num] = cita(d.ref);
        cuadro(W - M - sd, byy + bh - sd / 2, sd, num || "", book);
        const yb = byy + bh + sd / 2;
        if (d.firma) lab(d.church, M, yb - 8, { size: 20 });
        else logo(M, yb - 60, 60, "left");
      }
    },
  });

  // «Eco»: una palabra repetida: filas en contorno, una a medio color y la última sólida.
  E.add({
    id: "tip-eco", name: "Eco", family: "tipografica", fonts: ["Anton", "Oswald", "Kaushan Script", "Work Sans"],
    themes: {
      marino: { name: "Marino y oro", bg: "#0d1b3d", ink: "#f4efe3", acc: "#f2c85b", alt: "#7da2dc" },
      crema: { name: "Crema y bermellón", bg: "#f2e9d6", ink: "#1e1b18", acc: "#e0482a", alt: "#1e1b18" },
      rosa: { name: "Rosa y uva", bg: "#f6d9cf", ink: "#3b1633", acc: "#c4234e", alt: "#3b1633" },
      lima: { name: "Carbón y mostaza", bg: "#1c1a17", ink: "#f3ede0", acc: "#e3ab3c", alt: "#f3ede0" },
      bosque: { name: "Bosque", bg: "#1d3a2b", ink: "#f1e8d0", acc: "#f09d48", alt: "#b9d3a8" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 80;
      const story = d.kind === "verse" && g.fmt === "historia";
      if (g.photoOn && g.photo(0, 0, W, H, { treat: "bn", focusX: 0.3, tint: g.rgba(th.bg, 0.78) })) g.grain(0.08);
      else g.paper(th.bg, { fibers: 0.35, grain: 0.07 });
      const top = story ? 250 : 100, bot = H - (story ? 300 : 84);
      // las filas no se montan: cada una entera, con aire para sus tildes
      const paso = (rows) => { const f100 = F("Anton", 100), r = altoH(ctx, f100) / 100; ctx.font = f100; const ac = conTilde(rows.join("")) ? Math.max(0, ctx.measureText("ÁÉÍÓÚÑ").actualBoundingBoxAscent / 100 - r) : 0; return { r, ac, k: 1.1 + ac / r }; };
      // tamaño con el que caben las filas (ancho útil y alto de la zona)
      const medida = (rows, zoneH, o = {}) => {
        const f100 = F("Anton", 100), n = rows.length, { r, ac, k } = paso(rows);
        const wMax = Math.max(...rows.map((s) => g.measure(s, f100))) / 100;
        const tw = o.tail ? g.measure(o.tail, f100) / 100 : 0, extra = o.tail ? 1.16 : 0;
        return Math.min(o.max || 330, (W - 2 * M) / Math.max(wMax, tw), zoneH / (r * (1 + k * (n - 1) + extra) + ac));
      };
      // las filas del eco: en contorno (como mucho dos), la penúltima a medio color y la última sólida
      const eco = (rows, y0, zoneH, o = {}) => {
        const n = rows.length, s = medida(rows, zoneH, o), font = F("Anton", s), { r, ac, k } = paso(rows);
        const capH = r * s, lh = capH * k, x = M - s * 0.02, yb = (i) => y0 + ac * s + capH + i * lh;
        rows.forEach((w, i) => {
          const last = i === n - 1, half = !last && i === n - 2 && n >= 3;
          if (last) g.text(w, x, yb(i), { font, color: th.acc });
          else if (half) g.text(w, x, yb(i), { font, color: th.acc, alpha: 0.5 });
          else g.text(w, x, yb(i), { font, color: null, stroke: th.ink, strokeW: 4, alpha: 0.9 });
        });
        let bottom = yb(n - 1);
        if (o.tail) { bottom += capH * 1.16; g.text(o.tail, x, bottom, { font, color: th.acc }); }
        return { s, capH, lh, bottom, top: y0 };
      };
      const labels = (l, r) => {
        g.text(l.toUpperCase(), M, top, { font: F("Oswald", 22, 500), color: th.ink, sp: 4, alpha: 0.85 });
        if (r) g.text(r.toUpperCase(), W - M, top, { font: F("Oswald", 22, 500), color: th.acc, sp: 4, align: "right" });
      };
      const kaushan = (s, x, y, size, o = {}) => g.text(s, x, y, { font: F("Kaushan Script", size), color: o.color || th.acc, rotate: o.rotate ?? -0.06, align: o.align, stroke: th.bg, strokeW: size * 0.16 });
      if (d.kind === "card") {
        labels(d.church, d.kicker);
        const word = ultima(d.headline).toUpperCase(), lead = antes(d.headline);
        const lf = lead ? g.fit(lead, (s) => F("Kaushan Script", s), { maxW: W - 2 * M - 60, maxLines: 1, start: 100, min: 56 }) : null;
        const e0 = top + (lf ? lf.size * 1.1 + 30 : 50);
        const e = eco([word, word, word], e0, 520);
        if (lf) kaushan(lead, M + 6, e0 - 18, lf.size);
        let y = e.bottom + 44;
        const nm = g.fit(d.name.toUpperCase(), (s) => F("Oswald", s, 700), { maxW: W - 2 * M, maxLines: 2, start: 86, min: 44, lh: 1.08 });
        y = g.lines(nm.lines, M, y + nm.size * 0.92, nm.lh, { font: nm.font, color: th.ink }) + 56;
        const ln = g.fit(d.line, (s) => F("Work Sans", s, 600), { maxW: W - 2 * M, maxLines: 2, start: 38, min: 28, lh: 1.25 });
        y = g.lines(ln.lines, M, y, ln.lh, { font: ln.font, color: th.acc }) + 64;
        // el versículo solo si cabe a buen tamaño (y no cuando el nombre ya ocupa dos líneas)
        const vmax = bot - 60 - y;
        let vs = nm.lines.length < 2 ? g.fit(`«${d.verse}»`, (s) => F("Work Sans", s, 400), { maxW: W - 2 * M - 360, maxLines: 6, start: 34, min: 30, lh: 1.34, maxH: vmax }) : null;
        if (vs && !entero(vs, vmax)) vs = null;
        if (vs) {
          const vy = g.lines(vs.lines, M, y, vs.lh, { font: vs.font, color: th.ink, alpha: 0.88 });
          g.text(d.ref.toUpperCase(), M, vy + 46, { font: F("Oswald", 24, 500), color: th.acc, sp: 4 });
        }
        const sg = g.fit(d.signature, (s) => F("Oswald", s, 700), { maxW: 330, maxLines: 2, start: 32, min: 22, lh: 1.15 });
        const fr = g.fit(d.from.toUpperCase(), (s) => F("Oswald", s, 500), { maxW: 330, maxLines: 2, start: 19, min: 15, lh: 1.35, sp: 2 });
        const sy = bot - fr.h - sg.h + sg.size * 0.2;
        g.lines(sg.lines, W - M, sy, sg.lh, { font: sg.font, color: th.ink, align: "right" });
        g.lines(fr.lines, W - M, sy + (sg.lines.length - 1) * sg.lh + 36, fr.lh, { font: fr.font, color: th.ink, align: "right", sp: 2, alpha: 0.8 });
        ctx.fillStyle = th.acc; ctx.fillRect(W - M - 60, sy - sg.size - 22, 60, 5);
      } else if (d.kind === "ann") {
        labels(d.church, d.date ? "Le invitamos" : "");
        let y;
        if (d.date) {
          const wd = d.weekday.toUpperCase();
          const e = eco([wd, wd, wd], top + 50, 440);
          y = e.bottom + 76;
          g.text(`${d.day} de ${d.month}`.toUpperCase(), M, y, { font: F("Oswald", 46, 700), color: th.acc, sp: 2 });
          g.text(d.time.toUpperCase(), W - M, y, { font: F("Oswald", 46, 700), color: th.ink, align: "right" });
          y += 40;
        } else {
          // sin fecha: «le invitamos» a mano, con aire, sobre la primera fila
          kaushan("le invitamos", M + 6, top + 120, 92);
          const w = larga(d.title).toUpperCase();
          const e = eco([w, w, w], top + 170, 420);
          y = e.bottom + 10;
        }
        const pl = d.place ? g.fit(d.place, (s) => F("Work Sans", s, 600), { maxW: W - 2 * M - 50, maxLines: 2, start: 34, min: 24, lh: 1.22 }) : null;
        const roomT = bot - 150 - (pl ? pl.h + 50 : 0) - y;
        const t = fitT(g, d.title.toUpperCase(), (s) => F("Anton", s), { maxW: W - 2 * M, maxLines: 4, start: 150, min: 60, lh: lhTilde(ctx, "Anton"), maxH: roomT });
        y = g.lines(t.lines, M - 3, y + t.size * 0.9 + 10, t.lh, { font: t.font, color: th.ink });
        if (pl) {
          y += 70;
          ctx.fillStyle = th.acc; ctx.fillRect(M, y - pl.size * 0.62, 18, 18);
          g.lines(pl.lines, M + 40, y, pl.lh, { font: pl.font, color: th.ink });
        }
        kaushan("¡Le esperamos!", W - M, bot - 10, 78, { align: "right", rotate: -0.05 });
        g.logo(M, bot - 74, 74, { white: g.lum(th.bg) < 0.5, align: "left" });
      } else {
        let y = top;
        if (d.head) {
          g.text((d.eyebrow || d.church).toUpperCase(), M, y, { font: F("Oswald", 22, 500), color: th.ink, sp: 4, alpha: 0.85 });
          const hd = g.fit(d.head, (s) => F("Kaushan Script", s), { maxW: W - 2 * M - 30, maxLines: 2, start: 104, min: 60, lh: 1.05 });
          y = g.lines(hd.lines, M, y + 30 + hd.size * 0.95, hd.lh, { font: hd.font, color: th.acc, rotate: -0.04 }) + hd.size * 0.35;
        } else { g.text(d.church.toUpperCase(), M, y, { font: F("Oswald", 22, 500), color: th.ink, sp: 4, alpha: 0.85 }); y += 10; }
        const [book, num] = cita(d.ref), B = book.toUpperCase();
        const n = story ? 4 : d.text.length > 80 ? 2 : 3, zone = (H - y) * (story ? 0.4 : d.text.length > 80 ? 0.4 : 0.56);
        const rows = Array(n).fill(B);
        // la cita va al lado del libro en la fila sólida si así la palabra sigue grande; si no, en su propia fila
        let tail = "";
        if (num) {
          const comb = [...rows.slice(0, -1), `${B} ${num}`];
          if (letras(B) <= 5 || medida(comb, zone, { max: 300 }) >= 0.72 * medida(rows, zone, { max: 300, tail: num })) rows[n - 1] = `${B} ${num}`;
          else tail = num;
        }
        const e = eco(rows, y + 30, zone, { max: 300, tail });
        const a0 = e.bottom + 56, a1 = bot - (d.firma ? 60 : 20);
        const v = g.fit(d.text, (s) => F("Oswald", s, 700), { maxW: W - 2 * M, maxLines: 14, start: story ? 120 : 104, min: 32, lh: 1.16, maxH: a1 - a0 });
        g.lines(v.lines, M, a0 + Math.max(0, (a1 - a0 - v.h) * 0.4) + v.size * 0.86, v.lh, { font: v.font, color: th.ink });
        if (d.firma) g.text(d.church.toUpperCase(), M, bot, { font: F("Oswald", 20, 500), color: th.acc, sp: 4 });
      }
    },
  });

  // «Periódico»: la noticia de la semana. Cabecera de diario, titular a todo lo ancho, columnas con filete y un sello.
  E.add({
    id: "tip-periodico", name: "Periódico", family: "tipografica", fonts: ["Alfa Slab One", "Anton", "Oswald", "Fraunces", "Archivo Black"],
    themes: {
      papel: { name: "Papel de diario", bg: "#f0ebdf", ink: "#161514", acc: "#c9302a" },
      marino: { name: "Marino y oro", bg: "#0d1b3d", ink: "#f3eee2", acc: "#f2c85b" },
      salmon: { name: "Salmón financiero", bg: "#f5dcc8", ink: "#1c1a19", acc: "#0f6b5c" },
      sepia: { name: "Sepia y azul", bg: "#e7dac0", ink: "#2a2018", acc: "#2d5fa8" },
      noche: { name: "Edición nocturna", bg: "#1b1b1b", ink: "#ece6d8", acc: "#ef6a3a" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 70, IW = W - 2 * M;
      const story = d.kind === "verse" && g.fmt === "historia", square = d.kind === "verse" && g.fmt === "cuadrado";
      g.paper(th.bg, { fibers: 0.5, grain: 0.08, mottle: 1.3 });
      const LH = lhTilde(ctx, "Anton");
      const rule = (y, w = 2, a = 1) => { ctx.fillStyle = g.rgba(th.ink, a); ctx.fillRect(M, y, IW, w); };
      const small = (s, x, y, o = {}) => g.text(String(s).toUpperCase(), x, y, { font: F("Oswald", o.size || 17, 500), color: o.color || th.ink, sp: 2.5, align: o.align, alpha: o.alpha ?? 0.9 });
      // cabecera: devuelve la y de abajo (en el cuadrado, un 20 % más chica)
      const cabecera = (y, fecha) => {
        const k = square ? 0.8 : 1;
        small("Edición especial", M, y); if (fecha) small(fecha, W - M, y, { align: "right" });
        rule(y + 14, 2);
        const mt = g.fit(d.churchShort, (s) => F("Alfa Slab One", s), { maxW: IW, maxLines: 1, start: 150 * k, min: 60 });
        const my = y + 30 * k + mt.size * 0.76;
        g.text(d.churchShort, W / 2, my, { font: mt.font, color: th.ink, align: "center" });
        rule(my + 26 * k, 6); rule(my + 38 * k, 2);
        small(d.church.split("·")[0].trim(), M, my + 70 * k, { size: 16 }); small("Quetzaltenango, Guatemala", W - M, my + 70 * k, { size: 16, align: "right" });
        rule(my + 88 * k, 2);
        return my + 88 * k;
      };
      // sello de goma
      const sello = (cx, cy, r, word) => {
        ctx.save(); ctx.globalAlpha = 0.85;
        g.roughCircle(cx, cy, r, r, th.acc, 6, { passes: 2 }); g.roughCircle(cx, cy, r * 0.8, r * 0.8, th.acc, 2.5, { passes: 1 });
        ctx.restore();
        const f = g.fit(word, (s) => F("Archivo Black", s), { maxW: r * 1.4, maxLines: 1, start: r * 0.5, min: 16 });
        g.text(word, cx, cy + f.size * 0.36, { font: f.font, color: th.acc, align: "center", rotate: -0.2, alpha: 0.88 });
      };
      // párrafo con letra capital; cols columnas. Devuelve la y final
      const capital = (text, x, y, w, maxH, o = {}) => {
        text = String(text || "").trim(); const cols = o.cols || 1, gap = 44, cw = (w - gap * (cols - 1)) / cols;
        const m = text.match(/^([«"¡¿]*\p{L})(.*)$/u), first = m ? m[1] : text[0], rest = m ? m[2] : text.slice(1);
        let best = null;
        for (let s = o.start || 40; s >= (o.min || 20); s -= 1) {
          const font = F("Fraunces", s, 400), lh = s * 1.4, dcS = (2 * lh + s * 0.7) / 0.7, dcF = F("Alfa Slab One", dcS), dcW = g.measure(first, dcF) + 16;
          const ws = rest.split(/\s+/).filter(Boolean), lines = []; let l = "";
          for (const wd of ws) {
            const lim = lines.length < 3 ? cw - dcW : cw, t = l ? l + " " + wd : wd;
            if (g.measure(t, font) > lim && l) { lines.push(l); l = wd; } else l = t;
          }
          if (l) lines.push(l);
          const per = Math.max(3, Math.ceil(lines.length / cols));
          best = { s, font, lh, dcF, dcS, dcW, lines, per };
          if (per * lh <= maxH) break;
        }
        const { s, font, lh, dcF, dcW, lines, per } = best;
        g.text(first, x, y + 2 * lh + s * 0.0, { font: dcF, color: th.acc });
        let yEnd = y;
        lines.forEach((l, i) => {
          const c = Math.floor(i / per), r = i % per;
          if (c >= cols) return;
          const lx = x + c * (cw + gap) + (c === 0 && r < 3 ? dcW : 0), ly = y + r * lh;
          g.text(l, lx, ly, { font, color: th.ink });
          yEnd = Math.max(yEnd, ly);
        });
        if (cols > 1) for (let c = 1; c < cols; c++) { ctx.fillStyle = g.rgba(th.ink, 0.5); ctx.fillRect(x + c * (cw + gap) - gap / 2, y - s, 1.5, per * lh); }
        return yEnd;
      };
      const foto = (x, y, w, h) => g.photo(x, y, w, h, { treat: "bn" }) && (g.halftone(x, y, w, h, g.rgba(th.bg, 0.5), { step: 7, size: 0.5, angle: 0.785 }), ctx.strokeStyle = th.ink, ctx.lineWidth = 2, ctx.strokeRect(x, y, w, h), true);
      if (d.kind === "card") {
        let y = cabecera(70, d.kicker) + 66;
        g.text(limpio(d.headline).toUpperCase(), M, y, { font: F("Oswald", 30, 700), color: th.acc, sp: 4 });
        const nm = g.fit(d.name.toUpperCase(), (s) => F("Anton", s), { maxW: IW, maxLines: 2, start: 150, min: 70, lh: LH });
        y = g.lines(nm.lines, M - 3, y + 26 + nm.size * 0.88, nm.lh, { font: nm.font, color: th.ink }) + 30;
        const dk = g.fit(d.line, (s) => F("Fraunces", s, 400, true), { maxW: IW, maxLines: 2, start: 42, min: 28, lh: 1.2 });
        y = g.lines(dk.lines, M, y + dk.size, dk.lh, { font: dk.font, color: th.ink }) + 34;
        rule(y, 2);
        const top = y + 34, bot = H - 74, lw = IW * 0.62, rx = M + lw + 40, rw = IW - lw - 40;
        ctx.fillStyle = g.rgba(th.ink, 0.55); ctx.fillRect(M + lw + 19, top - 6, 1.5, bot - top);
        let ry = top + 30;
        if (g.photoOn && foto(M, top, lw - 10, bot - top - 4)) {
          // con foto, el versículo pasa a la columna derecha
          const vs = g.fit(`«${d.verse}»`, (s) => F("Fraunces", s, 400, true), { maxW: rw, maxLines: 7, start: 28, min: 19, lh: 1.32, maxH: bot - top - 260 });
          ry = g.lines(vs.lines, rx, ry, vs.lh, { font: vs.font, color: th.ink }) + 40;
          small(d.ref, rx, ry, { color: th.acc, size: 18, alpha: 1 }); ry += 60;
        } else {
          const vy = capital(d.verse, M, top + 34, lw - 20, bot - top - 110, { start: 46, min: 22 });
          small(`— ${d.ref}`, M, vy + 56, { color: th.acc, size: 19, alpha: 1 });
        }
        small("De parte de", rx, ry, { color: th.acc, size: 16, alpha: 1 });
        const sg = g.fit(d.signature, (s) => F("Fraunces", s, 700), { maxW: rw, maxLines: 2, start: 34, min: 22, lh: 1.12 });
        ry = g.lines(sg.lines, rx, ry + 16 + sg.size, sg.lh, { font: sg.font, color: th.ink }) + 34;
        const fr = g.fit(d.from, (s) => F("Fraunces", s, 400, true), { maxW: rw, maxLines: 3, start: 24, min: 18, lh: 1.3 });
        ry = g.lines(fr.lines, rx, ry, fr.lh, { font: fr.font, color: th.ink, alpha: 0.85 });
        // el sello nunca pasa del margen de abajo; si no cabe, se achica o no va
        const sr = Math.min(100, rw / 2 - 6, (bot - 10 - (ry + 30)) / 2);
        if (sr >= 60) sello(rx + rw / 2, Math.min(Math.max(ry + 30 + sr, bot - 110), H - M - sr), sr, "¡EXTRA!");
      } else if (d.kind === "ann") {
        const conFoto = !!g.photoOn;
        let y = cabecera(70, d.date ? cap(d.when) : "") + 66;
        g.text("LE INVITAMOS", M, y, { font: F("Oswald", 30, 700), color: th.acc, sp: 4 });
        // sin fecha ni foto, el titular crece para llenar la página
        const tMax = conFoto ? 300 : d.date ? 430 : 600;
        const t = fitT(g, d.title.toUpperCase(), (s) => F("Anton", s), { maxW: IW, maxLines: d.date || conFoto ? 3 : 4, start: d.date || conFoto ? 150 : 210, min: 66, lh: LH, maxH: tMax });
        y = g.lines(t.lines, M - 3, y + 26 + t.size * 0.88, t.lh, { font: t.font, color: th.ink }) + 30;
        if (d.date && !conFoto) {
          const dk = `${cap(d.when)}, a las ${d.time}`;
          const dkf = g.fit(dk, (s) => F("Fraunces", s, 400, true), { maxW: IW, maxLines: 2, start: 42, min: 28, lh: 1.2 });
          y = g.lines(dkf.lines, M, y + dkf.size, dkf.lh, { font: dkf.font, color: th.ink }) + 34;
        }
        rule(y, 2);
        let top = y + 34;
        const bot = H - 74;
        // con foto: la foto a todo el ancho, debajo del titular; el número grande sigue abajo
        if (conFoto) {
          const ph = Math.max(200, Math.min(400, (bot - top) * 0.46));
          if (foto(M, top, IW, ph)) { top += ph + 34; rule(top - 17, 2); }
        }
        const lw = IW * 0.56, rx = M + lw + 40, rw = IW - lw - 40;
        ctx.fillStyle = g.rgba(th.ink, 0.55); ctx.fillRect(M + lw + 19, top - 6, 1.5, bot - top);
        const items = [];
        if (d.date) {
          const hh = bot - top - 40, mf0 = 64;
          const dy = g.fit(d.day, (s) => F("Alfa Slab One", s), { maxW: lw - 30, maxLines: 1, start: Math.min(400, (hh - mf0 - 40) / 0.72), min: 90 });
          g.text(d.day, M - 6, top + 20 + dy.size * 0.72, { font: dy.font, color: th.ink });
          const mf = g.fit(d.month.toUpperCase(), (s) => F("Oswald", s, 700), { maxW: lw - 30, maxLines: 1, start: mf0, min: 30, sp: 6 });
          g.text(d.month.toUpperCase(), M, top + 20 + dy.size * 0.72 + 30 + mf.size, { font: mf.font, color: th.acc, sp: 6 });
          if (conFoto) items.push(["Día", cap(d.weekday)]);
        } else {
          const cf = g.fit("¡Le esperamos!", (s) => F("Fraunces", s, 900, true), { maxW: lw - 30, maxLines: 2, start: 130, min: 50, lh: 1.02, maxH: bot - top - 40 });
          g.lines(cf.lines, M, top + 20 + cf.size * 0.8, cf.lh, { font: cf.font, color: th.ink });
        }
        if (d.date) items.push(["Hora", d.time]);
        if (d.place) items.push(["Dónde", d.place]);
        if (items.length < 3) items.push(["Invita", d.church]);
        let ry = top + 30;
        items.forEach(([k, v]) => {
          if (ry + 90 > bot) return;
          small(k, rx, ry, { color: th.acc, size: 16, alpha: 1 });
          const f = g.fit(v, (s) => F("Fraunces", s, 700), { maxW: rw, maxLines: 3, start: 34, min: 20, lh: 1.16, maxH: bot - ry - 20 });
          ry = g.lines(f.lines, rx, ry + 14 + f.size, f.lh, { font: f.font, color: th.ink }) + 52;
        });
        const sr = Math.min(92, rw / 2 - 6, (bot - ry - 20) / 2);
        if (sr >= 60) sello(rx + rw / 2, Math.min(bot - 100, H - M - sr), sr, "AVISO");
      } else {
        const t0 = story ? 236 : square ? 60 : 70, bot = H - (story ? 300 : 70);
        let y = cabecera(t0, d.eyebrow || "") + (square ? 50 : 66);
        g.text((d.head ? "Palabra para hoy" : "Palabra del día").toUpperCase(), M, y, { font: F("Oswald", 28, 700), color: th.acc, sp: 4 });
        if (d.head) {
          const hd = g.fit(d.head.toUpperCase(), (s) => F("Anton", s), { maxW: IW, maxLines: 2, start: 150, min: 70, lh: LH });
          y = g.lines(hd.lines, M - 3, y + 26 + hd.size * 0.88, hd.lh, { font: hd.font, color: th.ink }) + 34;
          rule(y, 2);
        } else y += 10;
        const top = y + 64, refY = bot - (d.firma ? 70 : 20);
        const vy = capital(d.text, M, top + 34, IW, refY - top - 110, { start: story ? 150 : square ? 120 : 84, min: 26 });
        small(`— ${d.ref}`, W - M, Math.min(vy + 80, refY), { color: th.acc, size: story ? 36 : 28, align: "right", alpha: 1 });
        if (d.firma) { rule(bot - 34, 2, 0.6); small(d.church, M, bot, { size: 17 }); }
      }
    },
  });

  // «Setentas»: letra gorda de los 70 con sombra desplazada en franjas, pastillas redondas y un motivo distinto
  // según la pieza: sol (cumpleaños), anillos (bodas), arcoíris de tres bandas (avisos) y rayas en diagonal (versículos).
  E.add({
    id: "tip-setentas", name: "Setentas", family: "tipografica", fonts: ["Shrikhand", "Montserrat"],
    themes: {
      clasico: { name: "Naranja y mostaza", bg: "#f4e5c7", ink: "#3b1f14", a: "#e0622a", b: "#eaa82e" },
      marino: { name: "Marino y oro", bg: "#0d1b3d", ink: "#f6eedc", a: "#f2c85b", b: "#2d5fa8" },
      chicle: { name: "Chicle", bg: "#fbe4dc", ink: "#4a1d3d", a: "#e74f70", b: "#f6a35b" },
      oliva: { name: "Oliva", bg: "#ebe4c9", ink: "#2c3a1e", a: "#6c9038", b: "#dd8c2a" },
      cafe: { name: "Café y caramelo", bg: "#3a2219", ink: "#f8e8c9", a: "#e86a33", b: "#f0b84a" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 80;
      const story = d.kind === "verse" && g.fmt === "historia";
      g.paper(th.bg, { fibers: 0.4, grain: 0.07 });
      const pillText = g.lum(th.b) > 0.55 ? (g.lum(th.ink) < 0.5 ? th.ink : "#1d1410") : "#fff";
      // texto con sombra en franjas (de lejos a cerca: franja b, hueco, franja a)
      const retro = (s, x, y, font, size, o = {}) => {
        const st = Math.max(1.4, size * 0.016), seq = [th.a, th.a, th.a, th.a, th.bg, th.b, th.b, th.b, th.b];
        for (let k = seq.length; k >= 1; k--) g.text(s, x + k * st, y + k * st, { font, color: seq[k - 1], rotate: o.rotate || 0 });
        g.text(s, x, y, { font, color: o.color || th.ink, rotate: o.rotate || 0 });
      };
      const fotoEn = (x, y, w, h, path) => g.photoOn && g.photo(x, y, w, h, { treat: "calido", focusY: 0.5, path });
      // sol con rayas cortadas en la mitad de abajo (con foto: la foto dentro del sol)
      const sol = (cx, cy, r) => {
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
        if (!fotoEn(cx - r, cy - r, 2 * r, 2 * r)) { ctx.fillStyle = th.a; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r); ctx.fillStyle = th.b; ctx.fillRect(cx - r, cy + r * 0.32, 2 * r, r); }
        ctx.fillStyle = th.bg; let y = cy - r * 0.02, h = r * 0.035, gp = r * 0.15;
        while (y < cy + r) { ctx.fillRect(cx - r, y, 2 * r, h); y += h + gp; h *= 1.5; gp *= 0.78; }
        ctx.restore();
      };
      // dos anillos entrelazados (bodas); con foto, la foto dentro del primero
      const anillos = (cx, cy, r) => {
        const rr = r * 0.56, lw = r * 0.15, x1 = cx - r * 0.36, x2 = cx + r * 0.36;
        fotoEn(x1 - rr, cy - rr, 2 * rr, 2 * rr, (c) => c.arc(x1, cy, rr - lw / 2, 0, Math.PI * 2));
        const aro = (x, c, a0, a1) => { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, cy, rr, a0, a1); ctx.stroke(); };
        ctx.save(); ctx.lineCap = "butt";
        aro(x1, th.a, 0, Math.PI * 2); aro(x2, th.b, 0, Math.PI * 2);
        aro(x1, th.a, -0.5, 0.25); // el primero pasa por encima en un cruce: quedan entrelazados
        ctx.restore();
      };
      // arcoíris de tres bandas apoyado en una línea (avisos); con foto, la foto en el medio
      const arco = (cx, cy, r) => {
        const bw = r * 0.19;
        [th.a, th.b, th.ink].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r - i * bw, Math.PI, 0); ctx.closePath(); ctx.fill(); });
        const ri = r - 3 * bw;
        ctx.fillStyle = th.bg; ctx.beginPath(); ctx.arc(cx, cy, ri, Math.PI, 0); ctx.closePath(); ctx.fill();
        fotoEn(cx - ri, cy - ri, 2 * ri, ri, (c) => { c.arc(cx, cy, ri - 6, Math.PI, 0); c.closePath(); });
      };
      // rayas en diagonal que cruzan la esquina de abajo a la derecha (versículos); con foto, la foto en la esquina
      const rayas = (leg) => {
        const bw = leg * 0.16, gp = leg * 0.05, y0 = H - (story ? 0 : 58);
        const tri = (k) => { ctx.beginPath(); ctx.moveTo(W, y0 - k); ctx.lineTo(W, y0); ctx.lineTo(W - k, y0); ctx.closePath(); };
        if (g.photoOn) { ctx.save(); tri(leg - 3 * (bw + gp)); ctx.clip(); fotoEn(W - leg, y0 - leg, leg, leg); ctx.restore(); }
        [th.a, th.b, th.ink].forEach((c, i) => {
          const k1 = leg - i * (bw + gp), k0 = k1 - bw;
          ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(W, y0 - k1); ctx.lineTo(W, y0 - k0); ctx.lineTo(W - k0, y0); ctx.lineTo(W - k1, y0); ctx.closePath(); ctx.fill();
        });
      };
      // tres franjas al pie
      const franjas = () => { [th.a, th.b, th.ink].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, H - 58 + i * 16, W, 11); }); };
      const pill = (s, x, y, font, size, o = {}) => {
        const w = g.measure(s, font, o.sp || 0), ph = size * 1.62, px = size * 0.75;
        g.round(x, y - size * 1.12, w + 2 * px, ph, ph / 2, o.bg || th.b);
        g.text(s, x + px, y, { font, color: o.color || pillText, sp: o.sp || 0 });
        return w + 2 * px;
      };
      const label = (s, x, y, o = {}) => g.text(String(s).toUpperCase(), x, y, { font: F("Montserrat", 19, 700), color: o.color || th.ink, sp: 3, align: o.align, alpha: 0.9 });
      // el logo en un solo color, el de la tinta del tema
      const logo = (x, y, h, align) => logoT(g, x, y, h, th.ink, { align, alpha: 0.9 });
      if (d.kind === "card") {
        label(d.church, M, 100); if (d.kicker) label(d.kicker, W - M, 100, { align: "right" });
        const [lead, main] = g.splitHead(d.headline);
        // el motivo arriba a la derecha, en su propia zona (el titular va debajo)
        const mR = 150, mX = W - M - mR - 10, mY = 150 + mR + 10;
        if (d.occasion === "bodas") anillos(mX, mY, mR * 1.25);
        else if (d.occasion === "cumple") sol(mX, mY, mR);
        else arco(mX, mY + mR * 0.6, mR * 1.2);
        if (lead) g.text(lead, M, mY + 30, { font: F("Shrikhand", 120), color: th.ink, rotate: -0.05 });
        const hd = fitT(g, main, (s) => F("Shrikhand", s), { maxW: W - 2 * M - 30, maxLines: 2, start: 200, min: 90, lh: 1.04 });
        const nm = g.fit(d.name.toUpperCase(), (s) => F("Montserrat", s, 800), { maxW: W - 2 * M - 80, maxLines: 2, start: 62, min: 32, lh: 1, sp: 1 });
        const ln = g.fit(d.line, (s) => F("Montserrat", s, 700), { maxW: W - 2 * M, maxLines: 2, start: 40, min: 26, lh: 1.25 });
        const y0 = mY + mR + 30;
        const hH = hd.size * 0.9 + (hd.lines.length - 1) * hd.lh + hd.size * 0.5 + 60, nH = (nm.lines.length - 1) * nm.size * 1.85 + 84, lH = (ln.lines.length - 1) * ln.lh + 58;
        const vmax = H - 250 - (y0 + hH + nH + lH);
        let vs = g.fit(`«${d.verse}»`, (s) => F("Montserrat", s, 500), { maxW: W - 2 * M - 120, maxLines: 4, start: 32, min: 24, lh: 1.36, maxH: vmax - 44 });
        if (!entero(vs, vmax - 44)) vs = null;
        // el aire que sobra se reparte entre los bloques (no se queda todo abajo)
        const extra = Math.max(0, vmax - (vs ? vs.h + 44 : 0)), ex = extra / 3;
        let y = y0;
        hd.lines.forEach((l, i) => retro(l, M, y + hd.size * 0.9 + i * hd.lh, hd.font, hd.size, { rotate: -0.04 }));
        y += hH + ex;
        nm.lines.forEach((l, i) => pill(l, M, y + i * nm.size * 1.85, nm.font, nm.size, { sp: 1 }));
        y += nH + ex * 0.6;
        y = g.lines(ln.lines, M, y, ln.lh, { font: ln.font, color: th.ink }) + 58 + ex;
        if (vs) {
          const vy = g.lines(vs.lines, M, y, vs.lh, { font: vs.font, color: th.ink, alpha: 0.85 });
          g.text(d.ref.toUpperCase(), M, vy + 44, { font: F("Montserrat", 20, 800), color: th.a, sp: 3 });
        }
        g.text(d.signature, W - M, H - 150, { font: F("Shrikhand", 44), color: th.ink, align: "right" });
        g.text(d.from.toUpperCase(), W - M, H - 106, { font: F("Montserrat", 17, 700), color: th.ink, sp: 2.5, align: "right", alpha: 0.85 });
        logo(M, H - 176, 74, "left");
        franjas();
      } else if (d.kind === "ann") {
        label(d.church, M, 100);
        logo(W - M, 58, 66, "right");
        // el arcoíris, abajo a la derecha, en una zona sin texto
        const aR = 250, aX = W - M - aR + 30, aY = H - 58 - 6, aTop = aY - aR - 30;
        arco(aX, aY, aR);
        let y = 260;
        // la fecha va en una banda redondeada (sin número gigante)
        const bf = F("Montserrat", 34, 800);
        const banda = d.date ? `${d.weekday} ${d.day} de ${d.month}`.toUpperCase() : "";
        const pl = d.place ? g.fit(d.place, (s) => F("Montserrat", s, 700), { maxW: W - 2 * M - 40, maxLines: 2, start: 34, min: 24, lh: 1.25 }) : null;
        const resto = (d.date ? 2 * 34 * 1.62 + 60 : 0) + (pl ? pl.h + 50 : 0);
        const t = fitT(g, d.title, (s) => F("Shrikhand", s), { maxW: W - 2 * M - 30, maxLines: 4, start: 210, min: 64, lh: 1.08, maxH: aTop - y - resto - 60 });
        // el bloque se centra en el alto libre, encima del arcoíris
        const alto = t.size * 0.9 + (t.lines.length - 1) * t.lh + t.size * 0.35 + 70 + resto;
        y += Math.max(0, aTop - y - alto) * 0.6;
        g.text("¡Le invitamos!", M, y - 60, { font: F("Shrikhand", 56), color: th.a, rotate: -0.04 });
        t.lines.forEach((l, i) => retro(l, M, y + t.size * 0.9 + i * t.lh, t.font, t.size, { rotate: -0.03 }));
        y += t.size * 0.9 + (t.lines.length - 1) * t.lh + t.size * 0.35 + 70;
        if (d.date) {
          const bw = pill(banda, M, y, bf, 34, { sp: 2 });
          if (M + bw + 20 + g.measure(d.time.toUpperCase(), bf, 2) + 51 < W - M) pill(d.time.toUpperCase(), M + bw + 20, y, bf, 34, { bg: th.ink, color: th.bg, sp: 2 });
          else { y += 34 * 1.62 + 22; pill(d.time.toUpperCase(), M, y, bf, 34, { bg: th.ink, color: th.bg, sp: 2 }); }
          y += 100;
        }
        if (pl) {
          ctx.fillStyle = th.a; ctx.beginPath(); ctx.arc(M + 12, y - pl.size * 0.36, 12, 0, Math.PI * 2); ctx.fill();
          g.lines(pl.lines, M + 42, y, pl.lh, { font: pl.font, color: th.ink });
        }
        pill("¡LE ESPERAMOS!", M, H - 116, F("Montserrat", 32, 800), 32, { bg: th.ink, color: th.bg, sp: 2 });
        franjas();
      } else {
        const top = story ? 250 : 100, bot = H - (story ? 300 : 90);
        const leg = story ? 520 : g.fmt === "cuadrado" ? 330 : 400;
        rayas(leg);
        let y = top;
        if (d.head) {
          label(d.eyebrow || d.church, M, y);
          const hd = g.fit(d.head, (s) => F("Shrikhand", s), { maxW: W - 2 * M, maxLines: 2, start: 96, min: 56, lh: 1.08 });
          y = g.lines(hd.lines, M, y + 34 + hd.size * 0.9, hd.lh, { font: hd.font, color: th.a, rotate: -0.03 }) + 70;
        } else { label(d.church, M, y); y += 50; }
        // los versículos cortos van enteros en la letra gorda; los largos se parten en la primera pausa
        const corto = d.text.length < 60;
        const [p1, p2] = corto ? [d.text, ""] : g.splitVerse(d.text);
        const lim = (story ? bot : H - 58) - leg * 0.55, room = lim - y - 110;
        const f1 = fitT(g, p1, (s) => F("Shrikhand", s), { maxW: W - 2 * M - 30, maxLines: 6, start: corto ? 170 : 130, min: 50, lh: 1.12, maxH: p2 ? room * 0.55 : room });
        let f2 = null;
        if (p2) f2 = g.fit(p2, (s) => F("Montserrat", s, 700), { maxW: W - 2 * M - 40, maxLines: 9, start: 64, min: 30, lh: 1.24, maxH: room - f1.h - 30 });
        const total = f1.h + (f2 ? f2.h + 40 : 0) + 100;
        y += Math.max(0, (lim - y - total) * 0.35);
        f1.lines.forEach((l, i) => retro(l, M, y + f1.size * 0.9 + i * f1.lh, f1.font, f1.size));
        y += f1.size * 0.9 + (f1.lines.length - 1) * f1.lh + f1.size * 0.25 + 40;
        if (f2) y = g.lines(f2.lines, M, y + f2.size, f2.lh, { font: f2.font, color: th.ink }) + 40;
        pill(d.ref.toUpperCase(), M, y + 40, F("Montserrat", 30, 800), 30, { sp: 2 });
        if (d.firma) label(d.church, M, story ? bot + 10 : H - 90);
        if (!story) franjas();
      }
    },
  });

  // «Recorte»: letras gigantes que un círculo recorta (dentro cambian de color) y un corte fino en diagonal
  // que corre apenas la mitad de abajo de la palabra.
  E.add({
    id: "tip-recorte", name: "Recorte", family: "tipografica", fonts: ["Bebas Neue", "Archivo Black", "Pacifico", "Montserrat"],
    themes: {
      marino: { name: "Marino y oro", bg: "#0d1b3d", ink: "#f4efe4", acc: "#f2c85b", hi: "#f2c85b" },
      papel: { name: "Papel y rojo", bg: "#efe9dc", ink: "#1a1a1a", acc: "#e5432d", hi: "#d13a25" },
      coral: { name: "Coral", bg: "#ff7a5c", ink: "#1d1b38", acc: "#fbefe1", hi: "#1d1b38" },
      cielo: { name: "Cielo y tinta", bg: "#d9e8f4", ink: "#142645", acc: "#2d5fa8", hi: "#2d5fa8" },
      noche: { name: "Noche y limón", bg: "#171717", ink: "#f2efe8", acc: "#f4e04d", hi: "#f4e04d" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 72;
      const story = d.kind === "verse" && g.fmt === "historia";
      g.paper(th.bg, { fibers: 0.3, grain: 0.06 });
      const claro = g.lum(th.bg) > 0.45;
      // color de la letra dentro del círculo: el del papel si contrasta con el círculo
      const knock = Math.abs(g.lum(th.acc) - g.lum(th.bg)) > 0.28 ? th.bg : g.lum(th.acc) > 0.55 ? th.ink : "#fff";
      // filas gigantes en Bebas; dentro del círculo cambian de color. La fila «cutRow» lleva un corte fino:
      // la mitad de abajo se corre apenas (3 % del alto de letra). Los signos (: - .) no se cortan.
      const gigante = (rows, x, yTop, maxW, maxH, o = {}) => {
        const f100 = F("Bebas Neue", 100), r = altoH(ctx, f100) / 100;
        ctx.font = f100; const ac = Math.max(0, ctx.measureText("ÁÉÍÓÚÑ").actualBoundingBoxAscent / 100 - r) + 0.03;
        const hK = rows.reduce((a, t, i) => a + r + (conTilde(t) ? ac : 0) + (i ? 0.12 * r : 0), 0);
        const wMax = Math.max(...rows.map((s) => g.measure(s, f100))) / 100;
        const s = Math.min(o.max || 900, maxW / (wMax * 1.03), maxH / hK);
        const font = F("Bebas Neue", s), capH = r * s, dx = Math.max(4, capH * 0.03);
        const yb = []; let yy = yTop;
        rows.forEach((t, i) => { yy += (i ? 0.12 * capH : 0) + (conTilde(t) ? ac * s : 0) + capH; yb.push(yy); });
        const bottom = yb[rows.length - 1], blockW = Math.max(...rows.map((t) => g.measure(t, font)));
        const c = o.circle(capH, bottom, blockW, s);
        // el círculo (con foto: la foto en duotono con los colores del tema)
        const ph = g.photoOn && duo(g, c.cx - c.r, c.cy - c.r, 2 * c.r, 2 * c.r, claro
          ? { dark: th.ink, light: g.lum(th.acc) > g.lum(th.bg) ? th.acc : th.bg, focusY: 0.5, path: (k) => k.arc(c.cx, c.cy, c.r, 0, Math.PI * 2) }
          : { dark: g.mix(th.bg, "#000", 0.2), light: th.acc, focusY: 0.5, path: (k) => k.arc(c.cx, c.cy, c.r, 0, Math.PI * 2) });
        if (!ph) { ctx.fillStyle = th.acc; ctx.beginPath(); ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2); ctx.fill(); }
        const inC = ph ? (claro ? th.bg : th.ink) : knock;
        const circ = () => { ctx.beginPath(); ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2); ctx.clip(); };
        const pieza = (t, px, py, clip) => {
          ctx.save(); if (clip) clip();
          g.text(t, px, py, { font, color: th.ink });
          circ(); g.text(t, px, py, { font, color: inC });
          ctx.restore();
        };
        const cutRow = o.cutRow ?? 0;
        rows.forEach((t, i) => {
          if (i !== cutRow) { pieza(t, x, yb[i]); return; }
          const cy = yb[i] - capH * 0.44, tilt = capH * 0.05, yAt = (xx) => cy + tilt - (2 * tilt * (xx - x)) / Math.max(1, blockW);
          const arriba = () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, yAt(W)); ctx.lineTo(0, yAt(0)); ctx.closePath(); ctx.clip(); };
          const abajo = () => { ctx.beginPath(); ctx.moveTo(0, yAt(0)); ctx.lineTo(W, yAt(W)); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.clip(); };
          let px = x;
          for (const sg of t.split(/([^\p{L}\p{N}]+)/u).filter(Boolean)) {
            const w = g.measure(sg, font);
            if (!/[\p{L}\p{N}]/u.test(sg)) pieza(sg, px, yb[i]);
            else {
              pieza(sg, px, yb[i], arriba); pieza(sg, px + dx, yb[i], abajo);
              // la línea del corte, del color del papel, solo a lo ancho de las letras
              ctx.save(); ctx.strokeStyle = th.bg; ctx.lineWidth = Math.max(2.5, capH * 0.014); ctx.beginPath(); ctx.moveTo(px + 2, yAt(px + 2)); ctx.lineTo(px + w + dx - 2, yAt(px + w + dx - 2)); ctx.stroke(); ctx.restore();
            }
            px += w;
          }
        });
        return { s, capH, top: yb[0] - capH, bottom, blockW, dx, c };
      };
      const label = (s, x, y, o = {}) => g.text(String(s).toUpperCase(), x, y, { font: F("Montserrat", o.size || 19, 700), color: o.color || th.ink, sp: 3, align: o.align, alpha: o.alpha ?? 0.9 });
      const pac = (s, x, y, size, o = {}) => g.text(s, x, y, { font: F("Pacifico", size), color: o.color || th.hi, rotate: o.rotate ?? -0.07, align: o.align, stroke: o.stroke === false ? undefined : th.bg, strokeW: size * 0.2 });
      // el círculo se queda dentro del margen derecho
      const circulo = (k, fy, kr) => (capH, bottom, bw) => { const r = Math.min(270, capH * kr), cx = Math.min(M - 6 + bw * k, W - M / 2 - r); return { cx, cy: bottom - capH * fy, r }; };
      if (d.kind === "card") {
        label(d.church, M, 96); if (d.kicker) label(d.kicker, W - M, 96, { align: "right", color: th.hi, alpha: 1 });
        const rows = partir(ultima(d.headline)), lead = antes(d.headline);
        const lf = lead ? g.fit(lead, (s) => F("Pacifico", s), { maxW: W - 2 * M - 40, maxLines: 1, start: 92, min: 50 }) : null;
        const gi = gigante(rows, M - 6, lead ? 250 : 180, W - 2 * M - 20, 520, { circle: circulo(0.74, rows.length > 1 ? 0.7 : 0.2, rows.length > 1 ? 1.1 : 1.15) });
        if (lf) pac(lead, M + 6, gi.top - 16, lf.size, { stroke: false });
        const nm = g.fit(d.name.toUpperCase(), (s) => F("Archivo Black", s), { maxW: W - 2 * M, maxLines: 2, start: 82, min: 40, lh: 1.08 });
        const ln = g.fit(d.line, (s) => F("Montserrat", s, 700), { maxW: W - 2 * M, maxLines: 2, start: 38, min: 26, lh: 1.25 });
        // el bloque de datos va abajo; el círculo grande llena el medio
        const y0 = Math.max(gi.bottom + 90, gi.c.cy + gi.c.r + 70);
        const fijo = nm.size * 0.4 + (nm.lines.length - 1) * nm.lh + 60 + ln.h + 64;
        const vmax = H - 130 - y0 - fijo - 42;
        let vs = g.fit(`«${d.verse}»`, (s) => F("Montserrat", s, 500), { maxW: W - 2 * M - 360, maxLines: 6, start: 32, min: 24, lh: 1.38, maxH: vmax });
        if (!entero(vs, vmax)) vs = null;
        let y = y0 + Math.max(0, vmax - (vs ? vs.h : -42)) * 0.85;
        y = g.lines(nm.lines, M, y + nm.size * 0.4, nm.lh, { font: nm.font, color: th.ink }) + 60;
        y = g.lines(ln.lines, M, y, ln.lh, { font: ln.font, color: th.hi }) + 64;
        if (vs) {
          const vy = g.lines(vs.lines, M, y, vs.lh, { font: vs.font, color: th.ink, alpha: 0.88 });
          label(d.ref, M, vy + 42, { size: 19, color: th.hi, alpha: 1 });
        }
        const sg = g.fit(d.signature, (s) => F("Montserrat", s, 800), { maxW: 320, maxLines: 2, start: 28, min: 20, lh: 1.15 });
        const fr = g.fit(d.from, (s) => F("Montserrat", s, 500), { maxW: 320, maxLines: 2, start: 20, min: 16, lh: 1.3 });
        g.lines(sg.lines, W - M, y, sg.lh, { font: sg.font, color: th.ink, align: "right" });
        g.lines(fr.lines, W - M, y + (sg.lines.length - 1) * sg.lh + 34, fr.lh, { font: fr.font, color: th.ink, align: "right", alpha: 0.85 });
        g.logo(W - M, H - 72 - 60, 60, { white: g.lum(th.bg) < 0.5, align: "right" });
      } else if (d.kind === "ann") {
        label(d.church, M, 96); label(d.date ? d.weekday : "Aviso", W - M, 96, { align: "right", color: th.hi, alpha: 1 });
        // se recorta la palabra fuerte del título (no la fecha)
        const rows = partir(larga(d.title));
        const gi = gigante(rows, M - 6, 270, W - 2 * M - 20, 460, { circle: circulo(0.72, rows.length > 1 ? 0.9 : 0.5, rows.length > 1 ? 1.05 : 0.78) });
        pac("le invitamos", M + 6, gi.top - 18, 84, { stroke: false });
        const y0 = Math.max(gi.bottom + 70, gi.c.cy + gi.c.r + 60);
        const pl = d.place ? g.fit(d.place, (s) => F("Montserrat", s, 600), { maxW: W - 2 * M - 40, maxLines: 2, start: 34, min: 22, lh: 1.25 }) : null;
        const dH = d.date ? 50 : 0, room = H - 170 - y0 - dH - (pl ? pl.h + 64 : 0);
        const t = fitT(g, d.title.toUpperCase(), (s) => F("Archivo Black", s), { maxW: W - 2 * M, maxLines: 3, start: 130, min: 42, lh: 1.1, maxH: room - 16 });
        // el bloque (fecha, título, lugar) se centra en lo que queda
        let y = y0 + Math.max(0, room - t.h - 16) * 0.45;
        if (d.date) {
          const df = g.fit(`${d.weekday} ${d.day} de ${d.month} · ${d.time}`.toUpperCase(), (s) => F("Archivo Black", s), { maxW: W - 2 * M, maxLines: 1, start: 40, min: 26 });
          g.text(`${d.weekday} ${d.day} de ${d.month} · ${d.time}`.toUpperCase(), M, y, { font: df.font, color: th.hi });
          y += dH;
        }
        y = g.lines(t.lines, M, y + t.size * 0.78 + 16, t.lh, { font: t.font, color: th.ink });
        if (pl) {
          y += 64;
          ctx.fillStyle = th.acc; ctx.beginPath(); ctx.arc(M + 11, y - pl.size * 0.36, 11, 0, Math.PI * 2); ctx.fill();
          g.lines(pl.lines, M + 38, y, pl.lh, { font: pl.font, color: th.ink });
        }
        g.logo(W - M, H - 72 - 60, 60, { white: g.lum(th.bg) < 0.5, align: "right" });
      } else {
        const top = story ? 250 : 96, bot = H - (story ? 300 : 72);
        let y = top;
        if (d.head) {
          label(d.eyebrow || d.church, M, y);
          const hd = g.fit(d.head, (s) => F("Pacifico", s), { maxW: W - 2 * M - 40, maxLines: 2, start: 92, min: 50, lh: 1.15 });
          y = g.lines(hd.lines, M, y + 40 + hd.size * 0.9, hd.lh, { font: hd.font, color: th.hi, rotate: -0.04 }) + hd.size * 0.4;
        } else { label(d.church, M, y); y += 10; }
        const [book, num] = cita(d.ref), word = num || larga(d.text).toUpperCase();
        const largo = [...word].length >= 6;
        const ya = y + 30, z0 = (bot - y) * (story ? 0.34 : 0.4) * (largo ? 0.82 : 1);
        // primero se mide el versículo; si es corto, la cita crece con el alto que sobra
        const v0 = g.fit(d.text, (s) => F("Montserrat", s, 700), { maxW: W - 2 * M, maxLines: 12, start: story ? 100 : 96, min: 28, lh: 1.2, maxH: bot - ya - z0 - 170 });
        const zone = Math.max(z0, Math.min((bot - y) * 0.55, bot - ya - 170 - v0.h - 40));
        const mx = largo ? (story ? 460 : 380) : story ? 620 : 560;
        const gi0 = { s: Math.min(mx, zone / 0.72) };
        // el bloque entero se baja hacia el centro óptico cuando sobra alto
        const usado = Math.min(zone, gi0.s * 0.72) + 170 + v0.h, off = Math.max(0, (bot - ya - usado) * 0.4);
        const gi = gigante([word], M - 8, ya + off, W - 2 * M - 30, zone, { max: mx, circle: circulo(0.78, 0.5, 0.56) });
        y = gi.bottom + 70;
        if (num) { g.text(book.toUpperCase(), M, y, { font: F("Archivo Black", 42), color: th.hi }); y += 44; }
        const room = bot - y - (d.firma ? 60 : 10);
        const v = g.fit(d.text, (s) => F("Montserrat", s, 700), { maxW: W - 2 * M, maxLines: 12, start: story ? 100 : 96, min: 28, lh: 1.2, maxH: room - 40 });
        g.lines(v.lines, M, y + Math.max(0, room - v.h - 40) * 0.3 + v.size * 1.1, v.lh, { font: v.font, color: th.ink });
        if (d.firma) label(d.church, M, bot, { size: 18 });
      }
    },
  });
})();
