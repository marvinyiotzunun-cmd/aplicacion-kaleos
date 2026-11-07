/* Estudio · familia Con foto: diseños donde la foto manda (una foto del celular o una foto real de la iglesia).
   Cada plantilla le da a la foto un tratamiento propio y la deja ver: duotono de verdad arriba del bloque de color,
   polaroid con cinta, bloque de color con costura en diagonal y sello grande, ventana en arco centrada, tira de
   fotomatón con tres encuadres distintos y un estandarte angosto sobre la foto en duotono cálido.
   Sin foto, el hueco nunca queda gris: cada plantilla dibuja ahí una ilustración plana a 2–3 tintas, como una
   serigrafía o un grabado (volcanes de Xela, flores, espigas en su surco, un vitral, escenas pequeñas, un templo).
   Los titulares usan «ajusta»: cortes parejos, sin «DE» o «Y» solos y con aire para que las tildes no choquen. */
(function () {
  "use strict";
  const E = window.K && window.K.EST; if (!E) return;

  // ===== ayudantes de la familia =====
  const PI2 = Math.PI * 2;
  const cap = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
  // «Lamentaciones 3:22-23» → ["Lamentaciones", "3:22-23"]
  const cita = (ref) => { const m = String(ref || "").trim().match(/^(.*?)\s*(\d+(?:\s*[:.,\-–]\s*\d+)*)$/); return m && m[1] ? [m[1].trim(), m[2].replace(/\s+/g, "")] : [String(ref || "").trim(), ""]; };
  // «7 de noviembre» → ["7", "noviembre"]
  const fecha = (k) => { const m = String(k || "").trim().match(/^(\d{1,2})\s+de\s+(.+)$/i); return m ? [m[1], m[2]] : null; };
  // parte una palabra larga en dos por una sílaba cerca de la mitad: CUMPLEAÑOS → CUMPLE / AÑOS
  function partir(w, max = 7) {
    const s = String(w || "").toUpperCase(); if ([...s].length <= max) return [s];
    const V = "AEIOUÁÉÍÓÚÜ", Fu = "AEOÁÉÓÍÚ", grupo = ["BL", "BR", "CL", "CR", "DR", "FL", "FR", "GL", "GR", "PL", "PR", "TR", "CH", "LL", "RR"];
    const v = (c) => !!c && V.includes(c);
    let best = -1, bd = 99;
    for (let i = 2; i <= s.length - 2; i++) {
      const a = s[i - 1], b = s[i], c = s[i + 1];
      let ok = false;
      if (v(a) && !v(b) && v(c)) ok = true;
      else if (!v(a) && !v(b) && v(s[i - 2]) && (v(c) || grupo.includes(b + c)) && !grupo.includes(a + b)) ok = true;
      else if (Fu.includes(a) && Fu.includes(b)) ok = true;
      const dd = Math.abs(i - s.length / 2);
      if (ok && dd < bd) { bd = dd; best = i; }
    }
    return best > 0 ? [s.slice(0, best), s.slice(best)] : [s];
  }
  // ===== cortes de línea con oficio =====
  // palabras cortas que nunca se quedan solas en una línea ni cuelgan al final de una
  const PEQ = new Set("DE Y LA EL LOS LAS DEL A AL EN POR E O U CON SU SUS QUE NI SE TE MI TU LE LO UN UNA PARA".split(" "));
  const limpia = (w) => String(w).toUpperCase().replace(/[^A-ZÁÉÍÓÚÑÜ]/g, "");
  const soloPeq = (l) => l.split(/\s+/).every((w) => PEQ.has(limpia(w)));
  // las que no deben colgar al final de una línea (artículos y preposiciones)
  const COLGAR = new Set("DE Y LA EL LOS LAS DEL A AL EN POR E O U CON UN UNA PARA".split(" "));
  // parte en líneas y baja a la línea siguiente el «DE» o «Y» que quede colgando al final (si cabe)
  function lineas(g, s, font, maxW, sp) {
    const L = g.wrap(s, font, maxW, sp);
    for (let i = 0; i < L.length - 1; i++) {
      const ws = L[i].split(" ");
      while (ws.length > 1 && COLGAR.has(limpia(ws[ws.length - 1]))) {
        const t = ws[ws.length - 1] + " " + L[i + 1];
        if (g.measure(t, font, sp) > maxW) break;
        L[i + 1] = t; ws.pop(); L[i] = ws.join(" ");
      }
    }
    return L;
  }
  // mismas líneas, pero parejas: el ancho más angosto que no agrega líneas (sin viudas)
  function equilibra(g, s, font, maxW, sp) {
    const base = lineas(g, s, font, maxW, sp), n = base.length; if (n < 2) return base;
    let lo = maxW * 0.45, hi = maxW;
    for (let k = 0; k < 10; k++) { const mid = (lo + hi) / 2; if (lineas(g, s, font, mid, sp).length > n) lo = mid; else hi = mid; }
    return lineas(g, s, font, hi, sp);
  }
  // interlineado que no deja chocar las tildes (Á, Ó, Ñ…) con la línea de arriba: mide cada línea de verdad
  function interlinea(g, ls, font, L, size) {
    const c = g.ctx; c.font = font; if ("letterSpacing" in c) c.letterSpacing = "0px";
    let need = L;
    for (let i = 1; i < ls.length; i++) {
      const a = c.measureText(ls[i]).actualBoundingBoxAscent, b = Math.max(0, c.measureText(ls[i - 1]).actualBoundingBoxDescent);
      need = Math.max(need, a + b + size * 0.07);
    }
    return need;
  }
  // como g.fit, pero con cortes parejos, sin «DE» solo, con aire para las tildes y (opcional) un mínimo de letras por línea
  function ajusta(g, s, fontFn, o = {}) {
    const { maxW = g.W * 0.8, maxH = 9e9, maxLines = 6, start = 120, min = 24, lh = 1.1, sp = 0, step = 2, minChars = 0, equil = true, viuda = true } = o;
    const prueba = (size) => {
      const font = fontFn(size), ls = (equil ? equilibra : lineas)(g, s, font, maxW, sp), L = interlinea(g, ls, font, size * lh, size);
      return { size, lines: ls, lh: L, h: ls.length * L, font, sp };
    };
    for (let size = start; size >= min; size -= step) {
      const f = prueba(size);
      if (f.lines.length > maxLines || f.h > maxH) continue;
      if (f.lines.some((l) => g.measure(l, f.font, sp) > maxW)) continue;
      if (f.lines.length > 1 && f.lines.some(soloPeq)) continue;
      if (minChars && f.lines.length > 1 && f.lines.slice(0, -1).some((l) => [...l].length < minChars)) continue;
      // sin viudas: una palabra corta sola en la última línea
      if (viuda && f.lines.length > 2 && !/\s/.test(f.lines[f.lines.length - 1]) && [...f.lines[f.lines.length - 1]].length < 9 && size - step >= min) continue;
      return f;
    }
    const f = prueba(min);
    if (f.lines.length > maxLines) { f.lines = f.lines.slice(0, maxLines); f.lines[maxLines - 1] = f.lines[maxLines - 1].replace(/[\s,;:.]*$/, "") + "…"; f.h = maxLines * f.lh; }
    return f;
  }
  // titular de una sola palabra larga: si partido con guion sale mucho más grande, se parte (solo lo usa «Estandarte»)
  function titular(g, txt, fontFn, o) {
    const a = ajusta(g, txt, fontFn, o), w = txt.trim().split(/\s+/);
    if (w.length !== 1 || (o.maxLines || 2) < 2) return a;
    const p = partir(w[0]); if (p.length < 2) return a;
    const ls = [p[0] + "-", p[1]], o1 = { ...o, maxLines: 1, maxH: 9e9 };
    let size = Math.min(g.fit(ls[0], fontFn, o1).size, g.fit(ls[1], fontFn, o1).size), font, L;
    for (; size > (o.min || 24); size -= 2) { font = fontFn(size); L = interlinea(g, ls, font, size * (o.lh || 1.1), size); if (2 * L <= (o.maxH || 9e9)) break; }
    font = fontFn(size); L = interlinea(g, ls, font, size * (o.lh || 1.1), size);
    if (size < a.size * 1.25) return a;
    return { size, lines: ls, lh: L, h: 2 * L, font, sp: 0 };
  }
  const esHistoria = (g) => g.kind === "verse" && g.fmt === "historia";
  const sobre = (g, c) => (g.lum(c) > 0.55 ? "#161616" : "#ffffff");
  // alto de mayúscula de una fuente
  const capDe = (g, font) => { g.ctx.font = font; return g.ctx.measureText("H").actualBoundingBoxAscent; };

  // Bloques de texto que se apilan: { h, gap, draw(yArriba) }. h va de la parte de arriba de la mayúscula
  // a la línea base de la última línea.
  const tb = (g, f, x, o = {}) => {
    const c = capDe(g, f.font);
    return { h: c + (f.lines.length - 1) * f.lh + (o.extra || 0), gap: o.gap ?? 0, f, c,
      draw: (y) => { g.lines(f.lines, x, y + c, f.lh, { font: f.font, sp: f.sp, color: o.color, alpha: o.alpha, align: o.align }); if (o.after) o.after(y, c); } };
  };
  const pieza = (h, gap, draw) => ({ h, gap, draw });
  const alto = (bs) => { bs = bs.filter(Boolean); return bs.reduce((a, b, i) => a + b.h + (i < bs.length - 1 ? b.gap : 0), 0); };
  const apila = (bs, y) => { bs = bs.filter(Boolean); bs.forEach((b, i) => { b.draw(y); y += b.h + (i < bs.length - 1 ? b.gap : 0); }); return y; };

  // reparte el espacio que sobra entre los huecos de los bloques (b.peso = cuánto le toca a ese hueco)
  const reparte = (bs, yA, yZ) => {
    bs = bs.filter(Boolean); const free = Math.max(0, yZ - yA - alto(bs)), gaps = bs.slice(0, -1), tot = gaps.reduce((a, b) => a + (b.peso ?? 1), 0);
    if (tot) gaps.forEach((b) => { b.gap += (free * (b.peso ?? 1)) / tot; });
    return apila(bs, yA);
  };

  // la foto, recortada para cubrir el rectángulo, con encuadre propio:
  // o = { zoom, fx, fy, cx (dónde debe caer el centro de la foto), filter, duo: [oscuro, claro], tint, path }
  const hexA = (h) => { h = String(h).replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0); };
  function foto(g, x, y, w, h, o = {}) {
    const img = g.img; if (!img) return false;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height; if (!iw || !ih) return false;
    const s = Math.max(w / iw, h / ih) * (o.zoom || 1), dw = iw * s, dh = ih * s;
    let fx = o.fx ?? 0.5; if (o.cx != null && dw > w) fx = Math.max(0, Math.min(1, (o.cx - x - dw / 2) / (w - dw)));
    const fy = o.fy ?? 0.45, c = g.ctx;
    c.save(); c.beginPath(); if (o.path) o.path(c); else c.rect(x, y, w, h); c.clip();
    c.filter = o.filter || "none"; c.drawImage(img, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh); c.filter = "none";
    if (o.duo) {
      // duotono de verdad: gris → mezcla lineal entre el oscuro y el claro (las luces quedan claras)
      const A = hexA(o.duo[0]), B = hexA(o.duo[1]);
      c.globalCompositeOperation = "multiply"; c.fillStyle = `rgb(${B.map((v, i) => Math.max(0, v - A[i])).join(",")})`; c.fillRect(x, y, w, h);
      c.globalCompositeOperation = "lighter"; c.fillStyle = o.duo[0]; c.fillRect(x, y, w, h);
    }
    if (o.tint) { c.globalCompositeOperation = "source-over"; c.fillStyle = o.tint; c.fillRect(x, y, w, h); }
    c.restore(); return true;
  }

  // el logo: blanco sobre fondo oscuro; sobre fondo claro, en una sola tinta (la del tema), nunca en sus azules
  const TINTAS = new Map();
  function marca(g, x, y, h, fondo, tinta, align = "right") {
    if (g.lum(fondo) < 0.5) return g.logo(x, y, h, { white: true, align });
    const img = g.assets && g.assets.markW; if (!img || !img.width) return g.logo(x, y, h, { align });
    let cv = TINTAS.get(tinta);
    if (!cv || cv._src !== img) {
      cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height; cv._src = img;
      const c = cv.getContext("2d"); c.drawImage(img, 0, 0); c.globalCompositeOperation = "source-in"; c.fillStyle = tinta; c.fillRect(0, 0, cv.width, cv.height);
      TINTAS.set(tinta, cv);
    }
    const w = (cv.width * h) / cv.height, ax = align === "left" ? x : align === "right" ? x - w : x - w / 2;
    g.ctx.drawImage(cv, ax, y, w, h);
  }

  // ===== iconos sencillos de línea =====
  function icono(ctx, tipo, cx, cy, s, color, lw) {
    ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (tipo === "bodas") {
      const r = s * 0.26;
      ctx.beginPath(); ctx.arc(cx - s * 0.15, cy + s * 0.08, r, 0, PI2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + s * 0.15, cy + s * 0.08, r, 0, PI2); ctx.stroke();
      const dx = cx + s * 0.15, dy = cy + s * 0.08 - r - lw * 0.5;
      ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx - s * 0.08, dy - s * 0.08); ctx.lineTo(dx - s * 0.04, dy - s * 0.14); ctx.lineTo(dx + s * 0.04, dy - s * 0.14); ctx.lineTo(dx + s * 0.08, dy - s * 0.08); ctx.closePath(); ctx.stroke();
    } else if (tipo === "cumple") {
      const globo = (bx, by, rx, ry, rot) => {
        ctx.save(); ctx.translate(bx, by); ctx.rotate(rot);
        ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, PI2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-rx * 0.18, ry + lw * 0.2); ctx.lineTo(rx * 0.18, ry + lw * 0.2); ctx.lineTo(0, ry - lw * 0.6); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, ry + lw); ctx.bezierCurveTo(rx * 0.5, ry + s * 0.18, -rx * 0.5, ry + s * 0.3, 0, ry + s * 0.42); ctx.stroke();
        ctx.beginPath(); ctx.arc(-rx * 0.4, -ry * 0.35, rx * 0.22, Math.PI * 1.05, Math.PI * 1.55); ctx.stroke();
        ctx.restore();
      };
      globo(cx - s * 0.16, cy - s * 0.12, s * 0.17, s * 0.22, -0.18);
      globo(cx + s * 0.16, cy - s * 0.2, s * 0.17, s * 0.22, 0.16);
    } else if (tipo === "sol") {
      ctx.beginPath(); ctx.arc(cx, cy, s * 0.22, 0, PI2); ctx.stroke();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * PI2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * s * 0.32, cy + Math.sin(a) * s * 0.32); ctx.lineTo(cx + Math.cos(a) * s * 0.44, cy + Math.sin(a) * s * 0.44); ctx.stroke(); }
    } else {
      ctx.fillRect(cx - s * 0.07, cy - s * 0.48, s * 0.14, s * 0.96); ctx.fillRect(cx - s * 0.3, cy - s * 0.24, s * 0.6, s * 0.14);
    }
    ctx.restore();
  }
  const iconoDe = (d) => (d.occasion === "bodas" ? "bodas" : d.occasion === "cumple" ? "cumple" : "sol");

  // paloma en vuelo (mirando a la derecha); s = ancho aproximado
  // borde = contorno oscuro (paloma clara con línea, que no parezca un cuervo)
  function paloma(ctx, cx, cy, s, color, rama, borde) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s / 220, s / 220); ctx.fillStyle = color;
    if (borde) {
      ctx.strokeStyle = borde; ctx.lineWidth = 7; ctx.lineJoin = "round"; ctx.lineCap = "round";
      if (rama) {
        ctx.save(); ctx.strokeStyle = rama; ctx.fillStyle = rama; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(112, -14); ctx.quadraticCurveTo(146, 0, 160, 34); ctx.stroke();
        [[126, -6, 0.5], [140, 4, -0.6], [150, 18, 0.9], [158, 30, -0.3]].forEach(([lx, ly, r]) => { ctx.beginPath(); ctx.ellipse(lx, ly, 14, 6, r, 0, PI2); ctx.fill(); });
        ctx.restore();
      }
      // alas abiertas hacia arriba, detrás del cuerpo
      const ala = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); ctx.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]); ctx.bezierCurveTo(pts[8], pts[9], pts[10], pts[11], pts[12], pts[13]); ctx.closePath(); ctx.fill(); ctx.stroke(); };
      ala([-30, 8, -70, -60, -50, -126, 4, -150, -4, -104, 14, -56, 30, -6]);
      ala([-4, 4, 18, -70, 60, -118, 110, -128, 80, -84, 64, -40, 46, -8]);
      ctx.beginPath(); ctx.moveTo(-105, 18); ctx.bezierCurveTo(-60, 4, 10, -6, 58, -18); ctx.bezierCurveTo(70, -38, 96, -38, 102, -20);
      ctx.lineTo(120, -13); ctx.lineTo(101, -5); ctx.bezierCurveTo(90, 22, 40, 38, -12, 34); ctx.lineTo(-112, 44); ctx.lineTo(-92, 28); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = borde; ctx.beginPath(); ctx.arc(88, -24, 4.5, 0, PI2); ctx.fill();
      ctx.restore(); return;
    }
    ctx.beginPath();
    ctx.moveTo(-105, 18);
    ctx.bezierCurveTo(-60, 4, 10, -6, 58, -18);
    ctx.bezierCurveTo(70, -38, 96, -38, 102, -20);
    ctx.lineTo(124, -14); ctx.lineTo(101, -6);
    ctx.bezierCurveTo(90, 22, 40, 38, -12, 34);
    ctx.lineTo(-112, 44); ctx.lineTo(-92, 28);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-24, 6); ctx.bezierCurveTo(-56, -50, -40, -110, 22, -140); ctx.bezierCurveTo(8, -100, 22, -56, 34, -10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-6, 4); ctx.bezierCurveTo(10, -60, 50, -104, 100, -118); ctx.bezierCurveTo(70, -80, 58, -40, 44, -12); ctx.closePath(); ctx.fill();
    if (rama) {
      ctx.strokeStyle = rama; ctx.fillStyle = rama; ctx.lineWidth = 5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(116, -12); ctx.quadraticCurveTo(140, 4, 150, 30); ctx.stroke();
      [[128, -2, 0.9], [138, 10, -0.5], [144, 22, 1.1]].forEach(([lx, ly, r]) => { ctx.beginPath(); ctx.ellipse(lx, ly, 12, 5, r, 0, PI2); ctx.fill(); });
    }
    ctx.restore();
  }

  // ===== ilustraciones planas (cuando no hay foto) =====
  // Todas dibujan dentro del rectángulo (x, y, w, h) y se recortan a él.
  const recorta = (ctx, x, y, w, h) => { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); };
  // semitono dentro de la figura que esté en la ruta actual
  const tramaEn = (g, x, y, w, h, color, o) => { g.ctx.save(); g.ctx.clip(); g.halftone(x, y, w, h, color, o); g.ctx.restore(); };
  // cresta de montaña: devuelve los puntos
  const cresta = (g, x, w, base, amp, n, fase) => { const pts = []; for (let i = 0; i <= n; i++) { const t = i / n; pts.push([x + w * t, base - amp * (0.55 * Math.sin(t * 5.1 + fase) + 0.3 * Math.sin(t * 11.3 + fase * 2.1) + 0.15 * Math.sin(t * 23 + fase * 3)) - amp * 0.4]); } return pts; };
  const rellenaCresta = (ctx, pts, yb) => { ctx.beginPath(); ctx.moveTo(pts[0][0], yb); pts.forEach(([a, b]) => ctx.lineTo(a, b)); ctx.lineTo(pts[pts.length - 1][0], yb); ctx.closePath(); };

  // Volcanes de Xela (Santa María y el Cerro Quemado) a dos tintas y sol: cielo con trama, volcán en semitono
  function volcanes(g, x, y, w, h, P) {
    const { ctx } = g; recorta(ctx, x, y, w, h);
    ctx.fillStyle = P.sky; ctx.fillRect(x, y, w, h);
    g.halftone(x, y, w, h * 0.42, P.dark, { step: 18, fade: "up", alpha: 0.32, size: 0.8, angle: 0.5 });
    const s = Math.min(w, h), base = y + h * 0.7;
    ctx.fillStyle = P.sun; ctx.beginPath(); ctx.arc(x + w * 0.76, y + h * 0.3, s * 0.085, 0, PI2); ctx.fill();
    const cono = (cx, bw, ch, tw) => { ctx.beginPath(); ctx.moveTo(cx - bw, base + 6); ctx.quadraticCurveTo(cx - bw * 0.3, base - ch * 0.6, cx - tw, base - ch); ctx.lineTo(cx + tw * 1.3, base - ch * 0.985); ctx.quadraticCurveTo(cx + bw * 0.3, base - ch * 0.62, cx + bw, base + 6); ctx.closePath(); };
    const ch1 = Math.min(h * 0.46, w * 0.62), c1 = x + w * 0.36, bw1 = w * 0.58;
    // Cerro Quemado detrás, a la derecha (más denso)
    const ch2 = ch1 * 0.5, c2 = x + w * 0.84;
    cono(c2, w * 0.34, ch2, w * 0.035); ctx.fillStyle = P.sky; ctx.fill();
    cono(c2, w * 0.34, ch2, w * 0.035); tramaEn(g, x, base - ch2 - 10, w, ch2 + 20, P.dark, { step: 8, size: 1.12, angle: 0.3 });
    // Santa María: semitono medio con vetas de grabado
    cono(c1, bw1, ch1, w * 0.016); ctx.fillStyle = P.sky; ctx.fill();
    cono(c1, bw1, ch1, w * 0.016); ctx.save(); ctx.clip();
    g.halftone(x, base - ch1 - 10, w, ch1 + 20, P.dark, { step: 9, size: 0.7, angle: 0.3 });
    ctx.strokeStyle = g.rgba(P.dark, 0.75); ctx.lineCap = "round";
    for (let i = 0; i < 11; i++) {
      const t = i / 10 - 0.5, sx = c1 + t * w * 0.05, ex = c1 + t * bw1 * 1.7;
      ctx.lineWidth = 2 + (1 - Math.abs(t)) * 2.5;
      ctx.beginPath(); ctx.moveTo(sx, base - ch1 * 0.97); ctx.quadraticCurveTo(c1 + t * bw1 * 0.5, base - ch1 * 0.45, ex, base + 4); ctx.stroke();
    }
    ctx.restore();
    // lomas del frente, sólidas
    const pts = cresta(g, x - 10, w + 20, base + h * 0.03, h * 0.035, 30, 1.7);
    rellenaCresta(ctx, pts, y + h + 4); ctx.fillStyle = P.dark; ctx.fill();
    ctx.restore();
  }

  // Flores de campo (margarita, tulipán, botón) con sol grande detrás
  function flores(g, x, y, w, h, P) {
    const { ctx } = g; recorta(ctx, x, y, w, h);
    ctx.fillStyle = P.sky; ctx.fillRect(x, y, w, h);
    g.halftone(x, y + h * 0.45, w, h * 0.55, P.c, { step: 14, fade: "down", alpha: 0.35, size: 0.7 });
    ctx.fillStyle = P.c; ctx.beginPath(); ctx.arc(x + w * 0.7, y + h * 0.33, w * 0.2, 0, PI2); ctx.fill();
    const lw = w * 0.016, by = y + h * 1.02;
    const tallo = (bx, hx, hy, bend) => {
      ctx.strokeStyle = P.a; ctx.lineWidth = lw; ctx.lineCap = "round";
      const mx = (bx + hx) / 2 + bend, my = (by + hy) / 2;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(mx, my, hx, hy); ctx.stroke();
      const t = 0.55, px = (1 - t) * (1 - t) * bx + 2 * (1 - t) * t * mx + t * t * hx, py = (1 - t) * (1 - t) * by + 2 * (1 - t) * t * my + t * t * hy;
      ctx.fillStyle = P.a;
      ctx.beginPath(); ctx.ellipse(px - w * 0.045, py, w * 0.06, w * 0.02, -0.6, 0, PI2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(px + w * 0.045, py + h * 0.07, w * 0.055, w * 0.018, 0.55, 0, PI2); ctx.fill();
    };
    const margarita = (cx, cy, r) => {
      ctx.fillStyle = P.b;
      for (let i = 0; i < 11; i++) { const a = (i / 11) * PI2; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.48, r * 0.15, a, 0, PI2); ctx.fill(); }
      ctx.fillStyle = P.c; ctx.beginPath(); ctx.arc(cx, cy, r * 0.28, 0, PI2); ctx.fill();
      ctx.fillStyle = P.a; for (let i = 0; i < 7; i++) { const a = (i / 7) * PI2; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * 0.14, cy + Math.sin(a) * r * 0.14, r * 0.035, 0, PI2); ctx.fill(); }
    };
    const tulipan = (cx, cy, r) => {
      ctx.fillStyle = P.b; ctx.beginPath();
      ctx.moveTo(cx - r * 0.55, cy - r * 0.5); ctx.lineTo(cx - r * 0.25, cy - r * 0.15); ctx.lineTo(cx, cy - r * 0.62); ctx.lineTo(cx + r * 0.25, cy - r * 0.15); ctx.lineTo(cx + r * 0.55, cy - r * 0.5);
      ctx.quadraticCurveTo(cx + r * 0.62, cy + r * 0.45, cx, cy + r * 0.5); ctx.quadraticCurveTo(cx - r * 0.62, cy + r * 0.45, cx - r * 0.55, cy - r * 0.5); ctx.fill();
      ctx.strokeStyle = P.a; ctx.lineWidth = lw * 0.5; ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.3); ctx.lineTo(cx, cy + r * 0.4); ctx.stroke();
    };
    const boton = (cx, cy, r) => {
      ctx.fillStyle = P.c; [[0, -0.4], [0.38, -0.12], [0.24, 0.34], [-0.24, 0.34], [-0.38, -0.12]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(cx + a * r, cy + b * r, r * 0.36, 0, PI2); ctx.fill(); });
      ctx.fillStyle = P.b; ctx.beginPath(); ctx.arc(cx, cy, r * 0.22, 0, PI2); ctx.fill();
    };
    const fl = [[0.16, 0.2, 0.5, "m", -w * 0.04], [0.4, 0.42, 0.3, "t", w * 0.05], [0.6, 0.58, 0.56, "b", -w * 0.03], [0.82, 0.9, 0.38, "m", w * 0.05]];
    fl.forEach(([bx, hx, hy, k, bend]) => { tallo(x + w * bx, x + w * hx, y + h * hy, bend); });
    fl.forEach(([, hx, hy, k]) => { const cx = x + w * hx, cy = y + h * hy, r = w * (k === "m" ? 0.13 : 0.1); if (k === "m") margarita(cx, cy, r); else if (k === "t") tulipan(cx, cy, r); else boton(cx, cy, r); });
    // pasto
    ctx.fillStyle = P.a; ctx.beginPath(); ctx.moveTo(x, y + h);
    for (let i = 0; i <= 40; i++) { const px = x + (w * i) / 40; ctx.lineTo(px, y + h * (i % 2 ? 0.9 : 0.94) + (g.R() - 0.5) * h * 0.02); }
    ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // Espigas de trigo en dos filas delante de un sol grande
  function trigo(g, x, y, w, h, P, o = {}) {
    const { ctx, R } = g; recorta(ctx, x, y, w, h);
    ctx.fillStyle = P.sky; ctx.fillRect(x, y, w, h);
    if (!o.mini) g.halftone(x, y, w, h * 0.5, P.a, { step: 16, fade: "up", alpha: 0.16, size: 0.8 });
    const s = Math.min(w, h);
    ctx.fillStyle = P.c; ctx.beginPath(); ctx.arc(x + w * (o.sunX ?? 0.68), y + h * 0.5, s * 0.3, 0, PI2); ctx.fill();
    const lw = Math.max(2, w * (o.mini ? 0.016 : 0.009));
    const espiga = (bx, by, tx, ty, col, k) => {
      const mx = (bx + tx) / 2 + (tx - bx) * 0.25, my = (by + ty) / 2;
      const pt = (t) => [(1 - t) * (1 - t) * bx + 2 * (1 - t) * t * mx + t * t * tx, (1 - t) * (1 - t) * by + 2 * (1 - t) * t * my + t * t * ty];
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = "round"; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(mx, my, tx, ty); ctx.stroke();
      const L = Math.hypot(tx - bx, ty - by), rx = Math.max(L * 0.052 * k, 7), ry = rx * 0.45, n = 6;
      for (let i = 0; i < n; i++) {
        const t = 0.62 + (i / n) * 0.36, [px, py] = pt(t), [qx, qy] = pt(t + 0.01), a = Math.atan2(qy - py, qx - px);
        [-1, 1].forEach((sd) => {
          const ra = a + sd * 0.42, gx = px + Math.cos(ra) * rx * 0.8, gy = py + Math.sin(ra) * rx * 0.8;
          ctx.beginPath(); ctx.ellipse(gx, gy, rx, ry, ra, 0, PI2); ctx.fill();
          ctx.lineWidth = Math.max(1, lw * 0.35); ctx.beginPath(); ctx.moveTo(gx + Math.cos(ra) * rx, gy + Math.sin(ra) * rx); ctx.lineTo(gx + Math.cos(ra - sd * 0.15) * rx * 3.2, gy + Math.sin(ra - sd * 0.15) * rx * 3.2); ctx.stroke();
          ctx.lineWidth = lw;
        });
      }
      const [px, py] = pt(0.99), [qx, qy] = pt(1), a = Math.atan2(qy - py, qx - px);
      ctx.beginPath(); ctx.ellipse(tx + Math.cos(a) * rx * 0.6, ty + Math.sin(a) * rx * 0.6, rx, ry, a, 0, PI2); ctx.fill();
    };
    const fila = (n, col, h0, h1, k) => {
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, bx = x + w * (t * 1.1 - 0.05) + (R() - 0.5) * w * 0.03, lean = (R() - 0.35) * w * 0.12;
        espiga(bx, y + h + 6, bx + lean, y + h * (h0 + R() * (h1 - h0)), col, k);
      }
    };
    fila(o.mini ? 3 : 7, P.b, 0.2, 0.36, 1);
    fila(o.mini ? 2 : 5, P.a, 0.36, 0.5, 1.15);
    ctx.restore();
  }

  // Cuatro espigas grandes de trigo que salen de un surco de tierra con rastrojo, delante de un sol bajo
  function espigas(g, x, y, w, h, P) {
    const { ctx, R } = g; recorta(ctx, x, y, w, h);
    ctx.fillStyle = P.sky; ctx.fillRect(x, y, w, h);
    g.halftone(x, y, w, h * 0.55, P.a, { step: 15, fade: "up", alpha: 0.14, size: 0.8 });
    const s = Math.min(w, h), gy = y + h * 0.84;
    ctx.fillStyle = P.c; ctx.beginPath(); ctx.arc(x + w * 0.16, y + h * 0.5, s * 0.25, 0, PI2); ctx.fill();
    const espiga = (bx, tx, ty, col, lw, n) => {
      const by = gy + 10, mx = (bx + tx) / 2 + (tx - bx) * 0.5, my = (by + ty) / 2;
      const pt = (t) => [(1 - t) * (1 - t) * bx + 2 * (1 - t) * t * mx + t * t * tx, (1 - t) * (1 - t) * by + 2 * (1 - t) * t * my + t * t * ty];
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = "round"; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(mx, my, tx, ty); ctx.stroke();
      // una hoja larga que se dobla
      const [hx, hy] = pt(0.3), sd = bx < x + w * 0.5 ? -1 : 1;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(hx + sd * s * 0.12, hy - s * 0.1, hx + sd * s * 0.2, hy + s * 0.02); ctx.quadraticCurveTo(hx + sd * s * 0.1, hy - s * 0.05, hx, hy + lw * 2); ctx.fill();
      const L = Math.hypot(tx - bx, ty - by), rx = L * 0.05 + lw * 0.7, ry = rx * 0.48;
      for (let i = 0; i < n; i++) {
        const t = 0.56 + (i / n) * 0.42, [px, py] = pt(t), [qx, qy] = pt(t + 0.01), a = Math.atan2(qy - py, qx - px);
        [-1, 1].forEach((sd2) => {
          const ra = a + sd2 * 0.5, gx = px + Math.cos(ra) * rx * 0.85, gy2 = py + Math.sin(ra) * rx * 0.85;
          ctx.beginPath(); ctx.ellipse(gx, gy2, rx, ry, ra, 0, PI2); ctx.fill();
          ctx.lineWidth = Math.max(1.5, lw * 0.22); ctx.beginPath(); ctx.moveTo(gx + Math.cos(ra) * rx, gy2 + Math.sin(ra) * rx);
          ctx.lineTo(gx + Math.cos(ra - sd2 * 0.18) * rx * 3.6, gy2 + Math.sin(ra - sd2 * 0.18) * rx * 3.6); ctx.stroke(); ctx.lineWidth = lw;
        });
      }
      const [px, py] = pt(0.99), a = Math.atan2(ty - py, tx - px);
      ctx.beginPath(); ctx.ellipse(tx + Math.cos(a) * rx * 0.5, ty + Math.sin(a) * rx * 0.5, rx * 1.05, ry, a, 0, PI2); ctx.fill();
    };
    // alto, inclinación y grosor distintos en cada una
    [[0.24, 0.06, 0.3, P.b, 14, 10], [0.36, -0.05, 0.12, P.c, 18, 11], [0.5, 0.08, 0.24, P.b, 12, 9], [0.61, 0.02, 0.4, P.c, 10, 8]]
      .forEach(([bx, lean, ty, col, lw, n]) => espiga(x + w * bx + (R() - 0.5) * w * 0.02, x + w * (bx + lean), y + h * (ty + (R() - 0.5) * 0.04), col, lw * (w / 1080), n));
    // el surco: tierra con rastrojo cortado
    ctx.fillStyle = P.a; ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, gy + 8);
    for (let i = 0; i <= 30; i++) ctx.lineTo(x + (w * i) / 30, gy + Math.sin(i * 0.8) * 5 + (R() - 0.5) * 7);
    ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = P.b; ctx.lineCap = "round";
    for (let i = 0; i < 70; i++) { const px = x + R() * w, py = gy + 14 + R() * (y + h - gy - 20); ctx.lineWidth = 2 + R() * 2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (R() - 0.5) * 10, py - 8 - R() * 14); ctx.stroke(); }
    ctx.restore();
  }

  // Vitral dentro del arco: paneles planos en abanico, unidos por plomo oscuro, con una cruz clara al centro.
  // Se dibuja ya recortado por la ruta del arco.
  function vitral(g, x, y, w, h, P) {
    const { ctx } = g, cx = x + w / 2, cy = y + w * 0.5 + (h - w * 0.5) * 0.28, D = Math.hypot(w, h) * 1.3, n = 14;
    const cols = [P.rb, P.sky, P.sun], r2 = w * 0.42, r1 = w * 0.17, lw = Math.max(4, w * 0.018);
    ctx.fillStyle = P.sky; ctx.fillRect(x, y, w, h);
    const sector = (i, r) => { const a0 = -Math.PI / 2 + (i / n) * PI2 - Math.PI / n, a1 = a0 + PI2 / n; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a0, a1); ctx.closePath(); };
    for (let i = 0; i < n; i++) { sector(i, D); ctx.fillStyle = cols[i % 3]; ctx.fill(); }
    for (let i = 0; i < n; i++) { sector(i, r2); ctx.fillStyle = cols[(i + 1) % 3]; ctx.fill(); }
    g.halftone(x, y, w, h, P.ra, { step: 11, alpha: 0.12, size: 0.7 });
    ctx.fillStyle = P.rb; ctx.beginPath(); ctx.arc(cx, cy, r1, 0, PI2); ctx.fill();
    ctx.strokeStyle = P.ra; ctx.lineWidth = lw; ctx.lineJoin = "round";
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i / n) * PI2 - Math.PI / n; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * D, cy + Math.sin(a) * D); ctx.stroke(); }
    [r1, r2, w * 0.78].forEach((r) => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, PI2); ctx.stroke(); });
    // la cruz: clara con su plomo
    const cw = w * 0.1, ch = h * 0.62, top = cy - ch * 0.42, aw = w * 0.5, ay = cy - ch * 0.16;
    ctx.beginPath(); ctx.rect(cx - cw / 2, top, cw, ch); ctx.rect(cx - aw / 2, ay - cw / 2, aw, cw);
    ctx.fillStyle = P.sun; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - cw / 2, top); ctx.lineTo(cx + cw / 2, top); ctx.lineTo(cx + cw / 2, ay - cw / 2); ctx.lineTo(cx + aw / 2, ay - cw / 2); ctx.lineTo(cx + aw / 2, ay + cw / 2); ctx.lineTo(cx + cw / 2, ay + cw / 2);
    ctx.lineTo(cx + cw / 2, top + ch); ctx.lineTo(cx - cw / 2, top + ch); ctx.lineTo(cx - cw / 2, ay + cw / 2); ctx.lineTo(cx - aw / 2, ay + cw / 2); ctx.lineTo(cx - aw / 2, ay - cw / 2); ctx.lineTo(cx - cw / 2, ay - cw / 2); ctx.closePath();
    ctx.fillStyle = P.sun; ctx.fill(); ctx.lineWidth = lw * 1.2; ctx.stroke();
    // un parteluz abajo, como en las ventanas de capilla
    ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x, y + h * 0.88); ctx.lineTo(x + w, y + h * 0.88); ctx.stroke();
  }

  // Escenas pequeñas para el fotomatón (una por cuadro)
  function escena(g, k, x, y, w, h, P) {
    const { ctx } = g;
    if (k === 2) { trigo(g, x, y, w, h, { sky: P.fb, a: P.fa, b: P.fc, c: g.mix(P.fb, "#ffffff", 0.55) }, { mini: true, sunX: 0.5 }); return; }
    recorta(ctx, x, y, w, h); ctx.fillStyle = P.fb; ctx.fillRect(x, y, w, h);
    if (k === 0) {
      ctx.fillStyle = P.fc; ctx.beginPath(); ctx.arc(x + w * 0.62, y + h * 0.5, h * 0.26, 0, PI2); ctx.fill();
      const p1 = cresta(g, x - 5, w + 10, y + h * 0.78, h * 0.12, 16, 0.8); rellenaCresta(ctx, p1, y + h + 2); ctx.fillStyle = P.fb; ctx.fill();
      rellenaCresta(ctx, p1, y + h + 2); tramaEn(g, x, y + h * 0.5, w, h * 0.5, P.fa, { step: 7, size: 0.9 });
      const p2 = cresta(g, x - 5, w + 10, y + h * 0.95, h * 0.1, 16, 3.1); rellenaCresta(ctx, p2, y + h + 2); ctx.fillStyle = P.fa; ctx.fill();
    } else if (k === 1) {
      // paloma clara con contorno, alas abiertas y rama de olivo verde, sobre el color del tema
      ctx.fillStyle = P.fc; ctx.fillRect(x, y, w, h);
      g.halftone(x, y + h * 0.55, w, h * 0.45, P.fa, { step: 9, fade: "down", alpha: 0.25, size: 0.8 });
      paloma(ctx, x + w * 0.44, y + h * 0.66, Math.min(w * 0.6, h * 0.82), "#fbf7ee", "#5c7a34", P.fa);
    } else {
      g.halftone(x, y, w, h * 0.6, P.fc, { step: 9, fade: "up", alpha: 0.6, size: 0.8 });
      const p1 = cresta(g, x - 5, w + 10, y + h * 0.86, h * 0.06, 12, 1.4); rellenaCresta(ctx, p1, y + h + 2); ctx.fillStyle = P.fc; ctx.fill();
      const cx = x + w * 0.5, s = h * 0.5, cy = y + h * 0.56;
      ctx.fillStyle = P.fa; ctx.fillRect(cx - s * 0.06, cy - s * 0.5, s * 0.12, s * 0.9); ctx.fillRect(cx - s * 0.28, cy - s * 0.26, s * 0.56, s * 0.12);
    }
    ctx.restore();
  }

  // Templo sencillo como grabado en blanco y negro: cielo a rayas finas, fachada con frontón y torre con cruz.
  // fx = dónde va el templo (0..1 del ancho)
  function templo(g, x, y, w, h, P, fx = 0.72) {
    const { ctx } = g; recorta(ctx, x, y, w, h);
    ctx.fillStyle = P.paper; ctx.fillRect(x, y, w, h);
    const hz = y + h * 0.8;
    ctx.strokeStyle = P.ink;
    for (let yy = y + 4; yy < hz - h * 0.12;) { const t = (yy - y) / (hz - y); ctx.globalAlpha = 0.55; ctx.lineWidth = 2.4 * (1 - t * 0.7); ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); yy += 7 + t * 20; }
    ctx.globalAlpha = 1;
    // sol en blanco con contorno
    const sr = Math.min(w, h) * 0.075, sx = x + w * Math.min(0.93, fx + 0.2), sy = y + h * 0.17;
    ctx.fillStyle = P.paper; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, PI2); ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
    const s = P.s || Math.min(w * 0.6, h * 0.42), tx = x + w * fx, lw = Math.max(3, s * 0.009);
    const nx0 = tx - s * 0.6, nx1 = tx + s * 0.22, nh = s * 0.46, ny = hz - nh, apx = (nx0 + nx1) / 2, apy = ny - s * 0.24;
    const twx0 = nx1, twx1 = nx1 + s * 0.26, twy = hz - s * 0.98, spy = twy - s * 0.24;
    const raya = (x0, y0, x1, y1, step, ang, a) => { ctx.save(); ctx.clip(); ctx.lineWidth = lw * 0.6; ctx.globalAlpha = a; for (let k = -h; k < w + h; k += step) { ctx.beginPath(); ctx.moveTo(x0 + k, y1); ctx.lineTo(x0 + k + (y1 - y0) * ang, y0); ctx.stroke(); } ctx.restore(); };
    ctx.lineJoin = "round"; ctx.strokeStyle = P.ink; ctx.fillStyle = P.paper; ctx.lineWidth = lw;
    // suelo rayado
    ctx.beginPath(); ctx.rect(x, hz, w, h); ctx.fillStyle = P.gray; ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.rect(x, hz, w, h); ctx.clip(); ctx.lineWidth = 2; for (let yy = hz + 6; yy < y + h; yy += 9) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); } ctx.restore();
    // torre
    ctx.fillStyle = P.paper; ctx.beginPath(); ctx.rect(twx0, twy, twx1 - twx0, hz - twy); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.rect(twx0 + (twx1 - twx0) * 0.6, twy, (twx1 - twx0) * 0.4, hz - twy); raya(twx0, twy, twx1, hz, 9, 0, 0.8);
    ctx.beginPath(); ctx.moveTo(twx0 - s * 0.02, twy); ctx.lineTo((twx0 + twx1) / 2, spy); ctx.lineTo(twx1 + s * 0.02, twy); ctx.closePath(); ctx.fillStyle = P.paper; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo((twx0 + twx1) / 2, spy); ctx.lineTo(twx1 + s * 0.02, twy); ctx.lineTo((twx0 + twx1) / 2, twy); ctx.closePath(); raya(twx0, spy, twx1, twy, 8, 0.6, 0.9);
    const bw = (twx1 - twx0) * 0.42, bxx = (twx0 + twx1) / 2 - bw / 2, byy = twy + s * 0.09, bh = s * 0.16;
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.moveTo(bxx, byy + bh); ctx.lineTo(bxx, byy + bw / 2); ctx.arc(bxx + bw / 2, byy + bw / 2, bw / 2, Math.PI, 0); ctx.lineTo(bxx + bw, byy + bh); ctx.closePath(); ctx.fill();
    const cxr = (twx0 + twx1) / 2, cs = s * 0.13; ctx.fillRect(cxr - cs * 0.07, spy - cs, cs * 0.14, cs * 1.02); ctx.fillRect(cxr - cs * 0.3, spy - cs * 0.74, cs * 0.6, cs * 0.13);
    // fachada con frontón
    ctx.fillStyle = P.paper; ctx.beginPath(); ctx.moveTo(nx0, hz); ctx.lineTo(nx0, ny); ctx.lineTo(apx, apy); ctx.lineTo(nx1, ny); ctx.lineTo(nx1, hz); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(nx0, ny); ctx.lineTo(nx1, ny); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(nx0, hz); ctx.lineTo(nx0, ny + nh * 0.55); ctx.lineTo(nx1, ny + nh * 0.55); ctx.lineTo(nx1, hz); ctx.closePath(); raya(nx0, ny, nx1, hz, 12, 0.35, 0.45);
    ctx.beginPath(); ctx.arc(apx, ny - s * 0.09, s * 0.055, 0, PI2); ctx.stroke();
    const dw = s * 0.2, dh = s * 0.3, dx = apx - dw / 2;
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.moveTo(dx, hz); ctx.lineTo(dx, hz - dh + dw / 2); ctx.arc(apx, hz - dh + dw / 2, dw / 2, Math.PI, 0); ctx.lineTo(dx + dw, hz); ctx.closePath(); ctx.fill();
    [nx0 + (apx - nx0) * 0.4, nx1 - (nx1 - apx) * 0.4].forEach((wx) => { const ww = s * 0.07, wh = s * 0.15, wy = ny + nh * 0.18; ctx.beginPath(); ctx.moveTo(wx - ww / 2, wy + wh); ctx.lineTo(wx - ww / 2, wy + ww / 2); ctx.arc(wx, wy + ww / 2, ww / 2, Math.PI, 0); ctx.lineTo(wx + ww / 2, wy + wh); ctx.closePath(); ctx.fill(); });
    ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(dx - s * 0.08, hz + s * 0.02); ctx.lineTo(dx + dw + s * 0.08, hz + s * 0.02); ctx.stroke();
    // ciprés junto a la torre
    const cpx = twx1 + s * 0.16, cph = s * 0.62;
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.moveTo(cpx, hz - cph); ctx.quadraticCurveTo(cpx + s * 0.1, hz - cph * 0.5, cpx + s * 0.02, hz); ctx.lineTo(cpx - s * 0.02, hz); ctx.quadraticCurveTo(cpx - s * 0.1, hz - cph * 0.5, cpx, hz - cph); ctx.fill();
    ctx.restore();
  }


  // ======================================================================================
  // «Duotono»: la foto en dos tintas de verdad (sombras del tema, luces claras) arriba y, con un borde corto,
  // el bloque de color con la letra grande. Sin foto: los volcanes de Xela en las mismas dos tintas.
  // Gesto a mano: un trazo de marcador.
  E.add({
    id: "fot-duotono", name: "Duotono", family: "foto", fonts: ["Anton", "Montserrat"],
    themes: {
      marino: { name: "Marino y oro", dark: "#0d1b3d", light: "#7ea6e0", hi: "#f4efe3", acc: "#f2c85b", ink: "#fbf6ea" },
      terracota: { name: "Terracota", dark: "#3a130f", light: "#ec9372", hi: "#ffe9d6", acc: "#ffd9a0", ink: "#fff6ec" },
      pino: { name: "Pino y miel", dark: "#0f2a22", light: "#9fcb9c", hi: "#f3f1e2", acc: "#f4b942", ink: "#f4f1e6" },
      uva: { name: "Uva y coral", dark: "#25103a", light: "#e48fb0", hi: "#fde9ef", acc: "#ff9e7a", ink: "#fff3f0" },
      anil: { name: "Papel y añil", claro: true, dark: "#1f2a6b", light: "#f3ead8", hi: "#f3ead8", acc: "#e2412b", ink: "#1f2a6b" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 80, st = esHistoria(g), sq = d.kind === "verse" && g.fmt === "cuadrado", mw = W - 2 * M;
      const claro = !!th.claro, tinta = claro ? th.dark : th.ink, velo = claro ? th.light : th.dark;
      const top = st ? 250 : sq ? 84 : 100, bot = H - (st ? 300 : sq ? 72 : 84);
      // dónde queremos el corte del bloque (la foto queda libre arriba) y lo más alto que puede subir
      const corteT = H * (st ? 0.36 : sq ? 0.38 : 0.4), corteMin = H * (st ? 0.3 : 0.33);
      const tarde = [];
      const marcador = (x, y, w) => g.scribble(x - 6, y, x + w + 8, y - 5, th.acc, 13, { bow: -4 });
      const ultima = (f) => g.measure(f.lines[f.lines.length - 1], f.font, f.sp || 0);
      const arriba = (s) => tarde.push(() => g.text(String(s).toUpperCase(), M, top, { font: F("Montserrat", 26, 700), color: tinta, sp: 3 }));
      const bs = []; let pie = null, footH = 0;
      if (d.kind === "card") {
        const [lead, main] = g.splitHead(d.headline);
        const sg = g.fit(d.signature, (s) => F("Montserrat", s, 800), { maxW: mw - 140, maxLines: 1, start: 32, min: 26 });
        const fr = g.fit(d.from, (s) => F("Montserrat", s, 600), { maxW: mw - 140, maxLines: 1, start: 28, min: 26 });
        footH = 72;
        pie = () => { g.text(sg.lines[0], M, bot - 42, { font: sg.font, color: tinta }); g.text(fr.lines[0], M, bot, { font: fr.font, color: th.acc }); marca(g, W - M, bot - 70, 70, velo, tinta); };
        if (d.kicker) arriba(d.kicker);
        const ld = lead ? g.fit(lead.toUpperCase(), (s) => F("Montserrat", s, 800, true), { maxW: mw, maxLines: 1, start: 50, min: 30, sp: 4 }) : null;
        const nm = g.fit(d.name, (s) => F("Montserrat", s, 800), { maxW: mw - 20, maxLines: 2, start: 62, min: 38, lh: 1.1 });
        const ln = g.fit(d.line, (s) => F("Montserrat", s, 600), { maxW: mw, maxLines: 2, start: 32, min: 26, lh: 1.25 });
        const vs = g.fit(`«${d.verse}» ${d.ref}`, (s) => F("Montserrat", s, 500, true), { maxW: mw, maxLines: 3, start: 28, min: 26, lh: 1.38 });
        const arma = (conVerso) => {
          const nmB = tb(g, nm, M, { color: tinta, gap: 50 }); nmB.draw = ((dr) => (y) => { dr(y); marcador(M, y + nmB.h + 18, ultima(nm)); })(nmB.draw);
          const rest = [ld && tb(g, ld, M, { color: th.acc, gap: 24 }), nmB, tb(g, ln, M, { color: tinta, gap: 30 }), conVerso && vs.lines.length <= 3 && tb(g, vs, M, { color: tinta, alpha: 0.92 })];
          const room = bot - footH - 40 - (corteT + 60) - alto(rest) - 34;
          const hd = ajusta(g, main.toUpperCase(), (s) => F("Anton", s), { maxW: mw, maxLines: 2, start: 230, min: 96, lh: 0.95, maxH: room });
          rest.splice(1, 0, tb(g, hd, M - 4, { color: tinta, gap: 34 }));
          return { rest, hd };
        };
        let r = arma(true); if (r.hd.size < 140) r = arma(false);
        bs.push(...r.rest);
      } else if (d.kind === "ann") {
        arriba(d.church);
        footH = 30;
        pie = () => { g.text("¡LE ESPERAMOS!", M, bot, { font: F("Montserrat", 30, 800), color: th.acc, sp: 4 }); marca(g, W - M, bot - 66, 70, velo, tinta); };
        if (d.date) {
          const df = F("Anton", 200), dc = capDe(g, df), dw = g.measure(d.day, df), x2 = M + dw + 34;
          const mf = g.fit(d.month.toUpperCase(), (s) => F("Montserrat", s, 800), { maxW: W - M - x2, maxLines: 1, start: 64, min: 30, sp: 2 });
          const wf = g.fit(cap(d.weekday) + (d.time ? " · " + d.time : ""), (s) => F("Montserrat", s, 600), { maxW: W - M - x2, maxLines: 1, start: 36, min: 28 });
          bs.push(pieza(dc, 46, (y) => {
            g.text(d.day, M - 6, y + dc, { font: df, color: th.acc });
            g.text(mf.lines[0], x2, y + dc * 0.44, { font: mf.font, color: tinta, sp: mf.sp });
            g.text(wf.lines[0], x2, y + dc * 0.44 + 62, { font: wf.font, color: tinta });
            ctx.fillStyle = th.acc; ctx.fillRect(x2, y + dc - 8, 90, 8);
          }));
        } else {
          bs.push(tb(g, g.fit("LE INVITAMOS", (s) => F("Montserrat", s, 800, true), { maxW: mw, maxLines: 1, start: 52, min: 30, sp: 5 }), M, { color: th.acc, gap: 30 }));
        }
        const pl = d.place ? g.fit(d.place, (s) => F("Montserrat", s, 600), { maxW: mw - 50, maxLines: 2, start: 34, min: 28, lh: 1.25 }) : null;
        const plB = pl ? tb(g, pl, M + 46, { color: tinta, after: (y, c) => { ctx.fillStyle = th.acc; ctx.beginPath(); ctx.arc(M + 13, y + c * 0.5, 13, 0, PI2); ctx.fill(); } }) : null;
        const room = bot - footH - 40 - (corteT + 60) - alto(bs) - (plB ? plB.h + 66 : 0) - 46;
        const tt = ajusta(g, d.title.toUpperCase(), (s) => F("Anton", s), { maxW: mw, maxLines: 4, start: d.date ? 170 : 210, min: 76, lh: 0.95, maxH: room });
        bs.push(tb(g, tt, M - 4, { color: tinta, gap: 66, after: (y, c) => marcador(M, y + c + (tt.lines.length - 1) * tt.lh + 26, Math.min(mw, ultima(tt) * 0.5)) }));
        if (plB) bs.push(plB);
      } else {
        tarde.push(() => marca(g, W - M, top - 56, 64, velo, tinta));
        if (d.firma) { footH = 22; pie = () => g.text(d.church.toUpperCase(), M, bot, { font: F("Montserrat", 26, 700), color: tinta, sp: 3 }); }
        if (d.eyebrow) bs.push(tb(g, g.fit(d.eyebrow.toUpperCase(), (s) => F("Montserrat", s, 700), { maxW: mw, maxLines: 1, start: 28, min: 26, sp: 4 }), M, { color: th.acc, gap: 26 }));
        if (d.head) bs.push(tb(g, g.fit(d.head, (s) => F("Montserrat", s, 800, true), { maxW: mw, maxLines: 2, start: st ? 84 : 70, min: 40, lh: 1.08 }), M, { color: th.acc, gap: 40 }));
        const rf = g.fit(d.ref.toUpperCase(), (s) => F("Montserrat", s, 800), { maxW: mw, maxLines: 1, start: 34, min: 26, sp: 4 });
        const rfB = tb(g, rf, M, { color: tinta, after: (y, c) => marcador(M, y + c + 16, g.measure(rf.lines[0], rf.font, rf.sp)) });
        const room = bot - footH - (footH ? 50 : 20) - (corteT + 60) - alto(bs) - (bs.length ? 40 : 0) - rfB.h - 56;
        if (d.text.length <= 90) {
          const v = ajusta(g, d.text.toUpperCase(), (s) => F("Anton", s), { maxW: mw, maxLines: 7, start: st ? 160 : 150, min: 60, lh: 0.98, maxH: room });
          bs.push(tb(g, v, M - 3, { color: tinta, gap: 56 }));
        } else {
          // versículo largo: la primera frase en Anton y el resto en letra de texto, en minúsculas (se lee mejor)
          let [a, b] = g.splitVerse(d.text);
          if (!b || a.length > 64) { const w = d.text.split(/\s+/); a = w.slice(0, 4).join(" "); b = w.slice(4).join(" "); }
          const vb = g.fit(b, (s) => F("Montserrat", s, 600), { maxW: mw, maxLines: 6, start: st ? 54 : 46, min: 30, lh: 1.32, maxH: Math.max(room * 0.42, 140) });
          const va = ajusta(g, a.toUpperCase(), (s) => F("Anton", s), { maxW: mw, maxLines: 3, start: st ? 150 : 128, min: 64, lh: 0.98, maxH: room - vb.h - 30 });
          bs.push(tb(g, va, M - 3, { color: tinta, gap: 30 }), tb(g, vb, M, { color: tinta, gap: 52 }));
        }
        bs.push(rfB);
      }
      const yTop = bot - footH - (footH ? 50 : 20) - alto(bs);
      const corte = Math.round(Math.max(corteMin, Math.min(H * 0.6, yTop - 64))), fade = g.photoOn ? Math.round(H * 0.05) : 0, zona = corte + fade;
      // la foto (o los volcanes) solo en la zona que se ve
      if (!foto(g, 0, 0, W, zona, { fy: 0.42, duo: [th.dark, th.hi], filter: "grayscale(1) contrast(1.4) brightness(1.06)" }))
        volcanes(g, 0, 0, W, zona, { sky: th.light, dark: th.dark, sun: th.acc });
      // bloque de lectura plano, con un borde corto (no un degradado largo)
      if (fade) { const lg = ctx.createLinearGradient(0, corte - fade, 0, corte); lg.addColorStop(0, g.rgba(velo, 0)); lg.addColorStop(1, g.rgba(velo, 1)); ctx.fillStyle = lg; ctx.fillRect(0, corte - fade, W, fade + 1); }
      ctx.save(); ctx.beginPath(); ctx.rect(0, corte, W, H - corte); ctx.clip(); g.paper(velo, { fibers: 0.3, grain: 0.05, mottle: 0.5 }); ctx.restore();
      if (tarde.length) { const lt = ctx.createLinearGradient(0, 0, 0, top + 80); lt.addColorStop(0, g.rgba(velo, 0.6)); lt.addColorStop(1, g.rgba(velo, 0)); ctx.fillStyle = lt; ctx.fillRect(0, 0, W, top + 80); }
      g.grain(0.07);
      apila(bs, yTop);
      if (pie) pie();
      tarde.forEach((f) => f());
    },
  });

  // ======================================================================================
  // «Pantalla partida»: el bloque de color arriba con el texto, la foto abajo a todo color, y entre los dos
  // una costura en diagonal. Encima de la costura se pega un sello grande y festoneado (el gesto hecho a mano)
  // con la fecha o la cita. Sin foto: cuatro espigas grandes saliendo de un surco.
  function sello(g, cx, cy, r, color, ink, contenido) {
    const { ctx } = g, n = 26;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.07);
    const borde = () => { ctx.beginPath(); for (let i = 0; i < n; i++) { const a0 = (i / n) * PI2, a1 = ((i + 0.5) / n) * PI2, a2 = ((i + 1) / n) * PI2; if (!i) ctx.moveTo(Math.cos(a0) * r * 0.95, Math.sin(a0) * r * 0.95); ctx.quadraticCurveTo(Math.cos(a1) * r * 1.07, Math.sin(a1) * r * 1.07, Math.cos(a2) * r * 0.95, Math.sin(a2) * r * 0.95); } ctx.closePath(); };
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 7; ctx.fillStyle = color; borde(); ctx.fill(); ctx.restore();
    ctx.save(); borde(); ctx.clip(); g.halftone(-r, -r, 2 * r, 2 * r, ink, { step: 10, alpha: 0.06, size: 0.6 }); ctx.restore();
    ctx.strokeStyle = g.rgba(ink, 0.6); ctx.lineWidth = 3; ctx.setLineDash([3, 8]); ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, PI2); ctx.stroke(); ctx.setLineDash([]);
    contenido();
    ctx.restore();
  }

  E.add({
    id: "fot-partida", name: "Pantalla partida", family: "foto", fonts: ["Archivo Black", "Fraunces", "Hanken Grotesk"],
    themes: {
      marino: { name: "Marino y oro", block: "#0d1b3d", ink: "#f4efe3", acc: "#f2c85b", sky: "#2d5fa8", a: "#0d1b3d", b: "#f2c85b", c: "#f4efe3" },
      tomate: { name: "Tomate", block: "#d6432a", ink: "#fff4e4", acc: "#1d1b18", sky: "#f6d9b0", a: "#1d1b18", b: "#d6432a", c: "#fff4e4" },
      oliva: { name: "Oliva y mostaza", block: "#3f4d24", ink: "#f3ecd6", acc: "#e8a33a", sky: "#b9c08a", a: "#3f4d24", b: "#e8a33a", c: "#f3ecd6" },
      arena: { name: "Arena y teja", block: "#efe2c8", ink: "#2b2118", acc: "#c4532c", sky: "#f1c59b", a: "#2b2118", b: "#c4532c", c: "#fbf1df" },
      cielo: { name: "Cielo y mandarina", block: "#d7e6ef", ink: "#12304a", acc: "#e86a3a", sky: "#9cc3dc", a: "#12304a", b: "#e86a3a", c: "#fdf6ea" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 76, st = esHistoria(g), sq = d.kind === "verse" && g.fmt === "cuadrado", mw = W - 2 * M;
      const S = Math.round(H * (sq ? 0.58 : st ? 0.54 : d.kind === "verse" ? 0.56 : 0.52)), T = Math.round(W * 0.04), yS = (x) => S + T - (2 * T * x) / W;
      const P = { sky: th.sky, a: th.a, b: th.b, c: th.c }, onA = sobre(g, th.acc);
      // abajo, la foto a color (o el trigo); arriba, el bloque con la costura en diagonal
      const yF = S - T - 6;
      if (!foto(g, 0, yF, W, H - yF, { fy: 0.5, filter: "saturate(.94) contrast(1.06)" })) espigas(g, 0, yF, W, H - yF, P);
      const blk = (c) => { c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(W, yS(W)); c.lineTo(0, yS(0)); c.closePath(); };
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8; ctx.fillStyle = th.block; ctx.beginPath(); blk(ctx); ctx.fill(); ctx.restore();
      ctx.save(); ctx.beginPath(); blk(ctx); ctx.clip(); g.paper(th.block, { fibers: 0.3, grain: 0.06 }); ctx.restore();
      g.grain(0.04);
      const top = st ? 250 : sq ? 76 : 88, R0 = Math.round(W * (sq ? 0.135 : 0.155)), scx = W - M - R0 + 24, scy = yS(scx) + R0 * 0.14;
      const lab = (s, x, y, o = {}) => g.text(String(s).toUpperCase(), x, y, { font: F("Hanken Grotesk", o.size || 26, 700), color: o.color || th.ink, sp: o.sp ?? 3, align: o.align });
      // fila de arriba: la iglesia y el logo
      lab(d.church, M, top + 4);
      marca(g, W - M, top - 40, 60, th.block, th.ink);
      // la franja a la izquierda del sello, justo sobre la costura (firma o lugar)
      const bandR = scx - R0 * 1.08 - 34, bandW = bandR - M, bandY = yS(bandR) - 36;
      const yMax = Math.min(scy - R0 * 1.07 - 34, bandY - 120), y0 = top + 86;
      const bs = []; let banda = null;
      const enSello = (big, small, bigFirst = true) => () => {
        const b = g.fit(big, (s) => F("Archivo Black", s), { maxW: R0 * 1.3, maxLines: 1, start: R0 * 0.95, min: 34 });
        const sm = small ? g.fit(small.toUpperCase(), (s) => F("Hanken Grotesk", s, 800), { maxW: R0 * 1.3, maxLines: 1, start: Math.round(R0 * 0.24), min: 26, sp: 2 }) : null;
        const hB = capDe(g, b.font), hS = sm ? capDe(g, sm.font) : 0, gap = sm ? R0 * 0.14 : 0, yy = -(hB + hS + gap) / 2;
        if (bigFirst) { g.text(b.lines[0], 0, yy + hB, { font: b.font, color: onA, align: "center" }); if (sm) g.text(sm.lines[0], 0, yy + hB + gap + hS, { font: sm.font, color: onA, align: "center", sp: sm.sp }); }
        else { g.text(sm.lines[0], 0, yy + hS, { font: sm.font, color: onA, align: "center", sp: sm.sp }); g.text(b.lines[0], 0, yy + hS + gap + hB, { font: b.font, color: onA, align: "center" }); }
      };
      const enSelloTxt = (t1, t2) => () => {
        const f = F("Fraunces", Math.round(R0 * 0.34), 400, true), c = capDe(g, f), lh = R0 * 0.4;
        g.text(t1, 0, -lh / 2 + c / 2, { font: f, color: onA, align: "center" }); g.text(t2, 0, lh / 2 + c / 2, { font: f, color: onA, align: "center" });
      };
      let contenido;
      if (d.kind === "card") {
        const kp = fecha(d.kicker);
        contenido = kp ? enSello(kp[0], kp[1]) : enSelloTxt("con", "cariño");
        const [lead, main] = g.splitHead(d.headline);
        const sg = ajusta(g, `${d.signature} · ${d.from}`, (s) => F("Hanken Grotesk", s, 700), { maxW: bandW, maxLines: 2, start: 28, min: 26, lh: 1.3 });
        banda = () => g.lines(sg.lines, M, bandY - (sg.lines.length - 1) * sg.lh, sg.lh, { font: sg.font, color: th.ink });
        const ld = lead ? g.fit(lead.replace(/[¡!]/g, "").toLowerCase(), (s) => F("Fraunces", s, 400, true), { maxW: mw, maxLines: 1, start: 80, min: 44 }) : null;
        const nm = g.fit(d.name, (s) => F("Hanken Grotesk", s, 800), { maxW: mw, maxLines: 2, start: 64, min: 36, lh: 1.08 });
        const ln = g.fit(d.line, (s) => F("Fraunces", s, 400, true), { maxW: mw, maxLines: 2, start: 40, min: 30, lh: 1.25 });
        const rest = [tb(g, nm, M, { color: th.ink, gap: 22 }), tb(g, ln, M, { color: th.ink })];
        const room = yMax - y0 - alto(rest) - (ld ? capDe(g, ld.font) + 30 : 0) - 40;
        const hd = ajusta(g, (ld ? main : d.headline).replace(/[¡!]/g, "").toUpperCase(), (s) => F("Archivo Black", s), { maxW: mw, maxLines: 2, start: 190, min: 60, lh: 1.0, maxH: room });
        if (ld) bs.push(tb(g, ld, M, { color: th.acc, gap: 30 }));
        bs.push(tb(g, hd, M - 3, { color: th.ink, gap: 40 }), ...rest);
      } else if (d.kind === "ann") {
        contenido = d.date ? enSello(d.day, d.month) : enSelloTxt("¡le", "esperamos!");
        if (d.place) {
          const pl = ajusta(g, d.place, (s) => F("Hanken Grotesk", s, 600), { maxW: bandW - 30, maxLines: 2, start: 30, min: 26, lh: 1.28 });
          banda = () => { const yb = bandY - (pl.lines.length - 1) * pl.lh, c = capDe(g, pl.font); ctx.fillStyle = th.acc; ctx.fillRect(M, yb - c, 9, c + (pl.lines.length - 1) * pl.lh); g.lines(pl.lines, M + 30, yb, pl.lh, { font: pl.font, color: th.ink }); };
        }
        const lf = g.fit(d.date ? cap(d.weekday) + (d.time ? ", " + d.time : "") : "le invitamos", (s) => F("Fraunces", s, 400, true), { maxW: mw, maxLines: 1, start: 60, min: 34 });
        const lfB = tb(g, lf, M, { color: th.acc, gap: 38 });
        const room = yMax - y0 - lfB.h - 38;
        const tt = ajusta(g, d.title.toUpperCase(), (s) => F("Archivo Black", s), { maxW: mw, maxLines: 4, start: 170, min: 50, lh: 1.02, maxH: room });
        bs.push(lfB, tb(g, tt, M - 3, { color: th.ink }));
      } else {
        const [book, num] = cita(d.ref);
        // el libro grande y la cita abajo; si el nombre es muy largo va en letra más angosta
        contenido = () => {
          let b = g.fit(book.toUpperCase(), (s) => F("Archivo Black", s), { maxW: R0 * 1.5, maxLines: 1, start: Math.round(R0 * 0.4), min: 34 });
          if (g.measure(b.lines[0], b.font) > R0 * 1.5) b = g.fit(book.toUpperCase(), (s) => F("Hanken Grotesk", s, 800), { maxW: R0 * 1.55, maxLines: 1, start: Math.round(R0 * 0.36), min: 26 });
          const nf = num ? g.fit(num, (s) => F("Hanken Grotesk", s, 800), { maxW: R0 * 1.3, maxLines: 1, start: Math.round(R0 * 0.34), min: 26 }) : null;
          const hB = capDe(g, b.font), hN = nf ? capDe(g, nf.font) : 0, gap = nf ? R0 * 0.16 : 0, yy = -(hB + hN + gap) / 2;
          g.text(b.lines[0], 0, yy + hB, { font: b.font, color: onA, align: "center" });
          if (nf) { g.text(nf.lines[0], 0, yy + hB + gap + hN, { font: nf.font, color: onA, align: "center", sp: 2 }); }
        };
        if (d.eyebrow) bs.push(tb(g, g.fit(d.eyebrow.toUpperCase(), (s) => F("Hanken Grotesk", s, 700), { maxW: mw, maxLines: 1, start: 28, min: 26, sp: 3 }), M, { color: th.acc, gap: 22 }));
        if (d.head) bs.push(tb(g, g.fit(d.head, (s) => F("Fraunces", s, 400, true), { maxW: mw, maxLines: 2, start: st ? 80 : 64, min: 36, lh: 1.05 }), M, { color: th.acc, gap: 44 }));
        const room = yMax - y0 - alto(bs) - (bs.length ? 44 : 0);
        const v = ajusta(g, d.text, (s) => F("Fraunces", s, 700), { maxW: mw, maxLines: 12, start: st ? 110 : 100, min: 30, lh: 1.12, maxH: room, equil: false });
        bs.push(tb(g, v, M - 2, { color: th.ink }));
      }
      // el texto: arriba, y si sobra espacio se reparte (sin despegar el nombre del titular)
      const libre = Math.max(0, yMax - y0 - alto(bs));
      apila(bs, y0 + libre * 0.45);
      if (banda) banda();
      sello(g, scx, scy, R0, th.acc, onA, contenido);
    },
  });
  // ======================================================================================
  // «Polaroid»: una foto instantánea pegada con cinta sobre papel, con el pie escrito a mano.
  // Sin foto: flores de campo con sol, a tres tintas.
  function polaroid(g, cx, cy, pw, ph, ang, fill, cap, capColor) {
    const { ctx } = g, b = Math.round(pw * 0.055), bb = Math.round(pw * 0.25), fw = pw + 2 * b, fh = ph + b + bb;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.32)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12; ctx.fillStyle = "#fbf8f1"; ctx.fillRect(-fw / 2, -fh / 2, fw, fh); ctx.restore();
    const px = -fw / 2 + b, py = -fh / 2 + b;
    ctx.save(); fill(px, py, pw, ph); ctx.restore();
    ctx.strokeStyle = "rgba(0,0,0,.2)"; ctx.lineWidth = 1.5; ctx.strokeRect(px, py, pw, ph);
    if (cap) { const c = capDe(g, cap.font), hh = c + (cap.lines.length - 1) * cap.lh; g.lines(cap.lines, 0, py + ph + (bb - hh) / 2 + c - 2, cap.lh, { font: cap.font, color: capColor, align: "center" }); }
    g.tape(-fw * 0.02, -fh / 2 + 4, fw * 0.36, -0.06, "rgba(240,232,205,.82)");
    ctx.restore();
  }
  const marcoPola = (pw, ph) => { const b = Math.round(pw * 0.055), bb = Math.round(pw * 0.25); return { fw: pw + 2 * b, fh: ph + b + bb }; };

  E.add({
    id: "fot-polaroid", name: "Polaroid", family: "foto", fonts: ["Caveat", "DM Serif Display", "Work Sans"],
    themes: {
      kraft: { name: "Kraft", bg: "#c9a67b", ink: "#2a1d14", acc: "#8e2817", sky: "#f2ddb0", a: "#2f4a37", b: "#fbf7ee", c: "#e0873a" },
      marino: { name: "Marino y oro", bg: "#0d1b3d", ink: "#f4efe3", acc: "#f2c85b", sky: "#2d5fa8", a: "#0d1b3d", b: "#f4efe3", c: "#f2c85b" },
      rosa: { name: "Rosa palo", bg: "#f2d5cd", ink: "#3a1a24", acc: "#b8344f", sky: "#f7e6c9", a: "#3a1a24", b: "#c2405a", c: "#f0a33c" },
      pizarra: { name: "Pizarra y naranja", bg: "#26413a", ink: "#f2ead6", acc: "#f0a04b", sky: "#cfe0d2", a: "#26413a", b: "#f0a04b", c: "#fbf4e4" },
      crema: { name: "Crema y azul", bg: "#efe6d4", ink: "#1f2430", acc: "#2d5fa8", sky: "#bcd3ea", a: "#1f2430", b: "#fbf7ee", c: "#e3a21f" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 80, st = esHistoria(g), mw = W - 2 * M;
      g.paper(th.bg, { fibers: 0.55, grain: 0.07 });
      const P = { sky: th.sky, a: th.a, b: th.b, c: th.c };
      const fill = (x, y, w, h) => { if (!g.photo(x, y, w, h, { treat: "calido" })) flores(g, x, y, w, h, P); };
      const pie = (s, pw) => g.fit(s, (z) => F("Caveat", z, 700), { maxW: pw - 24, maxLines: 2, start: Math.round(pw * 0.12), min: 30, lh: 0.98 });
      // el texto pequeño siempre en la tinta del tema (el color de acento solo en lo grande)
      const lab = (s, x, y, o = {}) => g.text(String(s).toUpperCase(), x, y, { font: F("Work Sans", o.size || 26, 600), color: o.color || th.ink, sp: o.sp ?? 3, align: o.align });
      const labs = (s, x, y, w, o = {}) => { const f = g.fit(String(s).toUpperCase(), (z) => F("Work Sans", z, 600), { maxW: w, maxLines: o.lines || 2, start: o.size || 26, min: 26, lh: 1.35, sp: 2.5 }); return g.lines(f.lines, x, y, f.lh, { font: f.font, sp: f.sp, color: o.color || th.ink, align: o.align }); };
      const logo = (x, y, h) => marca(g, x, y, h, th.bg, th.ink);
      if (d.kind === "card" || d.kind === "ann") {
        const pw = 500, ph = 500, { fw, fh } = marcoPola(pw, ph), cx = M + fw / 2 + 6, cy = 94 + fh / 2;
        polaroid(g, cx, cy, pw, ph, d.kind === "card" ? -0.045 : -0.035, fill, pie(d.kind === "card" ? d.name : d.place || d.church, pw), "#2a2622");
        const x0 = cx + fw / 2 + 52, cw = W - M - x0, pyB = cy + fh / 2;
        let y = 112;
        const kp = d.kind === "card" ? fecha(d.kicker) : d.date ? [d.day, d.month] : null;
        if (kp) {
          const df = g.fit(kp[0], (s) => F("DM Serif Display", s), { maxW: cw, maxLines: 1, start: 210, min: 90 }), dc = capDe(g, df.font);
          g.text(kp[0], x0 - 4, y + dc, { font: df.font, color: th.acc });
          y = y + dc + 58;
          const mf = g.fit(kp[1].toUpperCase(), (s) => F("Work Sans", s, 600), { maxW: cw, maxLines: 1, start: 32, min: 26, sp: 4 });
          g.text(mf.lines[0], x0, y, { font: mf.font, color: th.ink, sp: mf.sp });
          ctx.fillStyle = th.ink; ctx.fillRect(x0, y + 22, 70, 4); y += 26;
        } else if (d.kind === "card" && d.kicker) { y = labs(d.kicker, x0, y + 30, cw) + 10; }
        if (d.kind === "ann") {
          if (d.date) {
            g.text(cap(d.weekday), x0, y + 72, { font: F("DM Serif Display", 46, 400, true), color: th.ink });
            if (d.time) g.text(d.time, x0, y + 128, { font: F("Work Sans", 38, 600), color: th.ink });
          } else {
            g.lines(["Le", "invitamos"], x0, y + 70, 82, { font: F("DM Serif Display", 78, 400, true), color: th.acc });
            icono(ctx, "cruz", x0 + 34, y + 270, 70, th.ink);
          }
        } else {
          // la frase corta de la tarjeta, al lado de la foto
          const lf = g.fit(d.line, (s) => F("DM Serif Display", s, 400, true), { maxW: cw, maxLines: 5, start: 46, min: 30, lh: 1.14, maxH: pyB - y - 70 });
          g.lines(lf.lines, x0, y + 40 + lf.size, lf.lh, { font: lf.font, color: th.ink });
        }
        // debajo de la polaroid
        const yA = pyB + 66, yZ = H - 84, yB = yZ - 66;
        logo(W - M, yZ - 56, 62);
        if (d.kind === "card") {
          const sf = g.fit(`${d.signature} · ${d.from}`, (s) => F("Work Sans", s, 600), { maxW: mw - 110, maxLines: 1, start: 28, min: 24 });
          g.text(sf.lines[0], M, yZ, { font: sf.font, color: th.ink });
          const vs = g.fit(`«${d.verse}»`, (s) => F("DM Serif Display", s, 400, true), { maxW: mw, maxLines: 3, start: 32, min: 28, lh: 1.3 });
          const rf = g.fit(d.ref.toUpperCase(), (s) => F("Work Sans", s, 600), { maxW: mw, maxLines: 1, start: 26, min: 26, sp: 3 });
          const rest = [tb(g, vs, M, { color: th.ink, gap: 20 }), tb(g, rf, M, { color: th.ink })];
          const hd = ajusta(g, d.headline, (s) => F("DM Serif Display", s), { maxW: mw, maxLines: 2, start: 124, min: 60, lh: 1.0, maxH: yB - yA - alto(rest) - 40 });
          const bs = [tb(g, hd, M - 3, { color: th.ink, gap: Math.round(hd.size * 0.22) + 18 }), ...rest];
          apila(bs, Math.max(yA, yB - alto(bs)));
        } else {
          lab("¡Le esperamos!", M, yZ, { size: 28, sp: 4 });
          ctx.fillStyle = th.acc; ctx.fillRect(M, yZ + 14, 120, 5);
          const tt = ajusta(g, d.title, (s) => F("DM Serif Display", s), { maxW: mw, maxLines: 3, start: 150, min: 70, lh: 1.02, maxH: yB - yA });
          const b = tb(g, tt, M - 3, { color: th.ink });
          apila([b], yA + Math.max(0, (yB - yA - b.h) * 0.45));
        }
      } else if (g.fmt === "cuadrado") {
        const pw = 400, ph = 400, { fw, fh } = marcoPola(pw, ph), cx = M + fw / 2 + 4, cy = H / 2 + 4;
        polaroid(g, cx, cy, pw, ph, -0.05, fill, pie(d.ref, pw), "#2a2622");
        const x0 = cx + fw / 2 + 50, cw = W - M - x0, bs = [];
        if (d.eyebrow) bs.push(tb(g, g.fit(d.eyebrow.toUpperCase(), (s) => F("Work Sans", s, 600), { maxW: cw, maxLines: 2, start: 26, min: 26, sp: 2.5, lh: 1.35 }), x0, { color: th.ink, gap: 22 }));
        if (d.head) bs.push(tb(g, g.fit(d.head, (s) => F("DM Serif Display", s, 400, true), { maxW: cw, maxLines: 2, start: 50, min: 32, lh: 1.05 }), x0, { color: th.acc, gap: 30 }));
        const foot = d.firma ? 90 : 0, free = H - 170 - alto(bs) - foot;
        bs.push(tb(g, g.fit(d.text, (s) => F("DM Serif Display", s), { maxW: cw, maxLines: 12, start: 84, min: 30, lh: 1.14, maxH: free * 1.12 }), x0, { color: th.ink }));
        const hT = alto(bs), y0 = Math.max(90, (H - hT - foot) / 2);
        const ye = apila(bs, y0);
        if (d.firma) labs(d.church, x0, ye + 70, cw);
        logo(W - M, H - 50 - 50, 50);
      } else {
        // post y historia: la polaroid grande, el versículo abajo
        const pw = st ? 560 : 520, ph = st ? 560 : 430, { fw, fh } = marcoPola(pw, ph);
        let yTop = st ? 250 : 80;
        const bsTop = [];
        if (st) {
          if (d.eyebrow) bsTop.push(tb(g, g.fit(d.eyebrow.toUpperCase(), (s) => F("Work Sans", s, 600), { maxW: mw, maxLines: 1, start: 28, min: 26, sp: 4 }), M, { color: th.ink, gap: 26 }));
          if (d.head) bsTop.push(tb(g, g.fit(d.head, (s) => F("DM Serif Display", s, 400, true), { maxW: mw, maxLines: 2, start: 96, min: 50, lh: 1.04 }), M, { color: th.ink, gap: 50 }));
          yTop = apila(bsTop, yTop) + (bsTop.length ? 70 : 0);
        }
        const cx = st ? W / 2 + 20 : W - M - fw / 2 + 4, cy = yTop + fh / 2 + 4;
        polaroid(g, cx, cy, pw, ph, 0.04, fill, pie(st ? d.ref : d.eyebrow || "Palabra para hoy", pw), "#2a2622");
        if (!st) {
          // a la izquierda: unas comillas enormes como dibujo, y debajo la cita (libro grande, número abajo)
          const x0 = M, cw = cx - fw / 2 - 40 - M, qf = F("DM Serif Display", 800), m = (ctx.font = qf, ctx.measureText("“"));
          const qy = 70 + m.actualBoundingBoxAscent;
          g.text("“", x0 - 14, qy, { font: qf, color: th.acc });
          const [book, num] = cita(d.ref);
          const bf = g.fit(book, (s) => F("DM Serif Display", s, 400, true), { maxW: cw, maxLines: 2, start: 96, min: 40, lh: 1.02 });
          const cb = [tb(g, bf, x0, { color: th.ink, gap: 18 }), num && tb(g, g.fit(num, (s) => F("Work Sans", s, 600), { maxW: cw, maxLines: 1, start: 52, min: 30, sp: 3 }), x0, { color: th.ink })];
          const ye = apila(cb, qy + m.actualBoundingBoxDescent + 50);
          if (d.head) { const hf = g.fit(d.head, (s) => F("DM Serif Display", s, 400, true), { maxW: cw, maxLines: 3, start: 44, min: 30, lh: 1.08 }); g.lines(hf.lines, x0, ye + 80, hf.lh, { font: hf.font, color: th.acc }); }
        }
        const yA = cy + fh / 2 + 80, bot = H - (st ? 300 : 84), foot = d.firma ? 70 : 0;
        const v = g.fit(`${d.text}${st ? "" : "”"}`, (s) => F("DM Serif Display", s), { maxW: mw, maxLines: 10, start: st ? 74 : 70, min: 30, lh: 1.16, maxH: (bot - foot - yA) * 1.1 });
        const vb = tb(g, v, M - 2, { color: th.ink });
        const ye = apila([vb], yA + Math.max(0, (bot - foot - yA - vb.h) * 0.35));
        if (d.firma) lab(d.church, M, Math.min(bot, ye + 80));
        logo(W - M, bot - 54, 54);
      }
    },
  });

  // ======================================================================================
  // «Ventana en arco»: la foto dentro de un arco de capilla, centrado a propósito, con la fecha o la cita
  // tallada en la repisa; el texto debajo, centrado como un boletín de capilla. Sin foto: un vitral con cruz.
  E.add({
    id: "fot-arco", name: "Ventana en arco", family: "foto", fonts: ["Playfair Display", "Allura", "Montserrat"],
    themes: {
      marfil: { name: "Marfil y teja", bg: "#f3ece0", ink: "#1e2a3a", acc: "#b04e33", sky: "#f0cf9a", ra: "#1e2a3a", rb: "#c0573a", sun: "#fbf4e6" },
      marino: { name: "Marino y oro", bg: "#0d1b3d", ink: "#f4efe3", acc: "#f2c85b", sky: "#f2c85b", ra: "#0d1b3d", rb: "#2d5fa8", sun: "#fbf3df" },
      salvia: { name: "Salvia", bg: "#e3e6d8", ink: "#26352b", acc: "#a3552f", sky: "#f1e3c4", ra: "#26352b", rb: "#7d9a7f", sun: "#b5643c" },
      rosa: { name: "Rosa y ciruela", bg: "#f5e1dc", ink: "#3c2230", acc: "#b5442f", sky: "#f7c9a8", ra: "#3c2230", rb: "#c9553f", sun: "#fdf1e6" },
      vino: { name: "Vino y durazno", bg: "#3a1622", ink: "#f6e9df", acc: "#f0b98a", sky: "#f0b98a", ra: "#3a1622", rb: "#a8434f", sun: "#f6e9df" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 80, st = esHistoria(g), sq = d.kind === "verse" && g.fmt === "cuadrado", mw = W - 2 * M, C = W / 2;
      g.paper(th.bg, { fibers: 0.4, grain: 0.06 });
      const P = { sky: th.sky, ra: th.ra, rb: th.rb, sun: th.sun };
      const ver = d.kind === "verse";
      const aw = sq ? 320 : st ? 560 : ver ? 420 : d.kind === "ann" ? 440 : 420, ah = sq ? 370 : st ? 760 : ver ? 520 : d.kind === "ann" ? 540 : 490;
      const ax = C - aw / 2, ay = st ? 236 : sq ? 58 : 66;
      // ventana: marco fino, foto (o vitral) y repisa con la fecha
      const r = aw / 2, path = (c) => { c.moveTo(ax, ay + ah); c.lineTo(ax, ay + r); c.arc(ax + r, ay + r, r, Math.PI, 0); c.lineTo(ax + aw, ay + ah); c.closePath(); };
      ctx.save(); ctx.strokeStyle = th.acc; ctx.lineWidth = 3; const o = 18; ctx.beginPath(); ctx.moveTo(ax - o, ay + ah); ctx.lineTo(ax - o, ay + r); ctx.arc(ax + r, ay + r, r + o, Math.PI, 0); ctx.lineTo(ax + aw + o, ay + ah); ctx.stroke(); ctx.restore();
      if (!g.photo(ax, ay, aw, ah, { treat: "calido", path })) { ctx.save(); ctx.beginPath(); path(ctx); ctx.clip(); vitral(g, ax, ay, aw, ah, P); ctx.restore(); }
      const shh = sq ? 64 : 78, sy = ay + ah, sw = Math.max(aw + 150, sq ? 460 : 560);
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.2)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4; ctx.fillStyle = th.ink; ctx.fillRect(C - sw / 2, sy, sw, shh); ctx.restore();
      ctx.fillStyle = th.acc; ctx.fillRect(C - sw / 2 - 16, sy, sw + 32, 8);
      const kp = d.kind === "card" ? fecha(d.kicker) : null;
      const repisa = d.kind === "card" ? (kp ? `${kp[0]} de ${kp[1]}` : d.kicker || d.churchShort) : d.kind === "ann" ? (d.date ? `${d.day} de ${d.month}` : "Todos son bienvenidos") : d.ref;
      const rf = g.fit(repisa.toUpperCase(), (s) => F("Montserrat", s, 800), { maxW: sw - 60, maxLines: 1, start: sq ? 30 : 34, min: 26, sp: 4 });
      g.text(rf.lines[0], C, sy + 8 + (shh - 8) / 2 + capDe(g, rf.font) / 2, { font: rf.font, color: th.bg, align: "center", sp: rf.sp });
      marca(g, M, ay, sq ? 52 : 60, th.bg, th.ink, "left");
      const bot = H - (st ? 300 : sq ? 62 : 80), yA = sy + shh + (sq ? 44 : 54);
      const ctr = (f, o = {}) => tb(g, f, C, { ...o, align: "center" });
      const script = (s, start) => g.fit(s, (z) => F("Allura", z), { maxW: mw, maxLines: 1, start, min: 56 });
      const scB = (ld, gap) => { const c = capDe(g, ld.font) * 0.62; return pieza(Math.round(c), gap ?? Math.round(ld.size * 0.4), (yy) => g.text(ld.lines[0], C, yy + c, { font: ld.font, color: th.acc, align: "center" })); };
      const pie = (s, color, w = 600) => { const f = g.fit(s, (z) => F("Montserrat", z, w), { maxW: mw, maxLines: 1, start: 28, min: 24 }); g.text(f.lines[0], C, bot, { font: f.font, color: color || th.ink, align: "center" }); };
      const yZ = bot - 66;
      let bs = [];
      if (d.kind === "card") {
        pie(`${d.signature} · ${d.from}`);
        const [lead, main0] = g.splitHead(d.headline), main = main0.replace(/[¡!]/g, "").toLowerCase(), mws = main.split(/\s+/);
        const ld = lead ? script(lead, 120) : null;
        const nm = ajusta(g, d.name.toUpperCase(), (s) => F("Montserrat", s, 800), { maxW: mw, maxLines: 2, start: 40, min: 28, lh: 1.2, sp: 2 });
        const ln = g.fit(d.line, (s) => F("Playfair Display", s, 500, true), { maxW: mw, maxLines: 2, start: 34, min: 28, lh: 1.25 });
        const vs = g.fit(`«${d.verse}» ${d.ref}`, (s) => F("Playfair Display", s, 500), { maxW: mw, maxLines: 3, start: 28, min: 26, lh: 1.35 });
        const arma = (conVerso) => {
          const rest = [ctr(nm, { color: th.ink, gap: 20 }), ctr(ln, { color: th.ink, gap: 30 }), conVerso && ctr(vs, { color: th.ink, alpha: 0.92 })];
          const pre = ld ? [scB(ld)] : [];
          const room = yZ - yA - alto(pre) - (pre.length ? pre[0].gap : 0) - alto(rest) - 40;
          let hb;
          if (mws.length > 1) {
            // «¡Feliz» (caligrafía) / «aniversario» (grande) / «de bodas» (mediano)
            const big = mws[0], rest2 = mws.slice(1).join(" ");
            const hb1 = g.fit(big, (s) => F("Playfair Display", s, 700, true), { maxW: mw, maxLines: 1, start: 150, min: 60, maxH: room * 0.66 });
            const hb2 = g.fit(rest2, (s) => F("Playfair Display", s, 500, true), { maxW: mw, maxLines: 1, start: Math.round(hb1.size * 0.55), min: 34 });
            hb = [ctr(hb1, { color: th.ink, gap: Math.round(hb2.size * 0.3) }), ctr(hb2, { color: th.ink, gap: Math.round(hb1.size * 0.24) + 14 })];
          } else {
            const hd = ajusta(g, main, (s) => F("Playfair Display", s, 700, true), { maxW: mw, maxLines: 2, start: 150, min: 60, lh: 0.98, maxH: room });
            hb = [ctr(hd, { color: th.ink, gap: Math.round(hd.size * 0.24) + 14 })];
          }
          return [...pre, ...hb, ...rest];
        };
        bs = arma(true); if (alto(bs) > yZ - yA) bs = arma(false);
      } else if (d.kind === "ann") {
        pie("¡LE ESPERAMOS!", th.acc, 800);
        const ld = script("Le invitamos", 104);
        const wh = d.date ? g.fit(cap(d.weekday) + (d.time ? " · " + d.time : ""), (s) => F("Montserrat", s, 700), { maxW: mw, maxLines: 1, start: 36, min: 28 }) : null;
        const pl = d.place ? g.fit(d.place, (s) => F("Montserrat", s, 600), { maxW: mw, maxLines: 2, start: 30, min: 26, lh: 1.3 }) : null;
        const rest = [wh && ctr(wh, { color: th.ink, gap: 22 }), pl && ctr(pl, { color: th.ink, alpha: 0.9 })];
        const pre = [scB(ld)], room = yZ - yA - alto(pre) - pre[0].gap - alto(rest) - 40;
        const tt = ajusta(g, d.title, (s) => F("Playfair Display", s, 700), { maxW: mw, maxLines: 3, start: 116, min: 50, lh: 1.04, maxH: room });
        bs = [...pre, ctr(tt, { color: th.ink, gap: 34 }), ...rest];
      } else {
        if (d.firma) pie(d.church.toUpperCase(), th.ink);
        if (d.eyebrow) bs.push(ctr(g.fit(d.eyebrow.toUpperCase(), (s) => F("Montserrat", s, 700), { maxW: mw, maxLines: 1, start: 26, min: 26, sp: 3 }), { color: th.acc, gap: 30 }));
        if (d.head) bs.push(scB(script(d.head, st ? 120 : 100), 56));
        const room = (d.firma ? yZ : bot) - yA - alto(bs) - (bs.length ? 50 : 0) - 10;
        // versículos largos en redonda (se leen mejor); los cortos en cursiva
        const v = ajusta(g, d.text, (s) => F("Playfair Display", s, 500, d.text.length <= 110), { maxW: mw, maxLines: 10, start: sq ? 100 : 104, min: 30, lh: 1.2, maxH: room, equil: d.text.length < 90 });
        bs.push(ctr(v, { color: th.ink }));
      }
      const zona = (d.kind === "verse" && !d.firma ? bot : yZ) - yA;
      apila(bs, yA + Math.max(0, (zona - alto(bs)) * 0.4));
    },
  });

  // ======================================================================================
  // «Fotomatón»: una tira de cabina con tres cuadros (la misma foto con tres encuadres distintos: entera,
  // acercada a la izquierda y un detalle, en blanco y negro) pegada a la derecha; el texto en una columna.
  // Sin foto: tres escenas pequeñas a dos tintas. Gesto a mano: una palabra escrita con plumón.
  E.add({
    id: "fot-fotomaton", name: "Fotomatón", family: "foto", fonts: ["Bebas Neue", "Special Elite", "Permanent Marker"],
    themes: {
      rojo: { name: "Rojo cabina", bg: "#c8342b", ink: "#fff4e6", acc: "#1a1a1a", hand: "#fff4e6", fa: "#1a1a1a", fb: "#f3d9c8", fc: "#c8342b" },
      marino: { name: "Marino y oro", bg: "#0d1b3d", ink: "#f4efe3", acc: "#f2c85b", hand: "#f2c85b", fa: "#0d1b3d", fb: "#9db9e4", fc: "#f2c85b" },
      mostaza: { name: "Mostaza", bg: "#f0c64a", ink: "#1d1a16", acc: "#7a1f14", hand: "#7a1f14", fa: "#1d1a16", fb: "#f7e7b8", fc: "#c63b2b" },
      menta: { name: "Menta y coral", bg: "#cfe5d8", ink: "#14302a", acc: "#a5321e", hand: "#a5321e", fa: "#14302a", fb: "#f4efe2", fc: "#e0533a" },
      noche: { name: "Noche", bg: "#171717", ink: "#f2efe8", acc: "#ff6b4a", hand: "#ff6b4a", fa: "#171717", fb: "#e9e4d8", fc: "#ff6b4a" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 76, st = esHistoria(g), sq = d.kind === "verse" && g.fmt === "cuadrado";
      g.paper(th.bg, { fibers: 0.3, grain: 0.07 });
      const n = 3, sw = sq ? 380 : st ? 450 : 420, sy = st ? 170 : sq ? 56 : 64, sh = H - 2 * sy, sx = W - M - sw + 22, ang = 0.028;
      // la tira
      ctx.save(); ctx.translate(sx + sw / 2, sy + sh / 2); ctx.rotate(ang); ctx.translate(-sw / 2, -sh / 2);
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10; ctx.fillStyle = "#f7f4ec"; ctx.fillRect(0, 0, sw, sh); ctx.restore();
      const pad = Math.round(sw * 0.07), footS = Math.round(sw * 0.2), fw = sw - 2 * pad, fh = (sh - pad * (n + 1) - footS) / n;
      // tres tomas distintas: la foto entera, un acercamiento a la izquierda y un detalle del centro (con otra exposición)
      const tomas = [
        { zoom: 1, fx: 0.5, fy: 0.45, filter: "grayscale(1) contrast(1.12)" },
        { zoom: 1.9, fx: 0.12, fy: 0.55, filter: "grayscale(1) contrast(1.2) brightness(1.1)" },
        { zoom: 2.7, fx: 0.62, fy: 0.36, filter: "grayscale(1) contrast(1.35) brightness(.94)" },
      ];
      for (let i = 0; i < n; i++) {
        const fx = pad, fy = pad + i * (fh + pad);
        if (!foto(g, fx, fy, fw, fh, tomas[i])) escena(g, [1, 0, 3][i], fx, fy, fw, fh, th);
        ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 1.2; ctx.strokeRect(fx, fy, fw, fh);
      }
      const sello = (d.kind === "ann" && d.date ? `${d.day} ${d.month.slice(0, 3)}` : d.kind === "card" && fecha(d.kicker) ? `${fecha(d.kicker)[0]} ${fecha(d.kicker)[1].slice(0, 3)}` : "").toUpperCase();
      g.text(`${d.churchShort.toUpperCase()}${sello ? " · " + sello : ""}`, sw / 2, sh - footS / 2 + 10, { font: F("Special Elite", 28), color: "#2c2925", align: "center", sp: 2 });
      ctx.restore();
      // columna de texto
      const x0 = M, cw = sx - 56 - M, top = st ? 250 : sq ? 84 : 100, bot = H - (st ? 300 : sq ? 70 : 84);
      const tw = (s, size, o = {}) => g.fit(s, (z) => F("Special Elite", z), { maxW: cw, maxLines: o.lines || 2, start: size, min: o.min || 26, lh: 1.3, sp: o.sp || 0 });
      const mano = (s, size) => g.fit(s, (z) => F("Permanent Marker", z), { maxW: cw - 20, maxLines: 1, start: size, min: 40 });
      const manoB = (f, gap) => pieza(Math.round(capDe(g, f.font)), gap, (y) => g.text(f.lines[0], x0 + 6, y + capDe(g, f.font), { font: f.font, color: th.hand, rotate: -0.05 }));
      const logo = (x, y, h, al) => marca(g, x, y, h, th.bg, th.ink, al);
      if (d.kind === "card") {
        const bs = [];
        if (d.kicker) bs.push(tb(g, tw(d.kicker.toUpperCase(), 30, { lines: 1, sp: 1 }), x0, { color: th.ink, gap: 40 }));
        const [lead, main] = g.splitHead(d.headline);
        const ld = lead ? mano(lead, 96) : null;
        const nm = ajusta(g, d.name.toUpperCase(), (s) => F("Bebas Neue", s), { maxW: cw, maxLines: 3, start: 68, min: 46, lh: 0.98, sp: 1 });
        const ln = tw(d.line, 34, { lines: 3 });
        const vs = tw(`«${d.verse}» —${d.ref}`, 28, { lines: 6 });
        const sg = g.fit(d.signature.toUpperCase(), (s) => F("Bebas Neue", s), { maxW: cw - 120, maxLines: 1, start: 46, min: 30, sp: 1 });
        const fr = ajusta(g, d.from, (s) => F("Special Elite", s), { maxW: cw - 120, maxLines: 2, start: 26, min: 26, lh: 1.3 });
        const yb = bot - (fr.lines.length - 1) * fr.lh, yEnd = yb - fr.size - 60 - 50;
        g.text(sg.lines[0], x0, yb - 44, { font: sg.font, color: th.hand, sp: 1 });
        g.lines(fr.lines, x0, yb, fr.lh, { font: fr.font, color: th.ink });
        logo(x0 + cw, bot - 64, 64);
        const rest = [tb(g, nm, x0, { color: th.ink, gap: 28 }), tb(g, ln, x0, { color: th.ink, gap: 40 }), tb(g, vs, x0, { color: th.ink })];
        rest[1].peso = 1;
        const room = yEnd - top - alto(bs) - (ld ? capDe(g, ld.font) + 34 : 0) - alto(rest) - 30;
        const hd = ajusta(g, main.toUpperCase(), (s) => F("Bebas Neue", s), { maxW: cw, maxLines: 2, start: 230, min: 90, lh: 0.9, maxH: room });
        if (ld) bs.push(manoB(ld, 30));
        // el nombre va pegado al titular; lo que sobra se va antes del versículo
        bs.push(tb(g, hd, x0 - 3, { color: th.ink, gap: 26 }), ...rest);
        bs.forEach((b) => { if (b.peso == null) b.peso = 0; });
        bs[0].peso = 0.8;
        reparte(bs, top, yEnd);
      } else if (d.kind === "ann") {
        const bs = [];
        bs.push(tb(g, tw(d.church.toUpperCase(), 26, { lines: 2, sp: 1 }), x0, { color: th.ink, gap: 50 }));
        bs.push(manoB(mano(d.date ? "¡No falte!" : "Le invitamos", 86), 40));
        if (d.date) {
          const df = g.fit(d.day, (s) => F("Bebas Neue", s), { maxW: cw * 0.5, maxLines: 1, start: 260, min: 120 }), dc = capDe(g, df.font), dw = g.measure(d.day, df.font);
          bs.push(pieza(dc, 36, (y) => {
            g.text(d.day, x0 - 4, y + dc, { font: df.font, color: th.hand });
            const x2 = x0 + dw + 26, w2 = cw - dw - 26;
            const mf = g.fit(d.month.toUpperCase(), (s) => F("Bebas Neue", s), { maxW: w2, maxLines: 1, start: 92, min: 40, sp: 1 });
            g.text(mf.lines[0], x2, y + dc * 0.62, { font: mf.font, color: th.ink, sp: 1 });
            ctx.fillStyle = th.ink; ctx.fillRect(x2, y + dc - 6, Math.min(w2, 120), 6);
          }));
          bs.push(tb(g, tw(cap(d.weekday) + (d.time ? " · " + d.time : ""), 38), x0, { color: th.ink, gap: 44 }));
        }
        const pl = d.place ? tw(d.place, 30, { lines: 3 }) : null;
        const plB = pl ? tb(g, pl, x0, { color: th.ink }) : null;
        const room = bot - 110 - top - alto(bs) - (plB ? plB.h + 40 : 0) - 44;
        const tt = ajusta(g, d.title.toUpperCase(), (s) => F("Bebas Neue", s), { maxW: cw, maxLines: 4, start: d.date ? 170 : 200, min: 62, lh: 0.92, maxH: room });
        const ttB = tb(g, tt, x0 - 3, { color: th.ink, gap: 40 }); ttB.peso = 1;
        bs.push(ttB, plB);
        bs.forEach((b) => { if (b && b.peso == null) b.peso = 0; });
        bs[0].peso = 0.6;
        reparte(bs, top, bot - 110);
        logo(x0, bot - 64, 64, "left");
      } else {
        const bs2 = [];
        if (d.eyebrow) bs2.push(tb(g, tw(d.eyebrow.toUpperCase(), 28, { lines: 2 }), x0, { color: th.ink, gap: 30 }));
        if (d.head) { const hf = g.fit(d.head, (s) => F("Permanent Marker", s), { maxW: cw - 20, maxLines: 2, start: st ? 74 : 64, min: 36, lh: 1.1 }); bs2.push(pieza(capDe(g, hf.font) + (hf.lines.length - 1) * hf.lh, 44, (y) => g.lines(hf.lines, x0 + 4, y + capDe(g, hf.font), hf.lh, { font: hf.font, color: th.hand }))); }
        const rf = g.fit(d.ref, (s) => F("Permanent Marker", s), { maxW: cw, maxLines: 1, start: 52, min: 30 });
        const rfB = pieza(capDe(g, rf.font), 0, (y) => g.text(rf.lines[0], x0 + 4, y + capDe(g, rf.font), { font: rf.font, color: th.hand, rotate: -0.03 }));
        const foot = d.firma ? 80 : 64, free = bot - foot - top - alto(bs2) - rfB.h - 40 - 30;
        const v = ajusta(g, d.text.toUpperCase(), (s) => F("Bebas Neue", s), { maxW: cw, maxLines: 12, start: 170, min: 40, lh: 0.98, sp: 0.5, maxH: free, equil: d.text.length < 90 });
        bs2.push(tb(g, v, x0 - 2, { color: th.ink, gap: 40 }), rfB);
        const hT = alto(bs2), y0 = top + Math.max(0, (bot - foot - top - hT) / 2);
        const ye = apila(bs2, y0);
        if (d.firma) { const ff = tw(d.church.toUpperCase(), 26); g.lines(ff.lines, x0, Math.min(bot - ff.lh * (ff.lines.length - 1), ye + 70), ff.lh, { font: ff.font, color: th.ink }); }
        else logo(x0, bot - 56, 56, "left");
      }
    },
  });

  // ======================================================================================
  // «Estandarte»: la foto a sangre en duotono cálido, y un estandarte de color que cuelga desde arriba con la
  // punta en V, pegado a la orilla izquierda para dejar libre la foto. Sin foto: un templo como grabado.
  // Gesto a mano: un brochazo de pintura. Es la única plantilla que parte «CUMPLE- / AÑOS» (aquí gana tamaño).
  E.add({
    id: "fot-estandarte", name: "Estandarte", family: "foto", fonts: ["Oswald", "Fraunces", "Hanken Grotesk"],
    themes: {
      marino: { name: "Marino y oro", ban: "#0d1b3d", ink: "#f4efe3", acc: "#f2c85b", pd: "#0d1b3d", pl: "#f4e6c4" },
      rojo: { name: "Rojo y negro", ban: "#d23c2c", ink: "#fff6ec", acc: "#151515", pd: "#231210", pl: "#fbe5d2" },
      amarillo: { name: "Amarillo", ban: "#f2c230", ink: "#151515", acc: "#151515", pd: "#1d1a16", pl: "#fbecc0" },
      verde: { name: "Verde y oro", ban: "#1f5b45", ink: "#f4f0e6", acc: "#f2c85b", pd: "#0f2a20", pl: "#f3ead0" },
      rosa: { name: "Rosa y vino", ban: "#f3b3a6", ink: "#3a1220", acc: "#3a1220", pd: "#3a1220", pl: "#fde6de" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, st = esHistoria(g), sq = d.kind === "verse" && g.fmt === "cuadrado", ver = d.kind === "verse";
      const bx = 44, bw = Math.round(W * (ver ? 0.68 : 0.55)), notch = 64, bY = H - (st ? 170 : sq ? 40 : 60), osc = g.lum(th.ban) < 0.5, onA = sobre(g, th.acc);
      // la foto: duotono en las tintas del tema, con el centro de la foto en la parte libre (a la derecha)
      const libre = (bx + bw + W) / 2;
      const hay = foto(g, 0, 0, W, H, { cx: libre, fy: 0.45, duo: [th.pd, th.pl], filter: "grayscale(1) contrast(1.25) brightness(1.04)" });
      if (hay) g.grain(0.08); else { const s = ver ? 320 : 360; templo(g, 0, 0, W, H, { paper: "#ebe7dd", ink: "#1c1c1c", gray: "#cfcac0", s }, Math.min(libre + s * 0.05, W - 40 - s * 0.66) / W); }
      // el estandarte
      const ban = (c) => { c.moveTo(bx, -2); c.lineTo(bx + bw, -2); c.lineTo(bx + bw, bY); c.lineTo(bx + bw / 2, bY - notch); c.lineTo(bx, bY); c.closePath(); };
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 30; ctx.shadowOffsetX = 8; ctx.fillStyle = th.ban; ctx.beginPath(); ban(ctx); ctx.fill(); ctx.restore();
      ctx.save(); ctx.beginPath(); ban(ctx); ctx.clip(); g.paper(th.ban, { fibers: 0.35, grain: 0.07, mottle: 0.6 }); ctx.restore();
      ctx.fillStyle = g.rgba(th.ink, 0.6); [bx + 40, bx + bw - 40].forEach((x) => { ctx.beginPath(); ctx.arc(x, 34, 7, 0, PI2); ctx.fill(); });
      const x0 = bx + 52, tw = bw - 104, top = st ? 250 : sq ? 92 : 112, bot = bY - notch - (st ? 150 : 44);
      const lab = (s, x, y, o = {}) => g.text(String(s).toUpperCase(), x, y, { font: F("Oswald", o.size || 26, 500), color: o.color || th.ink, sp: o.sp ?? 3, align: o.align });
      const labB = (s, gap) => tb(g, g.fit(String(s).toUpperCase(), (z) => F("Oswald", z, 500), { maxW: tw, maxLines: 2, start: 26, min: 26, lh: 1.35, sp: 3 }), x0, { color: th.ink, gap });
      const brocha = (f, x) => { const c = capDe(g, f.font); return { h: c + (f.lines.length - 1) * (f.lh + 18), gap: 0, draw: (y) => f.lines.forEach((l, i) => { const yy = y + c + i * (f.lh + 18), w = g.measure(l, f.font, f.sp || 0) + 50; g.brush(x - 22, yy - c - f.size * 0.2, Math.min(w, tw + 44), c + f.size * 0.42, th.acc, { angle: -0.012 }); g.text(l, x + 3, yy, { font: f.font, color: onA, sp: f.sp }); }) }; };
      marca(g, x0, top - 50, 58, th.ban, th.ink, "left");
      const bs = [];
      if (d.kind === "card") {
        if (d.kicker) lab(d.kicker, x0 + tw, top, { align: "right" });
        const [lead, main] = g.splitHead(d.headline);
        const ld = lead ? g.fit(lead.toLowerCase(), (s) => F("Fraunces", s, 400, true), { maxW: tw, maxLines: 1, start: 80, min: 40 }) : null;
        const nm = g.fit(d.name, (s) => F("Oswald", s, 700), { maxW: tw - 20, maxLines: 2, start: 52, min: 30, lh: 1.1 });
        const ln = g.fit(d.line, (s) => F("Fraunces", s, 400, true), { maxW: tw, maxLines: 2, start: 34, min: 28, lh: 1.25 });
        const vs = g.fit(`«${d.verse}» ${d.ref}`, (s) => F("Hanken Grotesk", s, 400), { maxW: tw, maxLines: 5, start: 28, min: 26, lh: 1.4 });
        const sg = g.fit(`${d.signature}, ${d.from}`, (s) => F("Hanken Grotesk", s, 600), { maxW: tw, maxLines: 2, start: 28, min: 26, lh: 1.35 });
        const nmB = brocha(nm, x0); nmB.gap = 40;
        const rest = [nmB, tb(g, ln, x0, { color: th.ink, gap: 40 }), tb(g, vs, x0, { color: th.ink, gap: 40 }), tb(g, sg, x0, { color: th.ink })];
        const free = bot - (top + 60) - alto(rest) - (ld ? capDe(g, ld.font) + 26 : 0) - 160;
        const hd = titular(g, main.replace(/[¡!]/g, "").toUpperCase(), (s) => F("Oswald", s, 700), { maxW: tw, maxLines: 3, start: 220, min: 64, lh: 1.0, maxH: Math.min(free, (bot - top) * 0.36) });
        if (ld) bs.push(tb(g, ld, x0, { color: th.ink, gap: 24 }));
        bs.push(tb(g, hd, x0 - 3, { color: th.ink, gap: 50 }), ...rest);
        // el titular arriba (≈30 % del estandarte) y el resto repartido hasta abajo
        bs.forEach((b, i) => { b.peso = i === bs.length - 2 ? 1.6 : 1; });
        if (ld) bs[0].peso = 0;
        reparte(bs, top + 80, bot);
      } else if (d.kind === "ann") {
        if (d.date) lab(d.weekday, x0 + tw, top, { align: "right" });
        const ld = g.fit("le invitamos", (s) => F("Fraunces", s, 400, true), { maxW: tw, maxLines: 1, start: 72, min: 36 });
        bs.push(tb(g, ld, x0, { color: th.ink, gap: 26 }));
        let dateB = null;
        if (d.date) {
          const df = F("Oswald", 180, 700), dc = capDe(g, df), dw = g.measure(d.day, df);
          dateB = pieza(dc, 40, (y) => {
            g.text(d.day, x0 - 4, y + dc, { font: df, color: th.ink });
            const x2 = x0 + dw + 26, w2 = tw - dw - 26;
            const mf = g.fit(d.month.toUpperCase(), (s) => F("Oswald", s, 700), { maxW: w2, maxLines: 1, start: 54, min: 26, sp: 2 });
            g.text(mf.lines[0], x2, y + dc * 0.45, { font: mf.font, color: th.ink, sp: mf.sp });
            if (d.time) g.text(d.time, x2, y + dc, { font: F("Fraunces", 40, 400, true), color: th.ink });
          });
        }
        const pl = d.place ? g.fit(d.place, (s) => F("Hanken Grotesk", s, 600), { maxW: tw, maxLines: 3, start: 30, min: 26, lh: 1.3 }) : null;
        const plB = pl ? tb(g, pl, x0, { color: th.ink, gap: 44 }) : null;
        const es = brocha(g.fit("¡LE ESPERAMOS!", (s) => F("Oswald", s, 700), { maxW: tw - 40, maxLines: 1, start: 42, min: 26, sp: 2 }), x0); es.gap = 44;
        const chB = labB(d.church, 0);
        const free = bot - (top + 80) - alto(bs) - (dateB ? dateB.h + 40 : 0) - (plB ? plB.h + 44 : 0) - es.h - chB.h - 50 - 44 - 120;
        const tt = ajusta(g, d.title.toUpperCase(), (s) => F("Oswald", s, 700), { maxW: tw, maxLines: 4, start: d.date ? 150 : 150, min: 54, lh: 1.0, maxH: Math.min(free, (bot - top) * 0.45) });
        bs.push(tb(g, tt, x0 - 3, { color: th.ink, gap: 50 }), dateB, plB, es, chB);
        const fb = bs.filter(Boolean); fb.forEach((b, i) => { b.peso = i === 0 ? 0 : i === 1 ? 1.4 : 1; });
        reparte(fb, top + 80, bot);
      } else {
        if (d.eyebrow) lab(d.eyebrow, x0 + tw, top, { align: "right" });
        if (d.head) bs.push(tb(g, g.fit(d.head, (s) => F("Fraunces", s, 400, true), { maxW: tw, maxLines: 2, start: st ? 78 : 64, min: 36, lh: 1.05 }), x0, { color: th.ink, gap: 48 }));
        const rf = brocha(g.fit(d.ref.toUpperCase(), (s) => F("Oswald", s, 700), { maxW: tw - 40, maxLines: 1, start: 44, min: 26, sp: 2 }), x0);
        const foot = d.firma ? 90 : 0, free = bot - foot - (top + 50) - alto(bs) - rf.h - 50 - 30;
        const v = ajusta(g, d.text, (s) => F("Fraunces", s, 400), { maxW: tw, maxLines: 14, start: 104, min: 30, lh: 1.18, maxH: free, minChars: d.text.length > 90 ? 16 : 0, equil: false });
        bs.push(tb(g, v, x0 - 2, { color: th.ink, gap: 50 }), rf);
        const hT = alto(bs), y0 = top + 50 + Math.max(0, (bot - foot - top - 50 - hT) / 2);
        const ye = apila(bs, y0);
        if (d.firma) { const ff = g.fit(d.church.toUpperCase(), (s) => F("Oswald", s, 500), { maxW: tw, maxLines: 2, start: 26, min: 26, lh: 1.35, sp: 3 }); g.lines(ff.lines, x0, Math.min(bot - (ff.lines.length - 1) * ff.lh, ye + 80), ff.lh, { font: ff.font, sp: ff.sp, color: th.ink }); }
      }
    },
  });
})();
