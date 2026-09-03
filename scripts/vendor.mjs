/* =====================================================================
 * Descarga copias locales de las librerías de CDN a  ./vendor/
 * para que producción no dependa de jsdelivr.
 *
 *   node scripts/vendor.mjs
 *
 * Después, en index.html reemplazá:
 *   https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2  -> vendor/supabase.js
 *   https://cdn.jsdelivr.net/npm/chart.js@4               -> vendor/chart.umd.js
 * (Tailwind se resuelve aparte con `npm run build:css`, ver docs/DE-CDN.md)
 * ===================================================================== */
import { mkdir, writeFile } from "node:fs/promises";

// Versiones PINEADAS (actualizalas a mano cuando quieras subir de versión)
const LIBS = [
  { url: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js", out: "vendor/supabase.js" },
  { url: "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.js", out: "vendor/chart.umd.js" },
];

await mkdir("vendor", { recursive: true });
for (const { url, out } of LIBS) {
  process.stdout.write(`↓ ${url}\n`);
  const r = await fetch(url);
  if (!r.ok) { console.error(`  ✗ ${r.status}`); continue; }
  await writeFile(out, Buffer.from(await r.arrayBuffer()));
  console.log(`  ✓ ${out}`);
}
console.log("Listo. Revisá docs/DE-CDN.md para el último paso.");
