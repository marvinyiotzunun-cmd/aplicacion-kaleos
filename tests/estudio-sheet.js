// Hojas de muestra del Estudio: dibuja cada plantilla × tema × pieza con textos cortos y largos,
// revisa que ningún texto se salga de la imagen y guarda una hoja PNG por plantilla.
//   node tests/estudio-sheet.js [carpeta-salida] [filtro-de-plantilla-o-familia] [--photo]
// Sale con código 1 si alguna plantilla lanza un error o saca texto fuera de la imagen.
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const ROOT = path.join(__dirname, "..", "docs");
const OUT = path.resolve(process.argv[2] || path.join(__dirname, "shots", "estudio"));
const FILTER = process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3] : "";
const PHOTO = process.argv.includes("--photo");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json", ".jpg": "image/jpeg" };
const families = fs.readdirSync(path.join(ROOT, "js", "estudio")).filter((f) => f.endsWith(".js")).sort();
const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#888">
<script>window.K={churchShort:()=>"La Línea",TZ:"America/Guatemala",
dpart:(d,o)=>new Date(d).toLocaleString("es-GT",{timeZone:"America/Guatemala",...o}),
fmtTime:(v)=>new Date(v).toLocaleTimeString("es-GT",{timeZone:"America/Guatemala",hour:"numeric",minute:"2-digit"})};</script>
<script src="/js/estudio.js"></script>
${families.map((f) => `<script src="/js/estudio/${f}"></script>`).join("\n")}
</body>`;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = http.createServer((q, r) => {
    const u = decodeURIComponent(new URL(q.url, "http://x").pathname);
    if (u === "/__sheet") { r.writeHead(200, { "Content-Type": "text/html" }); return r.end(PAGE); }
    const f = path.join(ROOT, u); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r);
  }).listen(0);
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto(`http://localhost:${srv.address().port}/__sheet`);
  const res = await p.evaluate(async ({ FILTER, PHOTO }) => {
    const E = K.EST, load = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = s; });
    E.setAssets({ logo: await load("/img/logo.png"), markW: await load("/img/mark-w.png") });
    await E.ready(); await document.fonts.ready;
    // foto de prueba (paisaje dibujado) para las plantillas con foto
    let photo = null;
    if (PHOTO) {
      const c = document.createElement("canvas"); c.width = 1600; c.height = 1100; const x = c.getContext("2d");
      const sky = x.createLinearGradient(0, 0, 0, 700); sky.addColorStop(0, "#6f9fd0"); sky.addColorStop(1, "#f1d6a6"); x.fillStyle = sky; x.fillRect(0, 0, 1600, 1100);
      x.fillStyle = "#4b5d48"; x.beginPath(); x.moveTo(0, 720); for (let i = 0; i <= 16; i++) x.lineTo(i * 100, 560 + Math.sin(i * 1.3) * 90 + (i % 3) * 30); x.lineTo(1600, 1100); x.lineTo(0, 1100); x.fill();
      x.fillStyle = "#2f3d2e"; x.beginPath(); x.moveTo(0, 860); for (let i = 0; i <= 16; i++) x.lineTo(i * 100, 800 + Math.cos(i) * 40); x.lineTo(1600, 1100); x.lineTo(0, 1100); x.fill();
      x.fillStyle = "#fff4d8"; x.beginPath(); x.arc(1150, 420, 70, 0, 7); x.fill();
      photo = c;
    }
    const V = {
      card: [
        { kicker: "7 de noviembre", headline: "¡Feliz cumpleaños!", name: "Hno. Luis Ajú", line: "Damos gracias a Dios por su vida", verse: "Jehová te bendiga, y te guarde; Jehová haga resplandecer su rostro sobre ti.", ref: "Números 6:24-25", signature: "Pastor Marvin Miche", from: "y toda la familia de La Línea", occasion: "cumple" },
        { kicker: "21 de noviembre", headline: "¡Feliz aniversario de bodas!", name: "Hna. María Fernanda López de García", line: "25 años unidos por el amor de Dios", verse: "Y si alguno prevaleciere contra uno, dos le resistirán; y cordón de tres dobleces no se rompe pronto.", ref: "Eclesiastés 4:12", signature: "Pastor Marvin Miche", from: "y toda la familia de La Línea", occasion: "bodas" },
      ],
      ann: [
        { title: "Culto de Misiones", event_at: "2026-11-29T16:00:00Z", place: "Templo La Línea" },
        { title: "Vigilia de oración por las familias de la iglesia y la ciudad", event_at: "2026-11-14T00:00:00Z", place: "Templo La Línea, 0 calle 4-08 zona 6, Quetzaltenango" },
        { title: "Semana de oración y clamor", place: "" },
      ],
      verse: [
        { text: "Jehová es mi pastor; nada me faltará.", ref: "Salmos 23:1", fmt: "cuadrado" },
        { text: "Mira que te mando que te esfuerces y seas valiente; no temas ni desmayes, porque Jehová tu Dios estará contigo en dondequiera que vayas.", ref: "Josué 1:9", fmt: "post", firma: true },
        { text: "Por la misericordia de Jehová no hemos sido consumidos, porque nunca decayeron sus misericordias. Nuevas son cada mañana; grande es tu fidelidad.", ref: "Lamentaciones 3:22-23", fmt: "historia", head: "¡Buenos días, iglesia!", eyebrow: "Sábado 7 de noviembre", firma: true },
      ],
    };
    // revisa el texto que se escribe: que no se salga de la imagen
    const issues = [];
    let cur = "";
    const P = CanvasRenderingContext2D.prototype, of = P.fillText, os = P.strokeText;
    const check = function (s, x, y) {
      const m = this.measureText(s), t = this.getTransform(), W = this.canvas.width, H = this.canvas.height;
      const al = this.textAlign, w = m.width, x0 = al === "center" ? x - w / 2 : al === "right" || al === "end" ? x - w : x;
      const pts = [[x0, y - m.actualBoundingBoxAscent], [x0 + w, y - m.actualBoundingBoxAscent], [x0, y + m.actualBoundingBoxDescent], [x0 + w, y + m.actualBoundingBoxDescent]].map(([a, b]) => [t.a * a + t.c * b + t.e, t.b * a + t.d * b + t.f]);
      const minX = Math.min(...pts.map((q) => q[0])), maxX = Math.max(...pts.map((q) => q[0])), minY = Math.min(...pts.map((q) => q[1])), maxY = Math.max(...pts.map((q) => q[1]));
      if (this.canvas._chk && String(s).trim() && (minX < 24 || maxX > W - 24 || minY < 16 || maxY > H - 16)) issues.push(`${cur}: «${String(s).slice(0, 40)}» se sale (${Math.round(minX)},${Math.round(minY)})-(${Math.round(maxX)},${Math.round(maxY)}) en ${W}×${H}`);
    };
    P.fillText = function (s, x, y, mw) { check.call(this, s, x, y); return of.call(this, s, x, y, mw); };
    P.strokeText = function (s, x, y, mw) { check.call(this, s, x, y); return os.call(this, s, x, y, mw); };
    const out = [];
    const ts = Object.values(E.T).filter((t) => !FILTER || t.id === FILTER || t.family === FILTER);
    const COLS = [["card", 0], ["card", 1], ["ann", 0], ["ann", 1], ["ann", 2], ["verse", 0], ["verse", 1], ["verse", 2]];
    for (const t of ts) {
      const themes = Object.keys(t.themes), cw = 270, gap = 10, rowH = 480 + 26;
      const sheet = document.createElement("canvas"); sheet.width = COLS.length * (cw + gap) + gap; sheet.height = themes.length * rowH + 40;
      const sx = sheet.getContext("2d"); sx.fillStyle = "#3a3a3a"; sx.fillRect(0, 0, sheet.width, sheet.height);
      sx.fillStyle = "#fff"; sx.font = "600 20px sans-serif"; of.call(sx, `${t.id} · ${t.name} · ${t.family}`, gap, 28);
      themes.forEach((th, r) => {
        sx.fillStyle = "#ddd"; sx.font = "500 15px sans-serif"; of.call(sx, `${th} · ${t.themes[th].name || ""}`, gap, 40 + r * rowH + 18);
        COLS.forEach(([kind, vi], c) => {
          if (t.kinds && !t.kinds.includes(kind)) return;
          const cv = document.createElement("canvas"); cv._chk = true; const src = V[kind][vi];
          cur = `${t.id}:${th} ${kind}#${vi}`;
          const t0 = performance.now();
          E.render(cv, kind, E.key(t.id, th), src, { fmt: src.fmt, seed: "muestra", photo });
          const ms = performance.now() - t0; if (ms > 400) issues.push(`${cur}: tarda ${Math.round(ms)} ms`);
          const scale = cw / cv.width, h = Math.min(480, cv.height * scale);
          sx.drawImage(cv, gap + c * (cw + gap), 40 + r * rowH + 26, cw, cv.height * scale > 480 ? 480 : h);
        });
      });
      out.push({ id: t.id, png: sheet.toDataURL("image/png") });
    }
    // un ejemplo grande de cada plantilla (primer tema) para mirarla de cerca
    const big = [];
    for (const t of ts) {
      const th = Object.keys(t.themes)[0], row = document.createElement("canvas"); row.width = 3 * 1080 + 40; row.height = 1350; const rx = row.getContext("2d");
      rx.fillStyle = "#3a3a3a"; rx.fillRect(0, 0, row.width, row.height);
      [["card", V.card[0]], ["ann", V.ann[0]], ["verse", { ...V.verse[1] }]].forEach(([kind, src], i) => { const cv = document.createElement("canvas"); E.render(cv, kind, E.key(t.id, th), src, { fmt: src.fmt, seed: "muestra", photo }); rx.drawImage(cv, i * 1100, 0); });
      big.push({ id: t.id, png: row.toDataURL("image/jpeg", 0.82) });
    }
    return { out, big, issues, count: { card: E.count("card"), ann: E.count("ann"), verse: E.count("verse") }, templates: Object.keys(E.T).length };
  }, { FILTER, PHOTO });
  for (const o of res.out) fs.writeFileSync(path.join(OUT, `${o.id}${PHOTO ? "-foto" : ""}.png`), Buffer.from(o.png.split(",")[1], "base64"));
  for (const o of res.big) fs.writeFileSync(path.join(OUT, `${o.id}${PHOTO ? "-foto" : ""}-grande.jpg`), Buffer.from(o.png.split(",")[1], "base64"));
  console.log(`Plantillas: ${res.templates} · diseños: tarjetas ${res.count.card}, avisos ${res.count.ann}, versículos ${res.count.verse}`);
  console.log(`Hojas en ${OUT}`);
  const all = [...errs, ...res.issues];
  if (all.length) { console.log(`\n${all.length} problemas:`); all.slice(0, 80).forEach((e) => console.log(" - " + e)); }
  else console.log("Sin problemas: ningún error ni texto fuera de la imagen.");
  await b.close(); srv.close(); process.exit(all.length ? 1 : 0);
})();
