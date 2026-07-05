// service-worker.js — Sistema GONZA
// Estrategia:
//   - Rutas /api/*  -> SIEMPRE red (nunca cachear datos financieros: saldos, préstamos, caja).
//   - Todo lo demás -> cache-first con actualización en segundo plano (carga rápida, siempre al día).

const CACHE_NAME = "gonza-cache-v1";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/logo-gonza-icon.png",
  "/logo-gonza-login.jpg",
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

  // Recursos estáticos (JS, CSS, imágenes, HTML): cache-first + refresco en segundo plano
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
