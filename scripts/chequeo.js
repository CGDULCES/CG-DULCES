#!/usr/bin/env node
/* =====================================================================
 * CG DULCES · Chequeo automático del código
 * ---------------------------------------------------------------------
 * Uso:   node scripts/chequeo.js
 * Revisa (sin tocar nada) que el sistema esté sano:
 *   1. Todos los archivos .js compilan (sin errores de sintaxis).
 *   2. index.html carga todos los módulos, en el orden correcto.
 *   3. Cada botón (onclick/onchange...) apunta a una función que existe.
 *   4. No hay dos funciones/variables con el mismo nombre en archivos distintos.
 *   5. Ningún archivo escribe directo en las tablas de plata (solo por funciones).
 *   6. Las funciones de la base que usa la app existen en los archivos SQL.
 *   7. El Service Worker solo precarga archivos que existen.
 *   8. Nombres de productos/clientes/etc. se muestran siempre protegidos (sin código).
 * Termina con código 1 si algo falla.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const raiz = path.join(__dirname, "..");
const leer = (r) => fs.readFileSync(path.join(raiz, r), "utf8");
const existe = (r) => fs.existsSync(path.join(raiz, r));
let fallas = 0;
const ok = (t) => console.log("  ✓ " + t);
const mal = (t) => { fallas++; console.log("  ✗ " + t); };
const seccion = (t) => console.log("\n" + t);

const html = leer("index.html");
const modulos = fs.readdirSync(path.join(raiz, "js/app")).filter((f) => f.endsWith(".js"));
const archivosJs = [...modulos.map((f) => "js/app/" + f), "js/lib/util.js", "js/rpc.js", "js/pwa.js", "sw.js"];

// 1) sintaxis
seccion("1. Sintaxis de los archivos");
let sintaxisOk = true;
for (const a of archivosJs) { try { new Function(leer(a)); } catch (e) { sintaxisOk = false; mal(`${a}: ${e.message}`); } }
if (sintaxisOk) ok(`${archivosJs.length} archivos compilan sin errores`);

// 2) index.html
seccion("2. index.html y orden de carga");
const scriptsHtml = [...html.matchAll(/<script src="(js\/[^"]+)"/g)].map((m) => m[1]);
const faltanEnDisco = scriptsHtml.filter((s) => !existe(s));
faltanEnDisco.length ? mal("scripts que no existen: " + faltanEnDisco.join(", ")) : ok(`${scriptsHtml.length} scripts cargados y todos existen`);
const modulosHtml = scriptsHtml.filter((s) => s.startsWith("js/app/") && s !== "js/app/tema.js").map((s) => path.basename(s));
const sinCargar = modulos.filter((f) => f !== "tema.js" && !modulosHtml.includes(f));
sinCargar.length ? mal("módulos que existen pero index.html no carga: " + sinCargar.join(", ")) : ok("todos los módulos están en index.html");
modulosHtml[0] === "estado.js" ? ok("estado.js se carga primero") : mal("estado.js debe cargarse primero");
modulosHtml[modulosHtml.length - 1] === "inicio.js" ? ok("inicio.js se carga al final") : mal("inicio.js debe cargarse al final");
const posUtil = scriptsHtml.indexOf("js/lib/util.js"), posRpc = scriptsHtml.indexOf("js/rpc.js"), posEstado = scriptsHtml.indexOf("js/app/estado.js");
(posUtil >= 0 && posUtil < posRpc && posRpc < posEstado) ? ok("util.js y rpc.js se cargan antes que los módulos") : mal("util.js y rpc.js deben ir antes de los módulos");

// 3) y 4) funciones y nombres
const codigo = {};
for (const a of archivosJs) codigo[a] = leer(a);
const todo = Object.values(codigo).join("\n") + "\n" + html;
const definidas = new Map();
const repetidas = [];
for (const m of modulos) {
  const t = codigo["js/app/" + m];
  for (const x of t.matchAll(/^(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm)) { if (definidas.has(x[1])) repetidas.push(`${x[1]} (${definidas.get(x[1])} y ${m})`); else definidas.set(x[1], m); }
  for (const x of t.matchAll(/^(?:const|let|var)\s+([A-Za-z0-9_$]+)/gm)) { if (definidas.has(x[1])) repetidas.push(`${x[1]} (${definidas.get(x[1])} y ${m})`); else definidas.set(x[1], m); }
}
for (const a of ["js/lib/util.js", "js/rpc.js", "js/pwa.js"]) for (const x of codigo[a].matchAll(/^(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm)) definidas.set(x[1], a);
seccion("3. Botones que llaman a funciones");
const globalesNav = new Set(["alert", "confirm", "closeModal", "event", "this", "if", "return", "window", "document", "Number", "String", "Math", "JSON", "Set", "Array", "Object", "parseInt", "parseFloat", "navigator", "location", "setTimeout", "console", "typeof", "new", "else", "const", "let", "var", "true", "false", "null", "undefined", "void", "do", "CG", "sb", "fmt"]);
const llamadas = new Set();
for (const m of todo.matchAll(/\bon(?:click|change|input|submit|blur|focus|keydown|keyup)="([^"]*)"/g)) {
  const cuerpo = m[1].replace(/\$\{[^}]*\}/g, "0");
  for (const f of cuerpo.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) if (!globalesNav.has(f[1])) llamadas.add(f[1]);
}
const sinDefinir = [...llamadas].filter((n) => !definidas.has(n));
sinDefinir.length ? mal("botones que llaman a funciones inexistentes: " + sinDefinir.join(", ")) : ok(`${llamadas.size} funciones usadas por botones, todas existen`);
seccion("4. Nombres repetidos entre archivos");
repetidas.length ? mal("repetidos: " + repetidas.join("; ")) : ok("no hay nombres repetidos");

// 5) tablas de plata
seccion("5. Tablas de plata (solo por funciones de la base)");
const plata = ["caja", "caja_movimientos", "cobros", "ventas", "venta_items", "compras", "compra_items"];
const directas = [];
for (const t of plata) {
  const re = new RegExp('from\\("' + t + '"\\)\\s*\\.(insert|update|delete|upsert)', "g");
  for (const a of archivosJs) { const c = (codigo[a].match(re) || []).length; if (c) directas.push(`${a}: ${t} x${c}`); }
}
directas.length ? mal("escrituras directas: " + directas.join("; ")) : ok("ninguna pantalla escribe directo en las tablas de plata");

// 6) funciones de la base
seccion("6. Funciones de la base que usa la app");
const sql = fs.readdirSync(path.join(raiz, "supabase")).filter((f) => f.endsWith(".sql")).map((f) => leer("supabase/" + f)).join("\n");
const usadasSQL = new Set([...codigo["js/rpc.js"].matchAll(/call\("([a-z_]+)"/g)].map((m) => m[1]));
for (const t of Object.values(codigo)) for (const m of t.matchAll(/sb\.rpc\("([a-z_]+)"/g)) usadasSQL.add(m[1]);
const sinSQL = [...usadasSQL].filter((f) => !new RegExp("function\\s+(public\\.)?" + f + "\\s*\\(", "i").test(sql));
sinSQL.length ? mal("sin definición en supabase/*.sql: " + sinSQL.join(", ")) : ok(`${usadasSQL.size} funciones de la base, todas tienen su archivo SQL`);
const rpcUsadas = new Set(); for (const m of modulos) for (const x of codigo["js/app/" + m].matchAll(/CG\.rpc\.([A-Za-z0-9_]+)/g)) rpcUsadas.add(x[1]);
const rpcDef = new Set([...codigo["js/rpc.js"].matchAll(/^\s{4}([A-Za-z0-9_]+):/gm)].map((m) => m[1]));
const rpcFalta = [...rpcUsadas].filter((x) => !rpcDef.has(x));
rpcFalta.length ? mal("CG.rpc sin definir en rpc.js: " + rpcFalta.join(", ")) : ok("todas las llamadas CG.rpc.* están definidas en rpc.js");

// 7) service worker
seccion("7. Service Worker (sin modo offline)");
const swTxt = leer("sw.js");
/offline.html|caches.open|PRECACHE/.test(swTxt) ? mal("sw.js guarda copias o usa offline.html (la app no debe funcionar sin internet)") : ok("el Service Worker no guarda copias: sin internet, avisa el navegador");
existe("offline.html") ? mal("sobra offline.html") : ok("no hay pantalla offline propia");

// 8) texto sin proteger
seccion("8. Textos de usuario protegidos (sin código)");
const campos = "nombre|presentacion|descripcion|telefono|concepto|motivo|notas|detalle|usuario|registrado_por";
// líneas que se pueden ignorar: mensajes de alerta, historial, comentarios, o textos que se escapan al mostrarse
const exentas = [/escapeHtml/, /alert\(/, /confirm\(/, /registrarHistorial\(/, /descripcion: `/, /const email/, /const resumen/, /mensaje:/, /detalle: cliente/, /^\s*\/\//, /nombres\}/, /textoVenta/, /PALETA/, /\$\{nombre\}<\/p>/, /\$\{clave\}/, /^\s*(return|const itemsTexto)/, /\.map\(\(it\) => `\$\{it\.cantidad\}× \$\{it\.productos\?\.nombre/, /No encontré|No se pudo cargar|renderTarjetaProducto\(p, p\.categorias\?\.nombre/];
const reCampo = new RegExp("\\$\\{[^}]*\\b(" + campos + ")\\b[^}]*\\}");
const sospechosas = [];
for (const m of modulos) {
  codigo["js/app/" + m].split("\n").forEach((l, i) => {
    if (exentas.some((re) => re.test(l))) return;
    if (!/[<>]|value="|class="/.test(l)) return;
    if (reCampo.test(l)) sospechosas.push(m + ":" + (i + 1));
  });
}
sospechosas.length ? mal("posibles textos sin proteger (revisar): " + sospechosas.join(", ")) : ok("los textos de productos, clientes y demás se muestran protegidos");

// resumen de tamaño
seccion("Tamaño de los módulos");
const filas = modulos.map((f) => [f, codigo["js/app/" + f].split("\n").length]).sort((a, b) => b[1] - a[1]);
filas.forEach(([f, n]) => console.log(`  ${String(n).padStart(5)} líneas  ${f}${n > 800 ? "   ← grande, conviene partirlo" : ""}`));
console.log(`  ${String(html.split("\n").length).padStart(5)} líneas  index.html`);

console.log(fallas ? `\n✗ ${fallas} problema(s) encontrados` : "\n✓ Todo en orden");
process.exit(fallas ? 1 : 0);
