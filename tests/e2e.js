#!/usr/bin/env node
/* Pruebas de punta a punta de Kaleos con Playwright y un Supabase simulado (tests/mock-supabase.js).
   Uso: node tests/e2e.js [filtro]      (por ejemplo: node tests/e2e.js pastor)
   Variables: SHOTS=1 guarda capturas en tests/shots/ · HEADED=1 abre el navegador. */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium, devices } = require("playwright");

const ROOT = path.join(__dirname, "..", "docs");
const MOCK = fs.readFileSync(path.join(__dirname, "mock-supabase.js"), "utf8");
const SHOTS = process.env.SHOTS ? path.join(__dirname, "shots") : null;
const FILTER = process.argv[2] || "";
const ACC = { pastor: ["LL-0001", "246810"], secretaria: ["LL-0002", "135790"], miembro: ["LL-0003", "112233"], cumple: ["LL-0004", "444444"] };
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };

// ===== servidor estático =====
function serve() {
  return new Promise((ok) => {
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, "http://x");
      let f = path.normalize(path.join(ROOT, decodeURIComponent(u.pathname)));
      if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
      if (!fs.existsSync(f)) { res.writeHead(404); return res.end("no"); }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
      fs.createReadStream(f).pipe(res);
    }).listen(0, () => ok(srv));
  });
}

// ===== mini marco de pruebas =====
const results = [];
let browser, base;
async function newPage(o = {}) {
  const ctx = await browser.newContext({
    ...(o.mobile ? devices["Pixel 7"] : { viewport: o.viewport || { width: 1280, height: 860 } }),
    colorScheme: o.dark ? "dark" : "light", timezoneId: "America/Guatemala", locale: "es-GT",
    permissions: ["clipboard-read", "clipboard-write", "camera"], serviceWorkers: "block",
  });
  await ctx.route("**/vendor/supabase.js", (r) => r.fulfill({ contentType: "text/javascript", body: MOCK }));
  await ctx.route("**/config.js", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.KALEOS_CONFIG={url:"https://mock.supabase.co",anonKey:"mock",church:"la-linea"};' }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route(/api\.openai\.com/, (r) => r.abort());
  await ctx.addInitScript(() => {
    window.__opened = [];
    window.open = (u) => { window.__opened.push(String(u)); return null; };
    // sin voz ni dictado en las pruebas (el navegador sin pantalla no los tiene de verdad)
    try { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; } catch (_) {}
    window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined;
    window.print = () => { window.__printed = true; };
  });
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") { const t = m.text(); if (!/favicon|Failed to load resource|net::ERR_FAILED|ERR_BLOCKED|Service Worker registration blocked/.test(t)) page.errors.push(m.type() + ": " + t); } });
  page.on("dialog", (d) => { page.lastDialog = d.message(); d.accept(); });
  page.on("download", (d) => { page.downloads = (page.downloads || 0) + 1; d.cancel().catch(() => {}); });
  await page.goto(base);
  return page;
}
async function login(page, who) {
  const [no, pin] = ACC[who] || who;
  await page.fill("#no", no); await page.fill("#pin", pin);
  await page.click("#go");
  await page.waitForSelector(".phone, .desk", { timeout: 8000 });
  await idle(page);
}
async function idle(page) { await page.waitForFunction(() => !document.querySelector("#app .loading"), null, { timeout: 8000 }); await page.waitForTimeout(80); }
const top = (page) => page.locator(".sheet.show, .drawer.show").last();
async function closeTop(page) { await top(page).locator("[data-close]").first().click(); await page.waitForTimeout(350); }
async function toast(page, re) {
  await page.waitForFunction((src) => { const t = document.querySelector("#toast"); return t && t.classList.contains("show") && new RegExp(src).test(t.textContent); }, re.source, { timeout: 5000 })
    .catch(async () => { throw new Error(`Esperaba aviso ${re}; hay: «${await page.textContent("#toast")}»`); });
}
function assert(c, m) { if (!c) throw new Error(m); }
async function noOverflow(page, where) {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  assert(o.sw <= o.w + 1, `${where}: la página se sale a lo ancho (${o.sw}px en ${o.w}px)`);
}
async function shot(page, name) { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: false }); } }
async function pick(page, ddSel, value) { await page.click(`${ddSel} .dd-btn`); await page.click(`${ddSel} .dd-item[data-v="${value}"]`); await idle(page); }
async function test(name, fn, o = {}) {
  if (FILTER && !name.toLowerCase().includes(FILTER.toLowerCase())) return;
  const t0 = Date.now(); let page;
  try {
    page = await newPage(o);
    await fn(page);
    const errs = (page.errors || []).filter((e) => !(o.allow || []).some((re) => re.test(e)));
    if (errs.length) throw new Error("Errores en la consola:\n    " + errs.join("\n    "));
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`  ✓ ${name} (${Date.now() - t0} ms)`);
  } catch (e) {
    results.push({ name, ok: false, err: e.message });
    if (page && process.env.DEBUG) console.log("    consola:", (page.errors || []).join(" | "), "\n    aviso:", await page.textContent("#toast").catch(() => ""), "\n    log:", JSON.stringify(await page.evaluate(() => (window.__MOCK_LOG || []).slice(-6)).catch(() => [])).slice(0, 1500));
    console.log(`  ✗ ${name}\n    ${e.message.split("\n").join("\n    ")}`);
    if (page) { fs.mkdirSync(path.join(__dirname, "shots"), { recursive: true }); await page.screenshot({ path: path.join(__dirname, "shots", "FALLO-" + name.replace(/[^\w]+/g, "-") + ".png") }).catch(() => {}); }
  } finally { if (page) await page.context().close(); }
}

// ===== pruebas =====
async function suites() {
  console.log("\nInicio de sesión");
  await test("login: PIN incorrecto avisa y deja reintentar", async (p) => {
    await p.fill("#no", "LL-0003"); await p.fill("#pin", "000000"); await p.click("#go");
    await toast(p, /PIN incorrecto/);
    assert(!(await p.isDisabled("#go")), "el botón quedó deshabilitado");
  });
  await test("login: número corto (3) se completa a LL-0003", async (p) => { await login(p, ["3", "112233"]); assert(await p.isVisible(".mc"), "no se ve la tarjeta"); });
  await test("login: cuenta desactivada no entra", async (p) => {
    await p.fill("#no", "LL-0009"); await p.fill("#pin", "999999"); await p.click("#go");
    await p.waitForSelector("text=desactivada");
  });
  await test("login: la sesión sigue al recargar y se cierra con el menú", async (p) => {
    await login(p, "miembro"); await p.reload(); await p.waitForSelector(".mc"); await idle(p);
    await p.click(".menudd .dd-btn"); await p.click('.dd-item[data-v="logout"]');
    await p.waitForSelector("#no");
  });

  console.log("\nFunciones de apoyo");
  await test("ayudas: montos, enlaces, 29 de febrero, hojas encimadas, pedidos raros", async (p) => {
    await login(p, "pastor");
    const r = await p.evaluate(async () => {
      const out = {};
      out.amounts = ["150", "150.50", "1,500.75", "Q 1 500", "150,5", "0", "abc", "1.500,25"].map(K.parseAmount);
      out.q = [K.Q(1500), K.Q(150.5), K.Q(0)];
      out.urls = ["https://chat.whatsapp.com/x", "chat.whatsapp.com/abc", "javascript:alert(1)", "hola"].map(K.url);
      out.leap = [K.sameMD("2004-02-29", "2027-02-28"), K.sameMD("2004-02-29", "2028-02-28"), K.sameMD("2004-02-29", "2028-02-29"), K.sameMD("1990-05-03", "2026-05-03"), K.sameMD(null, "2026-05-03")];
      out.req = [K.reqOf("raro").n, K.statOf(undefined)[0]];
      K.sheet("<p>uno</p>"); await new Promise((ok) => setTimeout(ok, 50)); K.closeAll(); K.sheet('<p id="dos">dos</p>');
      await new Promise((ok) => setTimeout(ok, 500));
      out.sheet = !!document.querySelector(".sheet.show #dos") && !document.querySelector("#scrim").hidden;
      K.closeAll(true);
      return out;
    });
    assert(JSON.stringify(r.amounts) === JSON.stringify([150, 150.5, 1500.75, 1500, 150.5, 0, 0, 1500.25]), "montos: " + r.amounts);
    assert(/1,500$/.test(r.q[0]) && /150\.50$/.test(r.q[1]) && /0$/.test(r.q[2]), "formato Q: " + r.q);
    assert(JSON.stringify(r.urls) === JSON.stringify(["https://chat.whatsapp.com/x", "https://chat.whatsapp.com/abc", "", ""]), "enlaces: " + r.urls);
    assert(JSON.stringify(r.leap) === JSON.stringify([true, false, true, true, false]), "29 de febrero: " + r.leap);
    assert(r.req[0] === "Otra cosa" && r.req[1] === "Nuevo", "pedidos raros: " + r.req);
    assert(r.sheet, "una hoja abierta justo después de cerrar otra desapareció o quedó sin fondo");
  });
  await test("pedidos con tipo o estado desconocido no rompen las pantallas", async (p) => {
    await login(p, "pastor");
    await p.evaluate(() => { __MOCK.db.tables.kaleos_prayer_requests.push({ id: 99, church_id: "ch-1", profile_id: "p-03", kind: null, status: "rara", note: "Fila vieja", for_name: null, for_date: null, created_at: new Date().toISOString() }); __MOCK.save(); });
    await p.reload(); await p.waitForSelector(".greet"); await idle(p);
    await p.click('.brief [data-ask="pedidos"]'); await p.waitForFunction(() => !document.querySelector(".typing"));
    await pick(p, '[data-dd="psec"]', "pedidos"); assert(await p.isVisible("text=Fila vieja"), "no se ve el pedido viejo");
    await p.click('[data-dd="umenu"] .dd-btn'); await p.click('.dd-item[data-v="logout"]'); await p.waitForSelector("#no");
    await login(p, "miembro"); await p.click('[data-mt="pedir"]'); await idle(p); assert(await p.isVisible("text=Fila vieja"), "el hermano no ve su pedido viejo");
  });
  await test("enlaces escritos sin https se abren bien y los peligrosos no se muestran", async (p) => {
    await login(p, "miembro");
    await p.evaluate(() => { const t = __MOCK.db.tables; t.kaleos_churches[0].whatsapp_url = "javascript:alert(1)"; t.kaleos_notices[0].sermon_url = "youtube.com/watch?v=1"; __MOCK.save(); });
    await p.reload(); await p.waitForSelector(".mc"); await idle(p);
    await p.click(".menudd .dd-btn");
    assert(!(await p.locator('.dd-item[data-v="wa"]').count()), "muestra un enlace de WhatsApp peligroso");
    await p.click('.dd-item[data-v="iglesia"]'); await idle(p);
    assert((await p.getAttribute('a.li[href*="youtube"]', "href")) === "https://youtube.com/watch?v=1", "el enlace de la predicación no quedó completo");
    assert(!(await p.locator('a[href^="javascript"]').count()), "hay un enlace javascript:");
  });

  console.log("\nMiembro");
  await test("miembro: inicio, tarjeta, versículo y filtros de anuncios", async (p) => {
    await login(p, "miembro");
    await p.click("#mc"); assert(await p.locator("#mc.flip").count(), "la tarjeta no se volteó");
    assert(await p.locator("#mc .qr svg").count(), "no hay código QR");
    await p.click("#vshare"); await p.waitForTimeout(300);
    for (const v of ["iglesia", "comunidades", "nivel", "voy", "todo"]) await pick(p, '[data-dd="feed"]', v);
    const titles = await p.locator(".ann h3").allTextContents();
    assert(titles.some((t) => t.includes("Vigilia de jóvenes")), "no ve el anuncio de su comunidad");
    assert(!titles.some((t) => t.includes("Reunión de damas")), "ve un anuncio de una comunidad ajena");
    assert(titles.some((t) => t.includes("Escuela de líderes")), "no ve el anuncio de su nivel");
    assert(titles.some((t) => t.includes("<b>Santa Cena</b>")), "el título con < > no se muestra como texto");
    await noOverflow(p, "inicio");
  });
  await test("miembro: confirmar asistencia (sí, me interesa, quitar) e invitar", async (p) => {
    await login(p, "miembro");
    await p.click('.ann:has-text("Culto de oración")');
    const s = top(p);
    await s.locator('[data-r="si"]').click(); await toast(p, /Le esperamos/);
    assert((await s.locator("#kcount").textContent()).includes("2 asistirán"), "no sumó su respuesta");
    await s.locator('[data-r="tal"]').click(); await toast(p, /guardada/);
    await s.locator('[data-r="tal"]').click(); await toast(p, /quitada/);
    await s.locator("#ainv").click(); await p.waitForTimeout(400);
    const opened = await p.evaluate(() => window.__opened);
    assert(opened.some((u) => u.startsWith("https://wa.me/")), "no abrió WhatsApp");
  });
  await test("miembro: comunidades (propia con pestañas, ajena con pedir unirme)", async (p) => {
    await login(p, "miembro");
    await p.click('[data-mt="comunidades"]'); await idle(p);
    await p.click('[data-comm="1"]'); await idle(p);
    for (const t of ["reuniones", "orientacion", "integrantes", "avisos"]) { await p.click(`[data-ct="${t}"]`); await idle(p); }
    assert(await p.isVisible('text=Abrir el grupo de WhatsApp'), "falta el enlace del grupo");
    await p.click("#back"); await idle(p);
    await p.click('[data-comm="4"]'); await idle(p);
    await p.click("#join"); await toast(p, /recibi/);
    await noOverflow(p, "comunidad");
  });
  await test("miembro: pedir felicitación, visita, oración y otra cosa", async (p) => {
    await login(p, "miembro");
    await p.click('[data-mt="pedir"]'); await idle(p);
    await p.click('[data-req="otro"]'); await top(p).locator("#rs").click(); await toast(p, /Cuéntele/); await closeTop(p);
    await p.click('[data-req="felicitacion"]'); await p.fill("#rf", "Mi mamá"); await p.fill("#rd", "2026-12-24"); await p.fill("#rn", "Cumple 70"); await top(p).locator("#rs").click();
    await p.waitForSelector("text=Pedido enviado"); await closeTop(p); await idle(p);
    await p.click('[data-req="visita"]'); await top(p).locator("#rs").click(); await p.waitForSelector("text=Pedido enviado"); await closeTop(p); await idle(p);
    await p.click('[data-req="oracion"]'); await p.fill("#rn", "Por mi trabajo"); await top(p).locator("#rs").click(); await p.waitForSelector("text=la iglesia ora"); await closeTop(p); await idle(p);
    const n = await p.locator(".list .li").count();
    assert(n >= 4, "no aparecen los pedidos nuevos en «Mis pedidos» (" + n + ")");
  });
  await test("miembro: mayordomía (aportar con decimales, sobre, tarjeta, diezmo)", async (p) => {
    await login(p, "miembro");
    await p.click('[data-mt="dar"]'); await idle(p);
    await p.click('[data-give="proyecto|1"]');
    await p.fill("#ga", "0"); await top(p).locator("#gok").click(); await toast(p, /monto/);
    await top(p).locator('[data-m="tarjeta"]').click({ force: true }); await toast(p, /tarjeta/);
    await top(p).locator('[data-m="sobre"]').click(); assert(!(await top(p).locator("#gr").count()), "con sobre no debería pedir boleta");
    await top(p).locator('[data-m="transferencia"]').click(); await p.fill("#ga", "150.50"); await p.fill("#gr", "BOL-123");
    await top(p).locator("#gok").click(); await p.waitForSelector("text=Recibo digital");
    const big = await top(p).locator(".receipt .big").textContent();
    assert(/150[.,]5/.test(big), "el monto con decimales quedó mal: " + big);
    await closeTop(p); await idle(p);
    for (const t of ["donaciones", "ofrendas", "diezmos"]) { await p.click(`[data-gt="${t}"]`); await idle(p); }
    await p.click('[data-give="diezmo|General"]'); await p.fill("#ga", "300"); await top(p).locator("#gok").click(); await p.waitForSelector("text=Recibo digital"); await closeTop(p);
    await idle(p);
    assert(await p.isVisible("#mis-aportes"), "no aparecen sus aportes");
  });
  await test("miembro: camino, mensajes (leer marca como leído), mi iglesia, mis datos", async (p) => {
    await login(p, "miembro");
    await p.click('[data-mt="camino"]'); await idle(p); assert(await p.isVisible("text=Usted es"), "no se ve Mi camino");
    await p.waitForSelector(".ah .badge"); assert((await p.textContent(".ah .badge")) === "2", "el contador de mensajes no es 2");
    await p.click(".menudd .dd-btn"); await p.click('.dd-item[data-v="mensajes"]'); await idle(p);
    await p.click('[data-i="0"]'); await p.waitForTimeout(500); await closeTop(p); await idle(p);
    assert((await p.textContent(".ah .badge")) === "1", "no bajó el contador al leer");
    await p.click(".menudd .dd-btn"); await p.click('.dd-item[data-v="iglesia"]'); await idle(p);
    await p.click("#listen");
    await p.click(".menudd .dd-btn"); await p.click('.dd-item[data-v="datos"]');
    await p.fill("#dphone", ""); await top(p).locator("#dsave").click(); await toast(p, /teléfono/);
    await top(p).locator('[data-ch="correo"]').click(); await p.fill("#demail", ""); await top(p).locator("#dsave").click(); await toast(p, /correo/);
    await top(p).locator('[data-ch="app"]').click(); await p.fill("#dbday", "1968-05-03"); await top(p).locator("#dsave").click(); await toast(p, /guardados/);
    await p.click(".menudd .dd-btn"); await p.click('.dd-item[data-v="wa"]');
    assert((await p.evaluate(() => window.__opened)).some((u) => u.includes("chat.whatsapp.com")), "no abrió la comunidad de WhatsApp");
  });
  await test("miembro con cumpleaños: bienvenida, saludo y datos", async (p) => {
    await login(p, "cumple");
    await p.waitForSelector("text=¡Bienvenido a Kaleos!", { timeout: 4000 });
    assert(await p.isVisible(".banner.bday"), "no aparece el saludo de cumpleaños");
    await p.fill("#dphone", "5555 0000"); await top(p).locator("#dsave").click(); await toast(p, /guardados/);
  });
  await test("miembro: no puede escanear ni ver la Central", async (p) => {
    await login(p, "miembro");
    await p.click(".menudd .dd-btn");
    const items = await p.locator(".menudd .dd-item").allTextContents();
    assert(!items.some((t) => /asistencia|Central|pastor/i.test(t)), "el miembro ve opciones que no le tocan: " + items.join(", "));
  });

  console.log("\nPastor");
  await test("pastor: asistente (resumen, sugerencias, preguntas escritas, recordatorio)", async (p) => {
    await login(p, "pastor");
    for (const k of ["pedidos", "cumple", "hoy"]) { await p.click(`.brief [data-ask="${k}"]`); await p.waitForFunction(() => !document.querySelector(".typing")); }
    for (const k of ["hoy", "cumple", "pedidos", "aviso", "versiculo"]) { await p.click(`.sugg [data-ask="${k}"]`); await p.waitForFunction(() => !document.querySelector(".typing")); }
    const html = await p.innerHTML("#chat");
    assert(!html.includes("<i>central</i>"), "el lugar de una actividad se pintó como HTML (falta escapar)");
    await p.fill("#askq", "recuérdame llamar a Juan"); await p.click("#askf .send");
    await p.waitForSelector('[data-rem="1"]'); await p.locator('[data-rem="1"]').last().click(); await p.waitForSelector("text=Guardado.");
    await p.fill("#askq", "recordatorio comprar pan"); await p.press("#askq", "Enter");
    await p.locator('[data-remedit="1"]').last().click(); await p.fill("#rt3", "15:30"); await top(p).locator("#rok").click(); await toast(p, /guardado/i);
    await p.fill("#askq", "hola"); await p.press("#askq", "Enter"); await p.waitForSelector("text=Esto puedo hacer");
    await p.locator('.msg.k [data-ann="1"]').last().click(); await p.waitForSelector(".drawer.show #at"); await closeTop(p);
    await p.locator('.msg.k [data-vers="1"]').last().click(); await p.waitForSelector(".studio");
  }, { allow: [/kaleos-asistente|non-2xx|503/] });
  await test("pastor: asistente abre tarjeta de cumpleaños y lleva a pedidos", async (p) => {
    await login(p, "pastor");
    await p.click('.sugg [data-ask="cumple"]'); await p.waitForSelector(".msg.k [data-card]");
    await p.locator(".msg.k [data-card]").first().click(); await p.waitForSelector(".sheet.show canvas.gcard"); await closeTop(p);
    await p.click('.sugg [data-ask="pedidos"]'); await p.waitForSelector('.msg.k [data-go="pedidos"]');
    await p.locator('.msg.k [data-go="pedidos"]').last().click(); await p.waitForSelector(".req");
  });
  await test("pastor: voz sin clave cae al modo básico o avisa, sin romperse", async (p) => {
    await login(p, "pastor");
    await p.click("#voz"); await p.waitForTimeout(800);
    if (await p.isVisible(".voz #vend")) await p.click(".voz #vend");
    await p.waitForTimeout(400);
    assert(!(await p.locator(".voz").count()), "la pantalla de voz no se cerró");
  }, { allow: [/kaleos-voz|non-2xx|503/] });
  await test("pastor: estudio de versículos (todas las opciones y publicar)", async (p) => {
    await login(p, "pastor");
    await pick(p, '[data-dd="psec"]', "versiculos");
    await pick(p, '[data-dd="verse"]', "3");
    // Estudio (lo primero que ve): elegir plantillas, colores y sorpréndame
    await p.waitForSelector("#vest [data-et]");
    for (let i = 0; i < 3; i++) await p.locator("#vest [data-et]").nth(i * 5).click();
    await p.locator("#vest [data-eh]").nth(1).click(); await p.click("#vrnd");
    await p.click('[data-vm="clasico"]');
    for (const k of ["luz", "aurora", "olas", "lienzo", "cumbres"]) { await p.click(`[data-st="${k}"]`); }
    for (const c of ["olivo", "lino", "alba"]) await p.click(`[data-sp="${c}"]`);
    for (const l of ["editorial", "monumental", "clasico"]) await p.click(`[data-sl="${l}"]`);
    for (const f of ["post", "historia", "cuadrado"]) await pick(p, '[data-dd="fmt"]', f);
    await p.click("#firma"); await p.click("#vseed");
    await pick(p, '[data-dd="verse"]', "custom");
    await p.click("#vpub"); await toast(p, /Escriba el versículo/);
    await p.fill("#cref", "Juan 11:35"); await p.fill("#ctext", "Jesús lloró.");
    await p.click("#vpub"); await toast(p, /Publicado/);
    await p.click("#vwa"); await p.waitForTimeout(300);
    await noOverflow(p, "versículos");
  });
  await test("pastor: pedidos (filtrar, estados, visita, tarjeta, reabrir)", async (p) => {
    await login(p, "pastor");
    await pick(p, '[data-dd="psec"]', "pedidos");
    for (const f of ["oracion", "visita", "felicitacion", "otro", "todos"]) await pick(p, '[data-dd="reqF"]', f);
    await p.click('[data-rs="1:orando"]'); await toast(p, /Actualizado/); await idle(p);
    await p.click('[data-visit="2"]'); await p.fill("#vn", "Oramos juntos"); await top(p).locator("#vs").click(); await toast(p, /Visita registrada|atendido/); await idle(p);
    await p.click('[data-card="3"]'); await p.waitForSelector(".sheet.show canvas.gcard");
    for (const t of ["noche", "marfil", "fiesta", "olivo"]) await top(p).locator(`[data-tpl="${t}"]`).click();
    await top(p).locator("#ov").click(); await p.waitForTimeout(300);
    await top(p).locator("#go").click(); await toast(p, /Enviado|atendido/); await idle(p);
    await p.locator('[data-rs$=":nueva"]').first().click(); await toast(p, /Actualizado/);
  });
  await test("pastor: agenda (días, recordatorio, hecho, felicitar, aviso)", async (p) => {
    await login(p, "pastor");
    await pick(p, '[data-dd="psec"]', "agenda");
    const hs = await p.locator(".ev .h").allTextContents();
    const pend = hs.indexOf("Pendiente"), times = hs.filter((h) => /\d/.test(h));
    assert(pend === -1 || pend === 0, "lo pendiente no va primero: " + hs.join(" | "));
    const mins = times.map((h) => { const m = h.match(/(\d+):(\d+)\s*([ap])/i); return m ? (+m[1] % 12 + (m[3].toLowerCase() === "p" ? 12 : 0)) * 60 + +m[2] : 0; });
    assert(mins.every((v, i) => !i || v >= mins[i - 1]), "las horas del día no van en orden: " + hs.join(" | "));
    await p.click("#newrem"); await top(p).locator("#rok").click(); await toast(p, /Escriba/);
    await p.fill("#rt1", "Orar por la familia Pérez"); await top(p).locator("#rok").click(); await toast(p, /guardado/); await idle(p);
    await p.locator("[data-done]").first().click(); await idle(p);
    const days = p.locator("[data-day]");
    for (let i = 0; i < 7; i++) { await days.nth(i).click(); await idle(p); }
    await days.nth(2).click(); await idle(p);
    if (await p.locator("[data-bday]").count()) { await p.locator("[data-bday]").first().click(); await p.waitForSelector(".sheet.show canvas.gcard"); await closeTop(p); }
    await p.click("#newann"); await p.fill("#at", "Culto especial"); await top(p).locator("#apub").click(); await toast(p, /Publicado/); await idle(p);
    assert(await p.isVisible(".ev:has-text('Culto especial')"), "el aviso nuevo no aparece en la agenda");
  });
  await test("pastor: hermanos (buscar, ficha, nivel, nota, visita, editar, PIN, agregar)", async (p) => {
    await login(p, "pastor");
    await pick(p, '[data-dd="psec"]', "hermanos");
    await p.fill("#hq", "zzz"); assert(await p.isVisible("text=Nadie con ese nombre"), "la búsqueda no filtra");
    await p.fill("#hq", "pedro"); await p.click('[data-person="p-03"]'); await p.waitForSelector(".sheet.show .facts");
    await top(p).locator("#bsave").click(); await toast(p, /Escriba la nota/);
    await p.fill("#bnote", "Llamó para dar gracias"); await top(p).locator("#bsave").click(); await toast(p, /Nota guardada/);
    await p.waitForSelector(".sheet.show >> text=Llamó para dar gracias");
    await top(p).locator("#bvis").click(); await top(p).locator("#vs").click(); await toast(p, /Visita registrada/);
    await p.waitForSelector(".sheet.show .facts", { timeout: 4000 });
    assert(await p.locator(".sheet.show").count() === 1, "quedaron hojas encimadas");
    await pick(p, '.sheet.show [data-dd="plv"]', "lider"); await toast(p, /Ahora es Líder/); await idle(p);
    await p.click('[data-person="p-03"]'); await p.waitForSelector(".sheet.show .facts");
    await top(p).locator("#bpin").click(); await p.waitForSelector("text=Tarjeta lista"); await top(p).locator("#cp").click(); await toast(p, /copiado/); await closeTop(p);
    await p.click('[data-person="p-03"]'); await p.waitForSelector(".sheet.show .facts");
    await top(p).locator("#bed").click(); await p.waitForSelector("#esave");
    await top(p).locator('#ec .chip[data-k="9"]').click(); await p.fill("#eo", "Nota de prueba");
    await top(p).locator("#esave").click(); await toast(p, /Cambios guardados/); await idle(p);
    await p.fill("#hq", ""); await p.click("#add"); await p.waitForSelector("#esave");
    await top(p).locator("#esave").click(); await toast(p, /nombre/);
    await p.fill("#en", "Lucía Nueva"); await p.selectOption("#er", "usher"); await p.fill("#ew", "2010-02-14");
    await top(p).locator("#esave").click(); await p.waitForSelector("text=Tarjeta lista");
    await p.waitForSelector(".sheet.show >> text=LL-0010");
  });
  await test("pastor: comunidades (pestañas, aviso para la comunidad, orientación)", async (p) => {
    await login(p, "pastor");
    await pick(p, '[data-dd="psec"]', "comunidades");
    await p.click('[data-comm="4"]'); await idle(p);
    await p.click("#newann"); await p.fill("#at", "Reunión de oración de damas"); await p.fill("#ad", "2030-01-10"); await p.fill("#ah", "18:00");
    await top(p).locator("#apub").click(); await toast(p, /Damas/); await idle(p);
    assert(await p.isVisible(".ann:has-text('Reunión de oración de damas')"), "el aviso no aparece en la comunidad");
    for (const t of ["reuniones", "integrantes", "orientacion"]) { await p.click(`[data-ct="${t}"]`); await idle(p); }
    await p.click("#orient"); await toast(p, /Escriba/);
    await p.fill("#orientTxt", "Ánimo, hermanas."); await p.click("#orient"); await toast(p, /Orientación publicada/); await idle(p);
    assert(await p.isVisible("q:has-text('Ánimo, hermanas.')"), "no se ve la orientación nueva");
  });
  await test("pastor: saludos (tarjeta, plantillas, enviar, fecha especial, firma)", async (p) => {
    await login(p, "pastor");
    await pick(p, '[data-dd="psec"]', "saludos");
    const n = await p.locator(".list .li").count(); assert(n >= 3, "pocas fechas en saludos: " + n);
    await p.locator(".list .li").first().click(); await p.waitForSelector(".sheet.show canvas.gcard");
    await top(p).locator("#gd").click(); await p.waitForTimeout(300);
    await top(p).locator("#go").click(); await toast(p, /Enviado/); await idle(p);
    assert(await p.locator(".pill.ok:has-text('Enviado')").count(), "no quedó marcado como enviado");
    await p.click("#addsp"); await top(p).locator("#ss").click(); await toast(p, /Escriba/);
    await p.fill("#sl", "Nuevo trabajo"); await p.click("#sy"); await top(p).locator("#ss").click(); await toast(p, /Fecha guardada/); await idle(p);
    await p.fill("#sig", "Pastor Samuel y familia"); await p.click("#ssig"); await toast(p, /Firma guardada/);
  });
  await test("pastor: mayordomía sin diezmo, controles de solo lectura, reporte e iglesia", async (p) => {
    await login(p, "pastor");
    await pick(p, '[data-dd="psec"]', "mayordomia");
    assert(!(await p.locator('[data-gt="diezmos"]').count()), "el pastor ve la pestaña de diezmos");
    await p.click('[data-give="proyecto|2"]'); await p.fill("#ga", "200"); await top(p).locator("#gok").click(); await p.waitForSelector("text=Recibo digital"); await closeTop(p);
    await pick(p, '[data-dd="psec"]', "controles");
    for (const t of ["estadisticas", "proyectos", "ingresos"]) { await p.click(`[data-ctl="${t}"]`); await idle(p); await p.waitForFunction(() => !document.querySelector("#ctlb .loading")); }
    assert(!(await p.locator("[data-conf], #sobre, #newf, [data-fund]").count()), "el pastor puede editar cifras en Controles");
    await pick(p, '[data-dd="psec"]', "reporte");
    await p.fill("#m", "2026-01"); await p.dispatchEvent("#m", "change"); await idle(p);
    await p.click("#pr"); assert(await p.evaluate(() => window.__printed), "no imprimió");
    await p.click("#send"); await top(p).locator("#cp").click(); await toast(p, /copiado/); await idle(p);
    await p.waitForSelector("text=Enviado al");
    await pick(p, '[data-dd="psec"]', "iglesia");
    await p.click("#pub"); await toast(p, /Escriba el aviso/);
    await p.fill("#nb", "Ayuno el sábado."); await p.click("#pub"); await toast(p, /Aviso publicado/); await idle(p);
    await p.fill("#cp", "5555 9999"); await p.click("#sv"); await toast(p, /Datos guardados/);
  });
  await test("pastor: cambiar a la app de miembro y volver", async (p) => {
    await login(p, "pastor");
    await p.click('[data-dd="umenu"] .dd-btn'); await p.click('.dd-item[data-v="mode:member"]'); await p.waitForSelector(".mc"); await idle(p);
    await p.click('[data-dd="umenu"] .dd-btn'); await p.click('.dd-item[data-v="mode:pastor"]'); await p.waitForSelector(".greet");
    await p.reload(); await p.waitForSelector(".greet");
  });

  console.log("\nAsistente (lo que entiende)");
  // [frase, acción esperada, comprobaciones de los datos] — «hoy» es sábado 7 de noviembre de 2026
  const FRASES = [
    ["Hola", "ayuda"], ["Buenos días", "ayuda"], ["¿Qué puedes hacer?", "ayuda"], ["ayuda", "ayuda"], ["Gracias", "responder"], ["Muchas gracias, Kaleos", "responder"],
    ["¿Qué tengo hoy?", "hoy", { dia: "2026-11-07", dias: 1 }], ["¿Qué tengo mañana?", "hoy", { dia: "2026-11-08" }], ["¿Qué hay pasado mañana?", "hoy", { dia: "2026-11-09" }],
    ["¿Qué tengo el martes?", "hoy", { dia: "2026-11-10" }], ["agenda del miércoles", "hoy", { dia: "2026-11-11" }], ["Agenda de la semana", "hoy", { dias: 7 }],
    ["¿Qué tengo el fin de semana?", "hoy", { dias: 2 }], ["¿Qué hay el 20 de noviembre?", "hoy", { dia: "2026-11-20" }], ["¿Tengo algo el 3 de enero?", "hoy", { dia: "2027-01-03" }],
    ["¿Qué toca el viernes?", "hoy", { dia: "2026-11-13" }], ["el domingo", "hoy", { dia: "2026-11-08" }], ["mis pendientes de hoy", "hoy", { dia: "2026-11-07" }],
    ["¿Quién cumple años esta semana?", "cumple", { dias: 7 }], ["¿Quién cumple este mes?", "cumple", { dias: 31 }], ["cumpleaños de hoy", "cumple", { dias: 1 }], ["cumpleaños", "cumple", { dias: 8 }],
    ["¿Cuándo cumple Pedro?", "buscar", { dato: "cumple", who: "Pedro Ajú" }], ["Felicita a Marta", "tarjeta", { who: "Marta Xicará" }], ["Prepárale una tarjeta a Ana Lucía", "tarjeta", { who: "Ana Lucía Pérez" }],
    ["Mándale una felicitación a la hermana Esther", "tarjeta", { who: "Esther Quiché" }], ["felicita a José Tzoc por su aniversario de bodas", "tarjeta", { who: "José Tzoc" }],
    ["Pedidos pendientes", "pedidos", { tipo: null }], ["¿Tengo visitas pendientes?", "pedidos", { tipo: "visita" }], ["Pedidos de oración", "pedidos", { tipo: "oracion" }], ["¿Quién pidió oración?", "pedidos", { tipo: "oracion" }],
    ["Recuérdame llamar al hermano Pedro mañana a las 10 de la mañana", "recordatorio", { title: "Llamar al hermano Pedro", when: "2026-11-08T10:00" }],
    ["Recuérdame comprar el pan para la Santa Cena el viernes a las 5", "recordatorio", { title: "Comprar el pan para la Santa Cena", when: "2026-11-13T17:00" }],
    ["Anota visitar a la familia Tzoc el lunes", "recordatorio", { title: "Visitar a la familia Tzoc", when: "2026-11-09T09:00" }],
    ["recordatorio: reunión con los diáconos el 15 de noviembre a las 7:30 pm", "recordatorio", { title: "Reunión con los diáconos", when: "2026-11-15T19:30" }],
    ["no me dejes olvidar el informe del distrito el 30/11", "recordatorio", { title: "Informe del distrito", when: "2026-11-30T09:00" }],
    ["apúntame orar por los enfermos a las 9 de la noche", "recordatorio", { title: "Orar por los enfermos" }],
    ["Prepara un aviso de vigilia de oración para el viernes a las 7 en el templo", "aviso", { title: "Vigilia de oración", when: "2026-11-13T19:00", place: "templo" }],
    ["Invita a los jóvenes a la noche de fogata el sábado a las 6 de la tarde", "aviso", { title: "Noche de fogata", community: "emergente", when: "2026-11-14T18:00" }],
    ["Haz un anuncio para las damas: reunión el martes a las 3 en el salón", "aviso", { title: "Reunión", community: "damas", when: "2026-11-10T15:00", place: "salón" }],
    ["convoca a los diáconos a reunión mañana en la noche", "aviso", { community: "diaconos", when: "2026-11-08T19:00" }],
    ["anuncia a toda la iglesia que el domingo hay Santa Cena", "aviso", { title: "Santa Cena", date: "2026-11-08" }],
    ["aviso de ayuno el miércoles", "aviso", { title: "Ayuno", date: "2026-11-11" }],
    ["Prepara la semana de oración", "aviso", { pieza: "oracion" }], ["Prepara el aviso del culto de misiones", "aviso", { pieza: "misiones" }],
    ["Aviso de discipulado", "aviso", { pieza: "discipulado" }], ["haz el aviso del discipulado infantil", "aviso", { pieza: "infantil" }],
    ["Aviso: el hermano Daniel está enfermo, oremos por su salud", "aviso", { warn: true }],
    ["Hazme una imagen con Juan 3:16", "versiculo", { ref: "Juan 3:16" }], ["filipenses 4 13 en estilo cruz", "versiculo", { ref: "Filipenses 4:13", estilo: "cruz" }],
    ["1 pedro 2:9", "versiculo", { ref: "1 Pedro 2:9" }], ["salmo 23", "versiculo", { ref: "Salmos 23:1" }], ["Versículo de fe", "versiculo", { tema: "fe" }],
    ["Un versículo de paz en estilo vitral color esmeralda", "versiculo", { tema: "paz", estilo: "vitral", color: "esmeralda" }],
    ["Diseña el salmo 23 para estado de WhatsApp", "versiculo", { formato: "historia" }], ["Imagen del tema del mes", "versiculo", { ref: "Juan 14:1" }],
    ["Sorpréndeme con un versículo", "versiculo", { azar: true }], ["un versículo para los niños", "versiculo", { tema: "ninos" }], ["versículo de misiones con los colores de la iglesia", "versiculo", { tema: "misiones", color: "linea" }],
    ["¿Cuánto llevamos de ofrendas?", "cifras"], ["¿Cómo van los proyectos?", "cifras"], ["diezmos del mes", "cifras"],
    ["Abre la agenda", "ir", { seccion: "agenda" }], ["Ir a hermanos", "ir", { seccion: "hermanos" }], ["Muéstrame los pedidos", "ir", { seccion: "pedidos" }], ["abre saludos", "ir", { seccion: "saludos" }],
    ["Teléfono de José Tzoc", "buscar", { dato: "telefono", who: "José Tzoc" }], ["¿Quién es Esther?", "buscar", { who: "Esther Quiché" }], ["Busca a Daniel", "buscar", { who: "Daniel Coyoy" }],
    ["nivel de Ana Lucía", "buscar", { dato: "nivel", who: "Ana Lucía Pérez" }], ["Pedro Ajú", "buscar", { who: "Pedro Ajú" }],
    ["Saludo de buenos días para el grupo", "saludo_dia"], ["el mensaje de la mañana", "saludo_dia"],
    ["Responde a la hermana Ana", "contestar", { who: "Ana Lucía Pérez" }], ["Agradécele a Pedro", "contestar", { who: "Pedro Ajú", gracias: true }], ["contesta a Esther", "contestar", { who: "Esther Quiché" }],
    ["¿A qué hora es el discipulado?", "info", { tema: "horario", reunion: "discipulado" }], ["¿Cuándo es la semana de oración?", "info", { tema: "horario", reunion: "oracion" }],
    ["¿Qué día es el discipulado infantil?", "info", { reunion: "infantil" }], ["¿Cuál es el lema de la iglesia?", "info", { tema: "lema" }], ["¿Dónde queda la iglesia?", "info", { tema: "direccion" }],
    ["¿Cuál es el tema del mes?", "info", { tema: "tema" }], ["¿Qué fechas especiales vienen?", "info", { tema: "calendario" }],
    ["asdfgh", "responder"], ["", "responder"],
  ];
  await test(`asistente: entiende ${FRASES.length} frases (fechas, horas, nombres, comunidades, versículos)`, async (p) => {
    await login(p, "pastor");
    const out = await p.evaluate(async (F) => {
      const people = await K.people(), comms = await K.communities(), bad = [];
      const gt = (v) => new Date(v).toLocaleString("sv-SE", { timeZone: "America/Guatemala" }).slice(0, 16).replace(" ", "T");
      for (const [f, act, want = {}] of F) {
        const r = K.brain.understand(f, { people, comms, today: "2026-11-07", nowMin: 600 }), a = r.args || {};
        const errs = [];
        if (r.action !== act) errs.push(`acción ${r.action}`);
        for (const [k, v] of Object.entries(want)) {
          if (k === "who") { const n = (a.personas || []).map((id) => people.find((x) => x.id === id).full_name); if (n[0] !== v) errs.push(`persona ${n[0]}`); }
          else if (k === "when") { if (!a.when || gt(a.when) !== v) errs.push(`cuando ${a.when && gt(a.when)}`); }
          else if (k === "warn") { if (!r.warn) errs.push("sin advertencia"); }
          else if (k === "title") { if (String(a.title || "").toLowerCase() !== v.toLowerCase()) errs.push(`título «${a.title}»`); }
          else if (k === "place") { if (String(a.place || "").toLowerCase() !== v.toLowerCase()) errs.push(`lugar «${a.place}»`); }
          else if ((a[k] ?? null) !== v) errs.push(`${k}=${JSON.stringify(a[k])}`);
        }
        if (errs.length) bad.push(`«${f}» → ${errs.join(", ")}`);
      }
      return bad;
    }, FRASES);
    assert(!out.length, `No entendió bien ${out.length}:\n    ` + out.join("\n    "));
  });
  await test("asistente: cada respuesta se ve y sus botones funcionan", async (p) => {
    await login(p, "pastor");
    const say = async (q) => { await p.fill("#askq", q); await p.press("#askq", "Enter"); await p.waitForFunction(() => !document.querySelector(".typing")); await p.waitForTimeout(60); };
    const last = (sel) => p.locator(`.msg.k`).last().locator(sel);
    for (const q of ["hola", "¿qué tengo mañana?", "agenda de la semana", "¿quién cumple este mes?", "pedidos de oración", "¿cuánto llevamos de ofrendas?", "¿a qué hora es el discipulado?",
      "¿cuál es el lema de la iglesia?", "¿dónde queda la iglesia?", "¿cuál es el tema del mes?", "¿qué fechas especiales vienen?", "teléfono de José Tzoc", "asdfgh"]) {
      await say(q);
      const txt = await p.locator(".msg.k").last().innerText();
      assert(txt.trim().length > 10 && !/undefined|NaN|null|\[object/.test(txt), `«${q}» respondió mal: ${txt.slice(0, 160)}`);
    }
    // saludo de la mañana: imagen + compartir y copiar
    await say("saludo de buenos días para el grupo");
    await p.waitForFunction(() => { const c = [...document.querySelectorAll(".msg.k canvas[data-vc]")].pop(); return c && c.width === 1080; });
    await last('[data-copy="1"]').click(); await toast(p, /copiado/i);
    await last('[data-share="1"]').click(); await p.waitForTimeout(400);
    // contestar a una hermana en el tono del pastor
    await say("responde a la hermana Ana");
    const r1 = await p.locator(".msg.k").last().innerText();
    assert(/estimada hermana Ana/.test(r1) && /con usted y familia/.test(r1), "la respuesta no tiene el tono del pastor: " + r1.slice(0, 200));
    await say("agradécele a Pedro");
    assert(/Muchas gracias/.test(await p.locator(".msg.k").last().innerText()), "no agradeció");
    await last("[data-wa]").click(); assert((await p.evaluate(() => window.__opened.pop())).includes("wa.me"), "no abrió WhatsApp");
    // buscar y abrir ficha
    await say("¿quién es Esther?"); await last("[data-person]").click(); await p.waitForSelector(".sheet.show"); await closeTop(p);
    // versículo con estilo y color: se ve en el chat y se abre en el estudio
    await say("salmo 23 en estilo vitral color esmeralda para estado de whatsapp");
    await p.waitForFunction(() => { const c = [...document.querySelectorAll(".msg.k canvas[data-vc]")].pop(); return c && c.height === 1920; });
    assert(await p.evaluate(() => K.P.studio.kind === "vitral" && K.P.studio.pal === "esmeralda"), "no aplicó el estilo y el color");
    await last('[data-vers="1"]').click(); await p.waitForSelector(".studio");
    await pick(p, '[data-dd="psec"]', "asistente");
    // versículo que no está en la biblioteca: pide el texto
    await say("romanos 12 2"); assert(/No tengo el texto/.test(await p.locator(".msg.k").last().innerText()), "debió pedir el texto");
    // aviso fijo con fecha calculada
    await say("prepara la semana de oración");
    const t2 = await p.locator(".msg.k").last().innerText();
    assert(/Semana de Oración/.test(t2) && /lunes/i.test(t2), "la Semana de Oración no trae su fecha: " + t2.slice(0, 200));
    await last('[data-ann="1"]').click(); await p.waitForSelector(".drawer.show #at");
    assert((await p.inputValue("#ah")) === "19:00" && /\d{4}-\d{2}-\d{2}/.test(await p.inputValue("#ad")), "el editor no recibió fecha y hora");
    await closeTop(p);
    // aviso con advertencia de privacidad
    await say("aviso: la hermana Marta está en el hospital, oremos por su salud");
    assert(/en privado/.test(await p.locator(".msg.k").last().innerText()), "faltó la advertencia de privacidad");
    // tarjeta para alguien sin cumpleaños registrado
    await say("felicita a Daniel Coyoy"); await last("[data-card]").click(); await p.waitForSelector(".sheet.show canvas.gcard"); await closeTop(p);
    // abrir una sección
    await say("abre la agenda"); await p.waitForSelector(".tl, .agenda, [data-dd='psec']"); await p.waitForTimeout(500);
    assert(await p.evaluate(() => K.P.sec === "agenda"), "no abrió la agenda");
  }, { allow: [/kaleos-asistente|non-2xx|503/] });
  await test("asistente: las reuniones fijas calculan bien su fecha", async (p) => {
    await login(p, "pastor");
    const r = await p.evaluate(() => ({
      or1: K.nextMeeting("oracion", "2026-11-07").date, or2: K.nextMeeting("oracion", "2026-11-03").date, or3: K.nextMeeting("oracion", "2026-12-01").date,
      mi1: K.nextMeeting("misiones", "2026-11-07").date, mi2: K.nextMeeting("misiones", "2026-12-28").date,
      di1: K.nextMeeting("discipulado", "2026-11-07").date, inf: K.nextMeeting("infantil", "2026-11-07").date, jo: K.nextMeeting("jovenes", "2026-11-08").date,
      tema: K.temaDelMes("2026-11-15"), sinTema: K.temaDelMes("2027-03-02"), fechas: K.fechasIglesia("2026-10-25", 10).map((x) => x.n),
    }));
    const want = { or1: "2026-12-07", or2: "2026-11-02", or3: "2026-12-07", mi1: "2026-11-29", mi2: "2027-01-31", di1: "2026-11-12", inf: "2026-11-10", jo: "2026-11-14" };
    for (const [k, v] of Object.entries(want)) assert(r[k] === v, `${k}: ${r[k]} en vez de ${v}`);
    assert(r.tema && r.tema.ref === "Juan 14:1" && r.sinTema === null, "tema del mes");
    assert(r.fechas.includes("Día de la Reforma Protestante"), "faltó la Reforma Protestante en el calendario");
  });

  console.log("\nDiseños");
  await test("diseños: los 1.105 de versículo, aviso y tarjeta se dibujan sin errores y con contenido", async (p) => {
    await login(p, "pastor");
    const r = await p.evaluate(async () => {
      await K.cardReady();
      const ks = Object.keys(K.ART_KINDS), ps = Object.keys(K.PAL), LS = Object.keys(K.LAYOUTS), AL = Object.keys(K.ANN_LAYOUTS), FR = Object.keys(K.CARD_FRAMES);
      const c = document.createElement("canvas"), bad = [], counts = { verse: 0, ann: 0, card: 0 };
      // ¿hay contenido? mira la variación de brillo en una franja central (texto sobre fondo)
      const busy = () => { const x = c.getContext("2d"), d = x.getImageData(0, 0, c.width, c.height).data; let mn = 255, mx = 0; for (let i = 0; i < d.length; i += 4 * 97) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; mn = Math.min(mn, v); mx = Math.max(mx, v); } return mx - mn > 90; };
      const fmts = ["cuadrado", "post", "historia"];
      let n = 0;
      for (const k of ks) for (const pl of ps) {
        for (const l of LS) {
          const v = K.VERSES[n % K.VERSES.length];
          try { K.drawVerse(c, { text: v[1], ref: v[0], pal: pl, kind: k, layout: l, fmt: fmts[n % 3], firma: n % 2 === 0, seed: (n % 90) + 1 }); counts.verse++; if (!busy()) bad.push(`versículo ${k}/${pl}/${l}: sin contraste`); } catch (e) { bad.push(`versículo ${k}/${pl}/${l}: ${e.message}`); }
          n++;
        }
        for (const l of AL) {
          try { K.drawAnn(c, { id: n, title: n % 2 ? "Semana de Oración y clamor" : "Vigilia", event_at: n % 3 ? new Date(Date.now() + n * 3600000).toISOString() : null, place: n % 4 ? "Templo La Línea" : "", art: { k, p: pl, s: (n % 90) + 1, l } }); counts.ann++; if (!busy()) bad.push(`aviso ${k}/${pl}/${l}: sin contraste`); } catch (e) { bad.push(`aviso ${k}/${pl}/${l}: ${e.message}`); }
          n++;
        }
        for (const f of FR) {
          try { K.renderCard(c, K.designTpl(k, pl, f), { kicker: "7 de noviembre", headline: "¡Feliz cumpleaños!", line: "Damos gracias a Dios por su vida", name: n % 2 ? "Hna. María Fernanda López de García" : "Hno. Luis Ajú", verse: "Jehová te bendiga, y te guarde.", ref: "Números 6:24", date: "2026-11-07", signature: "Pastor Samuel", from: "y toda la familia de La Línea", church: "Iglesia de Dios E.C. · La Línea", seed: "s" + n }); counts.card++; if (!busy()) bad.push(`tarjeta ${k}/${pl}/${f}: sin contraste`); } catch (e) { bad.push(`tarjeta ${k}/${pl}/${f}: ${e.message}`); }
          n++;
        }
      }
      for (const t of Object.keys(K.TEMPLATES)) { try { K.renderCard(c, t, { kicker: "x", headline: "¡Feliz cumpleaños!", line: "y", name: "Hno. Luis", verse: "v", ref: "r", date: "2026-11-07", signature: "s", from: "f", church: "c", seed: t }); counts.card++; } catch (e) { bad.push(`clásica ${t}: ${e.message}`); } }
      return { bad, counts, total: K.CARD_DESIGNS };
    });
    assert(!r.bad.length, `${r.bad.length} diseños con problemas:\n    ` + r.bad.slice(0, 15).join("\n    "));
    assert(r.counts.verse >= 1000 && r.counts.ann >= 1000 && r.counts.card >= 1000, "menos de 1.000 diseños: " + JSON.stringify(r.counts));
    console.log(`    dibujados: ${r.counts.verse} versículos, ${r.counts.ann} avisos, ${r.counts.card} tarjetas`);
  }, { allow: [/willReadFrequently/] });
  await test("diseños: tarjeta (clásicas, Azul/Rosa según el trato, 1.105 Kaleos, sorpréndame) y envío", async (p) => {
    await login(p, "pastor");
    await pick(p, '[data-dd="psec"]', "saludos");
    await p.locator(".list [data-i]").first().click(); await p.waitForSelector(".sheet.show canvas.gcard");
    const def = await p.evaluate(() => document.querySelector('.sheet.show [data-tpl].on').dataset.tpl);
    assert(def === "estudio", "la tarjeta no abre en el Estudio: " + def);
    for (const t of ["noche", "marfil", "fiesta", "olivo", "azul", "rosa", "design"]) await top(p).locator(`[data-tpl="${t}"]`).click();
    assert(await top(p).locator("#dz").isVisible(), "no se ven los diseños Kaleos");
    await top(p).locator("#dzk").selectOption("vitral"); await top(p).locator("#dzp").selectOption("linea"); await top(p).locator("#dzf").selectOption("arco");
    for (let i = 0; i < 5; i++) await top(p).locator("#dzr").click();
    assert(/1\.111|1,111|1 111/.test(await top(p).locator("#dz").innerText()), "no dice cuántos diseños hay");
    const msg = await top(p).locator("#gm").inputValue();
    assert(/con usted y familia|Bendiciones|Felicidades|aniversario/i.test(msg) && !/undefined/.test(msg), "mensaje raro: " + msg.slice(0, 120));
    await p.waitForTimeout(1200); await top(p).locator("#go").click(); await toast(p, /Enviado/);
    const sent = await p.evaluate(() => __MOCK.db.tables.kaleos_messages.filter((m) => m.card).pop().card.tpl);
    assert(/^d:/.test(sent), "no guardó el diseño elegido: " + sent);
  });
  await test("diseños: Estudio en la tarjeta (familias, plantillas, colores, foto del celular) y envío", async (p) => {
    await login(p, "pastor");
    await pick(p, '[data-dd="psec"]', "saludos");
    await p.locator(".list [data-i]").first().click(); await p.waitForSelector(".sheet.show #estp [data-et]");
    const fams = await top(p).locator("#estp [data-ef]").count();
    assert(fams >= 8, "faltan familias en el Estudio: " + fams);
    await top(p).locator('#estp [data-ef="sagrada"]').click();
    assert((await top(p).locator("#estp [data-et]").count()) === 6, "la familia no filtra");
    await top(p).locator("#estp [data-et]").nth(2).click(); await top(p).locator("#estp [data-eh]").nth(3).click();
    await top(p).locator('#estp [data-ef=""]').click();
    for (let i = 0; i < 3; i++) await top(p).locator("#estp [data-er]").click();
    const [fc] = await Promise.all([p.waitForEvent("filechooser"), top(p).locator('#estp [data-ep="@cel"]').click()]);
    await fc.setFiles(require("path").join(__dirname, "..", "docs", "img", "icon-512.png"));
    await p.waitForSelector('.sheet.show #estp [data-ep="@cel"][aria-pressed="true"]');
    await noOverflow(p, "estudio de tarjeta");
    await p.waitForTimeout(1500); await top(p).locator("#go").click(); await toast(p, /Enviado/);
    const sent = await p.evaluate(() => __MOCK.db.tables.kaleos_messages.filter((m) => m.card).pop().card.tpl);
    assert(/^e:[a-z]{3}-[a-z]+:[a-z]+$/.test(sent), "no guardó el diseño del Estudio: " + sent);
  }, { mobile: true });
  await test("diseños: las 42 plantillas del Estudio × sus colores se dibujan en tarjeta, aviso y versículo", async (p) => {
    await login(p, "pastor");
    const r = await p.evaluate(async () => {
      await K.cardReady(); await K.EST.ready(); await document.fonts.ready;
      const c = document.createElement("canvas"), bad = [], counts = { card: 0, ann: 0, verse: 0 };
      const busy = () => { const x = c.getContext("2d"), d = x.getImageData(0, 0, c.width, c.height).data; let mn = 255, mx = 0; for (let i = 0; i < d.length; i += 4 * 97) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; mn = Math.min(mn, v); mx = Math.max(mx, v); } return mx - mn > 90; };
      const card = { kicker: "7 de noviembre", headline: "¡Feliz cumpleaños!", line: "Damos gracias a Dios por su vida", name: "Hna. María Fernanda López de García", verse: "Jehová te bendiga, y te guarde.", ref: "Números 6:24", signature: "Pastor Marvin Miche", from: "y toda la familia de La Línea", seed: "x" };
      const fmts = ["cuadrado", "post", "historia"]; let n = 0;
      for (const t of Object.values(K.EST.T)) for (const th of Object.keys(t.themes)) {
        const key = K.EST.key(t.id, th);
        try { K.renderCard(c, key, card); counts.card++; if (!busy()) bad.push(`tarjeta ${key}`); } catch (e) { bad.push(`tarjeta ${key}: ${e.message}`); }
        try { K.drawAnn(c, { id: n, title: "Vigilia de oración", event_at: n % 3 ? new Date(Date.now() + n * 3600000).toISOString() : null, place: "Templo La Línea", art: { e: t.id, t: th } }); counts.ann++; if (!busy()) bad.push(`aviso ${key}`); } catch (e) { bad.push(`aviso ${key}: ${e.message}`); }
        try { K.drawVerse(c, { text: K.VERSES[n % K.VERSES.length][1], ref: K.VERSES[n % K.VERSES.length][0], est: key, fmt: fmts[n % 3], firma: true }); counts.verse++; if (!busy()) bad.push(`versículo ${key}`); } catch (e) { bad.push(`versículo ${key}: ${e.message}`); }
        n++;
      }
      return { bad, counts, n: Object.keys(K.EST.T).length };
    });
    assert(!r.bad.length, `${r.bad.length} diseños con problemas:\n    ` + r.bad.slice(0, 15).join("\n    "));
    assert(r.n >= 42 && r.counts.card >= 210, "faltan plantillas: " + JSON.stringify(r));
    console.log(`    Estudio: ${r.n} plantillas · ${r.counts.card} tarjetas, ${r.counts.ann} avisos, ${r.counts.verse} versículos`);
  }, { allow: [/willReadFrequently/] });
  await test("diseños: editor de avisos (plantillas de la iglesia, 13 estilos, 5 composiciones, sorpréndame)", async (p) => {
    await login(p, "pastor");
    await p.evaluate(() => K.annSheet()); await p.waitForSelector(".drawer.show #at");
    const n = await p.locator(".drawer.show [data-pc]").count();
    assert(n >= 5, "faltan plantillas de la iglesia: " + n);
    for (let i = 0; i < n; i++) {
      await p.locator(".drawer.show [data-pc]").nth(i).click();
      assert((await p.inputValue("#at")).length > 3, "la plantilla no llenó el título");
    }
    await p.locator('.drawer.show [data-pc]').nth(1).click();
    assert(await p.locator(".drawer.show #aest [data-et]").count() >= 42, "el aviso no abre en el Estudio");
    await p.click('.drawer.show [data-am="clasico"]');
    for (const k of ["estrellas", "vitral", "trigal", "acuarela", "petalos", "cruz", "geometria", "papiro"]) await p.click(`.drawer.show [data-s="${k}"]`);
    for (const l of ["centro", "cinta", "marco", "agenda", "fecha"]) await p.click(`.drawer.show [data-l="${l}"]`);
    await p.click(".drawer.show [data-p='linea']");
    for (let i = 0; i < 4; i++) await p.click("#arnd");
    await noOverflow(p, "editor de avisos");
    await p.click("#apub"); await toast(p, /Publicado/);
    const art = await p.evaluate(() => __MOCK.db.tables.kaleos_messages.filter((m) => m.art).pop().art);
    assert(art.l && art.k && art.p, "no guardó la composición: " + JSON.stringify(art));
    // y con el Estudio: guarda plantilla y color
    await p.evaluate(() => K.annSheet()); await p.waitForSelector(".drawer.show #aest [data-et]");
    await p.locator(".drawer.show [data-pc]").nth(2).click();
    await p.locator(".drawer.show #aest [data-et]").nth(7).click(); await p.locator(".drawer.show #aest [data-eh]").nth(2).click();
    await noOverflow(p, "editor de avisos (Estudio)");
    await p.click("#apub"); await toast(p, /Publicado/);
    const art2 = await p.evaluate(() => __MOCK.db.tables.kaleos_messages.filter((m) => m.art).pop().art);
    assert(art2.e && art2.t && !art2.k, "no guardó el diseño del Estudio: " + JSON.stringify(art2));
  });
  await test("diseños: estudio de versículos con los 13 estilos, 17 colores y 5 composiciones", async (p) => {
    await login(p, "pastor");
    await pick(p, '[data-dd="psec"]', "versiculos");
    const ks = await p.evaluate(() => Object.keys(K.ART_KINDS)), ps = await p.evaluate(() => Object.keys(K.PAL)), ls = await p.evaluate(() => Object.keys(K.LAYOUTS));
    assert(ks.length === 13 && ps.length === 17 && ls.length === 5, "cantidades distintas");
    await p.click('[data-vm="clasico"]');
    for (const k of ks) await p.click(`[data-st="${k}"]`);
    for (const c of ps) await p.click(`[data-sp="${c}"]`);
    for (const l of ls) await p.click(`[data-sl="${l}"]`);
    for (let i = 0; i < 3; i++) await p.click("#vrnd");
    await noOverflow(p, "estudio");
    await p.click("#vpub"); await toast(p, /Publicado/);
  }, { mobile: true });
  console.log("\nSecretaría");
  await test("secretaría: personas (buscar, filtrar, editar, nuevo hermano)", async (p) => {
    await login(p, "secretaria");
    await p.waitForSelector(".tbl tbody tr");
    await p.fill("#pq", "ana"); assert((await p.locator("#pt tr").count()) === 1, "la búsqueda no filtra");
    await p.fill("#pq", "");
    await pick(p, '[data-dd="plv"]', "neofito"); await pick(p, '[data-dd="pcm"]', "1"); await pick(p, '[data-dd="pcm"]', "todos"); await pick(p, '[data-dd="plv"]', "todos");
    await p.click('[data-row="p-05"]'); await p.waitForSelector(".drawer.show #esave");
    assert(await p.isDisabled("#er"), "Secretaría puede cambiar el perfil (rol)");
    await p.fill("#ep", "4444 5555"); await top(p).locator("#esave").click(); await toast(p, /Cambios guardados/); await idle(p);
    await p.click("#newp"); await p.fill("#en", "Josué Nuevo"); await top(p).locator("#esave").click(); await p.waitForSelector("text=Tarjeta lista");
  });
  await test("secretaría: comunidades (editar y crear)", async (p) => {
    await login(p, "secretaria");
    await p.click('.side [data-cs="comunidades"]'); await idle(p);
    await p.click('[data-row="2"]'); await p.waitForSelector(".drawer.show #csave");
    await p.selectOption("#ce", "p-05"); await p.fill("#cr", "Lunes 19:00"); await p.selectOption("#cp", "mar"); await p.selectOption("#cs", "olas");
    await top(p).locator("#csave").click(); await toast(p, /actualizada/); await idle(p);
    await p.click("#newc"); await top(p).locator("#csave").click(); await toast(p, /nombre/);
    await p.fill("#cn", "Ujieres"); await top(p).locator("#csave").click(); await toast(p, /creada/); await idle(p);
    assert(await p.isVisible("td:has-text('Ujieres')"), "no aparece la comunidad nueva");
  });
  await test("secretaría: agenda y servicios (asignar, agregar, quitar, avisar turnos)", async (p) => {
    await login(p, "secretaria");
    await p.click('.side [data-cs="agenda"]'); await idle(p);
    await p.selectOption('[data-ros="1:worship_id"]', "p-05"); await toast(p, /Turno asignado/);
    await p.fill("#sa", "Santa Cena"); await p.click("#addsv button"); await idle(p);
    assert(await p.isVisible("td:has-text('Santa Cena')"), "no se agregó la actividad");
    await p.locator("tr:has-text('Santa Cena') [data-del]").click(); await idle(p);
    assert(!(await p.isVisible("td:has-text('Santa Cena')")), "no se quitó la actividad");
    await p.click("#notify"); await p.waitForSelector("text=Turnos avisados");
    assert((await top(p).locator(".li").count()) >= 2, "no muestra a quién avisar por WhatsApp");
    await closeTop(p); await idle(p);
    await p.click("#notify"); await toast(p, /No hay turnos/);
  });
  await test("secretaría: avisos (nuevo, ver respuestas, compartir, borrar)", async (p) => {
    await login(p, "secretaria");
    await p.click('.side [data-cs="avisos"]'); await idle(p);
    await p.click("#newa"); await p.fill("#at", "Venta de comida"); await pick(p, '.drawer.show [data-dd="annAud"]', "lv");
    await top(p).locator("#apub").click(); await toast(p, /nivel/);
    await top(p).locator('[data-lv="miembro"]').click(); await top(p).locator("#apub").click(); await toast(p, /Publicado/); await idle(p);
    await p.click('[data-row="101"]'); await p.waitForSelector(".drawer.show #ash");
    await top(p).locator("#ash").click(); await p.waitForTimeout(300);
    await top(p).locator("#adel").click(); await idle(p);
    assert(!(await p.locator('[data-row="101"]').count()), "el aviso no se borró");
  });
  await test("secretaría: informes, asistencia (cámara y número) y reporte", async (p) => {
    await login(p, "secretaria");
    await p.click('.side [data-cs="informes"]'); await idle(p);
    assert(await p.locator(".panel").count() >= 3, "faltan paneles de informes");
    await p.click('.side [data-cs="asistencia"]'); await idle(p);
    await p.fill("#mno", "3"); await p.click("#man button"); await p.waitForSelector(".result >> text=Pedro");
    await p.fill("#mno", "LL-0003"); await p.click("#man button"); await p.waitForSelector("text=Ya estaba registrado");
    await p.fill("#mno", "LL-9999"); await p.click("#man button"); await p.waitForSelector("text=Código no reconocido");
    await p.waitForSelector("text=Hoy van 1");
    await p.click('.side [data-cs="reporte"]'); await idle(p);
    await p.click("#send"); assert(!(await top(p).textContent()).includes("marcado como enviado"), "a Secretaría le promete marcarlo como enviado");
    await top(p).locator("[data-mark]").first().click(); await p.waitForTimeout(700);
    assert(!(await p.locator(".sheet.show").count()), "la hoja de envío no se cerró");
  });
  await test("secretaría: mayordomía (confirmar, movimientos, sobre con decimales, proyectos)", async (p) => {
    await login(p, "secretaria");
    await p.click('[data-cv="mayordomia"]'); await idle(p);
    await p.locator("[data-conf]").first().click(); await toast(p, /Confirmado/); await idle(p);
    await p.locator("[data-conf]").first().click(); await p.waitForTimeout(400); if (await p.locator(".sheet.show").count()) await closeTop(p); await idle(p);
    await p.click('.side [data-cs="movimientos"]'); await idle(p);
    for (const k of ["diezmo", "ofrenda", "todos"]) await pick(p, '[data-dd="mt"]', k);
    await p.click("#sobre"); await p.waitForSelector(".drawer.show #ssave");
    await top(p).locator("#ssave").click(); await toast(p, /monto/);
    await p.selectOption("#sw", "p-03"); await p.selectOption("#stp", "proyecto"); await p.fill("#sa", "75.25"); await p.fill("#sn", "S-777");
    await top(p).locator("#ssave").click(); await toast(p, /Registrado/);
    await p.waitForSelector(".sheet.show >> text=Recibo S-777"); await closeTop(p); await idle(p);
    assert(await p.isVisible("td:has-text('S-777')"), "no aparece el sobre registrado");
    const amt = await p.locator("tr:has-text('S-777') td.r").textContent();
    assert(/75[.,]25|75[.,]3/.test(amt), "el monto con decimales quedó mal: " + amt);
    await p.click('.side [data-cs="proyectos"]'); await idle(p);
    await p.click('[data-fund="1"]'); await p.fill("#fg", "90000.00"); await top(p).locator("#fsave").click(); await toast(p, /Guardado/); await idle(p);
    assert(await p.isVisible("text=de Q 90,000") || await p.isVisible("text=de Q 90 000") || await p.isVisible("text=de Q 90000"), "la meta con decimales quedó mal");
    await p.click("#newf"); await top(p).locator("#fsave").click(); await toast(p, /nombre/);
    await p.fill("#fn", "Becas 2027"); await p.selectOption("#fk", "necesidad"); await p.fill("#fg", "3000"); await top(p).locator("#fsave").click(); await toast(p, /Guardado/);
  });
  await test("secretaría: en el celular usa el menú de secciones y la app de miembro", async (p) => {
    await login(p, "secretaria");
    await pick(p, '[data-dd="csec"]', "avisos");
    await p.click('.mob-nav [data-cv="mayordomia"]'); await idle(p);
    await noOverflow(p, "central en celular");
    await p.click('[data-dd="umenu2"] .dd-btn'); await p.click('[data-dd="umenu2"] .dd-item[data-v="mode:member"]'); await p.waitForSelector(".mc");
    await p.click('[data-mt="dar"]'); await idle(p);
    assert(await p.locator('[data-gt="diezmos"]').count(), "Secretaría (como miembro) no ve diezmos");
  }, { mobile: true });

  // ===== recorrido visual: cada sección, claro y oscuro, celular y escritorio =====
  console.log("\nRecorrido visual");
  const tour = {
    miembro: async (p, tag) => { for (const t of ["inicio", "comunidades", "pedir", "dar", "camino"]) { await p.click(`[data-mt="${t}"]`); await idle(p); await noOverflow(p, t); await shot(p, `${tag}-${t}`); } },
    pastor: async (p, tag) => { for (const s of ["asistente", "versiculos", "pedidos", "agenda", "hermanos", "comunidades", "saludos", "mayordomia", "controles", "reporte", "iglesia"]) { await pick(p, '[data-dd="psec"]', s); await noOverflow(p, s); await shot(p, `${tag}-${s}`); } },
    secretaria: async (p, tag) => {
      for (const v of ["secretaria", "mayordomia"]) {
        const nav = (await p.isVisible(".side")) ? "side" : "mob";
        await p.click(`${nav === "side" ? ".side" : ".mob-nav"} [data-cv="${v}"]`); await idle(p);
        const secs = await p.$$eval(".side [data-cs]", (b) => b.map((x) => x.dataset.cs));
        for (const s of secs) { if (nav === "side") await p.click(`.side [data-cs="${s}"]`); else await pick(p, '[data-dd="csec"]', s); await idle(p); await noOverflow(p, s); await shot(p, `${tag}-${s}`); }
      }
    },
  };
  for (const who of ["miembro", "pastor", "secretaria"]) for (const mobile of [true, false]) for (const dark of [false, true]) {
    const tag = `${who}-${mobile ? "cel" : "pc"}-${dark ? "oscuro" : "claro"}`;
    await test(`recorrido ${tag}`, async (p) => { await login(p, who); await tour[who](p, tag); }, { mobile, dark });
  }
}

(async () => {
  const srv = await serve();
  base = `http://127.0.0.1:${srv.address().port}/`;
  browser = await chromium.launch({ headless: !process.env.HEADED, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
  const t0 = Date.now();
  try { await suites(); } finally { await browser.close(); srv.close(); }
  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length} de ${results.length} pruebas pasaron en ${Math.round((Date.now() - t0) / 1000)} s.`);
  process.exit(bad.length ? 1 : 0);
})();
