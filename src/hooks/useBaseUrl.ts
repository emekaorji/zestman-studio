import { useStore } from "@/state/store";

/**
 * The active environment's `baseUrl`, or the literal `{{baseUrl}}` token when
 * no environment defines one — so nothing in the UI ever prints a made-up host.
 */
export function useBaseUrl(): string {
  return useStore(
    (s) =>
      s.environments.find((e) => e.isActive)?.variables.find((v) => v.key === "baseUrl" && v.enabled)?.value ??
      "{{baseUrl}}",
  );
}
