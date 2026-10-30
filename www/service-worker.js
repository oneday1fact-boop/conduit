/* CONDUIT offline app shell. Bump CACHE_NAME when changing this file's strategy. */
const CACHE_NAME = "conduit-offline-shell-v4";
const APP_FILES = [
  "./",
  "./index.html",
  "./pro.css", "./pro-core.js", "./pro-ui.js", "./firebase-config.js", "./cloud-bridge.js", "./admob-bridge.js",
  "./puzzle-library.json",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache each file independently so one optional icon doesn't block installation.
    await Promise.all(APP_FILES.map(async path => {
      try {
        const url = new URL(path, self.registration.scope);
        const response = await fetch(url, { cache: "reload" });
        if (response.ok) await cache.put(url, response);
      } catch (error) {
        // The main page may still be available; a later online visit can fill gaps.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith("conduit-offline-shell-") && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  // Navigations: try the network for the latest page, then use the saved app shell offline.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(request))
          || (await cache.match(new URL("./index.html", self.registration.scope)))
          || new Response("CONDUIT is not available offline yet. Reconnect once to finish setup.", {
            status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
      }
    })());
    return;
  }

  // Puzzle content: prefer fresh hosted content; fall back to the cached library offline.
  if (url.pathname.endsWith("/puzzle-library.json")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response && response.ok) await cache.put(request, response.clone());
        return response;
      } catch (error) {
        return (await cache.match(request)) || new Response("{}", {
          status: 503, headers: { "Content-Type": "application/json; charset=utf-8" }
        });
      }
    })());
    return;
  }

  // Other same-origin app assets: cache-first, with network fallback.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
