// @ts-check
import { serwist } from "@serwist/next/config";

/**
 * The studio is a page on the internet that drives a daemon on localhost, so it
 * must open with no internet at all. Serwist runs after the Next build, which
 * is what lets it precache the real prerendered shell.
 *
 * No `additionalPrecacheEntries`: Next already prerenders `/`, and a second
 * entry for the same URL with a different revision makes Serwist throw while
 * the worker is being evaluated — which registers as "script evaluation
 * failed" with no further explanation.
 */
export default serwist({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
});
