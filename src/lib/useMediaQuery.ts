import { useEffect, useState } from "react";

/** Subscribe to a media query. SSR-safe and stable across re-renders. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/**
 * How much chrome the viewport can hold.
 *
 * The studio is three columns — sidebar 240, main, rail 320 — so 560px is spoken
 * for before any content. The thresholds below are where each panel stops
 * earning its width and becomes an overlay instead:
 *
 *   < 768   phone    both panels overlay; one column of content
 *   768+    tablet   sidebar inline (main still gets ~520), rail overlays
 *   1280+   desktop  both inline, the layout the design was drawn at
 *
 * Height counts too. A phone in landscape is ~844 wide but only ~390 tall; an
 * inline sidebar there leaves a letterbox of content, so it stays a sheet.
 */
export function useLayout() {
  const sidebarInline = useMediaQuery("(min-width: 768px) and (min-height: 500px)");
  const railInline = useMediaQuery("(min-width: 1280px)");
  const isPhone = !sidebarInline;
  /* Touch devices cannot hover, so edge-drag handles are unusable there. */
  const coarse = useMediaQuery("(pointer: coarse)");

  return { sidebarInline, railInline, isPhone, coarse };
}
