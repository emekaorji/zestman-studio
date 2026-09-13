import { CircleCheck, CircleX, MoveRight, Play, Plus, Send, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AccentButton, GhostButton, MethodBadge, Pill, VarChip } from "@/components/primitives";
import { DataTable, type ColumnDef } from "@/components/table/DataTable";
import { TabStrip } from "@/components/tabstrip/TabStrip";
import type { Flow, FlowStep, KVRow, Route } from "@/daemon/types";
import { CodeEditor } from "@/lib/codemirror/CodeEditor";
import { relTime } from "@/lib/format";
import { ROW_DATA, ROW_LG } from "@/lib/metrics";
import { methodClass } from "@/lib/methods";
import { cn } from "@/lib/utils";
import { useStore } from "@/state/store";
import { PageBody, PageHead, SectionLabel } from "./bits";

/** Canonical body for the checkout order step — chained off step 1's extraction. */
const ORDER_STEP_BODY = `{
  "userId": {{steps.create.body.id}},
  "items": [{ "sku": "ZM-401", "qty": 2 }],
  "total": 129.99
}`;

/** Widest latency bar, in px — the run pane's timing gutter. */
const BAR_W = 210;

function stepVarKey(step: FlowStep): string | null {
  const m = /\{\{steps\.([a-zA-Z0-9_]+)\./.exec(step.extraction ?? "");
  return m ? m[1] : null;
}

function stepLabel(step: FlowStep, route: Route | undefined): string {
  return stepVarKey(step) ?? route?.name ?? "step";
}

function defaultStepBody(step: FlowStep, route: Route | undefined): string {
  if (step.extraction?.includes("steps.order")) return ORDER_STEP_BODY;
  return route?.body.raw.text || "{}";
}

/* ── Step row ─────────────────────────────────────────────────────────────── */

/**
 * One step in the left column. A real button with hover, focus-visible and
 * selected states written as one rule, and a 2px accent bar on the active edge.
 */
function StepRow({
  step,
  route,
  index,
  selected,
  showRunState,
  onSelect,
}: {
  step: FlowStep;
  route: Route | undefined;
  index: number;
  selected: boolean;
  showRunState: boolean;
  onSelect: () => void;
}) {
  const chip = step.stale ? (
    <Pill tone="warn" className="gap-1 font-mono">
      <TriangleAlert size={14} strokeWidth={1.5} />
      {step.stale}
    </Pill>
  ) : step.extraction ? (
    <Pill tone="accent" className="font-mono">
      {step.extraction}
    </Pill>
  ) : step.usesVar ? (
    <Pill className="font-mono">{step.usesVar}</Pill>
  ) : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      style={{ animationDelay: `${Math.min(index, 8) * 20}ms` }}
      className={cn(
        "group/step relative flex w-full flex-col justify-center gap-1.5 overflow-hidden rounded-md border px-3 py-2 text-left",
        "animate-in fade-in-0 fill-mode-both duration-[var(--dur-base)] ease-[var(--ease-out)]",
        "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
        selected
          ? "border-line-strong bg-ds-gray-200"
          : "border-line bg-transparent hover:bg-ds-gray-alpha-100 focus-visible:bg-ds-gray-alpha-100",
      )}
    >
      {selected ? (
        <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-accent-z" />
      ) : null}
      <span className="flex w-full items-center gap-2">
        <span className="w-3 shrink-0 font-mono text-sm tabular-nums text-ds-gray-600">
          {index + 1}
        </span>
        <MethodBadge method={route?.method ?? "GET"} />
        <span className="truncate font-mono text-sm text-ink">{route?.path}</span>
        {showRunState && step.runState ? (
          <span className="ml-auto flex shrink-0 items-center">
            <span
              className={cn(
                "size-1.5 rounded-full",
                step.runState === "fail" ? "bg-err" : "bg-ok",
              )}
            />
            <span className="sr-only">{step.runState === "fail" ? "failed" : "passed"}</span>
          </span>
        ) : null}
      </span>
      {chip ? <span className="flex pl-5">{chip}</span> : null}
    </button>
  );
}

/* ── Flow editor ──────────────────────────────────────────────────────────── */

/** Flow editor — step cards on the left, mini workbench or run view on the right. */
export function FlowEditor({ flowId, run }: { flowId: string | null; run: boolean }) {
  const flows = useStore((s) => s.flows);
  const routes = useStore((s) => s.routes);
  const navigate = useStore((s) => s.navigate);
  const pushToast = useStore((s) => s.pushToast);

  const flow: Flow | undefined = flows.find((f) => f.id === flowId) ?? flows[0];
  const routeById = useMemo(() => new Map(routes.map((r) => [r.id, r])), [routes]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [stepTab, setStepTab] = useState<"params" | "body">("body");

  useEffect(() => {
    // Default selection: step 2 when present, else the first step.
    setSelectedId(flow?.steps[1]?.id ?? flow?.steps[0]?.id ?? null);
    setStepTab("body");
  }, [flow?.id, flow?.steps]);

  if (!flow) return null;

  const selectedIdx = Math.max(
    0,
    flow.steps.findIndex((st) => st.id === selectedId),
  );
  const selected = flow.steps[selectedIdx];
  const selectedRoute = selected ? routeById.get(selected.routeId) : undefined;

  const paramColumns: Array<ColumnDef<KVRow>> = [
    {
      id: "key",
      header: "Key",
      width: 200,
      mono: true,
      cell: (kv) => <span className="truncate text-ink">{kv.key}</span>,
    },
    {
      id: "value",
      header: "Value",
      mono: true,
      cell: (kv) => <span className="truncate text-ink-2">{kv.value}</span>,
    },
  ];

  const params = selectedRoute ? [...selectedRoute.params, ...selectedRoute.query] : [];

  return (
    <PageBody>
      <PageHead
        title={flow.name}
        actions={
          <AccentButton onClick={() => navigate({ go: "flowRun", flowId: flow.id })}>
            <Play size={16} strokeWidth={1.5} />
            Run flow
          </AccentButton>
        }
      >
        <span className="truncate rounded-md border border-line px-2 py-0.5 font-mono text-xs text-ink-3">
          {flow.file}
        </span>
      </PageHead>

      <div className="mt-4 flex flex-col items-stretch gap-6 lg:flex-row lg:items-start">
        {/* Steps column */}
        <div className="w-full min-w-0 shrink-0 lg:w-[380px]">
          <SectionLabel>Steps · {flow.steps.length}</SectionLabel>
          <div className="flex flex-col gap-1.5">
            {flow.steps.map((step, i) => (
              <StepRow
                key={step.id}
                step={step}
                route={routeById.get(step.routeId)}
                index={i}
                selected={step.id === selected?.id}
                showRunState={run}
                onSelect={() => setSelectedId(step.id)}
              />
            ))}
          </div>
          <GhostButton
            className="mt-3"
            onClick={() =>
              pushToast({
                kind: "info",
                text: "Pick a route to append",
                sub: "coming from the routes list",
              })
            }
          >
            <Plus size={16} strokeWidth={1.5} />
            Add step
          </GhostButton>
        </div>

        {/* Right column */}
        <div className="min-w-0 flex-1">
          {run ? (
            <FlowRunPane flow={flow} routeById={routeById} />
          ) : selected && selectedRoute ? (
            /* Keyed on the step so re-selecting replays the enter animation:
               the pane fades and slides 4px rather than swapping instantly. */
            <div
              key={selected.id}
              className="animate-in fade-in-0 slide-in-from-right-1 duration-[var(--dur-base)] ease-[var(--ease-out)]"
            >
              <SectionLabel>
                Step {selectedIdx + 1} · {stepLabel(selected, selectedRoute)}
              </SectionLabel>

              <div className="flex h-9 items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-8 shrink-0 items-center rounded-md border border-line px-2 font-mono text-2xs font-semibold tracking-[0.04em]",
                    methodClass(selectedRoute.method),
                  )}
                >
                  {selectedRoute.method.toUpperCase()}
                </span>
                <VarChip name="baseUrl" />
                <span className="min-w-0 truncate font-mono text-sm text-ink">
                  {selectedRoute.path}
                </span>
                <div className="ml-auto shrink-0">
                  <GhostButton
                    onClick={() =>
                      pushToast({
                        kind: "info",
                        text: "Run the flow to send this step",
                        sub: "steps share extracted variables",
                      })
                    }
                  >
                    <Send size={16} strokeWidth={1.5} />
                    Send
                  </GhostButton>
                </div>
              </div>

              <TabStrip
                label="Flow step sections"
                className="mt-2"
                variant="request"
                tabs={[
                  { id: "params" as const, label: "Params", count: params.length || undefined },
                  { id: "body" as const, label: "Body" },
                ]}
                active={stepTab}
                onSelect={setStepTab}
              />

              {stepTab === "body" ? (
                <CodeEditor
                  ariaLabel="Flow step request body"
                  className="mt-3"
                  value={bodies[selected.id] ?? defaultStepBody(selected, selectedRoute)}
                  onChange={(v) => setBodies((b) => ({ ...b, [selected.id]: v }))}
                  language="json"
                  minHeight="176px"
                />
              ) : params.length === 0 ? (
                <div className="flex h-16 items-center text-base text-ink-3">
                  No params on this step
                </div>
              ) : (
                <DataTable
                  className="mt-1"
                  label="Step params"
                  columns={paramColumns}
                  rows={params}
                  rowKey={(kv) => kv.id}
                  rowHeight={ROW_DATA}
                />
              )}

              {selected.extraction ? (
                <>
                  <SectionLabel className="mt-3">Extract · 1</SectionLabel>
                  <div className="flex h-9 items-center gap-2 rounded-md border border-line px-3">
                    <MoveRight size={16} strokeWidth={1.5} className="shrink-0 text-link-z" />
                    <span className="truncate font-mono text-sm text-ink-2">
                      response body.id → {selected.extraction.replace(/^→\s*/, "")}
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </PageBody>
  );
}

/* ── Run pane ─────────────────────────────────────────────────────────────── */

/** Run swimlanes — one row per step with latency bar and failure strip. */
function FlowRunPane({ flow, routeById }: { flow: Flow; routeById: Map<string, Route> }) {
  const pushToast = useStore((s) => s.pushToast);
  const lastRun = flow.lastRun;
  const allPassed = lastRun != null && lastRun.passed === lastRun.total;

  return (
    <div className="animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]">
      <div className="flex h-8 items-center gap-2.5">
        <span className="text-base text-ink">Run · {lastRun ? relTime(lastRun.at) : "never"}</span>
        {lastRun ? (
          <Pill tone={allPassed ? "ok" : "warn"}>
            {lastRun.passed} / {lastRun.total} passed
          </Pill>
        ) : null}
      </div>

      <ul className="mt-1">
        {flow.steps.map((step, i) => {
          const route = routeById.get(step.routeId);
          const failed = step.runState === "fail";
          return (
            <li
              key={step.id}
              style={{ animationDelay: `${Math.min(i, 8) * 25}ms` }}
              className="animate-in fade-in-0 fill-mode-both duration-[var(--dur-base)] ease-[var(--ease-out)]"
            >
              <div
                style={{ height: ROW_LG }}
                className="flex items-center gap-2.5 border-b border-line/70"
              >
                {failed ? (
                  <CircleX size={16} strokeWidth={1.5} className="shrink-0 text-err" />
                ) : (
                  <CircleCheck size={16} strokeWidth={1.5} className="shrink-0 text-ok" />
                )}
                <MethodBadge method={route?.method ?? "GET"} />
                <span className="min-w-0 flex-1 truncate pr-4 font-mono text-sm text-ink">
                  {route?.path}
                </span>
                <span className="hidden shrink-0 sm:block" style={{ width: BAR_W }}>
                  <span
                    className={cn(
                      "block h-1 rounded-full transition-[width] duration-[var(--dur-panel)] ease-[var(--ease-panel)]",
                      failed ? "bg-err" : "bg-ds-gray-500",
                    )}
                    style={{ width: Math.min(step.ms ?? 0, BAR_W) }}
                  />
                </span>
                <span className="ml-4 w-16 shrink-0 text-right font-mono text-sm tabular-nums text-ink-3">
                  {step.ms} ms
                </span>
              </div>
              {failed && step.failNote ? (
                <div className="my-1.5 flex min-h-9 items-center justify-between gap-3 rounded-md bg-err-soft px-3 py-1.5">
                  <span className="min-w-0 truncate font-mono text-sm text-err">
                    {step.failNote}
                  </span>
                  <GhostButton
                    size="sm"
                    onClick={() =>
                      pushToast({
                        kind: "info",
                        text: `Re-running from step ${i + 1}`,
                        sub: "earlier extractions are reused",
                      })
                    }
                  >
                    Re-run from step {i + 1}
                  </GhostButton>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
