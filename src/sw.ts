/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { NetworkFirst, Serwist, StaleWhileRevalidate } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

/**
 * The studio is served from the internet but drives a daemon on localhost, so
 * it has to open with no internet at all.
 *
 * The policy is ours on purpose, rather than the stock Next preset: the daemon
 * (127.0.0.1) and anything cross-origin must never be cached — those answers
 * are live state, and a stale one would be worse than an error.
 */
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Pages: fresh when online, the last copy when not.
      matcher: ({ request, url }) =>
        request.mode === "navigate" && url.origin === self.location.origin,
      handler: new NetworkFirst({ cacheName: "pages", networkTimeoutSeconds: 3 }),
    },
    {
      // Build output is content-hashed, so a cached copy is never the wrong one.
      matcher: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/_next/"),
      handler: new StaleWhileRevalidate({ cacheName: "assets" }),
    },
  ],
});

serwist.addEventListeners();
