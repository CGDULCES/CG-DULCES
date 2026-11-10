// Servidor local mínimo para probar el sistema en tu computadora: node scripts/servidor-local.js
// Abre http://localhost:5173  (no hace falta instalar nada)
const http = require("http");
const fs = require("fs");
const path = require("path");
const raiz = path.join(__dirname, "..");
const tipos = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
http.createServer((req, res) => {
  let ruta = decodeURIComponent(req.url.split("?")[0]);
  if (ruta.endsWith("/")) ruta += "index.html";
  const archivo = path.normalize(path.join(raiz, ruta));
  if (!archivo.startsWith(raiz)) { res.writeHead(403); return res.end("no"); }
  fs.readFile(archivo, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("no encontrado"); }
    res.writeHead(200, { "Content-Type": tipos[path.extname(archivo)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  });
}).listen(5173, () => console.log("Sistema en http://localhost:5173"));
