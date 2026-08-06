// service-worker.js — Sistema GONZA
// Estrategia:
//   - Rutas /api/*        -> SIEMPRE red (nunca cachear datos financieros: saldos, préstamos, caja).
//   - Navegación/index.html -> red primero, caché solo como respaldo sin conexión (evita quedarse
//     pegado a una versión vieja del shell tras un nuevo deploy — con cache-first puro, el HTML
//     cacheado apunta a bundles JS/CSS que ya no existen y el usuario nunca ve el código nuevo
//     hasta que borra caché a mano).
//   - Resto de estáticos (JS/CSS con hash de contenido en el nombre, imágenes) -> cache-first,
//     seguro porque cada build genera nombres de archivo distintos.
//
// IMPORTANTE: sube CACHE_NAME (v1 -> v2 -> v3...) cada vez que cambies esta estrategia, para que
// los navegadores con la versión vieja del service worker instalada limpien su caché al activarse.

const CACHE_NAME = "gonza-cache-v5";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/gonza-systems.png",
  "/login.png",
];

// Instalación: precachea el shell de la app
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activación: borra cachés viejos de versiones anteriores
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: decide la estrategia según la ruta
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Solo interceptamos GET; POST/PUT/DELETE del backend van directo a la red
  if (event.request.method !== "GET") return;

  // Llamadas a la API: red primero, sin caché (datos financieros deben ser siempre frescos)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(
            JSON.stringify({ error: "Sin conexión a internet. Intenta de nuevo." }),
            { headers: { "Content-Type": "application/json" }, status: 503 }
          )
      )
    );
    return;
  }

  // Navegación (cargar la página) o index.html: red primero. Así cada visita trae el shell más
  // reciente (con los nombres de bundle correctos); solo se usa la caché si no hay conexión.
  const esNavegacion = event.request.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith("/index.html");
  if (esNavegacion) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Resto de estáticos (JS, CSS con hash, imágenes): cache-first + refresco en segundo plano
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
