/* Estudio · familia Sagrada: estampitas, grabados de linóleo, himnarios, capillas, vitrales y sellos.
   Ilustraciones planas a una o dos tintas, orlas y letra clásica con versalitas espaciadas. */
(function () {
  "use strict";
  const E = window.K && window.K.EST; if (!E) return;
  const TAU = Math.PI * 2;

  // ===== ayudantes de la familia =====
  const cap = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  // «7 de noviembre» → ["7", "noviembre"]
  const fecha = (k) => { const m = String(k || "").trim().match(/^(\d{1,2})\s+de\s+(.+)$/i); return m ? [m[1], m[2]] : null; };
  const corto = (wd) => String(wd || "").slice(0, 3).toUpperCase();
  // mayúsculas, pero la hora sigue con «a. m.» / «p. m.» en minúscula, como se escribe en español
  const mayus = (s) => String(s || "").toUpperCase().replace(/\b([AP])\.\s?M\./g, (_, a) => a.toLowerCase() + ". m.");
  // versalitas: mayúsculas pequeñas con mucho aire entre letras
  const vers = (g, s, x, y, size, color, o = {}) => g.text(mayus(s), x, y, { font: g.F(o.fam || "Cormorant Garamond", size, o.w || 700), color, sp: size * (o.sp ?? 0.24), align: o.align, alpha: o.alpha });
  const versW = (g, s, size, o = {}) => g.measure(mayus(s), g.F(o.fam || "Cormorant Garamond", size, o.w || 700), size * (o.sp ?? 0.24));
  // versalitas que se achican si no caben
  const versFit = (g, s, x, y, size, color, maxW, o = {}) => { let z = size; while (z > 13 && versW(g, s, z, o) > maxW) z -= 1; vers(g, s, x, y, z, color, o); return z; };
  // parte un texto en líneas con un ancho distinto por línea
  const wrapVar = (g, s, font, wAt) => {
    const words = String(s || "").split(/\s+/).filter(Boolean), out = []; let l = "";
    for (const w of words) { const t = l ? l + " " + w : w; if (g.measure(t, font) > wAt(out.length) && l) { out.push(l); l = w; } else l = t; }
    if (l) out.push(l); return out;
  };
  const altoH = (ctx, font, s = "H") => { ctx.font = font; return ctx.measureText(s).actualBoundingBoxAscent; };
  // equilibra las líneas de un g.fit: mismo número de líneas, pero parejas (sin viudas ni una palabra sola al final)
  const parejo = (g, f, maxW) => {
    if (!f || f.lines.length < 2 || /…$/.test(f.lines[f.lines.length - 1])) return f;
    const s = f.lines.join(" "), n = f.lines.length; let lo = maxW * 0.35, hi = maxW, best = f.lines;
    for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2, l = g.wrap(s, f.font, mid, f.sp || 0); if (l.length <= n) { best = l; hi = mid; } else lo = mid; }
    return { ...f, lines: best };
  };
  const rgbOf = (h) => { h = String(h || "#000").replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0); };
  const oscuro = (g, c) => g.lum(c) < 0.5;

  // el logo: blanco sobre fondo oscuro; a todo color solo en los temas azules; en los demás, a una tinta (la del tema)
  function marca(g, x, y, h, o = {}) {
    if (oscuro(g, o.bg || "#fff")) return g.logo(x, y, h, { white: true, align: o.align, alpha: o.alpha });
    if (o.azul) return g.logo(x, y, h, { align: o.align, alpha: o.alpha });
    const img = g.assets.logo; if (!img || !img.width) return;
    const T = (img._sagTinta = img._sagTinta || {}), key = o.ink || "#000";
    if (!T[key]) {
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x2 = c.getContext("2d");
      x2.drawImage(img, 0, 0); x2.globalCompositeOperation = "source-in"; x2.fillStyle = key; x2.fillRect(0, 0, c.width, c.height); T[key] = c;
    }
    const w = (img.width * h) / img.height, ax = o.align === "left" ? x : o.align === "right" ? x - w : x - w / 2;
    const { ctx } = g; ctx.save(); ctx.globalAlpha = (o.alpha ?? 1) * 0.8; ctx.drawImage(T[key], ax, y, w, h); ctx.restore();
  }

  // ===== dibujos vectoriales planos =====
  function cruz(ctx, cx, cy, h, color, k = 0.15) {
    const w = h * k; ctx.save(); ctx.fillStyle = color;
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
    ctx.fillRect(cx - h * 0.31, cy - h / 2 + h * 0.25, h * 0.62, w);
    ctx.restore();
  }
  // hoja o grano: forma de almendra que nace en x,y hacia ang
  function hoja(ctx, x, y, len, ang, wid) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.45, -wid, len, 0); ctx.quadraticCurveTo(len * 0.45, wid, 0, 0); ctx.fill(); ctx.restore();
  }
  // paloma en vuelo, de perfil, mirando a la izquierda (o.flip la voltea). x,y = centro, s = ancho
  function paloma(ctx, x, y, s, color, o = {}) {
    ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); ctx.scale((o.flip ? -1 : 1) * s / 100, s / 100); ctx.translate(-50, -32);
    ctx.fillStyle = color;
    // ala de atrás (un poco más baja)
    ctx.beginPath(); ctx.moveTo(44, 38); ctx.bezierCurveTo(40, 26, 42, 14, 50, 4); ctx.lineTo(52, 13); ctx.lineTo(57, 7); ctx.lineTo(58, 17); ctx.lineTo(63, 13); ctx.lineTo(62, 24);
    ctx.bezierCurveTo(60, 32, 56, 37, 52, 40); ctx.closePath(); ctx.globalAlpha = o.back ?? 0.55; ctx.fill(); ctx.globalAlpha = 1;
    // cuerpo y ala de adelante
    ctx.beginPath();
    ctx.moveTo(5, 41); ctx.lineTo(14, 36.5);
    ctx.bezierCurveTo(16, 29, 26, 27, 30, 33);
    ctx.bezierCurveTo(36, 38, 45, 40, 53, 38);
    ctx.bezierCurveTo(55, 25, 64, 10, 84, 0);
    ctx.lineTo(80, 10); ctx.lineTo(90, 7); ctx.lineTo(83, 17); ctx.lineTo(93, 16); ctx.lineTo(84, 25); ctx.lineTo(91, 27);
    ctx.bezierCurveTo(81, 36, 73, 40, 66, 42);
    ctx.bezierCurveTo(75, 43, 85, 41, 94, 37);
    ctx.lineTo(99, 46); ctx.lineTo(90, 47); ctx.lineTo(97, 54); ctx.lineTo(86, 53);
    ctx.bezierCurveTo(74, 58, 59, 60, 45, 58);
    ctx.bezierCurveTo(32, 56, 21, 50, 16, 44);
    ctx.closePath(); ctx.fill();
    if (o.eye) { ctx.fillStyle = o.eye; ctx.beginPath(); ctx.arc(20.5, 34.6, 1.7, 0, TAU); ctx.fill(); }
    // ramita de olivo en el pico
    if (o.ramita) {
      ctx.fillStyle = o.ramita; ctx.strokeStyle = o.ramita; ctx.lineWidth = 1.3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(6, 41); ctx.quadraticCurveTo(0, 46, -6, 55); ctx.stroke();
      hoja(ctx, 2, 45, 9, 2.0, 2.6); hoja(ctx, -1, 49, 9, 0.9, 2.6); hoja(ctx, -3, 52, 9, 2.3, 2.6); hoja(ctx, -6, 55, 8, 1.6, 2.4);
    }
    ctx.restore();
  }
  // rama de olivo que nace en x,y y crece hacia ang
  function olivo(ctx, x, y, len, ang, color, o = {}) {
    const bow = o.bow ?? 0.1, n = o.leaves ?? 9;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); if (o.flip) ctx.scale(1, -1);
    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, len * 0.012); ctx.lineCap = "round";
    const P = (t) => [len * t, -4 * bow * len * t * (1 - t)], tan = (t) => Math.atan(-4 * bow * (1 - 2 * t));
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len / 2, -2 * bow * len, len, 0); ctx.stroke();
    for (let i = 0; i < n; i++) {
      const t = 0.14 + (i / (n - 1)) * 0.78, [px, py] = P(t), a = tan(t), side = i % 2 ? 1 : -1;
      hoja(ctx, px, py, len * 0.22 * (1 - t * 0.35), a + side * 0.62, len * 0.05);
      if (o.olives !== false && (i === 2 || i === 5)) { ctx.beginPath(); ctx.ellipse(px + Math.cos(a - side * 1.3) * len * 0.05, py + Math.sin(a - side * 1.3) * len * 0.05, len * 0.03, len * 0.022, a, 0, TAU); ctx.fill(); }
    }
    hoja(ctx, len - 1, 0, len * 0.17, tan(1), len * 0.045);
    ctx.restore();
  }
  // espiga de trigo que nace en x,y y crece hacia ang (−π/2 = hacia arriba)
  function espiga(ctx, x, y, len, ang, color, o = {}) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); if (o.flip) ctx.scale(1, -1);
    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = "round"; ctx.lineWidth = Math.max(1.5, len * 0.013);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, len * (o.bow ?? 0.03), len * 0.96, 0); ctx.stroke();
    if (o.leaf !== false) hoja(ctx, len * 0.2, len * 0.006, len * 0.34, -0.32, len * 0.03);
    const n = o.grains ?? 6;
    for (let i = 0; i < n; i++) {
      const t = 0.5 + (i / n) * 0.42, px = len * t, gl = len * 0.11 * (1 - i * 0.05), gw = len * 0.036;
      for (const side of [-1, 1]) {
        const a = side * 0.48; hoja(ctx, px, 0, gl, a, gw);
        if (o.awns !== false) {
          const tx = px + Math.cos(a) * gl, ty = Math.sin(a) * gl;
          ctx.lineWidth = Math.max(1, len * 0.006); ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + Math.cos(side * 0.3) * len * 0.13, ty + Math.sin(side * 0.3) * len * 0.13); ctx.stroke();
        }
      }
    }
    hoja(ctx, len * 0.9, 0, len * 0.12, 0, len * 0.03);
    ctx.restore();
  }
  // dibuja algo con un contorno de otro color alrededor (para separar un tallado del fondo)
  function conHalo(ctx, dibujo, halo, color, r = 4) {
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ctx.save(); ctx.translate(Math.cos(a) * r, Math.sin(a) * r); dibujo(halo); ctx.restore(); }
    dibujo(color);
  }
  // sol de rayos rectos (triángulos), sin brillo
  function sol(ctx, cx, cy, r, color, o = {}) {
    const n = o.rays ?? 24, r0 = r * (o.disc ?? 0.42);
    ctx.save(); ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (o.rot || 0), long = i % 2 === 0, rr = long ? r : r * 0.74, hw = (TAU / n) * (long ? 0.26 : 0.18), ri = r0 * 1.18;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a - hw) * ri, cy + Math.sin(a - hw) * ri); ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); ctx.lineTo(cx + Math.cos(a + hw) * ri, cy + Math.sin(a + hw) * ri); ctx.closePath(); ctx.fill();
    }
    if (o.disc !== 0) { ctx.beginPath(); ctx.arc(cx, cy, r0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // dos anillos entrelazados (bodas)
  function anillos(ctx, cx, cy, r, color, lw) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(cx - r * 0.55, cy, r, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + r * 0.55, cy, r, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  // rombo relleno
  function rombo(ctx, cx, cy, s, color) { ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s, cy); ctx.lineTo(cx, cy + s); ctx.lineTo(cx - s, cy); ctx.closePath(); ctx.fill(); ctx.restore(); }
  // filete de imprenta: raya · rombo · raya
  function filete(ctx, cx, y, w, color, o = {}) {
    ctx.save(); ctx.fillStyle = color; const s = o.s || 7;
    const x0 = o.align === "left" ? cx : cx - w / 2, mid = cx;
    if (o.align === "left") { rombo(ctx, x0 + s, y, s, color); ctx.fillRect(x0 + s * 3, y - 1, w - s * 3, 2); }
    else {
      ctx.fillRect(x0, y - 1, w / 2 - s * 2.6, 2); ctx.fillRect(mid + s * 2.6, y - 1, w / 2 - s * 2.6, 2);
      rombo(ctx, mid, y, s, color); rombo(ctx, mid - s * 1.9, y, s * 0.42, color); rombo(ctx, mid + s * 1.9, y, s * 0.42, color);
    }
    ctx.restore();
  }
  // texto alrededor de un círculo; o.bottom lo escribe por abajo, de izquierda a derecha; o.at = ángulo del centro del texto
  function arcText(g, s, cx, cy, r, font, color, o = {}) {
    const { ctx } = g; ctx.font = font; if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    const sp = o.sp || 0, chars = [...String(s)], ws = chars.map((c) => ctx.measureText(c).width + sp);
    const tot = ws.reduce((a, b) => a + b, 0) - sp, ang = tot / r, at = o.at ?? (o.bottom ? Math.PI / 2 : -Math.PI / 2);
    let a = o.bottom ? at + ang / 2 : at - ang / 2;
    chars.forEach((c, i) => {
      const w = ws[i] - sp, mid = o.bottom ? a - w / 2 / r : a + w / 2 / r;
      if (c.trim()) g.text(c, cx + Math.cos(mid) * r, cy + Math.sin(mid) * r, { font, color, align: "center", baseline: "middle", rotate: o.bottom ? mid - Math.PI / 2 : mid + Math.PI / 2 });
      a += (o.bottom ? -1 : 1) * ws[i] / r;
    });
    return ang;
  }
  // tamaño de letra para que un texto circular no pase de cierto ángulo
  const arcSize = (g, s, r, maxAng, size, fam, w, spK) => { let z = size; while (z > 14 && (g.measure(s, g.F(fam, z, w), z * spK) / r) > maxAng) z -= 1; return z; };
  // motas de papel sobre la tinta (impresión a mano)
  function motas(g, x, y, w, h, color, n, o = {}) {
    const { ctx, R } = g; ctx.save(); ctx.fillStyle = color;
    for (let i = 0; i < n; i++) { ctx.globalAlpha = (o.a ?? 0.5) * (0.4 + R() * 0.6); ctx.beginPath(); ctx.arc(x + R() * w, y + R() * h, (o.r ?? 1.4) * (0.4 + R() * 1.1), 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  // ===== la foto, con tratamientos propios de cada plantilla =====
  // lee la foto en gris, recortada para cubrir w×h, con niveles automáticos y un desenfoque leve que borra las motas sueltas
  function grisFoto(g, w, h, o = {}) {
    const img = g.img; if (!img) return null;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height; if (!iw || !ih) return null;
    const cw = Math.max(1, Math.round(w)), ch = Math.max(1, Math.round(h));
    const c = document.createElement("canvas"); c.width = cw; c.height = ch; const x2 = c.getContext("2d", { willReadFrequently: true });
    const k = Math.max(cw / iw, ch / ih), dw = iw * k, dh = ih * k;
    x2.fillStyle = "#808080"; x2.fillRect(0, 0, cw, ch);
    x2.filter = `grayscale(1) blur(${o.blur ?? 1.2}px)`; x2.drawImage(img, (cw - dw) * (o.focusX ?? 0.5), (ch - dh) * (o.focusY ?? 0.42), dw, dh); x2.filter = "none";
    const id = x2.getImageData(0, 0, cw, ch), px = id.data, n = cw * ch, hist = new Uint32Array(256);
    for (let i = 0; i < px.length; i += 4) hist[px[i]]++;
    let acc = 0, lo = 0, hi = 255;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc <= n * 0.015) lo = v; if (acc <= n * 0.985) hi = v; }
    const span = Math.max(40, hi - lo), L = new Float32Array(n), gm = o.gamma ?? 1;
    for (let i = 0, j = 0; j < n; i += 4, j++) L[j] = Math.pow(clamp((px[i] - lo) / span), gm);
    return { c, x2, id, px, L, cw, ch };
  }
  const ponFoto = (g, G, x, y, w, h, path) => {
    G.x2.putImageData(G.id, 0, 0);
    const { ctx } = g; ctx.save(); if (path) { path(ctx); ctx.clip(); } ctx.drawImage(G.c, x, y, w, h); ctx.restore(); return true;
  };
  // mapa de tonos: la foto pasa por una escala de colores (del más oscuro al más claro). Sirve para duotonos planos.
  function fotoTinta(g, x, y, w, h, stops, o = {}) {
    const G = grisFoto(g, w, h, o); if (!G) return false;
    const S = stops.map(rgbOf), n = S.length - 1, { px, L } = G;
    for (let j = 0, i = 0; j < L.length; j++, i += 4) {
      const t = L[j] * n, k = Math.min(n - 1, Math.floor(t)), f = t - k, A = S[k], B = S[k + 1];
      px[i] = A[0] + (B[0] - A[0]) * f; px[i + 1] = A[1] + (B[1] - A[1]) * f; px[i + 2] = A[2] + (B[2] - A[2]) * f; px[i + 3] = 255;
    }
    return ponFoto(g, G, x, y, w, h, o.path);
  }
  // grabado de líneas: rayas que engordan en las sombras y adelgazan en las luces (no un umbral duro), a dos tintas
  function fotoLineas(g, x, y, w, h, ink, paper, o = {}) {
    const G = grisFoto(g, w, h, { blur: 1.6, ...o }); if (!G) return false;
    const I = rgbOf(ink), P = rgbOf(paper), inkDark = g.lum(ink) < g.lum(paper), per = o.per || 8, { px, L, cw, ch } = G;
    for (let yy = 0; yy < ch; yy++) {
      for (let xx = 0; xx < cw; xx++) {
        const j = yy * cw + xx, i = j * 4;
        let dk = inkDark ? 1 - L[j] : L[j]; dk = 0.05 + dk * 0.86;
        const v = yy / per + 0.22 * Math.sin(xx / 64 + yy / 190), f = v - Math.floor(v), dist = Math.abs(f - 0.5);
        const a = clamp((dk * 0.5 - dist) * per + 0.5);
        px[i] = P[0] + (I[0] - P[0]) * a; px[i + 1] = P[1] + (I[1] - P[1]) * a; px[i + 2] = P[2] + (I[2] - P[2]) * a; px[i + 3] = 255;
      }
    }
    return ponFoto(g, G, x, y, w, h, o.path);
  }
  // la foto recortada para cubrir, con un filtro de canvas (para el medio tono del himnario)
  function fotoFiltro(g, x, y, w, h, filter, o = {}) {
    const img = g.img; if (!img) return false;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height; if (!iw || !ih) return false;
    const k = Math.max(w / iw, h / ih), dw = iw * k, dh = ih * k, { ctx } = g;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.filter = filter;
    ctx.drawImage(img, x + (w - dw) * (o.focusX ?? 0.5), y + (h - dh) * (o.focusY ?? 0.42), dw, dh); ctx.filter = "none";
    if (o.multiply) { ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = o.multiply; ctx.fillRect(x, y, w, h); }
    ctx.restore(); return true;
  }

  // ===== vidrio emplomado: paños irregulares con plomo de grosor variable, 3 tonos por color y veteado =====
  // o.color(cx, cy) → color base del paño; o.cell = ancho aproximado; o.lead = color del plomo
  function vidrios(g, x, y, w, h, o) {
    const { ctx, R } = g, cols = Math.max(1, Math.round(w / (o.cell || 90))), rows = Math.max(1, Math.round(h / (o.cellH || o.cell || 90)));
    const sx = w / cols, sy = h / rows, P = [];
    for (let j = 0; j <= rows; j++) { P[j] = []; for (let i = 0; i <= cols; i++) { const ex = i === 0 || i === cols, ey = j === 0 || j === rows; const jt = o.jit ?? 0.55; P[j][i] = [x + i * sx + (ex ? 0 : (R() - 0.5) * sx * jt), y + j * sy + (ey ? 0 : (R() - 0.5) * sy * jt)]; } }
    const polys = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const a = P[j][i], b = P[j][i + 1], c = P[j + 1][i + 1], d = P[j + 1][i];
      if (R() < (o.split ?? 0.45)) { if (R() < 0.5) polys.push([a, b, c], [a, c, d]); else polys.push([a, b, d], [b, c, d]); } else polys.push([a, b, c, d]);
    }
    const path = (p) => { ctx.beginPath(); p.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); };
    for (const p of polys) {
      const cx = p.reduce((s, q) => s + q[0], 0) / p.length, cy = p.reduce((s, q) => s + q[1], 0) / p.length;
      const base = o.color(cx, cy), r = R(), tone = r < 0.33 ? g.mix(base, "#000", 0.2 + R() * 0.08) : r < 0.66 ? base : g.mix(base, "#fff", 0.12 + R() * 0.08);
      ctx.save(); path(p); ctx.fillStyle = tone; ctx.fill(); ctx.clip();
      // veteado: vetas finas y onduladas dentro del vidrio
      const ang = (R() - 0.5) * 1.2 + (o.veta || 0);
      for (let k = 0; k < 5; k++) {
        ctx.strokeStyle = R() < 0.5 ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.10)"; ctx.lineWidth = 2 + R() * 7;
        const ox = cx + (R() - 0.5) * sx, oy = cy + (R() - 0.5) * sy, L = Math.max(sx, sy) * 1.4, ca = Math.cos(ang), sa = Math.sin(ang);
        ctx.beginPath(); ctx.moveTo(ox - ca * L, oy - sa * L); ctx.quadraticCurveTo(ox + (R() - 0.5) * 30, oy + (R() - 0.5) * 30, ox + ca * L, oy + sa * L); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.save(); ctx.strokeStyle = o.lead; ctx.lineJoin = "round";
    for (const p of polys) { ctx.lineWidth = (o.lw || 4) * (0.7 + R() * 0.8); path(p); ctx.stroke(); }
    ctx.restore();
  }

  // pinta un bloque centrado en vertical entre y0 y y1: cuerpo(y, on) devuelve la y final (con on=false solo mide)
  const centrar = (y0, y1, cuerpo, k = 0.5) => { const h = cuerpo(0, false); return cuerpo(y0 + Math.max(0, (y1 - y0 - h) * k), true); };

  // ================================================================
  // «Estampita»: tarjetita de recuerdo con borde de encaje troquelado, orla fina y medallón ovalado con la paloma.
  // Centrada a propósito, como las estampas impresas. Cada tema tiene su propia tarjeta (crema, rosada, oscura…).
  E.add({
    id: "sag-estampita", name: "Estampita", family: "sagrada", fonts: ["Cormorant Garamond", "Playfair Display"],
    themes: {
      marino: { name: "Marino y oro", bg: "#0d1b3d", paper: "#f5eedc", ink: "#0d1b3d", acc: "#2d5fa8", azul: true },
      vino: { name: "Vino y oro viejo", bg: "#4a1426", paper: "#f3e1d0", ink: "#3d1220", acc: "#9c7431" },
      olivo: { name: "Olivo", bg: "#e4dac0", paper: "#34412a", ink: "#f1ead2", acc: "#cdb978" },
      cielo: { name: "Añil y coral", bg: "#22427a", paper: "#f6efe2", ink: "#17294a", acc: "#c4553f" },
      marfil: { name: "Marfil y sepia", bg: "#5e4630", paper: "#eddcbb", ink: "#3b2c1d", acc: "#87602d" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g;
      const story = d.kind === "verse" && g.fmt === "historia";
      g.paper(th.bg, { fibers: 0.35, grain: 0.06, mottle: oscuro(g, th.bg) ? 0.3 : 0.6 });
      // la tarjeta con borde de encaje (festón) y agujeritos troquelados
      const P = story ? 70 : 54, px = P, py = story ? 150 : P, pw = W - 2 * P, ph = H - (story ? 300 : 2 * P);
      const sc = 13;
      ctx.save(); ctx.beginPath();
      const nx = Math.round(pw / (2 * sc)), ny = Math.round(ph / (2 * sc)), sx = pw / nx, sy = ph / ny;
      ctx.moveTo(px, py);
      for (let i = 0; i < nx; i++) ctx.arc(px + (i + 0.5) * sx, py, sx / 2, Math.PI, 0);
      for (let i = 0; i < ny; i++) ctx.arc(px + pw, py + (i + 0.5) * sy, sy / 2, -Math.PI / 2, Math.PI / 2);
      for (let i = 0; i < nx; i++) ctx.arc(px + pw - (i + 0.5) * sx, py + ph, sx / 2, 0, Math.PI);
      for (let i = 0; i < ny; i++) ctx.arc(px, py + ph - (i + 0.5) * sy, sy / 2, Math.PI / 2, Math.PI * 1.5);
      ctx.closePath();
      ctx.shadowColor = "rgba(0,0,0,.22)"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 6;
      ctx.fillStyle = th.paper; ctx.fill(); ctx.restore();
      ctx.save(); ctx.fillStyle = th.bg;
      const hi = 22, hs = 21;
      for (let x = px + hi; x <= px + pw - hi + 0.1; x += (pw - 2 * hi) / Math.round((pw - 2 * hi) / hs)) for (const yy of [py + hi, py + ph - hi]) { ctx.beginPath(); ctx.arc(x, yy, 4, 0, TAU); ctx.fill(); }
      for (let y = py + hi; y <= py + ph - hi + 0.1; y += (ph - 2 * hi) / Math.round((ph - 2 * hi) / hs)) for (const xx of [px + hi, px + pw - hi]) { ctx.beginPath(); ctx.arc(xx, y, 4, 0, TAU); ctx.fill(); }
      ctx.restore();
      // orla: doble filete con rombos en las esquinas
      const fi = 50, fx = px + fi, fy = py + fi, fw = pw - 2 * fi, fh = ph - 2 * fi;
      ctx.save(); ctx.strokeStyle = th.acc; ctx.lineWidth = 3; ctx.strokeRect(fx, fy, fw, fh); ctx.lineWidth = 1.2; ctx.strokeRect(fx + 9, fy + 9, fw - 18, fh - 18); ctx.restore();
      for (const [cx, cy] of [[fx, fy], [fx + fw, fy], [fx, fy + fh], [fx + fw, fy + fh]]) { rombo(ctx, cx, cy, 15, th.acc); rombo(ctx, cx, cy, 6, th.paper); }
      for (const cy of [fy + fh / 2]) for (const cx of [fx, fx + fw]) { rombo(ctx, cx, cy, 9, th.acc); }
      // la cruz rompe el filete de arriba; el logo, el de abajo
      ctx.fillStyle = th.paper; ctx.fillRect(W / 2 - 30, fy - 8, 60, 26); cruz(ctx, W / 2, fy + 4, 34, th.acc, 0.17);
      const L = 50; ctx.fillStyle = th.paper; ctx.fillRect(W / 2 - 70, fy + fh - 10, 140, 22);
      marca(g, W / 2, fy + fh - L / 2, L, { align: "center", bg: th.paper, ink: th.ink, azul: th.azul });
      const cX = W / 2, IW = fw - 90;
      // la foto va en el tono del tema: del color más oscuro de la tarjeta, al acento, al más claro
      const dkC = g.lum(th.ink) < g.lum(th.paper) ? th.ink : th.paper, ltC = dkC === th.ink ? th.paper : th.ink;
      const tonos = [g.mix(dkC, "#000", 0.15), g.mix(th.acc, dkC, 0.15), g.mix(th.acc, ltC, 0.45), g.mix(ltC, "#fff", 0.3)];
      // medallón ovalado: dibujo a una tinta o la foto
      const medallon = (cy, rx, ry, what) => {
        const path = (c) => { c.beginPath(); c.ellipse(cX, cy, rx, ry, 0, 0, TAU); };
        ctx.save(); ctx.strokeStyle = th.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(cX, cy, rx + 12, ry + 12, 0, 0, TAU); ctx.stroke(); ctx.restore();
        if (g.photoOn && fotoTinta(g, cX - rx, cy - ry, rx * 2, ry * 2, tonos, { path })) {
          ctx.save(); ctx.strokeStyle = th.paper; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cX, cy, rx - 10, ry - 10, 0, 0, TAU); ctx.stroke(); ctx.restore();
          return;
        }
        ctx.save(); path(ctx); ctx.fillStyle = th.acc; ctx.fill(); ctx.restore();
        ctx.save(); ctx.strokeStyle = th.paper; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cX, cy, rx - 12, ry - 12, 0, 0, TAU); ctx.stroke(); ctx.restore();
        what(cy, rx, ry);
      };
      const dove = (cy, rx, ry) => paloma(ctx, cX + rx * 0.05, cy - ry * 0.05, rx * 1.3, th.paper, { eye: th.acc, ramita: th.paper, rot: -0.12, back: 0.6 });
      const foto = g.photoOn;
      if (d.kind === "card") {
        let y = fy + 70;
        if (d.kicker) vers(g, d.kicker, cX, y, 22, th.acc, { align: "center" });
        const rx = foto ? 150 : 142, ry = foto ? 178 : 168, cy = y + 34 + ry;
        medallon(cy, rx, ry, d.occasion === "bodas" ? (c) => { anillos(ctx, cX, c - 10, rx * 0.34, th.paper, 9); olivo(ctx, cX - rx * 0.6, c + rx * 0.62, rx * 1.2, -0.05, th.paper, { leaves: 9, bow: -0.12 }); } : dove);
        const sigY = fy + fh - 96;
        const hd = g.fit(d.headline, (s) => F("Cormorant Garamond", s, 600, true), { maxW: IW, maxLines: 2, start: 112, min: 56, lh: 1.0 });
        const nm = parejo(g, g.fit(d.name.toUpperCase(), (s) => F("Cormorant Garamond", s, 700), { maxW: IW - 40, maxLines: 2, start: 62, min: 32, lh: 1.12, sp: (s) => s * 0.08 }), IW - 40);
        const ln = d.line ? g.fit(d.line, (s) => F("Cormorant Garamond", s, 500, true), { maxW: IW, maxLines: 2, start: 38, min: 26, lh: 1.15 }) : null;
        const top0 = cy + ry + 30, bot0 = sigY - 70;
        const fixed = hd.h + nm.h + 30 + 34 + (ln ? 30 + ln.h : 0);
        const room = bot0 - top0 - fixed - 80;
        const vs = d.verse && room > 60 ? parejo(g, g.fit(`«${d.verse}»`, (s) => F("Cormorant Garamond", s, 500), { maxW: IW - 60, maxLines: 5, start: 34, min: 22, lh: 1.25, maxH: room }), IW - 60) : null;
        centrar(top0, bot0, (y, on) => {
          const T = (fn) => on && fn();
          T(() => g.lines(hd.lines, cX, y + hd.size * 0.72, hd.lh, { font: hd.font, color: th.ink, align: "center" })); y += hd.size * 0.72 + (hd.lines.length - 1) * hd.lh;
          T(() => g.lines(nm.lines, cX, y + 30 + nm.size * 0.9, nm.lh, { font: nm.font, color: th.acc, align: "center", sp: nm.sp })); y += 30 + nm.size * 0.9 + (nm.lines.length - 1) * nm.lh;
          T(() => filete(ctx, cX, y + 36, 220, th.acc)); y += 36;
          if (ln) { T(() => g.lines(ln.lines, cX, y + 34 + ln.size * 0.8, ln.lh, { font: ln.font, color: th.ink, align: "center" })); y += 34 + ln.size * 0.8 + (ln.lines.length - 1) * ln.lh; }
          if (vs) {
            T(() => g.lines(vs.lines, cX, y + 26 + vs.size * 0.9, vs.lh, { font: vs.font, color: th.ink, align: "center", alpha: 0.9 })); y += 26 + vs.size * 0.9 + (vs.lines.length - 1) * vs.lh;
            if (d.ref) { T(() => vers(g, d.ref, cX, y + 40, 17, th.acc, { align: "center" })); y += 40; }
          }
          return y;
        });
        const sg = g.fit(d.signature, (s) => F("Cormorant Garamond", s, 600, true), { maxW: IW, maxLines: 1, start: 42, min: 26 });
        g.text(d.signature, cX, sigY, { font: sg.font, color: th.ink, align: "center" });
        if (d.from) versFit(g, d.from, cX, sigY + 34, 15, th.ink, IW, { align: "center", alpha: 0.8 });
      } else if (d.kind === "ann") {
        let y = fy + 70;
        vers(g, d.date ? "Le invitamos" : d.church, cX, y, 22, th.acc, { align: "center" });
        const rx = foto ? 150 : 128, ry = foto ? 175 : 150, cy = y + 34 + ry;
        medallon(cy, rx, ry, (c) => {
          if (d.date) {
            vers(g, d.weekday, cX, c - 64, 20, th.paper, { align: "center" });
            const dn = g.fit(d.day, (s) => F("Playfair Display", s, 700), { maxW: rx * 1.4, maxLines: 1, start: 136, min: 60 });
            g.text(d.day, cX, c + 38, { font: dn.font, color: th.paper, align: "center" });
            vers(g, d.month, cX, c + 82, 19, th.paper, { align: "center" });
          } else { sol(ctx, cX, c, rx * 0.72, th.paper, { rays: 20, disc: 0 }); ctx.save(); ctx.fillStyle = th.acc; ctx.beginPath(); ctx.arc(cX, c, rx * 0.36, 0, TAU); ctx.fill(); ctx.restore(); cruz(ctx, cX, c, rx * 0.56, th.paper, 0.16); }
        });
        const tail = [];
        if (d.date && foto) tail.push(cap(d.when));
        if (d.time) tail.push(d.time);
        // sin fecha: una línea de apoyo para que el aviso no quede cojo
        const apoyo = !d.date ? "Toda la iglesia está invitada" : "";
        const bottomY = fy + fh - 96, top0 = cy + ry + 30, bot0 = bottomY - 70;
        const pl = d.place ? g.fit(d.place, (s) => F("Cormorant Garamond", s, 600), { maxW: IW, maxLines: 2, start: 36, min: 22, lh: 1.15 }) : null;
        const reserve = (tail.length ? 56 : 0) + (apoyo ? 56 : 0) + (pl ? pl.h + 24 : 0) + 50;
        const t = parejo(g, g.fit(d.title, (s) => F("Cormorant Garamond", s, 700), { maxW: IW, maxLines: 3, start: 112, min: 48, lh: 1.0, maxH: bot0 - top0 - reserve }), IW);
        centrar(top0, bot0, (y, on) => {
          const T = (fn) => on && fn();
          T(() => g.lines(t.lines, cX, y + t.size * 0.8, t.lh, { font: t.font, color: th.ink, align: "center" })); y += t.size * 0.8 + (t.lines.length - 1) * t.lh;
          T(() => filete(ctx, cX, y + 44, 220, th.acc)); y += 44;
          if (tail.length) { y += 58; T(() => g.text(tail.join(" · "), cX, y, { font: F("Cormorant Garamond", 40, 600, true), color: th.ink, align: "center" })); }
          if (apoyo) { y += 62; T(() => g.text(apoyo, cX, y, { font: F("Cormorant Garamond", 42, 500, true), color: th.ink, align: "center" })); }
          if (pl) { y += 20; T(() => g.lines(pl.lines, cX, y + pl.size, pl.lh, { font: pl.font, color: th.acc, align: "center" })); y += pl.size + (pl.lines.length - 1) * pl.lh; }
          return y;
        });
        g.text("¡Les esperamos!", cX, bottomY + 20, { font: F("Cormorant Garamond", 46, 600, true), color: th.ink, align: "center" });
      } else {
        const sq = g.fmt === "cuadrado";
        let y = fy + (story ? 110 : 66);
        // la iglesia sale una sola vez (abajo si hay firma; si no, arriba)
        const top = d.eyebrow || (d.firma ? "" : d.church);
        if (top) vers(g, top, cX, y, sq ? 18 : 20, th.acc, { align: "center" });
        const rx = foto ? (story ? 172 : sq ? 138 : 150) : story ? 150 : sq ? 82 : 104, ry = rx * 1.17, cy = y + 34 + ry;
        medallon(cy, rx, ry, dove);
        y = cy + ry + 20;
        if (d.head) {
          const hd = g.fit(d.head, (s) => F("Cormorant Garamond", s, 600, true), { maxW: IW, maxLines: 2, start: story ? 92 : 66, min: 40, lh: 1.05 });
          y = g.lines(hd.lines, cX, y + 24 + hd.size * 0.75, hd.lh, { font: hd.font, color: th.acc, align: "center" }) + 10;
        }
        const bot = fy + fh - (d.firma ? 110 : 80) - 60;
        const len = d.text.length;
        const v = parejo(g, g.fit(d.text, (s) => F("Cormorant Garamond", s, 600), { maxW: IW, maxLines: 12, start: len < 60 ? 110 : len < 90 ? 96 : story ? 84 : 76, min: 30, lh: 1.16, maxH: bot - y - 40 }), IW);
        const vy0 = y + 30 + Math.max(0, (bot - y - 40 - v.h) / 2) + v.size * 0.78;
        const vy = g.lines(v.lines, cX, vy0, v.lh, { font: v.font, color: th.ink, align: "center" });
        filete(ctx, cX, vy + 44, 180, th.acc);
        vers(g, d.ref, cX, vy + 92, 22, th.acc, { align: "center" });
        if (d.firma) versFit(g, d.church, cX, fy + fh - 52, 15, th.ink, IW, { align: "center", alpha: 0.8 });
      }
    },
  });

  // ================================================================
  // «Grabado»: estampa de linóleo. Un taco entintado con la escena tallada en blanco (el campo con la cruz y el trigo,
  // los anillos con el olivo en las bodas, la paloma en los versículos); el sol en la segunda tinta.
  // Con foto, la foto se talla con rayas que engordan en las sombras. El texto va debajo, alineado a la izquierda.
  E.add({
    id: "sag-grabado", name: "Grabado", family: "sagrada", fonts: ["Fraunces", "Cormorant Garamond"],
    themes: {
      tinta: { name: "Tinta y bermellón", paper: "#efe6d2", ink: "#1f1b17", acc: "#c2442e" },
      marino: { name: "Marino y oro", paper: "#f2ead8", ink: "#0d1b3d", acc: "#f2c85b", azul: true },
      olivo: { name: "Verde olivo", paper: "#ece6d1", ink: "#2e3a22", acc: "#cf7f2e" },
      toro: { name: "Sangre de toro", paper: "#f1e5d3", ink: "#561622", acc: "#e3a63c" },
      noche: { name: "Papel negro", paper: "#17181c", ink: "#eee2c6", acc: "#d9a441" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F, R } = g, M = 90;
      const story = d.kind === "verse" && g.fmt === "historia";
      const claro = !oscuro(g, th.paper);
      g.paper(th.paper, { fibers: 0.55, grain: 0.08, mottle: claro ? 1 : 0.3 });
      const logo = (x, y, h, align) => marca(g, x, y, h, { align, bg: th.paper, ink: th.ink, azul: th.azul });
      // gubiadas horizontales del cielo (más gruesas hacia abajo)
      const gubias = (x, y, w, y1, k0 = 0) => {
        ctx.fillStyle = th.paper; const rows = Math.floor((y1 - y - 20) / 15);
        for (let r = 0; r < rows; r++) {
          const yy = y + 22 + r * 15, k = k0 + (1 - k0) * (r / rows), th0 = 0.8 + k * 3.4;
          let xx = x + 10 + R() * 30;
          while (xx < x + w - 10) {
            const len = 40 + R() * 140, gap = 14 + R() * 40 * (1 - k);
            ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + len / 2, yy - th0 * 0.9, xx + len, yy); ctx.quadraticCurveTo(xx + len / 2, yy + th0 * 0.9, xx, yy); ctx.fill();
            xx += len + gap;
          }
        }
      };
      // surcos tallados del campo
      const surcos = (x, w, y0, y1) => {
        ctx.fillStyle = th.paper;
        for (let r = 0; r < 8; r++) {
          const yy = y0 + 14 + r * ((y1 - y0) / 8);
          for (let xx = x + R() * 20; xx < x + w; xx += 10 + R() * 18) { const l = 3 + R() * 8 + r * 1.5; ctx.fillRect(xx, yy, l, 1.4 + r * 0.25); }
        }
      };
      const disco = (x, y, r, c) => { ctx.save(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore(); };
      // el taco: borde irregular, tinta con motas, escena tallada. motivo = campo | bodas | paloma
      const taco = (x, y, w, h, motivo) => {
        const pts = [], step = 22;
        for (let i = 0; i <= w; i += step) pts.push([x + i, y + (R() - 0.5) * 5]);
        for (let i = 0; i <= h; i += step) pts.push([x + w + (R() - 0.5) * 5, y + i]);
        for (let i = w; i >= 0; i -= step) pts.push([x + i, y + h + (R() - 0.5) * 5]);
        for (let i = h; i >= 0; i -= step) pts.push([x + (R() - 0.5) * 5, y + i]);
        const path = (c) => { c.beginPath(); pts.forEach(([a, b], i) => (i ? c.lineTo(a, b) : c.moveTo(a, b))); c.closePath(); };
        if (g.photoOn) {
          ctx.save(); path(ctx); ctx.clip();
          const ok = fotoLineas(g, x - 4, y - 4, w + 8, h + 8, th.ink, th.paper, { per: 8, gamma: 0.8 });
          if (ok) {
            motas(g, x, y, w, h, th.paper, 200, { a: 0.35 });
            ctx.restore();
            // el canto del taco entintado (borde irregular) y el sol en la segunda tinta, sobreimpreso en la esquina
            ctx.save(); path(ctx); ctx.strokeStyle = th.ink; ctx.lineWidth = 5; ctx.stroke(); ctx.restore();
            const sr = Math.min(w, h) * 0.13, sx = x + w - sr * 1.25, sy = y + sr * 0.55;
            ctx.save(); if (claro) ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = 0.92;
            sol(ctx, sx, sy, sr * 1.55, th.acc, { rays: 24, disc: 0 }); disco(sx, sy, sr, th.acc); ctx.restore();
            motas(g, sx - sr, sy - sr, sr * 2, sr * 2, th.paper, 40, { a: 0.4 });
            return;
          }
          ctx.restore();
        }
        ctx.save(); path(ctx); ctx.clip();
        ctx.fillStyle = th.ink; ctx.fillRect(x - 5, y - 5, w + 10, h + 10);
        if (motivo === "bodas") {
          gubias(x, y, w, y + h, 0.2);
          const cx = x + w / 2, cy = y + h * 0.47, rr = h * 0.17;
          disco(cx, cy, h * 0.3, th.ink);
          disco(cx + 6, cy - 4, h * 0.27, th.acc);
          ctx.save(); ctx.globalCompositeOperation = "source-over";
          conHalo(ctx, (c) => anillos(ctx, cx, cy, rr, c, h * 0.04), th.ink, th.paper, 5); ctx.restore();
          for (const s of [-1, 1]) conHalo(ctx, (c) => olivo(ctx, cx + s * h * 0.22, y + h * 0.9, h * 0.62, s < 0 ? -Math.PI + 0.42 : -0.42, c, { leaves: 11, bow: 0.12, flip: s < 0 }), th.ink, th.paper, 4);
        } else if (motivo === "paloma") {
          gubias(x, y, w, y + h * 0.84, 0.1);
          const sx = x + w * 0.7, sy = y + h * 0.42, sr = h * 0.24;
          disco(sx, sy, sr * 1.25, th.ink); disco(sx + 5, sy - 4, sr, th.acc);
          surcos(x, w, y + h * 0.84, y + h);
          const s = Math.min(h * 0.95, w * 0.5);
          conHalo(ctx, (c) => paloma(ctx, x + w * 0.42, y + h * 0.5, s, c, { ramita: c, rot: -0.1, back: c === th.paper ? 0.62 : 1, eye: c === th.paper ? th.ink : null }), th.ink, th.paper, 6);
        } else {
          const hz = y + h * 0.62; // horizonte
          const hill = (xx) => hz - h * 0.06 - Math.sin(((xx - x) / w) * Math.PI * 1.15 + 0.3) * h * 0.1;
          gubias(x, y, w, hz);
          // el sol (segunda tinta) asomando detrás del cerro, con rayos rectos tallados alrededor
          const sx = x + w * 0.66, sy = hill(x + w * 0.66) + h * 0.02, sr = Math.min(w, h) * 0.2;
          disco(sx, sy, sr * 1.7, th.ink);
          sol(ctx, sx, sy, sr * 1.65, th.paper, { rays: 28, disc: 0.62 });
          disco(sx, sy, sr * 0.82, th.ink); disco(sx + 5, sy - 4, sr * 0.7, th.acc);
          // cerro lejano con la cruz
          ctx.fillStyle = th.ink; ctx.beginPath(); ctx.moveTo(x - 5, y + h + 5);
          for (let xx = x - 5; xx <= x + w + 5; xx += 10) ctx.lineTo(xx, hill(xx)); ctx.lineTo(x + w + 5, y + h + 5); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = th.paper; ctx.lineCap = "round";
          for (let k = 0; k < 4; k++) {
            ctx.lineWidth = 5 - k; ctx.beginPath();
            for (let xx = x - 5; xx <= x + w + 5; xx += 10) { const yy = hill(xx) + k * 16 + (k ? Math.sin(xx / 60 + k) * 3 : 0); xx === x - 5 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy); }
            ctx.stroke();
          }
          const cxx = x + w * 0.3, cyy = hill(cxx);
          cruz(ctx, cxx, cyy - h * 0.09, h * 0.18, th.paper, 0.13);
          // campo de abajo: surcos tallados
          const fz = hz + h * 0.12;
          ctx.fillStyle = th.ink; ctx.fillRect(x - 5, fz - 4, w + 10, h);
          surcos(x, w, fz, y + h);
          // trigo en primer plano: sale limpio por abajo, con un canto de tinta que lo separa de los surcos
          const base = y + h + 8, sl = h * 0.6;
          const trigo = (c) => {
            espiga(ctx, x + w * 0.1, base, sl, -Math.PI / 2 + 0.1, c, { grains: 7 });
            espiga(ctx, x + w * 0.15, base, sl * 0.86, -Math.PI / 2 + 0.28, c, { grains: 6, leaf: false });
            espiga(ctx, x + w * 0.9, base, sl * 0.78, -Math.PI / 2 - 0.16, c, { grains: 6, flip: true });
          };
          conHalo(ctx, trigo, th.ink, th.paper, 5);
        }
        motas(g, x, y, w, h, th.paper, 420, { a: 0.5, r: 1.3 });
        ctx.restore();
      };
      const small = (s, x, y, o = {}) => vers(g, s, x, y, o.size || 22, o.color || th.ink, { align: o.align, alpha: o.alpha ?? 0.85, sp: 0.2 });
      const onAcc = g.lum(th.acc) > 0.55 ? "#1b1b1b" : "#fff";
      if (d.kind === "card") {
        const bx = 70, by = 70, bw = W - 140, bh = 470;
        taco(bx, by, bw, bh, d.occasion === "bodas" ? "bodas" : "campo");
        let y = by + bh + 62;
        small(d.church, M, y, { size: 20 }); if (d.kicker) small(d.kicker, W - M, y, { align: "right", alpha: 1 });
        const [lead, main] = g.splitHead(d.headline);
        y += 40;
        if (lead) { const lf = F("Fraunces", 64, 400, true); g.text(lead, M, y + 56, { font: lf, color: th.ink }); y += 56; }
        const big = g.fit(main, (s) => F("Fraunces", s, 900), { maxW: W - 2 * M, maxLines: 2, start: 150, min: 72, lh: 0.98 });
        y = g.lines(big.lines, M - 4, y + big.size * 0.86, big.lh, { font: big.font, color: th.ink });
        const nm = parejo(g, g.fit(d.name, (s) => F("Fraunces", s, 700), { maxW: W - 2 * M - 30, maxLines: 2, start: 54, min: 34, lh: 1.1 }), W - 2 * M - 30);
        y += 30;
        // el nombre en un rótulo de la segunda tinta
        nm.lines.forEach((l, i) => { const yy = y + nm.size * 0.9 + i * (nm.lh + 10), w = g.measure(l, nm.font); ctx.fillStyle = th.acc; ctx.fillRect(M - 14, yy - nm.size * 0.86, w + 28, nm.size * 1.12); g.text(l, M, yy, { font: nm.font, color: onAcc }); });
        y += nm.lines.length * (nm.lh + 10) + nm.size * 0.1;
        const bot = H - 92;
        const sg = g.fit(d.signature, (s) => F("Fraunces", s, 400, true), { maxW: 460, maxLines: 1, start: 36, min: 24 });
        const room = bot - 70 - y;
        if (room > 70) {
          const txt = (d.line ? d.line + ". " : "") + (d.verse ? `«${d.verse}» ${d.ref ? "— " + d.ref : ""}` : "");
          const vs = g.fit(txt, (s) => F("Cormorant Garamond", s, 500), { maxW: W - 2 * M - 120, maxLines: 5, start: 34, min: 22, lh: 1.24, maxH: room });
          g.lines(vs.lines, M, y + 30 + vs.size * 0.8, vs.lh, { font: vs.font, color: th.ink });
        }
        g.text(d.signature, W - M, bot - 34, { font: sg.font, color: th.ink, align: "right" });
        small(d.from, W - M, bot, { align: "right", size: 16 });
        logo(M, bot - 58, 64, "left");
      } else if (d.kind === "ann") {
        const bx = 70, by = 70, bw = W - 140, bh = 540;
        taco(bx, by, bw, bh, "campo");
        // pestaña de calendario montada sobre el taco
        const tw = 210, tH = 230, tx = M, ty = by + bh - 120;
        ctx.save(); ctx.fillStyle = th.paper; ctx.fillRect(tx, ty, tw, tH); ctx.strokeStyle = th.ink; ctx.lineWidth = 4; ctx.strokeRect(tx, ty, tw, tH); ctx.restore();
        ctx.fillStyle = th.acc; ctx.fillRect(tx, ty, tw, 54);
        if (d.date) {
          vers(g, corto(d.weekday), tx + tw / 2, ty + 37, 24, onAcc, { align: "center", sp: 0.3 });
          const dn = g.fit(d.day, (s) => F("Fraunces", s, 900), { maxW: tw - 30, maxLines: 1, start: 120, min: 60 });
          g.text(d.day, tx + tw / 2, ty + 160, { font: dn.font, color: th.ink, align: "center" });
          versFit(g, d.month, tx + tw / 2, ty + 204, 20, th.ink, tw - 24, { align: "center" });
        } else { cruz(ctx, tx + tw / 2, ty + 54 + (tH - 54) / 2, 120, th.ink, 0.15); }
        // un solo rótulo junto al calendario, grande para leerse en miniatura
        small("Le invitamos", tx + tw + 34, by + bh + 64, { size: 28, color: th.acc, alpha: 1 });
        let y = ty + tH + 50;
        const bot = H - 92;
        const pl = d.place ? g.fit(d.place, (s) => F("Cormorant Garamond", s, 600), { maxW: W - 2 * M - 50, maxLines: 2, start: 34, min: 24, lh: 1.15 }) : null;
        const reserve = (d.time ? 56 : 0) + (pl ? pl.h + 24 : 0) + 120;
        const t = parejo(g, g.fit(d.title, (s) => F("Fraunces", s, 900), { maxW: W - 2 * M, maxLines: 3, start: 112, min: 54, lh: 1.0, maxH: bot - reserve - y }), W - 2 * M);
        y = g.lines(t.lines, M - 3, y + t.size * 0.8, t.lh, { font: t.font, color: th.ink });
        if (d.time) { y += 64; g.text(`${cap(d.weekday)}, ${d.time}`, M, y, { font: F("Fraunces", 38, 400, true), color: th.ink }); }
        if (pl) {
          y += 26; ctx.fillStyle = th.acc;
          cruz(ctx, M + 9, y + pl.size * 0.48, 26, th.acc, 0.22);
          g.lines(pl.lines, M + 40, y + pl.size * 0.85, pl.lh, { font: pl.font, color: th.ink });
        }
        g.text("¡Les esperamos!", M, bot, { font: F("Fraunces", 44, 400, true), color: th.ink });
        logo(W - M, bot - 64, 70, "right");
      } else {
        const bh = story ? 760 : g.fmt === "post" ? 520 : 400, by = story ? 200 : 70;
        taco(70, by, W - 140, bh, "paloma");
        let y = by + bh + 70;
        const bot = H - (story ? 280 : 90);
        const top = d.eyebrow || (d.firma ? "" : d.church);
        if (top) small(top, M, y, { size: 20 }); else y -= 20;
        if (d.head) {
          const hd = g.fit(d.head, (s) => F("Fraunces", s, 400, true), { maxW: W - 2 * M, maxLines: 2, start: 72, min: 40, lh: 1.05 });
          y = g.lines(hd.lines, M, y + 26 + hd.size * 0.85, hd.lh, { font: hd.font, color: th.ink }) + 6;
        }
        const room = bot - 80 - (y + 30);
        const v = parejo(g, g.fit(d.text, (s) => F("Fraunces", s, 700), { maxW: W - 2 * M, maxLines: 10, start: d.text.length < 70 ? 96 : story ? 76 : 64, min: 28, lh: 1.14, maxH: room }), W - 2 * M);
        y = g.lines(v.lines, M - 2, y + 34 + v.size * 0.82, v.lh, { font: v.font, color: th.ink });
        y += 64;
        ctx.fillStyle = th.acc; ctx.fillRect(M, y - 14, 70, 6);
        vers(g, d.ref, M + 92, y - 2, 24, th.ink, { sp: 0.2 });
        if (d.firma) small(d.church, W - M, bot, { align: "right", size: 18 });
        else logo(W - M, bot - 56, 56, "right");
      }
    },
  });

  // ================================================================
  // «Himnario»: página de un himnario antiguo. Cabecera con doble filete, rúbricas en la segunda tinta
  // y una letra capitular grande en su caja, con el texto corriendo a su lado. Alineado a la izquierda.
  // Con foto, la foto va como lámina de libro: medio tono sepia dentro de un marco fino.
  E.add({
    id: "sag-himnario", name: "Himnario", family: "sagrada", fonts: ["Cormorant Garamond", "Playfair Display"],
    themes: {
      rubrica: { name: "Tinta y rúbrica", paper: "#f3ead7", ink: "#1e1a16", acc: "#a3262a" },
      marino: { name: "Marino y oro", paper: "#f2ecdf", ink: "#0d1b3d", acc: "#2d5fa8", capBg: "#0d1b3d", capInk: "#f2c85b", azul: true },
      sepia: { name: "Sepia", paper: "#ede0c4", ink: "#3b2a1a", acc: "#8a4b22" },
      verde: { name: "Salterio verde", paper: "#eef0e4", ink: "#1f2a22", acc: "#3f6b46" },
      noche: { name: "Noche y oro", paper: "#1c1b21", ink: "#ece3cf", acc: "#d8b45a" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 96, IW = W - 2 * M;
      const story = d.kind === "verse" && g.fmt === "historia";
      const capBg = th.capBg || th.acc, capInk = th.capInk || th.paper, dk = oscuro(g, th.paper);
      g.paper(th.paper, { fibers: 0.6, grain: 0.08, mottle: dk ? 0.3 : 1.2 });
      if (!dk) g.vignette(0.12, "#5a3a10");
      const logo = (x, y, h) => marca(g, x, y, h, { align: "right", bg: th.paper, ink: th.ink, azul: th.azul });
      const rule = (y, w = 1.5, a = 0.6, c = th.ink) => { ctx.fillStyle = g.rgba(c, a); ctx.fillRect(M, y, IW, w); };
      const cabecera = (y, l, r) => {
        versFit(g, l, M, y, 19, th.ink, r ? IW * 0.6 : IW, { alpha: 0.8 });
        if (r) versFit(g, r, W - M, y, 19, th.acc, IW * 0.38, { align: "right" });
        rule(y + 18, 3, 0.9); rule(y + 26, 1, 0.9);
        return y + 26;
      };
      // la caja de la capitular
      const cajaCap = (x, y, w, h, letter, o = {}) => {
        ctx.fillStyle = capBg; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = capInk; ctx.lineWidth = 2; ctx.strokeRect(x + 8, y + 8, w - 16, h - 16);
        // ramitas en dos esquinas
        ctx.save(); ctx.fillStyle = capInk;
        hoja(ctx, x + 14, y + 14, w * 0.16, 0.78, w * 0.035); hoja(ctx, x + w - 14, y + h - 14, w * 0.16, 0.78 + Math.PI, w * 0.035);
        ctx.restore();
        if (o.draw) { o.draw(x + w / 2, y + h / 2); return; }
        const f = g.fit(letter, (s) => F("Playfair Display", s, 900), { maxW: w * 0.78, maxLines: 1, start: h * 0.86, min: 20 });
        const ah = altoH(ctx, f.font, letter);
        g.text(letter, x + w / 2, y + h / 2 + ah / 2, { font: f.font, color: capInk, align: "center" });
      };
      // párrafo con capitular: el resto de la primera palabra va en versalitas al 70 % (no en mayúsculas plenas).
      // Capitular de 3 líneas; de 2 en los textos cortos. Evita dejar una palabra sola en la última línea.
      const capitular = (text, w, maxH, o = {}) => {
        let rest = String(text || "").trim().replace(/^[«"“]+|[»"”]+$/g, "");
        const pre = (rest.match(/^[¡¿]+/) || [""])[0]; rest = rest.slice(pre.length);
        const letter = [...rest][0] || ""; rest = rest.slice(letter.length);
        const m = rest.match(/^(\S*)([\s\S]*)$/), w1 = m[1], body = (w1 + m[2]).trim();
        const fam = "Cormorant Garamond", lhK = o.lh || 1.28, opts = String(text).length < 60 ? [2] : [3, 2];
        let first = null, best = null, last = null;
        for (let size = o.start; size >= o.min; size -= 2) {
          const font = F(fam, size, o.weight || 500, !!o.italic), lh = size * lhK, ch = altoH(ctx, font);
          const scF = F(fam, size * 0.7, 700), scSp = size * 0.06, scW = w1 ? g.measure(w1.toUpperCase(), scF, scSp) : 0, extra = w1 ? scW - g.measure(w1, font) : 0;
          let cand = null;
          for (const nL of opts) {
            const capH = (nL - 1) * lh + ch, capW = capH * 0.94, gap = size * 0.42;
            const lines = wrapVar(g, body, font, (i) => (i < nL ? w - capW - gap - (i === 0 ? extra : 0) : w));
            if (nL === 3 && lines.length < 3) continue;
            cand = { size, font, lh, ch, capH, capW, gap, lines, h: ch + (Math.max(lines.length, nL) - 1) * lh, nL, scF, scSp, scW };
            break;
          }
          if (!cand) continue;
          last = cand;
          if (cand.h <= maxH && cand.lines.length <= (o.maxLines || 20)) {
            if (!first) first = cand;
            const lw = cand.lines[cand.lines.length - 1];
            if (cand.lines.length < 2 || /\s/.test(lw)) { best = cand; break; }
            if (size < first.size - 14) break;
          }
        }
        const r = best || first || last;
        r.draw = (x, y) => {
          cajaCap(x, y, r.capW, r.capH, letter);
          r.lines.forEach((l, i) => {
            const lx = x + (i < r.nL ? r.capW + r.gap : 0), ly = y + r.ch + i * r.lh;
            if (i === 0 && w1 && l.startsWith(w1)) {
              g.text(w1.toUpperCase(), lx, ly, { font: r.scF, color: th.ink, sp: r.scSp });
              g.text(l.slice(w1.length), lx + r.scW, ly, { font: r.font, color: th.ink });
            } else g.text(l, lx, ly, { font: r.font, color: th.ink });
          });
          return y + r.ch + (r.lines.length - 1) * r.lh;
        };
        return r;
      };
      // la foto como lámina de libro: medio tono sepia (o blanco y negro suave en el tema oscuro) con marco fino
      const lamina = (y, h) => {
        if (!g.photoOn) return y;
        const ok = fotoFiltro(g, M + 16, y + 16, IW - 32, h - 32, dk ? "grayscale(1) contrast(1.02) brightness(.9)" : "grayscale(1) sepia(.6) contrast(1.06) brightness(1.03)", { multiply: dk ? null : th.paper });
        if (!ok) return y;
        ctx.save(); ctx.strokeStyle = g.rgba(th.ink, 0.75); ctx.lineWidth = 1.2; ctx.strokeRect(M + 16, y + 16, IW - 32, h - 32); ctx.lineWidth = 2; ctx.strokeRect(M, y, IW, h); ctx.restore();
        return y + h;
      };
      if (d.kind === "card") {
        const top = 100, bot = H - 96;
        let y = cabecera(top, d.church, d.kicker);
        y = lamina(y + 40, 280);
        y += 46;
        const kp = fecha(d.kicker);
        let numW = 0;
        const nf = F("Playfair Display", 170, 700, true);
        if (kp && !g.photoOn) numW = g.measure(kp[0], nf);
        const tw = IW - (numW ? numW + 50 : 0);
        // el motivo, en una rúbrica roja que se lee (al menos un tercio del nombre)
        const hd = g.fit(d.headline, (s) => F("Cormorant Garamond", s, 600, true), { maxW: tw, maxLines: 2, start: 62, min: 40, lh: 1.02 });
        y = g.lines(hd.lines, M, y + hd.size * 0.8, hd.lh, { font: hd.font, color: th.acc });
        const nm = parejo(g, g.fit(d.name, (s) => F("Cormorant Garamond", s, 700), { maxW: tw, maxLines: 3, start: 96, min: 46, lh: 1.02 }), tw);
        const nmY = y + 16 + nm.size * 0.78;
        if (numW) g.text(kp[0], W - M, nmY, { font: nf, color: th.acc, align: "right" });
        y = g.lines(nm.lines, M - 3, nmY, nm.lh, { font: nm.font, color: th.ink });
        y += 40;
        rule(y, 1, 0.5);
        if (d.line) {
          const ln = g.fit(d.line, (s) => F("Cormorant Garamond", s, 500, true), { maxW: IW, maxLines: 2, start: 40, min: 28, lh: 1.15 });
          y = g.lines(ln.lines, M, y + 30 + ln.size * 0.8, ln.lh, { font: ln.font, color: th.acc });
        }
        const sigTop = bot - 120;
        const room = sigTop - 70 - (y + 36);
        if (d.verse && room > 90) {
          const p = capitular(d.verse, IW, room - 40, { start: 56, min: 26, lh: 1.26 });
          y = p.draw(M, y + 40 + Math.max(0, (room - 60 - p.h) * 0.4));
          if (d.ref) vers(g, d.ref, W - M, y + 54, 19, th.acc, { align: "right" });
        }
        rule(sigTop, 1, 0.5);
        const sg = g.fit(d.signature, (s) => F("Cormorant Garamond", s, 600, true), { maxW: IW - 220, maxLines: 1, start: 42, min: 26 });
        vers(g, "Con cariño", M, sigTop + 46, 16, th.acc);
        g.text(d.signature, M, sigTop + 92, { font: sg.font, color: th.ink });
        if (d.from) versFit(g, d.from, M, sigTop + 124, 15, th.ink, IW - 220, { alpha: 0.8 });
        logo(W - M, sigTop + 34, 76);
      } else if (d.kind === "ann") {
        const top = 100, bot = H - 96;
        let y0 = cabecera(top, d.church, d.date ? cap(d.weekday) : "Aviso");
        y0 = lamina(y0 + 40, 250);
        const bw = 200;
        const pl = d.place ? g.fit(d.place, (s) => F("Cormorant Garamond", s, 500, true), { maxW: IW - 150, maxLines: 2, start: 38, min: 26, lh: 1.15 }) : null;
        const apoyo = !d.date && !pl ? "Toda la iglesia está invitada" : "";
        const dateH = d.date ? bw + 44 : 46;
        const avail = bot - 110 - (y0 + 40) - dateH - (pl ? pl.h + 70 : 0) - (apoyo ? 70 : 0) - 40;
        const t = parejo(g, g.fit(d.title, (s) => F("Cormorant Garamond", s, 700), { maxW: IW, maxLines: 3, start: d.date ? 128 : 144, min: 52, lh: 1.0, maxH: avail }), IW);
        centrar(y0 + 40, bot - 110, (y, on) => {
          const T = (f) => on && f();
          if (d.date) {
            // la fecha: el día en la caja de la capitular; a su lado, el mes y la hora
            T(() => {
              cajaCap(M, y, bw, bw, d.day);
              const tx = M + bw + 40;
              vers(g, "Le invitamos", tx, y + 30, 20, th.acc);
              g.text(`de ${d.month}`, tx, y + 118, { font: F("Cormorant Garamond", 74, 600, true), color: th.ink });
              if (d.time) g.text(`${cap(d.weekday)} · ${d.time}`, tx, y + 178, { font: F("Cormorant Garamond", 40, 500), color: th.ink, alpha: 0.9 });
            });
            y += bw + 26; T(() => rule(y, 1, 0.5)); y += 18;
          } else { T(() => vers(g, "Le invitamos", M, y + 22, 22, th.acc)); y += 46; }
          // el título, grande, justo debajo de la fecha
          T(() => g.lines(t.lines, M - 3, y + t.size * 0.82, t.lh, { font: t.font, color: th.ink })); y += t.size * 0.82 + (t.lines.length - 1) * t.lh;
          if (pl) { y += 70; T(() => { vers(g, "Lugar", M, y, 17, th.acc); g.lines(pl.lines, M + 140, y, pl.lh, { font: pl.font, color: th.ink }); }); y += (pl.lines.length - 1) * pl.lh; }
          if (apoyo) { y += 70; T(() => g.text(apoyo, M, y, { font: F("Cormorant Garamond", 42, 500, true), color: th.acc })); }
          return y;
        }, d.date ? 0.35 : 0.42);
        rule(bot - 76, 1, 0.5);
        g.text("¡Les esperamos!", M, bot - 6, { font: F("Cormorant Garamond", 48, 600, true), color: th.acc });
        logo(W - M, bot - 62, 66);
      } else {
        const top = story ? 250 : 90, bot = H - (story ? 280 : 90);
        let y = cabecera(top, d.eyebrow || (d.firma ? "Palabra de Dios" : d.church), d.ref);
        y = lamina(y + 40, Math.round(H * (story ? 0.22 : 0.2)));
        if (d.head) {
          const hd = g.fit(d.head, (s) => F("Cormorant Garamond", s, 600, true), { maxW: IW, maxLines: 2, start: story ? 84 : 66, min: 40, lh: 1.04 });
          y = g.lines(hd.lines, M, y + 30 + hd.size * 0.8, hd.lh, { font: hd.font, color: th.acc });
        }
        const a0 = y + 50, a1 = bot - 120;
        const p = capitular(d.text, IW, a1 - a0, { start: d.text.length < 60 ? 128 : d.text.length < 90 ? 104 : story ? 92 : g.fmt === "post" ? 76 : 70, min: 28, lh: 1.24, weight: 600 });
        const py = a0 + Math.max(0, (a1 - a0 - p.h) * 0.45);
        y = p.draw(M, py);
        filete(ctx, M, y + 52, 120, th.acc, { align: "left" });
        vers(g, d.ref, M + 140, y + 60, 22, th.acc);
        rule(bot - 46, 1, 0.5);
        if (d.firma) versFit(g, d.church, M, bot, 16, th.ink, IW - 120, { alpha: 0.8 });
        logo(W - M, bot - 34, 44);
      }
    },
  });

  // ================================================================
  // «Capilla»: una ventana ojival a la izquierda, con vidrio de color de verdad (paños emplomados en tres tonos,
  // con veta y algo más claros arriba) y su tracería en oro; el texto en columna a la derecha, centrado frente
  // a la ventana. Con foto, la foto se ve a través de la ventana.
  E.add({
    id: "sag-capilla", name: "Capilla", family: "sagrada", fonts: ["Playfair Display", "Cormorant Garamond"],
    themes: {
      marino: { name: "Marino y oro", bg: "#0d1b3d", win: "#2d5fa8", gold: "#f2c85b", ink: "#f4ecd8", azul: true },
      piedra: { name: "Piedra y nogal", bg: "#e9e2d2", win: "#b8955c", gold: "#6b4d27", ink: "#2a2620" },
      vino: { name: "Vino", bg: "#3e1220", win: "#8a2c3e", gold: "#e0b45c", ink: "#f6e9dc" },
      bosque: { name: "Bosque", bg: "#14291f", win: "#2f6a4a", gold: "#d7b35f", ink: "#f1ead6" },
      adviento: { name: "Adviento", bg: "#2a1b3d", win: "#5a3d84", gold: "#e3c070", ink: "#f3ecf7" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g;
      const story = d.kind === "verse" && g.fmt === "historia", sq = d.kind === "verse" && g.fmt === "cuadrado";
      g.paper(th.bg, { fibers: 0.4, grain: 0.07, mottle: oscuro(g, th.bg) ? 0.3 : 0.8 });
      // la ventana: ancho fijo (38 % de la pieza con su margen), alto máximo 2,6 veces el ancho, centrada en vertical
      const x0 = 80, aw = sq ? 268 : 292, zoneT = story ? 170 : 70, zoneB = H - (story ? 170 : 84);
      const winH = Math.min(zoneB - zoneT, Math.round(aw * 2.6)), top = zoneT + (zoneB - zoneT - winH) / 2, sill = top + winH;
      const ys = top + 0.866 * (aw + 36);
      // contorno de un arco ojival (equilátero) de ancho w apoyado en ys, hasta el fondo b
      const ojiva = (c, x, w, s, b) => { c.beginPath(); c.moveTo(x, b); c.lineTo(x, s); c.arc(x + w, s, w, Math.PI, Math.PI * 4 / 3); c.arc(x, s, w, -Math.PI / 3, 0); c.lineTo(x + w, b); c.closePath(); };
      const bot = sill - 16;
      const lead = g.mix(th.bg, "#000", oscuro(g, th.bg) ? 0.45 : 0.75);
      // vidrio o foto
      ctx.save(); ojiva(ctx, x0, aw, ys, bot); ctx.clip();
      const conFoto = g.photoOn && g.photo(x0, top, aw, bot - top, { treat: "calido", tint: g.rgba(th.win, 0.22), focusX: 0.5 });
      if (!conFoto) {
        ctx.fillStyle = lead; ctx.fillRect(x0, top, aw, bot - top);
        const gold = g.mix(th.gold, th.win, 0.18);
        // paños de vidrio: tres tonos del color, algún paño dorado, y más claros hacia arriba (sin resplandor)
        vidrios(g, x0, top, aw, bot - top, { cell: aw / 4, cellH: 78, jit: 0.32, split: 0.25, lead, lw: 4, veta: Math.PI / 2,
          color: (cx, cy) => { const k = 1 - (cy - top) / (bot - top); const base = g.R() < 0.12 ? gold : th.win; return g.mix(base, "#fff", 0.04 + k * 0.2); } });
      }
      ctx.restore();
      g.grain(0.05);
      // tracería
      const p = 22, w2 = (aw - 3 * p) / 2, s2 = ys + aw * 0.12;
      ctx.save(); ctx.strokeStyle = th.gold; ctx.lineJoin = "round";
      ctx.lineWidth = 4; ojiva(ctx, x0 + p, w2, s2, bot - p); ctx.stroke(); ojiva(ctx, x0 + 2 * p + w2, w2, s2, bot - p); ctx.stroke();
      const ox = x0 + aw / 2, oy = ys - aw * 0.56, orr = aw * 0.15;
      ctx.beginPath(); ctx.arc(ox, oy, orr, 0, TAU); ctx.stroke();
      ctx.lineWidth = 9; ojiva(ctx, x0, aw, ys, bot); ctx.stroke();
      ctx.lineWidth = 2; ojiva(ctx, x0 - 18, aw + 36, ys, bot); ctx.stroke();
      ctx.restore();
      cruz(ctx, ox, oy, orr * 1.3, th.gold, 0.18);
      // repisa
      ctx.fillStyle = th.gold; ctx.fillRect(x0 - 36, sill - 16, aw + 72, 12); ctx.fillRect(x0 - 24, sill, aw + 48, 4);
      // la columna de texto, más ancha; el bloque se centra frente a la ventana
      const tx = x0 + aw + 58, tw = W - 84 - tx, ty0 = story ? 260 : 110, ty1 = H - (story ? 280 : 100);
      const midWin = (top + sill) / 2;
      const frente = (cuerpo) => { const h = cuerpo(0, false); let y = midWin - h / 2; y = Math.max(ty0, Math.min(y, ty1 - h)); return cuerpo(y, true); };
      const small = (s, y, o = {}) => versFit(g, s, tx, y, o.size || 19, o.color || th.gold, tw, { alpha: o.alpha });
      const raya = (y) => { ctx.fillStyle = th.gold; ctx.fillRect(tx, y, 64, 3); };
      const logo = () => marca(g, W - 84, 64, 60, { align: "right", bg: th.bg, ink: th.ink, azul: th.azul });
      if (d.kind === "card") {
        const hd = parejo(g, g.fit(d.headline, (s) => F("Playfair Display", s, 500, true), { maxW: tw, maxLines: 3, start: 96, min: 46, lh: 1.04 }), tw);
        const nm = parejo(g, g.fit(d.name, (s) => F("Cormorant Garamond", s, 700), { maxW: tw, maxLines: 3, start: 80, min: 36, lh: 1.04 }), tw);
        const ln = d.line ? parejo(g, g.fit(d.line, (s) => F("Cormorant Garamond", s, 500, true), { maxW: tw, maxLines: 3, start: 36, min: 24, lh: 1.18 }), tw) : null;
        const sg = g.fit(d.signature, (s) => F("Cormorant Garamond", s, 600, true), { maxW: tw, maxLines: 1, start: 40, min: 24 });
        const room = ty1 - ty0 - (hd.h + nm.h + (ln ? ln.h : 0) + 380);
        const vs = d.verse && room > 80 ? parejo(g, g.fit(`«${d.verse}»`, (s) => F("Cormorant Garamond", s, 500), { maxW: tw, maxLines: 6, start: 34, min: 22, lh: 1.26, maxH: room }), tw) : null;
        frente((y, on) => {
          const T = (f) => on && f();
          if (d.kicker) { T(() => small(d.kicker, y + 20)); y += 20 + 46; }
          T(() => g.lines(hd.lines, tx, y + hd.size * 0.8, hd.lh, { font: hd.font, color: th.gold })); y += hd.size * 0.8 + (hd.lines.length - 1) * hd.lh;
          T(() => g.lines(nm.lines, tx, y + 24 + nm.size * 0.82, nm.lh, { font: nm.font, color: th.ink })); y += 24 + nm.size * 0.82 + (nm.lines.length - 1) * nm.lh;
          T(() => raya(y + 36)); y += 36;
          if (ln) { T(() => g.lines(ln.lines, tx, y + 34 + ln.size * 0.8, ln.lh, { font: ln.font, color: th.ink, alpha: 0.92 })); y += 34 + ln.size * 0.8 + (ln.lines.length - 1) * ln.lh; }
          if (vs) {
            T(() => g.lines(vs.lines, tx, y + 26 + vs.size * 0.9, vs.lh, { font: vs.font, color: th.ink, alpha: 0.85 })); y += 26 + vs.size * 0.9 + (vs.lines.length - 1) * vs.lh;
            if (d.ref) { T(() => small(d.ref, y + 38, { size: 16 })); y += 38; }
          }
          // la firma va con el bloque, no suelta al fondo
          y += 84; T(() => g.text(d.signature, tx, y, { font: sg.font, color: th.ink }));
          if (d.from) { y += 34; T(() => small(d.from, y, { size: 14, color: th.ink, alpha: 0.8 })); }
          return y;
        });
        logo();
      } else if (d.kind === "ann") {
        const pl = d.place ? parejo(g, g.fit(d.place, (s) => F("Cormorant Garamond", s, 600), { maxW: tw - 36, maxLines: 3, start: 32, min: 22, lh: 1.15 }), tw - 36) : null;
        const dateH = d.date ? 260 : 0;
        // título: hasta 3 líneas; si no cabe, se achica la letra
        const t = parejo(g, g.fit(d.title, (s) => F("Cormorant Garamond", s, 700), { maxW: tw, maxLines: 3, start: d.date ? 92 : 108, min: 40, lh: 1.0, maxH: ty1 - ty0 - 200 - dateH - (pl ? pl.h + 40 : 0) }), tw);
        frente((y, on) => {
          const T = (f) => on && f();
          T(() => small("Le invitamos", y + 20)); y += 20;
          if (d.date) {
            // la fecha en grilla: el día a la izquierda; a su derecha, dos líneas alineadas arriba y abajo con el número
            const df = g.fit(d.day, (s) => F("Playfair Display", s, 700, true), { maxW: tw * 0.42, maxLines: 1, start: 180, min: 80 });
            const dw = g.measure(d.day, df.font), asc = altoH(ctx, df.font, d.day), rx = tx + dw + 28, rw = tw - dw - 28;
            const l1 = d.time ? `${d.weekday} · ${d.month}` : d.weekday, l2 = d.time || d.month;
            const z = Math.min(g.fit(l1, (s) => F("Cormorant Garamond", s, 600, true), { maxW: rw, maxLines: 1, start: 46, min: 24 }).size, g.fit(l2, (s) => F("Cormorant Garamond", s, 600), { maxW: rw, maxLines: 1, start: 46, min: 24 }).size);
            const base = y + 34 + asc, f1 = F("Cormorant Garamond", z, 600, true), f2 = F("Cormorant Garamond", z, 600);
            T(() => {
              g.text(d.day, tx - 6, base, { font: df.font, color: th.gold });
              g.text(l1, rx, base - asc + altoH(ctx, f1, "d"), { font: f1, color: th.ink });
              g.text(l2, rx, base, { font: f2, color: th.ink });
            });
            y = base;
          }
          y += 30;
          T(() => g.lines(t.lines, tx, y + 30 + t.size * 0.8, t.lh, { font: t.font, color: th.ink })); y += 30 + t.size * 0.8 + (t.lines.length - 1) * t.lh;
          T(() => raya(y + 38)); y += 38;
          if (pl) { T(() => { cruz(ctx, tx + 10, y + 42 + pl.size * 0.48 - pl.size * 0.85 + 10, 28, th.gold, 0.2); g.lines(pl.lines, tx + 36, y + 40 + pl.size * 0.85 - 6, pl.lh, { font: pl.font, color: th.ink, alpha: 0.92 }); }); y += 40 + pl.size * 0.85 + (pl.lines.length - 1) * pl.lh; }
          else if (!d.date) { T(() => g.text("Toda la iglesia está invitada", tx, y + 56, { font: F("Cormorant Garamond", 36, 500, true), color: th.ink, alpha: 0.92 })); y += 56; }
          y += 96; T(() => g.text("¡Les esperamos!", tx, y, { font: F("Playfair Display", 42, 500, true), color: th.gold }));
          return y;
        });
        logo();
      } else {
        const hd = d.head ? parejo(g, g.fit(d.head, (s) => F("Playfair Display", s, 500, true), { maxW: tw, maxLines: 3, start: story ? 72 : 58, min: 34, lh: 1.08 }), tw) : null;
        const fixed = (hd ? hd.h + 30 : 0) + 160 + (d.firma ? 70 : 0);
        const v = parejo(g, g.fit(d.text, (s) => F("Cormorant Garamond", s, 600), { maxW: tw, maxLines: 14, start: d.text.length < 70 ? 92 : story ? 74 : sq ? 58 : 64, min: 26, lh: 1.16, maxH: ty1 - ty0 - fixed }), tw);
        const top0 = d.eyebrow || (d.firma ? "" : d.church);
        frente((y, on) => {
          const T = (f) => on && f();
          if (top0) { T(() => small(top0, y + 20, { size: 17 })); y += 20; }
          if (hd) { T(() => g.lines(hd.lines, tx, y + 34 + hd.size * 0.8, hd.lh, { font: hd.font, color: th.gold })); y += 34 + hd.size * 0.8 + (hd.lines.length - 1) * hd.lh; }
          T(() => g.lines(v.lines, tx, y + 40 + v.size * 0.8, v.lh, { font: v.font, color: th.ink })); y += 40 + v.size * 0.8 + (v.lines.length - 1) * v.lh;
          T(() => raya(y + 40)); T(() => small(d.ref, y + 86, { size: 22 })); y += 86;
          if (d.firma) { y += 60; T(() => small(d.church, y, { size: 14, color: th.ink, alpha: 0.75 })); }
          return y;
        });
      }
    },
  });

  // ================================================================
  // «Vitral»: la parte de arriba es un ventanal emplomado: una ojiva de paños irregulares (plomo de grosor variable,
  // tres tonos por color, vidrio con veta) con un medallón al centro, y las enjutas en el segundo color.
  // Con foto, la foto llena la ojiva. Debajo, el vidrio claro con el texto centrado en serif de exhibición,
  // y una franja angosta de vidrios alrededor.
  E.add({
    id: "sag-vitral", name: "Vitral", family: "sagrada", fonts: ["DM Serif Display", "Cormorant Garamond"],
    themes: {
      marino: { name: "Marino y oro", lead: "#10141d", c1: "#2d5fa8", c2: "#e7b94f", clear: "#f2eee4", ink: "#0d1b3d", txt: "#2d5fa8", azul: true },
      rubi: { name: "Granate y ámbar", lead: "#1a1214", c1: "#7c2433", c2: "#d39a3e", clear: "#f5ede1", ink: "#2a1418", txt: "#7c2433" },
      esmeralda: { name: "Esmeralda", lead: "#111a15", c1: "#2a6a52", c2: "#cfae55", clear: "#eff0e6", ink: "#132019", txt: "#2a6a52" },
      violeta: { name: "Violeta", lead: "#181220", c1: "#5a3a80", c2: "#d9b25e", clear: "#f3eef3", ink: "#1d1528", txt: "#5a3a80" },
      catedral: { name: "Catedral de noche", lead: "#07090f", c1: "#2c4c7c", c2: "#c49d58", clear: "#141b2e", ink: "#f3ecdc", txt: "#d8b26a" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F, R } = g;
      const story = d.kind === "verse" && g.fmt === "historia", sq = d.kind === "verse" && g.fmt === "cuadrado";
      const b = 34, Lw = 8, dk = oscuro(g, th.clear), cX = W / 2;
      ctx.fillStyle = th.lead; ctx.fillRect(0, 0, W, H);
      // alto del ventanal de arriba
      const yT = Math.round(story ? 640 : sq ? 360 : d.kind === "verse" ? 450 : 470);
      // la ojiva: de lado a lado, con el ápice arriba
      const xl = b + 26, xr = W - b - 26, ya = b + 22, ys = yT - 6;
      const ojiva = new Path2D(); {
        const xc = (xl + xr) / 2, w = xr - xl, h = ys - ya;
        ojiva.moveTo(xl, yT); ojiva.lineTo(xl, ys);
        ojiva.bezierCurveTo(xl, ys - h * 0.7, xc - w * 0.14, ya + h * 0.26, xc, ya);
        ojiva.bezierCurveTo(xc + w * 0.14, ya + h * 0.26, xr, ys - h * 0.7, xr, ys);
        ojiva.lineTo(xr, yT); ojiva.closePath();
      }
      const fuera = new Path2D(); fuera.rect(b, b, W - 2 * b, yT - b); fuera.addPath(ojiva);
      // enjutas en el segundo color
      ctx.save(); ctx.clip(fuera, "evenodd"); vidrios(g, b, b, W - 2 * b, yT - b, { cell: 92, lead: th.lead, lw: 5, color: () => g.mix(th.c2, th.lead, 0.12) }); ctx.restore();
      // la ojiva: la foto, o paños del primer color con un medallón
      ctx.save(); ctx.clip(ojiva);
      const foto = g.photoOn && g.photo(xl, ya, xr - xl, yT - ya, { treat: "calido", focusY: 0.45 });
      if (!foto) {
        vidrios(g, xl, ya, xr - xl, yT - ya, { cell: 104, cellH: 84, lead: th.lead, lw: 5, color: (x, y) => (R() < 0.1 ? g.mix(th.c2, th.c1, 0.3) : g.mix(th.c1, "#fff", 0.1 * (1 - (y - ya) / (yT - ya)))) });
        // medallón: corona de vidrio del segundo color partida en paños, fondo claro y el motivo
        const mr = Math.min((yT - ya) * 0.3, 150), my = ya + (yT - ya) * 0.58;
        ctx.save(); ctx.beginPath(); ctx.arc(cX, my, mr, 0, TAU); ctx.fillStyle = th.c2; ctx.fill(); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.arc(cX, my, mr, 0, TAU); ctx.clip(); vidrios(g, cX - mr, my - mr, mr * 2, mr * 2, { cell: mr * 0.7, lead: th.lead, lw: 4, color: () => th.c2 }); ctx.restore();
        const ir = mr * 0.74;
        ctx.save(); ctx.beginPath(); ctx.arc(cX, my, ir, 0, TAU); ctx.fillStyle = g.mix(th.c1, "#fff", 0.55); ctx.fill(); ctx.restore();
        const cl = g.mix(th.c1, "#fff", 0.55);
        if (d.kind === "verse") conHalo(ctx, (c) => paloma(ctx, cX, my + 4, ir * 1.5, c, { ramita: c, rot: -0.12, back: c === th.lead ? 1 : 0.7, eye: c === th.lead ? null : th.lead }), th.lead, th.c2, 4);
        else if (d.kind === "card" && d.occasion === "bodas") conHalo(ctx, (c) => anillos(ctx, cX, my, ir * 0.42, c, ir * 0.1), th.lead, th.c2, 4);
        else {
          conHalo(ctx, (c) => cruz(ctx, cX, my, ir * 1.3, c, 0.2), th.lead, th.c2, 4);
        }
        ctx.save(); ctx.strokeStyle = th.lead; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(cX, my, ir, 0, TAU); ctx.stroke(); ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(cX, my, mr, 0, TAU); ctx.stroke(); ctx.restore();
        void cl;
      }
      ctx.restore();
      // plomo grueso de la ojiva y el travesaño
      ctx.save(); ctx.strokeStyle = th.lead; ctx.lineWidth = 12; ctx.stroke(ojiva); ctx.restore();
      ctx.save(); ctx.strokeStyle = g.rgba(th.c2, 0.85); ctx.lineWidth = 2.5; ctx.stroke(ojiva); ctx.restore();
      // franja angosta de vidrios a los lados y abajo
      const franja = (x, y, w, h, vertical) => {
        let p = 0; const len = vertical ? h : w; let k = 0;
        while (p < len - 1) {
          const s = Math.min(len - p, 70 + R() * 90), c = k++ % 2 ? th.c1 : th.c2, tone = R() < 0.5 ? g.mix(c, "#000", R() * 0.18) : g.mix(c, "#fff", R() * 0.12);
          ctx.fillStyle = tone; if (vertical) ctx.fillRect(x + 4, y + p + 4, w - 8, s - 8); else ctx.fillRect(x + p + 4, y + 4, s - 8, h - 8);
          p += s;
        }
      };
      franja(0, b, b, H - 2 * b, true); franja(W - b, b, b, H - 2 * b, true); franja(b, H - b, W - 2 * b, b, false); franja(b, 0, W - 2 * b, b, false);
      for (const [x, y] of [[0, 0], [W - b, 0], [0, H - b], [W - b, H - b]]) { ctx.fillStyle = th.c2; ctx.fillRect(x + 5, y + 5, b - 10, b - 10); ctx.fillStyle = th.c1; ctx.fillRect(x + 12, y + 12, b - 24, b - 24); }
      // vidrio claro con algo de veta
      const px0 = b + Lw / 2, py0 = yT + Lw, pw = W - 2 * b - Lw, ph = H - b - py0 - Lw / 2;
      ctx.fillStyle = th.clear; ctx.fillRect(px0, py0, pw, ph);
      ctx.save(); ctx.beginPath(); ctx.rect(px0, py0, pw, ph); ctx.clip();
      for (let i = 0; i < 26; i++) { const yy = py0 + R() * ph; ctx.strokeStyle = dk ? "rgba(255,255,255,.025)" : "rgba(90,70,40,.035)"; ctx.lineWidth = 6 + R() * 26; ctx.beginPath(); ctx.moveTo(px0, yy); ctx.bezierCurveTo(px0 + pw * 0.3, yy + (R() - 0.5) * 60, px0 + pw * 0.7, yy + (R() - 0.5) * 60, px0 + pw, yy + (R() - 0.5) * 40); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = th.lead; ctx.fillRect(b, yT - 2, W - 2 * b, Lw + 4);
      g.grain(0.07);
      // ===== texto, centrado en el vidrio claro =====
      const TW = pw - 150;
      const y0 = Math.max(py0 + 64, story ? 0 : 0), y1 = story ? H - 290 : H - b - 60;
      const DS = (s, w = 400) => F("DM Serif Display", s, w);
      const CG = (s, w = 600, it = false) => F("Cormorant Garamond", s, w, it);
      const small = (s, y, o = {}) => versFit(g, s, cX, y, o.size || 20, o.color || th.txt, o.maxW || TW, { align: "center", alpha: o.alpha });
      // adorno: tres vidrios en losange con plomo
      const adorno = (y) => { for (const [dx, s, c] of [[-34, 9, th.c2], [0, 13, th.c1], [34, 9, th.c2]]) { rombo(ctx, cX + dx, y, s + 3, th.lead); rombo(ctx, cX + dx, y, s, c); } ctx.fillStyle = g.rgba(th.lead, dk ? 0.9 : 0.5); ctx.fillRect(cX - 130, y - 1, 80, 2); ctx.fillRect(cX + 50, y - 1, 80, 2); };
      const logo = (y, h = 56) => marca(g, cX, y, h, { align: "center", bg: th.clear, ink: th.ink, azul: th.azul });
      if (d.kind === "card") {
        const hd = parejo(g, g.fit(d.headline, (s) => DS(s), { maxW: TW, maxLines: 2, start: 124, min: 60, lh: 1.0 }), TW);
        const nm = parejo(g, g.fit(d.name, (s) => CG(s, 600, true), { maxW: TW, maxLines: 2, start: 70, min: 36, lh: 1.06 }), TW);
        const ln = d.line ? g.fit(d.line, (s) => CG(s, 500, true), { maxW: TW, maxLines: 2, start: 36, min: 26, lh: 1.15 }) : null;
        const sigH = 150;
        const room = y1 - sigH - y0 - (40 + hd.h + 60 + nm.h + (ln ? ln.h + 30 : 0)) - 70;
        const vs = d.verse && room > 40 ? parejo(g, g.fit(`«${d.verse}»`, (s) => CG(s, 500), { maxW: TW - 60, maxLines: 3, start: 32, min: 22, lh: 1.22, maxH: room }), TW - 60) : null;
        centrar(y0, y1 - sigH, (y, on) => {
          const T = (f) => on && f();
          if (d.kicker) { T(() => small(d.kicker, y + 16, { size: 22 })); y += 16 + 34; }
          T(() => g.lines(hd.lines, cX, y + hd.size * 0.8, hd.lh, { font: hd.font, color: th.ink, align: "center" })); y += hd.size * 0.8 + (hd.lines.length - 1) * hd.lh;
          T(() => adorno(y + 40)); y += 40;
          T(() => g.lines(nm.lines, cX, y + 26 + nm.size * 0.8, nm.lh, { font: nm.font, color: th.txt, align: "center" })); y += 26 + nm.size * 0.8 + (nm.lines.length - 1) * nm.lh;
          if (ln) { T(() => g.lines(ln.lines, cX, y + 26 + ln.size * 0.8, ln.lh, { font: ln.font, color: th.ink, align: "center" })); y += 26 + ln.size * 0.8 + (ln.lines.length - 1) * ln.lh; }
          if (vs) {
            T(() => g.lines(vs.lines, cX, y + 30 + vs.size * 0.85, vs.lh, { font: vs.font, color: th.ink, align: "center", alpha: 0.85 })); y += 30 + vs.size * 0.85 + (vs.lines.length - 1) * vs.lh;
            if (d.ref) { T(() => small(d.ref, y + 36, { size: 16 })); y += 36; }
          }
          return y;
        }, 0.45);
        const sigY = y1 - sigH + 50;
        const sg = g.fit(d.signature, (s) => CG(s, 600, true), { maxW: TW, maxLines: 1, start: 40, min: 24 });
        g.text(d.signature, cX, sigY, { font: sg.font, color: th.ink, align: "center" });
        if (d.from) small(d.from, sigY + 32, { size: 14, color: th.ink, alpha: 0.8 });
        logo(sigY + 52, 52);
      } else if (d.kind === "ann") {
        const pl = d.place ? parejo(g, g.fit(d.place, (s) => CG(s, 600), { maxW: TW - 40, maxLines: 2, start: 34, min: 24, lh: 1.15 }), TW - 40) : null;
        const dateH = d.date ? 250 : 50;
        const t = parejo(g, g.fit(d.title, (s) => DS(s), { maxW: TW, maxLines: 3, start: 112, min: 50, lh: 1.02, maxH: y1 - y0 - 150 - dateH - (pl ? pl.h + 50 : 0) }), TW);
        centrar(y0, y1 - 110, (y, on) => {
          const T = (f) => on && f();
          T(() => small("Le invitamos", y + 16)); y += 16;
          if (d.date) {
            // fecha centrada: día grande y, a los lados, el día de la semana y el mes
            const df = DS(168), dw = g.measure(d.day, df), asc = altoH(ctx, df, d.day), base = y + 34 + asc;
            const side = (TW - dw) / 2 - 36;
            T(() => {
              g.text(d.day, cX, base, { font: df, color: th.txt, align: "center" });
              versFit(g, d.weekday, cX - dw / 2 - 30, base - asc / 2 + 8, 24, th.ink, side, { align: "right" });
              versFit(g, d.month, cX + dw / 2 + 30, base - asc / 2 + 8, 24, th.ink, side, { align: "left" });
            });
            y = base;
            if (d.time) { T(() => g.text(d.time, cX, y + 60, { font: CG(42, 600, true), color: th.ink, align: "center" })); y += 60; }
          }
          T(() => adorno(y + 44)); y += 44;
          T(() => g.lines(t.lines, cX, y + 36 + t.size * 0.8, t.lh, { font: t.font, color: th.ink, align: "center" })); y += 36 + t.size * 0.8 + (t.lines.length - 1) * t.lh;
          if (pl) { T(() => g.lines(pl.lines, cX, y + 46 + pl.size * 0.85, pl.lh, { font: pl.font, color: th.ink, align: "center", alpha: 0.9 })); y += 46 + pl.size * 0.85 + (pl.lines.length - 1) * pl.lh; }
          else if (!d.date) { T(() => g.text("Toda la iglesia está invitada", cX, y + 56, { font: CG(38, 500, true), color: th.ink, align: "center" })); y += 56; }
          return y;
        }, 0.45);
        g.text("¡Les esperamos!", cX, y1 - 52, { font: CG(48, 600, true), color: th.txt, align: "center" });
        logo(y1 - 30, 48);
      } else {
        const top0 = d.eyebrow || (d.firma ? "" : d.church);
        const hd = d.head ? g.fit(d.head, (s) => CG(s, 600, true), { maxW: TW, maxLines: 2, start: story ? 74 : 58, min: 36, lh: 1.06 }) : null;
        const len = d.text.length;
        const v = parejo(g, g.fit(d.text, (s) => DS(s), { maxW: TW, maxLines: 12, start: len < 60 ? 104 : story ? 76 : sq ? 58 : 64, min: 26, lh: 1.16, maxH: y1 - y0 - (top0 ? 40 : 0) - (hd ? hd.h + 30 : 0) - 120 - (d.firma ? 40 : 0) }), TW);
        centrar(y0, y1 - (d.firma ? 40 : 0), (y, on) => {
          const T = (f) => on && f();
          if (top0) { T(() => small(top0, y + 16, { size: 18, color: th.ink, alpha: 0.75 })); y += 16 + 30; }
          if (hd) { T(() => g.lines(hd.lines, cX, y + hd.size * 0.8, hd.lh, { font: hd.font, color: th.txt, align: "center" })); y += hd.size * 0.8 + (hd.lines.length - 1) * hd.lh + 26; }
          T(() => g.lines(v.lines, cX, y + 10 + v.size * 0.8, v.lh, { font: v.font, color: th.ink, align: "center" })); y += 10 + v.size * 0.8 + (v.lines.length - 1) * v.lh;
          T(() => { adorno(y + 44); small(d.ref, y + 94, { size: 22 }); }); y += 94;
          return y;
        }, 0.45);
        if (d.firma) small(d.church, y1, { size: 15, color: th.ink, alpha: 0.75 });
      }
    },
  });

  // ================================================================
  // «Sello»: un documento con su sello. El texto va alineado a la izquierda, como una carta, y el sello grande
  // (letras alrededor, perlas, corona de trigo y el motivo) está estampado de lado en la esquina de abajo,
  // girado y saliéndose de la hoja; el texto lo esquiva. Con foto, la foto va dentro del sello en duotono plano.
  E.add({
    id: "sag-sello", name: "Sello", family: "sagrada", fonts: ["Playfair Display", "Cormorant Garamond"],
    themes: {
      marino: { name: "Marino y oro", bg: "#0d1b3d", ink: "#f4ecd8", acc: "#f2c85b", azul: true },
      lacre: { name: "Lacre sobre papel", bg: "#f1e8d6", ink: "#2a1d17", acc: "#a42a2a", rot: -0.05 },
      verde: { name: "Verde y oro", bg: "#1e3a2f", ink: "#f1ead6", acc: "#d9b45c" },
      azul: { name: "Tinta azul", bg: "#eef0f2", ink: "#17233a", acc: "#2d5fa8", rot: 0.04, azul: true },
      noche: { name: "Noche", bg: "#161616", ink: "#f2ede2", acc: "#c9a45a" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g;
      const story = d.kind === "verse" && g.fmt === "historia", sq = d.kind === "verse" && g.fmt === "cuadrado";
      const dk = oscuro(g, th.bg);
      // en fondos oscuros el moteado va muy bajo para que no se lea como un resplandor
      g.paper(th.bg, { fibers: 0.5, grain: 0.07, mottle: dk ? 0.3 : 0.9 });
      const M = 90;
      // el sello: radio, centro (se sale por la esquina de abajo a la derecha) y giro
      const Rr = story ? 320 : sq ? 236 : d.kind === "verse" ? 270 : 300;
      const C = { cx: W - (story ? 200 : sq ? 158 : 190), cy: H - (story ? 400 : sq ? 168 : 228), r: Rr + 26 };
      const rot = -0.16 + (th.rot || 0);
      // ancho libre a la derecha de x para una franja vertical [top, bot] que esquiva el sello
      const anchoEn = (x, maxW, top, bot) => { const dy = C.cy < top ? top - C.cy : C.cy > bot ? C.cy - bot : 0; if (dy >= C.r) return maxW; return Math.max(0, Math.min(maxW, C.cx - Math.sqrt(C.r * C.r - dy * dy) - x)); };
      // como g.fit, pero cada línea tiene el ancho que deja el sello a esa altura
      const fitA = (s, fontFn, y, o) => {
        const { maxW = W - 2 * M, start, min, lh: lhK = 1.06, maxLines = 4, maxBot = H, step = 2, x = M } = o;
        let res = null;
        for (let size = start; size >= min; size -= step) {
          const font = fontFn(size), lh = size * lhK;
          const wAt = (i) => { const base = y + size * 0.8 + i * lh; return anchoEn(x, maxW, base - size * 0.78, base + size * 0.24); };
          let lines = wrapVar(g, s, font, wAt);
          const okW = (ls) => ls.every((l, i) => g.measure(l, font) <= wAt(i));
          res = { size, font, lh, lines, h: size * 0.8 + (lines.length - 1) * lh };
          if (lines.length <= maxLines && okW(lines) && y + res.h + size * 0.25 <= maxBot) {
            // líneas parejas: prueba anchos menores mientras no aumenten las líneas
            if (lines.length > 1) { const n = lines.length; for (let k = 0.95; k > 0.5; k -= 0.05) { const l2 = wrapVar(g, s, font, (i) => wAt(i) * k); if (l2.length > n || !okW(l2)) break; const last = l2[l2.length - 1]; lines = l2; if (/\s/.test(last) && g.measure(last, font) > wAt(n - 1) * k * 0.55) break; } res.lines = lines; }
            return res;
          }
        }
        return res;
      };
      // dibuja el sello (después del texto: queda estampado encima)
      const medalla = (arriba, centro, sinTrigo) => {
        const cX = C.cx, cy = C.cy;
        ctx.save(); if (!dk) ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = 0.94;
        ctx.translate(cX, cy); ctx.rotate(rot); ctx.translate(-cX, -cy);
        ctx.fillStyle = th.acc;
        const nb = Math.round((TAU * Rr) / 24);
        for (let i = 0; i < nb; i++) { const a = (i / nb) * TAU; ctx.beginPath(); ctx.arc(cX + Math.cos(a) * Rr, cy + Math.sin(a) * Rr, Rr * 0.016, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = th.acc;
        for (const [k, lw] of [[0.95, 5], [0.92, 1.6], [0.7, 1.6], [0.67, 5]]) { ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(cX, cy, Rr * k, 0, TAU); ctx.stroke(); }
        // las letras van por la parte del aro que queda dentro de la hoja (arriba y a la izquierda)
        const rt = Rr * 0.81, at = Math.PI * 1.2 - rot;
        const zA = arcSize(g, mayus(arriba), rt, 2.3, Rr * 0.085, "Cormorant Garamond", 700, 0.2);
        const ang = arcText(g, mayus(arriba), cX, cy, rt, F("Cormorant Garamond", zA, 700), th.acc, { sp: zA * 0.2, at });
        for (const s of [-1, 1]) rombo(ctx, cX + Math.cos(at + s * (ang / 2 + 0.09)) * rt, cy + Math.sin(at + s * (ang / 2 + 0.09)) * rt, Rr * 0.026, th.acc);
        const r = Rr * 0.64;
        const path = (c) => { c.beginPath(); c.arc(cX, cy, r, 0, TAU); };
        // la foto: duotono plano de la tinta del tema (sin rayas)
        const stops = dk ? [g.mix(th.bg, "#000", 0.2), th.bg, g.mix(th.acc, th.bg, 0.25), g.mix(th.acc, "#fff", 0.25)] : [g.mix(th.acc, "#000", 0.35), th.acc, g.mix(th.acc, th.bg, 0.55), th.bg];
        const foto = g.photoOn && fotoTinta(g, cX - r, cy - r, 2 * r, 2 * r, stops, { path });
        if (!foto) {
          if (!sinTrigo) for (const s of [-1, 1]) {
            espiga(ctx, cX + s * r * 0.14, cy + r * 0.86, r * 0.82, -Math.PI / 2 + s * 0.98, th.acc, { grains: 6, leaf: false, flip: s > 0 });
            espiga(ctx, cX + s * r * 0.1, cy + r * 0.88, r * 0.72, -Math.PI / 2 + s * 0.56, th.acc, { grains: 5, leaf: false, flip: s > 0 });
          }
          centro(cX, sinTrigo ? cy : cy - r * 0.1, r);
        }
        // tinta gastada del sello
        ctx.globalCompositeOperation = "source-over";
        motas(g, cX - Rr, cy - Rr, 2 * Rr, 2 * Rr, th.bg, Math.round(Rr * 1.6), { a: 0.55, r: 1.6 });
        ctx.restore();
      };
      const motivo = (kind) => (x, y, r) => {
        if (kind === "bodas") { anillos(ctx, x, y, r * 0.24, th.acc, r * 0.05); return; }
        if (kind === "cumple") { sol(ctx, x, y, r * 0.56, th.acc, { rays: 24, disc: 0.4 }); cruz(ctx, x, y, r * 0.25, th.bg, 0.2); return; }
        if (kind === "cruz") { sol(ctx, x, y, r * 0.46, th.acc, { rays: 16, disc: 0 }); ctx.fillStyle = th.bg; ctx.beginPath(); ctx.arc(x, y, r * 0.24, 0, TAU); ctx.fill(); cruz(ctx, x, y, r * 0.5, th.acc, 0.16); return; }
        paloma(ctx, x, y, r * 0.95, th.acc, { eye: th.bg, ramita: th.acc, rot: -0.1, back: 0.6 });
      };
      const sm = (s, x, y, size, color, o = {}) => versFit(g, s, x, y, size, color, o.maxW || W - 2 * M, { alpha: o.alpha, align: o.align });
      const logo = () => marca(g, W - M, 70, 56, { align: "right", bg: th.bg, ink: th.ink, azul: th.azul });
      // coloca el bloque: si sobra espacio arriba del límite, lo baja un poco (sin que el sello lo tape)
      const colocar = (y0, y1, cuerpo, k = 0.35) => {
        const e0 = cuerpo(y0, false); let ys = y0 + Math.max(0, (y1 - e0) * k);
        if (ys > y0 && cuerpo(ys, false) > y1) ys = y0;
        return cuerpo(ys, true);
      };
      if (d.kind === "card") {
        const sigY = H - 150;
        colocar(150, sigY - 90, (y, on) => {
          const T = (f) => on && f();
          if (d.kicker) { T(() => { sm(d.kicker, M, y, 22, th.acc); ctx.fillStyle = g.rgba(th.acc, 0.8); ctx.fillRect(M, y + 22, 60, 3); }); y += 22; }
          const hd = fitA(d.headline, (s) => F("Playfair Display", s, 900), y + 34, { start: 132, min: 56, maxLines: 3, lh: 1.0 });
          T(() => g.lines(hd.lines, M - 4, y + 34 + hd.size * 0.8, hd.lh, { font: hd.font, color: th.ink })); y += 34 + hd.h;
          const nm = fitA(d.name, (s) => F("Cormorant Garamond", s, 600, true), y + 26, { start: 76, min: 38, maxLines: 2, lh: 1.05 });
          T(() => g.lines(nm.lines, M, y + 26 + nm.size * 0.8, nm.lh, { font: nm.font, color: th.acc })); y += 26 + nm.h;
          if (d.line) { const ln = fitA(d.line, (s) => F("Cormorant Garamond", s, 500, true), y + 30, { start: 36, min: 26, maxLines: 2, lh: 1.15 }); T(() => g.lines(ln.lines, M, y + 30 + ln.size * 0.8, ln.lh, { font: ln.font, color: th.ink })); y += 30 + ln.h; }
          if (d.verse) {
            const vs = fitA(`«${d.verse}» ${d.ref}`, (s) => F("Cormorant Garamond", s, 500), y + 34, { start: 33, min: 22, maxLines: 3, lh: 1.24, maxW: 640, maxBot: sigY - 90 });
            T(() => g.lines(vs.lines, M, y + 34 + vs.size * 0.8, vs.lh, { font: vs.font, color: th.ink, alpha: 0.85 })); y += 34 + vs.h;
          }
          return y;
        });
        sm("Con cariño", M, sigY - 44, 16, th.acc);
        const sg = g.fit(d.signature, (s) => F("Cormorant Garamond", s, 600, true), { maxW: anchoEn(M, 600, sigY - 40, sigY + 40) - 10, maxLines: 1, start: 42, min: 24 });
        g.text(d.signature, M, sigY, { font: sg.font, color: th.ink });
        if (d.from) sm(d.from, M, sigY + 34, 15, th.ink, { alpha: 0.8, maxW: anchoEn(M, 600, sigY + 20, sigY + 40) - 10 });
        logo();
        medalla(d.church, motivo(d.occasion === "bodas" ? "bodas" : d.occasion === "cumple" ? "cumple" : "paloma"));
      } else if (d.kind === "ann") {
        const bottom = H - 120;
        colocar(150, bottom - 100, (y, on) => {
          const T = (f) => on && f();
          T(() => { sm("Le invitamos", M, y, 22, th.acc); ctx.fillStyle = g.rgba(th.acc, 0.8); ctx.fillRect(M, y + 22, 60, 3); }); y += 22;
          const t = fitA(d.title, (s) => F("Playfair Display", s, 900), y + 36, { start: 124, min: 52, maxLines: 3, lh: 1.02 });
          T(() => g.lines(t.lines, M - 4, y + 36 + t.size * 0.8, t.lh, { font: t.font, color: th.ink })); y += 36 + t.h;
          if (d.date) { const wh = fitA(cap(d.when) + (d.time ? " · " + d.time : ""), (s) => F("Cormorant Garamond", s, 600, true), y + 40, { start: 46, min: 28, maxLines: 2, lh: 1.1 }); T(() => g.lines(wh.lines, M, y + 40 + wh.size * 0.8, wh.lh, { font: wh.font, color: th.acc })); y += 40 + wh.h; }
          else { T(() => g.text("Toda la iglesia está invitada", M, y + 54, { font: F("Cormorant Garamond", 42, 600, true), color: th.acc })); y += 54; }
          if (d.place) { const pl = fitA(d.place, (s) => F("Cormorant Garamond", s, 600), y + 30, { start: 34, min: 24, maxLines: 3, lh: 1.15, maxW: 760 }); T(() => g.lines(pl.lines, M, y + 30 + pl.size * 0.8, pl.lh, { font: pl.font, color: th.ink, alpha: 0.9 })); y += 30 + pl.h; }
          return y;
        });
        g.text("¡Les esperamos!", M, bottom, { font: F("Playfair Display", 44, 500, true), color: th.acc });
        logo();
        medalla(d.church, d.date ? (x, y, r) => {
          versFit(g, d.weekday, x, y - r * 0.42, 22, th.acc, r * 1.3, { align: "center" });
          const df = g.fit(d.day, (s) => F("Playfair Display", s, 900), { maxW: r * 1.1, maxLines: 1, start: r * 0.78, min: 50 });
          g.text(d.day, x, y + r * 0.3, { font: df.font, color: th.acc, align: "center" });
          versFit(g, d.month, x, y + r * 0.56, 22, th.acc, r * 1.3, { align: "center" });
        } : motivo("cruz"), !!d.date);
      } else {
        const y0 = story ? 270 : sq ? 110 : 130, bot = H - (story ? 280 : 70);
        const top0 = d.eyebrow || (d.firma ? "" : d.church);
        const lim = d.firma ? bot - 60 : bot;
        colocar(y0, lim, (y, on) => {
          const T = (f) => on && f();
          if (top0) { T(() => sm(top0, M, y, 19, th.acc)); y += 19; }
          if (d.head) { const hd = fitA(d.head, (s) => F("Playfair Display", s, 500, true), y + 30, { start: story ? 72 : 56, min: 34, maxLines: 2, lh: 1.06 }); T(() => g.lines(hd.lines, M, y + 30 + hd.size * 0.8, hd.lh, { font: hd.font, color: th.acc })); y += 30 + hd.h; }
          const v = fitA(d.text, (s) => F("Cormorant Garamond", s, 600, true), y + 36, { start: d.text.length < 60 ? 110 : story ? 82 : sq ? 64 : 70, min: 28, maxLines: 12, lh: 1.12, maxBot: lim - 90 });
          T(() => g.lines(v.lines, M - 2, y + 36 + v.size * 0.8, v.lh, { font: v.font, color: th.ink })); y += 36 + v.h;
          T(() => { filete(ctx, M, y + 46, 110, th.acc, { align: "left" }); sm(d.ref, M + 128, y + 54, 23, th.acc, { maxW: anchoEn(M + 128, 600, y + 30, y + 60) - 10 }); }); y += 54;
          return y;
        }, 0.4);
        if (d.firma) sm(d.church, M, bot, 15, th.ink, { alpha: 0.75, maxW: anchoEn(M, 700, bot - 20, bot) - 10 });
        medalla("Palabra de Dios", motivo("paloma"));
      }
    },
  });
})();
