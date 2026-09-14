import {
  Braces,
  CornerDownRight,
  FileOutput,
  Route as RouteIcon,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/state/store";
import { getClient } from "@/app/client";
import type { XrayResult } from "@/daemon/client";
import { CapsHeader, Dot, EmptyState, Pill } from "@/components/primitives";
import { SourceRef } from "@/components/SourceRef";
import { cn } from "@/lib/utils";

/** Icon per evidence step, by the daemon's `icon` key; the row index is the fallback. */
const ICONS: Record<string, LucideIcon> = {
  route: RouteIcon,
  "corner-down-right": CornerDownRight,
  shield: ShieldCheck,
  braces: Braces,
  "file-output": FileOutput,
};
const ICON_ORDER = [RouteIcon, CornerDownRight, ShieldCheck, Braces, FileOutput];

/** Evidence chains, keyed by route — a route's chain only changes on a rescan. */
const cache = new Map<string, XrayResult>();

/** Rail · X-ray — the discovery evidence chain ("show your work"). */
export function XrayTab() {
  const routes = useStore((s) => s.routes);
  const openTabs = useStore((s) => s.openTabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const activeProjectId = useStore((s) => s.activeProjectId);

  const tab = openTabs.find((t) => t.id === activeTabId);
  const route = routes.find((r) => r.id === tab?.routeId);
  const routeId = route?.id ?? null;
  const cacheKey = routeId ? `${activeProjectId}:${routeId}` : null;

  const [xray, setXray] = useState<XrayResult | null>(() => (cacheKey ? (cache.get(cacheKey) ?? null) : null));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!routeId || !cacheKey) {
      setXray(null);
      return;
    }
    const cached = cache.get(cacheKey);
    if (cached) {
      setXray(cached);
      setError(null);
      return;
    }
    let alive = true;
    setXray(null);
    setError(null);
    getClient()
      .getXray(routeId)
      .then((result) => {
        cache.set(cacheKey, result);
        if (alive) setXray(result);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, [routeId, cacheKey]);

  if (!route) return <EmptyState title="Open a route to see its evidence" />;

  const inferred = (xray?.confidence ?? (route.provenance === "inferred" ? "INFERRED" : "CERTAIN")) !== "CERTAIN";
  const links = xray?.links ?? [];
  const verified = links.length;

  return (
    <div
      key={route.id}
      className="flex flex-col gap-3.5 p-3 animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]"
    >
      <div className="flex items-center gap-2">
        <Pill tone={inferred ? "warn" : "ok"} className="font-semibold tracking-[0.04em]">
          {xray?.confidence ?? (inferred ? "INFERRED" : "CERTAIN")}
        </Pill>
        <span className="text-xs text-ink-3">
          {xray ? `${verified} ${verified === 1 ? "link" : "links"} in the chain` : error ? "unavailable" : "reading…"}
        </span>
      </div>

      <div>
        <CapsHeader>Evidence chain</CapsHeader>
        {error ? (
          <div className="font-mono text-xs text-ink-3">{error}</div>
        ) : (
          <div className="relative flex flex-col">
            {/* The spine, centred on the 16px icon column (centre = 8px). It is
                gray-400, not gray-200: on the pure-black rail a gray-200 line is
                invisible, and the chain stops reading as a chain. */}
            {links.length > 1 ? (
              <span
                aria-hidden
                className="absolute top-3 bottom-3 left-2 w-px -translate-x-1/2 bg-line-strong"
              />
            ) : null}
            <ol className="m-0 flex list-none flex-col p-0">
              {links.map((s, i) => {
                const Icon = ICONS[s.icon] ?? ICON_ORDER[i % ICON_ORDER.length];
                return (
                  <li
                    key={`${s.step}:${s.fileRef}`}
                    style={{ animationDelay: `${i * 40}ms` }}
                    className={cn(
                      "relative flex h-11 items-start gap-2.5 pt-1",
                      "animate-in fade-in-0 slide-in-from-left-1 fill-mode-both",
                      "duration-[var(--dur-base)] ease-[var(--ease-out)]",
                    )}
                  >
                    <span className="z-10 flex size-4 items-center justify-center bg-canvas">
                      <Icon size={14} strokeWidth={1.5} className="text-ink-2" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-base text-ink-2">{s.step}</div>
                      <SourceRef fileRef={s.fileRef} className="text-xs" />
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>

      {xray ? (
        <div className="border-t border-line pt-3">
          <CapsHeader>Weakest link</CapsHeader>
          <div className="flex items-start gap-1.5">
            <Dot tone={inferred ? "warn" : "ok"} className="mt-1.5" />
            <span className="text-base leading-5 text-ink-2">{xray.weakest}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
