/**
 * Offline shell for the hosted studio.
 *
 * The studio is a static page that talks to a daemon on the developer's own
 * machine, so once it has been opened it should keep opening with no internet.
 * Only this origin's own GET requests are touched: daemon traffic goes to
 * 127.0.0.1, a different origin, and must never be intercepted or cached.
 *
 * Navigations are network-first, so a deploy is picked up as soon as the
 * network allows, and fall back to the cached shell when offline. Hashed build
 * assets are cache-first, since their name changes whenever their content does.
 */
const CACHE = "zestman-studio-v1";
const SHELL = "/index.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(SHELL, response.clone());
    }
    return response;
  } catch (err) {
    const cached = (await caches.match(request)) ?? (await caches.match(SHELL));
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // the daemon, and anything else
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request));
  }
});
