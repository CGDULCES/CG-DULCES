/* =====================================================================
 * CG DULCES · Arranque: conecta los botones y abre la sesión. Siempre se carga al final.
 * (archivo: js/app/inicio.js)
 * ===================================================================== */

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => cambiarPestana(btn.dataset.tab));
});

document.getElementById("add-product-fab").addEventListener("click", () => { ACCION_FAB[activeTab]?.abrir(); });

// Colores y logo recordados en este dispositivo (se actualizan solos al entrar)
try { aplicarPaleta(JSON.parse(localStorage.getItem("cg_paleta") || "{}")); } catch { aplicarPaleta(null); }

try {
  const logoGuardado = localStorage.getItem("cg_logo");
  if (logoGuardado && logoGuardado.startsWith("data:image/")) {
    const l = document.getElementById("login-logo"); if (l) l.src = logoGuardado;
    const h = document.getElementById("header-logo"); if (h) h.src = logoGuardado;
    const fav = document.getElementById("favicon"); if (fav) fav.href = logoGuardado;
    const ap = document.getElementById("apple-icon"); if (ap) ap.href = logoGuardado;
  }
} catch {}

// Prueba de pantallas: solo en la computadora local (http://localhost:5173/?prueba=1). Nunca en el sistema publicado.
const _modoPrueba = ["localhost", "127.0.0.1"].includes(location.hostname) && new URLSearchParams(location.search).get("prueba") === "1";
if (_modoPrueba) {
  const s = document.createElement("script");
  s.src = "pruebas/pantallas.js";
  document.body.appendChild(s);
} else {
  checkSession();
}
