import { Fragment } from "react";
import { ChevronLeft } from "lucide-react";
import type { Route } from "@/daemon/types";
import { useStore } from "@/state/store";
import { Dot, MethodBadge, Pill } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { ROW_SM } from "@/lib/metrics";
import { cn } from "@/lib/utils";

const STAGGER_MS = 12;
const STAGGER_MAX = 16;

function RouteRow({
  method,
  path,
  extra = false,
  index,
}: {
  method: string;
  path: string;
  extra?: boolean;
  index: number;
}) {
  return (
    <li
      style={{ height: ROW_SM, animationDelay: `${Math.min(index, STAGGER_MAX) * STAGGER_MS}ms` }}
      className={cn(
        "flex shrink-0 items-center gap-2.5 rounded-md px-2",
        "animate-in fade-in-0 fill-mode-both duration-[var(--dur-base)] ease-[var(--ease-out)]",
        "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:bg-ds-gray-alpha-100",
        extra && "bg-warn-soft hover:bg-warn-soft",
      )}
    >
      <MethodBadge method={method} />
      <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink-2">{path}</span>
      {extra ? <Pill tone="warn">runtime only</Pill> : <Dot tone="ok" />}
    </li>
  );
}

const RUNTIME_EXTRA = { method: "GET", path: "/api/v1/reports/:id" };

/** Runtime reconcile view (opened from the "verify at runtime" banner). */
export function ReconcilePage() {
  const routes = useStore((s) => s.routes);
  const navigate = useStore((s) => s.navigate);
  const pushToast = useStore((s) => s.pushToast);
  const openTabs = useStore((s) => s.openTabs);
  const activeTabId = useStore((s) => s.activeTabId);

  const staticRoutes = routes.filter((r) => r.protocol === "http");
  const insertAfter = (r: Route) => r.method === "GET" && r.path === "/api/v1/products/:id";

  // `go:"section"` keeps sections.routes.view as-is, so route back explicitly.
  const backToWorkbench = () => {
    const routeId =
      openTabs.find((t) => t.id === activeTabId)?.routeId ?? openTabs[0]?.routeId ?? staticRoutes[0]?.id;
    if (routeId) navigate({ go: "route", routeId });
    else navigate({ go: "section", section: "routes" });
  };

  let runtimeIndex = 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col px-6 pt-4">
        {/* back link */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={backToWorkbench}
          className={cn(
            "h-7 shrink-0 self-start gap-1.5 px-1.5 text-base font-normal text-ink-3",
            "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink",
          )}
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
          Routes · opened from the &ldquo;verify at runtime&rdquo; banner
        </Button>

        {/* header */}
        <div className="mt-4 flex shrink-0 items-start gap-6">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-ink">Runtime reconcile</h1>
            <p className="mt-1 text-base text-ink-2">
              Static analysis vs. what the running server actually mounted — accept the runtime truth to update
              the map.
            </p>
          </div>
          <div className="flex-1" />
          <Button
            type="button"
            size="lg"
            className="h-9 shrink-0 rounded-lg px-3.5 text-base font-medium transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]"
            onClick={() =>
              pushToast({
                kind: "info",
                text: "Runtime truth accepted",
                sub: "GET /api/v1/reports/:id added to the route map",
              })
            }
          >
            Accept runtime truth
          </Button>
        </div>

        {/* two columns */}
        <div className="fade-scroll mt-5 grid min-h-0 flex-1 grid-cols-2 gap-x-8 overflow-y-auto pb-4">
          <section className="flex flex-col">
            <h2 className="caps-label sticky top-0 z-10 flex h-9 items-center border-b border-line bg-canvas">
              Static · {staticRoutes.length}
            </h2>
            <ul className="flex flex-col pt-1">
              {staticRoutes.map((r, i) => (
                <RouteRow key={r.id} method={r.method} path={r.path} index={i} />
              ))}
            </ul>
          </section>

          <section className="flex flex-col">
            <h2 className="caps-label sticky top-0 z-10 flex h-9 items-center border-b border-line bg-canvas">
              Runtime · {staticRoutes.length + 1}
            </h2>
            <ul className="flex flex-col pt-1">
              {staticRoutes.map((r) => (
                <Fragment key={r.id}>
                  <RouteRow method={r.method} path={r.path} index={runtimeIndex++} />
                  {insertAfter(r) ? (
                    <RouteRow
                      method={RUNTIME_EXTRA.method}
                      path={RUNTIME_EXTRA.path}
                      extra
                      index={runtimeIndex++}
                    />
                  ) : null}
                </Fragment>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* reconcile strip */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-t border-line px-6">
        <Dot tone="ok" />
        <Dot tone="warn" />
        <span className="text-base text-ink-2">
          {staticRoutes.length} matched · 1 extra (runtime) · 0 missing
        </span>
        <span className="text-base text-ink-3">— the extra route was mounted by a plugin at boot</span>
      </div>
    </div>
  );
}
