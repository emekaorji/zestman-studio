import { Check, CircleCheck, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AccentButton, CapsHeader, MethodBadge, Pill } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getClient } from "@/app/client";
import type { Route } from "@/daemon/types";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

interface FileRow {
  path: string;
  state: "done" | "active" | "pending";
}

function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex h-8 items-center justify-between">
      <span className="text-base text-ink-2">{label}</span>
      <span className="font-mono text-base font-semibold tabular-nums text-ink">{value}</span>
    </div>
  );
}

/* The scan streams; rows must arrive, not appear. Cap the ramp so a long file
   list does not end up waiting seconds for its tail. */
const ROW_STAGGER_MS = 22;
const ROW_STAGGER_MAX = 14;

/** The route "try this first" points at: the first POST, else the first HTTP route. */
function firstRoute(routes: Route[]): Route | undefined {
  const http = routes.filter((r) => r.protocol === "http");
  return http.find((r) => r.method === "POST") ?? http[0];
}

/** `"key": value` lines from the route's JSON body, for the preview well. */
function bodyLines(route: Route): Array<[string, string]> {
  if (route.body.mode !== "raw" || !route.body.raw.text.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(route.body.raw.text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    return Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, JSON.stringify(v)]);
  } catch {
    return [];
  }
}

/** Full-screen first-scan overlay — pushed as the `scan-onboarding` dialog kind. */
export function ScanOnboarding() {
  const project = useStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const diagnostics = useStore((s) => s.diagnostics);
  const [files, setFiles] = useState<FileRow[]>(() =>
    useStore.getState().files.map((f) => ({ path: f.path, state: "pending" as const })),
  );
  const [stats, setStats] = useState({ routes: 0, schemas: 0, auth: 0 });
  const [progress, setProgress] = useState(() => ({ pct: 0, files: useStore.getState().files.length, seconds: 0 }));
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        for await (const ev of getClient().startScan()) {
          if (!alive) return;
          if (ev.t === "file") {
            setFiles((fs) => {
              const idx = fs.findIndex((f) => f.path === ev.path);
              if (idx === -1) return [...fs, { path: ev.path, state: ev.state }];
              return fs.map((f, i) => (i === idx ? { ...f, state: ev.state } : f));
            });
          } else if (ev.t === "stat") {
            setStats({ routes: ev.routes, schemas: ev.schemas, auth: ev.auth });
          } else if (ev.t === "progress") {
            setProgress({ pct: ev.pct, files: ev.files, seconds: ev.seconds });
          } else {
            setDone(true);
          }
        }
        if (alive) setDone(true);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const close = () => {
    const s = useStore.getState();
    s.setOnboarded(true);
    if (s.dialogStack.at(-1)?.kind === "scan-onboarding") s.popDialog();
  };

  const openWorkbench = () => {
    const s = useStore.getState();
    const route = firstRoute(s.routes);
    close();
    if (route) s.navigate({ go: "route", routeId: route.id });
  };

  const goDiagnostics = () => {
    close();
    useStore.getState().navigate({ go: "insights", tab: "diagnostics" });
  };

  const errorCount = diagnostics.filter((d) => d.level === "error").length;

  if (done) {
    const tryRoute = firstRoute(useStore.getState().routes);
    const lines = tryRoute ? bodyLines(tryRoute) : [];
    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center overflow-y-auto bg-canvas">
        <div
          className={cn(
            "flex w-180 max-w-[calc(100vw-4rem)] shrink-0 flex-col items-center pt-32",
            "animate-in fade-in-0 zoom-in-98 duration-[var(--dur-slow)] ease-[var(--ease-out)]",
          )}
        >
          <CircleCheck size={24} strokeWidth={1.5} className="text-ok" />
          <h1 className="mt-7 text-xl font-semibold text-ink">Your API, understood.</h1>

          <div className="mt-9 flex w-full">
            {(
              [
                [stats.routes, "routes"],
                [stats.schemas, "schemas"],
                [stats.auth, "auth'd"],
                [progress.files, "files"],
              ] as Array<[number, string]>
            ).map(([value, label], i) => (
              <div
                key={label}
                style={{ animationDelay: `${120 + i * 50}ms` }}
                className={cn(
                  "flex flex-1 flex-col items-center",
                  "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both",
                  "duration-[var(--dur-slow)] ease-[var(--ease-out)]",
                  i > 0 && "border-l border-line",
                )}
              >
                <span className="font-mono text-md font-semibold tabular-nums text-ink">{value}</span>
                <span className="mt-1 text-xs text-ink-3">{label}</span>
              </div>
            ))}
          </div>

          {tryRoute ? (
            <div
              style={{ animationDelay: "200ms" }}
              className={cn(
                "mt-10 w-155 max-w-full rounded-2xl border border-line bg-sunken p-5",
                "animate-in fade-in-0 zoom-in-98 fill-mode-both duration-[var(--dur-slow)] ease-[var(--ease-out)]",
              )}
            >
              <span className="caps-label">Try this first</span>
              <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                <MethodBadge method={tryRoute.method} fixed={false} />
                <span className="font-mono text-sm text-ink">{tryRoute.path}</span>
                {tryRoute.schemaRef ? (
                  <Pill tone="accent">body drafted from {tryRoute.schemaRef}</Pill>
                ) : (
                  <Pill tone="neutral">{tryRoute.provenance}</Pill>
                )}
              </div>
              {lines.length > 0 ? (
                <div className="mt-3.5 rounded-md border border-line bg-canvas p-3 font-mono text-sm leading-5">
                  <div className="text-ink-2">{"{"}</div>
                  {lines.map(([k, v], i) => (
                    <div key={k} className="whitespace-pre">
                      {"  "}
                      <span className="text-syntax-key">&quot;{k}&quot;</span>
                      <span className="text-ink-2">: </span>
                      <span className="text-syntax-str">{v}</span>
                      {i < lines.length - 1 ? <span className="text-ink-2">,</span> : null}
                    </div>
                  ))}
                  <div className="text-ink-2">{"}"}</div>
                </div>
              ) : null}
              <AccentButton size="lg" className="mt-4 w-full" onClick={openWorkbench}>
                Open in workbench →
              </AccentButton>
            </div>
          ) : null}

          <Button
            variant="ghost"
            size="lg"
            onClick={close}
            className="mt-8 text-base font-normal text-ink-2 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink"
          >
            Skip — take me to the studio
          </Button>
        </div>

        <div className="mt-auto flex w-full max-w-[calc(100vw-2rem)] shrink-0 justify-center pt-10 pb-10">
          {errorCount > 0 ? (
            <Button
              variant="ghost"
              size="lg"
              onClick={goDiagnostics}
              // A button is nowrap by default; this sentence is wider than a phone.
              className="h-auto max-w-full px-4 py-2 text-center font-mono text-xs leading-5 font-normal whitespace-normal text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink-2"
            >
              {errorCount} discovery {errorCount === 1 ? "error" : "errors"} — see Diagnostics
            </Button>
          ) : (
            <span className="font-mono text-xs text-ink-3">{project?.rootPath ?? ""}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center overflow-y-auto bg-canvas">
      <div className="flex w-180 max-w-[calc(100vw-4rem)] shrink-0 flex-col pt-31 animate-in fade-in-0 duration-[var(--dur-slow)] ease-[var(--ease-out)]">
        <div className="flex items-baseline justify-center gap-2.5">
          <span className="text-xl font-semibold text-ink">Zestman</span>
          <span className="text-base text-ink-2">syncing with your app</span>
        </div>

        <div className="mt-9 text-center font-mono text-sm tabular-nums text-ink-3">
          {error ? error : `${progress.files} files · ${progress.seconds.toFixed(1)} s`}
        </div>
        <Progress
          value={progress.pct}
          aria-label="Scan progress"
          className="mt-2.5 bg-activebg [&_[data-slot=progress-indicator]]:bg-accent-z [&_[data-slot=progress-indicator]]:transition-transform [&_[data-slot=progress-indicator]]:duration-[var(--dur-slow)] [&_[data-slot=progress-indicator]]:ease-[var(--ease-panel)]"
        />

        <div className="mt-7 grid grid-cols-2 gap-10">
          <div>
            <CapsHeader>Discovering</CapsHeader>
            <ul className="m-0 flex list-none flex-col p-0">
              {files.map((f, i) => (
                <li
                  key={f.path}
                  style={{ animationDelay: `${Math.min(i, ROW_STAGGER_MAX) * ROW_STAGGER_MS}ms` }}
                  className={cn(
                    "flex h-7 items-center gap-2 font-mono text-sm",
                    "animate-in fade-in-0 slide-in-from-left-1 fill-mode-both",
                    "duration-[var(--dur-base)] ease-[var(--ease-out)]",
                  )}
                >
                  {/* Fixed 16px status column. Trailing glyphs would sit at a
                      different x on every row and the list would read as
                      ragged text rather than a stream of steps. */}
                  <span
                    aria-hidden
                    className="flex size-4 shrink-0 items-center justify-center"
                  >
                    {f.state === "done" ? (
                      <Check
                        size={14}
                        strokeWidth={1.5}
                        className="text-ok animate-in fade-in-0 zoom-in-95 duration-[var(--dur-base)]"
                      />
                    ) : f.state === "active" ? (
                      <Loader2 size={14} strokeWidth={1.5} className="animate-spin text-accent-z" />
                    ) : (
                      <span className="size-1.25 rounded-full bg-ds-gray-500" />
                    )}
                  </span>
                  <span
                    className={cn(
                      "truncate transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
                      f.state === "done" && "text-ink-2",
                      f.state === "active" && "text-ink",
                      f.state === "pending" && "text-ds-gray-500",
                    )}
                  >
                    {i === 0 ? f.path : baseName(f.path)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <CapsHeader>Understood so far</CapsHeader>
            <StatRow label="routes" value={stats.routes} />
            <StatRow label="schemas inferred" value={stats.schemas} />
            <StatRow label="auth chains" value={stats.auth} />
            <div className="flex h-8 items-center justify-between">
              <span className="text-base text-ink-2">framework</span>
              <Pill tone="neutral" className="font-mono">
                {project?.framework ?? "—"}
              </Pill>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto shrink-0 pt-10 pb-10 font-mono text-xs text-ink-3">
        {project?.rootPath ?? ""}
      </div>
    </div>
  );
}
