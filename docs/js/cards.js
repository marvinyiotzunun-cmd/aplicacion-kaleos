/* Kaleos: tarjetas de saludo en nombre del pastor (cumpleaños, aniversarios, fechas especiales)
   y el editor de anuncios con imagen generada (pastor y Secretaría). */
(function () {
  "use strict";
  const K = window.K, { esc, $, $$, ic } = K;

  // ===== ocasiones =====
  const OCCASIONS = (K.OCCASIONS = {
    cumple: { icon: "felicitacion", name: "Cumpleaños", tpl: "fiesta" },
    bautismo: { icon: "oracion", name: "Aniversario de bautismo", tpl: "marfil" },
    iglesia: { icon: "iglesia", name: "Aniversario en la iglesia", tpl: "noche" },
    bodas: { icon: "estrella", name: "Aniversario de bodas", tpl: "olivo" },
    especial: { icon: "estrella", name: "Fecha especial", tpl: "noche" },
  });
  // Reina-Valera 1960, versos cortos para que quepan en la tarjeta
  const GREET_VERSES = {
    cumple: [
      ["Jehová te bendiga, y te guarde; Jehová haga resplandecer su rostro sobre ti.", "Números 6:24-25"],
      ["Te dé conforme al deseo de tu corazón, y cumpla todo tu consejo.", "Salmos 20:4"],
      ["Este es el día que hizo Jehová; nos gozaremos y alegraremos en él.", "Salmos 118:24"],
      ["Enséñanos de tal modo a contar nuestros días, que traigamos al corazón sabiduría.", "Salmos 90:12"],
      ["Tú coronas el año con tus bienes, y tus nubes destilan grosura.", "Salmos 65:11"],
    ],
    bautismo: [
      ["De modo que si alguno está en Cristo, nueva criatura es; las cosas viejas pasaron; he aquí todas son hechas nuevas.", "2 Corintios 5:17"],
      ["Así también nosotros andemos en vida nueva.", "Romanos 6:4"],
      ["Con Cristo estoy juntamente crucificado, y ya no vivo yo, mas vive Cristo en mí.", "Gálatas 2:20"],
    ],
    iglesia: [
      ["Doy gracias a mi Dios siempre que me acuerdo de vosotros.", "Filipenses 1:3"],
      ["¡Mirad cuán bueno y cuán delicioso es habitar los hermanos juntos en armonía!", "Salmos 133:1"],
      ["Estando persuadido de esto, que el que comenzó en vosotros la buena obra, la perfeccionará.", "Filipenses 1:6"],
    ],
    bodas: [
      ["Y cordón de tres dobleces no se rompe pronto.", "Eclesiastés 4:12"],
      ["Todo lo sufre, todo lo cree, todo lo espera, todo lo soporta.", "1 Corintios 13:7"],
      ["Por tanto, lo que Dios juntó, no lo separe el hombre.", "Marcos 10:9"],
    ],
    especial: [
      ["Grandes cosas ha hecho Jehová con nosotros; estaremos alegres.", "Salmos 126:3"],
      ["Jehová te bendiga, y te guarde.", "Números 6:24"],
      ["Encomienda a Jehová tu camino, y confía en él; y él hará.", "Salmos 37:5"],
    ],
  };
  const whenLabel = (K.whenLabel = (d) => {
    const n = K.dayDiff(d, K.today());
    return n === 0 ? "hoy" : n === 1 ? "mañana" : n === -1 ? "ayer" : n > 0 ? `en ${n} días` : `hace ${-n} días`;
  });
  const yrs = (n) => `${n} ${n === 1 ? "año" : "años"}`;
  function hashStr(s) {
    let h = 2166136261;
    for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Fechas de los próximos días (y de los últimos 3, por si quedó alguno sin enviar)
  K.occasionsFor = (members, specials, from = -3, to = 14) => {
    const out = [], t = K.today();
    for (let i = from; i <= to; i++) {
      const d = K.addDays(t, i), md = d.slice(5), y = Number(d.slice(0, 4));
      for (const m of members) {
        if (!m.active || m.id === K.me.id) continue;
        if (m.birthday && String(m.birthday).slice(5, 10) === md) out.push({ kind: "cumple", key: "cumple", date: d, m });
        for (const [kind, f] of [["bautismo", "baptism_date"], ["iglesia", "member_since"], ["bodas", "wedding_date"]]) {
          const v = m[f] && String(m[f]);
          if (v && v.slice(5, 10) === md && y > Number(v.slice(0, 4))) out.push({ kind, key: kind, date: d, m, years: y - Number(v.slice(0, 4)) });
        }
      }
      for (const sp of specials) {
        const m = members.find((x) => x.id === sp.profile_id), v = String(sp.event_date);
        if (!m || !m.active) continue;
        if (sp.yearly ? v.slice(5, 10) === md && y >= Number(v.slice(0, 4)) : v === d)
          out.push({ kind: "especial", key: "especial:" + sp.id, date: d, m, label: sp.label, years: sp.yearly ? y - Number(v.slice(0, 4)) : 0 });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.m.full_name.localeCompare(b.m.full_name));
  };

  const greetSignature = (K.greetSignature = () => K.church.greeting_signature || `${K.me.title || "Pastor"} ${K.me.full_name}`);

  function cardText(o, vi = 0) {
    const n = o.years, short = K.churchShort();
    const T = {
      cumple: [K.fmtDate(o.date, "dm"), "¡Feliz cumpleaños!", "Damos gracias a Dios por su vida"],
      bautismo: ["Aniversario de bautismo", "Vida nueva", `${yrs(n)} de su bautismo`],
      iglesia: ["Aniversario en la iglesia", "¡Gracias!", `${yrs(n)} siendo parte de nuestra familia`],
      bodas: ["Aniversario de bodas", "¡Feliz aniversario!", `${yrs(n)} de matrimonio junto a su ${/^(Hna\.|Pastora)$/.test(o.m.title || "") ? "esposo" : "esposa"}`],
      especial: [o.label || "Fecha especial", "¡Felicidades!", n > 0 ? `${yrs(n)} de este día especial` : "Celebramos con usted este día"],
    }[o.kind];
    const vs = GREET_VERSES[o.kind], v = vs[(hashStr(o.m.id + o.date) + vi) % vs.length];
    return { kicker: T[0], headline: T[1], line: T[2], name: `${o.m.title ? o.m.title + " " : ""}${o.m.full_name}`,
      verse: v[0], ref: v[1], date: o.date, signature: greetSignature(), from: `y toda la familia de ${short}`,
      church: `Iglesia de Dios E.C. · ${short}`, seed: o.m.id + o.key + o.date };
  }
  function greetMessage(o) {
    const first = K.first(o.m.full_name), sig = greetSignature(), igl = K.churchShort(), n = o.years;
    return {
      cumple: `¡Feliz cumpleaños, ${first}! 🎂\n\nHoy damos gracias a Dios por su vida. Que el Señor le bendiga y le guarde en este nuevo año.\n\nCon cariño,\n${sig} y la familia de ${igl}`,
      bautismo: `¡Bendiciones, ${first}! 🕊️\n\nHoy se cumplen ${yrs(n)} de su bautismo. Damos gracias a Dios por su fidelidad y por la vida nueva que tiene en Cristo.\n\nCon cariño,\n${sig}`,
      iglesia: `${first}, hoy cumple ${yrs(n)} siendo parte de la familia de ${igl}. ⛪\n\nGracias por su fidelidad, su servicio y su cariño. Que Dios le siga bendiciendo.\n\nCon cariño,\n${sig}`,
      bodas: `¡Feliz aniversario de bodas, ${first}! 💍\n\nHoy celebramos ${yrs(n)} de matrimonio. Que el Señor siga siendo el centro de su hogar.\n\nCon cariño,\n${sig} y la familia de ${igl}`,
      especial: `¡Felicidades, ${first}! ⭐\n\nHoy celebramos con usted: ${o.label || "un día especial"}. Que Dios le bendiga grandemente.\n\nCon cariño,\n${sig}`,
    }[o.kind];
  }

  // ===== dibujo de la tarjeta (1080 × 1350, formato ideal para WhatsApp) =====
  const CW = 1080, CH = 1350;
  const GOLD = "#C9A55C", GOLD_L = "#E8D3A0", GOLD_D = "#A8843A";
  const SERIF = K.SERIF, SCRIPT = '"Mr Dafoe", "Brush Script MT", cursive', SANS = K.SANS;
  let assets = null;
  const loadImg = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });
  K.cardReady = async () => {
    if (assets) return assets;
    try { await Promise.all([`600 80px ${SERIF}`, `italic 500 40px ${SERIF}`, `80px ${SCRIPT}`, `700 30px ${SANS}`, `800 30px ${SANS}`].map((f) => document.fonts.load(f))); } catch (_) {}
    const [logo, markW] = await Promise.all(["./img/logo.png", "./img/mark-w.png"].map(loadImg));
    return (assets = { logo, markW });
  };
  function fitFont(ctx, text, font, size, maxW, maxLines, minSize) {
    for (let sz = size; sz > minSize; sz -= 4) {
      ctx.font = font(sz);
      const l = K.wrap(ctx, text, maxW);
      if (l.length <= maxLines && l.every((x) => ctx.measureText(x).width <= maxW)) return { size: sz, lines: l };
    }
    ctx.font = font(minSize);
    return { size: minSize, lines: K.wrap(ctx, text, maxW) };
  }
  // Texto con espaciado entre letras (no todos los navegadores tienen letterSpacing en canvas)
  function spaced(ctx, text, x, y, sp, align = "center") {
    const chars = [...text], w = chars.reduce((a, c) => a + ctx.measureText(c).width, 0) + sp * (chars.length - 1);
    let cx = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    const prev = ctx.textAlign; ctx.textAlign = "left";
    for (const c of chars) { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + sp; }
    ctx.textAlign = prev;
  }
  function diamond(ctx, x, y, r, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
  }
  const ruleCenter = (color) => (ctx, x, y) => {
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 170, y); ctx.lineTo(x - 22, y); ctx.moveTo(x + 22, y); ctx.lineTo(x + 170, y); ctx.stroke();
    diamond(ctx, x, y, 8, color);
  };
  const ruleLeft = (color) => (ctx, x, y) => {
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 170, y); ctx.stroke();
    diamond(ctx, x + 190, y, 8, color);
  };
  // Acomoda el texto: primero mide, luego lo centra en el espacio disponible
  function runFlow(ctx, c, o, dry, y0) {
    const put = (t, x, y) => { if (!dry) ctx.fillText(t, x, y); };
    let y = y0;
    ctx.textAlign = o.align; ctx.textBaseline = "alphabetic";
    ctx.font = `700 25px ${SANS}`; ctx.fillStyle = o.kicker;
    y += 25; if (!dry) spaced(ctx, c.kicker.toUpperCase(), o.x, y, 7, o.align);
    const h = fitFont(ctx, c.headline, (sz) => `${sz}px ${SCRIPT}`, o.headSize || 132, o.maxW, 1, 76);
    ctx.font = `${h.size}px ${SCRIPT}`; ctx.fillStyle = o.head;
    y += h.size; put(h.lines[0], o.x, y);
    y += Math.round(h.size * 0.38) + 6; if (!dry && o.rule) o.rule(ctx, o.x, y); y += 22;
    const nm = fitFont(ctx, c.name, (sz) => `600 ${sz}px ${SERIF}`, 88, o.maxW, 2, 54);
    ctx.font = `600 ${nm.size}px ${SERIF}`; ctx.fillStyle = o.name;
    for (const l of nm.lines) { y += nm.size; put(l, o.x, y); }
    ctx.font = `italic 500 42px ${SERIF}`; ctx.fillStyle = o.line; y += 8;
    for (const l of K.wrap(ctx, c.line, o.maxW)) { y += 50; put(l, o.x, y); }
    y += 46;
    const vx = o.verseX ?? o.x, vTop = y;
    ctx.font = `italic 500 36px ${SERIF}`; ctx.fillStyle = o.verse;
    for (const l of K.wrap(ctx, `«${c.verse}»`, o.verseW || o.maxW)) { y += 46; put(l, vx, y); }
    y += 42; ctx.font = `700 19px ${SANS}`; ctx.fillStyle = o.ref;
    if (!dry) spaced(ctx, c.ref.toUpperCase(), vx, y, 5, o.align);
    if (!dry && o.bar) o.bar(ctx, vTop + 14, y + 6);
    return y - y0 + 6;
  }
  function composeText(ctx, c, o) {
    const h = runFlow(ctx, c, o, true, 0);
    runFlow(ctx, c, o, false, o.top + Math.max(0, (o.bottom - o.top - h) / 2));
  }
  function drawSig(ctx, c, x, align, col, sub, y = CH - 190) {
    ctx.textAlign = align; ctx.fillStyle = col;
    const f = fitFont(ctx, c.signature, (sz) => `${sz}px ${SCRIPT}`, 76, 780, 1, 44);
    ctx.font = `${f.size}px ${SCRIPT}`; ctx.fillText(c.signature, x, y);
    ctx.font = `700 18px ${SANS}`; ctx.fillStyle = sub;
    spaced(ctx, c.from.toUpperCase(), x, y + 50, 5, align);
  }
  function drawLogo(ctx, img, x, y, h, align = "center") {
    const w = (img.width * h) / img.height;
    ctx.drawImage(img, align === "center" ? x - w / 2 : x, y, w, h);
  }
  function archPath(ctx, x, y, w, h) {
    const r = w / 2;
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.arc(x + r, y + r, r, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath();
  }
  // Rama de olivo: tallo curvo con hojas alternadas
  function olive(ctx, R, p0, p1, p2, leaf, stem) {
    ctx.strokeStyle = stem; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]); ctx.stroke();
    let side = 1;
    for (let t = 0.1; t < 0.97; t += 0.075) {
      const u = 1 - t;
      const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
      const dx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]), dy = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
      const len = 78 - t * 34 + R() * 10;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(dy, dx) + side * (0.7 + R() * 0.15));
      ctx.beginPath(); ctx.ellipse(len / 2, 0, len / 2, len * 0.17, 0, 0, Math.PI * 2);
      ctx.fillStyle = R() < 0.22 ? "rgba(201,165,92,.75)" : leaf; ctx.fill(); ctx.restore();
      side = -side;
    }
  }

  const TEMPLATES = (K.TEMPLATES = {
    noche: { name: "Noche", draw(ctx, c, a) {
      const g = ctx.createRadialGradient(CW / 2, CH * 0.42, 80, CW / 2, CH / 2, CH * 0.78);
      g.addColorStop(0, "#2A3866"); g.addColorStop(1, "#121831");
      ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
      ctx.save(); ctx.globalAlpha = 0.05; ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.moveTo(CW * 0.58, 0); ctx.lineTo(CW * 0.7, 0); ctx.lineTo(CW * 0.2, CH); ctx.lineTo(CW * 0.08, CH); ctx.fill(); ctx.restore();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.strokeRect(54, 54, CW - 108, CH - 108);
      ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5; ctx.strokeRect(72, 72, CW - 144, CH - 144); ctx.globalAlpha = 1;
      for (const [x, y] of [[54, 54], [CW - 54, 54], [54, CH - 54], [CW - 54, CH - 54]]) diamond(ctx, x, y, 13, GOLD);
      drawLogo(ctx, a.markW, CW / 2, 118, 104);
      ctx.font = `700 20px ${SANS}`; ctx.fillStyle = GOLD_L; spaced(ctx, c.church.toUpperCase(), CW / 2, 262, 6);
      composeText(ctx, c, { x: CW / 2, align: "center", maxW: 860, verseW: 780, top: 300, bottom: 1085,
        kicker: GOLD, head: "#fff", name: "#fff", line: "rgba(255,255,255,.82)", verse: GOLD_L, ref: GOLD, rule: ruleCenter(GOLD) });
      drawSig(ctx, c, CW / 2, "center", "#fff", GOLD_L);
    } },
    marfil: { name: "Marfil", draw(ctx, c, a, R) {
      ctx.fillStyle = "#F3EDE1"; ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = "rgba(120,96,50,.06)";
      for (let i = 0; i < 1600; i++) ctx.fillRect(R() * CW, R() * CH, 1.8, 1.8);
      const ax = 96, ay = 90, aw = CW - 192, ah = CH - 180;
      ctx.save(); ctx.shadowColor = "rgba(30,39,71,.16)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 14;
      archPath(ctx, ax, ay, aw, ah); ctx.fillStyle = "#FFFDF8"; ctx.fill(); ctx.restore();
      ctx.save(); archPath(ctx, ax, ay, aw, ah); ctx.clip();
      ctx.strokeStyle = "rgba(30,38,80,.07)"; ctx.lineWidth = 2;
      const rays = 30 + Math.floor(R() * 8);
      for (let k = 0; k <= rays; k++) {
        const ang = Math.PI * (0.08 + (0.84 * k) / rays);
        ctx.beginPath(); ctx.moveTo(CW / 2, ay - 60); ctx.lineTo(CW / 2 + Math.cos(ang) * 1800, ay - 60 + Math.sin(ang) * 1800); ctx.stroke();
      }
      ctx.restore();
      archPath(ctx, ax, ay, aw, ah); ctx.strokeStyle = "#1E2650"; ctx.lineWidth = 3; ctx.stroke();
      archPath(ctx, ax + 18, ay + 18, aw - 36, ah - 36); ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5; ctx.stroke();
      drawLogo(ctx, a.logo, CW / 2, 175, 92);
      composeText(ctx, c, { x: CW / 2, align: "center", maxW: 720, verseW: 690, top: 300, bottom: 1060,
        kicker: GOLD_D, head: "#1E2650", name: "#1E2747", line: "#5E6782", verse: "#3E4A7A", ref: GOLD_D, rule: ruleCenter(GOLD) });
      drawSig(ctx, c, CW / 2, "center", "#1E2747", GOLD_D, CH - 210);
    } },
    fiesta: { name: "Fiesta", draw(ctx, c, a, R) {
      const g = ctx.createLinearGradient(0, 0, CW, CH);
      g.addColorStop(0, "#85304A"); g.addColorStop(0.5, "#4B2A55"); g.addColorStop(1, "#1E2650");
      ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = "rgba(255,255,255,.07)";
      for (const [a0, a1] of [[0.48, 0.56], [0.74, 0.77]]) {
        ctx.beginPath(); ctx.moveTo(CW * a0 + 300, 0); ctx.lineTo(CW * a1 + 300, 0); ctx.lineTo(CW * a1 - 500, CH); ctx.lineTo(CW * a0 - 500, CH); ctx.fill();
      }
      const cols = [GOLD, GOLD_L, "#fff", "#EEB08A"];
      for (let i = 0; i < 110; i++) {
        const top = R() < 0.55, x = R() * CW, y = top ? R() * 300 : CH - R() * 100;
        if (top && x > CW - 290 && y > 70 && y < 280) continue;
        ctx.save(); ctx.translate(x, y); ctx.rotate(R() * Math.PI); ctx.globalAlpha = 0.55 + R() * 0.45;
        ctx.fillStyle = cols[Math.floor(R() * cols.length)];
        const sz = 7 + R() * 14;
        if (R() < 0.35) { ctx.beginPath(); ctx.arc(0, 0, sz / 2.4, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(-sz / 2, -sz / 5, sz, sz / 2.5);
        ctx.restore();
      }
      drawLogo(ctx, a.markW, 110, 96, 96, "left");
      const [, mm, dd] = c.date.split("-").map(Number);
      ctx.beginPath(); ctx.arc(CW - 170, 172, 84, 0, Math.PI * 2); ctx.fillStyle = GOLD; ctx.fill();
      ctx.beginPath(); ctx.arc(CW - 170, 172, 72, 0, Math.PI * 2); ctx.strokeStyle = "rgba(30,39,71,.35)"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "#1E2747"; ctx.textAlign = "center"; ctx.font = `800 64px ${SANS}`; ctx.fillText(String(dd), CW - 170, 188);
      ctx.font = `700 18px ${SANS}`; spaced(ctx, K.MONTHS_S[mm - 1].toUpperCase(), CW - 170, 218, 4);
      composeText(ctx, c, { x: CW / 2, align: "center", maxW: 880, verseW: 800, top: 300, bottom: 1080, headSize: 150,
        kicker: GOLD_L, head: "#fff", name: "#fff", line: "rgba(255,255,255,.86)", verse: "#F6E3D2", ref: GOLD_L, rule: ruleCenter(GOLD_L) });
      drawSig(ctx, c, CW / 2, "center", "#fff", GOLD_L);
    } },
    olivo: { name: "Olivo", draw(ctx, c, a, R) {
      ctx.fillStyle = "#FBFAF6"; ctx.fillRect(0, 0, CW, CH);
      ctx.strokeStyle = "rgba(30,39,71,.10)"; ctx.lineWidth = 2; ctx.strokeRect(40, 40, CW - 80, CH - 80);
      olive(ctx, R, [CW + 30, 360], [CW - 110, 90], [CW - 440, 30], "rgba(126,145,112,.85)", "#7E9170");
      olive(ctx, R, [CW + 30, CH - 400], [CW - 60, CH - 90], [CW - 360, CH + 20], "rgba(126,145,112,.7)", "#7E9170");
      drawLogo(ctx, a.logo, 120, 100, 84, "left");
      const X = 120;
      composeText(ctx, c, { x: X, align: "left", maxW: 760, verseX: X + 34, verseW: 700, top: 260, bottom: 1080,
        kicker: GOLD_D, head: "#2F4A33", name: "#1E2747", line: "#5E6782", verse: "#3E5A44", ref: GOLD_D, rule: ruleLeft(GOLD),
        bar: (cx, y0, y1) => { cx.fillStyle = GOLD; cx.fillRect(X, y0 - 30, 4, y1 - y0 + 14); } });
      drawSig(ctx, c, X, "left", "#1E2747", GOLD_D);
    } },
  });
  K.renderCard = (canvas, tpl, c) => {
    canvas.width = CW; canvas.height = CH;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CW, CH);
    (TEMPLATES[tpl] || TEMPLATES.noche).draw(ctx, c, assets, rng(hashStr(c.seed)));
  };

  // Medio real para un hermano: su preferido si tiene el dato; si no, el que tenga; si no, solo Kaleos
  K.channelFor = (m) => {
    const has = { whatsapp: !!(m && m.phone), correo: !!(m && m.email), app: true }, pref = (m && m.preferred_channel) || "whatsapp";
    if (has[pref]) return pref;
    return has.whatsapp ? "whatsapp" : has.correo ? "correo" : "app";
  };
  function deliveryNote(to) {
    const ch = K.channelFor(to);
    return `Le llega a ${esc(K.first(to.full_name))} en su app de Kaleos` +
      (ch === "whatsapp" ? ` y por <b>WhatsApp</b> (${esc(to.phone)}).` : ch === "correo" ? ` y por <b>correo</b> (${esc(to.email)}).` : ".");
  }

  // Hoja de envío de una tarjeta a un hermano: vista previa, mensaje y un solo botón «Enviar»
  K.sendCard = async (opt) => {
    try { await K.cardReady(); } catch (_) { return K.toast("No se pudo preparar la tarjeta. Revise la conexión."); }
    let to = opt.to;
    const { data } = await K.sb.from("kaleos_profiles").select("*").eq("id", to.id).maybeSingle();
    if (data) to = data;
    let tpl = opt.tpl, vi = 0, file = null, edited = false;
    const slug = K.first(to.full_name).normalize("NFD").replace(/[^\w]/g, "").toLowerCase() || "kaleos", fname = `tarjeta-${slug}.png`;
    K.sheet(`${K.head(opt.title, opt.eyebrow)}
      <canvas class="gcard" aria-label="Vista previa de la tarjeta"></canvas>
      <div class="chips">${Object.entries(TEMPLATES).map(([k, t]) => `<button class="chip" data-tpl="${k}">${t.name}</button>`).join("")}
        <button class="chip" id="ov">${ic("versiculos")}Otro versículo</button></div>
      <div class="field"><label for="gm">Mensaje que acompaña la tarjeta</label><textarea class="inp" id="gm" rows="7"></textarea></div>
      ${opt.sent ? `<div class="result"><span class="dot">${ic("check", "sm")}</span><div>Ya se envió<span class="s">${new Date(opt.sent).toLocaleString("es-GT", { timeZone: K.TZ, dateStyle: "medium", timeStyle: "short" })}</span></div></div>` : ""}
      <button class="btn gold block" id="go">${ic("send", "sm")}Enviar</button>
      <p class="fine" id="how" style="text-align:center"></p>
      <button class="linkbtn" id="gd">Descargar la imagen</button>`, (s, close) => {
      const cv = $(".gcard", s), gm = $("#gm", s);
      const draw = () => {
        file = null;
        K.renderCard(cv, tpl, opt.card(vi));
        $$("[data-tpl]", s).forEach((b) => b.classList.toggle("on", b.dataset.tpl === tpl));
        cv.toBlob((b) => { if (b) file = new File([b], fname, { type: "image/png" }); }, "image/png");
        if (!edited) gm.value = opt.message();
        $("#how", s).innerHTML = deliveryNote(to);
      };
      const download = () => {
        if (!file) return K.toast("Un momento, la tarjeta se está preparando…");
        const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      };
      gm.addEventListener("input", () => { edited = true; });
      K.on(s, "[data-tpl]", (b) => { tpl = b.dataset.tpl; draw(); });
      $("#ov", s).addEventListener("click", () => { vi++; draw(); });
      $("#gd", s).addEventListener("click", download);
      $("#go", s).addEventListener("click", async (e) => {
        if (!file) return K.toast("Un momento, la tarjeta se está preparando…");
        const btn = e.currentTarget, text = gm.value;
        btn.disabled = true;
        // 1) Siempre queda en «Mis mensajes» del hermano
        const { error } = await K.sb.from("kaleos_messages").insert({ church_id: K.me.church_id, profile_id: to.id, kind: "felicitacion",
          title: opt.msgTitle, body: text, card: { tpl, c: opt.card(vi) }, created_by: K.me.id });
        if (error) { btn.disabled = false; return K.toast(K.errMsg(error), 4000); }
        // 2) Además, por el medio que el hermano prefiere
        const ch = K.channelFor(to);
        if (ch === "whatsapp") {
          if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text }); } catch (err) { if (err.name !== "AbortError") K.toast(K.errMsg(err), 4000); } }
          else { download(); K.waOpen(text, to.phone); }
        } else if (ch === "correo") {
          location.href = `mailto:${encodeURIComponent(to.email)}?subject=${encodeURIComponent(opt.msgTitle + " · " + K.churchShort())}&body=${encodeURIComponent(text + "\n\nVea la tarjeta en Kaleos: " + location.origin + location.pathname)}`;
        }
        if (opt.log) { try { await opt.log(tpl, text); } catch (err) { K.toast(K.errMsg(err), 4000); } }
        K.toast(`Enviado a ${K.first(to.full_name)}`);
        close(); if (opt.after) opt.after();
      });
      draw();
    });
  };

  K.greetSheet = (o, after) => K.sendCard({
    title: o.m.full_name, eyebrow: `${o.label || OCCASIONS[o.kind].name}${o.years ? " · " + yrs(o.years) : ""} · ${K.fmtDate(o.date, "dm")} (${whenLabel(o.date)})`,
    tpl: OCCASIONS[o.kind].tpl, to: o.m, sent: o.sent, after,
    card: (vi) => cardText(o, vi), message: () => greetMessage(o), msgTitle: o.label || OCCASIONS[o.kind].name,
    log: async (tpl, text) => {
      const { error } = await K.sb.from("kaleos_greetings").upsert({ church_id: K.me.church_id, profile_id: o.m.id, occasion: o.key,
        occasion_date: o.date, template: tpl, message: text, sent_by: K.me.id, sent_at: new Date().toISOString() }, { onConflict: "profile_id,occasion,occasion_date" });
      if (error) throw error;
    },
  });
  // Felicitar a alguien que cumple años (desde el asistente o la agenda)
  K.greetBirthday = (p, after) => {
    const md = String(p.birthday).slice(5, 10), t = K.today();
    let d = t.slice(0, 4) + "-" + md;
    if (K.dayDiff(d, t) < -3) d = Number(t.slice(0, 4)) + 1 + "-" + md;
    return K.greetSheet({ kind: "cumple", key: "cumple", date: d, m: p }, after);
  };

  function specialSheet(members, after) {
    const opts = members.filter((m) => m.active).map((m) => `<option value="${m.id}">${esc(m.full_name)}</option>`).join("");
    K.sheet(`${K.head("Fecha especial")}<div class="field"><label for="sm">Hermano</label><select class="inp" id="sm">${opts}</select></div>
      <div class="field"><label for="sl">¿Qué celebramos?</label><input class="inp" id="sl" list="sll" placeholder="Graduación, nacimiento de su bebé…">
        <datalist id="sll"><option value="Graduación"><option value="Nacimiento de su bebé"><option value="Quince años de su hija">
        <option value="Recuperación de su salud"><option value="Nuevo trabajo"><option value="Aniversario de su ministerio"></datalist></div>
      <div class="field"><label for="sd">Fecha</label><input class="inp" id="sd" type="date" value="${K.today()}"></div>
      <button class="toggle" role="switch" aria-checked="false" id="sy"><i></i>Se repite cada año</button>
      <button class="btn block" id="ss">Guardar</button>`, (s, close) => {
      $("#sy", s).addEventListener("click", (e) => e.currentTarget.setAttribute("aria-checked", e.currentTarget.getAttribute("aria-checked") !== "true"));
      $("#ss", s).addEventListener("click", async () => {
        const label = $("#sl", s).value.trim(), date = $("#sd", s).value;
        if (!label || !date) return K.toast("Escriba qué celebramos y la fecha");
        const { error } = await K.sb.from("kaleos_special_dates").insert({ church_id: K.me.church_id, profile_id: $("#sm", s).value,
          label, event_date: date, yearly: $("#sy", s).getAttribute("aria-checked") === "true", created_by: K.me.id });
        if (error) return K.toast(K.errMsg(error), 4000);
        K.toast("Fecha guardada"); close(); if (after) after();
      });
    });
  }

  // ===== vista Saludos (pastor) =====
  K.viewGreetings = async (el) => {
    const [members, sp, gr] = await Promise.all([
      K.people(),
      K.sb.from("kaleos_special_dates").select("*").eq("church_id", K.me.church_id),
      K.sb.from("kaleos_greetings").select("profile_id, occasion, occasion_date, sent_at").eq("church_id", K.me.church_id).gte("occasion_date", K.addDays(K.today(), -7)),
    ]);
    const sent = new Map((gr.data || []).map((g) => [`${g.profile_id}|${g.occasion}|${g.occasion_date}`, g.sent_at]));
    const list = K.occasionsFor(members, sp.data || []).map((o) => ({ ...o, sent: sent.get(`${o.m.id}|${o.key}|${o.date}`) }));
    const pending = list.filter((o) => !o.sent).length;
    const again = () => K.mount(el, K.viewGreetings);
    el.innerHTML = `<div class="sec-h"><h2>Saludos</h2>${pending ? `<span class="pill warn">${pending} por enviar</span>` : ""}</div>
      <p class="muted" style="margin-top:-14px">Tarjetas para cumpleaños y aniversarios de los próximos 14 días. Usted revisa cada una y la envía.</p>
      <div class="list">${list.length ? list.map((o, i) => `<button class="li" data-i="${i}">${ic(OCCASIONS[o.kind].icon)}<span class="g"><b>${esc(o.m.full_name)}</b>
          <span class="s">${esc(o.label || OCCASIONS[o.kind].name)}${o.years ? " · " + yrs(o.years) : ""} · ${K.fmtDate(o.date, "dm")} (${whenLabel(o.date)})</span></span>
          <span class="pill ${o.sent ? "ok" : ""}">${o.sent ? ic("check", "xs") + "Enviado" : "Preparar"}</span></button>`).join("")
        : '<p class="empty">No hay fechas en los próximos 14 días.</p>'}</div>
      <button class="btn sec block" id="addsp">${ic("plus", "sm")}Agregar fecha especial</button>
      <div class="field"><label for="sig">Firma al pie de cada tarjeta</label><div class="row"><input class="inp" id="sig" value="${esc(greetSignature())}"><button class="btn sec" id="ssig">Guardar</button></div></div>
      <p class="fine">Agregue el aniversario de bodas y la fecha de bautismo en la ficha de cada hermano.</p>`;
    K.on(el, "[data-i]", (b) => K.greetSheet(list[b.dataset.i], again));
    $("#addsp", el).addEventListener("click", () => specialSheet(members, again));
    $("#ssig", el).addEventListener("click", async () => {
      const v = $("#sig", el).value.trim() || null;
      const { data, error } = await K.sb.from("kaleos_churches").update({ greeting_signature: v }).eq("id", K.me.church_id).select().single();
      if (error) return K.toast(K.errMsg(error), 4000);
      K.church = data; K.toast("Firma guardada");
    });
  };

  // ===== mensaje guardado con tarjeta (en «Mis mensajes») =====
  K.drawMessageCard = async (cv, x) => {
    if (x.card) { await K.cardReady(); K.renderCard(cv, x.card.tpl, x.card.c); return true; }
    if (x.event_at || x.art) { K.drawAnn(cv, x); return true; }
    return false;
  };

  // ===== editor de anuncios (pastor y Secretaría) =====
  // Publica en Kaleos (toda la iglesia, una comunidad o ciertos niveles) y luego comparte la imagen por WhatsApp.
  K.annSheet = async (opt = {}) => {
    const p = opt.prefill || {};
    const comms = await K.communities();
    const pals = Object.keys(K.PAL), kinds = Object.keys(K.ART_KINDS);
    const st = { kind: p.kind || "invitacion", pal: p.pal || "oro", style: p.style || "luz", seed: 1 + Math.floor(Math.random() * 90),
      aud: p.community ? "c:" + (comms.find((c) => c.slug === p.community || c.id === p.community)?.id || "") : p.levels ? "lv" : "all",
      levels: p.levels || [] };
    if (st.aud === "c:") st.aud = "all";
    const when = p.when ? new Date(p.when) : null;
    const dDate = when ? when.toLocaleDateString("en-CA", { timeZone: K.TZ }) : "";
    const dTime = when ? when.toLocaleTimeString("en-GB", { timeZone: K.TZ, hour: "2-digit", minute: "2-digit" }) : "";
    const audOpts = () => [{ v: "all", l: "Toda la iglesia", icon: "iglesia" }, { v: "lv", l: "Ciertos niveles", icon: "camino" }, { sep: 1 },
      ...comms.map((c) => ({ v: "c:" + c.id, l: c.name, s: c.members + " integrantes", icon: c.emblem }))];
    const make = K.drawer;
    make(`${K.head(opt.title || "Nuevo aviso", "Kaleos y WhatsApp")}
      <canvas class="gcard" id="ap" aria-label="Vista previa del aviso"></canvas>
      <div class="field"><span class="flabel">Tipo</span><div class="seg" id="ak">${["invitacion", "recordatorio", "aviso"].map((k) => `<button type="button" data-k="${k}" aria-pressed="${st.kind === k}">${K.MSG_KINDS[k].n}</button>`).join("")}</div></div>
      <div class="field"><label for="at">Título</label><input class="inp" id="at" value="${esc(p.title || "")}" placeholder="Vigilia de oración, Santa Cena…"></div>
      <div class="grid2"><div class="field"><label for="ad">Fecha</label><input class="inp" id="ad" type="date" value="${dDate}"></div>
        <div class="field"><label for="ah">Hora</label><input class="inp" id="ah" type="time" value="${dTime}"></div></div>
      <div class="field"><label for="apl">Lugar</label><input class="inp" id="apl" value="${esc(p.place || "")}" placeholder="Templo central"></div>
      <div class="field"><span class="flabel">Para</span><div id="aud"></div><div class="chips" id="alv" ${st.aud === "lv" ? "" : "hidden"}>${K.LEVELS.map(([k, n]) => `<button type="button" class="chip" data-lv="${k}" aria-pressed="${st.levels.includes(k)}">${n}</button>`).join("")}</div></div>
      <div class="field"><label for="ab">Detalle</label><textarea class="inp" id="ab" placeholder="Lo que los hermanos deben saber">${esc(p.body || "")}</textarea></div>
      <div class="field"><span class="flabel">Imagen</span><div class="pals">${pals.map((x) => `<button type="button" class="pal" data-p="${x}" aria-pressed="${st.pal === x}" aria-label="${K.PAL_NAMES[x]}" style="background:linear-gradient(135deg,${K.PAL[x][0]},${K.PAL[x][1]} 60%,${K.PAL[x][2]})"></button>`).join("")}</div>
        <div class="seg" style="margin-top:8px">${kinds.map((k) => `<button type="button" data-s="${k}" aria-pressed="${st.style === k}">${K.ART_KINDS[k]}</button>`).join("")}</div></div>
      <div class="row" style="margin-top:auto"><button class="btn sec" style="flex:1" data-close>Cancelar</button><button class="btn gold" style="flex:2" id="apub">${ic("send", "sm")}Publicar y compartir</button></div>`, (d, close) => {
      const cv = $("#ap", d), val = (id) => $("#" + id, d).value.trim();
      const eventAt = () => (val("ad") ? K.gtISO(val("ad"), val("ah") || "00:00") : null);
      const obj = () => ({ id: 1, title: val("at") || K.MSG_KINDS[st.kind].n, event_at: eventAt(), place: val("apl"), art: { k: st.style, p: st.pal, s: st.seed } });
      let t = 0;
      const prev = () => { clearTimeout(t); t = setTimeout(() => K.drawAnn(cv, obj()), 120); };
      const drawAud = () => {
        $("#aud", d).innerHTML = K.dd("annAud", { icon: "avisos", options: audOpts, value: () => st.aud, pick: (v) => { st.aud = v; $("#alv", d).hidden = v !== "lv"; drawAud(); } });
      };
      drawAud();
      K.on(d, "[data-k]", (b) => { st.kind = b.dataset.k; $$("[data-k]", d).forEach((x) => x.setAttribute("aria-pressed", x === b)); });
      K.on(d, "[data-p]", (b) => { st.pal = b.dataset.p; $$("[data-p]", d).forEach((x) => x.setAttribute("aria-pressed", x === b)); prev(); });
      K.on(d, "[data-s]", (b) => { st.style = b.dataset.s; st.seed = 1 + Math.floor(Math.random() * 90); $$("[data-s]", d).forEach((x) => x.setAttribute("aria-pressed", x === b)); prev(); });
      K.on(d, "[data-lv]", (b) => { const k = b.dataset.lv; st.levels = st.levels.includes(k) ? st.levels.filter((x) => x !== k) : [...st.levels, k]; b.setAttribute("aria-pressed", st.levels.includes(k)); });
      ["at", "ad", "ah", "apl"].forEach((id) => $("#" + id, d).addEventListener("input", prev));
      prev();
      $("#apub", d).addEventListener("click", async (e) => {
        const o = obj();
        if (!val("at")) return K.toast("Escriba el título del aviso");
        if (st.aud === "lv" && !st.levels.length) return K.toast("Elija al menos un nivel");
        const comm = st.aud.startsWith("c:") ? comms.find((c) => String(c.id) === st.aud.slice(2)) : null;
        const btn = e.currentTarget; btn.disabled = true;
        const row = { church_id: K.me.church_id, profile_id: null, kind: st.kind, title: o.title, body: val("ab") || null, event_at: o.event_at,
          place: o.place || null, art: o.art, community_id: comm ? comm.id : null, levels: st.aud === "lv" ? st.levels : null, created_by: K.me.id };
        const { data, error } = await K.sb.from("kaleos_messages").insert(row).select().single();
        if (error) { btn.disabled = false; return K.toast(K.errMsg(error), 4000); }
        K.bust("anns", "msgs");
        K.drawAnn(cv, { ...data, id: data.id });
        const text = `${o.title}${o.event_at ? "\n🗓️ " + K.cap(K.fmtWhen(o.event_at)) : ""}${o.place ? "\n📍 " + o.place : ""}${row.body ? "\n\n" + row.body : ""}\n\n${K.churchShort()} · Iglesia de Dios E.C.`;
        K.toast(comm ? `Publicado para ${comm.name}` : "Publicado en Kaleos");
        close();
        K.shareCanvas(cv, text, "aviso-kaleos.png");
        if (opt.after) opt.after(data);
      });
    });
  };
})();
