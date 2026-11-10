/* =====================================================================
 * CG DULCES · Registro del Service Worker (solo para poder instalar la app)
 * ---------------------------------------------------------------------
 * La app NO funciona sin internet: si no hay conexión, el navegador lo avisa solo.
 * ===================================================================== */
(function () {
  "use strict";
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    const habiaControl = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register("./sw.js").catch(() => {});

    // Cuando el nuevo Service Worker toma el control (una sola vez, al actualizar), se recarga para usar lo último.
    let recargando = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!habiaControl || recargando) return;
      recargando = true;
      location.reload();
    });
  });
})();
