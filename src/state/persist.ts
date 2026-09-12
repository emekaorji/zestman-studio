import { useCallback, useState } from "react";

/**
 * localStorage, defensively.
 *
 * Two scopes:
 *   zestman:ui:v1              chrome + preferences, global to the install
 *   zestman:ws:<project>:v1    workspace position, per project
 *
 * Every access is wrapped: private windows, blocked site data and quota
 * exhaustion all throw, and none of them should take the studio down. A failed
 * read is simply "no saved state".
 */

const VERSION = 1;

export const UI_KEY = `zestman:ui:v${VERSION}`;
export const wsKey = (projectId: string) => `zestman:ws:${projectId}:v${VERSION}`;

export function readKey<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (parsed == null || typeof parsed !== "object") return fallback;
    // Stored shapes are partial by design — callers merge over their defaults.
    return { ...(fallback as object), ...(parsed as object) } as T;
  } catch {
    return fallback;
  }
}

export function writeKey(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable or full — the app keeps working, just forgets. */
  }
}

export function clearPersisted(): void {
  try {
    const doomed = Object.keys(window.localStorage).filter((k) => k.startsWith("zestman:"));
    for (const k of doomed) window.localStorage.removeItem(k);
  } catch {
    /* nothing to do */
  }
}

/**
 * A `useState` that remembers. For view preferences that legitimately live in a
 * component rather than the store (expanded tree nodes, a snippet language).
 * `Set` is not JSON, so pass `setCodec` for those.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
  codec?: { encode: (v: T) => unknown; decode: (raw: unknown) => T },
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null) return initial;
      const parsed: unknown = JSON.parse(raw);
      return codec ? codec.decode(parsed) : (parsed as T);
    } catch {
      return initial;
    }
  });

  const set = useCallback(
    (next: T | ((cur: T) => T)) => {
      setValue((cur) => {
        const resolved = typeof next === "function" ? (next as (c: T) => T)(cur) : next;
        writeKey(key, codec ? codec.encode(resolved) : resolved);
        return resolved;
      });
    },
    [key, codec],
  );

  return [value, set] as const;
}

/** Sets round-trip as arrays. */
export const setCodec = {
  encode: (v: Set<string>) => [...v],
  decode: (raw: unknown) => new Set(Array.isArray(raw) ? (raw as string[]) : []),
};
