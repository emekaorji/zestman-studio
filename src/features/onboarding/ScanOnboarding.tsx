import { Check, CircleCheck, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AccentButton, CapsHeader, MethodBadge, Pill } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getClient } from "@/app/client";
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

/** Full-screen first-scan overlay — pushed as the `scan-onboarding` dialog kind. */
export function ScanOnboarding() {
  const [files, setFiles] = useState<FileRow[]>(() =>
    useStore.getState().files.map((f) => ({ path: f.path, state: "pending" as const })),
  );
  const [stats, setStats] = useState({ routes: 0, schemas: 0, auth: 0 });
  const [progress, setProgress] = useState({ pct: 0, files: 35, seconds: 1.8 });
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
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
    const route = s.routes.find((r) => r.method === "POST" && r.path === "/api/v1/users");
    close();
    if (route) s.navigate({ go: "route", routeId: route.id });
  };

  const goDiagnostics = () => {
    close();
    useStore.getState().navigate({ go: "insights", tab: "diagnostics" });
  };

  if (done) {
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
                [0, "config"],
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

          <div
            style={{ animationDelay: "200ms" }}
            className={cn(
              "mt-10 w-155 max-w-full rounded-2xl border border-line bg-sunken p-5",
              "animate-in fade-in-0 zoom-in-98 fill-mode-both duration-[var(--dur-slow)] ease-[var(--ease-out)]",
            )}
          >
            <span className="caps-label">Try this first</span>
            <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
              <MethodBadge method="POST" fixed={false} />
              <span className="font-mono text-sm text-ink">/api/v1/users</span>
              <Pill tone="accent">body drafted from users.schema.ts</Pill>
            </div>
            <div className="mt-3.5 rounded-md border border-line bg-canvas p-3 font-mono text-sm leading-5">
              <div className="text-ink-2">{"{"}</div>
              {(
                [
                  ["name", "Ada Lovelace", true],
                  ["email", "ada@example.com", true],
                  ["role", "admin", false],
                ] as Array<[string, string, boolean]>
              ).map(([k, v, comma]) => (
                <div key={k} className="whitespace-pre">
                  {"  "}
                  <span className="text-syntax-key">&quot;{k}&quot;</span>
                  <span className="text-ink-2">: </span>
                  <span className="text-syntax-str">&quot;{v}&quot;</span>
                  {comma ? <span className="text-ink-2">,</span> : null}
                </div>
              ))}
              <div className="text-ink-2">{"}"}</div>
            </div>
            <AccentButton size="lg" className="mt-4 w-full" onClick={openWorkbench}>
              Open in workbench →
            </AccentButton>
          </div>

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
          <Button
            variant="ghost"
            size="lg"
            onClick={goDiagnostics}
            // A button is nowrap by default; this sentence is wider than a phone.
            className="h-auto max-w-full px-4 py-2 text-center font-mono text-xs leading-5 font-normal whitespace-normal text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink-2"
          >
            3 routes could not be resolved statically — see Diagnostics
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center overflow-y-auto bg-canvas">
      <div className="flex w-180 max-w-[calc(100vw-4rem)] shrink-0 flex-col pt-31 animate-in fade-in-0 duration-[var(--dur-slow)] ease-[var(--ease-out)]">
        <div className="flex items-baseline justify-center gap-2.5">
          <span className="text-xl font-semibold text-ink">Zestman</span>
          <span className="text-base text-ink-2">reading your codebase</span>
        </div>

        <div className="mt-9 text-center font-mono text-sm tabular-nums text-ink-3">
          {progress.files} files · {progress.seconds.toFixed(1)} s
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
                express · runtime class
              </Pill>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto shrink-0 pt-10 pb-10 font-mono text-xs text-ink-3">
        npx zestman — no config, nothing uploaded
      </div>
    </div>
  );
}
