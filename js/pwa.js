/* =====================================================================
 * CG DULCES · Registro del Service Worker + estado de conexión
 * ---------------------------------------------------------------------
 * - Registra sw.js.
 * - Muestra una barrita cuando NO hay internet.
 * - Avisa cuando hay una versión nueva lista ("Actualizar").
 * ===================================================================== */
(function () {
  "use strict";
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      reg.addEventListener("updatefound", () => {
        const nuevo = reg.installing;
        if (!nuevo) return;
        nuevo.addEventListener("statechange", () => {
          if (nuevo.state === "installed" && navigator.serviceWorker.controller) {
            mostrarBanner("Hay una versión nueva.", "Actualizar", () => {
              nuevo.postMessage("skipWaiting");
            });
          }
        });
      });
    }).catch(() => {});

    let recargando = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (recargando) return;
      recargando = true;
      location.reload();
    });
  });

  // ---- Estado de conexión ----------------------------------------
  function pintarConexion() {
    const off = !navigator.onLine;
    let b = document.getElementById("cg-offline-bar");
    if (off && !b) {
      b = document.createElement("div");
      b.id = "cg-offline-bar";
      b.textContent = "Sin internet — podés seguir mirando, pero no se guardan cambios";
      Object.assign(b.style, {
        position: "fixed", left: "0", right: "0", bottom: "0", zIndex: "9999",
        background: "#D64545", color: "#fff", font: "600 12px/1.4 Inter, sans-serif",
        textAlign: "center", padding: "8px 12px",
      });
      document.body.appendChild(b);
    } else if (!off && b) {
      b.remove();
    }
  }
  window.addEventListener("online", pintarConexion);
  window.addEventListener("offline", pintarConexion);
  document.addEventListener("DOMContentLoaded", pintarConexion);

  // ---- Banner genérico -----------------------------------------
  function mostrarBanner(texto, accionTxt, onAccion) {
    const d = document.createElement("div");
    Object.assign(d.style, {
      position: "fixed", left: "12px", right: "12px", bottom: "12px", zIndex: "9999",
      background: "#241C2E", color: "#fff", borderRadius: "14px", padding: "12px 14px",
      font: "500 13px/1.3 Inter, sans-serif", display: "flex", alignItems: "center",
      justifyContent: "space-between", gap: "12px", boxShadow: "0 8px 24px rgba(0,0,0,.25)",
    });
    d.innerHTML = `<span></span>`;
    d.firstChild.textContent = texto;
    const btn = document.createElement("button");
    btn.textContent = accionTxt;
    Object.assign(btn.style, {
      background: "#fff", color: "#241C2E", border: "0", borderRadius: "10px",
      padding: "8px 14px", fontWeight: "700", fontSize: "13px",
    });
    btn.onclick = () => { d.remove(); onAccion && onAccion(); };
    d.appendChild(btn);
    document.body.appendChild(d);
  }
})();
