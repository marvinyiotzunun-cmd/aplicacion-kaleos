/* Kaleos: el «cerebro» local del asistente del pastor.
   Entiende pedidos en español de Guatemala sin internet ni ChatGPT: fechas («el sábado a las 7»), horas, nombres de hermanos,
   comunidades, versículos por tema, las reuniones fijas de La Línea y las reglas de la iglesia.
   Devuelve una acción de la misma lista cerrada que usa ChatGPT: K.brain.understand(texto, { people, comms, today, nowMin }). */
(function () {
  "use strict";
  const K = window.K;

  // ===== texto =====
  const plain = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/(\d):(\d)/g, "$1#$2").replace(/[¿?¡!.,;:"«»()]/g, " ").replace(/#/g, ":").replace(/\s+/g, " ").trim();
  const has = (t, re) => re.test(t);
  const NUM = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30 };
  const num = (w) => (/^\d+$/.test(w) ? +w : NUM[w]);
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const MON3 = MONTHS.map((m) => m.slice(0, 3));
  const DOW = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  const dowOf = (d) => new Date(d + "T12:00:00Z").getUTCDay();

  // ===== fechas y horas =====
  // Devuelve { date, time, days, spans } — spans son los pedazos del texto que hablaban de la fecha (para quitarlos del título)
  function when(t, today) {
    const out = { date: null, time: null, days: null, spans: [] };
    const take = (re, fn) => { const m = t.match(re); if (m) { out.spans.push(m[0]); fn(m); } return !!m; };
    // fecha
    take(/\bpasado manana\b/, () => (out.date = K.addDays(today, 2))) ||
      take(/\b(?<!(?:la|de|en|esta|por) )manana\b(?! (?:en|por) la manana)/, () => (out.date = K.addDays(today, 1))) ||
      take(/\bhoy\b|\besta (?:noche|tarde)\b/, () => (out.date = today)) ||
      take(/\bayer\b/, () => (out.date = K.addDays(today, -1))) ||
      take(/\b(?:en|dentro de) (\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|diez|quince) (dias?|semanas?)\b/, (m) => (out.date = K.addDays(today, num(m[1]) * (m[2][0] === "s" ? 7 : 1)))) ||
      take(/\b(?:el |este |esta |para el |el proximo |proximo |el otro |la otra )?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)( que viene| proximo| de la otra semana| de la proxima semana)?\b/, (m) => {
        const w = DOW.indexOf(m[1]); let d = today;
        const later = /otro|otra|proxim|que viene/.test(m[0]) && !/^(el |)proximo/.test(m[0].trim()) ? 7 : 0;
        for (let i = 0; i < 8; i++) { if (dowOf(d) === w && (d !== today || /este|esta|hoy/.test(m[0]))) break; d = K.addDays(d, 1); }
        if (dowOf(d) !== w) d = K.addDays(today, 7);
        out.date = later && /otra semana|proxima semana|el otro|la otra/.test(m[0]) ? K.addDays(d, 7) : d;
      }) ||
      take(/\b(?:el |para el )?(\d{1,2}) (?:de )?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\b(?: (?:de |del )?(\d{4}))?/, (m) => {
        const mi = m[2] === "setiembre" ? 8 : m[2].length === 3 ? MON3.indexOf(m[2]) : MONTHS.indexOf(m[2]);
        let y = m[3] ? +m[3] : +today.slice(0, 4), d = `${y}-${String(mi + 1).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`;
        if (!m[3] && d < today) d = `${y + 1}${d.slice(4)}`;
        out.date = valid(d) ? d : null;
      }) ||
      take(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, (m) => {
        let y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : +today.slice(0, 4), d = `${y}-${String(+m[2]).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`;
        if (!m[3] && d < today) d = `${y + 1}${d.slice(4)}`;
        out.date = valid(d) ? d : null;
      }) ||
      take(/\b(?:el dia |el )(\d{1,2})\b(?! (?:de la|del|y|:|am|pm|a m|p m|horas?))/, (m) => {
        const n = +m[1]; if (n < 1 || n > 31) return;
        let d = `${today.slice(0, 8)}${String(n).padStart(2, "0")}`;
        if (d < today) { const y = +today.slice(0, 4), mo = +today.slice(5, 7); d = mo === 12 ? `${y + 1}-01-${String(n).padStart(2, "0")}` : `${y}-${String(mo + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`; }
        out.date = valid(d) ? d : null;
      });
    // rangos (para la agenda y los cumpleaños)
    if (/\b(esta semana|la semana|semana)\b/.test(t) && !out.date) { out.days = 7; out.spans.push("esta semana"); }
    if (/\b(este mes|el mes|del mes|mes)\b/.test(t) && !out.date) out.days = 31;
    if (/\b(proxima semana|siguiente semana|otra semana|semana que viene)\b/.test(t) && !out.date) { out.date = K.addDays(today, 7 - ((dowOf(today) + 6) % 7)); out.days = 7; }
    if (/\bfin de semana\b/.test(t) && !out.date) { let d = today; while (dowOf(d) !== 6) d = K.addDays(d, 1); out.date = d; out.days = 2; }
    // hora
    const part = /\b(?:de|en|por) la (manana|tarde|noche)\b|\b(madrugada)\b/.exec(t), pm = /\b(pm|p m|de la tarde|de la noche|en la tarde|en la noche|por la tarde|por la noche|esta noche|esta tarde)\b/.test(t), am = /\b(am|a m|de la manana|en la manana|por la manana|madrugada)\b/.test(t);
    let h = null, mi = 0, m;
    if ((m = t.match(/\b(\d{1,2}):(\d{2})\b/))) { h = +m[1]; mi = +m[2]; out.spans.push(m[0]); }
    else if ((m = t.match(/\b(?:a las|a la|las|para las|tipo|como a las|desde las)\s+(\d{1,2}|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?:\s+(y media|y cuarto|menos cuarto|y (\d{1,2})|en punto))?\b/))) {
      h = num(m[1]); mi = m[2] === "y media" ? 30 : m[2] === "y cuarto" ? 15 : m[2] === "menos cuarto" ? -15 : m[3] ? +m[3] : 0; out.spans.push(m[0]);
    } else if ((m = t.match(/\b(\d{1,2})\s?(am|pm|a m|p m)\b/))) { h = +m[1]; out.spans.push(m[0]); }
    else if (/\bmediodia\b/.test(t)) { h = 12; out.spans.push("mediodia"); }
    else if (/\bmedianoche\b/.test(t)) { h = 0; out.spans.push("medianoche"); }
    else if (part) h = { manana: 9, tarde: 15, noche: 19, madrugada: 5 }[part[1] || part[2]];
    if (h != null && h <= 24) {
      if (mi < 0) { h -= 1; mi = 60 + mi; }
      if (pm && h < 12) h += 12; else if (am && h === 12) h = 0;
      // sin «de la mañana/noche»: de 1 a 7 casi siempre es de la tarde o la noche (cultos, reuniones)
      else if (!pm && !am && h >= 1 && h <= 7 && !/:\d{2}/.test(out.spans.join(" "))) h += 12;
      out.time = `${String(h % 24).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
    }
    for (const w of ["de la manana", "en la manana", "por la manana", "de la tarde", "en la tarde", "por la tarde", "de la noche", "en la noche", "por la noche", "esta noche", "esta tarde", "pm", "am"]) if (new RegExp(`\\b${w}\\b`).test(t)) out.spans.push(w);
    return out;
  }
  const valid = (d) => { const x = new Date(d + "T12:00:00Z"); return !isNaN(x) && x.toISOString().slice(0, 10) === d; };
  // si solo dijo la hora y ya pasó hoy, es mañana
  const iso = (w, defTime, today, nowMin) => {
    if (!w.date && !w.time) return null;
    let d = w.date || today;
    if (!w.date && nowMin != null && +w.time.slice(0, 2) * 60 + +w.time.slice(3) <= nowMin) d = K.addDays(today, 1);
    return K.gtISO(d, w.time || defTime);
  };
  const BOOKS = "genesis|exodo|levitico|numeros|deuteronomio|josue|jueces|rut|1 samuel|2 samuel|1 reyes|2 reyes|1 cronicas|2 cronicas|esdras|nehemias|ester|job|salmos?|proverbios|eclesiastes|cantares|isaias|jeremias|lamentaciones|ezequiel|daniel|oseas|joel|amos|abdias|jonas|miqueas|nahum|habacuc|sofonias|hageo|zacarias|malaquias|mateo|marcos|lucas|juan|hechos|romanos|1 corintios|2 corintios|galatas|efesios|filipenses|colosenses|1 tesalonicenses|2 tesalonicenses|1 timoteo|2 timoteo|tito|filemon|hebreos|santiago|1 pedro|2 pedro|1 juan|2 juan|3 juan|judas|apocalipsis";
  const REF_RE = new RegExp(`(?:^|\\s)(${BOOKS}) \\d{1,3}(?:[ :]\\d{1,3})?(?:-\\d{1,3})?(?:\\s|$)`);

  // ===== hermanos, comunidades y versículos =====
  const STOP = new Set(["de", "del", "la", "las", "los", "el", "y", "a", "al", "en", "que", "para", "por", "con", "una", "un", "su", "sus", "mi", "hno", "hna", "hermano", "hermana", "pastor", "pastora", "joven", "don", "dona"]);
  function findPeople(t, people) {
    const words = new Set(t.split(" ").filter((w) => w.length > 2 && !STOP.has(w)));
    const scored = people.filter((p) => p.active !== false).map((p) => {
      const toks = plain(p.full_name).split(" ").filter((w) => w.length > 2 && !STOP.has(w));
      const hits = toks.filter((w) => words.has(w)).length;
      return { p, hits, first: words.has(toks[0]) };
    }).filter((x) => x.hits > 0);
    if (!scored.length) return [];
    const best = Math.max(...scored.map((x) => x.hits * 2 + (x.first ? 1 : 0)));
    let top = scored.filter((x) => x.hits * 2 + (x.first ? 1 : 0) === best).map((x) => x.p);
    // «hermana» o «hermano» desempata
    if (top.length > 1 && /\b(hermana|hna)\b/.test(t)) top = top.filter((p) => /^(Hna\.|Pastora)$/.test(p.title || "")).concat(top.filter((p) => !/^(Hna\.|Pastora)$/.test(p.title || ""))).slice(0, top.length);
    return top;
  }
  const ALIAS = {
    jovenes: ["joven", "jovenes", "juventud", "juvenil", "emergente", "muchachos", "patojos"],
    damas: ["dama", "damas", "mujeres", "femenil", "hermanas"],
    caballeros: ["caballero", "caballeros", "varones", "hombres"],
    ninos: ["nino", "ninos", "infantil", "ninez", "escuela dominical"],
    diaconos: ["diacono", "diaconos", "servidores"],
    alabanza: ["alabanza", "musica", "musicos", "coro", "danza", "adoracion"],
    plata: ["ancianos", "abuelitos", "cabellos de plata", "adultos mayores", "tercera edad"],
    misiones: ["misiones", "misioneros"],
    multimedia: ["multimedia", "sonido", "audio", "proyeccion"],
  };
  function findCommunity(t, comms) {
    for (const c of comms) {
      const n = plain(c.name), s = plain(c.slug), sub = plain(c.subtitle);
      if (t.includes(n) || new RegExp(`\\b${s}\\b`).test(t)) return c;
      const al = Object.entries(ALIAS).find(([k, ws]) => (s.includes(k) || n.includes(k) || ws.some((w) => n.includes(w) || sub.includes(w))) && ws.some((w) => new RegExp(`\\b(para|a|de|con) (los |las |la |el )?${w}\\b`).test(t)));
      if (al) return c;
    }
    return null;
  }
  const THEME_WORDS = { fe: ["fe", "creer"], paz: ["paz", "tranquilidad", "calma"], fortaleza: ["fuerza", "fortaleza", "fuerte", "valentia", "valiente"], animo: ["animo", "aliento", "animar", "miedo", "temor", "angustia", "afligido"], esperanza: ["esperanza", "futuro"], gratitud: ["gratitud", "gracias", "agradecimiento", "accion de gracias"], oracion: ["oracion", "orar", "clamor", "clamar"], familia: ["familia", "hogar", "matrimonio", "padres", "madres"], amor: ["amor"], ninos: ["ninos", "nino", "ninez"], misiones: ["misiones", "mision", "evangelismo", "evangelizar"], salvacion: ["salvacion", "salvo", "vida eterna", "resurreccion"], proteccion: ["proteccion", "cuidado", "refugio", "amparo"], palabra: ["biblia", "palabra", "escritura"], patria: ["patria", "nacion", "guatemala", "independencia"], confianza: ["confianza", "confiar", "fiar"] };
  function findVerse(t) {
    // por referencia: «juan 3 16», «salmo 23», «filipenses 4:13», «1 pedro 2 9»
    const tt = " " + t.replace(/\bsalmo\b/g, "salmos") + " ";
    let best = null;
    for (const [r, x] of K.VERSES) {
      const m = plain(r).match(/^(.*?) (\d+)(?:[ :](\d+))?/); if (!m) continue;
      const [, book, ch, ve] = m;
      if (!new RegExp(`\\b${book} ${ch}\\b`).test(tt)) continue;
      const exact = ve && new RegExp(`\\b${book} ${ch}[ :]${ve}\\b`).test(tt);
      if (!best || exact) best = { ref: r, text: x };
      if (exact) break;
    }
    if (best) return best;
    for (const [theme, ws] of Object.entries(THEME_WORDS)) if (ws.some((w) => new RegExp(`\\b${w}\\b`).test(t))) {
      const refs = K.VERSE_THEMES[theme] || [], r = refs[Math.floor(Math.random() * refs.length)], v = K.VERSES.find(([x]) => x === r);
      if (v) return { ref: v[0], text: v[1], tema: theme };
    }
    if (/\btema del mes\b|\bdel mes\b/.test(t) && K.temaDelMes) { const tm = K.temaDelMes(), v = tm && K.VERSES.find(([x]) => x === tm.ref); if (v) return { ref: v[0], text: v[1], tema: "mes" }; }
    return null;
  }
  const pickKey = (t, map) => { for (const [k, l] of Object.entries(map)) if (new RegExp(`\\b${plain(l)}\\b|\\b${k}\\b`).test(t)) return k; return null; };

  // ===== quitar lo que ya se entendió para quedarse con el título =====
  function titleFrom(raw, spans, extra = []) {
    let t = " " + plain(raw) + " ";
    for (const s of [...spans, ...extra].filter(Boolean).sort((a, b) => b.length - a.length)) t = t.replace(" " + plain(s) + " ", " ");
    t = t.replace(/^\s*(oye |kaleos |por favor |porfa |me |nos )*/, " ");
    t = t.replace(/^\s*(recuerdame|recordarme|recordame|acuerdame|recordatorio|anotame|anota|apuntame|apunta|agendame|agenda|pon(me)?( un)? recordatorio|guarda( un)? recordatorio|no me dejes olvidar|que no se me olvide|avisame|hazme acordar)( de| para| que| a| sobre)?\s*/, " ");
    t = t.replace(/^\s*(prepara(me|r)?|haz(me)?|hace(me)?|crea(r|me)?|arma(me)?|manda(r)?|envia(r)?|publica(r)?|escribe|redacta|necesito|quiero|puedes|podrias)?\s*(un |una |el |la )?(aviso|anuncio|invitacion|recordatorio|comunicado|flyer|afiche)?\s*(de |del |para |sobre |que diga |acerca de |a la iglesia (de |para |sobre )?|invitando (a |al |para )?)?/, " ");
    t = t.replace(/^\s*(invita(r|mos)?|invitando|convoca(r)?|anuncia(r)?|avisa(r)?|recuerda(les)?)( a| al)?\s+/, " ").replace(/^\s*(la|el|los|las|un|una)\s+/, " ");
    t = t.replace(/^\s*(a |para )?(toda )?la iglesia( que| de que)?\s+/, " ").replace(/^\s*(que )?(hay|habra|tendremos|tenemos|sera|es)\s+/, " ");
    t = t.replace(/\b(para|a) (toda )?la iglesia\b/, " ").replace(/\b(el|la|los|las|de|del|para|a|en|que|y)\s*$/g, " ").replace(/\s+/g, " ").trim();
    t = t.replace(/\b(el|la|los|las|de|del|para|a|en|que|y)\s*$/g, "").trim();
    if (!t) return "";
    // vuelve a poner las tildes y mayúsculas del texto original cuando la palabra existe allí
    const orig = String(raw).split(/\s+/), map = new Map(orig.map((w) => [plain(w), w.replace(/[¿?¡!.,;:"«»()]/g, "")]));
    return K.cap(t.split(" ").map((w) => map.get(w) || w).join(" "));
  }

  // ===== reglas de la iglesia =====
  const SENSITIVE = /\b(enferm|salud|hospital|operacion|cirugia|diagnostic|cancer|muri|fallec|luto|ofrenda|diezmo|donacion|deuda|prestamo|dinero)/;

  // ===== entender =====
  function understand(raw, ctx = {}) {
    const people = ctx.people || [], comms = ctx.comms || [], today = ctx.today || K.today();
    const t = plain(raw);
    if (!t) return { action: "responder", reply: "¿En qué le ayudo, pastor?" };
    const w = when(t, today);
    const pers = () => findPeople(t, people), nowMin = ctx.nowMin;

    // cortesía
    if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|saludos|bendiciones|que tal|hey|oye)( kaleos| pastor)?$/.test(t)) return { action: "ayuda", saludo: true };
    if (/^(gracias|muchas gracias|mil gracias|ok gracias|perfecto|excelente|muy bien|listo|dios te bendiga|bendiciones gracias)\b/.test(t) && t.split(" ").length <= 5) return { action: "responder", reply: "Para servirle, pastor. ¡Bendiciones!" };
    if (/\b(que (puedes|sabes|podes) hacer|en que (me )?(puedes|podes) ayudar|ayuda|como funciona|que haces|para que sirves|instrucciones|opciones)\b/.test(t)) return { action: "ayuda" };

    // navegar
    const SEC = { versiculos: "versiculos?", pedidos: "pedidos", agenda: "agenda|calendario", hermanos: "hermanos|miembros|membresia", comunidades: "comunidades|ministerios|grupos", saludos: "saludos|tarjetas|felicitaciones", mayordomia: "mayordomia|ofrendar|dar", controles: "controles|estadisticas|ingresos|finanzas", reporte: "reporte|informe", iglesia: "iglesia|datos de la iglesia" };
    const nav = t.match(/^(abre|abrir|abreme|ir a|ve a|vamos a|llevame a|muestrame|ensename|entra a|entrar a|quiero ver) (la |las |los |el |mis |mi )?(seccion de |pantalla de )?(.+)$/);
    if (nav) { const sec = Object.entries(SEC).find(([, re]) => new RegExp(`^(${re})\\b`).test(nav[4])); if (sec) return { action: "ir", args: { seccion: sec[0] } }; }

    // saludo de cada mañana al grupo y respuesta personal
    if (/\b(saludo|mensaje|bendicion)( de| del)? (buenos dias|la manana|cada manana|del dia|diario|para el grupo|al grupo|matutino)\b|\bbuenos dias (al|para el) grupo\b/.test(t)) return { action: "saludo_dia" };
    if (/^(responde|responder|contesta|contestar|respondele|contestale|agradece|agradecele|dale las gracias)\b/.test(t)) {
      const ps = pers(); return { action: "contestar", args: { personas: ps.map((p) => p.id), nombre: ps[0] ? ps[0].full_name : null, gracias: /gracias|agradec/.test(t) } };
    }

    // información de la iglesia (horarios, lema, tema del mes, fechas)
    if (/\b(a que hora|que hora|cuando (es|son|toca|hay)|que dia|horario|horarios)\b/.test(t) && /\b(culto|discipulado|oracion|jovenes|infantil|ninos|misiones|servicio|reunion|reuniones)\b/.test(t)) {
      const k = /infantil|ninos/.test(t) ? "infantil" : /discipulado/.test(t) ? "discipulado" : /oracion|clamor/.test(t) ? "oracion" : /misiones/.test(t) ? "misiones" : /jovenes/.test(t) ? "jovenes" : /dominical|domingo|culto/.test(t) ? "dominical" : null;
      return { action: "info", args: { tema: "horario", reunion: k } };
    }
    if (/\b(lema|mision de la iglesia|vision de la iglesia)\b/.test(t)) return { action: "info", args: { tema: "lema" } };
    if (/\b(direccion|donde queda|ubicacion|donde esta la iglesia)\b/.test(t)) return { action: "info", args: { tema: "direccion" } };
    if (/\btema del mes\b|\bnuestro tema\b/.test(t) && !/\b(imagen|disena|diseno|haz|prepara|versiculo)\b/.test(t)) return { action: "info", args: { tema: "tema" } };
    if (/\b(fechas especiales|fechas importantes|que se celebra|calendario de la iglesia|aniversario de la iglesia|actividades del ano)\b/.test(t)) return { action: "info", args: { tema: "calendario" } };

    // cifras
    if (/\b(cifras|ofrendas?|diezmos?|donaciones|mayordomia|finanzas|cuanto (se |hemos |han )?(recogi|reuni|junt|entr|llev)|cuanto llevamos|proyectos?|colecta|recaudado|tesoreria)\b/.test(t) && !/\b(aviso|anuncio|invita|recuerda)\b/.test(t)) return { action: "cifras" };

    // cumpleaños
    if (/\bcumple|\bcumpleanos\b/.test(t) && !/\b(aviso|anuncio)\b/.test(t)) {
      const ps = pers();
      if (/\b(felicita|tarjeta|prepara|manda|envia|saluda|haz|felicitar)\b/.test(t) && ps.length) return { action: "tarjeta", args: { personas: ps.map((p) => p.id), nombre: ps[0].full_name } };
      if (ps.length && /\b(cuando|que dia|que fecha|en que)\b/.test(t)) return { action: "buscar", args: { personas: ps.map((p) => p.id), dato: "cumple" } };
      return { action: "cumple", args: { dias: w.date === today ? 1 : w.date ? K.dayDiff(w.date, today) + 1 : w.days || 8 } };
    }
    // tarjetas y felicitaciones a una persona
    if (/\b(felicita|felicitar|felicitale|tarjeta|felicitacion|aniversario de bodas|aniversario)\b/.test(t)) {
      const ps = pers();
      if (ps.length) return { action: "tarjeta", args: { personas: ps.map((p) => p.id), nombre: ps[0].full_name } };
      if (/\b(tarjeta|felicita)/.test(t)) return { action: "ir", args: { seccion: "saludos" }, reply: "Abro Saludos: ahí están las tarjetas de los próximos 14 días." };
    }

    // pedidos
    if (/\b(pedidos?|peticion|peticiones|solicitudes|quien (pidio|necesita)|necesidades|pendientes de los hermanos)\b/.test(t) || (/\b(visitas?|oracion)\b/.test(t) && /\b(pendientes?|tengo|hay|piden|pidieron|cuantas?)\b/.test(t) && !/\b(recuerda|aviso|anuncio|culto|semana de oracion)\b/.test(t))) {
      const tipo = /visita/.test(t) ? "visita" : /oracion|orar/.test(t) ? "oracion" : /felicita/.test(t) ? "felicitacion" : null;
      return { action: "pedidos", args: { tipo } };
    }

    // versículos e imágenes (también una cita suelta: «filipenses 4 13», «1 pedro 2:9»)
    if (REF_RE.test(" " + t + " ") && !/\b(aviso|anuncio|recuerda|recordatorio)\b/.test(t) || /\b(versiculo|versiculos|texto biblico|cita biblica|imagen|disena|disenar|diseno|cita|salmo|palabra del dia)\b/.test(t) && !/\b(aviso|anuncio|recuerda|recordatorio)\b/.test(t)) {
      const v = findVerse(t), a = { ...(v || {}) };
      // una cita que no está en la biblioteca: se guarda la referencia y el pastor escribe el texto
      const rm = !v && (" " + t + " ").match(REF_RE);
      if (rm) { const [, book, ch, ve] = rm[0].trim().match(/^(.*?) (\d+)(?:[ :](\d+(?:-\d+)?))?$/) || []; if (book) a.ref = `${book.replace(/(^|\s)\S/g, (x) => x.toUpperCase())} ${ch}${ve ? ":" + ve : ""}`; }
      const st = pickKey(t, K.ART_KINDS); if (st) a.estilo = st;
      const pl = pickKey(t, K.PAL_NAMES); if (pl) a.color = pl;
      if (/\b(azul|marino|iglesia|la linea)\b/.test(t) && !a.color) a.color = "linea";
      const ly = pickKey(t, K.LAYOUTS); if (ly) a.composicion = ly;
      if (/\b(estado|historia|story|vertical completo)\b/.test(t)) a.formato = "historia"; else if (/\b(vertical|4 5|publicacion)\b/.test(t)) a.formato = "post"; else if (/\bcuadrad/.test(t)) a.formato = "cuadrado";
      if (/\b(sorprendeme|al azar|cualquiera|otro diseno|diferente)\b/.test(t)) a.azar = true;
      return { action: "versiculo", args: a };
    }

    // recordatorios
    if (/\b(recuerdame|recordarme|recordame|acuerdame|recordatorio|anota|anotame|apunta|apuntame|agendame|no me dejes olvidar|que no se me olvide|avisame|hazme acordar)\b/.test(t) && !/\b(a la iglesia|a los hermanos|a todos|al grupo|a la comunidad|para los|para las|anuncio)\b/.test(t)) {
      const title = titleFrom(raw, w.spans);
      return { action: "recordatorio", args: { title: title || "Recordatorio", when: iso(w, "09:00", today, nowMin) || K.gtISO(K.addDays(today, 1), "09:00") } };
    }

    // avisos (y las plantillas fijas de la iglesia)
    const isAviso = /\b(aviso|anuncio|anuncia|invitacion|invita|invitar|comunicado|flyer|afiche|convoca|publica)\b/.test(t) || (/\b(recuerda|recordar)\b/.test(t) && /\b(a la iglesia|a los hermanos|a todos|al grupo|para los|para las)\b/.test(t));
    const piece = /semana de oracion|oracion y clamor/.test(t) ? "oracion" : /culto de misiones|misiones/.test(t) ? "misiones" : /discipulado infantil/.test(t) ? "infantil" : /discipulado/.test(t) ? "discipulado" : /servicio de jovenes/.test(t) ? "jovenes" : /tema del mes/.test(t) ? "tema" : null;
    if (isAviso || (piece && /\b(prepara|haz|arma|crea|manda)\b/.test(t))) {
      const c = findCommunity(t, comms), placeM = raw.match(/\ben (el |la |los |las )?((?:templo|iglesia|salon|salón|casa|parque|auditorio|cancha|capilla|sede|local)[^,.;]*?)(?=$|,|\.| a las | el (?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)| para | mañana| hoy)/i);
      const spans = [...w.spans, placeM && placeM[0], c && (t.match(new RegExp(`\\b(para|a|de|con) (los |las |la |el )?(${[plain(c.name), plain(c.slug), ...Object.values(ALIAS).flat()].join("|")})\\b`)) || [])[0]].filter(Boolean);
      let title = titleFrom(raw, spans);
      const warn = SENSITIVE.test(t) && !c ? "Ojo: la iglesia acostumbra que salud y ofrendas con nombre vayan en privado, no al grupo de toda la iglesia." : null;
      // con hora: fecha y hora; con solo el día: el pastor completa la hora en el editor
      const wh = w.time ? iso(w, "19:00", today, nowMin) : null, date = !w.time && w.date ? w.date : null;
      if (piece && (!title || plain(title).length < 4 || new RegExp(piece === "oracion" ? "oracion" : piece).test(plain(title)))) return { action: "aviso", args: { pieza: piece, community: c ? c.slug : null, when: wh, date, place: placeM ? placeM[2].trim() : null }, warn };
      return { action: "aviso", args: { title: title || null, when: wh, date, place: placeM ? placeM[2].trim() : null, community: c ? c.slug : null }, warn };
    }

    // datos de un hermano
    if (/\b(telefono|numero de|celular|whatsapp de|nivel de|quien es|datos de|ficha de|busca|buscar|encuentra|donde vive|correo de|cuando cumple)\b/.test(t)) {
      const ps = pers();
      if (ps.length) return { action: "buscar", args: { personas: ps.map((p) => p.id), dato: /telefono|celular|numero|whatsapp/.test(t) ? "telefono" : /cumple/.test(t) ? "cumple" : /nivel/.test(t) ? "nivel" : "todo" } };
      if (/\b(busca|buscar|encuentra)\b/.test(t)) return { action: "responder", reply: "No encontré a ese hermano. ¿Me dice su nombre y apellido?" };
    }

    // agenda
    if (/\b(que tengo|tengo algo|agenda|pendientes|que hay|que toca|actividades|que sigue|programa|planes|ocupado|libre|compromisos|resumen)\b/.test(t) || w.date || w.days) {
      const dia = w.date || today, dias = w.days || 1;
      return { action: "hoy", args: { dia, dias } };
    }
    // un nombre suelto: buscar al hermano
    const ps = pers();
    if (ps.length && t.split(" ").length <= 4) return { action: "buscar", args: { personas: ps.map((p) => p.id), dato: "todo" } };
    return { action: "responder", reply: "No le entendí bien. Puedo ver su agenda, los pedidos y los cumpleaños, preparar avisos, recordatorios, tarjetas e imágenes de versículos, y contestarle a un hermano. ¿Me lo dice de otra forma?" };
  }

  K.brain = { understand, when, plain, findPeople, findCommunity, findVerse, titleFrom };
})();
