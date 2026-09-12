import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { useStore } from "@/state/store";
import type { HistoryEntry, Route } from "@/daemon/types";
import { Dot, GhostButton, MethodBadge, StatusChip } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { clockTime, formatMs, statusText } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ── stat strip ───────────────────────────────────────────────────────────── */

function Stat({ value, label, ok = false }: { value: string; label: string; ok?: boolean }) {
  return (
    <div className="flex flex-1 flex-col gap-1.5 border-l border-line px-6 first:border-l-0 first:pl-0">
      <span className={cn("text-xl font-semibold tabular-nums", ok ? "text-ok" : "text-ink")}>{value}</span>
      <span className="truncate text-base text-ink-3">{label}</span>
    </div>
  );
}

/* ── section header ───────────────────────────────────────────────────────── */

function SectionHead({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex h-8 items-center justify-between border-b border-line">
      <span className="caps-label">{children}</span>
      {right}
    </div>
  );
}

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="-mr-2 h-7 gap-1 px-2 text-base font-normal text-link-z transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:bg-ds-gray-alpha-100 hover:text-link-z focus-visible:bg-ds-gray-alpha-100"
    >
      {children}
      <ChevronRight size={14} strokeWidth={1.5} />
    </Button>
  );
}

/**
 * A navigating list row. No hairline: structure comes from the inset hover
 * pill, exactly as in Vercel's tables — and hover and keyboard focus are
 * written as one rule so a keyboard user sees what a mouse user sees.
 */
function NavRow({
  onClick,
  index = 0,
  label,
  children,
}: {
  onClick: () => void;
  index?: number;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{ animationDelay: `${Math.min(index, 8) * 25}ms`, animationDuration: "var(--dur-slow)" }}
      className={cn(
        "-mx-2 flex h-10 w-[calc(100%+16px)] items-center gap-3 rounded-md px-2 text-left",
        "animate-in fade-in-0 fill-mode-backwards ease-[var(--ease-out)]",
        "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
        "hover:bg-ds-gray-alpha-100 focus-visible:bg-ds-gray-alpha-100",
      )}
    >
      {children}
    </button>
  );
}

/* ── page ─────────────────────────────────────────────────────────────────── */

export function OverviewPage() {
  const navigate = useStore((s) => s.navigate);
  const routes = useStore((s) => s.routes);
  const projects = useStore((s) => s.projects);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const diagnostics = useStore((s) => s.diagnostics);
  const schedules = useStore((s) => s.schedules);
  const historyEntries = useStore((s) => s.historyEntries);
  const mockServer = useStore((s) => s.mockServer);
  const mocks = useStore((s) => s.mocks);

  const project = projects.find((p) => p.id === activeProjectId);
  const fileCount = project?.fileCount ?? 35;
  const diagCount = diagnostics.filter((d) => d.level !== "info").length;
  const monitors = schedules.filter((s) => s.enabled).length;

  const certain = routes.filter((r) => r.confidence >= 0.9).length;
  const inferred = routes.filter((r) => r.confidence < 0.9 && r.confidence >= 0.4).length;
  const guessed = routes.length - certain - inferred;

  const activity = historyEntries.slice(0, 5);

  /* Jump back in — most recent unique matched routes from history. */
  const jumpBack: Route[] = [];
  for (const e of historyEntries) {
    if (!e.routeId) continue;
    const r = routes.find((x) => x.id === e.routeId);
    if (r && !jumpBack.includes(r)) jumpBack.push(r);
    if (jumpBack.length === 3) break;
  }

  return (
    <div className="fade-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-8 px-7 pt-6 pb-16">
        {/* stat strip */}
        <div className="flex items-stretch">
          <Stat value={String(project?.routeCount ?? routes.length)} label={`routes · ${fileCount} source files`} />
          <Stat value="100%" label={`discovered · ${diagCount} diagnostics`} />
          <Stat value="27/27" label="last run-all · 2 m ago" ok />
          <Stat value={String(monitors)} label="monitors · both passing" />
        </div>

        {/* activity */}
        <section>
          <SectionHead
            right={
              <LinkButton onClick={() => navigate({ go: "history", mode: "recorded" })}>View history</LinkButton>
            }
          >
            Activity
          </SectionHead>
          <div className="mt-1 flex flex-col">
            {activity.map((e: HistoryEntry, i) => (
              <NavRow
                key={e.id}
                index={i}
                label={`${e.method} ${e.path} — ${e.status} ${statusText(e.status)}`}
                onClick={() => navigate({ go: "history", mode: "recorded", entryId: e.id })}
              >
                <MethodBadge method={e.method} />
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{e.path}</span>
                <StatusChip code={e.status} label={`${e.status} ${statusText(e.status)}`} />
                <span className="w-16 shrink-0 text-right font-mono text-sm tabular-nums text-ink-3">
                  {formatMs(e.ms)}
                </span>
                <span className="w-12 shrink-0 text-right font-mono text-sm tabular-nums text-ink-3">
                  {clockTime(e.at).slice(0, 5)}
                </span>
              </NavRow>
            ))}
          </div>
        </section>

        {/* jump back in */}
        <section>
          <SectionHead>Jump back in</SectionHead>
          <div className="mt-1 flex flex-col">
            {jumpBack.map((r, i) => (
              <NavRow
                key={r.id}
                index={i}
                label={`Open ${r.method} ${r.path} in the workbench`}
                onClick={() => navigate({ go: "route", routeId: r.id })}
              >
                <MethodBadge method={r.method} />
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{r.path}</span>
                <span className="shrink-0 truncate font-mono text-sm text-ink-3">
                  {r.sourceLocations[0]?.file}
                </span>
              </NavRow>
            ))}
          </div>
        </section>

        {/* bottom blocks */}
        <div className="grid grid-cols-3 gap-6">
          <section>
            <SectionHead>Mock server</SectionHead>
            <div className="flex h-12 items-center gap-2">
              <Dot tone={mockServer?.running ? "ok" : "muted"} />
              <span className="truncate text-base text-ink">
                {mockServer?.running ? `Running on :${mockServer.port}` : "Stopped"}
              </span>
              <span className="shrink-0 text-base text-ink-3">{mocks.length} mocks</span>
              <GhostButton
                size="sm"
                className="ml-auto"
                onClick={() => navigate({ go: "section", section: "mocks" })}
              >
                Manage
              </GhostButton>
            </div>
          </section>

          <section>
            <SectionHead>Spec</SectionHead>
            <div className="flex h-12 items-center gap-2">
              <span className="truncate text-base text-ink">14 paths · 2 m ago</span>
              <span className="ml-auto flex shrink-0 items-center gap-2">
                <GhostButton size="sm" onClick={() => navigate({ go: "specs", tab: "document" })}>
                  View
                </GhostButton>
                <GhostButton size="sm" onClick={() => navigate({ go: "specs", tab: "document" })}>
                  Export
                </GhostButton>
              </span>
            </div>
          </section>

          <section>
            <SectionHead
              right={<LinkButton onClick={() => navigate({ go: "insights", tab: "diagnostics" })}>View</LinkButton>}
            >
              Discovery
            </SectionHead>
            <div className="flex h-12 items-center gap-2">
              <Dot tone="ok" />
              <span className="truncate text-base text-ink">express · static + runtime</span>
            </div>
            <div className="flex flex-col gap-0.5 text-base text-ink-3">
              <span className="tabular-nums">
                {certain} certain · {inferred} inferred · {guessed} guessed
              </span>
              <span className="tabular-nums">{diagCount} diagnostics</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
