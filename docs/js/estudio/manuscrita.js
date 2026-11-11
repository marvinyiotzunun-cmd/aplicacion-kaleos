/* Estudio · familia Manuscrita: hecho a mano y cálido. Acuarela, cuaderno, tiza, papelería, marcador y carta. */
(function () {
  "use strict";
  const E = window.K && window.K.EST; if (!E) return;

  // ===== ayudantes de la familia =====
  const limpio = (s) => String(s || "").replace(/[¡!¿?]/g, "").trim();
  const cap = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
  // «Lamentaciones 3:22-23» → ["Lamentaciones", "3:22-23"]
  const cita = (ref) => { const m = String(ref || "").trim().match(/^(.*?)\s*(\d+(?:\s*[:.,\-–]\s*\d+)*)$/); return m && m[1] ? [m[1].trim(), m[2].replace(/\s+/g, "")] : [String(ref || "").trim(), ""]; };
  const historia = (g) => g.d.kind === "verse" && g.fmt === "historia";
  const hexRGB = (h) => { h = String(h || "#000").replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0); };

  // bloque de texto ya medido (resultado de g.fit) para apilarlo: alto real y cómo dibujarlo desde su borde de arriba
  const bloque = (g, f, x, o = {}) => {
    const a = o.asc ?? 0.78, de = o.desc ?? 0.24;
    return { h: (f.lines.length - 1) * f.lh + f.size * (a + de), gap: o.gap || 0, f,
      draw: (y) => g.lines(f.lines, x, y + f.size * a, f.lh, { font: f.font, color: o.color, align: o.align, sp: f.sp, alpha: o.alpha, rotate: o.rotate, stroke: o.stroke, strokeW: o.strokeW }) };
  };
  // reparte los bloques entre top y bot; k = dónde cae el aire sobrante (0 arriba, 1 abajo)
  const apilar = (items, top, bot, k = 0.5) => {
    items = items.filter(Boolean);
    const tot = items.reduce((a, it, i) => a + it.h + (i ? it.gap || 0 : 0), 0);
    let y = top + Math.max(0, (bot - top - tot) * k);
    items.forEach((it, i) => { if (i) y += it.gap || 0; it.draw(y); y += it.h; });
    return y;
  };
  const altoDe = (items) => items.filter(Boolean).reduce((a, it, i) => a + it.h + (i ? it.gap || 0 : 0), 0);
  // como apilar, pero solo calcula la y de arriba de cada bloque (it.y) sin dibujar
  const colocar = (items, top, bot, k = 0.5) => {
    items = items.filter(Boolean);
    let y = top + Math.max(0, (bot - top - altoDe(items)) * k);
    items.forEach((it, i) => { if (i) y += it.gap || 0; it.y = y; y += it.h; });
    return items;
  };
  // versículo corto (p. ej. «Jehová es mi pastor; nada me faltará.»): se dibuja mucho más grande
  const corto = (g) => g.d.kind === "verse" && String(g.d.text || "").length < 60;

  // parte un texto en líneas sin dejar al final de una línea palabras de 1–2 letras («de», «y», «a»)
  // y sin dejar una sola palabra en la última línea (viuda) cuando se puede evitar
  const CORTA = /^[a-záéíóúñü]{1,2}$/i;
  function envolver(g, s, font, maxW, sp = 0) {
    const words = String(s || "").split(/\s+/).filter(Boolean), out = []; let cur = [];
    const fits = (arr) => g.measure(arr.join(" "), font, sp) <= maxW;
    for (const w of words) {
      if (!cur.length || fits([...cur, w])) { cur.push(w); continue; }
      const carry = [];
      while (cur.length > 1 && CORTA.test(cur[cur.length - 1]) && fits([cur[cur.length - 1], ...carry, w]) && g.measure(cur.slice(0, -1).join(" "), font, sp) >= maxW * 0.6) carry.unshift(cur.pop());
      out.push(cur.join(" ")); cur = [...carry, w];
    }
    if (cur.length) out.push(cur.join(" "));
    if (out.length > 1) {
      const last = out[out.length - 1].split(" "), prev = out[out.length - 2].split(" ");
      if (last.length === 1 && prev.length >= 3 && fits([prev[prev.length - 1], ...last])) { last.unshift(prev.pop()); out[out.length - 2] = prev.join(" "); out[out.length - 1] = last.join(" "); }
    }
    return out;
  }
  // como g.fit (el tamaño más grande que cabe), pero con envolver
  function ajustar(g, s, fontFn, o = {}) {
    const { maxW = g.W * 0.8, maxH = g.H, maxLines = 6, start = 120, min = 24, lh = 1.1, sp = 0, step = 2 } = o;
    for (let size = start; size >= min; size -= step) {
      const font = fontFn(size), spx = typeof sp === "function" ? sp(size) : sp, lines = envolver(g, s, font, maxW, spx);
      if (lines.length <= maxLines && lines.length * size * lh <= maxH && lines.every((l) => g.measure(l, font, spx) <= maxW)) return { size, lines, lh: size * lh, h: lines.length * size * lh, font, sp: spx };
    }
    const font = fontFn(min), spx = typeof sp === "function" ? sp(min) : sp;
    let lines = envolver(g, s, font, maxW, spx);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/[\s,;:.]*$/, "") + "…"; }
    return { size: min, lines, lh: min * lh, h: lines.length * min * lh, font, sp: spx };
  }

  // trazo a mano alzada que pasa por los puntos
  function linea(g, pts, color, w, o = {}) {
    const { ctx, R } = g, j = o.jitter ?? 1.2;
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.globalAlpha = o.alpha ?? 1;
    const P = pts.map(([x, y]) => [x + (R() - 0.5) * j, y + (R() - 0.5) * j]);
    ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length - 1; i++) ctx.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2);
    ctx.lineTo(P[P.length - 1][0], P[P.length - 1][1]); ctx.stroke(); ctx.restore();
  }
  // hoja: base en (x,y), apunta hacia ang
  function hoja(g, x, y, len, ang, o = {}) {
    const { ctx } = g, wd = len * (o.wide ?? 0.3);
    const shape = (dx, dy) => { ctx.beginPath(); ctx.moveTo(dx, dy); ctx.quadraticCurveTo(len * 0.42 + dx, -wd + dy, len + dx, dy); ctx.quadraticCurveTo(len * 0.55 + dx, wd * 0.9 + dy, dx, dy); ctx.closePath(); };
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    // el color va un poco corrido del contorno, como en una ilustración pintada a mano
    if (o.fill) { shape(o.off ?? len * 0.06, (o.off ?? len * 0.06) * 0.6); ctx.globalAlpha = o.fillAlpha ?? 1; ctx.fillStyle = o.fill; ctx.fill(); ctx.globalAlpha = 1; }
    if (o.stroke) {
      shape(0, 0); ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lw || 3; ctx.lineJoin = "round"; ctx.stroke();
      if (o.vein !== false) { ctx.beginPath(); ctx.moveTo(len * 0.08, 0); ctx.quadraticCurveTo(len * 0.5, -wd * 0.12, len * 0.82, 0); ctx.lineWidth = (o.lw || 3) * 0.6; ctx.stroke(); }
    }
    ctx.restore();
  }
  // rama con hojas (olivo): de (x0,y0) a (x1,y1), curvada
  function rama(g, x0, y0, x1, y1, o = {}) {
    const { ctx, R } = g, bend = o.bend ?? 0.12, n = o.leaves ?? 9, L = Math.hypot(x1 - x0, y1 - y0);
    const cx = (x0 + x1) / 2 + (y1 - y0) * bend, cy = (y0 + y1) / 2 - (x1 - x0) * bend;
    const at = (t) => [(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1];
    const tan = (t) => Math.atan2(2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy), 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx));
    ctx.save(); ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lw * 1.3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.stroke(); ctx.restore();
    const ll = o.leafLen || L * 0.17;
    for (let i = 0; i < n; i++) {
      const t = 0.12 + (i / n) * 0.86, [px, py] = at(t), a = tan(t), side = i % 2 ? 1 : -1, len = ll * (0.75 + 0.35 * (1 - t)) * (0.9 + R() * 0.2);
      hoja(g, px, py, len, a + side * (0.55 + R() * 0.2), { fill: o.fill, fillAlpha: o.fillAlpha, stroke: o.stroke, lw: o.lw, wide: 0.26, vein: o.vein });
      if (o.fruit && i % 3 === 1) { ctx.save(); ctx.fillStyle = o.fruit; ctx.beginPath(); ctx.ellipse(px - side * ll * 0.18 * Math.sin(a), py + side * ll * 0.18 * Math.cos(a), ll * 0.11, ll * 0.15, a, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    }
    hoja(g, x1, y1, ll * 0.8, tan(1), { fill: o.fill, fillAlpha: o.fillAlpha, stroke: o.stroke, lw: o.lw, wide: 0.26, vein: o.vein });
  }
  // rosa en línea: un botón al centro y anillos de pétalos superpuestos (arcos en copa que se abren desde el centro)
  function rosa(g, cx, cy, r, col, lw) {
    const { ctx, R } = g, a0 = R() * 6;
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.13, a0, a0 + 4.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + r * 0.03, cy + r * 0.02, r * 0.26, a0 + 2.4, a0 + 2.4 + 3.4); ctx.stroke();
    [[3, 0.36, 0.3, 1.2], [4, 0.62, 0.36, 1.15], [5, 0.86, 0.34, 1.05]].forEach(([n, rad, pr, sp], ring) => {
      for (let k = 0; k < n; k++) {
        const a = a0 + ring * 0.7 + (k / n) * Math.PI * 2 + (R() - 0.5) * 0.2, px = cx + Math.cos(a) * r * rad * 0.62, py = cy + Math.sin(a) * r * rad * 0.56;
        ctx.beginPath(); ctx.arc(px, py, r * pr, a - sp, a + sp); ctx.stroke();
      }
    });
    ctx.restore();
  }
  // margarita en línea
  function flor(g, cx, cy, r, col, lw, n = 7) {
    const { ctx, R } = g, rot = R() * 6;
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw;
    for (let k = 0; k < n; k++) { const a = rot + (k / n) * Math.PI * 2; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * r * 0.56, cy + Math.sin(a) * r * 0.56, r * 0.44, r * 0.19, a, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r * 0.13, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  // corazón hecho a mano (contorno)
  function corazon(g, cx, cy, s, col, lw) {
    const { ctx } = g; ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (let p = 0; p < 2; p++) {
      const j = p * s * 0.04;
      ctx.beginPath(); ctx.moveTo(cx + j, cy + s * 0.5);
      ctx.bezierCurveTo(cx - s * 0.9, cy - s * 0.05 + j, cx - s * 0.45, cy - s * 0.75, cx, cy - s * 0.28 - j);
      ctx.bezierCurveTo(cx + s * 0.45, cy - s * 0.8, cx + s * 0.95, cy - s * 0.05, cx - j, cy + s * 0.52); ctx.stroke();
    }
    ctx.restore();
  }
  // mancha de acuarela de borde suave: capas de contorno ondulado (no polígonos) y el pigmento que se junta en la orilla
  function mancha(g, cx, cy, r, color, o = {}) {
    const { ctx, R } = g, a = o.alpha ?? 0.7, sx = o.sx || 1, sy = o.sy || 1, n = 64;
    ctx.save();
    for (let layer = 0; layer < (o.layers || 5); layer++) {
      const ph = [R() * 6, R() * 6, R() * 6], amp = [0.1 + R() * 0.06, 0.05 + R() * 0.04, 0.03], rr = r * (0.62 + layer * 0.09), pts = [];
      const ox = (R() - 0.5) * r * 0.12, oy = (R() - 0.5) * r * 0.12;
      for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2, k = 1 + amp[0] * Math.sin(2 * t + ph[0]) + amp[1] * Math.sin(3 * t + ph[1]) + amp[2] * Math.sin(7 * t + ph[2]) + (R() - 0.5) * 0.025; pts.push([cx + ox + Math.cos(t) * rr * k * sx, cy + oy + Math.sin(t) * rr * k * sy]); }
      ctx.beginPath(); ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
      for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
      ctx.closePath(); ctx.globalAlpha = a; ctx.fillStyle = g.rgba(color, 0.2); ctx.fill();
      if (layer === 0 || layer === (o.layers || 5) - 1) { ctx.strokeStyle = g.rgba(color, 0.35); ctx.lineWidth = 2.2; ctx.stroke(); }
    }
    ctx.restore();
  }
  // textura de tiza: puntitos del color de la pizarra que «comen» la tiza (sobre la pizarra no se notan)
  const TIZA = {};
  function tizaTile(color) {
    if (TIZA[color]) return TIZA[color];
    const c = document.createElement("canvas"); c.width = c.height = 220; const x = c.getContext("2d"), im = x.createImageData(220, 220), r = E.rng(31), [cr, cg, cb] = hexRGB(color);
    for (let i = 0; i < im.data.length; i += 4) { const v = r(); im.data[i] = cr; im.data[i + 1] = cg; im.data[i + 2] = cb; im.data[i + 3] = v < 0.22 ? 150 + r() * 105 : v < 0.5 ? r() * 90 : 0; }
    x.putImageData(im, 0, 0);
    // rayitas horizontales: el grano de la tiza al arrastrarla
    for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(${cr},${cg},${cb},${0.25 + r() * 0.4})`; x.fillRect(r() * 220, r() * 220, 3 + r() * 14, 1 + r() * 1.2); }
    return (TIZA[color] = c);
  }

  // =====================================================================================
  // «Acuarela»: ramo de manchas de acuarela con flores dibujadas en línea en una esquina; caligrafía grande a la izquierda.
  E.add({
    id: "man-acuarela", name: "Acuarela floral", family: "manuscrita", fonts: ["Great Vibes", "Cormorant Garamond", "Hanken Grotesk"],
    themes: {
      rosa: { name: "Rosa y salvia", bg: "#f8f2ea", ink: "#3b2a30", w1: "#e48a9c", w2: "#93b28a", acc: "#b44a63" },
      marino: { name: "Marino y oro", bg: "#f6f2e8", ink: "#0d1b3d", w1: "#2d5fa8", w2: "#f2c85b", acc: "#2d5fa8" },
      lavanda: { name: "Lavanda y durazno", bg: "#f6f3f4", ink: "#2f2640", w1: "#9b86c9", w2: "#eeac85", acc: "#6a52a1" },
      limon: { name: "Limón y añil", bg: "#fbf7ec", ink: "#22324a", w1: "#efc443", w2: "#7fa8cf", acc: "#2f6a99" },
      noche: { name: "Noche y rosa", bg: "#1f2b2c", ink: "#f4ede2", w1: "#e3909a", w2: "#8fb59b", acc: "#f2a7ae", wa: 1.25 },
    },
    draw(g) {
      const { ctx, W, H, th, d, F, R } = g, M = 96, story = historia(g), dark = g.lum(th.bg) < 0.5, wa = th.wa || 1, ph = g.photoOn, short = corto(g);
      g.paper(th.bg, { fibers: 0.45, grain: 0.06, mottle: 0.8 });
      const line = g.rgba(th.ink, dark ? 0.8 : 0.72);
      // los textos de apoyo nunca bajan de 26 px (se leen en la miniatura del celular)
      const caps = (s, x, y, o = {}) => g.text(String(s).toUpperCase(), x, y, { font: F("Hanken Grotesk", o.size || 28, 600), color: o.color || th.ink, sp: o.sp ?? 4, align: o.align, alpha: o.alpha ?? 0.9 });
      const capsB = (s, x, o = {}) => { const f = ajustar(g, String(s).toUpperCase(), (z) => F("Hanken Grotesk", z, 600), { maxW: o.maxW || W - 2 * M, maxLines: o.maxLines || 2, start: o.size || 28, min: 26, lh: 1.4, sp: o.sp ?? 4 }); return bloque(g, f, x, { color: o.color || th.ink, alpha: o.alpha ?? 0.9, gap: o.gap, align: o.align, asc: 0.72, desc: 0.1 }); };
      // el ramo: manchas de color y encima las flores en línea, cada flor centrada en su mancha
      const ramo = (cx, cy, r) => {
        const lw = Math.max(2.6, r * 0.011);
        const f1 = [cx - r * 0.66, cy + r * 0.6], f2 = [cx + r * 0.6, cy + r * 0.66];
        mancha(g, cx, cy, r * 0.82, th.w1, { alpha: 0.7 * wa, layers: 6 });
        mancha(g, cx, cy, r * 0.42, th.w1, { alpha: 0.45 * wa, layers: 4 });
        mancha(g, f1[0], f1[1], r * 0.4, th.w2, { alpha: 0.85 * wa });
        mancha(g, f2[0], f2[1], r * 0.28, th.w2, { alpha: 0.7 * wa });
        // hojas que salen de detrás de la rosa hacia afuera, entre las manchas
        [[2.15, 0.62], [2.9, 0.5], [1.05, 0.55], [0.35, 0.44], [3.8, 0.4]].forEach(([a, l]) => hoja(g, cx + Math.cos(a) * r * 0.36, cy + Math.sin(a) * r * 0.34, r * l, a, { stroke: line, lw, fill: g.rgba(th.w2, 0.35 * wa) }));
        rosa(g, cx, cy, r * 0.4, line, lw);
        flor(g, f1[0], f1[1], r * 0.2, line, lw);
        flor(g, f2[0], f2[1], r * 0.14, line, lw, 6);
      };
      // con foto: la foto dentro de un contorno de acuarela, con el borde pintado (irregular, sin difuminar)
      const fotoMancha = (cx, cy, r, ax = 1) => {
        const mk = (s) => { const n = 60, p = [R() * 6, R() * 6, R() * 6], pts = []; for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2, k = s * (1 + 0.07 * Math.sin(2 * t + p[0]) + 0.04 * Math.sin(3 * t + p[1]) + 0.02 * Math.sin(8 * t + p[2])); pts.push([cx + Math.cos(t) * r * k, cy + Math.sin(t) * r * k * 0.96]); } return (c) => { c.beginPath(); c.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2); for (let i = 0; i < n; i++) { const a = pts[i], q = pts[(i + 1) % n]; c.quadraticCurveTo(a[0], a[1], (a[0] + q[0]) / 2, (a[1] + q[1]) / 2); } c.closePath(); }; };
        const path = mk(1);
        g.photo(cx - r * 1.1, cy - r * 1.1, r * 2.2, r * 2.2, { treat: "suave", path, focusY: 0.35 });
        ctx.save(); path(ctx); ctx.strokeStyle = g.rgba(th.w1, 0.75 * Math.min(1, wa)); ctx.lineWidth = 5; ctx.lineJoin = "round"; ctx.stroke();
        mk(1.025)(ctx); ctx.strokeStyle = g.rgba(th.w1, 0.4); ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
        // una flor de acuarela pegada al borde, hacia la orilla de la hoja
        const fx = cx + ax * r * 0.78, fy = cy + r * 0.76, lw = 2.6;
        mancha(g, fx, fy, r * 0.3, th.w2, { alpha: 0.85 * wa });
        flor(g, fx, fy, r * 0.17, line, lw);
        hoja(g, fx - ax * r * 0.12, fy + r * 0.1, r * 0.34, ax > 0 ? 2.5 : 0.6, { stroke: line, lw });
        return { left: cx - r * 1.1, bottom: cy + r * 1.03 };
      };
      // ramita pequeña para acompañar la cita
      const brote = (x, y, s) => { linea(g, [[x, y], [x + s * 0.5, y - s * 0.1], [x + s, y - s * 0.25]], line, 2.4); hoja(g, x + s * 0.35, y - s * 0.07, s * 0.36, -1.1, { stroke: line, lw: 2.2, vein: false }); hoja(g, x + s * 0.7, y - s * 0.17, s * 0.32, 0.5, { stroke: line, lw: 2.2, vein: false }); };
      const logo = (x, y, h, al) => g.logo(x, y, h, { white: dark, align: al });

      if (d.kind === "card") {
        // con foto: la foto arriba a la derecha (bajada para que no corte cabezas) y el texto debajo
        let top = 360;
        if (ph) { const f = fotoMancha(W - 300, 310, 225); top = f.bottom + 46; } else ramo(W - 130, 150, 280);
        mancha(g, W - 40, H + 10, 190, th.w2, { alpha: 0.6 * wa });
        if (d.kicker) caps(d.kicker, M, 140, { color: th.acc, alpha: 1 });
        const bot = H - 230;
        const [lead, main] = g.splitHead(limpio(d.headline));
        const hd = ajustar(g, cap(main), (s) => F("Great Vibes", s), { maxW: W - 2 * M + 20, maxLines: 2, start: 230, min: 100, lh: 0.9, maxH: (bot - top) * 0.42 });
        const nm = ajustar(g, d.name, (s) => F("Cormorant Garamond", s, 700), { maxW: W - 2 * M, maxLines: 2, start: 88, min: 48, lh: 1.02 });
        const ln = ajustar(g, d.line, (s) => F("Cormorant Garamond", s, 500, true), { maxW: W - 2 * M, maxLines: 2, start: 44, min: 32, lh: 1.2 });
        const head = [lead ? capsB(lead, M + 4, { size: 32, sp: 12, color: th.ink, alpha: 1 }) : null, bloque(g, hd, M - 8, { color: th.acc, asc: 0.8, desc: 0.3, gap: lead ? 22 : 0 })];
        const fixed = [...head, bloque(g, nm, M, { color: th.ink, gap: 34 }), bloque(g, ln, M, { color: th.ink, alpha: 0.88, gap: 14 })];
        const room = bot - top - altoDe(fixed) - 120;
        const vs = room > 80 ? ajustar(g, `«${d.verse}»`, (s) => F("Cormorant Garamond", s, 500, true), { maxW: W - 2 * M - 200, maxLines: 4, start: 34, min: 28, lh: 1.3, maxH: room }) : null;
        const verse = vs ? { h: vs.h + 60, gap: 56, draw: (y) => {
          linea(g, [[M, y - 18], [M + 40, y - 20], [M + 80, y - 17]], th.acc, 3);
          const vy = g.lines(vs.lines, M, y + 26 + vs.size * 0.7, vs.lh, { font: vs.font, color: th.ink, alpha: 0.9 });
          caps(d.ref, M, vy + 50, { size: 26, color: th.acc, alpha: 1, sp: 4 });
        } } : null;
        apilar([...fixed, verse], top, bot, 0.35);
        const sg = ajustar(g, d.signature, (s) => F("Great Vibes", s), { maxW: 560, maxLines: 1, start: 80, min: 44 });
        g.text(d.signature, W - M, H - 136, { font: sg.font, color: th.ink, align: "right" });
        const fr = ajustar(g, d.from.toUpperCase(), (s) => F("Hanken Grotesk", s, 600), { maxW: 600, maxLines: 1, start: 26, min: 22, sp: 3 });
        g.text(d.from.toUpperCase(), W - M, H - 84, { font: fr.font, color: th.ink, sp: 3, align: "right", alpha: 0.85 });
        logo(M, H - 166, 78, "left");
      } else if (d.kind === "ann") {
        let top = 170, exW = W - 2 * M;
        const heads = [];
        if (ph) {
          // la foto arriba a la derecha; la iglesia y «Le invitamos» a su lado sin pasar de su borde (zona de exclusión)
          const f = fotoMancha(W - 270, 290, 200, 1); exW = f.left - 40 - M;
          heads.push(capsB(d.church, M, { maxW: exW, sp: 3 }));
          const inv = ajustar(g, "Le invitamos", (s) => F("Great Vibes", s), { maxW: exW, maxLines: 1, start: 120, min: 70 });
          heads.push(bloque(g, inv, M - 4, { color: th.acc, asc: 0.75, desc: 0.25, gap: 30 }));
          apilar(heads, 110, f.bottom - 10, 0.5);
          top = f.bottom + 30; mancha(g, W + 20, H - 60, 220, th.w2, { alpha: 0.55 * wa });
        } else { ramo(W - 110, H - 120, 300); caps(d.church, M, 124, { size: 26, sp: 4 }); }
        mancha(g, -30, 40, 170, th.w2, { alpha: 0.55 * wa });
        const bot = H - 330;
        const parts = [];
        if (!ph) { const inv = ajustar(g, "Le invitamos", (s) => F("Great Vibes", s), { maxW: W - 2 * M, maxLines: 1, start: 120, min: 80 }); parts.push(bloque(g, inv, M - 4, { color: th.acc, asc: 0.75, desc: 0.25 })); }
        const dateH = d.date ? 210 + 60 : 140;
        const tt = ajustar(g, d.title, (s) => F("Cormorant Garamond", s, 700), { maxW: W - 2 * M, maxLines: 4, start: 128, min: 58, lh: 0.98, maxH: Math.min(d.date ? 420 : 520, bot - top - dateH - (ph ? 0 : 160)) });
        parts.push(bloque(g, tt, M, { color: th.ink, gap: 30, asc: 0.72, desc: 0.2 }));
        if (d.date) {
          const df = F("Cormorant Garamond", 250, 500), dw = g.measure(d.day, df);
          parts.push({ h: 210, gap: 60, draw: (y) => {
            g.text(d.day, M - 10, y + 190, { font: df, color: th.acc });
            const x2 = M + dw + 34; ctx.fillStyle = g.rgba(th.ink, 0.35); ctx.fillRect(x2, y + 30, 2, 170);
            const x3 = x2 + 34, mw = W - M - (ph ? 0 : 230) - x3;
            const mf = ajustar(g, d.month, (s) => F("Cormorant Garamond", s, 600, true), { maxW: mw, maxLines: 1, start: 72, min: 40 });
            g.text(d.month, x3, y + 90, { font: mf.font, color: th.ink });
            caps(d.weekday, x3, y + 138, { size: 28, sp: 5 });
            g.text(d.time.toUpperCase(), x3, y + 190, { font: F("Hanken Grotesk", 36, 700), color: th.ink });
          } });
        } else {
          const le = ajustar(g, "¡Le esperamos!", (s) => F("Great Vibes", s), { maxW: W - 2 * M - 200, maxLines: 1, start: 110, min: 60 });
          parts.push(bloque(g, le, M, { color: th.acc, asc: 0.75, desc: 0.25, gap: 50 }));
        }
        apilar(parts, top, bot, 0.4);
        if (d.place) {
          const pl = ajustar(g, d.place, (s) => F("Hanken Grotesk", s, 600), { maxW: W - 2 * M - 48 - (ph ? 120 : 380), maxLines: 2, start: 32, min: 26, lh: 1.3 });
          const py = H - 250 + Math.max(0, 2 - pl.lines.length) * pl.lh * 0.5;
          flor(g, M + 14, py - pl.size * 0.35, 15, th.acc, 2.4, 6);
          g.lines(pl.lines, M + 48, py, pl.lh, { font: pl.font, color: th.ink });
        }
        logo(M, H - 140, 70, "left");
      } else {
        const sq = g.fmt === "cuadrado", top = story ? 270 : sq ? 100 : 120, bot = H - (story ? 310 : sq ? 100 : 120);
        let exL, objBot;
        if (ph) {
          const r = story ? 210 : sq ? 165 : 195, cxp = W - r - 70, cyp = (story ? 250 : 60) + r * 1.04;
          const f = fotoMancha(cxp, cyp, r, 1); exL = f.left - 40; objBot = f.bottom + 40;
        } else {
          const rX = W - 110, rY = story ? 170 : 110, rR = story ? 290 : sq ? 210 : 240;
          ramo(rX, rY, rR); exL = rX - rR * 1.2 - 10; objBot = rY + rR + 30;
        }
        mancha(g, -20, H - (story ? 200 : 20), story ? 220 : 170, th.w2, { alpha: 0.6 * wa });
        const hdW = exL - M, side = [], below = [];
        if (d.eyebrow) side.push(capsB(d.eyebrow, M, { color: th.acc, alpha: 1, maxW: hdW }));
        if (d.head) {
          // el saludo va al lado de la foto o del ramo solo si cabe holgado; si no, debajo a todo el ancho
          const wide = hdW >= 520, hd = ajustar(g, d.head, (s) => F("Great Vibes", s), { maxW: wide ? hdW : W - 2 * M, maxLines: 2, start: story ? 150 : 120, min: 70, lh: 0.95 });
          (wide ? side : below).push(bloque(g, hd, M - 4, { color: th.acc, asc: 0.75, desc: 0.3, gap: (wide ? side : below).length ? 10 : 0 }));
        }
        const refS = short ? 34 : story ? 30 : 28, refH = 44, firmaH = d.firma ? 56 : 0;
        apilar(side, top, top + altoDe(side), 0);
        const vTop = Math.max(top + altoDe(side) + (side.length ? 50 : 0), objBot);
        const room = bot - vTop - altoDe(below) - (below.length ? 40 : 0) - refH - 50 - firmaH;
        const v = ajustar(g, d.text, (s) => F("Cormorant Garamond", s, 600), short
          ? { maxW: W * 0.66, maxLines: 5, start: 150, min: 44, lh: 1.08, maxH: Math.min(room, H * 0.5) }
          : { maxW: W - 2 * M, maxLines: 12, start: story ? 112 : sq ? 112 : 108, min: 36, lh: 1.1, maxH: room });
        apilar([...below, bloque(g, v, M, { color: th.ink, asc: 0.72, desc: 0.22, gap: below.length ? 40 : 0 }),
          { h: refH, gap: 50, draw: (y) => { brote(M, y + 30, 76); caps(d.ref, M + 100, y + 36, { size: refS, color: th.acc, alpha: 1, sp: 5 }); } }], vTop, bot - firmaH, 0.42);
        if (d.firma) caps(d.church, M, bot, { size: 26, sp: 4, alpha: 0.85 });
        else logo(W - M, bot - 56, 60, "right");
      }
    },
  });

  // =====================================================================================
  // «Cuaderno»: hoja de cuaderno con renglones y margen; se escribe sobre los renglones y una nota adhesiva lleva el dato clave.
  E.add({
    id: "man-cuaderno", name: "Cuaderno y nota", family: "manuscrita", fonts: ["Caveat", "Permanent Marker", "Hanken Grotesk"],
    themes: {
      clasico: { name: "Cuaderno escolar", paper: "#fbfaf4", ink: "#23314f", rule: "#8fb0d8", margin: "#e06b6b", note: "#f9e46d", noteInk: "#1f1f1f", desk: "#3a3d44" },
      marino: { name: "Marino y oro", paper: "#f6f4ec", ink: "#0d1b3d", rule: "#2d5fa8", margin: "#2d5fa8", note: "#f2c85b", noteInk: "#0d1b3d", desk: "#0d1b3d" },
      menta: { name: "Menta", paper: "#fbfbf6", ink: "#25302b", rule: "#a9c9bb", margin: "#e98f72", note: "#a6e3c5", noteInk: "#15302a", desk: "#2f3a35" },
      rosa: { name: "Rosa chicle", paper: "#fdfaf7", ink: "#3c2442", rule: "#cfb8d6", margin: "#d65a7e", note: "#f8b6c8", noteInk: "#3c1d33", desk: "#3d2b3a" },
      noche: { name: "Libreta negra", paper: "#1e2026", ink: "#f2eee4", rule: "#ffffff", margin: "#ff9f6b", note: "#ff9f6b", noteInk: "#1e1b18", desk: "#0e0f12", dark: true },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, story = historia(g), sq = d.kind === "verse" && g.fmt === "cuadrado", ph = g.photoOn;
      g.paper(th.paper, { fibers: th.dark ? 0.25 : 0.35, grain: 0.05, mottle: 0.5 });
      // el rayado tiene un paso fijo (64 px a 1080 de ancho) y cada línea de texto se apoya justo sobre un renglón
      const L = 64, X0 = 196, XR = W - 78, y0 = story ? 120 : 96;
      const ry = (i) => y0 + i * L, rows = Math.floor((H - 24 - y0) / L), base = (i) => ry(i) - 3;
      ctx.fillStyle = g.rgba(th.rule, th.dark ? 0.16 : 0.55);
      for (let i = 0; i <= rows; i++) ctx.fillRect(0, ry(i), W, 2);
      ctx.fillStyle = g.rgba(th.margin, 0.7); ctx.fillRect(150, 0, 2.5, H); ctx.fillRect(157, 0, 1.2, H);
      for (let i = 0; i < Math.round(H / 270); i++) { const hy = H / Math.round(H / 270) * (i + 0.5); ctx.fillStyle = th.desk; ctx.beginPath(); ctx.arc(66, hy, 19, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,.12)"; ctx.lineWidth = 3; ctx.stroke(); }
      g.grain(0.04);
      const pen = th.ink, red = th.margin;
      const cav = (w = 700) => (z) => F("Caveat", z, w);
      // tamaños permitidos: los que ocupan 1 renglón (interlineado = paso) o 2 renglones (= 2 × paso), nunca entre medias
      const fitR = (s, fontFn, o) => {
        const sizes = [];
        if (!o.one) for (let z = Math.min(o.start, 2 * L + 8); z >= Math.max(o.min, 78); z -= 2) sizes.push([z, 2]);
        if (!o.two) for (let z = Math.min(o.start, L + 2); z >= Math.min(o.min, L); z -= 2) sizes.push([z, 1]);
        let best = null;
        for (const [size, k] of sizes) {
          const font = fontFn(size), lines = envolver(g, s, font, o.maxW);
          best = { size, font, lines, k };
          if (lines.length <= (o.maxLines || 9) && lines.length * k <= o.rows && lines.every((l) => g.measure(l, font) <= o.maxW)) return best;
        }
        const n = Math.max(1, Math.floor(o.rows / best.k)); if (best.lines.length > n) { best.lines = best.lines.slice(0, n); best.lines[n - 1] = best.lines[n - 1].replace(/[\s,;:.]*$/, "") + "…"; }
        return best;
      };
      // escribe en los renglones a partir del renglón r; devuelve el renglón donde acabó
      const escribir = (f, r, x, o = {}) => { f.lines.forEach((l, i) => g.text(l, x, base(r + (i + 1) * f.k), { font: f.font, color: o.color || pen, align: o.align, alpha: o.alpha })); return r + f.lines.length * f.k; };
      // nota adhesiva girada; fn dibuja adentro con origen en su esquina
      const nota = (x, y, w, h, ang, fn) => {
        ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(ang);
        ctx.save(); ctx.shadowColor = "rgba(0,0,0,.22)"; ctx.shadowBlur = 22; ctx.shadowOffsetY = 10; ctx.fillStyle = th.note; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore();
        const lg = ctx.createLinearGradient(0, h / 2 - h * 0.22, 0, h / 2); lg.addColorStop(0, "rgba(0,0,0,0)"); lg.addColorStop(1, "rgba(0,0,0,.09)"); ctx.fillStyle = lg; ctx.fillRect(-w / 2, h / 2 - h * 0.22, w, h * 0.22);
        ctx.fillStyle = "rgba(0,0,0,.06)"; ctx.fillRect(-w / 2, -h / 2, w, 26);
        ctx.translate(-w / 2, -h / 2); fn(w, h); ctx.restore();
      };
      // con foto: una foto instantánea pegada con cinta (cálida, enfocada arriba para no cortar caras)
      const polaroid = (cx, cy, w, h, ang) => {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
        ctx.save(); ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8; ctx.fillStyle = "#fbfaf6"; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore();
        g.photo(-w / 2 + 14, -h / 2 + 14, w - 28, h - 70, { treat: "calido", focusY: 0.35 });
        g.tape(0, -h / 2 + 4, 140, -0.06); ctx.restore();
      };
      const PW = d.kind === "verse" ? 232 : 256, PH = d.kind === "verse" ? 270 : 300; // la foto: ~24 % del ancho
      const logo = (x, y, h, al) => g.logo(x, y, h, { white: !!th.dark, align: al });

      if (d.kind === "card") {
        if (d.kicker) g.text(d.kicker, XR, base(1), { font: ajustar(g, d.kicker, cav(500), { maxW: 520, maxLines: 1, start: 46, min: 30 }).font, color: pen, align: "right", alpha: 0.85 });
        let r = 1;
        // el título siempre a todo el ancho; la primera palabra en rojo (como el lápiz del margen)
        const hd = fitR(d.headline, cav(), { maxW: XR - X0 + 6, rows: 4, start: 120, min: 40, maxLines: 2 });
        const [lead] = g.splitHead(d.headline);
        hd.lines.forEach((l, i) => {
          const yy = base(r + (i + 1) * hd.k);
          if (i === 0 && lead && l.startsWith(lead)) { const w = g.text(lead, X0 - 6, yy, { font: hd.font, color: red }); g.text(l.slice(lead.length), X0 - 6 + w, yy, { font: hd.font, color: pen }); }
          else g.text(l, X0 - 6, yy, { font: hd.font, color: pen });
        });
        r += hd.lines.length * hd.k + 1;
        // la nota con el nombre; con foto, la foto instantánea va a su lado (zona media derecha)
        const nw = ph ? XR - X0 - PW - 40 : XR - X0 - 30;
        const nm = ajustar(g, d.name, (s) => F("Permanent Marker", s), { maxW: nw - 84, maxLines: 2, start: 72, min: 36, lh: 1.1 });
        const ln = ajustar(g, d.line, cav(500), { maxW: nw - 84, maxLines: ph ? 3 : 2, start: 46, min: 32, lh: 1.08 });
        const nh = 48 + nm.h + 14 + ln.h + 30, ny = ry(r) + 6, bh = ph ? Math.max(nh, PH) : nh;
        nota(X0 - 10, ny + (bh - nh) / 2, nw, nh, -0.022, () => {
          g.lines(nm.lines, 42, 46 + nm.size * 0.82, nm.lh, { font: nm.font, color: th.noteInk });
          g.lines(ln.lines, 42, 46 + nm.h + 18 + ln.size * 0.8, ln.lh, { font: ln.font, color: th.noteInk, alpha: 0.85 });
        });
        if (ph) polaroid(XR - PW / 2 + 4, ny + bh / 2, PW, PH, 0.05);
        r = Math.ceil((ny + bh + 22 - y0) / L);
        // versículo escrito en los renglones (los dos últimos son para la firma)
        const last = rows - 4, left = last - r - 1;
        if (left >= 2 && d.verse) {
          const vs = fitR(`«${d.verse}»`, cav(500), { maxW: XR - X0 - 10, rows: left, start: 52, min: 34, maxLines: 5, one: true });
          r += Math.floor((left - vs.lines.length) * 0.35);
          r = escribir(vs, r, X0, { alpha: 0.9 });
          g.text(`— ${d.ref}`, X0, base(r + 1), { font: F("Caveat", 42, 700), color: red });
        }
        g.text(d.signature, XR, base(rows - 2), { font: ajustar(g, d.signature, cav(), { maxW: 540, maxLines: 1, start: 56, min: 36 }).font, color: pen, align: "right" });
        g.text(d.from, XR, base(rows - 1), { font: ajustar(g, d.from, cav(500), { maxW: 560, maxLines: 1, start: 40, min: 28 }).font, color: pen, align: "right", alpha: 0.8 });
        logo(X0, base(rows - 1) - 70, 70, "left");
      } else if (d.kind === "ann") {
        g.text(d.church, X0, base(1), { font: ajustar(g, d.church, cav(500), { maxW: XR - X0, maxLines: 1, start: 42, min: 28 }).font, color: pen, alpha: 0.8 });
        g.text("Le invitamos:", X0, base(2), { font: F("Caveat", 50, 700), color: red });
        // abajo: la nota (fecha) a la derecha; a la izquierda el lugar o, con foto, la foto instantánea (y el lugar debajo)
        const nw = d.date ? 390 : 460, nh = d.date ? (ph ? 340 : 400) : 290, noteRows = Math.ceil((nh + 24) / L);
        const placeBelow = !!d.place && (ph || !d.date), placeRows = placeBelow ? 2 : 0;
        const footR = rows, titleRows = rows - 2 - 1 - noteRows - (placeBelow ? 3 : 1);
        const tt = fitR(d.title, cav(), { maxW: XR - X0, rows: Math.max(2, titleRows), start: 120, min: 40, maxLines: 4 });
        let r = escribir(tt, 2, X0 - 4) + 1;
        // si sobra alto, la nota baja un poco para no dejar el pie vacío
        r += Math.max(0, Math.floor((rows - 1 - r - noteRows - (placeBelow ? 3 : 0)) * 0.4));
        const nx = XR - nw - 6, ny = ry(r) + 8;
        nota(nx, ny, nw, nh, 0.035, (w, h) => {
          if (d.date) {
            // de abajo hacia arriba: hora, mes y el día con el alto que queda
            const top = 84, ty = h - 30, my = ty - 58, dsz = Math.min(190, my - 52 - top);
            g.text(cap(d.weekday), w / 2, top, { font: F("Caveat", 54, 700), color: th.noteInk, align: "center" });
            const df = ajustar(g, d.day, (s) => F("Permanent Marker", s), { maxW: w - 80, maxLines: 1, start: dsz, min: 80 });
            g.text(d.day, w / 2, top + 14 + df.size * 0.92, { font: df.font, color: th.noteInk, align: "center" });
            const mf = ajustar(g, d.month.toUpperCase(), (s) => F("Permanent Marker", s), { maxW: w - 80, maxLines: 1, start: 46, min: 28 });
            g.text(d.month.toUpperCase(), w / 2, my, { font: mf.font, color: th.noteInk, align: "center" });
            g.text(d.time, w / 2, ty, { font: F("Caveat", 52, 700), color: th.noteInk, align: "center" });
          } else {
            const f = ajustar(g, "¡Le esperamos!", (s) => F("Permanent Marker", s), { maxW: w - 80, maxLines: 2, start: 80, min: 40, lh: 1.15 });
            g.lines(f.lines, w / 2, h / 2 - f.h / 2 + f.size * 0.85, f.lh, { font: f.font, color: th.noteInk, align: "center" });
          }
        });
        if (ph) polaroid(X0 + PW / 2 + 10, ny + nh / 2 + 4, PW, PH, -0.04);
        const lugar = (pr, maxW, maxR) => {
          const lw = g.text("Lugar:", X0, base(pr), { font: F("Caveat", 46, 700), color: red });
          const pl = fitR(d.place, cav(500), { maxW: maxW - lw - 14, rows: maxR, start: 50, min: 34, maxLines: maxR, one: true });
          pl.lines.forEach((l, i) => g.text(l, X0 + lw + 14, base(pr + i), { font: pl.font, color: pen, alpha: 0.95 }));
        };
        if (d.place && !placeBelow) {
          g.text("Lugar:", X0, base(r + 1), { font: F("Caveat", 46, 700), color: red });
          const pl = fitR(d.place, cav(500), { maxW: nx - X0 - 30, rows: 5, start: 54, min: 34, maxLines: 5, one: true });
          escribir(pl, r + 1, X0, { alpha: 0.95 });
        } else if (d.place) lugar(Math.min(footR - placeRows + 1, Math.ceil((ny + nh + 30 - y0) / L) + 1), XR - X0 - 170, placeRows);
        logo(XR, base(footR) - 66, 66, "right");
      } else {
        const r0 = story ? 2 : 0, short = corto(g);
        const footR = story ? rows - 3 : rows - 1, endR = footR - 1;
        if (d.eyebrow) g.text(d.eyebrow, XR, base(r0 + 1), { font: ajustar(g, d.eyebrow, cav(500), { maxW: XR - X0, maxLines: 1, start: 44, min: 28 }).font, color: pen, align: "right", alpha: 0.85 });
        let r = r0 + (d.eyebrow ? 1 : 0);
        if (d.head) { const hd = fitR(d.head, cav(), { maxW: XR - X0, rows: story ? 2 : 4, start: 116, min: 40, maxLines: 2 }); r = escribir(hd, r, X0 - 4, { color: red }); }
        const nh = sq ? 190 : 210, nw = ph ? 380 : 420;
        const bottomRows = ph ? Math.ceil((PH + 24) / L) : Math.ceil((nh + 30) / L);
        const avail = endR - bottomRows - r - (r > r0 ? 1 : 0);
        const vs = fitR(d.text, cav(), short
          ? { maxW: Math.min(XR - X0 - 10, W * 0.64), rows: avail, start: 120, min: 40, maxLines: 5 }
          : { maxW: XR - X0 - 10, rows: avail, start: 120, min: 40, maxLines: 12 });
        // el bloque se centra (un poco arriba) en el alto que queda, renglón a renglón
        r += (r > r0 ? 1 : 0) + Math.max(0, Math.floor((avail - vs.lines.length * vs.k) * (short ? 0.42 : 0.35)));
        r = escribir(vs, r, X0 - 4);
        const [book, num] = cita(d.ref);
        let nx = XR - nw - 10, nyy = Math.min(ry(r) + 34, ry(endR + 1) - nh);
        if (ph) {
          // la foto instantánea abajo a la derecha y la nota pegada encima de su esquina
          const pcy = Math.min(ry(r) + 40 + PH / 2, ry(endR + 1) - PH / 2);
          polaroid(XR - PW / 2, pcy, PW, PH, 0.05);
          nx = XR - PW - nw + 40; nyy = pcy + PH / 2 - nh + 10;
        }
        nota(nx, nyy, nw, nh, -0.04, (w, h) => {
          const bf = ajustar(g, book, (s) => F("Permanent Marker", s), { maxW: w - 70, maxLines: 1, start: 60, min: 28 });
          g.text(book, 38, num ? h / 2 - 4 : h / 2 + bf.size * 0.35, { font: bf.font, color: th.noteInk });
          if (num) g.text(num, 38, h / 2 + bf.size * 1.05, { font: F("Caveat", 60, 700), color: th.noteInk });
        });
        // el pie siempre abajo: la línea de la iglesia o el logo
        if (d.firma) g.text(d.church, X0, base(footR), { font: F("Caveat", 40, 500), color: pen, alpha: 0.8 });
        else logo(X0, base(footR) - 62, 62, "left");
      }
    },
  });

  // =====================================================================================
  // «Pizarra»: lettering de tiza centrado, como el pizarrón de la entrada; solo el dato clave va en una cinta dibujada.
  E.add({
    id: "man-pizarra", name: "Pizarra de tiza", family: "manuscrita", fonts: ["Kaushan Script", "Oswald", "Caveat"],
    themes: {
      verde: { name: "Pizarra verde", bg: "#25392f", chalk: "#f1eee4", acc: "#f4d77a", frame: "#8a5a35" },
      marino: { name: "Marino y oro", bg: "#13213f", chalk: "#f3f0e8", acc: "#f2c85b", frame: "#3b2a1f", band: "#2d5fa8" },
      negra: { name: "Pizarra negra", bg: "#1e1f21", chalk: "#f2f0ea", acc: "#f39a8c", frame: "#a87a4f" },
      menta: { name: "Pizarra blanca y menta", bg: "#f1f2ee", chalk: "#1f2833", acc: "#0f8a6c", frame: "#aeb3b8", light: true, metal: true },
      kraft: { name: "Kraft y carbón", bg: "#dcc8a4", chalk: "#2a221b", acc: "#b8432f", frame: "#2a221b", light: true },
    },
    draw(g) {
      const { ctx, W, H, th, d, F, R } = g, story = historia(g), FR = 30, cx = W / 2, ph = g.photoOn, short = corto(g);
      // la pizarra: color plano y borrones de tiza (o de plumón) vieja
      ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
      const smudge = th.light ? "#000000" : "#ffffff";
      ctx.save(); ctx.lineCap = "round"; ctx.filter = "blur(26px)";
      for (let i = 0; i < 8; i++) {
        ctx.strokeStyle = g.rgba(smudge, (th.metal ? 0.012 : 0.03) + R() * 0.03); ctx.lineWidth = 140 + R() * 160; ctx.beginPath();
        const x = R() * W, y = R() * H, a = (R() - 0.5) * 0.6, l = 300 + R() * 500; ctx.moveTo(x, y); ctx.quadraticCurveTo(x + l * 0.5, y + Math.sin(a) * l * 0.5 + (R() - 0.5) * 120, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
      }
      ctx.filter = "none"; ctx.restore();
      const chalk = th.chalk, acc = th.acc;
      const tz = (s, x, y, font, o = {}) => g.text(s, x, y, { font, color: o.color || chalk, align: o.align ?? "center", sp: o.sp, rotate: o.rotate, alpha: o.alpha ?? 0.95 });
      const tzL = (f, x, y, o = {}) => f.lines.forEach((l, i) => tz(l, x, y + i * f.lh, f.font, { ...o, sp: f.sp }));
      // trazo de tiza (dos pasadas)
      const tl = (pts, color, w, a = 0.85) => { linea(g, pts, color, w, { alpha: a, jitter: 2 }); linea(g, pts, color, w * 0.6, { alpha: a * 0.6, jitter: 3 }); };
      // la cinta (el único gesto de la pieza): banda al frente y dos colas dobladas detrás
      const cinta = (y, w, h, color) => {
        const L = cx - w / 2, Rr = cx + w / 2, T = y - h / 2, B = y + h / 2, e = h * 0.95, t = h * 0.38, lw = Math.max(3, h * 0.035);
        [[-1, L], [1, Rr]].forEach(([s, X]) => {
          const xin = X - s * e * 0.2, xout = X + s * e, notch = X + s * e * 0.66;
          const pts = [[xin, T + t], [xout, T + t], [notch, T + t + h / 2], [xout, B + t], [X, B + t]];
          ctx.save(); ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.fillStyle = th.band ? g.rgba(g.mix(th.band, "#000000", 0.35), 0.9) : g.rgba(color, 0.1); ctx.fill(); ctx.restore();
          tl([...pts.slice(0, 4), [X, B + t]], color, lw);
          ctx.save(); ctx.fillStyle = g.rgba(color, 0.35); ctx.beginPath(); ctx.moveTo(X, B); ctx.lineTo(X, B + t); ctx.lineTo(xin, T + t); ctx.lineTo(X, T + t); ctx.closePath(); ctx.fill(); ctx.restore();
        });
        ctx.save(); ctx.fillStyle = th.band ? g.rgba(th.band, 0.92) : th.bg; ctx.beginPath(); ctx.moveTo(L, T); ctx.quadraticCurveTo(cx, T - h * 0.14, Rr, T); ctx.lineTo(Rr, B); ctx.quadraticCurveTo(cx, B - h * 0.14, L, B); ctx.closePath(); ctx.fill(); ctx.fillStyle = g.rgba(color, 0.08); ctx.fill(); ctx.restore();
        tl([[L, T], [cx, T - h * 0.07], [Rr, T]], color, lw); tl([[Rr, T], [Rr, B]], color, lw); tl([[Rr, B], [cx, B - h * 0.07], [L, B]], color, lw); tl([[L, B], [L, T]], color, lw);
      };
      const lab = (s, y, o = {}) => tz(String(s).toUpperCase(), cx, y, F("Oswald", o.size || 26, 500), { sp: o.sp ?? 6, color: o.color, alpha: 0.9 });
      const IW = W - 2 * (FR + 90);
      // con foto: la foto en blanco y negro pegada con cinta arriba, en su zona; la pizarra queda limpia detrás del texto
      const zona = ph ? { x: FR + 66, y: story ? 250 : FR + 54, w: W - 2 * (FR + 66), h: Math.round(H * (story ? 0.24 : d.kind === "verse" ? (g.fmt === "cuadrado" ? 0.36 : 0.29) : 0.29)) } : null;
      const top0 = zona ? zona.y + zona.h + 56 : 0;

      if (d.kind === "card") {
        const top = top0 || 110, bot = H - 120;
        const [lead, main] = g.splitHead(limpio(d.headline));
        let items = [];
        for (const k of [1, 0.88, 0.76, 0.66, 0.58, 0.5]) {
          const mf = ajustar(g, main.toUpperCase(), (s) => F("Oswald", s, 700), { maxW: IW, maxLines: 2, start: 190 * k, min: 60, lh: 0.98 });
          const nm = ajustar(g, d.name, (s) => F("Kaushan Script", s), { maxW: IW - 220, maxLines: 2, start: 76 * Math.max(k, 0.6), min: 38, lh: 1.12 });
          const nw = Math.min(IW - 120, Math.max(...nm.lines.map((l) => g.measure(l, nm.font))) + 110), nh = nm.h + nm.size * 0.65;
          const ln = ajustar(g, d.line, (s) => F("Caveat", s, 700), { maxW: IW, maxLines: 2, start: 52, min: 36, lh: 1.1 });
          const ls = 112 * Math.max(k, 0.7);
          items = [
            d.kicker && !zona ? { h: 30, draw: (y) => lab(d.kicker, y + 26, { color: acc }) } : null,
            lead ? { h: ls, gap: 30, draw: (y) => tz(lead.toLowerCase(), cx, y + ls * 0.8, F("Kaushan Script", ls), { color: acc, rotate: -0.05 }) } : null,
            { h: mf.h * 0.92, gap: lead ? 6 : 30, draw: (y) => tzL(mf, cx, y + mf.size * 0.82, { sp: 2 }) },
            { h: nh * 1.42 + 24, gap: 46 * Math.max(k, 0.7), draw: (y) => { cinta(y + nh / 2 + 14, nw, nh, chalk); tzL(nm, cx, y + 14 + nh / 2 - nm.h / 2 + nm.size * 0.85, { color: acc }); } },
            { h: ln.h, gap: 40 * Math.max(k, 0.7), draw: (y) => tzL(ln, cx, y + ln.size * 0.8) },
          ];
          if (altoDe(items) + 120 + 60 <= bot - top) break;
        }
        const sgH = 120, room = bot - top - altoDe(items) - sgH - 130;
        const vs = room > 60 ? ajustar(g, `«${d.verse}»`, (s) => F("Caveat", s, 500), { maxW: IW - 100, maxLines: 4, start: 42, min: 32, lh: 1.15, maxH: room }) : null;
        if (vs) items.push({ h: vs.h + 40, gap: 50, draw: (y) => { tzL(vs, cx, y + vs.size * 0.8, { alpha: 0.88 }); lab(d.ref, y + vs.h + 36, { size: 26, sp: 5, color: acc }); } });
        items.push({ h: sgH, gap: 50, draw: (y) => {
          const sf = ajustar(g, d.signature, (s) => F("Kaushan Script", s), { maxW: IW, maxLines: 1, start: 56, min: 36 });
          tz(d.signature, cx, y + 56, sf.font, { color: chalk });
          const ff = ajustar(g, d.from.toUpperCase(), (s) => F("Oswald", s, 500), { maxW: IW, maxLines: 1, start: 26, min: 18, sp: 4 });
          tz(d.from.toUpperCase(), cx, y + 106, ff.font, { sp: 4, alpha: 0.85 });
        } });
        apilar(items, top, bot, 0.45);
      } else if (d.kind === "ann") {
        const top = top0 || 110, bot = H - 140;
        const dateH = d.date ? 220 : 130, placeF = d.place ? ajustar(g, d.place, (s) => F("Caveat", s, 700), { maxW: IW - 60, maxLines: 2, start: 52, min: 36, lh: 1.08 }) : null;
        const fixedH = (zona ? 0 : 54) + 90 + 50 + dateH + 60 + (placeF ? placeF.h + 50 : 0);
        const tt = ajustar(g, d.title.toUpperCase(), (s) => F("Oswald", s, 700), { maxW: IW, maxLines: 3, start: 124, min: 50, lh: 1.04, maxH: Math.min(d.date ? 400 : 470, bot - top - fixedH) });
        const items = [
          zona ? null : { h: 30, draw: (y) => lab(d.church, y + 26, { size: 24, sp: 5 }) },
          { h: 90, gap: 24, draw: (y) => tz("Le invitamos", cx, y + 70, F("Kaushan Script", 80), { color: acc, rotate: -0.03 }) },
          { h: tt.h * 0.95, gap: 40, draw: (y) => tzL(tt, cx, y + tt.size * 0.82, { sp: 1 }) },
        ];
        if (d.date) {
          // la fecha es el dato clave: va en la cinta; la hora, en tiza simple debajo
          const wf = ajustar(g, cap(d.when), (s) => F("Kaushan Script", s), { maxW: IW - 260, maxLines: 1, start: 66, min: 40 });
          const rw = g.measure(cap(d.when), wf.font) + 120, rh = wf.size * 1.7;
          items.push({ h: dateH, gap: 60, draw: (y) => {
            cinta(y + rh / 2 + 6, rw, rh, acc); tz(cap(d.when), cx, y + 6 + rh / 2 + wf.size * 0.32, wf.font, { color: chalk });
            tz(d.time.toUpperCase(), cx, y + dateH - 12, F("Oswald", 50, 500), { sp: 5, alpha: 0.95 });
          } });
        } else items.push({ h: dateH, gap: 60, draw: (y) => { cinta(y + 62, 560, 116, acc); tz("¡Le esperamos!", cx, y + 86, F("Kaushan Script", 68), { color: chalk }); } });
        if (placeF) items.push({ h: placeF.h, gap: 50, draw: (y) => tzL(placeF, cx, y + placeF.size * 0.8, { alpha: 0.92 }) });
        apilar(items, top, bot, 0.42);
      } else {
        const sq = g.fmt === "cuadrado", top = top0 || (story ? 280 : 100), bot = H - (story ? 320 : 100);
        const items = [];
        if (d.eyebrow) items.push({ h: 28, draw: (y) => lab(d.eyebrow, y + 24, { size: 26, sp: 5 }) });
        if (d.head) { const hd = ajustar(g, d.head, (s) => F("Kaushan Script", s), { maxW: IW, maxLines: zona ? 1 : 2, start: story ? 120 : 100, min: 56, lh: 1.08 }); items.push({ h: hd.h, gap: items.length ? 36 : 0, draw: (y) => tzL(hd, cx, y + hd.size * 0.82, { color: acc, rotate: -0.03 }) }); }
        const refS = short && !zona ? 52 : story ? 42 : 36, rf = ajustar(g, d.ref.toUpperCase(), (s) => F("Oswald", s, 700), { maxW: IW - 260, maxLines: 1, start: refS, min: 24, sp: 4 });
        const rw = Math.max(320, g.measure(d.ref.toUpperCase(), rf.font, rf.sp) + 110), rh = rf.size * 2.4;
        const refItem = { h: rh + 20, gap: short ? 70 : 56, draw: (y) => { cinta(y + rh / 2 + 10, rw, rh, acc); tz(d.ref.toUpperCase(), cx, y + 10 + rh / 2 + rf.size * 0.36, rf.font, { sp: rf.sp, color: chalk }); } };
        const firma = d.firma ? 60 : 0, room = bot - top - altoDe(items) - (items.length ? 56 : 0) - refItem.h - refItem.gap - firma;
        const v = ajustar(g, d.text, (s) => F("Caveat", s, 700), short
          ? { maxW: W * 0.68, maxLines: 5, start: 180, min: 44, lh: 1.02, maxH: Math.min(room, H * 0.5) }
          : { maxW: IW, maxLines: 12, start: story ? 116 : sq ? 100 : 104, min: 44, lh: 1.08, maxH: room });
        items.push({ h: v.h, gap: items.length ? 56 : 0, draw: (y) => tzL(v, cx, y + v.size * 0.78) });
        items.push(refItem);
        apilar(items, top, bot - firma, 0.45);
        if (d.firma) lab(d.church, bot, { size: 24, sp: 5 });
      }
      // la tiza se gasta: puntitos del color de la pizarra encima de todo lo escrito
      ctx.save(); ctx.globalAlpha = th.metal ? 0.3 : 0.85; ctx.fillStyle = ctx.createPattern(tizaTile(th.bg), "repeat"); ctx.fillRect(0, 0, W, H); ctx.restore();
      if (zona) {
        // copia en papel fotográfico, un poco girada, con dos tiras de cinta
        const { x, y, w, h } = zona;
        ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-0.012);
        ctx.save(); ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = 22; ctx.shadowOffsetY = 10; ctx.fillStyle = "#f4f1ea"; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore();
        g.photo(-w / 2 + 14, -h / 2 + 14, w - 28, h - 28, { treat: "bn", focusY: 0.38 });
        g.tape(-w / 2 + 30, -h / 2 + 8, 150, -0.7); g.tape(w / 2 - 30, -h / 2 + 8, 150, 0.7);
        ctx.restore();
      }
      g.grain(0.05);
      // el marco: madera con veta (o aluminio en la pizarra blanca)
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.rect(FR, FR, W - 2 * FR, H - 2 * FR); ctx.fillStyle = th.frame; ctx.fill("evenodd"); ctx.clip("evenodd");
      if (th.metal) {
        ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(0, 0, W, 6); ctx.fillRect(0, 0, 6, H);
        ctx.strokeStyle = "rgba(0,0,0,.2)"; ctx.lineWidth = 2; ctx.strokeRect(FR - 8, FR - 8, W - 2 * FR + 16, H - 2 * FR + 16);
      } else {
        // vetas: líneas largas onduladas, claras y oscuras, a lo largo de cada listón
        for (let i = 0; i < 90; i++) {
          const o = 2 + R() * (FR - 4), side = i % 4, dark = R() < 0.6, len = 0.3 + R() * 0.7, st = R() * (1 - len), amp = 1 + R() * 2.5, ph0 = R() * 6;
          ctx.strokeStyle = dark ? `rgba(0,0,0,${0.12 + R() * 0.2})` : `rgba(255,235,200,${0.05 + R() * 0.09})`; ctx.lineWidth = 0.8 + R() * 1.8; ctx.beginPath();
          const n = 30, horiz = side < 2, Lm = horiz ? W : H;
          for (let s = 0; s <= n; s++) { const t = st + (len * s) / n, a = t * Lm, b = o + Math.sin(t * 9 + ph0) * amp; const X = horiz ? a : side === 2 ? b : W - b, Y = horiz ? (side === 0 ? b : H - b) : a; s ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
          ctx.stroke();
        }
        // ingletes de las esquinas
        ctx.strokeStyle = "rgba(0,0,0,.3)"; ctx.lineWidth = 2; ctx.beginPath(); [[0, 0, FR, FR], [W, 0, W - FR, FR], [0, H, FR, H - FR], [W, H, W - FR, H - FR]].forEach(([a, b, c2, d2]) => { ctx.moveTo(a, b); ctx.lineTo(c2, d2); }); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(0, 0, W, 4);
      }
      ctx.restore();
      ctx.save(); ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 3; ctx.strokeRect(FR + 1.5, FR + 1.5, W - 2 * FR - 3, H - 2 * FR - 3); ctx.restore();
      if (!(d.kind === "verse" && d.firma)) g.logo(W - FR - 40, H - FR - 40 - 56, 56, { white: !th.light, align: "right", alpha: 0.9 });
    },
  });

  // =====================================================================================
  // «Ramita»: tarjeta de papelería impresa en letterpress: algodón grueso, borde hundido, una ramita de olivo impresa en un
  // solo color, la tipografía serif grande y un sello en seco con el logo al pie. Sin títulos en letra de guion.
  E.add({
    id: "man-ramita", name: "Papelería con ramita", family: "manuscrita", fonts: ["Fraunces", "Hanken Grotesk", "Allura"],
    themes: {
      salvia: { name: "Salvia", paper: "#f4f1e8", ink: "#24311e", acc: "#4c6a39" },
      marino: { name: "Marino y oro", paper: "#0f1d40", ink: "#f3ecdc", acc: "#f2c85b", dark: true },
      terracota: { name: "Terracota", paper: "#f7eee2", ink: "#3a2117", acc: "#9b4528" },
      rosa: { name: "Rosa empolvado", paper: "#fbf3ef", ink: "#44242a", acc: "#94485a" },
      lino: { name: "Lino", paper: "#f2ede1", ink: "#232323", acc: "#56653f" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, story = historia(g), sq = d.kind === "verse" && g.fmt === "cuadrado", ph = g.photoOn, short = corto(g), dk = !!th.dark;
      g.paper(th.paper, { fibers: dk ? 0.3 : 0.55, grain: dk ? 0.07 : 0.05, mottle: 0.7 });
      const ink = th.ink, acc = th.acc, M = 120, XR = W - M, IW = XR - M;
      const hiC = dk ? "rgba(255,255,255,.10)" : "rgba(255,255,255,.75)", shC = dk ? "rgba(0,0,0,.45)" : "rgba(0,0,0,.2)";
      // letterpress: la tinta se hunde en el papel y deja un filo claro debajo de cada letra
      const tx = (s, x, y, o = {}) => { g.text(s, x + 1, y + 1.8, { ...o, color: hiC, alpha: 1 }); return g.text(s, x, y, o); };
      const blk = (f, x, o = {}) => ({ h: (f.lines.length - 1) * f.lh + f.size * ((o.asc ?? 0.76) + (o.desc ?? 0.24)), gap: o.gap || 0,
        draw: (y) => f.lines.forEach((l, i) => tx(l, x, y + f.size * (o.asc ?? 0.76) + i * f.lh, { font: f.font, color: o.color || ink, sp: f.sp, alpha: o.alpha })) });
      const capsF = (s, o = {}) => ajustar(g, String(s).toUpperCase(), (z) => F("Hanken Grotesk", z, 700), { maxW: o.maxW || IW, maxLines: o.maxLines || 2, start: o.size || 28, min: 24, lh: 1.4, sp: o.sp ?? 6 });
      const caps = (s, o = {}) => blk(capsF(s, o), M, { color: o.color || acc, gap: o.gap, asc: 0.74, desc: 0.06 });
      const raya = (gap = 30, w = 120) => ({ h: 3, gap, draw: (y) => { ctx.fillStyle = hiC; ctx.fillRect(M + 1, y + 2, w, 3); ctx.fillStyle = acc; ctx.fillRect(M, y, w, 3); } });
      // borde hundido (doble filete sin tinta)
      const hundido = (path, lw = 2) => { ctx.save(); ctx.lineWidth = lw; ctx.translate(-1.2, -1.2); path(); ctx.strokeStyle = shC; ctx.stroke(); ctx.translate(2.4, 2.4); path(); ctx.strokeStyle = hiC; ctx.stroke(); ctx.restore(); };
      hundido(() => { ctx.beginPath(); ctx.rect(46, 46, W - 92, H - 92); });
      hundido(() => { ctx.beginPath(); ctx.rect(58, 58, W - 116, H - 116); }, 1.2);
      // la ramita impresa en un solo color (el gesto de la pieza)
      const ramita = (x0, y0, x1, y1, o = {}) => rama(g, x0, y0, x1, y1, { stroke: acc, lw: o.lw || 3.4, fill: acc, fillAlpha: 1, vein: false, leaves: o.leaves || 9, leafLen: o.leafLen || 78, bend: o.bend ?? -0.14, fruit: dk ? null : null });
      // sello en seco al pie: anillo con el nombre de la iglesia en relieve y el logo impreso al centro
      const sello = (cx, cy, r) => {
        const ring = (rr, w) => hundido(() => { ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); }, w);
        ring(r, 2.4); ring(r * 0.7, 1.6);
        const txt = "IGLESIA DE DIOS E.C. · LA LÍNEA · ", n = [...txt].length, f = F("Hanken Grotesk", r * 0.17, 700);
        [...txt].forEach((ch, i) => {
          const a = -Math.PI / 2 + (i / n) * Math.PI * 2, x = cx + Math.cos(a) * r * 0.85, y = cy + Math.sin(a) * r * 0.85;
          ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2); ctx.font = f; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = shC; ctx.fillText(ch, -1, -1); ctx.fillStyle = hiC; ctx.fillText(ch, 1, 1); ctx.fillStyle = th.paper; ctx.fillText(ch, 0, 0); ctx.restore();
        });
        g.logo(cx, cy - r * 0.32, r * 0.64, { white: dk, align: "center", alpha: 0.92 });
      };
      const SR = story ? 110 : sq ? 84 : 100, seal = () => sello(XR - SR + 6, (story ? H - 300 : H - 70) - SR, SR);
      // con foto: un arco ancho arriba con la foto, y la ramita completa sale de su esquina
      let top = story ? 300 : sq ? 120 : 160, side = 0, under = 0;
      if (ph) {
        const ax = 96, aw = W - 192, ay = story ? 250 : 96, ah = Math.round(H * (story ? 0.25 : sq ? 0.34 : d.kind === "verse" ? 0.32 : 0.3)), ry = Math.min(aw / 2, ah * 0.55);
        const path = (c) => { c.beginPath(); c.moveTo(ax, ay + ah); c.lineTo(ax, ay + ry); c.ellipse(ax + aw / 2, ay + ry, aw / 2, ry, 0, Math.PI, 0); c.lineTo(ax + aw, ay + ah); c.closePath(); };
        g.photo(ax, ay, aw, ah, { treat: "suave", path, focusY: 0.35 });
        ctx.save(); ctx.translate(-10, -10); ctx.scale(1, 1); ctx.restore();
        hundido(() => { const o = 14; ctx.beginPath(); ctx.moveTo(ax - o, ay + ah + o); ctx.lineTo(ax - o, ay + ry); ctx.ellipse(ax + aw / 2, ay + ry, aw / 2 + o, ry + o, 0, Math.PI, 0); ctx.lineTo(ax + aw + o, ay + ah + o); ctx.closePath(); }, 1.6);
        ramita(ax + aw - 250, ay + ah + 46, ax + aw + 70, ay + ah - 190, { leaves: 8, leafLen: 70, bend: 0.18 });
        top = ay + ah + (sq ? 50 : 70);
      } else {
        // sin foto: la ramita entra por la orilla derecha, arriba; el texto de arriba no pasa de su borde
        const y0 = story ? 330 : sq ? 120 : 150;
        ramita(W + 20, y0, W - (sq ? 360 : 420), y0 + (sq ? 120 : 150), { leaves: 9, leafLen: sq ? 64 : 76 });
        side = W - (sq ? 360 : 420) - 60; under = y0 + (sq ? 120 : 150) + 90;
      }

      if (d.kind === "card") {
        const bot = H - 300;
        const [lead, main] = g.splitHead(limpio(d.headline));
        // arriba, al lado de la ramita: la fecha y el saludo en versalitas espaciadas
        const headW = ph ? IW : side - M;
        const items = [d.kicker ? caps(d.kicker, { maxW: headW, maxLines: 1 }) : null];
        const hdF = ajustar(g, `${lead} ${main}`.trim().toUpperCase(), (z) => F("Fraunces", z, 700), { maxW: headW, maxLines: 2, start: 50, min: 34, lh: 1.25, sp: (z) => z * 0.16 });
        items.push(blk(hdF, M, { color: ink, gap: 26, asc: 0.74, desc: 0.06 }));
        items.push(raya(40));
        let nm, ln, vs = null;
        for (const k of [1, 0.88, 0.76, 0.66, 0.56, 0.48]) {
          nm = ajustar(g, d.name, (z) => F("Fraunces", z, 900), { maxW: IW, maxLines: 3, start: 150 * k, min: 56, lh: 1.0 });
          ln = ajustar(g, d.line, (z) => F("Fraunces", z, 400, true), { maxW: IW, maxLines: 2, start: 48 * Math.max(k, 0.8), min: 34, lh: 1.2 });
          if (altoDe(items) + nm.h + ln.h + 90 <= bot - top) break;
        }
        items.push(blk(nm, M - 4, { color: ink, gap: 40, asc: 0.74, desc: 0.2 }), blk(ln, M, { color: ink, gap: 26, alpha: 0.9 }));
        const room = bot - top - altoDe(items) - 110;
        if (room > 90 && d.verse) {
          vs = ajustar(g, `«${d.verse}»`, (z) => F("Fraunces", z, 400, true), { maxW: IW - 120, maxLines: 4, start: 36, min: 28, lh: 1.32, maxH: room - 46 });
          items.push(blk(vs, M, { color: ink, gap: 50, alpha: 0.9 }), caps(d.ref, { gap: 18, maxLines: 1 }));
        }
        apilar(items, top, bot, 0.3);
        // al pie, anclados: la firma (única letra de guion) y el sello en seco
        const sf = ajustar(g, d.signature, (z) => F("Allura", z), { maxW: XR - 2 * SR - M - 40, maxLines: 1, start: 84, min: 50 });
        tx(d.signature, M, H - 170, { font: sf.font, color: ink });
        const ff = capsF(d.from, { maxW: XR - 2 * SR - M - 40, maxLines: 1, size: 26, sp: 3 });
        tx(ff.lines[0], M, H - 112, { font: ff.font, color: acc, sp: ff.sp });
        seal();
      } else if (d.kind === "ann") {
        const bot = H - (ph ? 140 : 260);
        const headW = ph ? IW : side - M;
        const items = [caps("Le invitamos", { maxW: headW, maxLines: 1, size: 30 })];
        const dateH = d.date ? (ph ? 150 : 200) : 0, dq = dateH / 200;
        const pl = d.place ? ajustar(g, d.place, (z) => F("Fraunces", z, 400), { maxW: IW - 2 * SR - 20, maxLines: ph ? 2 : 3, start: 40, min: 30, lh: 1.25 }) : null;
        const fixed = 70 + 47 + (d.date ? dateH + 44 : 110) + (pl ? pl.h + 96 : 0);
        const tt = ajustar(g, d.title, (z) => F("Fraunces", z, 900), { maxW: IW, maxLines: 4, start: 140, min: 50, lh: 1.0, maxH: Math.min(520, bot - top - fixed) });
        items.push(blk(tt, M - 4, { color: ink, gap: Math.max(30, under - top - altoDe(items)), asc: 0.74, desc: 0.2 }), raya(44));
        if (d.date) {
          const df = F("Fraunces", 190 * dq, 900), dw = g.measure(d.day, df);
          items.push({ h: dateH, gap: 44, draw: (y) => {
            tx(d.day, M - 8, y + 172 * dq, { font: df, color: acc });
            const x2 = M + dw + 36, mw = XR - x2;
            const mf = ajustar(g, `de ${d.month}`, (z) => F("Fraunces", z, 400, true), { maxW: mw, maxLines: 1, start: 64, min: 36 });
            tx(`de ${d.month}`, x2, y + 76 * dq, { font: mf.font, color: ink });
            const wf = capsF(`${d.weekday} · ${d.time}`, { maxW: mw, maxLines: 1, size: 30, sp: 4 });
            tx(wf.lines[0], x2, y + 140 * dq, { font: wf.font, color: ink, sp: wf.sp });
          } });
        } else items.push(blk(ajustar(g, "¡Le esperamos!", (z) => F("Fraunces", z, 400, true), { maxW: IW, maxLines: 1, start: 72, min: 44 }), M, { color: acc, gap: 40 }));
        if (pl) items.push(caps("Lugar", { gap: 56, maxLines: 1, size: 26 }), blk(pl, M, { color: ink, gap: 14 }));
        apilar(items, top, bot, 0.3);
        if (!ph) { const cf = capsF(d.church, { maxW: XR - 2 * SR - M - 40, maxLines: 1, size: 26, sp: 3 }); tx(cf.lines[0], M, H - 112, { font: cf.font, color: acc, sp: cf.sp }); }
        seal();
      } else {
        const bot = H - (story ? 320 : sq ? 120 : 150) - (story ? 2 * SR : 0);
        const headW = ph ? IW : side - M;
        const items = [];
        if (d.eyebrow) items.push(caps(d.eyebrow, { maxW: headW, maxLines: 1 }));
        if (d.head) { const hd = ajustar(g, d.head, (z) => F("Fraunces", z, 700), { maxW: ph ? IW : headW, maxLines: ph ? 1 : 2, start: story ? 96 : 80, min: 48, lh: 1.05 }); items.push(blk(hd, M - 2, { color: acc, gap: items.length ? 20 : 0 })); }
        const lowR = story ? 0 : 2 * SR + 20; // el sello ocupa la esquina de abajo
        const refF = capsF(d.ref, { maxW: IW - lowR, maxLines: 1, size: short ? 36 : story ? 32 : 28, sp: 6 });
        if (!items.length && under) items.push({ h: 0, draw: () => {} });
        const vGap = Math.max(items.length ? 60 : 0, under - top - altoDe(items));
        const firmaH = d.firma ? 60 : 0, room = bot - top - altoDe(items) - vGap - refF.h - 60 - firmaH;
        const v = ajustar(g, d.text, (z) => F("Fraunces", z, 400), short
          ? { maxW: W * 0.66, maxLines: 5, start: 140, min: 44, lh: 1.08, maxH: Math.min(room, H * 0.5) }
          : { maxW: IW, maxLines: 12, start: story ? 92 : sq ? 84 : 80, min: 34, lh: 1.16, maxH: room });
        items.push(blk(v, M - 2, { color: ink, gap: vGap, asc: 0.74, desc: 0.24 }), raya(44), blk(refF, M, { color: acc, gap: 22, asc: 0.74, desc: 0.06 }));
        apilar(items, top, bot - firmaH, 0.42);
        if (d.firma) { const cf = capsF(d.church, { maxW: IW - lowR, maxLines: 1, size: 26, sp: 3 }); tx(cf.lines[0], M, story ? H - 300 - 2 * SR - 10 + 2 * SR - 6 : H - (sq ? 96 : 110), { font: cf.font, color: ink, sp: cf.sp, alpha: 0.85 }); }
        seal();
      }
    },
  });

  // =====================================================================================
  // «Marcador»: letra de plumón grueso con resaltador fosforescente detrás de lo importante, como apuntes de clase.
  E.add({
    id: "man-marcador", name: "Marcador y resaltador", family: "manuscrita", fonts: ["Permanent Marker", "Caveat", "Work Sans"],
    themes: {
      amarillo: { name: "Resaltador amarillo", bg: "#fbfaf6", ink: "#161616", hi: "#ffe24a", acc: "#e0482a" },
      marino: { name: "Marino y oro", bg: "#f8f6f0", ink: "#0d1b3d", hi: "#f2c85b", acc: "#2d5fa8" },
      rosa: { name: "Rosa fosforescente", bg: "#fcf9f7", ink: "#1b1b1f", hi: "#ff9ccb", acc: "#c2255c" },
      lima: { name: "Verde lima", bg: "#f9faf4", ink: "#18281f", hi: "#b8ef6a", acc: "#1f7a52" },
      celeste: { name: "Celeste y naranja", bg: "#eaf2f8", ink: "#13233e", hi: "#ffbe5c", acc: "#2d73b8" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F, R } = g, story = historia(g), sq = d.kind === "verse" && g.fmt === "cuadrado", M = 88;
      g.paper(th.bg, { fibers: 0.25, grain: 0.04, mottle: 0.4 });
      const ink = th.ink;
      // con foto: la foto grande arriba (40–50 % del alto) en duotono con el color del resaltador, y el papel rasgado encima
      let top0 = 0, tornY = 0;
      if (g.photoOn) {
        const ph = Math.round(H * (d.kind === "verse" ? (story ? 0.45 : sq ? 0.4 : 0.4) : 0.4));
        if (g.photo(0, 0, W, ph + 30, { treat: "bn", focusY: th.focusY ?? 0.36 })) {
          ctx.save(); ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = th.hi; ctx.globalAlpha = 0.92; ctx.fillRect(0, 0, W, ph + 30);
          ctx.globalCompositeOperation = "screen"; ctx.fillStyle = g.rgba(th.hi, 0.12); ctx.fillRect(0, 0, W, ph + 30); ctx.restore();
          g.torn(ph, th.bg, { amp: 18 }); top0 = ph + 30; tornY = ph;
        }
      }
      // pasada de resaltador detrás de un texto: (x,y) = línea base
      const resaltar = (x, y, w, size, o = {}) => {
        ctx.save(); ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = th.hi; ctx.globalAlpha = o.alpha ?? 0.9;
        const h = size * (o.k ?? 0.6), y0 = y - size * (o.up ?? 0.56), x0 = x - size * 0.14, x1 = x + w + size * 0.16, sk = (R() - 0.5) * size * 0.06, b = h * 0.12;
        // punta biselada del resaltador: los extremos van en diagonal
        ctx.beginPath(); ctx.moveTo(x0 + b, y0 + sk); ctx.lineTo(x1 + b * 0.5, y0 - sk); ctx.lineTo(x1 - b * 0.5, y0 + h - sk); ctx.lineTo(x0 - b * 0.4, y0 + h + sk); ctx.closePath(); ctx.fill();
        // la tinta se carga más en los bordes de cada pasada
        ctx.globalAlpha = 0.28; ctx.fillRect(x0 + b, y0 + sk * 0.5, x1 - x0 - b, h * 0.14); ctx.fillRect(x0, y0 + h * 0.84 + sk * 0.5, x1 - x0 - b, h * 0.14);
        ctx.globalAlpha = 0.18; ctx.fillRect(x1 - size * 0.22, y0, size * 0.18, h); ctx.restore();
      };
      const caps = (s, x, y, o = {}) => g.text(String(s).toUpperCase(), x, y, { font: F("Work Sans", o.size || 20, 600), color: o.color || ink, sp: o.sp ?? 4, align: o.align, alpha: o.alpha ?? 0.85 });
      const logo = (x, y, h, al) => g.logo(x, y, h, { align: al });
      const IW = W - 2 * M;
      // el mismo trazo de resaltador cruza el borde rasgado: une la foto con el papel
      if (tornY) resaltar(M - 40, tornY + 46, W * 0.5, 66, { alpha: 0.9, k: 0.66, up: 0.62 });

      if (d.kind === "card") {
        const top = top0 ? top0 + 40 : 110, bot = H - 200;
        if (!top0) { caps(d.church, M, 110, { size: 24 }); if (d.kicker) g.text(d.kicker, W - M, 116, { font: F("Caveat", 48, 700), color: th.acc, align: "right", rotate: -0.03 }); }
        const [lead, main] = g.splitHead(d.headline);
        // se mide todo; si no cabe (p. ej. con foto y nombre largo) se achica en pasos
        let items = [];
        for (const k of [1, 0.86, 0.74, 0.62, 0.54, 0.47]) {
          const hd = ajustar(g, main.toUpperCase(), (s) => F("Permanent Marker", s), { maxW: IW, maxLines: 2, start: 170 * k, min: 56, lh: 1.02, maxH: (bot - top) * 0.36 });
          const nm = ajustar(g, d.name, (s) => F("Permanent Marker", s), { maxW: IW - 40, maxLines: 2, start: 90 * k, min: 36, lh: 1.32 });
          const ln = ajustar(g, d.line, (s) => F("Caveat", s, 700), { maxW: IW, maxLines: 2, start: 52 * Math.max(k, 0.8), min: 34, lh: 1.05 });
          const ls = 90 * Math.max(k, 0.8);
          items = [
            top0 && d.kicker ? { h: 44, draw: (y) => g.text(d.kicker, M, y + 40, { font: F("Caveat", 48, 700), color: th.acc, rotate: -0.03 }) } : null,
            lead ? { h: ls * 0.87, gap: top0 ? 10 : 30, draw: (y) => g.text(lead, M + 4, y + ls * 0.78, { font: F("Caveat", ls, 700), color: ink, rotate: -0.04 }) } : null,
            { h: hd.h * 0.95, gap: 10, draw: (y) => g.lines(hd.lines, M - 4, y + hd.size * 0.86, hd.lh, { font: hd.font, color: ink, rotate: -0.025 }) },
            { h: nm.h * 0.9, gap: 54 * Math.max(k, 0.8), draw: (y) => nm.lines.forEach((l, i) => { const yy = y + nm.size * 0.86 + i * nm.lh; resaltar(M, yy, g.measure(l, nm.font), nm.size); g.text(l, M, yy, { font: nm.font, color: ink }); }) },
            { h: ln.h, gap: 40 * Math.max(k, 0.8), draw: (y) => g.lines(ln.lines, M, y + ln.size * 0.8, ln.lh, { font: ln.font, color: th.acc }) },
          ];
          if (altoDe(items) + (top0 ? 30 : 190) <= bot - top) break;
        }
        const room = bot - top - altoDe(items) - 90;
        const vs = room > 70 ? ajustar(g, `«${d.verse}»`, (s) => F("Caveat", s, 500), { maxW: IW - 200, maxLines: 4, start: 42, min: 30, lh: 1.12, maxH: room - 50 }) : null;
        if (vs) items.push({ h: vs.h + 46, gap: 44, draw: (y) => { const vy = g.lines(vs.lines, M, y + vs.size * 0.8, vs.lh, { font: vs.font, color: ink }); g.text(`— ${d.ref}`, M, vy + vs.size * 0.6 + 34, { font: F("Caveat", 36, 700), color: th.acc }); } });
        apilar(items, top, bot, 0.45);
        const sf = ajustar(g, d.signature, (s) => F("Caveat", s, 700), { maxW: 560, maxLines: 1, start: 60, min: 40 });
        const sw = g.measure(d.signature, sf.font);
        g.text(d.signature, W - M, H - 128, { font: sf.font, color: ink, align: "right" });
        corazon(g, W - M - sw - 40, H - 146, 30, th.acc, 4);
        const ff = ajustar(g, d.from, (s) => F("Work Sans", s, 500), { maxW: 560, maxLines: 1, start: 26, min: 20 });
        g.text(d.from, W - M, H - 86, { font: ff.font, color: ink, align: "right", alpha: 0.8 });
        logo(M, H - 160, 70, "left");
      } else if (d.kind === "ann") {
        const top = top0 ? top0 + 30 : 110, bot = H - 150;
        if (!top0) caps(d.church, M, 110, { size: 24 });
        const dH = top0 ? 170 : 230, plF = d.place ? ajustar(g, d.place, (s) => F("Work Sans", s, 600), { maxW: IW - 220, maxLines: 3, start: 30, min: 24, lh: 1.32 }) : null;
        const tt = ajustar(g, d.title, (s) => F("Permanent Marker", s), { maxW: IW - 30, maxLines: 4, start: 140, min: 44, lh: 1.24, maxH: Math.min((bot - top) * (d.date ? 0.44 : 0.5), bot - top - (top0 ? 50 : 90) - 40 - (d.date ? dH + 60 : 150) - (plF ? plF.h + 90 : 0)) });
        const items = [
          { h: 50, gap: top0 ? 0 : 40, draw: (y) => g.text("¡Apúntelo!", M, y + 46, { font: F("Caveat", 64, 700), color: th.acc, rotate: -0.04 }) },
          { h: tt.h * 0.92, gap: 40, draw: (y) => tt.lines.forEach((l, i) => { const yy = y + tt.size * 0.9 + i * tt.lh; resaltar(M, yy, g.measure(l, tt.font), tt.size); g.text(l, M, yy, { font: tt.font, color: ink }); }) },
        ];
        if (d.date) {
          items.push({ h: dH, gap: 60, draw: (y) => {
            const q = dH / 230, df = F("Permanent Marker", 220 * q), dw = g.measure(d.day, df);
            g.text(d.day, M - 6, y + 200 * q, { font: df, color: ink, rotate: -0.03 });
            const x2 = M + dw + 40, mf = ajustar(g, d.month.toUpperCase(), (s) => F("Permanent Marker", s), { maxW: W - M - x2, maxLines: 1, start: 80, min: 40 });
            g.text(d.month.toUpperCase(), x2, y + 92 * q, { font: mf.font, color: ink });
            g.text(`${cap(d.weekday)}, ${d.time}`, x2, y + 170 * q, { font: ajustar(g, `${cap(d.weekday)}, ${d.time}`, (s) => F("Caveat", s, 700), { maxW: W - M - x2, maxLines: 1, start: 60, min: 36 }).font, color: th.acc });
          } });
        } else items.push({ h: 100, gap: 50, draw: (y) => g.text("¡No falte!", M, y + 90, { font: F("Permanent Marker", 96), color: th.acc, rotate: -0.03 }) });
        if (plF) { const pl = plF; items.push({ h: pl.h, gap: 54, draw: (y) => { caps("Dónde", M, y + 2, { size: 24, color: th.acc, alpha: 1 }); g.lines(pl.lines, M, y + 36 + pl.size * 0.8, pl.lh, { font: pl.font, color: ink }); } }); }
        apilar(items, top, bot, 0.5);
        logo(W - M, H - 150, 70, "right");
      } else {
        const top = top0 ? top0 + 30 : story ? 280 : sq ? 100 : 120, bot = H - (story ? (top0 ? 270 : 320) : sq ? 90 : 110);
        const items = [];
        if (d.eyebrow) items.push({ h: 22, draw: (y) => caps(d.eyebrow, M, y + 20, { size: 24 }) });
        if (d.head) { const hd = ajustar(g, d.head, (s) => F("Caveat", s, 700), { maxW: IW, maxLines: 2, start: story ? 110 : 92, min: 54, lh: 1.0 }); items.push({ h: hd.h, gap: items.length ? 24 : 0, draw: (y) => g.lines(hd.lines, M, y + hd.size * 0.78, hd.lh, { font: hd.font, color: th.acc, rotate: -0.03 }) }); }
        const firma = d.firma ? 50 : 0, refH = 60, room = bot - top - altoDe(items) - (items.length ? 54 : 0) - refH - 80 - firma;
        const long = d.text.length > 100, [p1, p2] = g.splitVerse(d.text), short = corto(g);
        let body;
        if (long && p2) {
          // texto largo: solo la frase clave en plumón con resaltador; el resto en letra manuscrita normal
          const room2 = room - 40;
          let k1 = null, k2 = null;
          for (const k of [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.42]) {
            k1 = ajustar(g, p1, (s) => F("Permanent Marker", s), { maxW: IW - 20, maxLines: 5, start: (story ? 96 : 84) * k, min: 30, lh: 1.28 });
            k2 = ajustar(g, p2, (s) => F("Caveat", s, 700), { maxW: IW - 10, maxLines: 8, start: (story ? 96 : 84) * Math.min(1, k + 0.2), min: 34, lh: 1.1 });
            if (k1.h + k2.h + 30 <= room2) break;
          }
          body = [
            { h: k1.h * 0.94, draw: (y) => k1.lines.forEach((l, i) => { const yy = y + k1.size * 0.9 + i * k1.lh; resaltar(M, yy, g.measure(l, k1.font), k1.size); g.text(l, M, yy, { font: k1.font, color: ink }); }) },
            { h: k2.h, gap: 30, draw: (y) => g.lines(k2.lines, M, y + k2.size * 0.8, k2.lh, { font: k2.font, color: ink }) },
          ];
          body.lastSize = k2.size * 1.1;
        } else {
          const v = ajustar(g, d.text, (s) => F("Permanent Marker", s), short
            ? { maxW: W * 0.7, maxLines: 5, start: 150, min: 40, lh: 1.26, maxH: Math.min(room, H * 0.5) }
            : { maxW: IW - 20, maxLines: 13, start: story ? 100 : sq ? 110 : 96, min: 34, lh: 1.3, maxH: room });
          // la primera frase va resaltada
          const cut = p2 ? p1.length : d.text.length;
          body = [{ h: v.h * 0.94, draw: (y) => {
            let off = 0;
            v.lines.forEach((l, i) => {
              const yy = y + v.size * 0.9 + i * v.lh, a = off, b = off + l.length;
              if (a < cut) { const hiTxt = l.slice(0, Math.min(l.length, cut - a)).replace(/\s+$/, ""); resaltar(M, yy, g.measure(hiTxt, v.font), v.size); }
              g.text(l, M, yy, { font: v.font, color: ink });
              off = b + 1;
            });
          } }];
          body.lastSize = v.lh;
        }
        body[0].gap = items.length ? 54 : 0;
        items.push(...body);
        // la cita con aire: al menos 0,6 líneas antes
        const rs = short ? 66 : story ? 66 : 58;
        items.push({ h: refH, gap: Math.max(50, body.lastSize * 0.6), draw: (y) => g.text(`— ${d.ref}`, M, y + 50, { font: F("Caveat", rs, 700), color: th.acc }) });
        apilar(items, top, bot - firma, 0.42);
        if (d.firma) caps(d.church, M, bot, { size: 24 });
        else logo(W - M, bot - 64, 64, "right");
      }
    },
  });

  // =====================================================================================
  // «Carta»: una hoja de carta escrita a mano sobre la mesa, con estampilla y matasellos.
  E.add({
    id: "man-carta", name: "Carta a mano", family: "manuscrita", fonts: ["Yellowtail", "Caveat", "Special Elite"],
    themes: {
      kraft: { name: "Kraft y tinta", bg: "#c9b391", paper: "#fbf6ea", ink: "#26294a", acc: "#b8432f" },
      marino: { name: "Marino y oro", bg: "#0d1b3d", paper: "#f7f2e6", ink: "#0d1b3d", acc: "#2d5fa8", stamp: "#f2c85b" },
      pino: { name: "Pino y miel", bg: "#3f5a4a", paper: "#f6f1e4", ink: "#24312a", acc: "#a8661c" },
      rosa: { name: "Rosa y vino", bg: "#e8cec5", paper: "#fffaf4", ink: "#4a2333", acc: "#b84a62" },
      cielo: { name: "Cielo y naranja", bg: "#bcd3e6", paper: "#fffdf7", ink: "#1e3350", acc: "#e2703a" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, story = historia(g), sq = d.kind === "verse" && g.fmt === "cuadrado", ph = g.photoOn, short = corto(g);
      g.paper(th.bg, { fibers: 0.5, grain: 0.06, mottle: 0.9 });
      const P = story ? 90 : 62, ang = -0.012;
      // la hoja, un poco girada
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(ang); ctx.translate(-W / 2, -H / 2);
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.28)"; ctx.shadowBlur = 34; ctx.shadowOffsetY = 14; ctx.fillStyle = th.paper; ctx.fillRect(P, P, W - 2 * P, H - 2 * P); ctx.restore();
      const ink = th.ink, X = P + 90, XR = W - P - 90, IW = XR - X;
      const cav = (w = 500) => (s) => F("Caveat", s, w);
      // letras de máquina de escribir: nunca menos de 24 px
      const typ = (s, x, y, o = {}) => g.text(String(s).toUpperCase(), x, y, { font: F("Special Elite", o.size || 26), color: o.color || th.acc, sp: o.sp ?? 3, align: o.align, alpha: o.alpha ?? 0.95 });
      // estampilla ilustrada (siempre) con dentado y matasellos que no pasa sobre nada más
      const sw = 168, shh = 200, sx = XR - sw + 10, sy = P + 56, stampBot = sy + shh + 30;
      const estampilla = (texto) => {
        ctx.save(); ctx.translate(sx + sw / 2, sy + shh / 2); ctx.rotate(0.05);
        ctx.save(); ctx.shadowColor = "rgba(0,0,0,.15)"; ctx.shadowBlur = 6; ctx.fillStyle = "#fffdf6"; ctx.fillRect(-sw / 2, -shh / 2, sw, shh); ctx.restore();
        ctx.fillStyle = th.paper; for (let x = -sw / 2; x <= sw / 2; x += 17) { [[x, -shh / 2], [x, shh / 2]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 6, 0, Math.PI * 2); ctx.fill(); }); }
        for (let y = -shh / 2; y <= shh / 2; y += 17) { [[-sw / 2, y], [sw / 2, y]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 6, 0, Math.PI * 2); ctx.fill(); }); }
        const iw = sw - 30, ih = shh - 30, stc = th.stamp || th.acc;
        ctx.fillStyle = stc; ctx.fillRect(-iw / 2, -ih / 2, iw, ih);
        // montañas y sol, dibujo de estampilla
        const on = g.lum(stc) > 0.55 ? ink : "#fffdf6";
        ctx.fillStyle = on; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(iw * 0.18, -ih * 0.18, iw * 0.13, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-iw / 2, ih * 0.3); ctx.lineTo(-iw * 0.18, -ih * 0.06); ctx.lineTo(0, ih * 0.12); ctx.lineTo(iw * 0.2, -ih * 0.02); ctx.lineTo(iw / 2, ih * 0.3); ctx.lineTo(iw / 2, ih / 2); ctx.lineTo(-iw / 2, ih / 2); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
        g.text("Q 1", -iw / 2 + 10, -ih / 2 + 28, { font: F("Special Elite", 22), color: on });
        ctx.restore();
        // matasellos: círculo doble y ondas
        const mx = sx - 52, my = sy + shh * 0.6, mr = 74, mc = g.rgba(ink, 0.55);
        g.roughCircle(mx, my, mr, mr, mc, 3, { passes: 1 }); g.roughCircle(mx, my, mr * 0.78, mr * 0.78, mc, 2, { passes: 1 });
        const tf = ajustar(g, texto, (s) => F("Special Elite", s), { maxW: mr * 1.3, maxLines: 1, start: 26, min: 14 });
        g.text(texto, mx, my + tf.size * 0.36, { font: tf.font, color: ink, align: "center", alpha: 0.6, rotate: -0.12 });
        ctx.save(); ctx.strokeStyle = mc; ctx.lineWidth = 3;
        for (let k = 0; k < 4; k++) { ctx.beginPath(); const yy = my - 36 + k * 24; for (let x = sx + 26; x <= sx + sw + 30; x += 6) { const yv = yy + Math.sin((x - sx) / 22 + k) * 7; x === sx + 26 ? ctx.moveTo(x, yv) : ctx.lineTo(x, yv); } ctx.stroke(); }
        ctx.restore();
      };
      // con foto: una copia fotográfica aparte, arriba a la izquierda, sujeta con esquinas de álbum (cálida, sin el color del tema)
      const foto = ph ? { x: X - 16, y: story ? 300 : P + 50, w: Math.round(W * 0.4), h: sq ? 262 : 300 } : null;
      const fotoBot = foto ? foto.y + foto.h + 36 : 0;
      const pegarFoto = () => {
        const { x, y, w, h } = foto;
        ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-0.035);
        ctx.save(); ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6; ctx.fillStyle = "#fffdf8"; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore();
        g.photo(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24, { treat: "calido", focusY: 0.35 });
        ctx.fillStyle = g.rgba(g.mix(ink, "#000000", 0.4), 0.88); const c = 46;
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => { const px = (a * w) / 2 + a * 4, py = (b * h) / 2 + b * 4; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - a * c, py); ctx.lineTo(px, py - b * c); ctx.closePath(); ctx.fill(); });
        ctx.restore();
      };
      // dobleces de la carta: caen en los huecos entre bloques de texto (nunca encima de una línea)
      const pliegues = (ocupado) => {
        const sh0 = P + 20, sh1 = H - P - 20, occ = ocupado.filter(Boolean).map(([a, b]) => [a - 14, b + 14]).sort((p, q) => p[0] - q[0]), libres = [];
        let y = sh0; for (const [a, b] of occ) { if (a > y + 16) libres.push([y, a]); y = Math.max(y, b); } if (sh1 > y + 16) libres.push([y, sh1]);
        [1 / 3, 2 / 3].forEach((t) => {
          const want = P + (H - 2 * P) * t; let best = null, bd = 1e9;
          libres.forEach(([a, b]) => { const yy = Math.max(a + 8, Math.min(b - 8, want)), dd = Math.abs(yy - want); if (dd < bd) { bd = dd; best = yy; } });
          if (best === null || bd > (H - 2 * P) * 0.16) return;
          ctx.fillStyle = "rgba(0,0,0,.045)"; ctx.fillRect(P, best - 10, W - 2 * P, 10); ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.fillRect(P, best, W - 2 * P, 2);
        });
      };
      const pintar = (items) => items.filter(Boolean).forEach((it) => it.draw(it.y));
      const zonas = (items) => items.filter(Boolean).map((it) => [it.y, it.y + it.h]);

      if (d.kind === "card") {
        const fecha = `Quetzaltenango${d.kicker ? ", " + d.kicker : ""}`;
        const fy = foto ? fotoBot + 30 : P + 120;
        const top = foto ? fy + 40 : stampBot + 10, bot = H - P - 210;
        const hd = ajustar(g, d.headline, (s) => F("Yellowtail", s), { maxW: IW, maxLines: 2, start: 170, min: 80, lh: 1.0, maxH: (bot - top) * (foto ? 0.34 : 0.36) });
        const nm = ajustar(g, d.name, cav(700), { maxW: IW - 140, maxLines: 2, start: 76, min: 44, lh: 1.0 });
        const ln = ajustar(g, d.line, cav(), { maxW: IW, maxLines: 2, start: 50, min: 36, lh: 1.05 });
        const items = [
          bloque(g, hd, X - 6, { color: th.acc, asc: 0.8, desc: 0.28, rotate: -0.03 }),
          { h: nm.h * 0.9, gap: 40, draw: (y) => { typ("Para:", X, y + nm.size * 0.7); g.lines(nm.lines, X + 128, y + nm.size * 0.76, nm.lh, { font: nm.font, color: ink }); } },
          bloque(g, ln, X, { color: ink, gap: 30, alpha: 0.9 }),
        ];
        const room = bot - top - altoDe(items) - 100;
        const vs = room > 70 ? ajustar(g, `«${d.verse}»`, cav(), { maxW: IW - 60, maxLines: 5, start: 42, min: 32, lh: 1.08, maxH: room - 10 }) : null;
        if (vs) items.push({ h: vs.h + 40, gap: 44, draw: (y) => { const vy = g.lines(vs.lines, X, y + vs.size * 0.78, vs.lh, { font: vs.font, color: ink, alpha: 0.88 }); typ(d.ref, X, vy + 50); } });
        colocar(items, top, bot, 0.35);
        pliegues([[fy - 44, fy + 12], ...zonas(items), [H - P - 230, H - P]]);
        if (foto) pegarFoto();
        estampilla(d.kicker ? d.kicker.replace(/^(\d+) de (\w{3}).*$/i, "$1 $2").toUpperCase() : "LA LÍNEA");
        g.text(fecha, X, fy, { font: ajustar(g, fecha, cav(), { maxW: foto ? IW : sx - X - 120, maxLines: 1, start: 42, min: 28 }).font, color: ink, alpha: 0.88 });
        pintar(items);
        // despedida
        const sx2 = W / 2 - 20;
        g.text("Con cariño,", sx2, H - P - 186, { font: F("Caveat", 44, 500), color: ink, alpha: 0.88 });
        const sf = ajustar(g, d.signature, (s) => F("Yellowtail", s), { maxW: XR - sx2, maxLines: 1, start: 70, min: 40 });
        g.text(d.signature, sx2, H - P - 112, { font: sf.font, color: ink });
        const ff = ajustar(g, d.from, cav(), { maxW: XR - sx2, maxLines: 1, start: 36, min: 26 });
        g.text(d.from, sx2, H - P - 62, { font: ff.font, color: ink, alpha: 0.85 });
        g.logo(X, H - P - 160, 70, { align: "left", alpha: 0.85 });
      } else if (d.kind === "ann") {
        const qy = foto ? fotoBot + 44 : P + 150, top = foto ? qy + 30 : stampBot + 20, bot = H - P - 200;
        // primero los datos, y el título toma el alto que queda
        const det = (k, v, gap) => { const f = ajustar(g, v, cav(700), { maxW: IW - 190, maxLines: 3, start: 50, min: 34, lh: 1.04 }); return { h: f.h, gap, draw: (y) => { typ(k, X, y + f.size * 0.72); g.lines(f.lines, X + 190, y + f.size * 0.76, f.lh, { font: f.font, color: ink }); } }; };
        const dets = [];
        if (d.date) { dets.push(det("Cuándo", cap(d.when), 50)); dets.push(det("Hora", d.time, 20)); }
        if (d.place) dets.push(det("Dónde", d.place, d.date ? 20 : 50));
        const tt = ajustar(g, d.title, (s) => F("Yellowtail", s), { maxW: IW, maxLines: 3, start: 150, min: 60, lh: 1.02, maxH: Math.min((bot - top) * 0.48, bot - top - 110 - altoDe(dets) - (dets.length ? 50 : 0)) });
        const items = [
          { h: 40, draw: (y) => g.text("con mucho cariño les invitamos a", X, y + 36, { font: F("Caveat", 46, 500), color: ink, alpha: 0.9 }) },
          bloque(g, tt, X - 6, { color: th.acc, asc: 0.8, desc: 0.28, gap: 30, rotate: -0.025 }),
          ...dets,
        ];
        colocar(items, top, bot, 0.4);
        pliegues([[qy - 54, qy + 16], ...zonas(items), [H - P - 210, H - P]]);
        if (foto) pegarFoto();
        estampilla(d.date ? `${d.day} ${d.month.slice(0, 3)}`.toUpperCase() : "LA LÍNEA");
        g.text("Querida iglesia:", X, qy, { font: F("Caveat", 60, 700), color: ink });
        pintar(items);
        const sx2 = W / 2 - 20;
        g.text("¡Les esperamos!", sx2, H - P - 150, { font: F("Caveat", 52, 700), color: ink });
        g.text(d.churchShort, sx2, H - P - 70, { font: F("Yellowtail", 72), color: th.acc });
        g.logo(X, H - P - 150, 70, { align: "left", alpha: 0.85 });
      } else {
        const stampT = story ? "BUENOS DÍAS" : "LA LÍNEA";
        const bot = H - P - (story ? 230 : 90);
        const items = [];
        // al lado de la estampilla va el saludo; con foto, todo va debajo de la foto
        const headW = story || foto ? IW : sx - X - 130;
        if (d.eyebrow) items.push({ h: 34, draw: (y) => g.text(d.eyebrow, X, y + 32, { font: ajustar(g, d.eyebrow, cav(), { maxW: headW, maxLines: 1, start: 42, min: 28 }).font, color: ink, alpha: 0.88 }) });
        if (d.head) { const hd = ajustar(g, d.head, (s) => F("Yellowtail", s), { maxW: headW, maxLines: 2, start: story ? 130 : 100, min: 56, lh: 1.02 }); items.push(bloque(g, hd, X - 4, { color: th.acc, asc: 0.8, desc: 0.28, gap: items.length ? 12 : 0, rotate: -0.03 })); }
        else items.push({ h: 30, draw: (y) => typ("Palabra para hoy", X, y + 28) });
        const headH = altoDe(items);
        const top = foto ? fotoBot + 10 : story ? Math.max(300, stampBot + 10) : P + 60, textTop = Math.max(top + headH + 50, foto ? 0 : stampBot + 30);
        const firma = d.firma ? 50 : 0, room = bot - textTop - 110 - firma;
        const v = ajustar(g, d.text, cav(700), short
          ? { maxW: W * 0.66, maxLines: 5, start: 150, min: 44, lh: 1.04, maxH: Math.min(room, H * 0.5) }
          : { maxW: IW, maxLines: 13, start: story ? 112 : sq ? 112 : 104, min: 42, lh: 1.08, maxH: room });
        const rf = ajustar(g, `— ${d.ref}`, (s) => F("Yellowtail", s), { maxW: IW, maxLines: 1, start: short ? 80 : story ? 76 : 64, min: 40 });
        colocar(items, top, top + headH, 0);
        const vy = textTop + Math.max(0, (room - v.h) * (short ? 0.45 : 0.4)), last = vy + v.size * 0.78 + (v.lines.length - 1) * v.lh;
        const ry = Math.min(last + v.size * 0.4 + 90, bot - firma);
        pliegues([...zonas(items), [vy, last + v.size * 0.3], [ry - rf.size, ry + 10], d.firma ? [bot - 30, bot + 10] : null, foto ? null : [sy, stampBot]]);
        if (foto) pegarFoto();
        estampilla(stampT);
        pintar(items);
        g.lines(v.lines, X, vy + v.size * 0.78, v.lh, { font: v.font, color: ink });
        g.text(`— ${d.ref}`, XR, ry, { font: rf.font, color: th.acc, align: "right" });
        if (d.firma) typ(d.church, X, bot, { size: 24, color: ink, alpha: 0.8 });
      }
      ctx.restore();
    },
  });
})();
