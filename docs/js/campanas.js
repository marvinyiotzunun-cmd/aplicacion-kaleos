/* Kaleos: Campañas.
   El pastor escribe el tema, la descripción y las fechas de una campaña (p. ej. una Escuela Bíblica de Vacaciones)
   y Kaleos prepara la serie de diseños con la línea gráfica de La Línea: anuncio, invitación, cuenta regresiva,
   un diseño por cada día y el agradecimiento. Cada pieza tiene su fecha para compartir y su texto para WhatsApp.
   Kaleos no publica solo en Facebook (eso será «Kaleos: Redes»): el pastor descarga o comparte desde su teléfono. */
(function () {
  "use strict";
  const K = window.K, { esc, $, $$, ic } = K;

  // ===== identidad de La Línea (tomada de sus publicaciones de Facebook) =====
  const NAVY = "#14295A", NAVY_D = "#0A1838", BLUE = "#1C5BB4", BLUE_L = "#3F8AD9", GOLD = "#E3B43F", GOLD_L = "#F4D98F";
  const PAPER = "#F4F3F0", INK = "#16244A";
  const SCRIPT = '"Mr Dafoe", "Brush Script MT", cursive', SANS = K.SANS, SERIF = K.SERIF;

  const STYLES = {
    marco: { n: "Marco", s: "Papel claro con franja azul, como sus cumpleaños" },
    noche: { n: "Noche", s: "Foto o azul profundo con letras blancas y doradas" },
    occidente: { n: "Occidente", s: "Azul de la región con marco blanco" },
  };
  const FORMATS = { cuadrado: { n: "Cuadrado", s: "Chat y Facebook", w: 1080, h: 1080 }, estado: { n: "Estado", s: "Estado de WhatsApp", w: 1080, h: 1920 } };

  // Campañas modelo: llenan el formulario para que el pastor solo cambie fechas y detalles
  const PRESETS = {
    ebv: { n: "Escuela Bíblica de Vacaciones", title: "Escuela Bíblica de Vacaciones", days: 5, start_time: "14:00",
      description: "Una semana para que los niños conozcan a Jesús con historias bíblicas, cantos, manualidades y juegos.",
      audience: "Niños de 4 a 12 años", themes: ["Dios me creó", "Dios me cuida", "Jesús me ama", "Jesús me salva", "Vivo para Él"],
      verse: "Dejad a los niños venir a mí, y no se lo impidáis; porque de los tales es el reino de los cielos.", verse_ref: "Mateo 19:14" },
    evangelistica: { n: "Campaña evangelística", title: "Campaña Evangelística", days: 3, start_time: "19:00",
      description: "Noches de predicación y alabanza para invitar a familiares y vecinos a conocer a Cristo.", audience: "Toda la familia",
      themes: [], verse: "Porque no me avergüenzo del evangelio, porque es poder de Dios para salvación a todo aquel que cree.", verse_ref: "Romanos 1:16" },
    oracion: { n: "Semana de oración", title: "Semana de Oración y Clamor", days: 5, start_time: "19:00",
      description: "Un tiempo de oración y clamor como iglesia, de lunes a viernes.", audience: "Toda la iglesia", themes: [],
      verse: "Buscad a Jehová mientras puede ser hallado, llamadle en tanto que está cercano.", verse_ref: "Isaías 55:6" },
    aniversario: { n: "Aniversario", title: "Aniversario de la Iglesia", days: 1, start_time: "18:00",
      description: "Damos gracias a Dios por un año más de fidelidad en La Línea.", audience: "Toda la iglesia y visitas", themes: [],
      verse: "Grandes cosas ha hecho Jehová con nosotros; estaremos alegres.", verse_ref: "Salmos 126:3" },
    jovenes: { n: "Congreso de jóvenes", title: "Congreso de Jóvenes", days: 2, start_time: "18:00",
      description: "Dos días de alabanza, palabra y comunión para la juventud.", audience: "Jóvenes y adolescentes", themes: [],
      verse: "Ninguno tenga en poco tu juventud, sino sé ejemplo de los creyentes en palabra, conducta, amor, espíritu, fe y pureza.", verse_ref: "1 Timoteo 4:12" },
    misiones: { n: "Campaña misionera", title: "Campaña Misionera", days: 1, start_time: "10:00",
      description: "Oramos y ofrendamos por el proyecto misionero de nuestra iglesia.", audience: "Toda la iglesia", themes: [],
      verse: "Id por todo el mundo y predicad el evangelio a toda criatura.", verse_ref: "Marcos 16:15" },
  };

  // ===== fechas =====
  const diff = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 86400000);
  const dm = (d) => `${+d.slice(8)} de ${K.MONTHS[+d.slice(5, 7) - 1]}`;
  const range = (c) => {
    const s = c.starts_on, e = c.ends_on || s;
    if (s === e) return `${K.cap(K.weekdayOf(s))} ${dm(s)}`;
    if (s.slice(0, 7) === e.slice(0, 7)) return `Del ${+s.slice(8)} al ${+e.slice(8)} de ${K.MONTHS[+s.slice(5, 7) - 1]}`;
    return `Del ${dm(s)} al ${dm(e)}`;
  };
  const hora = (t) => {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
  };
  const FEM = /^(semana|escuela|campa|noche|vigilia|conferencia|jornada|cruzada|fiesta|celebraci|convenci|clausura|santa|cena|gran|reuni|feria|caminata|misi[oó]n|velada|tarde|ma[ñn]ana)/i;
  const withArt = (t) => (/^(el|la|los|las|nuestr)\s/i.test(t) ? t : (FEM.test(t) ? "la " : "el ") + t);

  // ===== la serie: qué se comparte y cuándo =====
  K.campPlan = (c) => {
    const s = c.starts_on, e = c.ends_on && c.ends_on >= s ? c.ends_on : s, from = c.created_on || K.today();
    const n = diff(s, e) + 1, out = [];
    const add = (key, date, kind, extra = {}) => out.push({ key, date, kind, ...extra });
    let last = null;
    const lead = diff(from, s);
    if (lead >= 2) { const d = lead > 21 ? K.addDays(s, -21) : from; add("anuncio", d, "anuncio"); last = d; }
    if (lead >= 10 && diff(last || from, K.addDays(s, -14)) >= 3) { const d = K.addDays(s, -14); add("invitacion", d, "invitacion"); last = d; }
    else if (lead >= 5 && !last) { add("invitacion", from, "invitacion"); last = from; }
    for (const k of [7, 3, 1]) {
      const d = K.addDays(s, -k);
      if (d >= from && (!last || diff(last, d) >= 2 || k === 1)) { add("faltan" + k, d, "cuenta", { n: k }); last = d; }
    }
    for (let i = 0; i < n; i++) add("dia" + (i + 1), K.addDays(s, i), "dia", { i, n });
    add("gracias", K.addDays(e, 1), "gracias");
    return out.map((p) => ({ ...p, name: pieceName(p) }));
  };
  const pieceName = (p) => p.kind === "anuncio" ? "Se viene" : p.kind === "invitacion" ? "Invitación" : p.kind === "cuenta" ? (p.n === 1 ? "Es mañana" : `Faltan ${p.n} días`)
    : p.kind === "dia" ? (p.n === 1 ? "Es hoy" : `Día ${p.i + 1}`) : "Gracias";

  // Texto de WhatsApp en el tono del pastor (sin firma, sin emojis, con llamado a la acción)
  const dot = (x) => (/[.!?»]$/.test(x) ? x : x + ".");
  K.campText = (c, p) => {
    const t = withArt(c.title), when = dot(range(c) + (c.start_time ? `, ${hora(c.start_time)}` : "")), place = c.place ? `\n${dot(c.place)}` : "";
    const at = c.start_time ? ` ${dot(K.cap(hora(c.start_time)))}` : "";
    const theme = p.kind === "dia" && (c.day_themes || [])[p.i];
    if (p.kind === "anuncio") return `¡Se viene ${t}!\n${c.description ? dot(c.description) + "\n" : ""}${when}${place}\nVayan apartando la fecha. ¡Les esperamos!`;
    if (p.kind === "invitacion") return `Cordialmente invitados a ${t}.\n${when}${place}${c.audience ? `\nPara: ${dot(c.audience)}` : ""}${c.contact ? `\n${dot(c.contact)}` : ""}\n¡Les esperamos!`;
    if (p.kind === "cuenta") return p.n === 1
      ? `¡Mañana comienza ${t}! Les esperamos${c.start_time ? " a las " + hora(c.start_time) : ""}${c.place ? " en " + c.place : ""}. Lleguemos temprano e invitemos a otros.`
      : `¡Faltan ${p.n} días para ${t}! ${when} Sigamos orando por esta actividad e invitemos a nuestras familias y vecinos.`;
    if (p.kind === "dia") return p.n === 1
      ? `¡Hoy es ${t}!${at}${place}\n¡Les esperamos!`
      : `Hoy, día ${p.i + 1} de ${t}${theme ? `: «${theme}»` : ""}.${at}${place}\n¡Les esperamos!`;
    return `¡Amada iglesia! ¡Muchas gracias! Terminamos ${t}. Que Dios les recompense a cada uno según la obra que realiza. Sigamos adelante.`;
  };

  // ===== dibujo =====
  const loadImg = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });
  let A = null;
  K.campReady = async () => {
    if (A) return A;
    try { await Promise.all([`800 80px ${SANS}`, `700 40px ${SANS}`, `500 30px ${SANS}`, `80px ${SCRIPT}`, `italic 600 40px ${SERIF}`].map((f) => document.fonts.load(f))); } catch (_) {}
    const logo = await loadImg("./img/logo.png");
    const w = document.createElement("canvas"); w.width = logo.naturalWidth; w.height = logo.naturalHeight;
    const x = w.getContext("2d"); x.drawImage(logo, 0, 0); x.globalCompositeOperation = "source-in"; x.fillStyle = "#fff"; x.fillRect(0, 0, w.width, w.height);
    return (A = { logo, logoW: w });
  };
  function rng(seed) { let s = seed >>> 0 || 7; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

  function spaced(ctx, text, x, y, sp) {
    const chars = [...text], w = chars.reduce((a, ch) => a + ctx.measureText(ch).width, 0) + sp * (chars.length - 1);
    let cx = x - w / 2; const al = ctx.textAlign; ctx.textAlign = "left";
    for (const ch of chars) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + sp; }
    ctx.textAlign = al;
  }
  // Letra gruesa «condensada» como la de MISIONES u OFICINA MÓVIL
  const SQ = 0.84;
  function fitCaps(ctx, text, size, maxW, maxLines, minSize) {
    const T = text.toUpperCase(), words = T.split(/\s+/);
    const width = (l) => ctx.measureText(l).width * SQ;
    // Una sola línea si cabe sin quedar muy chica
    for (let sz = size; sz >= Math.max(minSize, size * 0.72); sz -= 3) { ctx.font = `800 ${sz}px ${SANS}`; if (width(T) <= maxW) return { sz, lines: [T] }; }
    if (maxLines < 2 || words.length < 2) { for (let sz = size; sz >= minSize; sz -= 3) { ctx.font = `800 ${sz}px ${SANS}`; if (width(T) <= maxW) return { sz, lines: [T] }; } return { sz: minSize, lines: [T] }; }
    // Dos líneas parejas, sin dejar sola una palabra corta («DE»)
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const l = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
      if (l.some((x) => x.length <= 3)) continue;
      ctx.font = `800 ${size}px ${SANS}`;
      const w = Math.max(...l.map(width));
      if (!best || w < best.w) best = { w, l };
    }
    if (!best) { ctx.font = `800 ${size}px ${SANS}`; best = { l: K.wrap(ctx, T, maxW / SQ).slice(0, 2) }; }
    for (let sz = size; sz >= minSize; sz -= 3) { ctx.font = `800 ${sz}px ${SANS}`; if (best.l.every((x) => width(x) <= maxW)) return { sz, lines: best.l }; }
    return { sz: minSize, lines: best.l };
  }
  function wrapW(ctx, text, maxW) { return K.wrap(ctx, text, maxW); }
  function capsLine(ctx, l, x, y) { ctx.save(); ctx.translate(x, y); ctx.scale(SQ, 1); ctx.textAlign = "center"; ctx.fillText(l, 0, 0); ctx.restore(); }
  function fit(ctx, font, text, size, maxW, maxLines, minSize) {
    for (let sz = size; sz >= minSize; sz -= 2) { ctx.font = font(sz); const l = K.wrap(ctx, text, maxW); if (l.length <= maxLines && l.every((x) => ctx.measureText(x).width <= maxW)) return { sz, lines: l }; }
    ctx.font = font(minSize); return { sz: minSize, lines: K.wrap(ctx, text, maxW).slice(0, maxLines) };
  }
  function cover(ctx, img, x, y, w, h) {
    const r = Math.max(w / img.naturalWidth, h / img.naturalHeight), iw = img.naturalWidth * r, ih = img.naturalHeight * r;
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) * 0.4, iw, ih);
  }
  function logoAt(ctx, img, cx, y, h) { const w = (img.naturalWidth || img.width) * h / (img.naturalHeight || img.height); ctx.drawImage(img, cx - w / 2, y, w, h); return w; }
  const titleParts = (t) => {
    const w = String(t || "").trim().split(/\s+/);
    if (w.length >= 2 && w[w.length - 1].length >= 4) return { caps: w.slice(0, -1).join(" "), script: w[w.length - 1] };
    return { caps: w.join(" "), script: "" };
  };

  // Lo que dice cada pieza
  function content(c, p) {
    const tp = titleParts(c.title), theme = p.kind === "dia" ? (c.day_themes || [])[p.i] || "" : "";
    const whenDay = `${K.cap(K.weekdayOf(p.date))} ${dm(p.date)}${c.start_time ? " · " + hora(c.start_time) : ""}`;
    const base = { ...tp, where: c.place || "" };
    if (p.kind === "anuncio") return { ...base, eyebrow: "Se viene", when: range(c) + (c.start_time ? " · " + hora(c.start_time) : ""), sub: c.audience || "", verse: c.verse, ref: c.verse_ref };
    if (p.kind === "invitacion") return { ...base, eyebrow: "Cordialmente invitados", when: range(c) + (c.start_time ? " · " + hora(c.start_time) : ""), sub: c.audience || "", foot: c.contact || "" };
    if (p.kind === "cuenta") return { ...base, eyebrow: p.n === 1 ? "¡Es mañana!" : "Faltan", big: p.n === 1 ? "" : String(p.n), bigLabel: p.n === 1 ? "" : "días", when: range(c) + (c.start_time ? " · " + hora(c.start_time) : "") };
    if (p.kind === "dia") return { ...base, eyebrow: p.n === 1 ? "¡Es hoy!" : `Día ${p.i + 1} de ${p.n}`, theme, when: whenDay };
    return { ...base, eyebrow: "¡Muchas gracias!", theme: "Que Dios les recompense a cada uno según la obra que realiza.", when: "Sigamos adelante", where: "" };
  }

  // Pila de bloques centrada: mide, reparte el espacio y dibuja
  function stack(ctx, items, W, y0, y1) {
    const total = items.reduce((a, b) => a + b.h, 0), free = Math.max(0, y1 - y0 - total);
    const gap = Math.min(W * 0.045, free / (items.length + 1));
    let y = y0 + (free - gap * (items.length - 1)) / 2;
    for (const it of items) { it.draw(y); y += it.h + gap; }
  }

  // Bloques que comparten los tres estilos (los colores los pone cada estilo)
  function blocks(ctx, W, H, k, col, photo, frame, sc = 1) {
    const out = [], M = W * 0.84, tall = H > W * 1.2, U = W * sc;
    out.push({ h: U * 0.05, draw: (y) => { ctx.fillStyle = col.eyebrow; ctx.font = `700 ${Math.round(U * 0.03)}px ${SANS}`; ctx.textAlign = "center"; ctx.textBaseline = "top"; spaced(ctx, k.eyebrow.toUpperCase(), W / 2, y, U * 0.008); } });
    if (k.caps) {
      const f = fitCaps(ctx, k.caps, Math.round(U * (k.big || photo ? 0.085 : 0.11)), M, 2, Math.round(U * 0.05)), lh = f.sz * 0.98;
      out.push({ h: lh * f.lines.length, draw: (y) => { ctx.font = `800 ${f.sz}px ${SANS}`; ctx.fillStyle = col.caps; ctx.textBaseline = "top"; f.lines.forEach((l, i) => capsLine(ctx, l, W / 2, y + i * lh)); } });
    }
    if (k.script) {
      const f = fit(ctx, (s) => `${s}px ${SCRIPT}`, k.script, Math.round(U * (k.big || photo ? 0.12 : 0.16)), M, 1, Math.round(U * 0.07));
      out.push({ h: f.sz * 0.72, draw: (y) => { ctx.font = `${f.sz}px ${SCRIPT}`; ctx.fillStyle = col.script; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText(f.lines[0], W / 2, y + f.sz * 0.62); } });
    }
    if (k.big) {
      const sz = Math.round(U * (tall ? 0.42 : 0.3));
      out.push({ h: sz * 0.78 + U * 0.07, draw: (y) => {
        ctx.font = `800 ${sz}px ${SANS}`; ctx.fillStyle = col.big; ctx.textBaseline = "alphabetic"; capsLine(ctx, k.big, W / 2, y + sz * 0.76);
        ctx.font = `${Math.round(U * 0.085)}px ${SCRIPT}`; ctx.fillStyle = col.script; ctx.textAlign = "center"; ctx.fillText(k.bigLabel, W / 2, y + sz * 0.78 + U * 0.06);
      } });
    } else if (photo) {
      const fw = tall ? U * 0.8 : U * 0.6, fh = tall ? fw * 1.05 : fw * 0.72;
      out.push({ h: fh, draw: (y) => frame(ctx, photo, W / 2 - fw / 2, y, fw, fh) });
    }
    if (k.theme) {
      const f = fit(ctx, (s) => `italic 600 ${s}px ${SERIF}`, `«${k.theme}»`, Math.round(U * 0.062), M * 0.92, 3, Math.round(U * 0.038)), lh = f.sz * 1.12;
      out.push({ h: lh * f.lines.length, draw: (y) => { ctx.font = `italic 600 ${f.sz}px ${SERIF}`; ctx.fillStyle = col.theme; ctx.textAlign = "center"; ctx.textBaseline = "top"; f.lines.forEach((l, i) => ctx.fillText(l, W / 2, y + i * lh)); } });
    }
    const info = [k.when && [k.when, `700 ${Math.round(U * 0.04)}px ${SANS}`, col.when], k.where && [k.where, `500 ${Math.round(U * 0.032)}px ${SANS}`, col.where],
      k.sub && [k.sub, `500 ${Math.round(U * 0.03)}px ${SANS}`, col.where], k.foot && [k.foot, `600 ${Math.round(U * 0.028)}px ${SANS}`, col.when]].filter(Boolean);
    if (info.length) {
      const sizes = info.map(([, f]) => parseInt(f.split(" ")[1], 10) * 1.35);
      out.push({ h: sizes.reduce((a, b) => a + b, 0), draw: (y) => { ctx.textAlign = "center"; ctx.textBaseline = "top"; let yy = y; info.forEach(([t, f, c], i) => { ctx.font = f; ctx.fillStyle = c; const l = K.wrap(ctx, t, M)[0]; ctx.fillText(l, W / 2, yy); yy += sizes[i]; }); } });
    }
    if (k.verse && (tall || !photo)) {
      const f = fit(ctx, (s) => `italic 500 ${s}px ${SERIF}`, `«${k.verse}»`, Math.round(U * 0.034), M * 0.86, 3, Math.round(U * 0.026)), lh = f.sz * 1.2;
      out.push({ h: lh * f.lines.length + f.sz * 1.3, draw: (y) => { ctx.font = `italic 500 ${f.sz}px ${SERIF}`; ctx.fillStyle = col.where; ctx.textAlign = "center"; ctx.textBaseline = "top"; f.lines.forEach((l, i) => ctx.fillText(l, W / 2, y + i * lh)); ctx.font = `700 ${Math.round(f.sz * 0.8)}px ${SANS}`; ctx.fillStyle = col.eyebrow; ctx.fillText((k.ref || "").toUpperCase(), W / 2, y + lh * f.lines.length + f.sz * 0.3); } });
    }
    return out;
  }
  // Si no caben, primero se achica todo un poco; luego se quitan el versículo y los datos secundarios
  function fitStack(ctx, W, H, k, col, photo, frame, room) {
    const gapMin = W * 0.025, tot = (items) => items.reduce((a, b) => a + b.h, 0) + gapMin * (items.length - 1);
    const scales = H > W * 1.2 ? [1.25, 1.15, 1.05, 1, 0.92, 0.85] : [1, 0.92, 0.85, 0.78];
    const D = [[], ["verse"], ["verse", "foot", "sub"], ["verse", "foot", "sub", "where"]];
    for (const ph of [photo, null]) for (const sc of scales) for (const d of D) {
      const kk = { ...k }; d.forEach((x) => { kk[x] = ""; });
      const items = blocks(ctx, W, H, kk, col, ph, frame, sc); if (tot(items) <= room) return items;
    }
    const kk = { ...k, verse: "", foot: "", sub: "", where: "" };
    return blocks(ctx, W, H, kk, col, null, frame, scales[scales.length - 1]);
  }

  const DRAW = {
    // Papel claro, título manuscrito arriba, foto en marco y franja azul con el logo, como sus tarjetas de cumpleaños
    marco(ctx, W, H, k, a, photo, r) {
      ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(20,41,90,.05)"; ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) { ctx.beginPath(); let x = r() * W, y = -20; ctx.moveTo(x, y); while (y < H) { x += (r() - 0.5) * 90; y += 60 + r() * 80; ctx.lineTo(x, y); } ctx.stroke(); }
      const band = Math.round(H > W * 1.2 ? W * 0.19 : W * 0.15), top = W * 0.05;
      ctx.fillStyle = NAVY; ctx.fillRect(0, H - band, W, band);
      ctx.fillStyle = BLUE; for (let i = 0; i < 26; i++) { const x = r() * W, y = H - band + r() * band; ctx.globalAlpha = 0.25 + r() * 0.4; ctx.fillRect(x, y, 3 + r() * 5, 3 + r() * 5); } ctx.globalAlpha = 1;
      ctx.fillStyle = GOLD; ctx.fillRect(0, H - band, W, Math.max(4, W * 0.005));
      logoAt(ctx, a.logoW, W / 2, H - band + band * 0.18, band * 0.66);
      const col = { eyebrow: BLUE, caps: NAVY, script: BLUE, big: NAVY, theme: INK, when: BLUE, where: "#45506A" };
      const frame = (c, img, x, y, w, h) => { c.fillStyle = "#fff"; c.fillRect(x - 10, y - 10, w + 20, h + 20); c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); cover(c, img, x, y, w, h); c.restore(); c.strokeStyle = "rgba(20,41,90,.18)"; c.lineWidth = 2; c.strokeRect(x - 10, y - 10, w + 20, h + 20); };
      const room = H - band - top * 2;
      stack(ctx, fitStack(ctx, W, H, k, col, photo, frame, room), W, top, H - band - top);
    },
    // Foto a sangre (o azul profundo con franjas diagonales) con letras blancas y doradas, como «No se turbe» o su portada
    noche(ctx, W, H, k, a, photo, r) {
      if (photo) {
        cover(ctx, photo, 0, 0, W, H);
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgba(10,24,56,.55)"); g.addColorStop(0.45, "rgba(10,24,56,.35)"); g.addColorStop(1, "rgba(10,24,56,.92)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      } else {
        ctx.fillStyle = NAVY_D; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.globalAlpha = 0.5;
        const n = 5 + Math.floor(r() * 3);
        for (let i = 0; i < n; i++) { const x = W * (i / n) + r() * 40 - W * 0.15, w = W * (0.04 + r() * 0.08); ctx.fillStyle = i % 2 ? BLUE : NAVY; ctx.beginPath(); ctx.moveTo(x + W * 0.28, 0); ctx.lineTo(x + W * 0.28 + w, 0); ctx.lineTo(x + w, H); ctx.lineTo(x, H); ctx.fill(); }
        ctx.restore();
        ctx.fillStyle = "rgba(10,24,56,.45)"; ctx.fillRect(0, 0, W, H);
      }
      const head = W * 0.17;
      logoAt(ctx, a.logoW, W / 2, W * 0.05, W * 0.09);
      ctx.fillStyle = GOLD; ctx.fillRect(W / 2 - W * 0.05, W * 0.155, W * 0.1, 3);
      const col = { eyebrow: GOLD_L, caps: "#fff", script: GOLD, big: GOLD, theme: "#fff", when: "#fff", where: "rgba(255,255,255,.82)" };
      const foot = W * 0.07;
      const addr = (K.church && K.church.address) || "";
      if (addr) { ctx.font = `500 ${Math.round(W * 0.022)}px ${SANS}`; ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText(addr, W / 2, H - W * 0.035); }
      stack(ctx, fitStack(ctx, W, H, k, col, null, null, H - head - foot - W * 0.04), W, head, H - foot);
    },
    // Azul de la región con marco blanco y título grueso abajo, como «Oficina Móvil»
    occidente(ctx, W, H, k, a, photo, r) {
      ctx.fillStyle = BLUE; ctx.fillRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, H * 0.55, 0, H); g.addColorStop(0, "rgba(10,24,56,0)"); g.addColorStop(1, "rgba(10,24,56,.55)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.lineWidth = W * 0.05;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-W * 0.2 + i * W * 0.12, H); ctx.lineTo(W * 0.25 + i * W * 0.12, 0); ctx.stroke(); }
      logoAt(ctx, a.logoW, W / 2, W * 0.045, W * 0.085);
      const head = W * 0.16, M = W * 0.06;
      const col = { eyebrow: GOLD_L, caps: "#fff", script: GOLD_L, big: NAVY, theme: "#fff", when: GOLD_L, where: "rgba(255,255,255,.88)" };
      // Panel blanco: foto, número grande o tema; el título va abajo en blanco
      const panelH = photo || k.big || k.theme ? (H > W * 1.2 ? H * 0.4 : H * 0.34) : 0;
      let y = head + W * 0.02;
      ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = col.eyebrow; ctx.font = `700 ${Math.round(W * 0.03)}px ${SANS}`; spaced(ctx, k.eyebrow.toUpperCase(), W / 2, y, W * 0.008);
      y += W * 0.065;
      if (panelH) {
        const px = M, pw = W - M * 2;
        ctx.fillStyle = "#fff"; ctx.fillRect(px, y, pw, panelH);
        if (photo) { ctx.save(); ctx.beginPath(); ctx.rect(px + 12, y + 12, pw - 24, panelH - 24); ctx.clip(); cover(ctx, photo, px + 12, y + 12, pw - 24, panelH - 24); ctx.restore(); }
        else if (k.big) {
          const sz = Math.round(panelH * 0.66); ctx.font = `800 ${sz}px ${SANS}`; ctx.fillStyle = NAVY; ctx.textBaseline = "alphabetic"; capsLine(ctx, k.big, W / 2, y + panelH * 0.68);
          ctx.font = `${Math.round(panelH * 0.2)}px ${SCRIPT}`; ctx.fillStyle = BLUE; ctx.textAlign = "center"; ctx.fillText(k.bigLabel, W / 2, y + panelH * 0.9);
        } else {
          const f = fit(ctx, (s) => `italic 600 ${s}px ${SERIF}`, `«${k.theme}»`, Math.round(W * 0.075), pw * 0.8, 3, Math.round(W * 0.04)), lh = f.sz * 1.12;
          ctx.font = `italic 600 ${f.sz}px ${SERIF}`; ctx.fillStyle = NAVY; ctx.textBaseline = "top";
          const ty = y + (panelH - lh * f.lines.length) / 2; f.lines.forEach((l, i) => ctx.fillText(l, W / 2, ty + i * lh));
          ctx.fillStyle = GOLD; ctx.fillRect(W / 2 - 40, y + panelH - 34, 80, 4);
        }
        y += panelH + W * 0.05;
      }
      const rest = { ...k, eyebrow: "", big: "", theme: photo || k.big ? k.theme : "" };
      const items = fitStack(ctx, W, H, rest, col, null, null, H - y - W * 0.06).filter((_, i) => i > 0);
      stack(ctx, items, W, y, H - W * 0.05);
    },
  };

  K.campDraw = (cv, c, p, opt = {}) => {
    const f = FORMATS[opt.fmt || "cuadrado"], W = f.w, H = f.h;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, W, H);
    (DRAW[opt.style || c.style] || DRAW.marco)(ctx, W, H, content(c, p), A, opt.photo || null, rng(hash(c.title + p.key)));
  };

  // ===== datos: tabla kaleos_campaigns; mientras no exista, se guardan en este teléfono =====
  const LS = "kaleos-campanas";
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch (_) { return []; } };
  const lsSet = (v) => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch (_) {} };
  const missing = (e) => e && (/kaleos_campaigns/.test(e.message || "") || ["PGRST205", "42P01", "PGRST202"].includes(e.code));
  K.campLocal = false;
  K.campaigns = () => K.load("camps", async () => {
    const { data, error } = await K.sb.from("kaleos_campaigns").select("*").eq("church_id", K.me.church_id).order("starts_on", { ascending: false }).limit(50);
    if (error) { if (missing(error)) { K.campLocal = true; return lsGet(); } console.warn(error.message); return []; }
    K.campLocal = false; return data || [];
  });
  async function save(row, id) {
    if (!K.campLocal) {
      const q = id ? K.sb.from("kaleos_campaigns").update(row).eq("id", id) : K.sb.from("kaleos_campaigns").insert({ ...row, church_id: K.me.church_id, created_by: K.me.id });
      const { data, error } = await q.select().single();
      if (!error) { K.bust("camps"); return data; }
      if (!missing(error)) throw error;
      K.campLocal = true;
    }
    const all = lsGet();
    if (id) { const i = all.findIndex((x) => String(x.id) === String(id)); if (i >= 0) all[i] = { ...all[i], ...row }; lsSet(all); K.bust("camps"); return all[i]; }
    const nw = { ...row, id: "l" + Date.now(), shared: {}, created_on: row.created_on || K.today() };
    all.unshift(nw); lsSet(all); K.bust("camps"); return nw;
  }
  async function remove(id) {
    if (!K.campLocal) { const { error } = await K.sb.from("kaleos_campaigns").delete().eq("id", id); if (error) throw error; }
    else lsSet(lsGet().filter((x) => String(x.id) !== String(id)));
    K.bust("camps"); dropPhoto(id);
  }
  async function markShared(c, key) {
    const shared = { ...(c.shared || {}), [key]: new Date().toISOString() };
    c.shared = shared;
    try { await save({ shared }, c.id); } catch (e) { K.toast(K.errMsg(e)); }
  }

  // Foto de la campaña: se guarda reducida en este teléfono (no se sube a la nube)
  const PH = (id) => "kaleos-camp-foto-" + id, photos = new Map();
  const dropPhoto = (id) => { photos.delete(String(id)); try { localStorage.removeItem(PH(id)); } catch (_) {} };
  async function photoOf(id) {
    if (photos.has(String(id))) return photos.get(String(id));
    let src = null; try { src = localStorage.getItem(PH(id)); } catch (_) {}
    const img = src ? await loadImg(src).catch(() => null) : null;
    photos.set(String(id), img); return img;
  }
  async function readPhoto(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImg(url), s = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement("canvas"); cv.width = Math.round(img.naturalWidth * s); cv.height = Math.round(img.naturalHeight * s);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      const data = cv.toDataURL("image/jpeg", 0.82);
      return { data, img: await loadImg(data) };
    } finally { URL.revokeObjectURL(url); }
  }
  function keepPhoto(id, ph) {
    if (!ph) return;
    photos.set(String(id), ph.img);
    try { localStorage.setItem(PH(id), ph.data); } catch (_) { K.toast("La foto es muy grande para guardarla en este teléfono; se usará solo ahora."); }
  }

  // Piezas que tocan un día (para la Agenda)
  K.campDue = async (day) => {
    const cs = await K.campaigns();
    return cs.flatMap((c) => K.campPlan(c).filter((p) => p.date === day).map((p) => ({ c, p, done: !!(c.shared || {})[p.key] })));
  };

  // ===== pantalla =====
  const S = (K.campState = { open: null, fmt: "cuadrado" });
  const status = (c, p) => (c.shared || {})[p.key] ? ["Compartido", "ok"] : p.date === K.today() ? ["Hoy", "warn"] : p.date < K.today() ? ["Pasó", ""] : [K.cap(K.weekdayOf(p.date)).slice(0, 3) + " " + K.fmtDate(p.date, "ds"), ""];

  K.viewCampanas = async (el) => {
    try { await K.campReady(); } catch (_) {}
    const cs = await K.campaigns();
    const c = S.open && cs.find((x) => String(x.id) === String(S.open));
    if (c) return detail(el, c);
    S.open = null;
    const t = K.today();
    el.innerHTML = `<div class="sec-h"><h2>Campañas</h2><button class="btn sm gold" id="newc">${ic("plus", "xs")}Nueva campaña</button></div>
      <p class="muted" style="margin:4px 0 14px">Escriba el tema y las fechas; Kaleos prepara los diseños con la línea gráfica de La Línea para compartir antes, durante y después.</p>
      ${K.campLocal ? `<p class="fine" style="margin-bottom:10px">Por ahora las campañas se guardan solo en este teléfono, hasta que se aplique el cambio en la base de datos.</p>` : ""}
      <div id="cl">${cs.length ? cs.map((x) => {
        const plan = K.campPlan(x), done = plan.filter((p) => (x.shared || {})[p.key]).length, next = plan.find((p) => p.date >= t && !(x.shared || {})[p.key]);
        return `<button class="li" data-c="${x.id}"><canvas class="cthumb" data-th="${x.id}" width="1080" height="1080" aria-hidden="true"></canvas><span class="g"><b>${esc(x.title)}</b><span class="s">${esc(range(x))}</span><span class="s">${next ? (next.date === t ? "Hoy toca: " : "Próximo: ") + esc(next.name) + (next.date === t ? "" : " · " + K.fmtDate(next.date, "ds")) : "Campaña terminada"} · ${done} de ${plan.length} compartidos</span></span></button>`;
      }).join("") : `<div class="empty" style="text-align:left"><p>Todavía no hay campañas. Empiece con una de estas:</p></div>`}</div>
      <div class="eyebrow" style="margin:18px 0 8px">Empezar con un modelo</div>
      <div class="chips">${Object.entries(PRESETS).map(([k, v]) => `<button class="chip" data-pre="${k}">${esc(v.n)}</button>`).join("")}</div>
      <p class="fine" style="margin-top:16px">Kaleos no publica solo en Facebook: comparta por WhatsApp o descargue la imagen y súbala usted.</p>`;
    for (const x of cs) {
      const cv = $(`[data-th="${x.id}"]`, el); if (!cv) continue;
      const plan = K.campPlan(x), p = plan.find((q) => q.date >= t) || plan[plan.length - 1];
      K.campDraw(cv, x, p, { photo: await photoOf(x.id) });
    }
    K.on(el, "[data-c]", (b) => { S.open = b.dataset.c; K.mount(el, K.viewCampanas); });
    $("#newc", el).addEventListener("click", () => form(null, {}, (row) => { S.open = row.id; K.mount(el, K.viewCampanas); }));
    K.on(el, "[data-pre]", (b) => form(null, { preset: b.dataset.pre }, (row) => { S.open = row.id; K.mount(el, K.viewCampanas); }));
  };

  async function detail(el, c) {
    const plan = K.campPlan(c), photo = await photoOf(c.id), t = K.today();
    el.innerHTML = `<button class="cback" id="cb">${ic("back", "sm")}Campañas</button>
      <div class="sec-h" style="margin-top:8px"><div><span class="eyebrow">${esc(range(c))}${c.start_time ? " · " + esc(hora(c.start_time)) : ""}</span><h2 style="margin-top:4px">${esc(c.title)}</h2></div></div>
      ${c.description ? `<p class="muted" style="margin:6px 0 0">${esc(c.description)}</p>` : ""}
      <div class="field" style="margin-top:14px"><span class="flabel">Estilo</span><div class="seg" id="cst">${Object.entries(STYLES).map(([k, v]) => `<button type="button" data-st="${k}" aria-pressed="${(c.style || "marco") === k}">${v.n}</button>`).join("")}</div></div>
      <div class="field" style="margin-top:10px"><span class="flabel">Formato</span><div class="seg" id="cfm">${Object.entries(FORMATS).map(([k, v]) => `<button type="button" data-fm="${k}" aria-pressed="${S.fmt === k}">${v.n}</button>`).join("")}</div></div>
      <div class="cgrid" id="cg">${plan.map((p) => { const [l, cls] = status(c, p); return `<button class="cpiece" data-p="${p.key}"><canvas data-pc="${p.key}" aria-label="${esc(p.name)}" style="aspect-ratio:${S.fmt === "estado" ? "9/16" : "1/1"}"></canvas><span class="cn"><b>${esc(p.name)}</b><span class="pill ${cls}">${esc(l)}</span></span></button>`; }).join("")}</div>
      <div class="row" style="margin-top:16px;flex-wrap:wrap;gap:8px"><button class="btn sec sm" id="ced">${ic("editar", "xs")}Editar datos</button><button class="btn sec sm" id="call">Descargar todas</button><button class="btn sec sm" id="cdel">Borrar campaña</button></div>
      <p class="fine" style="margin-top:12px">Cada diseño trae su texto para WhatsApp. Para Facebook, descargue la imagen y súbala desde la página de la iglesia.</p>`;
    const style = c.style || "marco";
    for (const p of plan) { const cv = $(`[data-pc="${p.key}"]`, el); K.campDraw(cv, c, p, { fmt: S.fmt, style, photo }); }
    $("#cb", el).addEventListener("click", () => { S.open = null; K.mount(el, K.viewCampanas); });
    K.on(el, "[data-st]", async (b) => { try { await save({ style: b.dataset.st }, c.id); } catch (e) { return K.toast(K.errMsg(e)); } K.mount(el, K.viewCampanas); });
    K.on(el, "[data-fm]", (b) => { S.fmt = b.dataset.fm; K.mount(el, K.viewCampanas); });
    K.on(el, "[data-p]", (b) => pieceSheet(c, plan.find((p) => p.key === b.dataset.p), () => K.mount(el, K.viewCampanas)));
    $("#ced", el).addEventListener("click", () => form(c, {}, () => K.mount(el, K.viewCampanas)));
    $("#call", el).addEventListener("click", async () => {
      K.toast("Descargando las imágenes…");
      for (const p of plan) { const cv = document.createElement("canvas"); K.campDraw(cv, c, p, { fmt: S.fmt, style, photo }); await download(cv, fileName(c, p)); await new Promise((r) => setTimeout(r, 450)); }
    });
    $("#cdel", el).addEventListener("click", async () => {
      if (!confirm(`¿Borrar la campaña «${c.title}»? Los diseños ya compartidos no se borran de WhatsApp.`)) return;
      try { await remove(c.id); } catch (e) { return K.toast(K.errMsg(e)); }
      S.open = null; K.toast("Campaña borrada"); K.mount(el, K.viewCampanas);
    });
  }
  const fileName = (c, p) => `${String(c.title).normalize("NFD").replace(/[^\w ]/g, "").trim().replace(/\s+/g, "-").toLowerCase().slice(0, 40)}-${p.key}${S.fmt === "estado" ? "-estado" : ""}.png`;
  const download = (cv, name) => new Promise((ok) => cv.toBlob((b) => {
    if (b) { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
    ok();
  }, "image/png"));

  async function pieceSheet(c, p, after) {
    await K.campReady();
    const photo = await photoOf(c.id), [l] = status(c, p);
    K.sheet(`${K.head(p.name, `${c.title} · ${K.cap(K.weekdayOf(p.date))} ${K.fmtDate(p.date, "ds")}`)}
      <canvas class="gcard" id="pv" style="aspect-ratio:${S.fmt === "estado" ? "9/16" : "1/1"};max-height:62vh;width:auto;max-width:100%;margin:0 auto" aria-label="Vista previa"></canvas>
      <div class="field"><label for="pt">Texto para WhatsApp</label><textarea class="inp" id="pt" rows="6">${esc(K.campText(c, p))}</textarea></div>
      <button class="btn gold block" id="psh">${ic("send", "sm")}Compartir por WhatsApp</button>
      <div class="row" style="justify-content:center;gap:18px"><button class="linkbtn" id="pdl">Descargar la imagen</button>${(c.shared || {})[p.key] ? `<span class="fine">${esc(l)}</span>` : `<button class="linkbtn" id="pmk">Marcar como compartido</button>`}</div>`, (s, close) => {
      const cv = $("#pv", s);
      K.campDraw(cv, c, p, { fmt: S.fmt, style: c.style, photo });
      $("#psh", s).addEventListener("click", async () => { K.shareCanvas(cv, $("#pt", s).value, fileName(c, p)); await markShared(c, p.key); close(); if (after) after(); });
      $("#pdl", s).addEventListener("click", () => download(cv, fileName(c, p)));
      const mk = $("#pmk", s); if (mk) mk.addEventListener("click", async () => { await markShared(c, p.key); K.toast("Marcado como compartido"); close(); if (after) after(); });
    });
  }
  // Abre una pieza desde la Agenda o el asistente
  K.campOpen = async (id, key, after) => {
    const cs = await K.campaigns(), c = cs.find((x) => String(x.id) === String(id)); if (!c) return;
    const p = K.campPlan(c).find((x) => x.key === key); if (p) pieceSheet(c, p, after);
  };

  // ===== formulario =====
  function form(c, opt, after) {
    const pre = opt.preset ? PRESETS[opt.preset] : null;
    const t = K.today(), start = c ? c.starts_on : K.addDays(t, 28);
    const v = c || (pre ? { title: pre.title, description: pre.description, audience: pre.audience, start_time: pre.start_time, verse: pre.verse, verse_ref: pre.verse_ref,
      day_themes: pre.themes, starts_on: start, ends_on: K.addDays(start, pre.days - 1), style: "marco" } : { starts_on: start, ends_on: start, style: "marco" });
    let ph = null, style = v.style || "marco";
    K.drawer(`${K.head(c ? "Editar campaña" : "Nueva campaña", "Diseños para toda la campaña")}
      <canvas class="gcard" id="cpv" style="aspect-ratio:1/1" aria-label="Vista previa del anuncio"></canvas>
      ${c ? "" : `<div class="chips">${Object.entries(PRESETS).map(([k, x]) => `<button type="button" class="chip" data-pre="${k}" aria-pressed="${opt.preset === k}">${esc(x.n)}</button>`).join("")}</div>`}
      <div class="field"><label for="ct">Nombre de la campaña</label><input class="inp" id="ct" value="${esc(v.title || "")}" placeholder="Escuela Bíblica de Vacaciones"></div>
      <div class="field"><label for="cd">Descripción</label><textarea class="inp" id="cd" rows="3" placeholder="De qué se trata y por qué invitar">${esc(v.description || "")}</textarea></div>
      <div class="grid2"><div class="field"><label for="cs">Empieza</label><input class="inp" id="cs" type="date" value="${esc(v.starts_on || "")}"></div>
        <div class="field"><label for="ce">Termina</label><input class="inp" id="ce" type="date" value="${esc(v.ends_on || v.starts_on || "")}"></div></div>
      <div class="grid2"><div class="field"><label for="ch">Hora</label><input class="inp" id="ch" type="time" value="${esc(v.start_time || "")}"></div>
        <div class="field"><label for="cp">Lugar</label><input class="inp" id="cp" value="${esc(v.place || "")}" placeholder="Templo de La Línea"></div></div>
      <div class="field"><label for="ca">Para quién</label><input class="inp" id="ca" value="${esc(v.audience || "")}" placeholder="Niños de 4 a 12 años"></div>
      <div class="field"><label for="cc">Inscripciones o contacto (opcional)</label><input class="inp" id="cc" value="${esc(v.contact || "")}" placeholder="Inscripciones con la hermana Ana, 5555-5555"></div>
      <div class="field"><label for="cth">Tema de cada día (opcional, uno por línea)</label><textarea class="inp" id="cth" rows="4" placeholder="Día 1: Dios me creó…">${esc((v.day_themes || []).join("\n"))}</textarea></div>
      <div class="field"><label for="cv">Versículo (Reina-Valera 1960, opcional)</label><textarea class="inp" id="cv" rows="2">${esc(v.verse || "")}</textarea><input class="inp" id="cvr" value="${esc(v.verse_ref || "")}" placeholder="Mateo 19:14"></div>
      <div class="field"><span class="flabel">Foto (opcional)</span><input class="inp" id="cf" type="file" accept="image/*"><span class="fine">Use una foto real de la iglesia, sin niños en primer plano. Se guarda solo en este teléfono.</span></div>
      <div class="field"><span class="flabel">Estilo</span><div class="seg" id="cst">${Object.entries(STYLES).map(([k, x]) => `<button type="button" data-st="${k}" aria-pressed="${style === k}">${x.n}</button>`).join("")}</div><span class="fine" id="csd">${esc(STYLES[style].s)}</span></div>
      <div class="row" style="margin-top:auto"><button class="btn sec" style="flex:1" data-close>Cancelar</button><button class="btn gold" style="flex:2" id="csv">${c ? "Guardar" : "Crear los diseños"}</button></div>`, async (d, close) => {
      await K.campReady();
      const val = (id) => $("#" + id, d).value.trim();
      const row = () => {
        const s = val("cs"), e = val("ce") && val("ce") >= s ? val("ce") : s;
        return { title: val("ct"), description: val("cd") || null, starts_on: s, ends_on: e, start_time: val("ch") || null, place: val("cp") || null, audience: val("ca") || null,
          contact: val("cc") || null, day_themes: val("cth").split("\n").map((x) => x.replace(/^\s*d[ií]a\s*\d+\s*[:.-]\s*/i, "").trim()).filter(Boolean),
          verse: val("cv") || null, verse_ref: val("cvr") || null, style };
      };
      const existing = c ? await photoOf(c.id) : null;
      let tm = 0;
      const prev = () => { clearTimeout(tm); tm = setTimeout(() => {
        const r = row(); if (!r.starts_on) return;
        const cc = { ...r, title: r.title || "Nombre de la campaña", created_on: c ? c.created_on : K.today() };
        const plan = K.campPlan(cc);
        K.campDraw($("#cpv", d), cc, plan[0], { style, photo: (ph && ph.img) || existing });
      }, 120); };
      ["ct", "cd", "cs", "ce", "ch", "cp", "ca", "cc", "cth", "cv", "cvr"].forEach((id) => $("#" + id, d).addEventListener("input", prev));
      K.on(d, "[data-st]", (b) => { style = b.dataset.st; $$("[data-st]", d).forEach((x) => x.setAttribute("aria-pressed", x === b)); $("#csd", d).textContent = STYLES[style].s; prev(); });
      K.on(d, "[data-pre]", (b) => { close(); form(null, { preset: b.dataset.pre }, after); });
      $("#cf", d).addEventListener("change", async (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; try { ph = await readPhoto(f); prev(); } catch (_) { K.toast("No se pudo leer la foto"); } });
      prev();
      $("#csv", d).addEventListener("click", async (e) => {
        const r = row();
        if (!r.title) return K.toast("Escriba el nombre de la campaña");
        if (!r.starts_on) return K.toast("Elija la fecha en que empieza");
        if (diff(r.starts_on, r.ends_on) > 30) return K.toast("Una campaña puede durar hasta 31 días");
        const btn = e.currentTarget; btn.disabled = true;
        let saved;
        try { saved = await save(c ? r : { ...r, created_on: r.starts_on < K.today() ? r.starts_on : K.today() }, c && c.id); } catch (err) { btn.disabled = false; return K.toast(K.errMsg(err), 4000); }
        keepPhoto(saved.id, ph);
        K.toast(c ? "Campaña guardada" : `Listo: ${K.campPlan(saved).length} diseños para compartir`);
        close(); if (after) after(saved);
      });
    });
  }
  K.campForm = form;
})();
