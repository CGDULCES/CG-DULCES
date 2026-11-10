/* =====================================================================
 * CG DULCES · Piezas generales: ventanas (modales), tablas de escritorio, textos, historial y consultas paginadas.
 * (archivo: js/app/base.js)
 * ===================================================================== */

// Identificador para juntar los cobros de una misma operación (UUID v4, con respaldo para celulares viejos)
function nuevoGrupoId() {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch {}
  const b = new Uint8Array(16);
  (crypto.getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => (b[i] = Math.floor(Math.random() * 256))));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Texto de lo que se vendió: productos, o el concepto si es una deuda manual
function textoVenta(v) {
  const items = (v.venta_items || []);
  if (items.length) return items.map((it) => `${it.cantidad}× ${it.productos?.nombre || ""}`).join(", ");
  return v.concepto ? `📝 ${v.concepto}` : "";
}

// Supabase devuelve como máximo 1000 filas por consulta; esto trae TODAS por páginas.
async function selectTodo(tabla, columnas, ajustar) {
  let todo = [];
  while (true) {
    let q = sb.from(tabla).select(columnas);
    if (ajustar) q = ajustar(q);
    const { data, error } = await q.range(todo.length, todo.length + 999);
    if (error) return { data: null, error };
    if (!data.length) break;
    todo = todo.concat(data);
  }
  return { data: todo, error: null };
}

// Registra cualquier acción importante para el módulo de Auditoría
async function registrarHistorial(tabla, registro_id, accion, detalle) {
  const usuario = ADMIN;
  await sb.from("historial").insert({ tabla, registro_id, accion, detalle, usuario });
}

// Fila de "tabla" que solo se ve en computadora (en celular se usa la tarjeta de siempre)
const COLS_VENTAS = "110px 190px minmax(0,1fr) 190px 130px 150px";

const COLS_COMPRAS = "110px 220px 130px minmax(0,1fr) 140px";

const COLS_CAJA = "110px 190px minmax(0,1fr) 130px 140px 140px";

function celdasPC(cols, celdas) {
  return `<div class="hidden lg:grid items-center gap-4 px-4 py-2.5" style="grid-template-columns:${cols}">${celdas.map((c) => `<div class="min-w-0">${c}</div>`).join("")}</div>`;
}

function encabezadoPC(cols, titulos) {
  return `<div class="hidden lg:grid gap-4 px-4 text-[10px] font-semibold uppercase tracking-wider text-cg-muted mb-1" style="grid-template-columns:${cols}">${titulos.map((t, i) => `<div class="${/^>/.test(t) ? "text-right" : ""}">${t.replace(/^>/, "")}</div>`).join("")}</div>`;
}

function sectionLabel(text) {
  return `<p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-cg-muted mb-2">${text}</p>`;
}

function esMedioBanco(medio) {
  return medio === "transferencia" || medio === "qr";
}

function cajaRequerida() {
  if (!cajaActual) { alert("Primero tenés que abrir la caja para poder hacer esto."); return false; }
  return true;
}

function refocusInput(id) {
  const el = document.getElementById(id);
  if (el) {
    el.focus();
    const pos = el.value.length;
    el.setSelectionRange(pos, pos);
  }
}

// Fecha de HOY según la hora de Paraguay (no UTC, que se adelanta un día por la tardecita/noche)
function fechaLocalHoy() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Asuncion" });
}

// Si la fecha elegida es hoy, usa la hora real actual. Si es un día anterior (carga tardía), usa el mediodía de ese día.
function fechaOAhora(fechaSeleccionada) {
  const hoy = fechaLocalHoy();
  if (fechaSeleccionada === hoy) return new Date().toISOString();
  return new Date(fechaSeleccionada + "T12:00:00").toISOString();
}

// opciones.bloquear: el formulario NO se cierra al tocar afuera (solo con la "×"), para no perder lo escrito.
// opciones.conservarScroll: si se vuelve a dibujar el mismo formulario, mantiene la posición.
window.__modalBloqueado = false;

function showModal(html, opciones = {}) {
  const caja = document.getElementById("modal-box");
  const abierto = !document.getElementById("modal-overlay").classList.contains("screen-hidden");
  const scrollPrevio = caja.scrollTop;
  window.__modalBloqueado = !!opciones.bloquear;
  caja.innerHTML = html;
  if (opciones.conservarScroll && abierto) caja.scrollTop = scrollPrevio;
  document.getElementById("modal-overlay").classList.remove("screen-hidden");
  document.getElementById("modal-overlay").classList.add("flex");
}

function closeModal() {
  window.__modalBloqueado = false;
  document.getElementById("modal-overlay").classList.add("screen-hidden");
  document.getElementById("modal-overlay").classList.remove("flex");
}

document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target.id === "modal-overlay" && !window.__modalBloqueado) closeModal();
});

