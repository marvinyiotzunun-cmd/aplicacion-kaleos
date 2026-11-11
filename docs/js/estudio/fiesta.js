/* Estudio · familia Fiesta: cumpleaños, aniversarios y actividades de jóvenes. Alegre pero con buen gusto:
   formas planas de recorte (Memphis), papel picado, globos planos, escarapela, pastel con glaseado y confeti.
   Cada plantilla tiene su propia letra: Memphis = palo seco negra; Picado = egipcia (slab); Globos = caligrafía
   fina con condensada; Escarapela = condensada en mayúsculas; Pastel = cursiva redonda; Confeti = palo seco ancha.
   En avisos y versículos el festejo baja de volumen. */
(function () {
  "use strict";
  const E = window.K && window.K.EST; if (!E) return;
  const TAU = Math.PI * 2;

  // ===== ayudantes de la familia =====
  const limpio = (s) => String(s || "").replace(/[¡!¿?«»,.;:]/g, "").trim();
  const cap = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
  // «Lamentaciones 3:22-23» → ["Lamentaciones", "3:22-23"]
  const cita = (ref) => { const m = String(ref || "").trim().match(/^(.*?)\s*(\d+(?:\s*[:.,\-–]\s*\d+)*)$/); return m && m[1] ? [m[1].trim(), m[2].replace(/\s+/g, "")] : [String(ref || "").trim(), ""]; };
  // «7 de noviembre» → ["7", "noviembre"]
  const fecha = (k) => { const m = String(k || "").trim().match(/^(\d{1,2})\s+de\s+(.+)$/i); return m ? [m[1], m[2]] : null; };
  // «6:00 p. m.» → ["6:00", "p. m."]
  const hora = (t) => { const m = String(t || "").match(/^([\d:]+)\s*(.*)$/); return m ? [m[1], m[2]] : [String(t || ""), ""]; };
  // «¡Feliz cumpleaños!» → ["¡Feliz", "cumpleaños!"] · «¡Felicidades!» → ["", "¡Felicidades!"]
  const partes = (s) => { const w = String(s || "").trim().split(/\s+/).filter(Boolean); return w.length < 2 ? ["", w[0] || ""] : [w[0], w.slice(1).join(" ")]; };
  // color de texto que se lee encima de un color
  const sobre = (g, c) => (g.lum(c) > 0.6 ? "#161616" : "#ffffff");
  // etiqueta pequeña en mayúsculas espaciadas
  const lab = (g, s, x, y, o = {}) => g.text(String(s || "").toUpperCase(), x, y, { font: g.F("Montserrat", o.size || 20, 700), color: o.color || "#161616", sp: o.sp ?? 3, alpha: o.alpha ?? 1, align: o.align, rotate: o.rotate });
  const oscuroDe = (g, a, b) => (g.lum(a) <= g.lum(b) ? a : b);
  const claroDe = (g, a, b) => (g.lum(a) > g.lum(b) ? a : b);

  // ===== cortes de línea equilibrados =====
  // nunca deja al final de una línea una palabra de menos de 3 letras ni una preposición o conjunción,
  // y entre los cortes posibles elige el que deja las líneas más parejas de ancho.
  const CORTAS = new Set("de del y e o u a al en la el las los lo con por para sin su sus mi mis tu tus que se un una".split(" "));
  const malFin = (w) => { const s = limpio(w).toLowerCase(); return s.length < 3 || CORTAS.has(s); };
  function parejas(g, s, font, maxW, n, sp = 0) {
    const words = String(s || "").split(/\s+/).filter(Boolean);
    if (n > words.length) return null;
    let best = null, bestC = Infinity;
    const probar = (cuts) => {
      const P = []; let i = 0; for (const c of [...cuts, words.length]) { P.push(words.slice(i, c)); i = c; }
      for (let q = 0; q < P.length - 1; q++) if (malFin(P[q][P[q].length - 1])) return;
      if (P.length > 1 && P.some((l) => l.length === 1 && limpio(l[0]).length < 3)) return;
      const ls = P.map((l) => l.join(" ")), ws = ls.map((l) => g.measure(l, font, sp)), mx = Math.max(...ws);
      if (mx > maxW) return;
      const c = mx - Math.min(...ws) + mx * 0.02;
      if (c < bestC) { bestC = c; best = ls; }
    };
    const rec = (start, k, cuts) => {
      if (k === 0) { probar(cuts); return; }
      for (let j = start; j <= words.length - k; j++) rec(j + 1, k - 1, [...cuts, j]);
    };
    rec(1, n - 1, []);
    return best;
  }
  // para textos largos (versículos): corte normal, pero sin dejar «de», «y», «la»… al final de una línea
  function corteLargo(g, s, font, maxW, sp = 0) {
    const words = String(s || "").split(/\s+/).filter(Boolean), out = []; let l = [];
    for (const w of words) {
      const t = [...l, w];
      if (l.length && g.measure(t.join(" "), font, sp) > maxW) {
        const pasa = [];
        while (l.length > 1 && malFin(l[l.length - 1])) pasa.unshift(l.pop());
        out.push(l.join(" ")); l = [...pasa, w];
        if (g.measure(l.join(" "), font, sp) > maxW) return null;
      } else l = t;
    }
    if (l.length) out.push(l.join(" "));
    return out.every((x) => g.measure(x, font, sp) <= maxW) ? out : null;
  }
  // como g.fit pero con líneas parejas. o = { maxW, maxH, maxLines, minLines, start, min, lh, sp, step }
  function fitB(g, s, fontFn, o = {}) {
    const { maxW = g.W * 0.8, maxH = Infinity, maxLines = 4, minLines = 1, start = 120, min = 30, lh = 1.1, sp = 0, step = 3 } = o;
    const largo = String(s || "").split(/\s+/).filter(Boolean).length > 10;
    for (let size = start; size >= min; size -= step) {
      const font = fontFn(size);
      if (largo) {
        const lines = corteLargo(g, s, font, maxW, sp);
        if (lines && lines.length <= maxLines && lines.length * size * lh <= maxH + size * (lh - 1)) return { size, lines, lh: size * lh, h: lines.length * size * lh, font, sp };
        continue;
      }
      for (let n = minLines; n <= maxLines; n++) {
        if (n * size * lh > maxH + size * (lh - 1)) break;
        const lines = parejas(g, s, font, maxW, n, sp);
        if (!lines) continue;
        // si con una línea menos cabe casi igual de grande (≥ 85 %), mejor menos líneas
        if (n > minLines && n > 2) {
          for (let z = size - step; z >= Math.max(min, size * 0.85); z -= step) {
            const f2 = fontFn(z), l2 = parejas(g, s, f2, maxW, n - 1, sp);
            if (l2) return { size: z, lines: l2, lh: z * lh, h: l2.length * z * lh, font: f2, sp };
          }
        }
        return { size, lines, lh: size * lh, h: lines.length * size * lh, font, sp };
      }
    }
    return g.fit(s, fontFn, { maxW, maxH, maxLines, start: min, min, lh, sp });
  }

  // versículo pequeño con su cita, en el espacio que quede (entre y y yMax). Si no cabe entero, no se pone
  // (nunca cortamos la Palabra con «…»). o = { align, color, refColor, alpha, wide, start, min, maxLines, refSize }
  function versito(g, x, y, maxW, yMax, o = {}) {
    const { F, d } = g, lh = 1.38, refH = (o.refSize || 17) + 24, s = `«${d.verse}»`;
    if (!d.verse) return y;
    for (const mw of [maxW, o.wide || maxW]) {
      for (let size = o.start || 27; size >= (o.min || 18); size--) {
        const font = F("Hanken Grotesk", size, o.weight || 400), lines = g.wrap(s, font, mw);
        if (lines.length <= (o.maxLines || 6) && (lines.length - 1) * size * lh + refH <= yMax - y) {
          const ax = o.align === "center" ? g.W / 2 : x;
          if (o.dry) return y + (lines.length - 1) * size * lh + refH;
          const vy = g.lines(lines, ax, y, size * lh, { font, color: o.color, align: o.align, alpha: o.alpha ?? 0.88 });
          if (d.ref) lab(g, d.ref, ax, vy + refH, { color: o.refColor, size: o.refSize || 17, align: o.align });
          return vy + refH;
        }
      }
    }
    return y;
  }

  // foto en duotono limpio: negro → oscuro, blanco → claro (sin multiplicar sobre el color de la pieza)
  function duo(g, x, y, w, h, dark, light, o = {}) {
    const { ctx } = g;
    if (!g.photo(x, y, w, h, { treat: "bn", path: o.path, focusY: o.focusY ?? 0.5 })) return false;
    ctx.save(); ctx.beginPath(); if (o.path) o.path(ctx); else ctx.rect(x, y, w, h); ctx.clip();
    ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = light; ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = "lighten"; ctx.fillStyle = dark; ctx.fillRect(x, y, w, h);
    ctx.restore(); return true;
  }

  // ===== formas planas =====
  const disco = (ctx, x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
  // onda (serpentina plana)
  function onda(ctx, x, y, w, amp, n, c, lw) {
    ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
    const k = Math.round(n * 24);
    for (let i = 0; i <= k; i++) { const t = i / k, X = x + w * t, Y = y + Math.sin(t * n * TAU) * amp; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.stroke(); ctx.restore();
  }
  function zigzag(ctx, x, y, w, h, n, c, lw) {
    ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "miter"; ctx.beginPath();
    for (let i = 0; i <= n * 2; i++) { const X = x + (w * i) / (n * 2), Y = y + (i % 2 ? -h / 2 : h / 2); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.stroke(); ctx.restore();
  }
  function puntos(ctx, x, y, cols, rows, step, r, c) { ctx.fillStyle = c; for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { ctx.beginPath(); ctx.arc(x + i * step, y + j * step, r, 0, TAU); ctx.fill(); } }
  function triangulo(ctx, x, y, s, rot, c, lw) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath();
    for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i * TAU) / 3; i ? ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s) : ctx.moveTo(Math.cos(a) * s, Math.sin(a) * s); }
    ctx.closePath();
    if (lw) { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineJoin = "round"; ctx.stroke(); } else { ctx.fillStyle = c; ctx.fill(); }
    ctx.restore();
  }
  // caja «calcomanía»: blanca con borde negro y sombra dura de color
  function calco(ctx, x, y, w, h, sombra, o = {}) {
    ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot);
    const d = o.d ?? 14; ctx.fillStyle = sombra; ctx.fillRect(d, d, w, h);
    ctx.fillStyle = o.fill || "#ffffff"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = o.line || "#161616"; ctx.lineWidth = o.lw ?? 4; ctx.strokeRect(0, 0, w, h); ctx.restore();
  }
  // una pieza de confeti: tira, círculo, triángulo o rizo
  function pieza(ctx, x, y, s, tipo, c, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = c; ctx.strokeStyle = c;
    if (tipo === 0) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-s * 0.2, -s * 0.78, s * 0.4, s * 1.56, s * 0.08); else ctx.rect(-s * 0.2, -s * 0.78, s * 0.4, s * 1.56); ctx.fill(); }
    else if (tipo === 1) { ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, TAU); ctx.fill(); }
    else if (tipo === 2) { ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i * TAU) / 3; i ? ctx.lineTo(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55) : ctx.moveTo(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55); } ctx.closePath(); ctx.fill(); }
    else { ctx.lineWidth = s * 0.2; ctx.lineCap = "round"; ctx.beginPath(); for (let i = 0; i <= 16; i++) { const t = i / 16, X = -s * 0.8 + t * s * 1.6, Y = Math.sin(t * TAU * 1.5) * s * 0.26; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } ctx.stroke(); }
    ctx.restore();
  }
  // lluvia de confeti desde una esquina: muchas piezas cerca de la esquina y cada vez menos al alejarse.
  // o = { x, y, a0, a1, spread, n, s, ok(x,y,r), color(x,y,i) }. Nada queda cortado por el borde.
  function lluvia(g, o) {
    const { ctx, R, W, H } = g, pts = [];
    for (let tries = 0; pts.length < o.n && tries < o.n * 60; tries++) {
      const t = Math.pow(R(), o.dens || 1.35), a = o.a0 + R() * (o.a1 - o.a0), x = o.x + Math.cos(a) * o.spread * t, y = o.y + Math.sin(a) * o.spread * t;
      const s = (o.s || 30) * (1.15 - t * 0.5), rr = s * 0.82;
      if (x - rr < 30 || x + rr > W - 30 || y - rr < 26 || y + rr > H - 26) continue;
      if (o.ok && !o.ok(x, y, rr)) continue;
      if (pts.some(([px, py, pr]) => Math.hypot(px - x, py - y) < pr + rr + 8)) continue;
      pts.push([x, y, rr]);
      pieza(ctx, x, y, s, pts.length % 4, o.color(x, y, pts.length), R() * TAU);
    }
    return pts.length;
  }
  // un globo plano: cuerpo de huevo, brillo plano, nudo; devuelve el punto del nudo
  function globo(ctx, cx, cy, r, c, rot = 0) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.fillStyle = c; ctx.beginPath();
    ctx.moveTo(0, -r * 1.12);
    ctx.bezierCurveTo(r * 0.62, -r * 1.12, r * 1.02, -r * 0.62, r * 1.0, -r * 0.06);
    ctx.bezierCurveTo(r * 0.98, r * 0.5, r * 0.45, r * 0.98, 0, r * 1.08);
    ctx.bezierCurveTo(-r * 0.45, r * 0.98, -r * 0.98, r * 0.5, -r * 1.0, -r * 0.06);
    ctx.bezierCurveTo(-r * 1.02, -r * 0.62, -r * 0.62, -r * 1.12, 0, -r * 1.12);
    ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, r * 1.04); ctx.lineTo(-r * 0.1, r * 1.19); ctx.quadraticCurveTo(0, r * 1.15, r * 0.1, r * 1.19); ctx.closePath(); ctx.fill();
    // brillo plano en forma de media luna
    ctx.fillStyle = "rgba(255,255,255,.34)"; ctx.beginPath();
    ctx.ellipse(-r * 0.5, -r * 0.46, r * 0.12, r * 0.3, 0.55, 0, TAU); ctx.fill();
    ctx.restore();
    return { x: cx - Math.sin(rot) * r * 1.19, y: cy + Math.cos(rot) * r * 1.19 };
  }
  // hilo de globo con una curva suave
  function hilo(ctx, a, b, c, lw = 3, curva = 40) {
    ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(a.x, a.y);
    const mx = (a.x + b.x) / 2 + curva, my = (a.y + b.y) / 2; ctx.bezierCurveTo(mx, a.y + (my - a.y) * 0.5, (a.x + b.x) / 2 - curva, my + (b.y - my) * 0.5, b.x, b.y); ctx.stroke(); ctx.restore();
  }
  // lacito donde se juntan los hilos
  function lazo(ctx, x, y, s, c) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = c;
    for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(k * s * 1.3, -s * 0.9, k * s * 1.2, 0); ctx.quadraticCurveTo(k * s * 1.3, s * 0.9, 0, 0); ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, 0, s * 0.28, 0, TAU); ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = s * 0.16; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-s * 0.5, s * 1.1, -s * 0.2, s * 1.8); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 0.6, s * 1.0, s * 0.5, s * 1.9); ctx.stroke();
    ctx.restore();
  }
  // escarapela: listones detrás, pliegues en zigzag, aro y disco central
  function escarapela(ctx, cx, cy, r, c1, c2, c3, o = {}) {
    if (o.colas !== false) {
      for (const k of [-1, 1]) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(k * (o.abre ?? 0.36)); ctx.fillStyle = k < 0 ? c2 : c1;
        const w = r * 0.42, L = r * (o.largo ?? 1.62);
        ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.lineTo(w / 2, L); ctx.lineTo(0, L - w * 0.42); ctx.lineTo(-w / 2, L); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,.12)"; ctx.fillRect(-w / 2, 0, w * 0.18, L - w * 0.1);
        ctx.restore();
      }
    }
    const N = 56; ctx.fillStyle = c1; ctx.beginPath();
    for (let i = 0; i <= N * 2; i++) { const a = (i / (N * 2)) * TAU, rr = i % 2 ? r * 0.9 : r; i ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,.11)";
    for (let i = 0; i < N; i += 2) { const a0 = (i / N) * TAU, a1 = ((i + 1) / N) * TAU; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a0) * r * 0.62, cy + Math.sin(a0) * r * 0.62); ctx.lineTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r); ctx.lineTo(cx + Math.cos((a0 + a1) / 2) * r * 0.9, cy + Math.sin((a0 + a1) / 2) * r * 0.9); ctx.lineTo(cx + Math.cos(a1) * r * 0.62, cy + Math.sin(a1) * r * 0.62); ctx.closePath(); ctx.fill(); }
    disco(ctx, cx, cy, r * 0.76, c2);
    disco(ctx, cx, cy, r * 0.66, c3);
    ctx.save(); ctx.strokeStyle = E.rgba(o.puntada || "#000000", 0.3); ctx.lineWidth = 3; ctx.setLineDash([10, 9]); ctx.beginPath(); ctx.arc(cx, cy, r * 0.6, 0, TAU); ctx.stroke(); ctx.restore();
  }
  // una bandera de papel picado con figuras caladas (se calan en un lienzo aparte)
  let PICADO = null;
  function banderita(ctx, x, y, w, h, c, motivo, rot) {
    if (!PICADO) PICADO = document.createElement("canvas");
    const cv = PICADO; cv.width = Math.ceil(w); cv.height = Math.ceil(h); const x2 = cv.getContext("2d");
    x2.clearRect(0, 0, w, h); x2.fillStyle = c;
    const fl = h * 0.86; x2.fillRect(0, 0, w, fl);
    const n = 9; x2.beginPath(); x2.moveTo(0, fl - 1);
    for (let i = 0; i <= n * 2; i++) x2.lineTo((w * i) / (n * 2), i % 2 ? h : fl - 1);
    x2.lineTo(w, fl - 1); x2.closePath(); x2.fill();
    x2.fillStyle = "rgba(0,0,0,.14)"; x2.fillRect(0, 0, w, h * 0.07);
    x2.globalCompositeOperation = "destination-out"; x2.fillStyle = "#000";
    const cx = w / 2, cy = h * 0.47, s = w * 0.36;
    for (let i = 0; i < 6; i++) { const yy = h * 0.16 + i * (h * 0.62) / 5; x2.beginPath(); x2.arc(w * 0.1, yy, w * 0.028, 0, TAU); x2.arc(w * 0.9, yy, w * 0.028, 0, TAU); x2.fill(); }
    if (motivo === 0) {
      for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; x2.beginPath(); x2.ellipse(cx + Math.cos(a) * s * 0.55, cy + Math.sin(a) * s * 0.55, s * 0.32, s * 0.14, a, 0, TAU); x2.fill(); }
      x2.beginPath(); x2.arc(cx, cy, s * 0.16, 0, TAU); x2.fill();
    } else if (motivo === 1) {
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { if ((i + j) % 2) continue; const X = cx + i * s * 0.55, Y = cy + j * s * 0.7; x2.beginPath(); x2.moveTo(X, Y - s * 0.3); x2.lineTo(X + s * 0.2, Y); x2.lineTo(X, Y + s * 0.3); x2.lineTo(X - s * 0.2, Y); x2.closePath(); x2.fill(); }
    } else if (motivo === 2) {
      x2.beginPath(); x2.arc(cx, cy, s * 0.42, 0, TAU); x2.arc(cx, cy, s * 0.26, 0, TAU, true); x2.fill("evenodd");
      for (let i = 0; i < 12; i++) { const a = (i * TAU) / 12; x2.beginPath(); x2.moveTo(cx + Math.cos(a - 0.12) * s * 0.52, cy + Math.sin(a - 0.12) * s * 0.52); x2.lineTo(cx + Math.cos(a) * s * 0.86, cy + Math.sin(a) * s * 0.86); x2.lineTo(cx + Math.cos(a + 0.12) * s * 0.52, cy + Math.sin(a + 0.12) * s * 0.52); x2.closePath(); x2.fill(); }
    } else if (motivo === 3) {
      x2.fillRect(cx - s * 0.11, cy - s * 0.62, s * 0.22, s * 1.24); x2.fillRect(cx - s * 0.42, cy - s * 0.3, s * 0.84, s * 0.22);
    } else {
      x2.fillRect(cx - s * 0.03, cy - s * 0.7, s * 0.06, s * 1.4);
      for (let i = 0; i < 4; i++) for (const k of [-1, 1]) { const Y = cy - s * 0.5 + i * s * 0.34; x2.beginPath(); x2.ellipse(cx + k * s * 0.22, Y, s * 0.22, s * 0.08, k * -0.6, 0, TAU); x2.fill(); }
    }
    x2.globalCompositeOperation = "source-over";
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(cv, -w / 2, 0, w, h); ctx.restore();
  }
  // cordón con banderitas: devuelve el punto más bajo de las banderas
  function guirnalda(g, o) {
    const { ctx, W } = g, n = o.n || 7, y0 = o.y0 ?? 60, sag = o.sag ?? 70, colors = o.colors, bw = o.w ?? (W / n) * 0.84, bh = o.h ?? bw * 1.25;
    const yAt = (x) => y0 + sag * (1 - Math.pow((x - W / 2) / (W / 2 + 40), 2));
    ctx.save(); ctx.strokeStyle = o.cord; ctx.lineWidth = 3; ctx.beginPath();
    for (let x = -20; x <= W + 20; x += 20) x === -20 ? ctx.moveTo(x, yAt(x)) : ctx.lineTo(x, yAt(x)); ctx.stroke(); ctx.restore();
    let low = 0;
    for (let i = 0; i < n; i++) {
      const x = (W / n) * (i + 0.5), slope = (yAt(x + 1) - yAt(x - 1)) / 2, rot = Math.atan(slope);
      const motivo = o.motivos ? o.motivos[i % o.motivos.length] : i % 5;
      banderita(ctx, x, yAt(x) - 4, bw, bh, colors[i % colors.length], motivo, rot);
      low = Math.max(low, yAt(x) + bh);
    }
    return low;
  }
  // texto sobre un arco suave (la panza hacia arriba), centrado en cx
  function arco(g, s, cx, y, R, font, o = {}) {
    const chars = [...String(s)], sp = o.sp || 0, ws = chars.map((ch) => g.measure(ch, font) + sp), T = ws.reduce((a, b) => a + b, 0) - sp;
    let acc = 0;
    chars.forEach((ch, i) => {
      const th = (acc + ws[i] / 2 - T / 2) / R; acc += ws[i];
      g.text(ch, cx + R * Math.sin(th), y + R - R * Math.cos(th), { font, color: o.color, align: "center", rotate: th });
    });
  }
  // glaseado que escurre: rellena de y0 a y1 y cuelga gotas debajo de y1
  function goteo(g, x, y0, w, y1, c, o = {}) {
    const { ctx, R } = g; ctx.save(); ctx.fillStyle = c;
    if (o.path) { ctx.beginPath(); o.path(ctx); ctx.clip(); }
    ctx.fillRect(x, y0, w, y1 - y0 + 1);
    let px = x - 10; const max = o.max ?? 110, min = o.min ?? 18;
    while (px < x + w) {
      const dw = (o.dw ?? 46) + R() * (o.dw ?? 46) * 0.8, L = R() < 0.35 ? min : min + R() * (max - min);
      ctx.beginPath(); ctx.moveTo(px, y1); ctx.lineTo(px, y1 + L - dw / 2); ctx.arc(px + dw / 2, y1 + L - dw / 2, dw / 2, Math.PI, 0, true); ctx.lineTo(px + dw, y1); ctx.closePath(); ctx.fill();
      px += dw - 2;
    }
    ctx.restore();
  }
  // cruz sencilla
  const cruz = (ctx, cx, cy, s, c) => { ctx.fillStyle = c; ctx.fillRect(cx - s * 0.09, cy - s * 0.5, s * 0.18, s); ctx.fillRect(cx - s * 0.34, cy - s * 0.24, s * 0.68, s * 0.18); };

  // =====================================================================================
  // «Memphis»: figuras geométricas planas (disco, triángulo de contorno, puntos, onda), titular en mayúsculas
  // gruesas alineado a la izquierda y el nombre dentro de una calcomanía con sombra dura. Letra: palo seco negra.
  E.add({
    id: "fie-memphis", name: "Memphis", family: "fiesta", fonts: ["Montserrat", "Pacifico", "Hanken Grotesk"],
    themes: {
      crema: { name: "Crema y coral", bg: "#f5eee1", ink: "#1c1c1c", a: "#ff6a4d", b: "#2f6fd6" },
      marino: { name: "Marino y oro", bg: "#0d1b3d", ink: "#ffffff", a: "#f2c85b", b: "#2d5fa8" },
      menta: { name: "Menta y fucsia", bg: "#d3eee2", ink: "#1b1b1b", a: "#e8336d", b: "#ffc23c" },
      lila: { name: "Lila y mandarina", bg: "#e5ddf8", ink: "#251a46", a: "#ff7a2f", b: "#34b3a3" },
      noche: { name: "Noche y chicle", bg: "#171717", ink: "#ffffff", a: "#ff5fa2", b: "#33c3b0" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 80;
      const story = d.kind === "verse" && g.fmt === "historia";
      g.paper(th.bg, { fibers: 0.22, grain: 0.05, mottle: 0.35 });
      const oscuro = g.lum(th.bg) < 0.5;
      // el disco grande: con foto, la foto dentro del disco
      const discoGrande = (x, y, r) => {
        if (!g.photo(x - r, y - r, 2 * r, 2 * r, { treat: "suave", path: (c) => { c.beginPath(); c.arc(x, y, r, 0, TAU); } })) disco(ctx, x, y, r, th.a);
        else { ctx.save(); ctx.strokeStyle = th.ink; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore(); }
      };
      const etiqueta = (s, x, y, rot, size = 26) => {
        const f = F("Montserrat", size, 800), w = g.measure(s.toUpperCase(), f, 2) + 44, h = size + 30;
        calco(ctx, x, y, w, h, th.b, { rot, d: 8, lw: 3 });
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); g.text(s.toUpperCase(), 22, h / 2 + size * 0.36, { font: f, color: "#161616", sp: 2 }); ctx.restore();
        return w;
      };
      if (d.kind === "card") {
        discoGrande(W - 220, 250, 170);
        puntos(ctx, W - 176, 70, 5, 5, 26, 5, th.b);
        triangulo(ctx, W - 500, 150, 46, 0.3, th.ink, 6);
        lab(g, d.church, M, 102, { color: th.ink, size: 19, alpha: 0.85 });
        if (d.kicker) etiqueta(d.kicker, W - 440, 372, -0.06);
        const [lead, main] = partes(d.headline);
        let y = 410;
        if (lead) { g.text(lead, M - 4, y, { font: F("Pacifico", 96), color: th.a }); y += 56; } else y += 30;
        const big = fitB(g, main.toUpperCase(), (s) => F("Montserrat", s, 800), { maxW: W - 2 * M, maxLines: 3, start: 170, min: 74, lh: 0.96 });
        y += big.size * 0.76;
        y = g.lines(big.lines, M - 6, y, big.lh, { font: big.font, color: th.ink }) + 64;
        // el nombre en la calcomanía
        const nm = g.fit(d.name, (s) => F("Montserrat", s, 800), { maxW: W - 2 * M - 74, maxLines: 2, start: 68, min: 40, lh: 1.1 });
        const bw = Math.max(...nm.lines.map((l) => g.measure(l, nm.font))) + 64, bh = nm.h + 44;
        calco(ctx, M, y, bw, bh, th.a, { d: 14 });
        g.lines(nm.lines, M + 32, y + 22 + nm.size * 0.86, nm.lh, { font: nm.font, color: "#161616" });
        y += bh + 78;
        const ln = g.fit(d.line, (s) => F("Hanken Grotesk", s, 700), { maxW: W - 2 * M, maxLines: 2, start: 40, min: 34, lh: 1.22 });
        y = g.lines(ln.lines, M, y, ln.lh, { font: ln.font, color: th.ink }) + 34;
        // la onda, en la columna del texto, separa la frase del versículo
        zigzag(ctx, M + 2, y, 150, 18, 5, th.a, 6);
        y += 62;
        versito(g, M, y, W - 2 * M, H - 196, { color: th.ink, refColor: oscuro ? th.a : th.b, start: 34, min: 32, refSize: 24, weight: 600 });
        const sg = g.fit(d.signature, (s) => F("Pacifico", s), { maxW: 360, maxLines: 1, start: 48, min: 30 });
        g.text(d.signature, W - M, H - 124, { font: sg.font, color: th.ink, align: "right" });
        const fr = g.fit(d.from, (s) => F("Hanken Grotesk", s, 600), { maxW: 420, maxLines: 1, start: 28, min: 22, lh: 1.3 });
        g.lines(fr.lines, W - M, H - 80, fr.lh, { font: fr.font, color: th.ink, align: "right", alpha: 0.85 });
        g.logo(M, H - 136, 60, { white: oscuro, align: "left" });
      } else if (d.kind === "ann") {
        discoGrande(W - 230, 270, 180);
        puntos(ctx, W - 170, 60, 5, 4, 26, 5, th.b);
        triangulo(ctx, M + 40, H - 300, 40, -0.2, th.ink, 6);
        lab(g, d.church, M, 102, { color: th.ink, size: 19, alpha: 0.85 });
        let y = 230;
        if (d.date) {
          const f1 = F("Montserrat", 170, 800), dw = g.measure(d.day, f1);
          const w = Math.max(dw, g.measure(d.month.toUpperCase(), F("Montserrat", 30, 800), 3)) + 70, x = W - 230 - w / 2 - 120;
          calco(ctx, x, 300, w, 250, th.a, { rot: -0.05 });
          ctx.save(); ctx.translate(x, 300); ctx.rotate(-0.05);
          g.text(d.day, 35, 170, { font: f1, color: "#161616" });
          g.text(d.month.toUpperCase(), 35, 214, { font: F("Montserrat", 30, 800), color: "#161616", sp: 3 });
          ctx.restore();
          g.text(d.weekday, M - 4, y + 60, { font: F("Pacifico", 76), color: th.a });
          y = 610;
        } else {
          g.text("¡Les invitamos!", M - 4, y + 120, { font: F("Pacifico", 84), color: th.a });
          y = 500;
        }
        const tt = fitB(g, d.title.toUpperCase(), (s) => F("Montserrat", s, 800), { maxW: W - 2 * M, maxLines: 4, start: 140, min: 60, lh: 0.98, maxH: H - y - 330 });
        y = g.lines(tt.lines, M - 5, y + tt.size * 0.76, tt.lh, { font: tt.font, color: th.ink }) + 50;
        onda(ctx, M, y, 300, 10, 4, th.b, 7);
        y += 70;
        const rows = [];
        if (d.date) rows.push(`${cap(d.when)} · ${d.time}`);
        if (d.place) rows.push(d.place);
        rows.forEach((r) => {
          const t = g.fit(r, (s) => F("Hanken Grotesk", s, 700), { maxW: W - 2 * M - 170, maxLines: 2, start: 36, min: 24, lh: 1.25 });
          y = g.lines(t.lines, M + 120, y + t.size * 0.8, t.lh, { font: t.font, color: th.ink }) + 34;
        });
        g.text("¡Te esperamos!", W - M, H - 96, { font: F("Pacifico", 54), color: th.a, align: "right" });
        g.logo(M + 120, H - 150, 70, { white: oscuro, align: "left" });
      } else {
        const top = story ? 220 : 96, bot = H - (story ? 250 : 80);
        // el disco entero arriba a la derecha (con foto, la foto vive dentro y se lee)
        const r = story ? 200 : g.fmt === "post" ? 185 : 150, dcx = W - r - 56, dcy = top + r - 50;
        discoGrande(dcx, dcy, r);
        puntos(ctx, dcx + r * 0.32, Math.max(40, dcy - r - 20), 4, 3, 24, 4.5, th.b);
        const colW = dcx - r - 50 - M;
        lab(g, d.eyebrow || (d.firma ? "Palabra para hoy" : d.church), M, top + 10, { color: th.ink, size: 19, alpha: 0.85 });
        let y = top + 50;
        if (d.head) {
          const hd = g.fit(d.head, (s) => F("Pacifico", s), { maxW: colW, maxLines: 2, start: story ? 100 : 86, min: 44, lh: 1.18 });
          y = g.lines(hd.lines, M - 4, y + hd.size * 1.0, hd.lh, { font: hd.font, color: th.a }) + hd.size * 0.4;
        }
        y = Math.max(y, dcy + r) + (story ? 70 : 50);
        const refH = 110, area = bot - y - refH - (d.firma ? 40 : 0) - (story ? 90 : 0);
        const v = fitB(g, d.text, (s) => F("Montserrat", s, 800), { maxW: W - 2 * M, maxLines: 14, start: story ? 128 : 116, min: 34, lh: 1.14, maxH: area, step: 4 });
        y += Math.max(0, (area - v.h) * (story ? 0.45 : 0.3));
        y = g.lines(v.lines, M - 3, y + v.size * 0.8, v.lh, { font: v.font, color: th.ink }) + 56;
        onda(ctx, M, y, 180, 8, 3, th.b, 6);
        etiqueta(d.ref, M + 220, y - 30, -0.03, 24);
        // en historia, la esquina de abajo lleva su propia figura para que el pie no quede solo
        if (story) { puntos(ctx, W - M - 5 * 28, H - 330, 6, 4, 28, 5.5, th.b); triangulo(ctx, W - M - 220, H - 290, 34, 0.4, th.a, 6); }
        if (d.firma) lab(g, d.church, M, bot, { color: th.ink, size: 17, alpha: 0.75 });
        else g.logo(M, bot - 50, 56, { white: oscuro, align: "left" });
      }
    },
  });

  // =====================================================================================
  // «Papel picado»: un cordón de banderitas caladas cruza arriba y el titular, en letra egipcia (slab), se curva
  // debajo como un letrero de feria. Centrado a propósito (la guirnalda es simétrica), con pocos niveles.
  E.add({
    id: "fie-picado", name: "Papel picado", family: "fiesta", fonts: ["Alfa Slab One", "Kaushan Script", "Montserrat", "Hanken Grotesk"],
    themes: {
      crema: { name: "Crema, rosa y verde", bg: "#f7efe2", ink: "#1f1a2e", a: "#e83f6f", b: "#2a9d8f", f: ["#e83f6f", "#2a9d8f"] },
      marino: { name: "Marino y oro", bg: "#0d1b3d", ink: "#ffffff", a: "#f2c85b", b: "#2d5fa8", f: ["#f2c85b", "#ffffff", "#2d5fa8"] },
      mango: { name: "Mango y uva", bg: "#ffcf4a", ink: "#3a1240", a: "#d92e63", b: "#3a1240", f: ["#d92e63", "#3a1240", "#ffffff"] },
      pino: { name: "Pino y naranja", bg: "#1f4d3f", ink: "#fdf5e6", a: "#f4a259", b: "#f25c54", f: ["#f4a259", "#fdf5e6", "#f25c54"] },
      cielo: { name: "Cielo y mandarina", bg: "#d9ecf7", ink: "#13294b", a: "#ec5f2c", b: "#13294b", f: ["#ec5f2c", "#ffffff", "#13294b"] },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 90, cx = W / 2;
      const story = d.kind === "verse" && g.fmt === "historia";
      g.paper(th.bg, { fibers: 0.4, grain: 0.06, mottle: 0.5 });
      const oscuro = g.lum(th.bg) < 0.5;
      const cord = g.rgba(th.ink, 0.55);
      // con foto: una franja de foto en duotono detrás de las banderitas, como la calle adornada
      const franja = (h) => {
        const dk = oscuroDe(g, th.bg, th.ink), lt = g.lum(th.bg) > 0.55 ? th.bg : th.a;
        if (!duo(g, 0, 0, W, h, dk, lt, { focusY: 0.6 })) return 0;
        ctx.save(); ctx.fillStyle = th.a; ctx.fillRect(0, h - 8, W, 8); ctx.restore();
        return h;
      };
      // titular curvo: cada línea sobre un arco suave, con cortes parejos
      const curvo = (s, y, o) => {
        const t = fitB(g, s, (z) => F("Alfa Slab One", z), { maxW: W - 2 * M - 30, maxLines: o.maxLines || 2, start: o.start || 180, min: o.min || 60, lh: 1.1, maxH: o.maxH || 400 });
        const yy = y + t.size * 0.8;
        t.lines.forEach((l, i) => { arco(g, l, cx, yy + i * t.lh, 1700, t.font, { color: o.color || th.ink }); });
        return yy + (t.lines.length - 1) * t.lh + t.size * 0.12;
      };
      const rombo = (x, y, s, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill(); };
      const conRombos = (s, y, c, size = 22) => {
        const w = g.text(s.toUpperCase(), cx, y, { font: F("Montserrat", size, 700), color: th.ink, sp: 4, align: "center" });
        rombo(cx - w / 2 - 30, y - size * 0.36, 8, c); rombo(cx + w / 2 + 30, y - size * 0.36, 8, c);
      };
      if (d.kind !== "verse") {
        const fh = g.photoOn ? franja(d.kind === "card" ? 330 : 300) : 0;
        const low = guirnalda(g, { n: 7, y0: 34, sag: 56, colors: th.f, cord: fh ? "rgba(255,255,255,.7)" : cord, w: 128, h: 158, motivos: [0, 2, 1, 3, 1, 2, 0] });
        let y = Math.max(low, fh) + (fh ? 74 : 84);
        conRombos(d.church, y, th.a, 20);
        if (d.kind === "card") {
          const [lead, main] = partes(d.headline);
          // se mide todo antes, para repartir el aire entre la iglesia y la firma
          const hf = fitB(g, main, (z) => F("Alfa Slab One", z), { maxW: W - 2 * M - 30, maxLines: 2, start: 196, min: 80, lh: 1.1, maxH: fh ? 300 : 340 });
          const nm = g.fit(d.name, (s) => F("Montserrat", s, 800), { maxW: W - 2 * M, maxLines: 2, start: 70, min: 40, lh: 1.1 });
          const ln = g.fit(d.line, (s) => F("Hanken Grotesk", s, 600), { maxW: W - 2 * M, maxLines: 2, start: 40, min: 32, lh: 1.25 });
          const tot = 22 + (lead ? 104 : 0) + hf.h + 44 + (d.kicker ? 60 : 0) + 26 + nm.h + 54 + ln.h;
          y += Math.max(0, (H - 190 - y - tot) * 0.42);
          y += 22;
          if (lead) { g.text(lead, cx, y + 92, { font: F("Kaushan Script", 92), color: th.a, align: "center" }); y += 104; }
          y = curvo(main, y, { start: hf.size, maxLines: 2, maxH: fh ? 300 : 340, min: 80 }) + 44;
          if (d.kicker) { conRombos(d.kicker, y + 18, th.a, 26); y += 60; }
          y = g.lines(nm.lines, cx, y + 26 + nm.size * 0.8, nm.lh, { font: nm.font, color: th.ink, align: "center" }) + 54;
          g.lines(ln.lines, cx, y, ln.lh, { font: ln.font, color: th.ink, align: "center", alpha: 0.9 });
          // firma abajo, con aire
          const sg = g.fit(d.signature, (s) => F("Kaushan Script", s), { maxW: W - 2 * M, maxLines: 1, start: 50, min: 30 });
          g.text(d.signature, cx, H - 112, { font: sg.font, color: th.a, align: "center" });
          g.text(d.from, cx, H - 66, { font: F("Hanken Grotesk", 26, 600), color: th.ink, align: "center", alpha: 0.8 });
        } else {
          y += 24;
          if (d.date) {
            g.text(d.weekday, cx, y + 82, { font: F("Kaushan Script", 80), color: th.a, align: "center" });
            g.text(d.day, cx, y + 300, { font: F("Alfa Slab One", 210), color: th.ink, align: "center" });
            conRombos(`${d.month} · ${d.time}`, y + 372, th.a, 28);
            y += 420;
          } else {
            g.text("¡Les invitamos!", cx, y + 100, { font: F("Kaushan Script", 88), color: th.a, align: "center" });
            y += 150;
          }
          const pl = d.place ? g.fit(d.place, (s) => F("Hanken Grotesk", s, 600), { maxW: W - 2 * M - 40, maxLines: 2, start: 36, min: 26, lh: 1.25 }) : null;
          const fondo = H - 150 - (pl ? pl.h + 30 : 0);
          y = curvo(d.title, y, { start: d.date ? 140 : 180, maxLines: 4, min: 48, maxH: fondo - y }) + 46;
          if (pl) g.lines(pl.lines, cx, y + pl.size * 0.6, pl.lh, { font: pl.font, color: th.ink, align: "center", alpha: 0.9 });
          g.text("¡Les esperamos!", cx, H - 70, { font: F("Kaushan Script", 54), color: th.a, align: "center" });
        }
      } else {
        // versículo: guirnalda corta de un solo color, más tranquila
        const top = story ? 170 : 20, bwF = story ? 120 : 104, bhF = story ? 148 : 128;
        const fh = g.photoOn ? franja(top + 40 + bhF + (story ? 120 : 60)) : 0;
        const low = guirnalda(g, { n: 6, y0: top, sag: 40, colors: [th.f[0]], cord: fh ? "rgba(255,255,255,.7)" : cord, w: bwF, h: bhF, motivos: [0, 1, 3, 3, 1, 0] });
        const bot = H - (story ? 260 : 70);
        let y = Math.max(low, fh) + (story ? 110 : 70);
        if (d.head) {
          const hd = g.fit(d.head, (s) => F("Kaushan Script", s), { maxW: W - 2 * M, maxLines: 2, start: 96, min: 50, lh: 1.15 });
          y = g.lines(hd.lines, cx, y + hd.size * 0.95, hd.lh, { font: hd.font, color: th.a, align: "center" }) + hd.size * 0.55 + 10;
        } else if (d.eyebrow) { conRombos(d.eyebrow, y, th.a, 20); y += 40; }
        const area = bot - y - 130 - (d.firma ? 30 : 0);
        const v = fitB(g, d.text, (s) => F("Montserrat", s, 700), { maxW: W - 2 * M, maxLines: 14, start: story ? 120 : 110, min: 32, lh: 1.2, maxH: area, step: 4 });
        y += Math.max(0, (area - v.h) / 2);
        y = g.lines(v.lines, cx, y + v.size * 0.8, v.lh, { font: v.font, color: th.ink, align: "center" }) + 90;
        g.text(d.ref, cx, y, { font: F("Alfa Slab One", 46), color: th.a, align: "center" });
        if (d.firma) conRombos(d.church, bot, th.a, 17);
        else g.logo(cx, bot - 56, 54, { white: oscuro });
      }
    },
  });

  // =====================================================================================
  // «Globos»: globos planos arriba a la derecha; sus hilos se juntan en un lacito por encima del titular en
  // caligrafía fina (nunca encima del texto). Lo demás, en condensada y alineado a la izquierda.
  E.add({
    id: "fie-globos", name: "Globos", family: "fiesta", fonts: ["Yellowtail", "Oswald", "Montserrat", "Hanken Grotesk"],
    themes: {
      marino: { name: "Marino y oro", bg: "#0d1b3d", ink: "#ffffff", a: "#f2c85b", b: "#2d5fa8", c: "#ffffff" },
      crema: { name: "Crema y tomate", bg: "#f6efe4", ink: "#22223b", a: "#ef5b3c", b: "#f4b63f", c: "#22223b" },
      rosa: { name: "Rosa y vino", bg: "#f9d8d6", ink: "#5a1a32", a: "#e2475b", b: "#5a1a32", c: "#ffffff" },
      turquesa: { name: "Turquesa", bg: "#10766e", ink: "#ffffff", a: "#ffd166", b: "#ef476f", c: "#ffffff" },
      uva: { name: "Uva y naranja", bg: "#2b1747", ink: "#ffffff", a: "#ff9f43", b: "#ff6b9a", c: "#ffffff" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 84;
      const story = d.kind === "verse" && g.fmt === "historia";
      if (g.photoOn && g.photo(0, 0, W, H, { treat: "bn", tint: g.rgba(th.bg, 0.7) })) g.grain(0.06);
      else g.paper(th.bg, { fibers: 0.3, grain: 0.05, mottle: 0.4 });
      const oscuro = g.lum(th.bg) < 0.5, cuerda = g.rgba(th.ink, 0.6);
      const ramo = (list, nudo) => {
        const ks = list.map(([x, y, r, c, rot]) => globo(ctx, x, y, r, c, rot));
        ks.forEach((k, i) => hilo(ctx, k, nudo, cuerda, 3, i % 2 ? -26 : 26));
        lazo(ctx, nudo.x, nudo.y, 22, th.a);
      };
      if (d.kind === "card") {
        lab(g, d.church, M, 100, { color: th.ink, size: 19, alpha: 0.85 });
        if (d.kicker) lab(g, d.kicker, M, 144, { color: th.a, size: 26 });
        // el lazo queda por encima del titular: el titular empieza debajo de sus colas
        const nudo = { x: W - 300, y: 500 };
        if (d.occasion === "bodas") ramo([[W - 380, 250, 132, th.a, -0.12], [W - 210, 280, 124, th.b, 0.12]], nudo);
        else ramo([[W - 200, 170, 94, th.c, 0.16], [W - 395, 230, 122, th.a, -0.1], [W - 215, 350, 100, th.b, 0.08]], nudo);
        const [lead, main] = partes(d.headline);
        const big = fitB(g, main, (s) => F("Yellowtail", s), { maxW: W - 2 * M, maxLines: 2, start: 196, min: 90, lh: 1.02, maxH: 320 });
        const lf = F("Oswald", 64, 700), leadH = 64 * 0.82;
        // «¡FELIZ» pegado encima de la palabra en caligrafía (hueco < 0.3 de su alto)
        const leadBase = 610, y1 = (lead ? leadBase + 12 : 560) + big.size * 0.7;
        if (lead) g.text(lead.toUpperCase(), M, leadBase, { font: lf, color: th.ink, sp: 4 });
        void leadH;
        let y = g.lines(big.lines, M - 8, y1, big.lh, { font: big.font, color: th.a }) + big.size * 0.36 + 64;
        const nm = g.fit(d.name, (s) => F("Oswald", s, 700), { maxW: W - 2 * M, maxLines: 2, start: 72, min: 44, lh: 1.08 });
        y = g.lines(nm.lines, M, y, nm.lh, { font: nm.font, color: th.ink }) + 50;
        const ln = g.fit(d.line, (s) => F("Hanken Grotesk", s, 600), { maxW: W - 2 * M, maxLines: 2, start: 36, min: 30, lh: 1.25 });
        y = g.lines(ln.lines, M, y, ln.lh, { font: ln.font, color: th.ink, alpha: 0.92 }) + 50;
        versito(g, M, y, W - 2 * M, H - 176, { color: th.ink, refColor: th.a, start: 30, min: 22, refSize: 20 });
        const sg = g.fit(d.signature, (s) => F("Yellowtail", s), { maxW: 360, maxLines: 1, start: 58, min: 32 });
        g.text(d.signature, W - M, H - 120, { font: sg.font, color: th.ink, align: "right" });
        const fr = g.fit(d.from, (s) => F("Hanken Grotesk", s, 600), { maxW: 420, maxLines: 1, start: 24, min: 18 });
        g.text(d.from, W - M, H - 78, { font: fr.font, color: th.ink, align: "right", alpha: 0.8 });
        g.logo(M, H - 116, 52, { white: oscuro, align: "left" });
      } else if (d.kind === "ann") {
        lab(g, d.church, M, 100, { color: th.ink, size: 19, alpha: 0.85 });
        const nudo = { x: W - 300, y: 690 }, cx = W - 300, cy = 350, r = 190;
        globo(ctx, W - 120, 190, 92, th.b, 0.2);
        const k1 = globo(ctx, cx, cy, r, th.a, -0.04);
        hilo(ctx, { x: W - 120 - Math.sin(0.2) * 92 * 1.19, y: 190 + Math.cos(0.2) * 92 * 1.19 }, nudo, cuerda, 3, -30);
        hilo(ctx, k1, nudo, cuerda, 3, 20); lazo(ctx, nudo.x, nudo.y, 22, th.b);
        const enG = sobre(g, th.a);
        const y0 = 330;
        if (d.date) {
          const df = g.fit(d.day, (s) => F("Oswald", s, 700), { maxW: r * 1.3, maxLines: 1, start: 200, min: 80 });
          g.text(d.day, cx - 6, cy + df.size * 0.32, { font: df.font, color: enG, align: "center", rotate: -0.04 });
          g.text(d.month.toUpperCase(), cx - 2, cy + df.size * 0.32 + 52, { font: F("Montserrat", 26, 800), color: enG, sp: 4, align: "center", rotate: -0.04 });
          g.text(cap(d.weekday), M - 4, y0, { font: F("Yellowtail", 96), color: th.a });
          const [hh, ap] = hora(d.time);
          const w = g.text(hh, M, y0 + 116, { font: F("Oswald", 84, 700), color: th.ink });
          lab(g, ap, M + w + 14, y0 + 116, { color: th.ink, size: 28 });
        } else {
          g.text("¡Ven!", cx - 4, cy + 34, { font: F("Yellowtail", 124), color: enG, align: "center", rotate: -0.04 });
          const li = fitB(g, "¡Les invitamos!", (s) => F("Yellowtail", s), { maxW: W - 2 * M - 440, maxLines: 2, start: 100, min: 56, lh: 1.1 });
          g.lines(li.lines, M - 4, y0 + 20, li.lh, { font: li.font, color: th.a });
        }
        // el bloque del título se apoya abajo; el aire entre globos y título es a propósito
        const fondo = H - 180;
        const pl = d.place ? g.fit(d.place, (s) => F("Hanken Grotesk", s, 600), { maxW: W - 2 * M - 50, maxLines: 2, start: 36, min: 26, lh: 1.25 }) : null;
        const plH = pl ? pl.h + 34 : 0;
        const tt = fitB(g, d.title, (s) => F("Oswald", s, 700), { maxW: W - 2 * M, maxLines: 4, start: 150, min: 56, lh: 1.04, maxH: fondo - plH - 780 });
        let y = fondo - plH - tt.h + tt.size * 0.84;
        y = g.lines(tt.lines, M - 4, y, tt.lh, { font: tt.font, color: th.ink }) + 34;
        if (pl) {
          disco(ctx, M + 12, y + pl.size * 0.62, 12, th.a);
          g.lines(pl.lines, M + 46, y + pl.size * 0.95, pl.lh, { font: pl.font, color: th.ink, alpha: 0.92 });
        }
        g.logo(W - M, H - 130, 60, { white: oscuro, align: "right" });
      } else {
        // un solo globo; su hilo baja por el margen y se ata con un lazo junto a la cita
        const top = story ? 230 : 110, bot = H - (story ? 260 : 80);
        const gr = story ? 112 : 84, gx = W - 160, gy = top + gr + 10, k = globo(ctx, gx, gy, gr, th.a, 0.14);
        lab(g, d.eyebrow || (d.firma ? "Palabra para hoy" : d.church), M, top, { color: th.ink, size: 19, alpha: 0.85 });
        let y = top + 40;
        if (d.head) {
          const hd = g.fit(d.head, (s) => F("Yellowtail", s), { maxW: W - 2 * M - 240, maxLines: 2, start: story ? 140 : 110, min: 56, lh: 1.05 });
          y = g.lines(hd.lines, M - 4, y + hd.size * 0.85, hd.lh, { font: hd.font, color: th.a }) + hd.size * 0.42;
        } else y += 30;
        const refS = story ? 84 : 66, gap = refS * 1.25, area = bot - y - gap - 30 - (d.firma ? 40 : 0);
        const v = fitB(g, d.text, (s) => F("Oswald", s, 600), { maxW: W - 2 * M - 150, maxLines: 14, start: story ? 170 : 130, min: 34, lh: 1.16, maxH: area, step: 4 });
        y += Math.max(0, (area - v.h) * (story ? 0.5 : 0.4));
        y = g.lines(v.lines, M - 3, y + v.size * 0.8, v.lh, { font: v.font, color: th.ink }) + gap;
        const rw = g.text(d.ref, M - 2, y, { font: F("Yellowtail", refS), color: th.a });
        // el hilo termina en un lazo después de la cita
        const bx = Math.min(W - 120, M + rw + 60), by = y - refS * 0.3;
        ctx.save(); ctx.strokeStyle = cuerda; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(k.x, k.y);
        ctx.bezierCurveTo(k.x - 40, k.y + (by - k.y) * 0.45, k.x + 40, by - 40, bx + 30, by); ctx.lineTo(bx, by); ctx.stroke(); ctx.restore();
        lazo(ctx, bx, by, story ? 22 : 18, th.a);
        if (d.firma) lab(g, d.church, M, bot, { color: th.ink, size: 17, alpha: 0.75 });
        else g.logo(W - M, bot - 50, 54, { white: oscuro, align: "right" });
      }
    },
  });

  // =====================================================================================
  // «Escarapela»: un sello de listón plisado puesto de lado, como el sello de un diploma, sobre una franja de
  // color (o de foto en duotono). Letra condensada en mayúsculas, todo alineado a la izquierda; el nombre y la
  // cita del versículo van en una cinta que sale del borde.
  E.add({
    id: "fie-escarapela", name: "Escarapela", family: "fiesta", fonts: ["Bebas Neue", "Oswald", "Montserrat", "Hanken Grotesk"],
    themes: {
      marino: { name: "Marino y oro", bg: "#0d1b3d", ink: "#ffffff", a: "#f2c85b", b: "#2d5fa8", c: "#fffaf0" },
      crema: { name: "Crema y rojo", bg: "#f4ecdf", ink: "#1e1e2a", a: "#d8342c", b: "#1e1e2a", c: "#ffffff" },
      azul: { name: "Azul y amarillo", bg: "#e3edf7", ink: "#0f2a52", a: "#2b6cc4", b: "#ffcc33", c: "#ffffff" },
      verde: { name: "Verde y mostaza", bg: "#224d3c", ink: "#ffffff", a: "#f6b93b", b: "#e55039", c: "#fff8ea" },
      rosa: { name: "Rosa y oro", bg: "#fbe3e8", ink: "#4a1530", a: "#e0456b", b: "#f4b860", c: "#ffffff" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 90;
      const story = d.kind === "verse" && g.fmt === "historia";
      g.paper(th.bg, { fibers: 0.35, grain: 0.06, mottle: 0.5 });
      const oscuro = g.lum(th.bg) < 0.5, dk = "#1b1b1b";
      // franja de arriba: color plano o foto en duotono (oscuro del tema → color del sello)
      const franja = (h) => {
        const dark = g.lum(th.bg) < 0.4 ? th.bg : th.ink, light = g.mix(th.a, "#ffffff", 0.35);
        if (!duo(g, 0, 0, W, h, dark, light, { focusY: 0.55 })) { ctx.fillStyle = th.b; ctx.fillRect(0, 0, W, h); g.grain(0.04); }
      };
      // etiqueta de papel con la iglesia (se lee igual sobre color o sobre foto)
      const tag = (s, x, y) => {
        const f = F("Montserrat", 18, 700), w = g.measure(s.toUpperCase(), f, 3) + 36;
        ctx.fillStyle = th.c; ctx.fillRect(x, y, w, 44);
        g.text(s.toUpperCase(), x + 18, y + 29, { font: f, color: dk, sp: 3 });
      };
      // dentro del sello: grande arriba, chico abajo
      const enSello = (cx, cy, r, big, small, o = {}) => {
        const bf = g.fit(big, (s) => F("Bebas Neue", s), { maxW: r * 1.22, maxLines: 1, start: r * (o.k || 1.05), min: 26 });
        const sf = small ? g.fit(small.toUpperCase(), (s) => F("Oswald", s, 700), { maxW: r * 1.15, maxLines: 1, start: r * 0.3, min: 14, sp: 2 }) : null;
        const hb = bf.size * 0.7, hs = sf ? sf.size * 0.8 + 12 : 0, y0 = cy - (hb + hs) / 2 + hb;
        g.text(big, cx, y0, { font: bf.font, color: th.a, align: "center" });
        if (sf) g.text(sf.lines[0], cx, y0 + 12 + sf.size * 0.8, { font: sf.font, color: dk, align: "center", sp: 2 });
      };
      // cinta que sale del borde izquierdo con la punta en cola de golondrina
      const cinta = (y, w, h, c) => {
        ctx.fillStyle = g.mix(c, "#000", 0.28); ctx.fillRect(0, y + h, 26, 14);
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w + h * 0.45, y); ctx.lineTo(w, y + h / 2); ctx.lineTo(w + h * 0.45, y + h); ctx.lineTo(0, y + h); ctx.closePath(); ctx.fill();
      };
      if (d.kind === "card") {
        const fh = 300, r = 150, scx = M + r, scy = fh;
        franja(fh);
        tag(d.church, M, 64);
        g.logo(W - M, 62, 50, { white: true, align: "right" });
        escarapela(ctx, scx, scy, r, th.a, th.b === th.ink ? th.a : th.b, th.c, { largo: 1.25, abre: 0.3 });
        const kp = fecha(d.kicker);
        if (kp) enSello(scx, scy, r * 0.62, kp[0], kp[1]); else cruz(ctx, scx, scy, r * 0.6, th.a);
        // a la derecha del sello, la ocasión en pequeño
        const occ = d.occasion === "bodas" ? "Aniversario" : d.occasion === "cumple" ? "Cumpleaños" : "Felicidades";
        lab(g, kp ? occ : d.kicker || occ, scx + r + 46, fh + 84, { color: th.a, size: 28, sp: 4 });
        const [lead, main] = partes(d.headline);
        // abajo hacia arriba: firma, frase, cinta del nombre, titular
        const nm = g.fit(d.name.toUpperCase(), (s) => F("Oswald", s, 700), { maxW: W - 2 * M - 100, maxLines: 2, start: 60, min: 38, lh: 1.08, sp: 1 });
        const ln = g.fit(d.line, (s) => F("Hanken Grotesk", s, 600), { maxW: W - 2 * M, maxLines: 2, start: 40, min: 34, lh: 1.25 });
        const ribH = nm.h + 40;
        const top = fh + r * 1.3 + 50, fondo = H - 180;
        const hd = fitB(g, main.toUpperCase(), (s) => F("Bebas Neue", s), { maxW: W - 2 * M, maxLines: 2, start: 260, min: 100, lh: 0.88, maxH: fondo - top - ribH - ln.h - 90 - (lead ? 70 : 0) });
        const total = (lead ? 70 : 0) + hd.h + 40 + ribH + 46 + ln.h;
        let y = top + Math.max(0, (fondo - top - total) * 0.5);
        if (lead) { g.text(lead.toUpperCase(), M, y + 54, { font: F("Oswald", 60, 700), color: th.a, sp: 3 }); y += 70; }
        y = g.lines(hd.lines, M - 4, y + hd.size * 0.72, hd.lh, { font: hd.font, color: th.ink }) + hd.size * 0.18 + 40;
        const nw = Math.max(...nm.lines.map((l) => g.measure(l, nm.font, 1)));
        cinta(y, M + nw + 50, ribH, th.a);
        g.lines(nm.lines, M, y + 20 + nm.size * 0.8, nm.lh, { font: nm.font, color: sobre(g, th.a), sp: 1 });
        y += ribH + 46 + ln.size * 0.8;
        g.lines(ln.lines, M, y, ln.lh, { font: ln.font, color: th.ink });
        const sg = g.fit(d.signature.toUpperCase(), (s) => F("Oswald", s, 600), { maxW: W - 2 * M, maxLines: 1, start: 40, min: 30, sp: 2 });
        g.text(d.signature.toUpperCase(), M, H - 112, { font: sg.font, color: th.a, sp: 2 });
        const fr = g.fit(d.from, (s) => F("Hanken Grotesk", s, 600), { maxW: W - 2 * M, maxLines: 1, start: 34, min: 26 });
        g.text(d.from, M, H - 66, { font: fr.font, color: th.ink, alpha: 0.85 });
      } else if (d.kind === "ann") {
        const fh = 400, r = 190, scx = W - M - r + 10, scy = fh;
        franja(fh);
        tag(d.church, M, 64);
        escarapela(ctx, scx, scy, r, th.a, th.b === th.ink ? th.a : th.b, th.c, { largo: 1.2, abre: 0.3 });
        if (d.date) enSello(scx, scy, r * 0.62, d.day, d.month);
        else cruz(ctx, scx, scy, r * 0.62, th.a);
        const colL = scx - r - 40 - M;
        let y = fh + 90;
        if (d.date) {
          const wd = g.fit(d.weekday.toUpperCase(), (s) => F("Oswald", s, 700), { maxW: colL, maxLines: 1, start: 64, min: 36, sp: 3 });
          g.text(d.weekday.toUpperCase(), M, y, { font: wd.font, color: th.a, sp: 3 });
          g.text(d.time.toUpperCase(), M, y + 58, { font: F("Oswald", 44, 500), color: th.ink, sp: 2 });
        } else {
          const li = g.fit("¡LES INVITAMOS!", (s) => F("Oswald", s, 700), { maxW: colL, maxLines: 1, start: 64, min: 36, sp: 3 });
          g.text("¡LES INVITAMOS!", M, y, { font: li.font, color: th.a, sp: 3 });
        }
        // de abajo hacia arriba: cinta con «Les esperamos», lugar, título grande
        const rib = 96, ribY = H - 70 - rib;
        const pl = d.place ? g.fit(d.place, (s) => F("Hanken Grotesk", s, 600), { maxW: W - 2 * M, maxLines: 2, start: 38, min: 30, lh: 1.25 }) : null;
        const plH = pl ? pl.h + 20 : 0, top = fh + r * 1.25 + 40, fondo = ribY - 60 - plH;
        const tt = fitB(g, d.title.toUpperCase(), (s) => F("Bebas Neue", s), { maxW: W - 2 * M, maxLines: 4, start: 230, min: 70, lh: 0.9, maxH: fondo - top });
        y = fondo - tt.h + tt.size * 0.74;
        y = g.lines(tt.lines, M - 4, y, tt.lh, { font: tt.font, color: th.ink }) + tt.size * 0.16 + 30;
        if (pl) g.lines(pl.lines, M, y + pl.size * 0.8, pl.lh, { font: pl.font, color: th.ink, alpha: 0.9 });
        const ef = F("Oswald", 52, 700), ew = g.measure("¡LES ESPERAMOS!", ef, 3);
        cinta(ribY, M + ew + 50, rib, th.a);
        g.text("¡LES ESPERAMOS!", M, ribY + rib / 2 + 19, { font: ef, color: sobre(g, th.a), sp: 3 });
        g.logo(W - M, ribY + 14, 66, { white: oscuro, align: "right" });
      } else {
        const top = story ? 230 : 90, bot = H - (story ? 250 : 70);
        const r = story ? 220 : g.fmt === "post" ? 172 : 146;
        let y = top;
        if (g.photoOn) {
          const fh = story ? 300 : g.fmt === "post" ? 260 : 210;
          franja(fh);
          tag(d.eyebrow || d.church, M, story ? 230 : 56);
          y = fh + 40;
        } else { lab(g, d.eyebrow || d.church, M, y + 18, { color: th.ink, size: 18, alpha: 0.85 }); y += 50; }
        if (d.head) {
          const hd = g.fit(d.head.toUpperCase(), (s) => F("Bebas Neue", s), { maxW: W - 2 * M, maxLines: 2, start: story ? 116 : 110, min: 60, lh: 0.92 });
          y = g.lines(hd.lines, M - 3, y + hd.size * 0.8, hd.lh, { font: hd.font, color: th.a }) + hd.size * 0.3;
        }
        // grupo: versículo + cinta con capítulo:versículo + sello con el libro
        const firmaH = d.firma ? 54 : 0, grp = r * 2.1, area = bot - firmaH - y - grp - 40;
        const v = fitB(g, d.text, (s) => F("Oswald", s, 600), { maxW: W - 2 * M, maxLines: 14, start: story ? 140 : 124, min: 38, lh: 1.16, maxH: area, step: 4 });
        y += Math.max(0, (area - v.h) * 0.5);
        g.lines(v.lines, M - 3, y + v.size * 0.8, v.lh, { font: v.font, color: th.ink });
        const scy = y + v.h + 40 + r, scx = W - M - r + 10;
        const [book, num] = cita(d.ref);
        const rib = Math.max(84, r * 0.62);
        cinta(scy - rib / 2, scx - r * 0.5, rib, th.b === th.ink ? th.a : th.b);
        escarapela(ctx, scx, scy, r, th.a, th.b === th.ink ? th.a : th.b, th.c, { largo: 1.05, abre: 0.3 });
        const rc = sobre(g, th.b === th.ink ? th.a : th.b);
        if (num) {
          enSello(scx, scy, r * 0.95, book.toUpperCase(), "", { k: 0.5 });
          const nf = g.fit(num, (s) => F("Bebas Neue", s), { maxW: scx - r - M - 30, maxLines: 1, start: rib * 0.9, min: 40 });
          g.text(num, M, scy + nf.size * 0.36, { font: nf.font, color: rc });
        } else {
          cruz(ctx, scx, scy, r * 0.6, th.a);
          const nf = g.fit(book.toUpperCase(), (s) => F("Bebas Neue", s), { maxW: scx - r - M - 30, maxLines: 1, start: rib * 0.8, min: 30 });
          g.text(book.toUpperCase(), M, scy + nf.size * 0.36, { font: nf.font, color: rc });
        }
        if (d.firma) lab(g, d.church, M, bot, { color: th.ink, size: 17, alpha: 0.75 });
        else g.logo(M, bot - 54, 54, { white: oscuro, align: "left" });
      }
    },
  });

  // =====================================================================================
  // «Pastel»: glaseado que escurre, en cursiva redonda. En la tarjeta, un bloque de glaseado arriba con el titular;
  // en el aviso, la información va en las capas de una rebanada; en el versículo solo el goteo.
  // Con foto, la foto va en su propia ventana en duotono con los dos colores del tema: nunca sobre el glaseado.
  E.add({
    id: "fie-pastel", name: "Pastel", family: "fiesta", fonts: ["Shrikhand", "Caveat", "Montserrat", "Hanken Grotesk"],
    themes: {
      fresa: { name: "Fresa y vainilla", bg: "#fde9e5", ink: "#4b1d2a", icing: "#e94f6a", cake: "#ffc857", flame: "#e94f6a" },
      marino: { name: "Marino y oro", bg: "#0d1b3d", ink: "#ffffff", icing: "#f2c85b", cake: "#2d5fa8", flame: "#f2c85b" },
      menta: { name: "Menta y chocolate", bg: "#dff2ea", ink: "#3b2418", icing: "#3b2418", cake: "#f28c8c", flame: "#f28c8c" },
      mora: { name: "Mora", bg: "#3d1e4f", ink: "#ffffff", icing: "#f7a8c4", cake: "#ffd166", flame: "#ffd166" },
      limon: { name: "Limón y cereza", bg: "#fff3c4", ink: "#1d3557", icing: "#1d3557", cake: "#e63946", flame: "#e63946" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 84;
      const story = d.kind === "verse" && g.fmt === "historia";
      g.paper(th.bg, { fibers: 0.3, grain: 0.05, mottle: 0.4 });
      const oscuro = g.lum(th.bg) < 0.5, enI = sobre(g, th.icing);
      // los dos colores del duotono: el más oscuro del pastel y el más claro
      let dkD = oscuroDe(g, th.icing, th.cake), ltD = claroDe(g, th.icing, th.cake);
      if (g.lum(dkD) > 0.5) dkD = oscuro ? th.bg : th.ink;
      if (g.lum(ltD) < 0.55) ltD = oscuro ? g.mix(ltD, "#ffffff", 0.55) : th.bg;
      // ventana redondeada con la foto y un poco de glaseado chorreando en su borde de arriba
      const ventana = (x, y, w, h) => {
        const p = (c) => { if (c.roundRect) c.roundRect(x, y, w, h, 28); else c.rect(x, y, w, h); };
        if (!duo(g, x, y, w, h, dkD, ltD, { path: p })) return false;
        goteo(g, x, y, w, y + 22, th.icing, { max: 64, min: 10, dw: 30, path: p });
        return true;
      };
      if (d.kind === "card") {
        const [lead, main] = partes(d.headline);
        const hd = fitB(g, main, (s) => F("Shrikhand", s), { maxW: W - 2 * M, maxLines: 2, start: 156, min: 64, lh: 1.04, maxH: 300 });
        const y1 = 170 + (lead ? 112 : 0) + hd.h + 40;
        goteo(g, 0, 0, W, y1, th.icing, { max: 120, dw: 56 });
        lab(g, d.church, M, 96, { color: enI, size: 18, alpha: 0.85 });
        if (d.kicker) lab(g, d.kicker, W - M, 96, { color: enI, size: 20, align: "right" });
        let y = 170;
        if (lead) { g.text(lead, M - 2, y + 86, { font: F("Caveat", 110, 700), color: enI }); y += 112; }
        g.lines(hd.lines, M - 6, y + hd.size * 0.86, hd.lh, { font: hd.font, color: enI });
        // con foto: ventana a la derecha y el texto en una columna; sin foto, el texto a todo lo ancho
        const wW = 340, wy = y1 + 140, hasP = g.photoOn && ventana(W - M - wW, wy, wW, H - 90 - wy);
        const colW = hasP ? W - 2 * M - wW - 50 : W - 2 * M;
        const nm = g.fit(d.name, (s) => F("Montserrat", s, 800), { maxW: colW, maxLines: 3, start: 96, min: 40, lh: 1.08 });
        const ln = g.fit(d.line, (s) => F("Hanken Grotesk", s, 700), { maxW: colW, maxLines: 3, start: 40, min: 32, lh: 1.25 });
        const vo = { color: th.ink, refColor: oscuro ? th.icing : th.ink, maxLines: 7, start: 32, min: 24, refSize: 20 };
        // el grupo nombre + frase + versículo se reparte en el alto entre el goteo y la firma
        const g0 = y1 + 120 + nm.size * 0.8, lim = H - 200;
        const hTxt = nm.h + 40 + ln.h + 50;
        const vEnd = versito(g, M, g0 + hTxt, colW, lim, { ...vo, dry: true }) - (g0 + hTxt);
        y = g0 + Math.max(0, (lim - g0 - hTxt - vEnd) * 0.45);
        y = g.lines(nm.lines, M, y, nm.lh, { font: nm.font, color: th.ink }) + 40 + ln.size * 0.8;
        y = g.lines(ln.lines, M, y, ln.lh, { font: ln.font, color: th.ink }) + 50;
        versito(g, M, y, colW, lim, vo);
        const sg = g.fit(d.signature, (s) => F("Caveat", s, 700), { maxW: colW, maxLines: 1, start: 64, min: 36 });
        g.text(d.signature, M, H - 116, { font: sg.font, color: oscuro ? th.icing : th.ink });
        const fr = g.fit(d.from, (s) => F("Hanken Grotesk", s, 600), { maxW: colW, maxLines: 1, start: 26, min: 18 });
        g.text(d.from, M, H - 72, { font: fr.font, color: th.ink, alpha: 0.8 });
      } else if (d.kind === "ann") {
        // la rebanada, medida de abajo hacia arriba según el texto que lleva cada capa
        const tc = sobre(g, th.icing), cc = sobre(g, th.cake);
        const pl = d.place ? g.fit(d.place, (s) => F("Montserrat", s, 700), { maxW: W - 2 * M, maxLines: 2, start: 38, min: 26, lh: 1.25 }) : null;
        const drip = 80, padT = 56, cakeIn = (pl ? pl.h + 40 : 0) + 76, hc = drip + padT + cakeIn + 70;
        const hI = d.date ? 250 : 200, s1 = H - hc, s0 = s1 - hI;
        lab(g, d.church, M, 100, { color: th.ink, size: 18, alpha: 0.85 });
        g.logo(W - M, 58, 58, { white: oscuro, align: "right" });
        let tTop = 170;
        const winH = d.title.length > 34 ? 150 : 250;
        if (g.photoOn && ventana(M, 150, W - 2 * M, winH)) tTop = 200 + winH;
        const tt = fitB(g, d.title, (s) => F("Shrikhand", s), { maxW: W - 2 * M, maxLines: 4, start: 130, min: 50, lh: 1.08, maxH: s0 - 50 - tTop });
        // el título se apoya justo encima del glaseado
        g.lines(tt.lines, M - 4, s0 - 60 - tt.h + tt.size * 0.92, tt.lh, { font: tt.font, color: th.ink });
        ctx.fillStyle = th.cake; ctx.fillRect(0, s1, W, H - s1);
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, s1 - 4, W, 14);
        goteo(g, 0, s0, W, s1, th.icing, { max: drip, min: 14, dw: 52 });
        if (d.date) {
          g.text(cap(d.weekday), M - 2, s0 + 92, { font: F("Caveat", 84, 700), color: tc });
          g.text(d.time.toUpperCase(), W - M, s0 + 84, { font: F("Montserrat", 36, 800), color: tc, align: "right", sp: 2 });
          const df = g.fit(`${d.day} de ${d.month}`, (s) => F("Montserrat", s, 800), { maxW: W - 2 * M, maxLines: 1, start: 96, min: 50 });
          g.text(`${d.day} de ${d.month}`, M - 4, s0 + 200, { font: df.font, color: tc });
        } else {
          g.text("¡Les invitamos!", M - 2, s0 + 130, { font: F("Caveat", 110, 700), color: tc });
        }
        let y = s1 + drip + padT;
        if (pl) { g.lines(pl.lines, M, y + pl.size * 0.8, pl.lh, { font: pl.font, color: cc }); y += pl.h + 40; }
        if (d.place) g.text("¡Les esperamos!", M - 2, y + 56, { font: F("Caveat", 76, 700), color: cc });
        else lab(g, "Todos son bienvenidos", M, y + 40, { color: cc, size: 32, sp: 4 });
      } else {
        const bh = d.head ? (story ? 560 : 320) : (story ? 340 : 160);
        goteo(g, 0, 0, W, bh, th.icing, { max: 90, dw: 56 });
        // con foto: la foto en blanco y negro aclara el glaseado con 'screen', sin ensuciar su color
        if (g.photoOn) { ctx.save(); ctx.globalAlpha = 0.24; ctx.globalCompositeOperation = "screen"; g.photo(0, 0, W, bh, { treat: "bn" }); ctx.restore(); }
        const tc = enI;
        if (d.head) {
          lab(g, d.eyebrow || d.church, M, story ? 250 : 80, { color: tc, size: 18, alpha: 0.85 });
          const hd = fitB(g, d.head, (s) => F("Shrikhand", s), { maxW: W - 2 * M, maxLines: 2, start: story ? 120 : 96, min: 48, lh: 1.1, maxH: bh - (story ? 320 : 130) });
          g.lines(hd.lines, M - 4, (story ? 300 : 120) + hd.size * 0.95, hd.lh, { font: hd.font, color: tc });
        } else lab(g, d.eyebrow || d.church, M, story ? 260 : 80, { color: tc, size: 18, alpha: 0.85 });
        // el versículo centrado ópticamente entre el goteo y el pie
        const bot = H - (story ? 260 : 80), y0 = bh + 110, refG = story ? 110 : 90;
        const area = bot - y0 - refG - (d.firma ? 50 : 30);
        const v = fitB(g, d.text, (s) => F("Montserrat", s, 800), { maxW: W - 2 * M, maxLines: 14, start: story ? 140 : 116, min: 30, lh: 1.15, maxH: area, step: 4 });
        let y = y0 + Math.max(0, (area - v.h) * 0.45);
        y = g.lines(v.lines, M - 3, y + v.size * 0.78, v.lh, { font: v.font, color: th.ink }) + refG;
        g.text(d.ref, M - 2, y, { font: F("Caveat", story ? 72 : 62, 700), color: oscuro ? th.icing : th.ink });
        if (d.firma) lab(g, d.church, M, bot, { color: th.ink, size: 17, alpha: 0.75 });
        else g.logo(W - M, bot - 50, 54, { white: oscuro, align: "right" });
      }
    },
  });

  // =====================================================================================
  // «Confeti»: un bloque grande de color plano que sangra por la izquierda y una lluvia de confeti (tiras,
  // círculos, triángulos y rizos) que nace de la esquina de arriba y se va aclarando. Palo seco ancha, sin serifas.
  // Con foto, la foto llena el fondo en blanco y negro bajo un velo oscuro y el bloque sigue plano encima.
  E.add({
    id: "fie-confeti", name: "Confeti", family: "fiesta", fonts: ["Archivo Black", "Montserrat", "Hanken Grotesk"],
    themes: {
      marino: { name: "Marino y oro", bg: "#0d1b3d", ink: "#ffffff", block: "#2d5fa8", dot: "#f2c85b" },
      coral: { name: "Coral y añil", bg: "#fbf4ea", ink: "#1b1b1b", block: "#ff5a4e", dot: "#1f3a93" },
      verde: { name: "Verde y girasol", bg: "#f0ede4", ink: "#10241c", block: "#1f6f50", dot: "#ffb703" },
      fucsia: { name: "Fucsia y limón", bg: "#1c1c1c", ink: "#ffffff", block: "#e23d80", dot: "#ffd23f" },
      mandarina: { name: "Mandarina y tinta", bg: "#fff6e9", ink: "#003049", block: "#f77f00", dot: "#003049" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 84;
      const story = d.kind === "verse" && g.fmt === "historia";
      const velo = g.lum(th.bg) < 0.5 ? th.bg : th.ink;
      const conFoto = g.photoOn && g.photo(0, 0, W, H, { treat: "bn", tint: g.rgba(velo, 0.66) });
      if (conFoto) g.grain(0.05); else g.paper(th.bg, { fibers: 0.3, grain: 0.05, mottle: 0.4 });
      const oscuro = conFoto || g.lum(th.bg) < 0.5, blanco = "#ffffff";
      const ink = conFoto ? blanco : th.ink, tercero = oscuro ? blanco : th.ink;
      const acento = oscuro && g.lum(th.dot) < 0.35 ? blanco : th.dot;
      const bloque = (x, y, w, h) => { ctx.fillStyle = th.block; ctx.fillRect(x, y, w, h); return sobre(g, th.block); };
      // confeti desde la esquina de arriba a la derecha; nunca encima del texto
      const confeti = (bw, by, bh, libres, n = 20) => {
        const fuera = (x, y, r) => libres.every(([x0, y0, x1, y1]) => x + r < x0 || x - r > x1 || y + r < y0 || y - r > y1);
        lluvia(g, {
          x: W - 56, y: 46, a0: Math.PI * 0.5, a1: Math.PI * 1.0, spread: 620, n, s: 44, dens: 1.9, ok: fuera,
          color: (x, y, i) => { const enB = x < bw && y > by && y < by + bh; const L = enB ? [acento, blanco, acento] : [acento, th.block, tercero, acento]; return L[i % L.length]; },
        });
      };
      if (d.kind === "card") {
        const by = 170, bw = W - 150;
        const [lead, main] = partes(d.headline);
        const big = fitB(g, main.toLowerCase(), (s) => F("Archivo Black", s), { maxW: bw - 2 * M + 10, maxLines: 3, start: 200, min: 70, lh: 0.98, maxH: 380 });
        const nm = g.fit(d.name, (s) => F("Montserrat", s, 800), { maxW: bw - 2 * M, maxLines: 2, start: 60, min: 36, lh: 1.12 });
        // el bloque mide su contenido: fecha, «¡Feliz», titular y el nombre
        const head0 = by + 84 + (lead ? 104 : 30), hEnd = head0 + big.size * 0.74 + (big.lines.length - 1) * big.lh;
        const bh = hEnd - by + 50 + nm.h + 70;
        const tc = bloque(0, by, bw, bh);
        lab(g, d.church, M, 100, { color: ink, size: 18, alpha: 0.85 });
        if (d.kicker) lab(g, d.kicker, M, by + 74, { color: tc, size: 24 });
        if (lead) g.text(lead, M - 4, by + 84 + 82, { font: F("Montserrat", 84, 700, true), color: tc });
        g.lines(big.lines, M - 8, head0 + big.size * 0.74, big.lh, { font: big.font, color: tc });
        const yl = g.lines(nm.lines, M, hEnd + 50 + nm.size * 0.8, nm.lh, { font: nm.font, color: tc });
        const hw = Math.max(...big.lines.map((l) => g.measure(l, big.font)), ...nm.lines.map((l) => g.measure(l, nm.font)));
        confeti(bw, by, bh, [[M - 20, 60, M + 520, 120], [M - 20, by + 30, M + Math.max(hw, 520) + 30, yl + 30], [0, by + bh + 40, W, H]], 22);
        // debajo: frase y versículo repartidos en el alto que queda hasta la firma
        const ln = g.fit(d.line, (s) => F("Hanken Grotesk", s, 700), { maxW: W - 2 * M, maxLines: 2, start: 40, min: 34, lh: 1.25 });
        const vo = { color: ink, refColor: acento === blanco ? blanco : (oscuro ? th.dot : th.block), start: 34, min: 26, refSize: 22, weight: 500 };
        const g0 = by + bh + 70 + ln.size * 0.8, lim = H - 210;
        const vEnd = versito(g, M, g0 + ln.h + 40, W - 2 * M, lim, { ...vo, dry: true }) - (g0 + ln.h + 40);
        let y = g0 + Math.max(0, (lim - g0 - ln.h - 40 - vEnd) * 0.4);
        y = g.lines(ln.lines, M, y, ln.lh, { font: ln.font, color: ink }) + 40 + ln.size * 0.3;
        versito(g, M, y, W - 2 * M, lim, vo);
        const sg = g.fit(d.signature, (s) => F("Montserrat", s, 700, true), { maxW: 460, maxLines: 1, start: 44, min: 28 });
        g.text(d.signature, W - M, H - 116, { font: sg.font, color: ink, align: "right" });
        const fr = g.fit(d.from, (s) => F("Hanken Grotesk", s, 600), { maxW: 460, maxLines: 1, start: 26, min: 18 });
        g.text(d.from, W - M, H - 74, { font: fr.font, color: ink, align: "right", alpha: 0.8 });
        g.logo(M, H - 128, 56, { white: oscuro, align: "left" });
      } else if (d.kind === "ann") {
        let by = 150; const bw = W - 150;
        lab(g, d.church, M, 96, { color: ink, size: 18, alpha: 0.85 });
        let y, libres;
        if (d.date) {
          const bh = 620, tc = bloque(0, by, bw, bh);
          lab(g, d.weekday, M, by + 80, { color: tc, size: 26 });
          const df = g.fit(d.day, (s) => F("Archivo Black", s), { maxW: bw - 2 * M, maxLines: 1, start: 380, min: 120 });
          g.text(d.day, M - 14, by + 96 + df.size * 0.74, { font: df.font, color: tc });
          g.text(d.month, M - 4, by + bh - 64, { font: F("Montserrat", 80, 700, true), color: tc });
          const [hh, ap] = hora(d.time);
          g.text(`${hh} ${ap}`, bw - M + 30, by + bh - 68, { font: F("Archivo Black", 40), color: tc, align: "right" });
          libres = [[M - 20, 60, M + 520, 120], [M - 20, by + 30, bw - M + 60, by + bh - 20], [0, by + bh + 40, W, H]];
          confeti(bw, by, bh, libres, 20);
          y = by + bh + 100;
          const pl = d.place ? g.fit(d.place, (s) => F("Hanken Grotesk", s, 600), { maxW: W - 2 * M - 200, maxLines: 2, start: 36, min: 26, lh: 1.25 }) : null;
          const tt = fitB(g, d.title, (s) => F("Archivo Black", s), { maxW: W - 2 * M, maxLines: 3, start: 110, min: 44, lh: 1.08, maxH: H - y - (pl ? pl.h + 140 : 120) });
          y = g.lines(tt.lines, M - 4, y + tt.size * 0.78, tt.lh, { font: tt.font, color: ink }) + tt.size * 0.3 + 44;
          if (pl) g.lines(pl.lines, M, y, pl.lh, { font: pl.font, color: ink, alpha: 0.92 });
        } else {
          const tt = fitB(g, d.title.toLowerCase(), (s) => F("Archivo Black", s), { maxW: bw - 2 * M, maxLines: 4, start: 150, min: 60, lh: 1.0, maxH: 560 });
          const bh = 150 + tt.h + 60;
          const tc = bloque(0, by, bw, bh);
          lab(g, "Les invitamos", M, by + 80, { color: tc, size: 26 });
          const yl = g.lines(tt.lines, M - 6, by + 150 + tt.size * 0.76, tt.lh, { font: tt.font, color: tc });
          const tw = Math.max(...tt.lines.map((l) => g.measure(l, tt.font)));
          confeti(bw, by, bh, [[M - 20, 60, M + 520, 120], [M - 20, by + 30, M + tw + 30, yl + 30], [0, by + bh + 40, W, H]], 20);
          // abajo, con aire a propósito: lugar y «¡Te esperamos!» junto al logo
          y = H - 112;
          g.text("¡Te esperamos!", M - 4, y, { font: F("Montserrat", 76, 700, true), color: ink });
          if (d.place) {
            const pl = g.fit(d.place, (s) => F("Hanken Grotesk", s, 600), { maxW: W - 2 * M - 220, maxLines: 2, start: 36, min: 26, lh: 1.25 });
            g.lines(pl.lines, M, y - 110 - (pl.lines.length - 1) * pl.lh, pl.lh, { font: pl.font, color: ink, alpha: 0.92 });
          }
        }
        g.logo(W - M, H - 130, 58, { white: oscuro, align: "right" });
      } else {
        const top = story ? 240 : 96, bot = H - (story ? 260 : 70), bw = W - 130;
        let y = top;
        if (d.head) {
          const hd = g.fit(d.head, (s) => F("Montserrat", s, 700, true), { maxW: W - 2 * M - 160, maxLines: 2, start: story ? 96 : 80, min: 44, lh: 1.1 });
          y = g.lines(hd.lines, M - 4, y + hd.size * 0.8, hd.lh, { font: hd.font, color: oscuro ? th.dot : th.block }) + hd.size * 0.55;
          if (d.eyebrow) { lab(g, d.eyebrow, M, y, { color: ink, size: 18, alpha: 0.85 }); y += 36; }
        } else { lab(g, d.eyebrow || d.church, M, y, { color: ink, size: 18, alpha: 0.85 }); y += 44; }
        // el bloque mide lo que mide el texto, y el grupo se centra en el alto que queda
        const refH = 110, pad = story ? 90 : 70, avail = bot - y - refH - (d.firma ? 40 : 0) - 20;
        const v = fitB(g, d.text, (s) => F("Archivo Black", s), { maxW: bw - 2 * M + 20, maxLines: 14, start: story ? 110 : 96, min: 30, lh: 1.16, maxH: avail - 2 * pad, step: 4 });
        const bh = v.h + 2 * pad - v.size * 0.16, by = y + Math.max(0, (avail - bh) * 0.45) + 20;
        const tc = bloque(0, by, bw, bh);
        const yl = g.lines(v.lines, M - 4, by + pad + v.size * 0.76, v.lh, { font: v.font, color: tc });
        const vw = Math.max(...v.lines.map((l) => g.measure(l, v.font)));
        g.text(d.ref, M - 2, by + bh + 80, { font: F("Archivo Black", story ? 52 : 44), color: ink });
        const refW = g.measure(d.ref, F("Archivo Black", story ? 52 : 44));
        confeti(bw, by, bh, [[M - 20, top - 40, W - M - 120, y], [M - 20, by + 20, M + vw + 30, yl + 30], [M - 20, by + bh + 20, M + refW + 30, by + bh + 100], [0, bot - 60, W, H]], story ? 24 : 16);
        if (d.firma) lab(g, d.church, M, bot, { color: ink, size: 17, alpha: 0.75 });
        else g.logo(W - M, bot - 50, 54, { white: oscuro, align: "right" });
      }
    },
  });
})();
