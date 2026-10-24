// Servidor estático de Kaleos (sin dependencias). Railway define PORT.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, "docs");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon",
};

// Solo la URL y la clave pública (anon) llegan al navegador
const config = `window.KALEOS_CONFIG=${JSON.stringify({
  url: process.env.SUPABASE_URL || "",
  anonKey: process.env.SUPABASE_ANON_KEY || "",
  church: process.env.KALEOS_CHURCH || "la-linea",
})};`;

const security = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
};

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/config.js") {
    res.writeHead(200, { ...security, "Content-Type": TYPES[".js"], "Cache-Control": "no-store" });
    return res.end(config);
  }
  if (url.pathname === "/salud") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("ok");
  }
  let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, "index.html");
  const ext = path.extname(file);
  const cache = ext === ".html" || file.endsWith("sw.js") ? "no-cache" : "public, max-age=3600";
  res.writeHead(200, { ...security, "Content-Type": TYPES[ext] || "application/octet-stream", "Cache-Control": cache });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Kaleos escuchando en el puerto ${PORT}`));
