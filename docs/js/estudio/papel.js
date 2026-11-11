/* Estudio · familia Papel y collage: kraft, cartulina, papel rasgado en capas, sellos de goma, boletos,
   postales, impresión risográfica a dos tintas y letras de máquina de escribir. Todo debe parecer hecho
   con tijera, goma y una imprenta pequeña: papel con textura, colores planos y un solo gesto protagonista. */
(function () {
  "use strict";
  const E = window.K && window.K.EST; if (!E) return;

  // ===== ayudantes de la familia =====
  const limpio = (s) => String(s || "").replace(/[¡!¿?]/g, "").trim();
  const palabras = (s) => limpio(s).split(/\s+/).filter(Boolean);
  const ultima = (s) => { const w = palabras(s); return w[w.length - 1] || ""; };
  const antes = (s) => { const w = palabras(s); return w.slice(0, -1).join(" "); };
  const cap = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
  // «Sábado 7 de noviembre» → «7 NOV» (para matasellos)
  const diaMes = (s) => { const m = String(s || "").match(/(\d{1,2})\s+de\s+(\p{L}+)/u); return m ? `${m[1]} ${m[2].slice(0, 3).toUpperCase()}` : ""; };
  const altoH = (ctx, font, ch = "H") => { ctx.font = font; return ctx.measureText(ch).actualBoundingBoxAscent; };
  // una palabra clave del versículo para las letras recortadas: primero las de la lista, si no la más larga
  const CLAVES = ["valiente", "fidelidad", "misericordia", "misericordias", "pastor", "esperanza", "amor", "paz", "gracia", "gozo", "luz", "vida",
    "fuerza", "fortaleza", "refugio", "roca", "salvación", "verdad", "camino", "bendiga", "bendición", "fiel", "alegría", "descanso", "victoria", "fe"];
  const NO = new Set(["jehová", "señor", "porque", "nuestro", "vuestro", "contra", "sobre", "entre", "desde", "hasta", "cuando", "donde", "dondequiera", "también", "todos", "todas", "estará", "hemos", "nunca", "sido", "vayas"]);
  function clave(text) {
    const ws = palabras(text).map((w) => w.replace(/[.,;:«»"()]/g, "")).filter(Boolean), low = ws.map((w) => w.toLowerCase());
    for (const k of CLAVES) { const i = low.indexOf(k); if (i >= 0) return ws[i].toUpperCase(); }
    let best = ""; ws.forEach((w, i) => { const l = low[i]; if (l.length >= 4 && l.length <= 11 && !NO.has(l) && l.length > best.length) best = w; });
    return (best || "Amén").toUpperCase();
  }
  // foto en duotono de un color: las sombras en «deep» y las luces en «color» (la hoja sigue siendo de su color)
  function duoFoto(g, x, y, w, h, deep, color, o = {}) {
    const { ctx } = g; ctx.save(); ctx.beginPath(); if (o.path) o.path(ctx); else ctx.rect(x, y, w, h); ctx.clip();
    if (!g.photo(x, y, w, h, { treat: "bn", focusY: o.focusY ?? 0.5, focusX: o.focusX })) { ctx.restore(); return false; }
    ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = "screen"; ctx.fillStyle = deep; ctx.fillRect(x, y, w, h);
    ctx.restore(); return true;
  }
  // foto a una tinta clara, como en la risografía: las sombras en la tinta y las luces en el papel
  function tintaFoto(g, x, y, w, h, ink, paper, o = {}) {
    const { ctx } = g; ctx.save(); ctx.beginPath(); if (o.path) o.path(ctx); else ctx.rect(x, y, w, h); ctx.clip();
    if (!g.photo(x, y, w, h, { treat: "bn", focusY: o.focusY ?? 0.5 })) { ctx.restore(); return false; }
    ctx.globalCompositeOperation = "lighten"; ctx.fillStyle = ink; ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = paper; ctx.fillRect(x, y, w, h);
    ctx.restore(); return true;
  }
  // ¿cupo todo el texto en g.fit? (si no, fit corta con «…»)
  const cupo = (f, s) => !(f.lines.length && /…$/.test(f.lines[f.lines.length - 1]) && !/…$/.test(String(s)));
  // número de serie fijo para cada pieza (boletos y talones)
  const serie = (g) => String(1000 + Math.floor(g.R() * 8999)).padStart(4, "0");

  // Una hoja de papel (rectángulo girado) con bordes rasgados en los lados que digas (torn: "tblr").
  // El rasgado deja ver el alma blanca del papel. o = { rot, torn, amp, edge, shadow, photo(x,y,w,h), inside() }
  // inside() dibuja en coordenadas de la hoja: (0,0) es su esquina de arriba a la izquierda.
  function hoja(g, x, y, w, h, color, o = {}) {
    const { ctx, R } = g, rot = o.rot || 0, torn = o.torn || "", amp = o.amp ?? 9, hw = w / 2, hh = h / 2, pts = [];
    const lado = (x1, y1, x2, y2, rough) => {
      const L = Math.hypot(x2 - x1, y2 - y1), n = rough ? Math.max(2, Math.round(L / 11)) : 1, nx = (y2 - y1) / L, ny = -(x2 - x1) / L;
      for (let i = 0; i < n; i++) {
        const t = i / n, r = rough && i > 0;
        pts.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, nx, ny, r, k: r ? (R() - 0.5) * amp + Math.sin(t * 9 + R()) * amp * 0.25 : 0, e: r ? 1.5 + R() * amp * 0.45 : 0 });
      }
    };
    lado(-hw, -hh, hw, -hh, torn.includes("t")); lado(hw, -hh, hw, hh, torn.includes("r"));
    lado(hw, hh, -hw, hh, torn.includes("b")); lado(-hw, hh, -hw, -hh, torn.includes("l"));
    const path = (extra) => { ctx.beginPath(); pts.forEach((p, i) => { const k = p.k + (extra ? p.e : 0), X = p.x + p.nx * k, Y = p.y + p.ny * k; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.closePath(); };
    ctx.save(); ctx.translate(x + hw, y + hh); ctx.rotate(rot);
    ctx.save();
    if (o.shadow !== false) { ctx.shadowColor = "rgba(0,0,0,.26)"; ctx.shadowBlur = o.blur ?? 14; ctx.shadowOffsetY = o.sy ?? 5; }
    ctx.fillStyle = torn ? (o.edge || "#fbf8f0") : color; path(true); ctx.fill(); ctx.restore();
    ctx.fillStyle = color; path(false); ctx.fill();
    ctx.save(); path(false); ctx.clip();
    if (o.photo) o.photo(-hw, -hh, w, h);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); g.grain(o.grain ?? 0.07); ctx.restore();
    ctx.restore();
    if (o.inside) { ctx.save(); ctx.translate(-hw, -hh); o.inside(); ctx.restore(); }
    ctx.restore();
  }

  // ======================================================================================
  // «Collage rasgado»: una hoja de color rasgada arriba, una tira de papel blanco con el nombre
  // y un recorte de otro color asomando detrás. Letra de máquina para lo pequeño.
  E.add({
    id: "pap-collage", name: "Collage rasgado", family: "papel", fonts: ["Anton", "Special Elite", "DM Serif Display"],
    themes: {
      kraft: { name: "Kraft y bermellón", bg: "#c4a074", a: "#d4432b", b: "#22305a", paper: "#f7f2e6", ink: "#1c1915" },
      marino: { name: "Marino y oro", bg: "#0d1b3d", a: "#2d5fa8", b: "#f2c85b", paper: "#f6f0e2", ink: "#0d1b3d" },
      salvia: { name: "Salvia y mostaza", bg: "#d8d0bd", a: "#2f5e4a", b: "#e3a72f", paper: "#fbf8f0", ink: "#1b211d" },
      rosa: { name: "Rosa y tinta", bg: "#eebfb0", a: "#263a6e", b: "#e85a3a", paper: "#fffaf3", ink: "#1b1c2a" },
      noche: { name: "Noche y lima", bg: "#232220", a: "#d3dd55", b: "#7f9cc4", paper: "#f1ede4", ink: "#161616", lead: "#161616" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 84;
      const story = d.kind === "verse" && g.fmt === "historia";
      g.paper(th.bg, { fibers: 0.9, grain: 0.08, mottle: 1.2 });
      const ph = g.photoOn, aLight = g.lum(th.a) > 0.55, onA = aLight ? th.ink : ph ? "#ffffff" : th.paper;
      const leadC = ph ? onA : th.lead || th.b, onBg = g.lum(th.bg) > 0.5 ? th.ink : th.paper, onB = g.lum(th.b) > 0.55 ? th.ink : th.paper;
      const typed = (s, x, y, size, o = {}) => g.text(s, x, y, { font: F("Special Elite", size), color: o.color || onBg, align: o.align, sp: o.sp || 0, alpha: o.alpha ?? 1 });
      // la hoja de color de arriba (con foto: la foto en duotono dentro de la hoja)
      const hojaA = (h) => hoja(g, -60, -60, W + 120, h + 60, th.a, { rot: -0.02, torn: "b", amp: 16, blur: 20,
        photo: ph ? (x, y, w, hh) => duoFoto(g, x, y, w, hh, g.mix(th.a, "#000000", aLight ? 0.3 : 0.62), th.a) : null });
      // el logo: en fondos oscuros va en un papelito claro (el logo blanco es solo la cruz)
      const logoC = (x, yb, h) => {
        if (g.lum(th.bg) >= 0.5) { g.logo(x, yb - h, h, { align: "left" }); return; }
        const lw = (g.assets.logo && g.assets.logo.width ? g.assets.logo.width / g.assets.logo.height : 2.3) * h;
        hoja(g, x - 20, yb - h - 16, lw + 40, h + 32, th.paper, { rot: -0.03, torn: "lr", amp: 6, blur: 8, inside: () => g.logo(20, 16, h, { align: "left" }) });
      };
      // tira de papel blanco con texto Anton (líneas ya ajustadas)
      const tira = (f, x, y, o = {}) => {
        const tw = Math.max(...f.lines.map((l) => g.measure(l, f.font))) + 96, h = f.h + 64;
        hoja(g, x, y, tw, h, th.paper, { rot: o.rot ?? 0.014, torn: "lr", amp: 12, inside: () => g.lines(f.lines, 48, 32 + f.size * 0.86, f.lh, { font: f.font, color: th.ink }) });
        return { w: tw, h };
      };
      const recorte = (x, y, w, h, rot) => hoja(g, x, y, w, h, th.b, { rot, torn: "tblr", amp: 10 });
      if (d.kind === "card") {
        const [l0, main] = g.splitHead(d.headline);
        const big = g.fit(main.toUpperCase(), (s) => F("Anton", s), { maxW: W - 2 * M, maxLines: 2, start: 230, min: 96, lh: 0.94 });
        const leadH = l0 ? 96 : 0, aH = 168 + leadH + big.size * 0.86 + (big.lines.length - 1) * big.lh + 72;
        hojaA(aH);
        g.text(d.church.toUpperCase(), M, 112, { font: F("Special Elite", 23), color: onA, sp: 2 });
        if (d.kicker) g.text(d.kicker, W - M, 112, { font: F("Special Elite", 26), color: onA, align: "right" });
        let y = 168;
        if (l0) { g.text(l0, M, y + 70, { font: F("DM Serif Display", 104, 400, true), color: leadC }); y += leadH; }
        g.lines(big.lines, M - 4, y + big.size * 0.86, big.lh, { font: big.font, color: onA });
        // nombre en una tira, con un recorte de color asomando detrás
        const nm = g.fit(d.name, (s) => F("Anton", s), { maxW: W - 2 * M - 70, maxLines: 2, start: 96, min: 50, lh: 1.02 });
        const ny = aH - 34, nw = Math.max(...nm.lines.map((l) => g.measure(l, nm.font))) + 96;
        recorte(Math.min(M - 40 + nw - 110, W - 250), ny + 8, 230, nm.h + 120, 0.1);
        const t = tira(nm, M - 44, ny);
        y = ny + t.h + 90;
        const ln = g.fit(d.line, (s) => F("Special Elite", s), { maxW: W - 2 * M, maxLines: 2, start: 44, min: 34, lh: 1.25 });
        // el versículo solo si cabe a buen tamaño (con nombres de dos líneas se queda fuera)
        const vRoom = H - 260 - y - ln.h - 60;
        let vs = nm.lines.length < 2 && d.verse ? g.fit(`«${d.verse}»`, (s) => F("Special Elite", s), { maxW: W - 2 * M, maxLines: 3, start: 38, min: 34, lh: 1.3, maxH: vRoom }) : null;
        if (vs && (!cupo(vs, d.verse) || vs.h + 50 > vRoom)) vs = null;
        y += Math.max(0, vRoom - (vs ? vs.h + 50 : 0)) * 0.35;
        y = g.lines(ln.lines, M, y, ln.lh, { font: ln.font, color: onBg }) + 60;
        if (vs) { const vy = g.lines(vs.lines, M, y, vs.lh, { font: vs.font, color: onBg, alpha: 0.9 }); typed(`— ${d.ref}`, M, vy + 46, 28, { alpha: 0.9 }); }
        g.text(d.signature, W - M, H - 128, { font: F("DM Serif Display", 54, 400, true), color: onBg, align: "right" });
        typed(d.from, W - M, H - 84, 24, { align: "right", alpha: 0.85 });
        logoC(M, H - 84, 74);
      } else if (d.kind === "ann") {
        let aH;
        if (d.date) {
          const df = F("Anton", 330), dw = g.measure(d.day, df);
          aH = 168 + 330 * 0.88 + 64;
          hojaA(aH);
          g.text(d.day, M - 8, 168 + 330 * 0.88, { font: df, color: onA });
          const x2 = M + dw + 44, mw = W - M - x2;
          g.text(d.weekday.toUpperCase(), x2, 240, { font: F("Special Elite", 32), color: onA, sp: 3 });
          const mf = g.fit(d.month, (s) => F("DM Serif Display", s, 400, true), { maxW: mw, maxLines: 1, start: 120, min: 50 });
          g.text(d.month, x2, 350, { font: mf.font, color: leadC });
          g.text(d.time, x2, 168 + 330 * 0.88, { font: F("Special Elite", 44), color: onA });
        } else {
          const lf = g.fit("¡Le invitamos!", (s) => F("DM Serif Display", s, 400, true), { maxW: W - 2 * M, maxLines: 1, start: 150, min: 70 });
          aH = 168 + lf.size + 70;
          hojaA(aH);
          g.text("¡Le invitamos!", M, 168 + lf.size * 0.82, { font: lf.font, color: leadC });
        }
        g.text(d.church.toUpperCase(), M, 112, { font: F("Special Elite", 23), color: onA, sp: 2 });
        if (d.date) g.text("Le invitamos", W - M, 112, { font: F("Special Elite", 26), color: onA, align: "right" });
        const pl = d.place ? g.fit(d.place, (s) => F("Special Elite", s), { maxW: W - 2 * M - 60, maxLines: 2, start: 36, min: 24, lh: 1.3 }) : null;
        const foot = H - 210, room = foot - aH - 60 - 64 - (pl ? pl.h + 90 : 0);
        const tt = g.fit(d.title.toUpperCase(), (s) => F("Anton", s), { maxW: W - 2 * M - 40, maxLines: 4, start: d.date ? 160 : 180, min: 60, lh: 0.98, maxH: room });
        const extra = Math.max(0, room - tt.h);
        const ty = aH - 30 + extra * 0.3, t = tira(tt, M - 44, ty, { rot: 0.012 });
        if (pl) {
          let y = ty + t.h + 80 + extra * 0.25;
          ctx.fillStyle = th.b; ctx.beginPath(); ctx.arc(M + 12, y - pl.size * 0.32, 12, 0, Math.PI * 2); ctx.fill();
          g.lines(pl.lines, M + 44, y, pl.lh, { font: pl.font, color: onBg });
        }
        // «¡Le esperamos!» en un recorte de color abajo a la derecha
        const ef = F("DM Serif Display", 58, 400, true), ew = g.measure("¡Le esperamos!", ef) + 80;
        hoja(g, W - M - ew + 30, H - 190, ew, 112, th.b, { rot: -0.03, torn: "tblr", amp: 9, inside: () => g.text("¡Le esperamos!", 40, 74, { font: ef, color: onB }) });
        logoC(M, H - 84, 72);
      } else {
        const top = story ? 250 : 100, bot = H - (story ? 250 : 84);
        const hd = d.head || "Palabra para hoy";
        const hf = g.fit(hd, (s) => F("DM Serif Display", s, 400, true), { maxW: W - 2 * M, maxLines: 2, start: story ? 120 : 104, min: 56, lh: 1.04 });
        const aH = top + 50 + hf.h + 46;
        hojaA(aH);
        g.text((d.eyebrow || d.church).toUpperCase(), M, top, { font: F("Special Elite", 24), color: onA, sp: 2 });
        g.lines(hf.lines, M, top + 50 + hf.size * 0.8, hf.lh, { font: hf.font, color: d.head ? onA : leadC });
        // el versículo en una hoja blanca rasgada arriba y abajo
        const refF = F("Special Elite", 34), refH = 110, a0 = aH + 10, a1 = bot - refH - (d.firma && !story ? 50 : 0);
        const v = g.fit(d.text, (s) => F("DM Serif Display", s), { maxW: W - 2 * M - 40, maxLines: 14, start: story ? 124 : g.fmt === "cuadrado" ? 110 : 96, min: 32, lh: 1.16, maxH: a1 - a0 - 150 });
        // en historia la hoja se estira hasta el pie y el texto va centrado en ella
        const sh = story ? Math.max(v.h + 120, a1 - a0 - 30) : v.h + 120, extra = Math.max(0, a1 - a0 - sh), sy = a0 + extra * 0.35, pad = (sh - v.h) / 2;
        hoja(g, M - 50, sy, W - 2 * M + 100, sh, th.paper, { rot: 0.01, torn: "tb", amp: 14, inside: () => g.lines(v.lines, 50, pad + v.size * 0.82, v.lh, { font: v.font, color: th.ink }) });
        const rw = g.measure(d.ref, refF) + 80;
        hoja(g, W - M - rw + 20, sy + sh + 10, rw, 84, th.b, { rot: -0.035, torn: "tblr", amp: 8, inside: () => g.text(d.ref, 40, 55, { font: refF, color: onB }) });
        // en historia el pie lo ancla el logo en su papelito
        if (story) { logoC(M, H - 110, 72); if (d.firma) typed(d.church, W - M, H - 136, 24, { align: "right", alpha: 0.9 }); }
        else if (d.firma) typed(d.church, M, bot, 22, { alpha: 0.9 });
      }
    },
  });

  // ======================================================================================
  // «Postal»: el reverso de una tarjeta postal con borde de correo aéreo, un sello dentado con los
  // volcanes de Xela y un matasellos con ondas encima. Mensaje a máquina y destinatario a mano.
  E.add({
    id: "pap-postal", name: "Postal", family: "papel", fonts: ["Abril Fatface", "Special Elite", "Caveat", "Oswald"],
    themes: {
      crema: { name: "Correo aéreo", bg: "#f2e8d2", ink: "#2a2320", a: "#c8402e", b: "#2d5fa8", pm: "#2a2320" },
      marino: { name: "Marino y oro", bg: "#f4eedf", ink: "#0d1b3d", a: "#2d5fa8", b: "#f2c85b", pm: "#0d1b3d" },
      pino: { name: "Pino y miel", bg: "#e8e5d3", ink: "#1f2e27", a: "#3d7556", b: "#d99d36", pm: "#1f2e27" },
      lavanda: { name: "Lavanda", bg: "#e9e3ef", ink: "#2a2440", a: "#6d55a3", b: "#e0866a", pm: "#2a2440" },
      noche: { name: "Cartulina negra", bg: "#23252b", ink: "#efe8da", a: "#d9ae4a", b: "#c4553b", pm: "#efe8da" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 86, ph = g.photoOn;
      const story = d.kind === "verse" && g.fmt === "historia", square = d.kind === "verse" && g.fmt === "cuadrado";
      g.paper(th.bg, { fibers: 0.55, grain: 0.07, mottle: ph ? 0 : 0.6 });
      const dark = g.lum(th.bg) < 0.5, soft = g.rgba(th.ink, 0.5), onA = g.lum(th.a) > 0.55 ? "#1d1a17" : "#ffffff";
      // borde de correo aéreo (franjas en diagonal)
      ctx.save(); ctx.beginPath(); ctx.rect(22, 22, W - 44, H - 44); ctx.rect(40, 40, W - 80, H - 80); ctx.clip("evenodd");
      for (let i = 0, x = -H; x < W + H; i++, x += 34) { ctx.fillStyle = i % 2 ? th.b : th.a; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 20, 0); ctx.lineTo(x + 20 + H, H); ctx.lineTo(x + H, H); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      const typed = (s, x, y, size, o = {}) => g.text(s, x, y, { font: F("Special Elite", size), color: o.color || th.ink, align: o.align, sp: o.sp || 0, alpha: o.alpha ?? 1 });
      const label = (s, x, y, o = {}) => g.text(String(s).toUpperCase(), x, y, { font: F("Oswald", o.size || 20, 500), color: o.color || th.ink, sp: o.sp ?? 5, align: o.align, alpha: o.alpha ?? 0.8 });
      // sello dentado con una ilustración; inner(x, y, w, h) dibuja el centro
      const sello = (x, y, w, h, inner) => {
        const c = document.createElement("canvas"); c.width = w; c.height = h; const k = c.getContext("2d");
        k.fillStyle = "#fbf8f1"; k.fillRect(0, 0, w, h); k.globalCompositeOperation = "destination-out";
        const r = 7, st = 21;
        for (let xx = st / 2; xx < w; xx += st) { k.beginPath(); k.arc(xx, 0, r, 0, 7); k.arc(xx, h, r, 0, 7); k.fill(); }
        for (let yy = st / 2; yy < h; yy += st) { k.beginPath(); k.arc(0, yy, r, 0, 7); k.arc(w, yy, r, 0, 7); k.fill(); }
        ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(0.03); ctx.translate(-w / 2, -h / 2);
        ctx.shadowColor = "rgba(0,0,0,.22)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3; ctx.drawImage(c, 0, 0); ctx.shadowColor = "transparent";
        const ix = 16, iy = 16, iw = w - 32, ih = h - 32;
        ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
        ctx.fillStyle = th.a; ctx.fillRect(ix, iy, iw, ih); inner(ix, iy, iw, ih);
        ctx.restore();
        g.text("GUATEMALA", ix + 10, iy + 26, { font: F("Oswald", 17, 500), color: onA, sp: 2, alpha: 0.95 });
        g.text("Q1", ix + iw - 10, iy + ih - 12, { font: F("Abril Fatface", 34), color: onA, align: "right" });
        ctx.restore();
      };
      // los volcanes de Xela con un sol (dentro del sello)
      const volcanes = (x, y, w, h) => {
        ctx.fillStyle = th.b; ctx.beginPath(); ctx.arc(x + w * 0.68, y + h * 0.42, w * 0.16, 0, 7); ctx.fill();
        ctx.fillStyle = g.mix(th.a, "#000", 0.35); ctx.beginPath(); ctx.moveTo(x - 10, y + h); ctx.lineTo(x + w * 0.38, y + h * 0.5); ctx.lineTo(x + w * 0.5, y + h * 0.56); ctx.lineTo(x + w * 0.86, y + h * 0.74); ctx.lineTo(x + w + 10, y + h); ctx.fill();
        ctx.fillStyle = g.mix(th.a, "#000", 0.55); ctx.beginPath(); ctx.moveTo(x - 10, y + h); ctx.lineTo(x + w * 0.12, y + h * 0.8); ctx.lineTo(x + w * 0.55, y + h * 0.88); ctx.lineTo(x + w + 10, y + h * 0.82); ctx.lineTo(x + w + 10, y + h); ctx.fill();
      };
      const diaEnSello = (big, small) => (x, y, w, h) => {
        const f = g.fit(big, (s) => F("Abril Fatface", s), { maxW: w - 30, maxLines: 1, start: 130, min: 40 });
        g.text(big, x + w / 2, y + h * 0.6, { font: f.font, color: onA, align: "center" });
        g.text(small.toUpperCase(), x + w / 2, y + h * 0.6 + 40, { font: F("Oswald", 24, 500), color: onA, sp: 3, align: "center" });
      };
      // matasellos: anillo doble con texto y ondas; va ENCIMA del sello y su texto queda en el papel
      const matasellos = (sx, cy, r, l2, toX) => {
        const cx = sx - r * 0.74 - 10;
        ctx.save(); ctx.globalAlpha = 0.8; ctx.translate(cx, cy); ctx.rotate(-0.14);
        g.roughCircle(0, 0, r, r, th.pm, 5, { passes: 1 }); g.roughCircle(0, 0, r - 13, r - 13, th.pm, 2, { passes: 1 });
        g.text("LA LÍNEA", 0, -r * 0.42, { font: F("Oswald", 17, 500), color: th.pm, sp: 3, align: "center" });
        const f = g.fit(l2, (s) => F("Oswald", s, 700), { maxW: r * 1.4, maxLines: 1, start: 40, min: 18 });
        g.text(l2, 0, f.size * 0.36, { font: f.font, color: th.pm, align: "center" });
        g.text("XELA · GT", 0, r * 0.58, { font: F("Oswald", 17, 500), color: th.pm, sp: 3, align: "center" });
        ctx.strokeStyle = th.pm; ctx.lineWidth = 4; ctx.lineCap = "round";
        for (let i = 0; i < 5; i++) {
          const yy = -38 + i * 19; ctx.beginPath();
          for (let xx = r + 12; xx <= toX - cx; xx += 6) { const Y = yy + Math.sin(xx / 22) * 6; xx === r + 12 ? ctx.moveTo(xx, Y) : ctx.lineTo(xx, Y); }
          ctx.stroke();
        }
        ctx.restore();
      };
      // renglones para escribir a mano: dibuja el texto en Caveat sobre líneas
      const renglon = (lab, s, y, size, o = {}) => {
        label(lab, M, y, { size: 19 });
        const lw = g.measure(lab.toUpperCase(), F("Oswald", 19, 500), 5) + 22, cut = o.short ? 190 : 0;
        const f = g.fit(s, (z) => F("Caveat", z, 700), { maxW: W - 2 * M - lw - 10 - cut, maxLines: o.maxLines || 2, start: size, min: 34, lh: 1.05 });
        f.lines.forEach((l, i) => {
          const yy = y + i * f.lh;
          ctx.fillStyle = soft; ctx.fillRect(M + lw - 6, yy + 12, W - 2 * M - lw + 6 - cut, 2);
          g.text(l, M + lw + 6, yy, { font: f.font, color: o.color || th.a, rotate: -0.012 });
        });
        return y + (f.lines.length - 1) * f.lh;
      };
      // con foto: postal ilustrada. La foto va grande arriba, con marco blanco y esquinas suaves
      let top = story ? 230 : square ? 76 : 84, photoB = 0;
      if (ph) {
        const pH = story ? 420 : square ? 300 : d.kind === "ann" ? 320 : d.kind === "verse" ? 340 : 360, px = M - 26, pw = W - 2 * M + 52;
        ctx.save(); ctx.translate(W / 2, top + pH / 2); ctx.rotate(-0.012); ctx.translate(-W / 2, -top - pH / 2);
        ctx.save(); ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6; g.round(px, top, pw, pH, 18, "#fbf8f1"); ctx.restore();
        g.photo(px + 18, top + 18, pw - 36, pH - 36, { treat: "calido", focusY: 0.5, path: (c) => { c.beginPath(); c.roundRect ? c.roundRect(px + 18, top + 18, pw - 36, pH - 36, 10) : c.rect(px + 18, top + 18, pw - 36, pH - 36); } });
        ctx.restore();
        photoB = top + pH;
      }
      const sw = ph ? 176 : square ? 200 : 236, shh = ph ? 206 : square ? 236 : 284, sx = W - M - sw + 8;
      const sy = ph ? photoB - Math.round(shh * 0.42) : top;
      const hy = ph ? photoB + 4 : sy;
      const cabecera = () => {
        label("Tarjeta postal", M, hy + 46, { size: 30, sp: 9, alpha: 1, color: th.ink });
        if (!ph || !square) typed(d.church, M, hy + 88, 22, { alpha: 0.85 });
        ctx.fillStyle = soft; ctx.fillRect(M, hy + (ph && square ? 66 : 110), 300, 2);
      };
      const headEnd = Math.max(sy + shh, hy + 110) + (square ? 46 : 64);
      const sello2 = (inner, l2) => { sello(sx, sy, sw, shh, inner); matasellos(sx, sy + shh * 0.56, square || ph ? 80 : 92, l2, W - M); };
      if (d.kind === "card") {
        cabecera();
        sello2(volcanes, diaMes("x " + d.kicker) || "HOY");
        const [l0, main] = g.splitHead(d.headline);
        const addrH = 270, ay = H - 70 - addrH;
        const ln = g.fit(d.line, (s) => F("Special Elite", s), { maxW: W - 2 * M, maxLines: 2, start: 42, min: 34, lh: 1.28 });
        let y = headEnd;
        if (l0) { g.text(l0, M, y + 62, { font: F("Caveat", ph ? 84 : 96, 700), color: th.a, rotate: -0.05 }); y += ph ? 66 : 78; }
        const hd = g.fit(main, (s) => F("Abril Fatface", s), { maxW: W - 2 * M, maxLines: 2, start: 170, min: 64, lh: 1.02, maxH: ay - 50 - y - ln.h - 60 });
        y = g.lines(hd.lines, M - 4, y + hd.size * 0.84, hd.lh, { font: hd.font, color: th.ink }) + hd.size * 0.24 + 40;
        y = g.lines(ln.lines, M, y + ln.size * 0.8, ln.lh, { font: ln.font, color: th.ink }) + 56;
        // el versículo solo si sobra sitio para leerlo bien
        const vRoom = ay - 40 - y;
        const vs = d.verse && vRoom > 90 ? g.fit(`«${d.verse}» ${d.ref}`, (s) => F("Special Elite", s), { maxW: W - 2 * M, maxLines: 3, start: 32, min: 28, lh: 1.36, maxH: vRoom }) : null;
        if (vs && cupo(vs, `«${d.verse}» ${d.ref}`)) g.lines(vs.lines, M, y + vs.size * 0.5, vs.lh, { font: vs.font, color: th.ink, alpha: 0.85 });
        // destinatario
        ctx.fillStyle = th.ink; ctx.fillRect(M, ay, W - 2 * M, 3);
        const py = renglon("Para:", d.name, ay + 86, 78);
        const de = renglon("De:", d.signature, Math.max(py + 80, ay + 180), 54, { maxLines: 1, short: true });
        typed(d.from, M + 70, de + 46, 24, { alpha: 0.85 });
        g.logo(W - M, H - 70 - 66, 66, { white: dark, align: "right" });
      } else if (d.kind === "ann") {
        cabecera();
        sello2(d.date ? diaEnSello(d.day, d.month.slice(0, 3)) : volcanes, d.date ? d.time.toUpperCase() : "AVISO");
        const addrH = 140, ay = H - 70 - addrH;
        // los datos, uno por renglón: día, hora y lugar
        const rows = [];
        if (d.date) { rows.push(["Día", cap(d.when)]); rows.push(["Hora", d.time]); }
        if (d.place) rows.push(["Lugar", d.place]);
        if (!rows.length) rows.push(["Fecha", "¡Separe la fecha!"]);
        const vx = M + 150, vw = W - M - vx;
        const fits = rows.map(([, v]) => g.fit(v, (s) => F("Special Elite", s), { maxW: vw, maxLines: 2, start: 42, min: 34, lh: 1.2 }));
        const rowsH = fits.reduce((a, f) => a + f.h + 30, 0);
        let y = headEnd;
        g.text("¡Le invitamos!", M, y + 58, { font: F("Caveat", ph ? 78 : 92, 700), color: th.a, rotate: -0.05 }); y += ph ? 70 : 84;
        const rowsTop = ay - 40 - rowsH;
        const tt = g.fit(d.title, (s) => F("Abril Fatface", s), { maxW: W - 2 * M, maxLines: 4, start: 150, min: 52, lh: 1.04, maxH: rowsTop - 50 - y });
        const extra = Math.max(0, rowsTop - 50 - y - tt.h);
        g.lines(tt.lines, M - 4, y + extra * 0.3 + tt.size * 0.84, tt.lh, { font: tt.font, color: th.ink });
        let ry = rowsTop + extra * 0.15;
        fits.forEach((f, i) => {
          ctx.fillStyle = soft; ctx.fillRect(M, ry, W - 2 * M, 2);
          label(rows[i][0], M, ry + 26 + f.size * 0.5, { size: 20 });
          g.lines(f.lines, vx, ry + 22 + f.size * 0.8, f.lh, { font: f.font, color: th.ink });
          ry += f.h + 30;
        });
        ctx.fillStyle = th.ink; ctx.fillRect(M, ay, W - 2 * M, 3);
        renglon("Para:", "la iglesia", ay + 90, 64, { maxLines: 1, short: true });
        g.logo(W - M, H - 70 - 66, 66, { white: dark, align: "right" });
      } else {
        const bot = H - (story ? 280 : 70);
        cabecera();
        sello2(volcanes, diaMes(d.eyebrow) || "HOY");
        let y = headEnd;
        const hd = d.head || "Palabra para hoy";
        const hf = g.fit(hd, (s) => F("Caveat", s, 700), { maxW: W - 2 * M, maxLines: 2, start: square ? 84 : 100, min: 54, lh: 1 });
        y = g.lines(hf.lines, M, y + hf.size * 0.7, hf.lh, { font: hf.font, color: th.a, rotate: -0.04 }) + (square ? 60 : 80);
        const footH = d.firma ? (square ? 90 : 110) : 0, refY = bot - footH - (square ? 30 : 50);
        const v = g.fit(d.text, (s) => F("Special Elite", s), { maxW: W - 2 * M, maxLines: 14, start: story ? 80 : square ? 76 : 66, min: 26, lh: 1.32, maxH: refY - y - 90 });
        const vy = g.lines(v.lines, M, y + v.size * 0.4 + Math.max(0, refY - y - 90 - v.h) * 0.3, v.lh, { font: v.font, color: th.ink });
        g.text(d.ref, M, Math.min(vy + 96, refY), { font: F("Abril Fatface", square ? 46 : 54), color: th.a });
        if (d.firma) {
          const ay = bot - footH;
          ctx.fillStyle = th.ink; ctx.fillRect(M, ay, W - 2 * M, 3);
          g.logo(M, ay + 24, square ? 54 : 64, { white: dark, align: "left" });
        }
      }
    },
  });

  // ======================================================================================
  // «Boleto»: un boleto de entrada con banda de color, muescas, talón perforado y número de serie.
  E.add({
    id: "pap-boleto", name: "Boleto de entrada", family: "papel", fonts: ["Bebas Neue", "Alfa Slab One", "Special Elite", "Oswald"],
    themes: {
      marino: { name: "Marino y oro", bg: "#0d1b3d", tk: "#f5ecd6", ink: "#0d1b3d", acc: "#f2c85b", num: "#2d5fa8" },
      cine: { name: "Rojo cine", bg: "#a72d27", tk: "#f4ead5", ink: "#1d1a18", acc: "#a72d27", num: "#a72d27" },
      menta: { name: "Menta y mandarina", bg: "#6fa38a", tk: "#fffaf0", ink: "#163a2e", acc: "#e46b3c", num: "#e46b3c" },
      mostaza: { name: "Mostaza", bg: "#e6ad38", tk: "#f8f3e6", ink: "#2a2117", acc: "#2a2117", num: "#b5451f" },
      noche: { name: "Noche y lima", bg: "#171717", tk: "#e2f16a", ink: "#151515", acc: "#151515", num: "#151515" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g;
      const story = d.kind === "verse" && g.fmt === "historia", square = d.kind === "verse" && g.fmt === "cuadrado";
      {
        g.paper(th.bg, { fibers: 0.5, grain: 0.07 });
        // líneas finas de fondo, como el papel de seguridad
        ctx.save(); ctx.strokeStyle = g.rgba(g.lum(th.bg) > 0.5 ? "#000000" : "#ffffff", 0.06); ctx.lineWidth = 2;
        for (let y = -W; y < H; y += 26) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + W * 0.4); ctx.stroke(); }
        ctx.restore();
      }
      const tx = 84, tw = W - 168, ty = story ? 230 : square ? 64 : 84, tb = H - (story ? 270 : square ? 64 : 84), thh = tb - ty;
      const perf = Math.round(ty + thh * (story ? 0.8 : square ? 0.72 : 0.77)), nr = 34, rr = 26;
      const onAcc = g.lum(th.acc) > 0.55 ? th.ink : th.tk;
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.016); ctx.translate(-W / 2, -H / 2);
      const forma = () => {
        const x = tx, y = ty, w = tw, b = tb; ctx.beginPath();
        ctx.moveTo(x + rr, y); ctx.lineTo(x + w - rr, y); ctx.arcTo(x + w, y, x + w, y + rr, rr);
        ctx.lineTo(x + w, perf - nr); ctx.arc(x + w, perf, nr, -Math.PI / 2, Math.PI / 2, true);
        ctx.lineTo(x + w, b - rr); ctx.arcTo(x + w, b, x + w - rr, b, rr); ctx.lineTo(x + rr, b); ctx.arcTo(x, b, x, b - rr, rr);
        ctx.lineTo(x, perf + nr); ctx.arc(x, perf, nr, Math.PI / 2, -Math.PI / 2, true);
        ctx.lineTo(x, y + rr); ctx.arcTo(x, y, x + rr, y, rr); ctx.closePath();
      };
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.42)"; ctx.shadowBlur = 34; ctx.shadowOffsetY = 14; ctx.fillStyle = th.tk; forma(); ctx.fill(); ctx.restore();
      ctx.save(); forma(); ctx.clip(); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); g.grain(0.07); ctx.restore(); ctx.restore();
      ctx.save(); ctx.strokeStyle = g.rgba(th.ink, 0.35); ctx.lineWidth = 3; forma(); ctx.stroke(); ctx.restore();
      // banda, filetes y perforación. Con foto: la foto en duotono es una franja ancha bajo la banda
      const ix = tx + 26, iw = tw - 52, bandH0 = 84;
      ctx.fillStyle = th.acc; ctx.fillRect(ix, ty + 26, iw, bandH0);
      let bandH = bandH0;
      if (g.photoOn) {
        const pH = Math.round((perf - ty) * (story ? 0.36 : square ? 0.3 : d.kind === "card" ? 0.32 : 0.3));
        if (duoFoto(g, ix, ty + 26 + bandH0, iw, pH, g.lum(th.bg) < 0.5 ? th.bg : th.ink, g.lum(th.tk) > 0.8 ? g.mix(th.tk, th.acc, 0.25) : th.tk)) bandH += pH;
        ctx.fillStyle = th.acc; ctx.fillRect(ix, ty + 26 + bandH - 8, iw, 8);
      }
      ctx.strokeStyle = g.rgba(th.ink, 0.55); ctx.lineWidth = 2;
      ctx.strokeRect(ix, ty + 26, iw, perf - nr - 16 - ty - 26); ctx.strokeRect(ix, perf + nr + 16, iw, tb - 26 - perf - nr - 16);
      ctx.fillStyle = g.rgba(th.ink, 0.5);
      for (let x = tx + nr + 20; x < tx + tw - nr - 14; x += 19) { ctx.beginPath(); ctx.arc(x, perf, 4.5, 0, 7); ctx.fill(); }
      const banda = (l, r) => {
        g.text(l.toUpperCase(), ix + 30, ty + 26 + 56, { font: F("Oswald", 30, 700), color: onAcc, sp: 6 });
        if (r) { const f = g.fit(r.toUpperCase(), (s) => F("Oswald", s, 500), { maxW: iw * 0.42, maxLines: 1, start: 26, min: 16, sp: 4 }); g.text(r.toUpperCase(), ix + iw - 30, ty + 26 + 54, { font: f.font, color: onAcc, sp: 4, align: "right" }); }
      };
      const lab = (s, x, y, o = {}) => g.text(String(s).toUpperCase(), x, y, { font: F("Oswald", o.size || 20, 500), color: th.ink, sp: 5, alpha: 0.7, align: o.align });
      const cx0 = ix + 40, cw = iw - 80, m0 = ty + 26 + bandH, m1 = perf - nr - 16;
      // talón: número de serie a la izquierda y texto a la derecha
      const s0 = perf + nr + 16, s1 = tb - 26, sh = s1 - s0, nf = F("Special Elite", Math.min(86, sh * 0.42));
      const talon = (right) => {
        lab("Nº", cx0, s0 + sh * 0.36, { size: 20 });
        g.text(serie(g), cx0, s0 + sh * 0.36 + Math.min(86, sh * 0.42) * 0.95, { font: nf, color: th.num });
        const nx = cx0 + g.measure("0000", nf) + 50;
        ctx.fillStyle = g.rgba(th.ink, 0.35); ctx.fillRect(nx - 26, s0 + 24, 2, sh - 48);
        right(nx, ix + iw - 40 - nx);
      };
      if (d.kind === "card") {
        banda("Pase especial", d.kicker);
        // solo lo esencial: titular, nombre, frase y firma (el versículo no cabe legible en un boleto)
        const sgY = m1 - 40, nm = g.fit(d.name, (s) => F("Alfa Slab One", s), { maxW: cw, maxLines: 2, start: g.photoOn ? 64 : 80, min: 40, lh: 1.12 });
        let ln = g.fit(d.line, (s) => F("Special Elite", s), { maxW: cw, maxLines: 2, start: 38, min: 32, lh: 1.25 });
        // si no cabe todo, la frase se queda fuera antes que apretar el titular
        if (sgY - m0 - 40 - (64 + 26 + nm.h + 40 + ln.h + 50 + 70) < 2 * 80 * 0.9) ln = { lines: [], h: 0, size: 0, lh: 0 };
        const restH = 64 + 26 + nm.h + (ln.h ? 40 + ln.h : 0) + 50 + 70;
        const hd = g.fit(limpio(d.headline).toUpperCase(), (s) => F("Bebas Neue", s), { maxW: cw, maxLines: 2, start: 190, min: 80, lh: 0.9, maxH: sgY - m0 - 40 - restH });
        const extra = Math.max(0, sgY - m0 - 40 - restH - hd.h);
        let y = m0 + 36 + extra * 0.35 + hd.size * 0.8;
        y = g.lines(hd.lines, cx0 - 3, y, hd.lh, { font: hd.font, color: th.ink }) + 64;
        lab("Admite a:", cx0, y); y += 26 + nm.size * 0.8;
        y = g.lines(nm.lines, cx0, y, nm.lh, { font: nm.font, color: th.ink }) + 40 + ln.size * 0.8;
        g.lines(ln.lines, cx0, y, ln.lh, { font: ln.font, color: th.ink });
        g.text(d.signature, cx0, sgY, { font: F("Alfa Slab One", 34), color: th.num });
        g.logo(ix + iw - 36, sgY - 62, 72, { align: "right" });
        const val = d.occasion === "bodas" ? "toda la vida, juntos" : d.occasion === "cumple" ? "un año más de bendiciones" : "hoy y siempre";
        talon((x, w) => {
          lab("Válido por", x, s0 + sh * 0.36, { size: 20 });
          const f = g.fit(val, (s) => F("Alfa Slab One", s), { maxW: w, maxLines: 2, start: 40, min: 22, lh: 1.12, maxH: sh * 0.5 });
          g.lines(f.lines, x, s0 + sh * 0.36 + 18 + f.size, f.lh, { font: f.font, color: th.ink });
        });
      } else if (d.kind === "ann") {
        banda("Admisión general", "Entrada libre");
        const cells = d.date ? [["Día", cap(d.weekday)], ["Fecha", `${d.day} ${d.month.slice(0, 3)}.`], ["Hora", d.time]] : [];
        const plF = null;
        const gridH = (cells.length ? 130 : 0) + (plF ? plF.h + 76 : 0) + (!cells.length && !plF ? 120 : 0);
        const room = m1 - m0 - 70 - gridH - 50;
        const tt = g.fit(d.title.toUpperCase(), (s) => F("Bebas Neue", s), { maxW: cw, maxLines: 4, start: 230, min: 80, lh: 0.9, maxH: room });
        const extra = Math.max(0, room - tt.h - 30);
        let y = m0 + 50 + extra * 0.4 + tt.size * 0.8;
        y = g.lines(tt.lines, cx0 - 3, y, tt.lh, { font: tt.font, color: th.ink }) + 50 + extra * 0.3;
        const cell = (x, yy, w, h, k) => { ctx.strokeStyle = g.rgba(th.ink, 0.6); ctx.lineWidth = 2; ctx.strokeRect(x, yy, w, h); lab(k, x + 18, yy + 32, { size: 17 }); };
        if (cells.length) {
          const w3 = cw / 3;
          cells.forEach(([k, v], i) => {
            cell(cx0 + i * w3, y, w3, 120, k);
            const f = g.fit(v, (s) => F("Alfa Slab One", s), { maxW: w3 - 36, maxLines: 1, start: 44, min: 20 });
            g.text(v, cx0 + i * w3 + 18, y + 96, { font: f.font, color: th.ink });
          });
          y += 130;
        }
        if (plF) { cell(cx0, y, cw, plF.h + 66, "Lugar"); g.lines(plF.lines, cx0 + 18, y + 48 + plF.size * 0.8, plF.lh, { font: plF.font, color: th.ink }); }
        if (!cells.length && !plF) g.text("¡Le esperamos!", cx0, y + 70, { font: F("Alfa Slab One", 58), color: th.num });
        talon((x, w) => {
          // el talón dice dónde es (o reserva el asiento), sin repetir la fecha
          const lw = w - 200;
          lab(d.place ? "Lugar" : "Asiento", x, s0 + sh * 0.3, { size: 20 });
          const f = g.fit(d.place || "Reservado para usted", (s) => F("Alfa Slab One", s), { maxW: lw, maxLines: 3, start: 40, min: 24, lh: 1.12, maxH: sh * 0.62 });
          g.lines(f.lines, x, s0 + sh * 0.3 + 16 + f.size, f.lh, { font: f.font, color: th.ink });
          g.logo(x + w, s0 + sh / 2 - 34, 68, { align: "right" });
        });
      } else {
        banda(d.head ? "Pase diario" : "Palabra para hoy", d.eyebrow || d.churchShort);
        let y = m0 + (square ? 40 : 60);
        if (d.head) {
          const hf = g.fit(d.head, (s) => F("Alfa Slab One", s), { maxW: cw, maxLines: 2, start: 70, min: 40, lh: 1.1 });
          y = g.lines(hf.lines, cx0, y + hf.size * 0.8, hf.lh, { font: hf.font, color: th.num }) + 40;
        }
        const room = m1 - y - (square ? 30 : 50);
        const v = g.fit(d.text, (s) => F("Alfa Slab One", s), { maxW: cw, maxLines: 14, start: story ? 92 : 84, min: 30, lh: 1.2, maxH: room });
        g.lines(v.lines, cx0 - 2, y + Math.max(0, room - v.h) * 0.4 + v.size * 0.82, v.lh, { font: v.font, color: th.ink });
        talon((x, w) => {
          const f = g.fit(d.ref, (s) => F("Alfa Slab One", s), { maxW: w, maxLines: 1, start: 54, min: 24 });
          lab(d.firma ? d.church : "Válido hoy y siempre", x, s0 + sh * 0.36, { size: d.firma ? 17 : 20 });
          g.text(d.ref, x, s0 + sh * 0.36 + 18 + f.size * 0.9, { font: f.font, color: th.ink });
        });
      }
      ctx.restore();
    },
  });

  // ===== pila de bloques (para el marbete): cada bloque sabe su alto y se reparte el aire sobrante =====
  function blq(g, s, fontFn, o = {}) {
    const f = g.fit(s, fontFn, o), asc = f.size * (o.asc ?? 0.78), desc = f.size * (o.desc ?? 0.26);
    return { f, gap: o.gap || 0, h: asc + (f.lines.length - 1) * f.lh + desc,
      draw: (top) => g.lines(f.lines, o.x, top + asc, f.lh, { font: f.font, color: o.color, align: o.align, sp: f.sp, alpha: o.alpha }) };
  }
  function apilar(items, top, bottom, o = {}) {
    items = items.filter(Boolean);
    const tot = items.reduce((a, b) => a + b.h + b.gap, 0), extra = Math.max(0, bottom - top - tot);
    const add = Math.min(o.maxAdd ?? 40, extra / Math.max(1, items.length - 1));
    let y = top + (extra - add * (items.length - 1)) * (o.align ?? 0.45);
    items.forEach((it) => { y += it.gap; it.draw(y); y += it.h + add; });
  }
  const alto = (items) => items.filter(Boolean).reduce((a, b) => a + b.h + b.gap, 0);

  // ======================================================================================
  // «Riso a dos tintas»: impresión risográfica. Una tinta para el semitono y los bloques, otra para el
  // texto; el titular sale con el registro corrido (las dos tintas no caen en el mismo sitio).
  E.add({
    id: "pap-riso", name: "Riso a dos tintas", family: "papel", fonts: ["Archivo Black", "Fraunces", "Hanken Grotesk"],
    themes: {
      rosa: { name: "Rosa flúor y azul", paper: "#f4efe5", i1: "#ff5c9e", i2: "#1f4f9e" },
      marino: { name: "Marino y oro", paper: "#f3eee2", i1: "#f2c85b", i2: "#2d5fa8", txt: "#0d1b3d" },
      naranja: { name: "Naranja y verde", paper: "#f1ebdf", i1: "#ff6a2b", i2: "#13675a" },
      uva: { name: "Amarillo y uva", paper: "#f0eae6", i1: "#ffc93c", i2: "#5a2a82" },
      rojo: { name: "Rojo y negro", paper: "#efe9dd", i1: "#e5392e", i2: "#222024" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, M = 84, txt = th.txt || th.i2, ph = g.photoOn;
      const story = d.kind === "verse" && g.fmt === "historia", square = d.kind === "verse" && g.fmt === "cuadrado";
      g.paper(th.paper, { fibers: 0.35, grain: 0.05, mottle: 0.6 });
      const mul = (fn) => { ctx.save(); ctx.globalCompositeOperation = "multiply"; fn(); ctx.restore(); };
      const DX = 8, DY = 6;
      // titular a dos tintas con el registro corrido (solo en lo grande)
      const riso = (lines, x, y, lh, font, align) => mul(() => {
        g.lines(lines, x + DX, y + DY, lh, { font, color: th.i1, align });
        g.lines(lines, x, y, lh, { font, color: txt, align });
      });
      const plano = (lines, x, y, lh, font, align) => mul(() => g.lines(lines, x, y, lh, { font, color: txt, align }));
      // disco de semitono. Con foto: la foto impresa en la tinta clara (sombras en tinta, luces en papel)
      let disc = null;
      const disco = (cx, cy, r, o = {}) => {
        disc = { cx, cy, r };
        const path = (c) => { c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); };
        if (ph && tintaFoto(g, cx - r, cy - r, 2 * r, 2 * r, th.i1, th.paper, { path })) {
          mul(() => { ctx.save(); path(ctx); ctx.clip(); g.halftone(cx - r, cy - r, 2 * r, 2 * r, th.i1, { step: 12, angle: 0.4, size: 0.55, alpha: 0.3 }); ctx.restore(); });
          return;
        }
        mul(() => { ctx.save(); path(ctx); ctx.clip(); g.halftone(cx - r, cy - r, 2 * r, 2 * r, th.i1, { step: 18, fade: o.fade || "none", angle: 0.5, size: o.size ?? 1.35 }); ctx.restore(); });
      };
      // ancho libre a la izquierda del disco entre y0 e y1 (el texto nunca se monta en el disco)
      const libre = (y0, y1) => {
        if (!disc) return W - 2 * M;
        const yy = Math.max(y0, Math.min(y1, disc.cy)), dy = Math.abs(yy - disc.cy);
        const x = dy >= disc.r ? W : disc.cx - Math.sqrt(disc.r * disc.r - dy * dy);
        return Math.min(W - M, x - 40) - M;
      };
      // marcas de registro de la imprenta
      const marca = (x, y) => { ctx.save(); ctx.strokeStyle = g.rgba(txt, 0.65); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.moveTo(x - 20, y); ctx.lineTo(x + 20, y); ctx.moveTo(x, y - 20); ctx.lineTo(x, y + 20); ctx.stroke(); ctx.restore(); };
      const label = (s, x, y, o = {}) => g.text(String(s).toUpperCase(), x, y, { font: F("Hanken Grotesk", o.size || 20, 700), color: txt, sp: 4, align: o.align, alpha: o.alpha ?? 0.9 });
      // etiqueta en la tinta oscura con letra color papel (no se confunde con el disco)
      const etiqueta = (lines, x, y, lh, font, size, align) => lines.forEach((l, i) => {
        const yy = y + i * lh, w = g.measure(l, font) + 44, x0 = align === "center" ? x - w / 2 + 22 : x;
        ctx.fillStyle = txt; ctx.fillRect(x0 - 22, yy - size * 0.86, w, size * 1.18);
        g.text(l, x0, yy, { font, color: th.paper });
      });
      if (d.kind === "card") {
        const dr = ph ? 400 : 320;
        disco(W - 120, H - 250, dr, { fade: "up" });
        marca(W - 46, 46);
        g.logo(M, 64, 60, { align: "left" });
        if (d.kicker) label(d.kicker, W - M, 108, { align: "right" });
        const [l0, main] = g.splitHead(d.headline);
        let y = 258;
        if (l0) { g.text(l0, M, y, { font: F("Fraunces", 112, 400, true), color: txt }); y += 40; }
        const big = g.fit(main.toLowerCase(), (s) => F("Archivo Black", s), { maxW: W - 2 * M - DX, maxLines: 3, start: 200, min: 80, lh: 1.0 });
        y += big.size * 0.8; riso(big.lines, M - 4, y, big.lh, big.font); y += (big.lines.length - 1) * big.lh + 96;
        const nm = g.fit(d.name, (s) => F("Hanken Grotesk", s, 800), { maxW: Math.min(W - 2 * M - 44, libre(y - 60, y + 160) - 44), maxLines: 2, start: 72, min: 40, lh: 1.3 });
        etiqueta(nm.lines, M + 22, y + nm.size * 0.8 - 30, nm.lh, nm.font, nm.size);
        y += nm.size * 0.8 - 30 + (nm.lines.length - 1) * nm.lh + nm.size * 0.32 + 70;
        const ln = g.fit(d.line, (s) => F("Hanken Grotesk", s, 600), { maxW: libre(y - 40, y + 60), maxLines: 2, start: 40, min: 32, lh: 1.25 });
        y = g.lines(ln.lines, M, y, ln.lh, { font: ln.font, color: txt }) + 64;
        // el versículo solo si cabe legible a la izquierda del disco
        const room = H - 210 - y, vw = libre(y - 30, y + room);
        const vs = !ph && room > 100 && vw > 380 ? g.fit(`«${d.verse}»`, (s) => F("Fraunces", s, 400, true), { maxW: vw, maxLines: 4, start: 36, min: 30, lh: 1.3, maxH: room - 50 }) : null;
        if (vs && cupo(vs, `«${d.verse}»`)) { const vy = g.lines(vs.lines, M, y, vs.lh, { font: vs.font, color: txt }); label(d.ref, M, vy + 46, { size: 22 }); }
        g.text(d.signature, M, H - 126, { font: F("Fraunces", 50, 400, true), color: txt });
        g.text(d.from, M, H - 84, { font: F("Hanken Grotesk", 24, 600), color: txt, alpha: 0.85 });
      } else if (d.kind === "ann") {
        // cartel centrado a propósito: el día enorme dentro del disco y el título abajo
        g.logo(W / 2, 54, 58);
        marca(46, H - 46); marca(W - 46, 46);
        label(d.church, W / 2, H - 64, { size: 19, align: "center" });
        const pl = d.place ? g.fit(d.place, (s) => F("Hanken Grotesk", s, 600), { maxW: W - 2 * M, maxLines: 2, start: 38, min: 30, lh: 1.25 }) : null;
        const plBase = H - 64 - 66, plTop = pl ? plBase - (pl.lines.length - 1) * pl.lh - pl.size * 0.8 : plBase + 20;
        const tt = g.fit(d.title, (s) => F("Archivo Black", s), { maxW: W - 2 * M, maxLines: 3, start: 116, min: 54, lh: 1.04, maxH: 380 });
        const ttBase = plTop - (pl ? 50 : 30), ttTop = ttBase - (tt.lines.length - 1) * tt.lh - tt.size * 0.78;
        const kf = F("Fraunces", 58, 400, true), kY = ttTop - 34;
        const r = Math.min(370, (kY - 58 - 70 - 140) / 2), cy = 140 + r;
        disco(W / 2, cy, r);
        if (d.date) {
          const df = g.fit(d.day, (s) => F("Archivo Black", s), { maxW: r * 1.5, maxLines: 1, start: Math.round(r * 1.25), min: 120 });
          riso([d.day], W / 2, cy + altoH(ctx, df.font, "0") / 2 - r * 0.06, 0, df.font, "center");
        } else {
          const df = g.fit("¡VEN!", (s) => F("Archivo Black", s), { maxW: r * 1.6, maxLines: 1, start: Math.round(r * 0.7), min: 80 });
          riso(["¡VEN!"], W / 2, cy + altoH(ctx, df.font) / 2, 0, df.font, "center");
        }
        const pillT = (d.date ? `${d.weekday} · ${d.month} · ${d.time}` : `Aviso · ${d.churchShort}`).toUpperCase();
        const pf = g.fit(pillT, (s) => F("Hanken Grotesk", s, 800), { maxW: W - 2 * M - 60, maxLines: 1, start: 32, min: 24 });
        etiqueta([pillT], W / 2, cy + r + pf.size * 0.4, 0, pf.font, pf.size, "center");
        g.text("le invitamos", W / 2, kY, { font: kf, color: txt, align: "center" });
        plano(tt.lines, W / 2, ttTop + tt.size * 0.78, tt.lh, tt.font, "center");
        if (pl) g.lines(pl.lines, W / 2, plTop + pl.size * 0.8, pl.lh, { font: pl.font, color: txt, align: "center" });
      } else {
        const top = story ? 250 : 100, bot = H - (story ? 300 : 84);
        const r = story ? 430 : square ? 230 : 300;
        disco(W - r * 0.62, H - r * (story ? 0.62 : 0.5), r, { fade: "up" });
        marca(46, story ? 200 : 46);
        label(d.eyebrow || d.church, M, top);
        let y = top + 40;
        if (d.head) {
          const hf = g.fit(d.head, (s) => F("Fraunces", s, 400, true), { maxW: W - 2 * M - DX, maxLines: 2, start: story ? 120 : 100, min: 56, lh: 1.04 });
          riso(hf.lines, M, y + hf.size * 0.85, hf.lh, hf.font);
          y += hf.size * 0.85 + (hf.lines.length - 1) * hf.lh + hf.size * 0.4;
        }
        // el texto vive arriba del disco; se centra en su espacio y crece hasta llenarlo
        const a1 = disc.cy - disc.r - 40, refRoom = 110;
        const v = g.fit(d.text, (s) => F("Fraunces", s, 700), { maxW: W - 2 * M, maxLines: 14, start: story ? 140 : 112, min: 34, lh: 1.14, maxH: a1 - y - 40 - (story ? 0 : refRoom * 0.4) });
        const vy = y + 40 + Math.max(0, a1 - y - 40 - v.h - (story ? 0 : refRoom * 0.4)) * 0.5 + v.size * 0.8;
        plano(v.lines, M, vy, v.lh, v.font);
        const lastY = vy + (v.lines.length - 1) * v.lh, rY = lastY + (square ? 84 : 100);
        const rf = g.fit(d.ref, (s) => F("Archivo Black", s), { maxW: libre(rY - 130, rY + 10), maxLines: 2, start: square ? 52 : 60, min: 30, lh: 1.05 });
        plano(rf.lines, M, rY, rf.lh, rf.font);
        if (d.firma) g.logo(M, bot - 58, 58, { align: "left" });
      }
    },
  });

  // ======================================================================================
  // «Marbete»: una etiqueta de regalo de cartulina, más angosta que el lienzo, inclinada y colgada de un
  // cordón. Titular enorme en letra condensada con una palabra en caligrafía, y pocas líneas alineadas a la
  // izquierda. Con foto, la etiqueta se hace a un lado y la foto en blanco y negro ocupa el resto.
  E.add({
    id: "pap-marbete", name: "Marbete", family: "papel", fonts: ["Anton", "Yellowtail", "Montserrat"],
    themes: {
      kraft: { name: "Kraft y lino", bg: "#e6e0d3", tag: "#c39a6b", ink: "#22170e", acc: "#8e2a1d", stitch: "#f7f1e3", cord: "#b0412e" },
      marino: { name: "Marino y oro", bg: "#0d1b3d", tag: "#f4ecd8", ink: "#0d1b3d", acc: "#2d5fa8", stitch: "#d9a93a", cord: "#f2c85b" },
      pino: { name: "Pino y mostaza", bg: "#dfe5da", tag: "#2f5a45", ink: "#f3efe2", acc: "#f0b84e", stitch: "#e8b04b", cord: "#e8b04b" },
      rosa: { name: "Rosa y frambuesa", bg: "#f2d9cf", tag: "#fffaf2", ink: "#3a1f2b", acc: "#c43f5b", stitch: "#cf4f68", cord: "#cf4f68" },
      carbon: { name: "Carbón y manila", bg: "#2b2a28", tag: "#e8d4a8", ink: "#1f1b16", acc: "#a8382c", stitch: "#a8382c", cord: "#efe8d8" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F } = g, ph = g.photoOn;
      const story = d.kind === "verse" && g.fmt === "historia", square = d.kind === "verse" && g.fmt === "cuadrado";
      // fondo: la foto en blanco y negro a sangre (la etiqueta se hace a un lado) o lino
      if (ph && g.photo(0, 0, W, H, { treat: "bn", tint: "rgba(0,0,0,.14)" })) g.grain(0.06);
      else {
        g.paper(th.bg, { fibers: 0.4, grain: 0.06 });
        ctx.save(); ctx.fillStyle = g.rgba(g.lum(th.bg) > 0.5 ? "#000000" : "#ffffff", 0.035);
        for (let x = 0; x < W; x += 6) ctx.fillRect(x, 0, 2, H);
        for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
        ctx.restore();
      }
      // la etiqueta: más angosta que el lienzo, inclinada y colgada de su ojal
      const tw = Math.round(W * (ph ? 0.6 : 0.75)), tx = ph ? W - tw - 84 : Math.round((W - tw) / 2) + 48;
      const y0 = story ? 250 : square ? 64 : 104, y1 = H - (story ? 230 : square ? 50 : 76), th0 = y1 - y0;
      const rot = ph ? -0.05 : 0.058, hx = tx + tw / 2, hy = y0 + 78, ink = th.ink, c = Math.round(tw * 0.17), rr = 24;
      const forma = (ins = 0) => {
        const x0 = ins, x1 = tw - ins, t = ins, b = th0 - ins, cc = c - ins * 0.4;
        ctx.beginPath(); ctx.moveTo(x0 + cc, t); ctx.lineTo(x1 - cc, t); ctx.lineTo(x1, t + cc); ctx.lineTo(x1, b - rr); ctx.arcTo(x1, b, x1 - rr, b, rr);
        ctx.lineTo(x0 + rr, b); ctx.arcTo(x0, b, x0, b - rr, rr); ctx.lineTo(x0, t + cc); ctx.closePath();
      };
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(rot); ctx.translate(-tw / 2, -78);
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.34)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14; ctx.shadowOffsetX = 8; ctx.fillStyle = th.tag; forma(); ctx.fill(); ctx.restore();
      ctx.save(); forma(); ctx.clip(); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); g.grain(0.08); ctx.restore(); ctx.restore();
      // costura (el gesto hecho a mano) y ojal reforzado
      ctx.save(); ctx.setLineDash([16, 11]); ctx.strokeStyle = th.stitch; ctx.lineWidth = 3; forma(22); ctx.stroke(); ctx.restore();
      const tagLight = g.lum(th.tag) > 0.5;
      ctx.fillStyle = g.mix(th.tag, tagLight ? "#ffffff" : "#000000", 0.3); ctx.beginPath(); ctx.arc(tw / 2, 78, 40, 0, 7); ctx.fill();
      ctx.strokeStyle = g.rgba(ink, 0.25); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tw / 2, 78, 40, 0, 7); ctx.stroke();
      ctx.fillStyle = ph ? "rgba(0,0,0,.6)" : g.mix(th.bg, "#000000", 0.25); ctx.beginPath(); ctx.arc(tw / 2, 78, 16, 0, 7); ctx.fill();
      // contenido alineado a la izquierda, pocas líneas y con mucha escala
      const px = 58, mw = tw - 2 * px, top = 150, logoH = 50, bot = th0 - 56 - (d.kind !== "verse" || d.firma ? logoH + 24 : 0);
      const B = (s, fn, o) => blq(g, s, fn, { x: px, color: ink, maxW: mw, ...o });
      const sm = (s, o = {}) => ({ gap: o.gap || 0, h: 22 * 0.74, draw: (t) => g.text(String(s).toUpperCase(), px, t + 22 * 0.74, { font: F("Montserrat", 22, 700), color: th.acc, sp: 5 }) });
      const barra = (o = {}) => ({ gap: o.gap || 0, h: 8, draw: (t) => g.round(px, t, 96, 8, 4, th.acc) });
      const AN = (s) => F("Anton", s), SC = (s) => F("Yellowtail", s), MO = (w) => (s) => F("Montserrat", s, w);
      let items;
      if (d.kind === "card") {
        const [l0, main] = g.splitHead(d.headline);
        const lead = l0 ? B(l0, SC, { maxLines: 1, start: ph ? 104 : 124, min: 60, color: th.acc, gap: 24, asc: 0.72, desc: 0.28 }) : null;
        const nm = B(d.name, MO(800), { maxLines: 2, start: 64, min: 38, lh: 1.08, gap: 44 });
        const ln = d.line ? B(d.line, MO(500), { maxLines: 2, start: 34, min: 30, lh: 1.25, gap: 22 }) : null;
        const sg = B(d.signature, SC, { maxLines: 1, start: 62, min: 44, color: th.acc, gap: 50, asc: 0.72, desc: 0.3 });
        const fixed = [sm(d.kicker || d.churchShort), lead, barra({ gap: 40 }), nm, ln, sg];
        const big = B(main.toUpperCase(), AN, { maxLines: 3, start: 240, min: 76, lh: 0.94, gap: l0 ? 0 : 30, asc: 0.8, desc: 0.06, maxH: bot - top - alto(fixed) - 40 });
        items = [fixed[0], lead, big, fixed[2], nm, ln, sg];
      } else if (d.kind === "ann") {
        const tail = d.date
          ? [B(cap(d.when), MO(800), { maxLines: 2, start: 46, min: 32, lh: 1.12, gap: 0 }), B(d.time, SC, { maxLines: 1, start: 70, min: 46, color: th.acc, gap: 22, asc: 0.72, desc: 0.28 })]
          : [B("¡Le esperamos!", SC, { maxLines: 1, start: 80, min: 50, color: th.acc, gap: 0, asc: 0.72, desc: 0.28 })];
        const pl = d.place ? B(d.place, MO(500), { maxLines: 2, start: 34, min: 28, lh: 1.25, gap: 26 }) : null;
        const head = [sm("Le invitamos")], br = barra({ gap: 40 });
        const rest = [br, ...tail, pl];
        rest[1].gap = 40;
        const tt = B(d.title.toUpperCase(), AN, { maxLines: 4, start: 210, min: 64, lh: 0.96, gap: 30, asc: 0.8, desc: 0.06, maxH: bot - top - alto(head) - alto(rest) - 30 });
        items = [...head, tt, ...rest];
      } else {
        const hd = B(d.head || "Palabra para hoy", SC, { maxLines: 2, start: story ? 110 : square ? 84 : 96, min: 56, lh: 1.05, color: th.acc, gap: 24, asc: 0.72, desc: 0.28 });
        const rf = B(d.ref.toUpperCase(), AN, { maxLines: 2, start: square ? 60 : 70, min: 40, lh: 1, gap: 34, asc: 0.8, desc: 0.06 });
        const head = [sm(d.eyebrow || d.church), hd], br = barra({ gap: 40 });
        const v = B(d.text, MO(700), { maxLines: 14, start: story ? 80 : square ? 66 : 64, min: 28, lh: 1.24, gap: 36, maxH: bot - top - alto(head) - alto([br, rf]) - 36 });
        items = [...head, v, br, rf];
      }
      apilar(items, top, bot, { maxAdd: 44, align: 0.4 });
      if (d.kind !== "verse" || d.firma) g.logo(tw - px, th0 - 56 - logoH, logoH, { white: !tagLight, align: "right" });
      ctx.restore();
      // el cordón pasa por el ojal y sube fuera del cuadro
      ctx.save(); ctx.strokeStyle = th.cord; ctx.lineWidth = 7; ctx.lineCap = "round";
      ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
      const up = Math.max(hy, 120);
      ctx.beginPath(); ctx.moveTo(hx - 3, hy + 4); ctx.bezierCurveTo(hx - 30, hy - 70, hx - 120, hy - up * 0.6, hx - 190, -20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx + 3, hy + 4); ctx.bezierCurveTo(hx + 40, hy - 90, hx + 90, hy - up * 0.7, hx + 130, -20); ctx.stroke();
      ctx.restore();
    },
  });

  // ======================================================================================
  // «Letras recortadas»: una palabra hecha con letras recortadas de cartulina, cada una en su ficha,
  // todas de la misma letra (orden, no nota de secuestro). Lo demás, sencillo y alineado a la izquierda.
  E.add({
    id: "pap-letras", name: "Letras recortadas", family: "papel", fonts: ["Archivo Black", "Caveat", "Hanken Grotesk"],
    themes: {
      mostaza: { name: "Cartulina mostaza", bg: "#ecbb3a", tiles: ["#fffaf0", "#1d1d1d"], ink: "#1d1d1d" },
      marino: { name: "Marino y oro", bg: "#0d1b3d", tiles: ["#f5efe2", "#f2c85b", "#2d5fa8"], ink: "#0d1b3d", txt: "#f5efe2" },
      turquesa: { name: "Turquesa y coral", bg: "#3d8c86", tiles: ["#f7f2e8", "#f08a5d"], ink: "#16302d", txt: "#f7f2e8" },
      rosa: { name: "Rosa y granate", bg: "#f2b9c5", tiles: ["#fffaf3", "#b8253c"], ink: "#2a1520" },
      kraft: { name: "Kraft y azul", bg: "#c6a073", tiles: ["#f8f3e8", "#24324f"], ink: "#1d1a17" },
    },
    draw(g) {
      const { ctx, W, H, th, d, F, R } = g, M = 84, ph = g.photoOn;
      const story = d.kind === "verse" && g.fmt === "historia", square = d.kind === "verse" && g.fmt === "cuadrado";
      g.paper(th.bg, { fibers: 0.8, grain: 0.08, mottle: 1 });
      const dark = g.lum(th.bg) < 0.5, txt = th.txt || (dark ? th.tiles[0] : th.ink);
      // fichas de cartulina con una letra cada una, en filas (nunca se parte una palabra).
      // o = { max, indent, right (x es el borde derecho), dry (solo medir) }. Devuelve { bottom, right, s, w, h }
      const fichas = (rows, x, yTop, maxW, maxH, o = {}) => {
        const f100 = F("Archivo Black", 100), long = Math.max(...rows.map((r) => [...r].length)) > 7;
        const pX = long ? 0.1 : 0.16, pY = 0.15, gX = long ? 0.035 : 0.06, capR = altoH(ctx, f100) / 100;
        const acc = rows.slice(1).some((r) => /[ÁÉÍÓÚÑÜ¡]/.test(r)), gY = acc ? 0.3 : 0.16, top0 = /[ÁÉÍÓÚÑÜ¡]/.test(rows[0]) ? 0.2 : 0.04;
        const rowW = (r) => [...r].reduce((a, c) => a + (c === " " ? 0.3 : g.measure(c, f100) / 100 + 2 * pX), 0) + gX * ([...r].length - 1) + (o.indent || 0);
        const hU = top0 + rows.length * (capR + 2 * pY) + (rows.length - 1) * gY + 0.06, wU = Math.max(...rows.map(rowW));
        const s = Math.min(o.max || 300, maxW / wU, maxH / hU);
        if (o.dry) return { s, w: wU * s, h: hU * s };
        if (o.right) x -= wU * s;
        const font = F("Archivo Black", s), cols = th.tiles; let prev = -1, base = yTop + s * (top0 + pY + capR), right = x;
        rows.forEach((row, ri) => {
          let px = x + (ri % 2 ? (o.indent || 0) * s : 0);
          for (const c of row) {
            if (c === " ") { px += 0.3 * s; continue; }
            ctx.font = font; const m = ctx.measureText(c), lw = m.width, asc = Math.max(m.actualBoundingBoxAscent, capR * s), dsc = Math.max(0, m.actualBoundingBoxDescent);
            const w = lw + 2 * pX * s, t = base - asc - pY * s, b = base + dsc + pY * s, h = b - t;
            let k = Math.floor(R() * cols.length); if (k === prev) k = (k + 1) % cols.length; prev = k;
            const col = cols[k], j = () => (R() - 0.5) * s * 0.05;
            ctx.save(); ctx.translate(px + w / 2, t + h / 2); ctx.rotate((R() - 0.5) * 0.12);
            ctx.save(); ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5; ctx.shadowOffsetX = 2;
            ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-w / 2 + j(), -h / 2 + j()); ctx.lineTo(w / 2 + j(), -h / 2 + j()); ctx.lineTo(w / 2 + j(), h / 2 + j()); ctx.lineTo(-w / 2 + j(), h / 2 + j()); ctx.closePath(); ctx.fill(); ctx.restore();
            const lc = g.lum(col) > 0.55 ? th.ink : th.tiles[0];
            g.text(c, -lw / 2, base - (t + h / 2), { font, color: g.lum(col) > 0.55 && g.lum(th.ink) > 0.5 ? "#1a1a1a" : lc });
            ctx.restore();
            px += w + gX * s; right = Math.max(right, px);
          }
          if (ri < rows.length - 1) base += s * (capR + 2 * pY + gY);
        });
        return { bottom: base + pY * s, right, s, w: wU * s, h: hU * s };
      };
      // con foto: una copia en duotono pegada con cinta, en un sitio fijo y bien grande
      const foto = (x, y, w, h, rot) => {
        ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot); ctx.translate(-w / 2, -h / 2);
        ctx.save(); ctx.shadowColor = "rgba(0,0,0,.32)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 7; ctx.fillStyle = "#fbf8f1"; ctx.fillRect(0, 0, w, h); ctx.restore();
        duoFoto(g, 16, 16, w - 32, h - 32, g.mix(dark ? th.bg : th.ink, "#000000", 0.2), g.mix(th.tiles[0], th.bg, 0.15));
        ctx.restore();
        g.tape(x + 70, y + 6, 150, -0.32); g.tape(x + w - 70, y + 6, 150, 0.3);
        return y + h;
      };
      // el logo: sobre una ficha clara si el fondo es oscuro (el logo blanco es solo la cruz)
      const logo = (x, y, h, align) => {
        if (!dark) { g.logo(x, y, h, { align }); return; }
        const lw = (g.assets.logo && g.assets.logo.width ? g.assets.logo.width / g.assets.logo.height : 2.3) * h, x0 = align === "right" ? x - lw : x;
        ctx.save(); ctx.translate(x0 + lw / 2, y + h / 2); ctx.rotate(-0.03); ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
        ctx.fillStyle = th.tiles[0]; ctx.fillRect(-lw / 2 - 16, -h / 2 - 12, lw + 32, h + 24); ctx.restore();
        g.logo(x0, y, h, { align: "left" });
      };
      const label = (s, x, y, o = {}) => g.text(String(s).toUpperCase(), x, y, { font: F("Hanken Grotesk", o.size || 20, 700), color: txt, sp: 4, align: o.align, alpha: o.alpha ?? 0.9 });
      const hand = (s, x, y, size, o = {}) => g.text(s, x, y, { font: F("Caveat", size, 700), color: o.color || txt, align: o.align, rotate: o.rotate ?? -0.03 });
      if (d.kind === "card") {
        if (d.kicker) label(d.kicker, M, 100);
        logo(W - M, 58, 58, "right");
        let y = 150;
        if (ph) y = foto(M - 6, 160, W - 2 * M + 12, 400, -0.02) + 40;
        // la palabra principal entera en una sola fila de fichas
        const word = ultima(d.headline).toUpperCase() + (/!\s*$/.test(d.headline) ? "!" : ""), lead = antes(d.headline);
        const lf = lead ? g.fit("¡" + lead, (s) => F("Caveat", s, 700), { maxW: W - 2 * M, maxLines: 1, start: ph ? 84 : 110, min: 56 }) : null;
        const fd = fichas([word], 0, 0, W - 2 * M, ph ? 190 : 300, { max: 260, dry: true });
        const nm = g.fit(d.name, (s) => F("Hanken Grotesk", s, 800), { maxW: W - 2 * M, maxLines: 2, start: ph ? 80 : 100, min: 42, lh: 1.06 });
        const ln = g.fit(d.line, (s) => F("Hanken Grotesk", s, 500), { maxW: W - 2 * M, maxLines: 2, start: 42, min: 32, lh: 1.25 });
        const g1 = ph ? 80 : 110, base = (lf ? lf.size * 0.9 : 0) + 10 + fd.h + g1 + nm.size * 0.4 + (nm.lines.length - 1) * nm.lh + 64 + ln.size * 0.8 + (ln.lines.length - 1) * ln.lh;
        // el versículo a mano, solo si cabe grande
        const room = H - 250 - y - base - 70;
        let vs = !ph && room > 110 ? g.fit(`«${d.verse}»`, (s) => F("Caveat", s, 500), { maxW: W - 2 * M - 120, maxLines: 3, start: 54, min: 42, lh: 1.12, maxH: room - 50 }) : null;
        if (vs && !cupo(vs, `«${d.verse}»`)) vs = null;
        // el bloque se reparte en el alto (no se amontona arriba)
        y += Math.max(0, H - 250 - y - base - (vs ? vs.h + 120 : 0)) * 0.55;
        if (lf) { hand("¡" + lead, M, y + lf.size * 0.75, lf.size); y += lf.size * 0.9; }
        const fx = fichas([word], M, y + 10, W - 2 * M, ph ? 190 : 300, { max: 260 });
        y = fx.bottom + g1;
        y = g.lines(nm.lines, M, y + nm.size * 0.4, nm.lh, { font: nm.font, color: txt }) + 64;
        y = g.lines(ln.lines, M, y + ln.size * 0.8, ln.lh, { font: ln.font, color: txt, alpha: 0.92 }) + 70;
        if (vs) { const vy = g.lines(vs.lines, M, y + vs.size * 0.5, vs.lh, { font: vs.font, color: txt }); label(d.ref, M, vy + 46, { size: 20 }); }
        hand(d.signature, M, H - 128, 62, { rotate: -0.02 });
        g.text(d.from, M, H - 86, { font: F("Hanken Grotesk", 23, 600), color: txt, alpha: 0.85 });
      } else if (d.kind === "ann") {
        label(d.church, M, 100);
        let hTop = 150;
        if (ph) hTop = foto(M - 6, 140, W - 2 * M + 12, 360, 0.018) + 44;
        // arriba a la derecha, la fecha en fichas; a la izquierda, mes, día de la semana y hora
        if (!d.date) { hand("¡Le invitamos!", M, hTop + 70, ph ? 80 : 96); hTop += ph ? 100 : 120; }
        const tilesW = d.date ? 520 : W - 2 * M, tilesH = ph ? 230 : d.date ? 400 : 300;
        const tf = fichas([d.date ? d.day : "¡VEN!"], W - M, hTop, tilesW, tilesH, { max: 400, dry: true });
        fichas([d.date ? d.day : "¡VEN!"], W - M, hTop, tilesW, tilesH, { max: 400, right: true });
        const lw = W - 2 * M - tf.w - 40;
        if (d.date) {
          const mf = g.fit(d.month, (s) => F("Caveat", s, 700), { maxW: lw, maxLines: 1, start: ph ? 96 : 120, min: 50 });
          hand(d.month, M, hTop + tf.h * 0.36, mf.size);
          const wf = g.fit(d.weekday.toUpperCase(), (s) => F("Hanken Grotesk", s, 800), { maxW: lw, maxLines: 1, start: 36, min: 24, sp: 3 });
          g.text(d.weekday.toUpperCase(), M, hTop + tf.h * 0.62, { font: wf.font, color: txt, sp: 3 });
          const tmf = g.fit(d.time, (s) => F("Hanken Grotesk", s, 800), { maxW: lw, maxLines: 1, start: 54, min: 30 });
          g.text(d.time, M, hTop + tf.h * 0.9, { font: tmf.font, color: txt });
        }
        const heroB = hTop + tf.h;
        // abajo: el título grande y el lugar como franja de pie; el logo en la esquina
        logo(W - M, H - 84 - 62, 62, "right");
        const pl = d.place ? g.fit(d.place, (s) => F("Hanken Grotesk", s, 600), { maxW: W - 2 * M - 260, maxLines: 2, start: 36, min: 28, lh: 1.25 }) : null;
        const plH = pl ? pl.h + 40 : 70, room = H - 110 - plH - (heroB + 90);
        const tt = g.fit(d.title, (s) => F("Hanken Grotesk", s, 800), { maxW: W - 2 * M, maxLines: 4, start: 160, min: 54, lh: 1.02, maxH: room });
        const extra = Math.max(0, room - tt.h - (pl ? 0 : 0));
        let y = heroB + 90 + extra * 0.8 + tt.size * 0.78;
        y = g.lines(tt.lines, M - 3, y, tt.lh, { font: tt.font, color: txt });
        if (pl) {
          y += 30 + pl.size * 1.1;
          ctx.save(); ctx.translate(M + 11, y - pl.size * 0.36); ctx.rotate(0.2); ctx.fillStyle = th.tiles[1]; ctx.fillRect(-11, -11, 22, 22); ctx.restore();
          g.lines(pl.lines, M + 44, y, pl.lh, { font: pl.font, color: txt });
        }
      } else {
        const top = story ? 250 : 100, bot = H - (story ? 300 : 84);
        label(d.eyebrow || d.church, M, top);
        let y = top + 30;
        if (ph) y = foto(M - 6, top + 34, W - 2 * M + 12, story ? 440 : square ? 260 : 300, -0.016) + 30;
        if (d.head) {
          const hf = g.fit(d.head, (s) => F("Caveat", s, 700), { maxW: W - 2 * M, maxLines: 2, start: story ? 110 : 96, min: 56, lh: 1 });
          y = g.lines(hf.lines, M, y + hf.size * 0.8, hf.lh, { font: hf.font, color: txt, rotate: -0.03 }) + hf.size * 0.3;
        }
        // una palabra clave del versículo en fichas, abajo, como remate
        const word = clave(d.text), fb = bot - (d.firma ? 64 : 0);
        const tmax = story ? 220 : square ? 130 : 170;
        const tf = fichas([word], M, 0, W - 2 * M, tmax * 1.4, { max: tmax, dry: true });
        fichas([word], M, fb - tf.h, W - 2 * M, tmax * 1.4, { max: tmax });
        const rfF = F("Hanken Grotesk", square ? 28 : 32, 800), a0 = y + 40, a1 = fb - tf.h - 60 - 50;
        const v = g.fit(d.text, (s) => F("Hanken Grotesk", s, 700), { maxW: W - 2 * M, maxLines: 14, start: story ? 100 : 104, min: 30, lh: 1.22, maxH: a1 - a0 });
        const vy = g.lines(v.lines, M, a0 + Math.max(0, a1 - a0 - v.h) * 0.45 + v.size * 0.85, v.lh, { font: v.font, color: txt });
        g.text("— " + d.ref.toUpperCase(), M, vy + 66, { font: rfF, color: txt, sp: 3, alpha: 0.9 });
        if (d.firma) label(d.church, M, bot, { size: 18 });
      }
    },
  });
})();
