import { Braces, CornerDownRight, FileOutput, Route as RouteIcon, ShieldCheck } from "lucide-react";
import { useStore } from "@/state/store";
import { CapsHeader, Dot, Pill } from "@/components/primitives";
import { cn } from "@/lib/utils";

const STEP_ICONS = [RouteIcon, CornerDownRight, ShieldCheck, Braces, FileOutput];

/** Rail · X-ray — the discovery evidence chain ("show your work"). */
export function XrayTab() {
  const routes = useStore((s) => s.routes);
  const openTabs = useStore((s) => s.openTabs);
  const activeTabId = useStore((s) => s.activeTabId);

  const tab = openTabs.find((t) => t.id === activeTabId);
  const route = routes.find((r) => r.id === tab?.routeId) ?? routes.find((r) => r.name === "Create user");
  const inferred = route?.provenance === "inferred";

  const steps = [
    { label: "Route declared", ref: route?.sourceLocations[0]?.file ?? "users.controller.ts:22" },
    { label: "Mounted at /api/v1", ref: "app.ts:31" },
    { label: "Middleware requireAuth", ref: "middleware/auth.ts:9" },
    { label: "Body schema (Zod)", ref: route?.schemaRef ?? "users.schema.ts:12" },
    { label: "Response inferred", ref: "users.controller.ts:31" },
  ];

  return (
    <div
      key={route?.id ?? "none"}
      className="flex flex-col gap-3.5 p-3 animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]"
    >
      <div className="flex items-center gap-2">
        <Pill tone={inferred ? "warn" : "ok"} className="font-semibold tracking-[0.04em]">
          {inferred ? "INFERRED" : "CERTAIN"}
        </Pill>
        <span className="text-xs text-ink-3">
          {inferred ? "3 of 5 links verified" : "5 of 5 links verified"}
        </span>
      </div>

      <div>
        <CapsHeader>Evidence chain</CapsHeader>
        <div className="relative flex flex-col">
          {/* The spine, centred on the 16px icon column (centre = 8px). It is
              gray-400, not gray-200: on the pure-black rail a gray-200 line is
              invisible, and the chain stops reading as a chain. */}
          <span
            aria-hidden
            className="absolute top-3 bottom-3 left-2 w-px -translate-x-1/2 bg-line-strong"
          />
          <ol className="m-0 flex list-none flex-col p-0">
            {steps.map((s, i) => {
              const Icon = STEP_ICONS[i];
              return (
                <li
                  key={s.label}
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
                    <div className="text-base text-ink-2">{s.label}</div>
                    <div className="truncate font-mono text-xs text-link-z">{s.ref}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className="border-t border-line pt-3">
        <CapsHeader>Weakest link</CapsHeader>
        <div className="flex items-start gap-1.5">
          <Dot tone={inferred ? "warn" : "ok"} className="mt-1.5" />
          <span className="text-base leading-5 text-ink-2">
            {inferred
              ? "route path computed from variable — verify at runtime"
              : "all links static — no runtime guess"}
          </span>
        </div>
      </div>
    </div>
  );
}
