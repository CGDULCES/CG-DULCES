/* =====================================================================
 * CG DULCES · Service Worker
 * ---------------------------------------------------------------------
 * - Deja la app instalable y que ABRA sin internet (el "cascarón").
 * - HTML: network-first (siempre trae la última versión si hay señal).
 * - Estáticos propios (css/js/assets): cache-first.
 * - Librerías de CDN y fuentes: stale-while-revalidate.
 * - Las llamadas a Supabase NUNCA se cachean (siempre datos frescos).
 *
 * ⚠ Al publicar cambios, subí el número de CACHE_VERSION para que los
 *   dispositivos descarten el cache viejo.
 * ===================================================================== */
const CACHE_VERSION = "cg-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const PRECACHE = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./js/lib/util.js",
  "./js/pwa.js",
  "./assets/logo.png",
  "./assets/logo-mark.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Nunca tocar la API de Supabase / Auth / Storage
  if (/supabase\.(co|in)$/.test(url.hostname) || url.pathname.startsWith("/auth/") ||
      url.pathname.startsWith("/rest/") || url.pathname.startsWith("/storage/")) {
    return; // deja pasar a la red normalmente
  }

  // Navegación / HTML -> network-first con fallback a cache y a offline.html
  if (request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          return resp;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("./offline.html")))
    );
    return;
  }

  // Mismo origen -> cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((resp) => {
          const copy = resp.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
          return resp;
        })
      )
    );
    return;
  }

  // CDN de librerías + Google Fonts -> stale-while-revalidate
  if (/cdn\.tailwindcss\.com|cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((resp) => { cache.put(request, resp.clone()); return resp; })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
