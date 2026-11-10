/* =====================================================================
 * CG DULCES · Colores del sistema (paleta editable), nombre y logo.
 * (archivo: js/app/marca.js)
 * ===================================================================== */

const PALETA_DEFECTO = {
  primary: "#6B2D5C", ink: "#241C2E", muted: "#8A7D94", surface: "#F7F3FA", page: "#EDE7F3",
  card: "#FFFFFF", onink: "#FFFFFF", line: "#000000", disabled: "#EDE7F0",
  success: "#2F9E7A", danger: "#D64545", warning: "#F2994A", whatsapp: "#25D366",
  tabon: "#F3E9F1", taboff: "#B3A6BD",
  cat1: "#6B2D5C", cat2: "#F2994A", cat3: "#2F9E7A", cat4: "#D6608A", cat5: "#8A4B2E", cat6: "#D9A441", cat7: "#4A7C9E", cat8: "#7C5C9E",
};

// [clave, nombre, dónde se usa]
const PALETA_ETIQUETAS = [
  ["primary", "Color principal", "Botones, títulos, íconos y detalles de la marca"],
  ["ink", "Texto principal / fondos oscuros", "Textos importantes y las tarjetas oscuras (caja, carrito)"],
  ["muted", "Texto secundario", "Textos chicos, subtítulos y etiquetas"],
  ["surface", "Fondo de pantallas y campos", "Fondo de la app y de los cuadros de escribir"],
  ["page", "Fondo exterior", "El fondo que rodea la app en la computadora"],
  ["card", "Fondo de tarjetas", "Tarjetas, ventanas y listas"],
  ["onink", "Texto sobre fondos oscuros", "Letras blancas sobre botones y tarjetas oscuras"],
  ["line", "Bordes y líneas suaves", "Líneas finas que separan las tarjetas (se ven muy tenues)"],
  ["disabled", "Campos bloqueados", "Casilleros que no se pueden editar"],
  ["success", "Verde (bien / dinero que entra)", "Cobros, ventas, ✓ y confirmaciones"],
  ["danger", "Rojo (alerta / deuda)", "Deudas, errores, eliminar y retiros"],
  ["warning", "Naranja (aviso)", "Avisos, pagos parciales y stock bajo"],
  ["whatsapp", "Verde de WhatsApp", "Botones de WhatsApp"],
  ["tabon", "Menú de abajo: botón activo", "Fondo del botón de la sección donde estás"],
  ["taboff", "Menú de abajo: botones inactivos", "Íconos de las demás secciones"],
  ["cat1", "Categoría 1", "Colores que se reparten entre las categorías de productos"],
  ["cat2", "Categoría 2", ""], ["cat3", "Categoría 3", ""], ["cat4", "Categoría 4", ""],
  ["cat5", "Categoría 5", ""], ["cat6", "Categoría 6", ""], ["cat7", "Categoría 7", ""], ["cat8", "Categoría 8", ""],
];

const PALETTE = ["cat1", "cat2", "cat3", "cat4", "cat5", "cat6", "cat7", "cat8"].map((k) => PALETA_DEFECTO[k]); // se actualiza solo

let paletaActual = { ...PALETA_DEFECTO };

const hexValido = (h) => /^#[0-9a-fA-F]{6}$/.test(h || "");

function hexATripleta(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function cgHex(nombre) { return paletaActual[nombre] || PALETA_DEFECTO[nombre]; }

function aplicarPaleta(personalizada) {
  paletaActual = { ...PALETA_DEFECTO };
  Object.keys(PALETA_DEFECTO).forEach((k) => { if (personalizada && hexValido(personalizada[k])) paletaActual[k] = personalizada[k]; });
  const raiz = document.documentElement;
  Object.keys(PALETA_DEFECTO).filter((k) => !k.startsWith("cat")).forEach((k) => raiz.style.setProperty(`--cg-${k}`, hexATripleta(paletaActual[k])));
  PALETTE.forEach((_, i) => { PALETTE[i] = paletaActual["cat" + (i + 1)]; });
  if (typeof categorias !== "undefined") categorias.forEach((c, i) => { categoryColors[c.nombre] = PALETTE[i % PALETTE.length]; });
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", paletaActual.primary);
  try { localStorage.setItem("cg_paleta", JSON.stringify(personalizada || {})); } catch {}
}

// Nombre y logo del negocio en el encabezado (y recordados para la pantalla de ingreso)
function aplicarMarca() {
  const nombre = window.__config?.nombre_negocio;
  const logo = window.__config?.logo_negocio;
  const elNombre = document.getElementById("header-nombre");
  if (elNombre && nombre) elNombre.textContent = nombre;
  const propio = !!(logo && logo.startsWith("data:image/"));
  const h = document.getElementById("header-logo"); if (h) h.src = propio ? logo : "assets/logo-mark.png";
  const l = document.getElementById("login-logo"); if (l) l.src = propio ? logo : "assets/logo.png";
  // Ícono de la pestaña del navegador
  const fav = document.getElementById("favicon"); if (fav) { fav.href = propio ? logo : "assets/icon-192.png"; fav.type = "image/png"; }
  const ap = document.getElementById("apple-icon"); if (ap) ap.href = propio ? logo : "assets/apple-touch-icon.png";
  try { if (propio) localStorage.setItem("cg_logo", logo); else localStorage.removeItem("cg_logo"); } catch {}
}
