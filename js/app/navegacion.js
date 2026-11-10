/* =====================================================================
 * CG DULCES · Cambio de pestañas, dibujo de pantallas y aislamiento de errores por pantalla.
 * (archivo: js/app/navegacion.js)
 * ===================================================================== */

// Cambio de pestaña rápido: se dibuja al instante con los datos ya cargados y
// solo se vuelve a consultar la base si pasaron más de 45 segundos.
async function cambiarPestana(tab) {
  activeTab = tab;
  if (window.__ultimaCarga && Date.now() - window.__ultimaCarga < 45000) { render(); return; }
  await loadAll();
}

// Si la pantalla arranca con "‹ Volver" (y su título), se deja fijo arriba y solo se desliza el resto.
function fijarEncabezado() {
  const c = document.getElementById("content");
  const primero = c?.firstElementChild;
  if (!primero || primero.classList.contains("cg-fijo")) return;
  if (primero.tagName !== "BUTTON" || !/^s*‹/.test(primero.textContent)) return;
  const titulo = primero.nextElementSibling;
  const envoltorio = document.createElement("div");
  envoltorio.className = "cg-fijo";
  c.insertBefore(envoltorio, primero);
  envoltorio.appendChild(primero);
  if (titulo && titulo.tagName === "P" && /uppercase/.test(titulo.className)) envoltorio.appendChild(titulo);
}

new MutationObserver(() => fijarEncabezado()).observe(document.getElementById("content"), { childList: true });

// Qué hace el botón "+" en cada pantalla
const ACCION_FAB = {
  inventario: { etiqueta: "Nuevo producto", abrir: () => openNewProduct() },
  clientes: { etiqueta: "Nuevo cliente", abrir: () => openNewCliente() },
  compras: { etiqueta: "Nueva compra", abrir: () => openNewCompra() },
};

function render() {
  const content = document.getElementById("content");
  const mapaGrupo = { "proveedores": "compras", "cliente-detalle": "clientes", "auditoria": "", "masopciones": "", "reportes": "", "promociones": "", "configuracion": "", "todas-ventas": "dashboard", "perdidas": "", "categorias": "", "masvendidos": "", "analisis": "" };
  const grupoActivo = mapaGrupo[activeTab] || activeTab;
  content.dataset.pantalla = activeTab;
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === grupoActivo));
  // Botón "+" flotante (esquina de abajo a la derecha, siempre en el mismo lugar): Inventario, Clientes y Compras
  const conFab = Object.prototype.hasOwnProperty.call(ACCION_FAB, activeTab);
  const fab = document.getElementById("add-product-fab");
  fab.classList.toggle("screen-hidden", !conFab);
  fab.classList.toggle("flex", conFab);
  if (conFab) { fab.setAttribute("aria-label", ACCION_FAB[activeTab].etiqueta); fab.title = ACCION_FAB[activeTab].etiqueta; }

  // Cada pantalla se busca por nombre en el momento de dibujarla: si el archivo de esa parte
  // no se pudo cargar, solo falla esa pantalla (el resto del sistema sigue funcionando).
  const pantallas = { dashboard: "renderDashboard", ventas: "renderVender", caja: "renderCaja", inventario: "renderInventario", proveedores: "renderProveedores", clientes: "renderClientes", "cliente-detalle": "renderClienteDetalle", compras: "renderCompras", auditoria: "renderAuditoria", "todas-ventas": "renderTodasVentas", masopciones: "renderMasOpciones", reportes: "renderReportes", promociones: "renderPromociones", categorias: "renderCategorias", configuracion: "renderConfiguracion", perdidas: "renderPerdidas", masvendidos: "renderMasVendidos", analisis: "renderAnalisis" };
  const nombreFuncion = pantallas[activeTab];
  if (nombreFuncion) {
    aislar(activeTab, content, () => {
      const dibujar = window[nombreFuncion];
      if (typeof dibujar !== "function") throw new Error("Esta parte del sistema no se cargó (" + nombreFuncion + ")");
      return dibujar(content);
    });
  }
  try { if (typeof renderCartBar === "function") renderCartBar(); } catch (e) { console.error("renderCartBar", e); }
}

// Si una pantalla falla (al dibujarse o al cargar), solo esa pantalla muestra el aviso; el resto de la app sigue.
function aislar(nombre, content, fn) {
  const fallo = (e) => {
    console.error("Pantalla " + nombre + " falló:", e);
    content.innerHTML = `
      <div class="bg-cg-card rounded-2xl p-5 shadow-sm border border-cg-line/[0.04] text-center mt-6">
        <p class="text-[14px] font-semibold text-cg-ink mb-1">Esta sección tuvo un problema</p>
        <p class="text-[12px] text-cg-muted mb-4">El resto de la app sigue funcionando. Probá de nuevo o andá a otro menú.</p>
        <button onclick="render()" class="bg-cg-primary text-cg-onink text-[13px] font-semibold rounded-xl px-5 py-2.5">Reintentar</button>
      </div>`;
  };
  try { Promise.resolve(fn()).catch(fallo); } catch (e) { fallo(e); }
}

async function irA(tab) { await cambiarPestana(tab); }

// ---------- Aviso de fallas ----------
// Si alguna parte del sistema falla (al cargar o al usarla), se avisa con un cartelito arriba
// y se anota en la consola; el resto del sistema sigue funcionando.
let _ultimoAvisoFalla = 0;
function avisarFalla(detalle) {
  console.error("Falla aislada:", detalle);
  if (Date.now() - _ultimoAvisoFalla < 6000) return;
  _ultimoAvisoFalla = Date.now();
  let b = document.getElementById("cg-aviso-falla");
  if (!b) {
    b = document.createElement("div");
    b.id = "cg-aviso-falla";
    b.setAttribute("role", "alert");
    b.style.cssText = "position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:9999;max-width:92vw;background:rgb(var(--cg-danger));color:#fff;font:600 12px Inter,sans-serif;padding:9px 14px;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.25)";
    document.body.appendChild(b);
  }
  b.textContent = "⚠ Una parte del sistema tuvo un problema. El resto sigue funcionando. Si se repite, avisame.";
  b.style.display = "block";
  setTimeout(() => { b.style.display = "none"; }, 7000);
}
window.addEventListener("error", (e) => {
  // errores de carga de recursos (imágenes, etc.): solo importan si es un archivo de código
  if (e.target && e.target !== window) {
    if (e.target.tagName === "SCRIPT") avisarFalla("no cargó " + (e.target.src || "un archivo"));
    return;
  }
  avisarFalla((e.filename || "").split("/").pop() + ":" + e.lineno + " " + (e.message || ""));
}, true);
window.addEventListener("unhandledrejection", (e) => {
  const texto = String((e.reason && e.reason.message) || e.reason || "");
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(texto)) return; // sin internet: ya lo avisa la barra de conexión
  avisarFalla("promesa rechazada: " + texto);
});
