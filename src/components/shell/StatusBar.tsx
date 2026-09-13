import { AlertTriangle } from "lucide-react";
import { useStore } from "@/state/store";
import { Dot } from "@/components/primitives";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { STATUS_H } from "@/lib/metrics";

const COLOUR = "transition-colors duration-150 ease-in-out";

/** THE status bar — h24 on the page background, hairline on top, 12px muted. */
export function StatusBar() {
  const projects = useStore((s) => s.projects);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const environments = useStore((s) => s.environments);
  const routes = useStore((s) => s.routes);
  const files = useStore((s) => s.files);
  const diagnostics = useStore((s) => s.diagnostics);
  const navigate = useStore((s) => s.navigate);

  const project = projects.find((p) => p.id === activeProjectId);
  const env = environments.find((e) => e.isActive);
  const baseUrl = env?.variables.find((v) => v.key === "baseUrl")?.value ?? "";
  const warnCount = diagnostics.filter((d) => d.level !== "info").length;
  const httpCount = routes.filter((r) => r.protocol === "http").length;
  const fileCount = project?.fileCount ?? files.length;

  return (
    <TooltipProvider delayDuration={250}>
      <footer
        className="flex shrink-0 items-center justify-between gap-4 border-t border-line bg-canvas px-3 text-xs text-ink-3"
        style={{ height: STATUS_H }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {warnCount > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`${warnCount} ${warnCount === 1 ? "diagnostic" : "diagnostics"} — open Insights`}
                  onClick={() => navigate({ go: "insights", tab: "diagnostics" })}
                  className={cn(
                    "flex h-4 shrink-0 items-center gap-1 rounded-sm bg-warn-soft px-1.5 text-xs text-warn",
                    "hover:bg-warn-line",
                    COLOUR,
                  )}
                >
                  <AlertTriangle size={14} strokeWidth={1.5} />
                  {warnCount}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                {warnCount === 1 ? "1 diagnostic" : `${warnCount} diagnostics`} — open Insights
              </TooltipContent>
            </Tooltip>
          ) : null}
          {/* The path is context, not function — on a phone it truncates to "~/…"
              and says nothing, so it goes. */}
          <span className="truncate font-mono max-sm:hidden">
            {project?.rootPath ?? "~"} · {env?.name ?? "—"} · {baseUrl}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="flex items-center gap-1.5">
            <Dot tone="ok" />
            <span className="max-sm:sr-only">watching</span>
          </span>
          <span className="font-mono">
            {httpCount} routes<span className="max-md:hidden"> · {fileCount} files · 0.1.0</span>
          </span>
        </div>
      </footer>
    </TooltipProvider>
  );
}
