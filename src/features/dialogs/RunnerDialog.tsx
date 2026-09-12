import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AccentButton, CapsHeader, GhostButton, MethodBadge, StatusChip } from "@/components/primitives";
import { DialogFrame } from "@/components/dialogs/DialogFrame";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useStore } from "@/state/store";
import { formatMs } from "@/lib/format";
import { ROW_DATA } from "@/lib/metrics";
import type { Route, RunItem } from "@/daemon/types";

/** One request in the live feed / results digest — Vercel's dense h32 data row. */
function ItemRow({
  item,
  route,
  itTag,
  index = 0,
}: {
  item: RunItem;
  route: Route | undefined;
  itTag?: boolean;
  index?: number;
}) {
  return (
    <div
      style={{ height: ROW_DATA, animationDelay: `${Math.min(index, 8) * 25}ms` }}
      className="flex items-center gap-2.5 animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-[var(--dur-base)] ease-[var(--ease-out)]"
    >
      {itTag ? <span className="w-8 shrink-0 font-mono text-xs text-ink-3">it {item.iteration}</span> : null}
      <MethodBadge method={route?.method ?? "GET"} />
      <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{route?.path ?? item.routeId}</span>
      <StatusChip code={item.code ?? 0} />
      <span className="w-14 shrink-0 text-right font-mono text-xs text-ink-3">
        {item.ms != null ? `${item.ms} ms` : ""}
      </span>
    </div>
  );
}

/** Digest of one iteration for the results view: leading rows + the failure. */
function digest(items: RunItem[]): RunItem[] {
  const failIdx = items.findIndex((i) => i.status === "fail");
  if (failIdx === -1) return items.slice(0, 4);
  const picks = items.slice(0, Math.min(2, failIdx));
  picks.push(items[failIdx]);
  if (items[failIdx + 1]) picks.push(items[failIdx + 1]);
  return picks;
}

export function RunnerDialog() {
  const running = useStore((s) => s.runnerRunning);
  const items = useStore((s) => s.runnerItems);
  const iterations = useStore((s) => s.runnerIterations);
  const dataFile = useStore((s) => s.runnerDataFile);
  const summary = useStore((s) => s.runnerSummary);
  const routes = useStore((s) => s.routes);
  const stopRun = useStore((s) => s.stopRun);
  const resetRunner = useStore((s) => s.resetRunner);
  const popDialog = useStore((s) => s.popDialog);
  const pushToast = useStore((s) => s.pushToast);
  const envName = useStore((s) => s.environments.find((e) => e.isActive)?.name ?? "Local");
  const [withData, setWithData] = useState(true);

  useEffect(() => {
    const s = useStore.getState();
    if (!s.runnerRunning && !s.runnerSummary) void s.startRun();
  }, []);

  const routeById = useMemo(() => new Map(routes.map((r) => [r.id, r])), [routes]);
  const httpCount = useMemo(() => routes.filter((r) => r.protocol === "http").length, [routes]);
  const total = httpCount * iterations;
  const completed = items.filter((i) => i.status === "pass" || i.status === "fail");
  const pct = total > 0 ? Math.round((completed.length / total) * 100) : 0;

  const done = summary != null && !running;

  let footer;
  if (done) {
    footer = (
      <>
        <GhostButton onClick={() => pushToast({ kind: "info", text: "Exported junit-results.xml" })}>
          Export JUnit
        </GhostButton>
        <GhostButton
          onClick={() => {
            resetRunner();
            void useStore.getState().startRun();
          }}
        >
          Re-run failures
        </GhostButton>
        <AccentButton
          onClick={() => {
            popDialog();
            resetRunner();
          }}
        >
          Done
        </AccentButton>
      </>
    );
  } else {
    footer = (
      <GhostButton
        onClick={() => {
          stopRun();
          popDialog();
        }}
      >
        Cancel run
      </GhostButton>
    );
  }

  /* results digest */
  let shown = 0;
  const iterationBlocks = done
    ? Array.from({ length: Math.min(iterations, 2) }, (_, k) => {
        const it = k + 1;
        const itItems = completed.filter((i) => i.iteration === it);
        const ok = itItems.filter((i) => i.status === "pass").length;
        const failed = itItems.length - ok;
        const rows = digest(itItems);
        shown += rows.length;
        return { it, ok, failed, rows };
      })
    : [];
  const moreRows = done ? completed.length - shown : 0;

  return (
    <DialogFrame title={done ? "Run results" : "Run all routes"} width={640} footer={footer}>
      {done && summary ? (
        <div className="animate-in fade-in-0 duration-[var(--dur-slow)] ease-[var(--ease-out)]">
          <div className="flex h-10 items-center gap-2 border-b border-line">
            <span className="text-base font-medium text-ok">{summary.ok} ok</span>
            <span className="text-xs text-ink-3">·</span>
            <span className="text-base font-medium text-err">{summary.failed} failed</span>
            <span className="text-xs text-ink-3">·</span>
            <span className="text-base text-ink-3">tests</span>
            <span className="font-mono text-sm text-ok">{summary.testsPass}✓</span>
            <span className="font-mono text-sm text-err">{summary.testsFail}✗</span>
            <span className="ml-auto font-mono text-xs text-ink-3">{formatMs(summary.totalMs)}</span>
          </div>
          {iterationBlocks.map((b) => (
            <div key={b.it}>
              <CapsHeader className="mt-1.5">
                Iteration {b.it} — {b.ok} ok · {b.failed} failed
              </CapsHeader>
              {b.rows.map((item, i) => (
                <div key={`${item.routeId}:${item.iteration}`}>
                  <ItemRow item={item} route={routeById.get(item.routeId)} index={i} />
                  {item.status === "fail" && item.note ? (
                    /* Geist's error Note: red-100 fill behind a red-400
                       hairline. A solid red band reads as a broken component,
                       not as one failing row's detail. */
                    <div className="my-1 flex h-8 items-center rounded-md border border-err-line bg-ds-red-100 px-3 font-mono text-xs text-err">
                      {item.note}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
          {moreRows > 0 ? <div className="mt-2.5 text-xs text-ink-3">… {moreRows} more rows</div> : null}
        </div>
      ) : (
        <>
          <div className="text-xs text-ink-3">
            {httpCount} routes · {envName} · {withData && dataFile ? "with data file" : "no data file"}
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            {withData && dataFile ? (
              <span className="flex h-6 items-center gap-1 rounded-md border border-line pr-1 pl-2 font-mono text-xs text-ink-2">
                {dataFile} · {iterations} iterations
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setWithData(false)}
                  aria-label="Remove data file"
                  className="size-4 text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:bg-transparent hover:text-ink"
                >
                  <X size={14} strokeWidth={1.5} />
                </Button>
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWithData(true)}
              className="px-1.5 text-xs font-normal text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink-2"
            >
              + data file
            </Button>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-base font-medium text-ink">
              {completed.length} / {total} requests
            </span>
            <span className="font-mono text-xs tabular-nums text-ink-3">{pct}%</span>
          </div>
          <Progress
            value={pct}
            aria-label="Run progress"
            className="mt-2 bg-activebg [&_[data-slot=progress-indicator]]:bg-accent-z [&_[data-slot=progress-indicator]]:transition-transform [&_[data-slot=progress-indicator]]:duration-[var(--dur-slow)] [&_[data-slot=progress-indicator]]:ease-[var(--ease-panel)]"
          />

          <CapsHeader className="mt-3">Live</CapsHeader>
          <div className="flex min-h-45 flex-col">
            {completed.slice(-6).map((item, i) => (
              <ItemRow
                key={`${item.routeId}:${item.iteration}`}
                item={item}
                route={routeById.get(item.routeId)}
                itTag
                index={i}
              />
            ))}
          </div>
        </>
      )}
    </DialogFrame>
  );
}
