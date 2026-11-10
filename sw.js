/* =====================================================================
 * CG DULCES · Service Worker (mínimo)
 * ---------------------------------------------------------------------
 * Solo existe para que la app se pueda instalar en el celular/compu.
 * NO guarda nada para usar sin internet: si no hay conexión, la app no abre
 * y el propio navegador avisa que no hay internet.
 * Al activarse borra cualquier copia guardada por versiones anteriores,
 * así siempre se carga la versión más nueva del sistema.
 * ===================================================================== */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Sin lógica: todo pasa directo a la red (necesario para que el navegador permita instalar la app).
self.addEventListener("fetch", () => {});
