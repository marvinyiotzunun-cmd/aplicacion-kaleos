/* Kaleos Estudio: plantillas de diseño hechas a mano (tipografía expresiva, papel, tinta y foto),
   al estilo de los afiches de una agencia y no de una imagen generada.
   Cada plantilla dibuja los tres tipos de pieza: tarjeta (felicitación), aviso (evento) y versículo.

   Cómo se agrega una plantilla (en docs/js/estudio/<familia>.js):
     K.EST.add({ id, name, family, fonts: ["Anton", ...], themes: { clave: { name, ...colores } }, draw(g) { ... } })
   draw(g) recibe g = { ctx, W, H, R, th, d, kind, fmt, photo, ...ayudantes } (ver «ayudantes» abajo).
   El id guardado es «e:<plantilla>:<tema>» (tarjetas) o { e, t } en avisos y versículos. */
(function () {
  "use strict";
  const K = (window.K = window.K || {});

  // ===== tipografías propias (carpeta docs/fonts, licencia OFL) =====
  const FONT_FILES = {
    "Anton": [["400", "normal", "Anton-400"]],
    "Bebas Neue": [["400", "normal", "BebasNeue-400"]],
    "Archivo Black": [["400", "normal", "ArchivoBlack-400"]],
    "Oswald": [["500", "normal", "Oswald-500"], ["700", "normal", "Oswald-700"]],
    "Montserrat": [["500", "normal", "Montserrat-500"], ["700", "normal", "Montserrat-700"], ["800", "normal", "Montserrat-800"], ["700", "italic", "Montserrat-700i"]],
    "Work Sans": [["400", "normal", "WorkSans-400"], ["600", "normal", "WorkSans-600"]],
    "DM Serif Display": [["400", "normal", "DMSerifDisplay-400"], ["400", "italic", "DMSerifDisplay-400i"]],
    "Playfair Display": [["500", "normal", "PlayfairDisplay-500"], ["700", "normal", "PlayfairDisplay-700"], ["900", "normal", "PlayfairDisplay-900"], ["500", "italic", "PlayfairDisplay-500i"], ["700", "italic", "PlayfairDisplay-700i"]],
    "Fraunces": [["400", "normal", "Fraunces-400"], ["700", "normal", "Fraunces-700"], ["900", "normal", "Fraunces-900"], ["400", "italic", "Fraunces-400i"]],
    "Abril Fatface": [["400", "normal", "AbrilFatface-400"]],
    "Great Vibes": [["400", "normal", "GreatVibes-400"]],
    "Pacifico": [["400", "normal", "Pacifico-400"]],
    "Allura": [["400", "normal", "Allura-400"]],
    "Caveat": [["500", "normal", "Caveat-500"], ["700", "normal", "Caveat-700"]],
    "Kaushan Script": [["400", "normal", "KaushanScript-400"]],
    "Yellowtail": [["400", "normal", "Yellowtail-400"]],
    "Special Elite": [["400", "normal", "SpecialElite-400"]],
    "Alfa Slab One": [["400", "normal", "AlfaSlabOne-400"]],
    "Shrikhand": [["400", "normal", "Shrikhand-400"]],
    "Permanent Marker": [["400", "normal", "PermanentMarker-400"]],
    "Cormorant Garamond": [["500", "normal", "CormorantGaramond-500"], ["600", "normal", "CormorantGaramond-600"], ["700", "normal", "CormorantGaramond-700"], ["500", "italic", "CormorantGaramond-500i"], ["600", "italic", "CormorantGaramond-600i"]],
    "Hanken Grotesk": [["400", "normal", "HankenGrotesk-400"], ["600", "normal", "HankenGrotesk-600"], ["700", "normal", "HankenGrotesk-700"], ["800", "normal", "HankenGrotesk-800"]],
  };
  const FALLBACK = { "Anton": "Impact, sans-serif", "Bebas Neue": "Impact, sans-serif", "Archivo Black": "Arial Black, sans-serif", "Oswald": "Arial Narrow, sans-serif",
    "Great Vibes": "cursive", "Pacifico": "cursive", "Allura": "cursive", "Caveat": "cursive", "Kaushan Script": "cursive", "Yellowtail": "cursive", "Permanent Marker": "cursive",
    "Special Elite": "monospace" };
  const base = (() => { try { const s = document.currentScript && document.currentScript.src; return s ? new URL("../fonts/", s).href : "./fonts/"; } catch (_) { return "./fonts/"; } })();
  const loaded = {}, loading = {};
  function loadFont(fam) {
    if (loaded[fam]) return Promise.resolve();
    if (loading[fam]) return loading[fam];
    const files = FONT_FILES[fam];
    if (!files || typeof FontFace === "undefined") { loaded[fam] = true; return Promise.resolve(); }
    loading[fam] = Promise.all(files.map(([weight, style, f]) => new FontFace(fam, `url(${base}${f}.woff2) format("woff2")`, { weight, style })
      .load().then((ff) => document.fonts.add(ff)).catch(() => {}))).then(() => { loaded[fam] = true; });
    return loading[fam];
  }
  const fontsOf = (t) => [...new Set([...(t.fonts || []), "Hanken Grotesk"])];
  const fontsReady = (t) => fontsOf(t).every((f) => loaded[f]);

  // ===== utilidades =====
  function rng(seed) { let a = (seed * 9301 + 49297) >>> 0 || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const hashStr = (s) => { let h = 2166136261; for (const ch of String(s || "k")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const hex = (h) => { h = String(h || "#000").replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0); };
  const rgba = (h, a = 1) => `rgba(${hex(h).join(",")},${a})`;
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
  const lum = (h) => { const [r, g, b] = hex(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  // texturas compartidas (se hacen una vez)
  let GRAIN = null, FIBER = null;
  function grainTile() {
    if (GRAIN) return GRAIN;
    GRAIN = document.createElement("canvas"); GRAIN.width = GRAIN.height = 256;
    const x = GRAIN.getContext("2d"), d = x.createImageData(256, 256), R = rng(7);
    for (let i = 0; i < d.data.length; i += 4) { const v = R() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0); return GRAIN;
  }
  function fiberTile() {
    if (FIBER) return FIBER;
    FIBER = document.createElement("canvas"); FIBER.width = FIBER.height = 512;
    const x = FIBER.getContext("2d"), R = rng(23);
    x.lineCap = "round";
    for (let i = 0; i < 900; i++) {
      const px = R() * 512, py = R() * 512, a = R() * Math.PI * 2, l = 4 + R() * 22;
      x.strokeStyle = R() < 0.5 ? `rgba(0,0,0,${0.05 + R() * 0.08})` : `rgba(255,255,255,${0.06 + R() * 0.1})`;
      x.lineWidth = 0.4 + R() * 0.9; x.beginPath(); x.moveTo(px, py);
      x.quadraticCurveTo(px + Math.cos(a + 0.6) * l * 0.5, py + Math.sin(a + 0.6) * l * 0.5, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
    }
    for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(0,0,0,${0.04 + R() * 0.1})`; x.beginPath(); x.arc(R() * 512, R() * 512, 0.4 + R() * 1.4, 0, Math.PI * 2); x.fill(); }
    return FIBER;
  }

  // ===== ayudantes que recibe cada plantilla =====
  function helpers(ctx, W, H, R) {
    const g = {};
    const ls = (v) => { if ("letterSpacing" in ctx) ctx.letterSpacing = (v || 0) + "px"; };
    // fuente: g.F("Anton", 120) · g.F("Playfair Display", 90, 700, true)
    g.F = (fam, size, weight = 400, italic = false) => `${italic ? "italic " : ""}${weight} ${Math.round(size)}px "${fam}", ${FALLBACK[fam] || "serif"}`;
    // ancho de un texto con espaciado entre letras
    g.measure = (s, font, sp = 0) => { ctx.font = font; ls(0); return ctx.measureText(String(s)).width + sp * Math.max(0, [...String(s)].length - 1); };
    // parte el texto en líneas que caben en maxW
    g.wrap = (s, font, maxW, sp = 0) => {
      const words = String(s || "").split(/\s+/).filter(Boolean), out = []; let l = "";
      for (const w of words) { const t = l ? l + " " + w : w; if (g.measure(t, font, sp) > maxW && l) { out.push(l); l = w; } else l = t; }
      if (l) out.push(l); return out;
    };
    // busca el tamaño más grande con el que el texto cabe: devuelve { size, lines, lh, h, font }
    g.fit = (s, fontFn, o = {}) => {
      const { maxW = W * 0.8, maxH = H, maxLines = 6, start = 120, min = 24, lh = 1.1, sp = 0, step = 2 } = o;
      for (let size = start; size >= min; size -= step) {
        const font = fontFn(size), spx = typeof sp === "function" ? sp(size) : sp, lines = g.wrap(s, font, maxW, spx);
        if (lines.length <= maxLines && lines.length * size * lh <= maxH && lines.every((l) => g.measure(l, font, spx) <= maxW)) return { size, lines, lh: size * lh, h: lines.length * size * lh, font, sp: spx };
      }
      const font = fontFn(min), spx = typeof sp === "function" ? sp(min) : sp;
      let lines = g.wrap(s, font, maxW, spx);
      if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/[\s,;:.]*$/, "") + "…"; }
      return { size: min, lines, lh: min * lh, h: lines.length * min * lh, font, sp: spx };
    };
    // escribe un texto: o = { font, color, align, sp, alpha, stroke, strokeW, shadow, rotate, baseline }
    g.text = (s, x, y, o = {}) => {
      s = String(s ?? ""); if (!s) return 0;
      ctx.save();
      ctx.font = o.font || g.F("Hanken Grotesk", 30, 600);
      ctx.textBaseline = o.baseline || "alphabetic"; ctx.globalAlpha = o.alpha ?? 1;
      if (o.shadow) { ctx.shadowColor = o.shadow.color || "rgba(0,0,0,.35)"; ctx.shadowBlur = o.shadow.blur ?? 20; ctx.shadowOffsetX = o.shadow.x || 0; ctx.shadowOffsetY = o.shadow.y || 0; }
      const sp = o.sp || 0, w = g.measure(s, ctx.font, sp), align = o.align || "left";
      let x0 = align === "center" ? -w / 2 : align === "right" ? -w : 0;
      ctx.translate(x, y); if (o.rotate) ctx.rotate(o.rotate);
      ctx.textAlign = "left";
      const draw = (fn) => { if (!sp) { fn(s, x0, 0); return; } let cx = x0; ls(0); for (const ch of s) { fn(ch, cx, 0); cx += ctx.measureText(ch).width + sp; } };
      if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.strokeW || 3; ctx.lineJoin = "round"; draw((c, a, b) => ctx.strokeText(c, a, b)); }
      if (o.color !== null) { ctx.fillStyle = o.color || "#000"; draw((c, a, b) => ctx.fillText(c, a, b)); }
      ctx.restore();
      return w;
    };
    // varias líneas: devuelve la y de la última línea
    g.lines = (lines, x, y, lh, o = {}) => { lines.forEach((l, i) => g.text(l, x, y + i * lh, o)); return y + (lines.length - 1) * lh; };
    // fondo de color con grano de papel. o = { fibers: 0..1, vignette: 0..1, grain: 0..1 }
    g.paper = (color, o = {}) => {
      ctx.save(); ctx.fillStyle = color; ctx.fillRect(0, 0, W, H);
      const light = lum(color) > 0.55;
      if (o.mottle !== 0) {
        for (let i = 0; i < 7; i++) {
          const x = R() * W, y = R() * H, r = (0.25 + R() * 0.5) * Math.max(W, H), rg = ctx.createRadialGradient(x, y, 0, x, y, r);
          rg.addColorStop(0, light ? `rgba(120,90,40,${0.035 * (o.mottle ?? 1)})` : `rgba(255,255,255,${0.03 * (o.mottle ?? 1)})`); rg.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
        }
      }
      if ((o.fibers ?? 0.6) > 0) { ctx.globalAlpha = o.fibers ?? 0.6; ctx.fillStyle = ctx.createPattern(fiberTile(), "repeat"); ctx.fillRect(0, 0, W, H); }
      ctx.restore();
      if (o.vignette) g.vignette(o.vignette);
      g.grain(o.grain ?? 0.06);
    };
    // grano de película o papel encima de todo
    g.grain = (amount = 0.06, mode = "overlay") => {
      if (!amount) return;
      ctx.save(); ctx.globalAlpha = amount; ctx.globalCompositeOperation = mode;
      ctx.fillStyle = ctx.createPattern(grainTile(), "repeat"); ctx.fillRect(0, 0, W, H); ctx.restore();
    };
    g.vignette = (amount = 0.4, color = "#000") => {
      ctx.save(); const rg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.62);
      rg.addColorStop(0, rgba(color, 0)); rg.addColorStop(1, rgba(color, amount)); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H); ctx.restore();
    };
    // trazo de pincel seco (para subrayar o poner detrás de un título)
    g.brush = (x, y, w, h, color, o = {}) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(o.angle ?? (R() - 0.5) * 0.04); ctx.fillStyle = color;
      const bristles = o.bristles ?? Math.max(18, Math.round(h / 3));
      for (let i = 0; i < bristles; i++) {
        const t = i / bristles, by = t * h, bh = h / bristles * (1.6 + R() * 1.4), start = R() * w * 0.04, end = w - R() * w * 0.06;
        ctx.globalAlpha = (o.alpha ?? 0.92) * (0.6 + R() * 0.4) * (t < 0.08 || t > 0.92 ? 0.6 : 1);
        ctx.beginPath(); ctx.moveTo(start, by);
        const segs = 10;
        for (let s = 1; s <= segs; s++) ctx.lineTo(start + ((end - start) * s) / segs, by + (R() - 0.5) * bh * 0.6);
        for (let s = segs; s >= 0; s--) ctx.lineTo(start + ((end - start) * s) / segs, by + bh + (R() - 0.5) * bh * 0.6);
        ctx.closePath(); ctx.fill();
        if (R() < 0.35) { ctx.globalAlpha *= 0.5; ctx.fillRect(end, by, R() * w * 0.05, bh * 0.4); }
      }
      ctx.restore();
    };
    // línea a mano alzada (subrayado de marcador)
    g.scribble = (x1, y1, x2, y2, color, width = 8, o = {}) => {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.globalAlpha = o.alpha ?? 1;
      const passes = o.passes || 1;
      for (let p = 0; p < passes; p++) {
        ctx.beginPath(); const n = 14; ctx.moveTo(x1, y1 + (R() - 0.5) * width * 0.4);
        for (let i = 1; i <= n; i++) { const t = i / n; ctx.lineTo(x1 + (x2 - x1) * t + (R() - 0.5) * 2, y1 + (y2 - y1) * t + Math.sin(t * Math.PI) * (o.bow ?? -6) + (R() - 0.5) * width * 0.35); }
        ctx.stroke();
      }
      ctx.restore();
    };
    // círculo o rectángulo dibujado a mano (contorno)
    g.roughRect = (x, y, w, h, color, width = 4, o = {}) => {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.globalAlpha = o.alpha ?? 1;
      const j = o.jitter ?? 5, pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
      for (let p = 0; p < (o.passes || 2); p++) { ctx.beginPath(); pts.forEach(([px, py], i) => { const X = px + (R() - 0.5) * j, Y = py + (R() - 0.5) * j; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke(); }
      ctx.restore();
    };
    g.roughCircle = (cx, cy, rx, ry, color, width = 4, o = {}) => {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.globalAlpha = o.alpha ?? 1;
      for (let p = 0; p < (o.passes || 2); p++) {
        ctx.beginPath(); const a0 = R() * Math.PI * 2, turns = 1.08 + R() * 0.08;
        for (let i = 0; i <= 60; i++) { const a = a0 + (i / 60) * Math.PI * 2 * turns, k = 1 + (R() - 0.5) * 0.03; const X = cx + Math.cos(a) * rx * k, Y = cy + Math.sin(a) * ry * k; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
        ctx.stroke();
      }
      ctx.restore();
    };
    // mancha de acuarela
    g.wash = (cx, cy, r, color, o = {}) => {
      ctx.save(); ctx.globalAlpha = o.alpha ?? 0.5;
      for (let layer = 0; layer < (o.layers || 5); layer++) {
        ctx.beginPath(); const n = 40, rr = r * (0.75 + layer * 0.07);
        for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, k = 1 + (R() - 0.5) * 0.28; const X = cx + Math.cos(a) * rr * k * (o.sx || 1), Y = cy + Math.sin(a) * rr * k * (o.sy || 1); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
        ctx.closePath(); ctx.fillStyle = rgba(color, 0.22); ctx.fill();
        ctx.strokeStyle = rgba(color, 0.18); ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.restore();
    };
    // borde de papel rasgado: rellena desde y hacia abajo (dir=1) o hacia arriba (dir=-1)
    g.torn = (y, color, o = {}) => {
      const dir = o.dir || 1, amp = o.amp ?? 16;
      ctx.save();
      if (o.shadow !== false) { ctx.shadowColor = "rgba(0,0,0,.22)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = dir * -4; }
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, dir > 0 ? H : 0); ctx.lineTo(0, y);
      let x = 0; while (x < W) { x += 6 + R() * 18; ctx.lineTo(Math.min(W, x), y + (R() - 0.5) * amp + Math.sin(x / 90) * amp * 0.4); }
      ctx.lineTo(W, dir > 0 ? H : 0); ctx.closePath(); ctx.fill(); ctx.restore();
      if (o.fibers !== false) { ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = ctx.createPattern(fiberTile(), "repeat"); ctx.fillRect(0, dir > 0 ? y - amp : 0, W, dir > 0 ? H - y + amp : y + amp); ctx.restore(); }
    };
    // trama de puntos (semitono) en un rectángulo, con desvanecido opcional
    g.halftone = (x, y, w, h, color, o = {}) => {
      const step = o.step || 18, ang = o.angle ?? 0.6, fade = o.fade || "none";
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillStyle = color; ctx.globalAlpha = o.alpha ?? 1;
      ctx.translate(x + w / 2, y + h / 2); ctx.rotate(ang);
      const D = Math.hypot(w, h) / 2;
      for (let yy = -D; yy < D; yy += step) for (let xx = -D; xx < D; xx += step) {
        const gx = Math.cos(-ang) * xx - Math.sin(-ang) * yy + w / 2, gy = Math.sin(-ang) * xx + Math.cos(-ang) * yy + h / 2;
        let k = 1; if (fade === "down") k = gy / h; else if (fade === "up") k = 1 - gy / h; else if (fade === "right") k = gx / w; else if (fade === "radial") k = 1 - Math.min(1, Math.hypot(gx - w / 2, gy - h / 2) / (Math.min(w, h) / 2));
        const r = (step / 2) * Math.max(0, Math.min(1, k)) * (o.size ?? 0.9); if (r > 0.4) { ctx.beginPath(); ctx.arc(xx, yy, r, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
    };
    // cinta adhesiva
    g.tape = (cx, cy, w, angle = 0, color = "rgba(245,238,214,.78)") => {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle); ctx.fillStyle = color; ctx.shadowColor = "rgba(0,0,0,.12)"; ctx.shadowBlur = 6;
      const h = w * 0.32; ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2);
      for (let i = 0; i <= 6; i++) ctx.lineTo(-w / 2 + (i % 2 ? 4 : 0), -h / 2 + (h * i) / 6);
      ctx.lineTo(w / 2, h / 2); for (let i = 6; i >= 0; i--) ctx.lineTo(w / 2 - (i % 2 ? 4 : 0), -h / 2 + (h * i) / 6);
      ctx.closePath(); ctx.fill(); ctx.restore();
    };
    // la foto que el pastor eligió, recortada para cubrir el rectángulo. tratamiento: none | bn | duo | calido | suave
    // devuelve false si no hay foto (la plantilla dibuja su alternativa)
    g.photo = (x, y, w, h, o = {}) => {
      const img = g.img; if (!img) return false;
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height; if (!iw || !ih) return false;
      const s = Math.max(w / iw, h / ih), dw = iw * s, dh = ih * s, fx = o.focusX ?? 0.5, fy = o.focusY ?? 0.42;
      ctx.save(); ctx.beginPath(); if (o.path) o.path(ctx); else ctx.rect(x, y, w, h); ctx.clip();
      const tr = o.treat || "none";
      ctx.filter = tr === "bn" || tr === "duo" ? "grayscale(1) contrast(1.12)" : tr === "calido" ? "sepia(.35) saturate(1.1) contrast(1.05)" : tr === "suave" ? "saturate(.8) contrast(.95) brightness(1.04)" : "none";
      if (o.blur) ctx.filter += ` blur(${o.blur}px)`;
      ctx.drawImage(img, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh); ctx.filter = "none";
      if (tr === "duo") {
        ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = o.dark || "#1b2a4a"; ctx.fillRect(x, y, w, h);
        ctx.globalCompositeOperation = "screen"; ctx.fillStyle = o.light ? rgba(o.light, 0.35) : "rgba(242,200,91,.35)"; ctx.fillRect(x, y, w, h);
      }
      if (o.tint) { ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = o.tint; ctx.fillRect(x, y, w, h); }
      ctx.restore(); return true;
    };
    // el logo de la iglesia (color o blanco)
    g.logo = (x, y, h, o = {}) => {
      const img = o.white ? g.assets.markW : g.assets.logo; if (!img || !img.width) return;
      const w = (img.width * h) / img.height, ax = o.align === "left" ? x : o.align === "right" ? x - w : x - w / 2;
      ctx.save(); ctx.globalAlpha = o.alpha ?? 1; ctx.drawImage(img, ax, y, w, h); ctx.restore();
    };
    // rectángulo con esquinas redondeadas (relleno)
    g.round = (x, y, w, h, r, color) => { ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.fill(); ctx.restore(); };
    // «¡Feliz cumpleaños!» → ["¡Feliz", "cumpleaños!"] para jugar con dos tipografías
    g.splitHead = (s) => { const w = String(s || "").trim().split(/\s+/); return w.length < 2 ? ["", w[0] || ""] : [w[0], w.slice(1).join(" ")]; };
    // parte un versículo en dos (antes y después de la primera pausa) para destacar una frase
    g.splitVerse = (s) => { s = String(s || ""); const m = s.match(/^(.{12,90}?[;:,.])\s+(.+)$/); return m ? [m[1], m[2]] : [s, ""]; };
    g.rgba = rgba; g.mix = mix; g.lum = lum;
    return g;
  }

  // ===== datos de cada pieza, ya listos para dibujar =====
  function churchLine() { return `Iglesia de Dios E.C. · ${(K.churchShort && K.churchShort()) || "La Línea"}`; }
  function normalize(kind, src) {
    const d = { kind, church: churchLine(), churchShort: (K.churchShort && K.churchShort()) || "La Línea" };
    if (kind === "card") {
      Object.assign(d, { kicker: src.kicker || "", headline: src.headline || "¡Felicidades!", name: src.name || "", line: src.line || "", verse: src.verse || "", ref: src.ref || "",
        signature: src.signature || "", from: src.from || "", occasion: src.occasion || "cumple" });
    } else if (kind === "ann") {
      const dt = src.event_at ? new Date(src.event_at) : null, part = (o) => (K.dpart ? K.dpart(dt, o) : dt.toLocaleString("es-GT", o));
      Object.assign(d, { title: src.title || "", place: src.place || "", body: src.body || "", eyebrow: src.eyebrow || "",
        date: dt, day: dt ? part({ day: "numeric" }) : "", month: dt ? part({ month: "long" }) : "", weekday: dt ? part({ weekday: "long" }) : "",
        time: dt ? (K.fmtTime ? K.fmtTime(src.event_at) : dt.toLocaleTimeString("es-GT", { hour: "numeric", minute: "2-digit" })) : "" });
      d.when = dt ? `${d.weekday} ${d.day} de ${d.month}` : "";
    } else {
      Object.assign(d, { text: src.text || "", ref: src.ref || "", head: src.head || "", eyebrow: src.eyebrow || "", firma: !!src.firma });
    }
    return d;
  }

  // ===== registro y dibujo =====
  const T = {};
  const EST = (K.EST = {
    T, FONT_FILES, loadFont, rng, hashStr, mix, rgba, lum, MONTHS,
    FAMILIES: { tipografica: "Tipográfica", editorial: "Editorial", manuscrita: "Manuscrita", papel: "Papel y collage", fiesta: "Fiesta", foto: "Con foto", sagrada: "Sagrada" },
    photo: null, // imagen elegida del celular (solo en este aparato; la pasan los editores en o.photo)
    add(t) { if (!t || !t.id || !t.draw || !t.themes) return; if (T[t.id]) console.error("Estudio: plantilla repetida " + t.id); t.family = t.family || "tipografica"; T[t.id] = t; },
    list(kind) { return Object.values(T).filter((t) => !t.kinds || t.kinds.includes(kind)); },
    count(kind) { return EST.list(kind).reduce((a, t) => a + Object.keys(t.themes).length, 0); },
    // «e:plantilla:tema» ⇄ { id, theme }
    is: (s) => /^e:/.test(String(s || "")),
    parse(s) { const [, id, th] = String(s || "").split(":"); const t = T[id] || Object.values(T)[0]; if (!t) return null; return { id: t.id, theme: t.themes[th] ? th : Object.keys(t.themes)[0] }; },
    key: (id, th, foto) => `e:${id}:${th}${foto ? ":" + foto : ""}`,
    fotoOf: (s) => String(s || "").split(":")[3] || "",
    // fotos reales de la iglesia que vienen con la app: { id: { src, name } } (docs/img/fotos)
    FOTOS: {},
    _fimg: {},
    fotoImg(id, after) {
      const f = EST.FOTOS[id]; if (!f) return null;
      const c = EST._fimg[id]; if (c && c.complete && c.naturalWidth) return c;
      if (!c) { const i = (EST._fimg[id] = new Image()); i.decoding = "async"; i.src = f.src; }
      if (after) EST._fimg[id].addEventListener("load", after, { once: true });
      return null;
    },
    random(kind, exclude) {
      const all = EST.list(kind).flatMap((t) => Object.keys(t.themes).map((th) => EST.key(t.id, th)));
      if (!all.length) return null; for (let i = 0; i < 8; i++) { const k = all[Math.floor(Math.random() * all.length)]; if (k !== exclude) return k; } return all[0];
    },
    // carga las letras de todas las plantillas (se llama al entrar)
    ready() { return Promise.all([...new Set(Object.values(T).flatMap(fontsOf))].map(loadFont)); },
    // espera letras y foto de un diseño antes de dibujarlo para guardarlo o compartirlo
    prepare(key) {
      const p = EST.parse(key), t = p && T[p.id], fid = EST.fotoOf(key);
      const foto = fid && EST.FOTOS[fid] ? new Promise((ok) => { const i = EST.fotoImg(fid, ok); if (i) ok(); else { EST._fimg[fid].addEventListener("error", ok, { once: true }); setTimeout(ok, 8000); } }) : null;
      return Promise.all([...(t ? fontsOf(t).map(loadFont) : []), foto]);
    },
    assets: {},
    setAssets(a) { Object.assign(EST.assets, a || {}); },
    // dibuja: kind = card | ann | verse · key = «e:id:tema» · src = datos de la pieza · o = { fmt, seed, photo }
    render(cv, kind, key, src, o = {}) {
      const p = EST.parse(key); if (!p) return false;
      const t = T[p.id], fmt = kind === "verse" ? o.fmt || "cuadrado" : "post";
      const W = 1080, H = kind === "verse" ? (fmt === "historia" ? 1920 : fmt === "post" ? 1350 : 1080) : 1350;
      if (cv.width !== W) cv.width = W; if (cv.height !== H) cv.height = H;
      const ctx = cv.getContext("2d"); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.filter = "none"; ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
      const seed = hashStr((o.seed ?? "") + "|" + key.split(":").slice(0, 3).join(":")), R = rng(seed);
      // la foto: la que pasa el editor (del celular) o la foto de la iglesia guardada en el diseño
      let img = o.photo || null; const fid = EST.fotoOf(key);
      if (!img && fid && o.photo !== null) { const stamp = (cv._estF = (cv._estF || 0) + 1); img = EST.fotoImg(fid, () => { if (cv._estF === stamp) EST.render(cv, kind, key, src, o); }); }
      const g = helpers(ctx, W, H, R);
      Object.assign(g, { ctx, W, H, R, kind, fmt, key, id: p.id, themeKey: p.theme, th: t.themes[p.theme], d: normalize(kind, src || {}), img, assets: EST.assets });
      g.photoOn = !!g.img;
      try { t.draw(g); } catch (e) { console.error("Estudio:", p.id, e); }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = "none"; ctx.globalCompositeOperation = "source-over";
      // si las letras aún no llegaron, vuelve a dibujar cuando lleguen
      if (!fontsReady(t)) { const stamp = (cv._estN = (cv._estN || 0) + 1); Promise.all(fontsOf(t).map(loadFont)).then(() => { if (cv._estN === stamp) EST.render(cv, kind, key, src, o); }); }
      return true;
    },
  });
})();
