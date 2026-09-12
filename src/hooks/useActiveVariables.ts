import { useMemo } from "react";
import { useStore } from "@/state/store";

/** Merged {{variable}} map: globals < active environment (matching resolver precedence). */
export function useActiveVariables(): { map: Map<string, string> } {
  const environments = useStore((s) => s.environments);
  const globals = useStore((s) => s.globals);

  const map = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of globals) if (g.enabled && g.key) m.set(g.key, g.value);
    const active = environments.find((e) => e.isActive);
    for (const v of active?.variables ?? []) if (v.enabled && v.key) m.set(v.key, v.value);
    return m;
  }, [environments, globals]);

  return { map };
}
