/* Kaleos: lo que la app sabe de La Línea (sin datos personales).
   Sale de lo que la iglesia publica en su página de Facebook y en su grupo de WhatsApp (ago.–nov. 2026).
   Lo usan el asistente, las plantillas fijas de avisos y las tarjetas. Los horarios marcados «confirmar» los ajusta el pastor. */
(function () {
  "use strict";
  const K = window.K;

  const I = (K.IGLESIA = {
    nombre: 'Iglesia de Dios E.C. "La Línea"',
    lema: "¡Proclamar las buenas nuevas de salvación! ¡Cristo es el Señor!",
    lemaDenominacion: "¡Adelante Iglesia de Dios!",
    direccion: "0 calle 4-08, La Línea Zona 6, Quetzaltenango",
    region: "Región No. 4, Territorio Occidente, Distrito Quetzaltenango No. 2",
    // el saludo de cada mañana en el grupo de WhatsApp (a las 6:00)
    saludo: "Que la gracia y la paz de nuestro Señor Jesucristo estén siempre con ustedes amados hermanos. ¡Buenos días!",
    version: "Reina-Valera 1960",
    // fundada en 1987; antes se llamaba «Tabernáculo de Alabanza» (aniversario a mediados de julio)
    fundacion: 1987, nombreAnterior: "Tabernáculo de Alabanza",
    // reuniones fijas (dow: 0 = domingo)
    reuniones: [
      { k: "dominical", n: "Culto dominical", dow: 0, hora: null, nota: "La hora no está publicada: confírmela." },
      { k: "misiones", n: "Culto de Misiones", dow: 0, hora: null, regla: "ultimo", nota: "El último domingo de cada mes." },
      { k: "oracion", n: "Semana de Oración y clamor", dow: 1, hora: "19:00", regla: "primera", nota: "La primera semana de cada mes, de lunes a viernes, 7:00 p. m." },
      { k: "infantil", n: "Discipulado infantil", dow: 2, hora: "19:00", nota: "Los martes, 7:00 p. m." },
      { k: "discipulado", n: "Discipulado cristiano", dow: 4, hora: "18:30", nota: "Los jueves (a veces viernes), 6:30 p. m., con tareas y lecciones." },
      { k: "jovenes", n: "Servicio de jóvenes", dow: 6, hora: "18:00", nota: "Los sábados (a veces viernes), 6:00 p. m." },
    ],
    // fechas del año que la iglesia celebra
    calendario: [
      { md: "04-13", n: "Aniversario de la Iglesia de Dios en Guatemala" },
      { md: "07-15", n: "Aniversario de La Línea", nota: "a mediados de julio; fundada en 1987 (40 años en 2027)" },
      { md: "08-15", n: "Noche de fogata" },
      { md: "08-19", n: "Aniversario de la Iglesia de Dios" },
      { md: "08-31", n: "Día de la Biblia y Reconocimiento Pastoral", nota: "a fin de agosto" },
      { md: "09-14", n: "Mañana Nacionalista", nota: "13 al 15 de septiembre" },
      { md: "10-01", n: "Día del Niño" },
      { md: "10-31", n: "Día de la Reforma Protestante" },
      { md: "11-30", n: "Clausura del Discipulado", nota: "en noviembre" },
    ],
    // «Nuestro tema de [mes]» (el día 1 de cada mes)
    temas: {
      "2026-10": ["Tiempos de Reforma", "Romanos 5:1"],
      "2026-11": ["No se turbe vuestro corazón", "Juan 14:1"],
    },
    campana: "Proyecto misionero Cartagena (Colombia)",
    // reglas que el asistente cuida
    reglas: [
      "Los niños nunca van en primer plano en las imágenes.",
      "Salud y ofrendas con nombre van en privado, nunca en el grupo de toda la iglesia.",
      "Versículos siempre en Reina-Valera 1960: «texto» y luego Libro cap:vers.",
    ],
  });

  // ===== fechas calculadas (para no volver a usar un flyer con la fecha vieja) =====
  const dow = (d) => new Date(d + "T12:00:00Z").getUTCDay();
  const ym = (d) => d.slice(0, 7);
  const firstDow = (y, m, w) => { let d = `${y}-${String(m).padStart(2, "0")}-01`; while (dow(d) !== w) d = K.addDays(d, 1); return d; };
  const lastDow = (y, m, w) => { const nm = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`; let d = K.addDays(nm, -1); while (dow(d) !== w) d = K.addDays(d, -1); return d; };
  const monthAfter = (y, m) => (m === 12 ? [y + 1, 1] : [y, m + 1]);
  // la próxima vez que toca una reunión (hoy cuenta si todavía no pasó la hora)
  K.nextMeeting = (k, from = K.today()) => {
    const r = I.reuniones.find((x) => x.k === k); if (!r) return null;
    const y = +from.slice(0, 4), m = +from.slice(5, 7);
    const nowMin = (() => { const [h, mi] = new Date().toLocaleTimeString("en-GB", { timeZone: K.TZ, hour: "2-digit", minute: "2-digit" }).split(":"); return +h * 60 + +mi; })();
    const ok = (d) => d > from || (d === from && (!r.hora || from !== K.today() || +r.hora.slice(0, 2) * 60 + +r.hora.slice(3) > nowMin));
    let d;
    if (r.regla === "ultimo") { d = lastDow(y, m, r.dow); if (!ok(d)) d = lastDow(...monthAfter(y, m), r.dow); }
    else if (r.regla === "primera") {
      // lunes de la primera semana del mes; si estamos dentro de esa semana (lunes a viernes), vale la de este mes
      d = firstDow(y, m, 1);
      const fri = K.addDays(d, 4);
      if (from > fri || (from === fri && !ok(fri))) d = firstDow(...monthAfter(y, m), 1);
    } else { d = from; for (let i = 0; i < 8 && (dow(d) !== r.dow || !ok(d)); i++) d = K.addDays(d, 1); }
    return { ...r, date: d, iso: r.hora ? K.gtISO(d, r.hora) : null };
  };
  K.temaDelMes = (d = K.today()) => { const t = I.temas[ym(d)]; return t ? { titulo: t[0], ref: t[1], mes: K.MONTHS[+d.slice(5, 7) - 1] } : null; };
  K.fechasIglesia = (from = K.today(), days = 31) => {
    const out = [];
    for (let i = 0; i < days; i++) { const d = K.addDays(from, i); for (const c of I.calendario) if (d.slice(5) === c.md) out.push({ ...c, date: d }); }
    return out;
  };

  // ===== las piezas fijas que la iglesia publica, con la fecha ya calculada =====
  K.PIECES = () => {
    const t = K.temaDelMes(), v = t && (K.VERSES.find(([r]) => r === t.ref) || [t.ref, ""]);
    const mk = (k, title, body, extra = {}) => { const n = K.nextMeeting(k); return { k, n: n.n, title, body, date: n.date, time: n.hora || "", ...extra }; };
    const list = [
      mk("oracion", "Semana de Oración y clamor", "Un tiempo de Oración y clamor. De lunes a viernes, 7:00 p. m. Cordialmente invitados.", { pal: "linea", style: "cruz", layout: "cinta", est: "e:sag-capilla:marino" }),
      mk("misiones", "Culto de Misiones", `Cordialmente invitados al Culto de Misiones. Seguimos orando y apoyando el ${I.campana}. ¡Les esperamos!`, { pal: "esmeralda", style: "geometria", layout: "marco", est: "e:fot-estandarte:marino" }),
      mk("discipulado", "Discipulado cristiano", "Les recordamos que es noche de Discipulado cristiano. Traigan sus tareas y lecciones. ¡Les esperamos!", { pal: "linea", style: "papiro", layout: "agenda", est: "e:edi-indice:marino" }),
      mk("infantil", "Discipulado infantil", "Cordialmente invitados los niños al Discipulado infantil. ¡Les esperamos!", { pal: "cielo", style: "petalos", layout: "centro", est: "e:fie-globos:turquesa" }),
      mk("jovenes", "Servicio de jóvenes", "Cordialmente invitados los jóvenes. ¡Sigamos adelante!", { pal: "tinta", style: "estrellas", layout: "fecha", est: "e:tip-eco:marino" }),
    ];
    if (t) list.unshift({ k: "tema", n: "Tema del mes", title: `Nuestro tema de ${t.mes}: ${t.titulo}`, body: v && v[1] ? `«${v[1]}» ${t.ref}` : t.ref, date: "", time: "", pal: "linea", style: "luz", layout: "centro", est: "e:edi-cita:linea" });
    return list;
  };
})();
