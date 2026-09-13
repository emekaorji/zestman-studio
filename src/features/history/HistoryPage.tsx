import { Braces, ChevronLeft, Info, ListChecks, Radio, RotateCcw, Workflow } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useStore } from "@/state/store";
import type { Example, HistoryEntry, Mock } from "@/daemon/types";
import {
  AccentButton,
  Dot,
  EmptyState,
  GhostButton,
  MethodBadge,
  Pill,
  StatusChip,
} from "@/components/primitives";
import { DataTable, type ColumnDef } from "@/components/table/DataTable";
import { DialogFrame, DialogFooterSplit } from "@/components/dialogs/DialogFrame";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CodeEditor } from "@/lib/codemirror/CodeEditor";
import { clockTime, formatBytes, formatMs, statusText } from "@/lib/format";
import { freezeFixtures } from "@/daemon/fixture/FixtureClient";
import { id } from "@/lib/ids";
import { cn } from "@/lib/utils";

/** Row affordances that fade in on hover (DataTable reveals `.opacity-0`). */
const REVEAL = "opacity-0 focus-visible:opacity-100";

const APP_START = Date.now();

/* Canonical unmatched triage rows — the fixture live tap emits only matched
   traffic, so the triage surface seeds the session's unmatched calls here. */
interface UnmatchedRow {
  id: string;
  at: number;
  method: string;
  path: string;
  suggestion: string;
  kind: "mean" | "ignore" | "chip";
  note: string;
}
const UNMATCHED_SEED: UnmatchedRow[] = [
  {
    id: "um1",
    at: APP_START - 50_000,
    method: "GET",
    path: "/api/v1/reprts/:id",
    suggestion: "did you mean /api/v1/reports/:id?",
    kind: "mean",
    note: "seen 3× this session",
  },
  {
    id: "um2",
    at: APP_START - 82_000,
    method: "GET",
    path: "/favicon.ico",
    suggestion: "ignore",
    kind: "ignore",
    note: "browser request",
  },
  {
    id: "um3",
    at: APP_START - 124_000,
    method: "POST",
    path: "/webhooks/stripe",
    suggestion: "add as manualRoute",
    kind: "chip",
    note: "third-party webhook",
  },
];

function prependHistory(entry: HistoryEntry) {
  useStore.setState((s) => ({ historyEntries: [entry, ...s.historyEntries] }));
}

function resendOf(e: HistoryEntry): HistoryEntry {
  return { ...e, id: id("h"), at: Date.now() };
}

/* ── page frame ───────────────────────────────────────────────────────────
   Vercel's Logs layout: a fixed toolbar row, a grid that owns its own scroll
   (so the h40 table header stays pinned and the body fogs), a status footer.
   ───────────────────────────────────────────────────────────────────────── */

function PageFrame({
  title,
  meta,
  lead,
  actions,
  banner,
  footer,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  /** A back link or breadcrumb rendered above the title row. */
  lead?: ReactNode;
  actions?: ReactNode;
  banner?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 sm:px-7 pt-5">
        {lead}
        <div className={cn("flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2", lead && "mt-2")}>
          <h1 className="shrink-0 text-md font-semibold text-ink">{title}</h1>
          {meta ? <span className="min-w-0 truncate text-base text-ink-3">{meta}</span> : null}
          {actions ? <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
        {banner ? <div className="mt-3">{banner}</div> : null}
      </div>
      <div className="fade-scroll min-h-0 flex-1 overflow-y-auto px-4 sm:px-7 pt-2 pb-10">{children}</div>
      {footer ? (
        <div className="flex h-8 shrink-0 items-center gap-1.5 border-t border-line px-4 sm:px-7 font-mono text-xs text-ink-3 min-w-0 overflow-hidden whitespace-nowrap [&>*]:min-w-0 [&>*]:truncate">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

function BackLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="-ml-2 w-fit shrink-0 gap-1 self-start px-2 text-base font-normal text-ink-2 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:bg-ds-gray-alpha-100 hover:text-ink focus-visible:bg-ds-gray-alpha-100"
    >
      <ChevronLeft size={16} strokeWidth={1.5} />
      {children}
    </Button>
  );
}

/* ── shared table cells ───────────────────────────────────────────────────── */

const timeCell = (at: number) => <span className="font-mono text-sm text-ink-3 tabular-nums">{clockTime(at)}</span>;
const pathCell = (path: string) => <span className="truncate font-mono text-sm text-ink">{path}</span>;
const msCell = (ms: number) => <span className="font-mono text-sm tabular-nums text-ink-3">{formatMs(ms)}</span>;

/* ── recorded list ────────────────────────────────────────────────────────── */

function RecordedList() {
  const navigate = useStore((s) => s.navigate);
  const pushDialog = useStore((s) => s.pushDialog);
  const pushToast = useStore((s) => s.pushToast);
  const historyDays = useStore((s) => s.historyDays);
  const historyEntries = useStore((s) => s.historyEntries);
  const day = useStore((s) => s.sections.history.day);

  const dayLabel = day ?? historyDays[0]?.date ?? "Today";
  const dayMeta = historyDays.find((d) => d.date === dayLabel);
  const isFirstDay = dayLabel === historyDays[0]?.date;
  const rows = isFirstDay
    ? historyEntries
    : (dayMeta?.entryIds.map((eid) => historyEntries.find((e) => e.id === eid)).filter(Boolean) as HistoryEntry[]) ?? [];
  const total = historyDays.reduce((n, d) => n + d.count, 0);

  const resend = (e: HistoryEntry) => {
    prependHistory(resendOf(e));
    pushToast({ kind: "info", text: `Resent ${e.method} ${e.path}`, sub: `${e.status} · ${formatMs(e.ms)}` });
  };

  const columns: Array<ColumnDef<HistoryEntry>> = [
    { id: "time", header: "Time", width: 96, cell: (e) => timeCell(e.at) },
    { id: "method", header: "Method", width: 72, cell: (e) => <MethodBadge method={e.method} /> },
    { id: "path", header: "Path", cell: (e) => pathCell(e.path) },
    {
      id: "status",
      header: "Status",
      width: 124,
      cell: (e) => <StatusChip code={e.status} label={`${e.status} ${statusText(e.status)}`} />,
    },
    { id: "ms", header: "Duration", width: 88, align: "right", cell: (e) => msCell(e.ms) },
    {
      id: "resend",
      header: "",
      width: 44,
      align: "right",
      cell: (e) => (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Resend ${e.method} ${e.path}`}
          onClick={(ev) => {
            ev.stopPropagation();
            resend(e);
          }}
          className={cn(
            "text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink",
            REVEAL,
          )}
        >
          <RotateCcw size={16} strokeWidth={1.5} />
        </Button>
      ),
    },
  ];

  return (
    <PageFrame
      title={dayLabel}
      meta={`${isFirstDay ? rows.length : (dayMeta?.count ?? 0)} requests`}
      actions={<GhostButton onClick={() => pushDialog({ kind: "export" })}>Export</GhostButton>}
      footer={
        <span>
          {total} requests recorded · .zestman/history/ · searched: {dayLabel.toLowerCase()}
        </span>
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          className="h-64"
          title="No recorded requests"
          sub="only today's traffic is loaded in this workspace"
        />
      ) : (
        <DataTable
          label={`Requests recorded ${dayLabel}`}
          columns={columns}
          rows={rows}
          rowKey={(e) => e.id}
          rowHeight={32}
          onRowClick={(e) => navigate({ go: "history", mode: "recorded", entryId: e.id })}
        />
      )}
    </PageFrame>
  );
}

/* ── recorded detail ──────────────────────────────────────────────────────── */

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col">
      <div className="flex h-8 items-center border-b border-line">
        <span className="caps-label">{title}</span>
      </div>
      {children}
    </section>
  );
}

function HeaderRows({ headers }: { headers: Array<{ key: string; value: string }> }) {
  return (
    <dl className="mt-3 flex flex-col">
      {headers.map((h) => (
        <div key={h.key} className="flex h-9 items-center gap-4 border-b border-line/60">
          <dt className="w-44 shrink-0 truncate font-mono text-sm text-ink-2">{h.key}</dt>
          <dd className="m-0 min-w-0 flex-1 truncate text-right font-mono text-sm text-ink">{h.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function BodyBlock({ body }: { body: string | null }) {
  return (
    <div className="mt-5">
      <div className="mb-2 caps-label">Body</div>
      {body == null ? (
        <div className="flex h-16 items-center justify-center rounded-lg bg-sunken text-base text-ink-3">
          no body
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line">
          <CodeEditor
            value={body}
            language="json"
            readOnly
            highlightVariables={false}
            minHeight="80px"
            ariaLabel="Recorded response body"
          />
        </div>
      )}
    </div>
  );
}

function EntryDetail({ entry }: { entry: HistoryEntry }) {
  const navigate = useStore((s) => s.navigate);
  const pushToast = useStore((s) => s.pushToast);
  const historyDays = useStore((s) => s.historyDays);
  const day = useStore((s) => s.sections.history.day);
  const dayLabel = day ?? historyDays[0]?.date ?? "Today";

  const resend = () => {
    prependHistory(resendOf(entry));
    pushToast({
      kind: "info",
      text: `Resent ${entry.method} ${entry.path}`,
      sub: `${entry.status} · ${formatMs(entry.ms)}`,
    });
  };

  return (
    <div className="fade-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col px-4 sm:px-7 pt-5 pb-16">
        <BackLink onClick={() => navigate({ go: "history", mode: "recorded" })}>
          {dayLabel} · {clockTime(entry.at)}
        </BackLink>

        <div className="mt-4 flex items-center gap-3">
          <MethodBadge method={entry.method} fixed={false} />
          <span className="min-w-0 truncate font-mono text-sm text-ink">{entry.url}</span>
          <StatusChip code={entry.status} label={`${entry.status} ${statusText(entry.status)}`} />
          <span className="shrink-0 font-mono text-sm text-ink-3 tabular-nums">
            {formatMs(entry.ms)} · {formatBytes(entry.bytes)}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-2">
            {entry.routeId ? (
              <GhostButton onClick={() => navigate({ go: "route", routeId: entry.routeId! })}>
                Open in workbench
              </GhostButton>
            ) : null}
            <AccentButton onClick={resend}>Resend</AccentButton>
          </span>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-8">
          <DetailSection title="Request">
            <HeaderRows headers={entry.requestHeaders} />
            <BodyBlock body={entry.requestBody} />
          </DetailSection>
          <DetailSection title="Response">
            <HeaderRows headers={entry.responseHeaders} />
            <BodyBlock body={entry.responseBody} />
          </DetailSection>
        </div>
      </div>
    </div>
  );
}

/* ── promote dialog ───────────────────────────────────────────────────────── */

type PromoteTarget = "examples" | "checks" | "flow";

const PROMOTE_OPTIONS: Array<{ value: PromoteTarget; icon: typeof Braces; label: string; sub: string }> = [
  { value: "examples", icon: Braces, label: "Examples", sub: "attach responses to their routes — feeds docs & mocks" },
  { value: "checks", icon: ListChecks, label: "Checks", sub: "recorded bodies become schema witnesses" },
  { value: "flow", icon: Workflow, label: "Flow", sub: "ordered steps with data passing detected" },
];

function PromoteDialog({
  entries,
  onDone,
  onClose,
}: {
  entries: HistoryEntry[];
  onDone: () => void;
  onClose: () => void;
}) {
  const routes = useStore((s) => s.routes);
  const saveExample = useStore((s) => s.saveExample);
  const pushToast = useStore((s) => s.pushToast);
  const [target, setTarget] = useState<PromoteTarget>("examples");

  const resources = [
    ...new Set(
      entries
        .map((e) => routes.find((r) => r.id === e.routeId))
        .filter(Boolean)
        .map((r) => r!.path.split("/").filter((s) => s && !s.startsWith(":")).slice(0, 3).join("/")),
    ),
  ];

  const willWrite: Array<{ line: string; tone: "add" | "touch" }> =
    target === "flow"
      ? [{ line: "+ .zestman/flows/recorded-session.flow", tone: "add" }]
      : resources.map((res) => ({
          line: `+ .zestman/routes/${res}/${target === "examples" ? "examples" : "checks"}.json`,
          tone: "add" as const,
        }));
  willWrite.push({ line: "~ .zestman/route-index.json", tone: "touch" });

  const promote = () => {
    const matched = entries.filter((e) => e.routeId);
    if (target === "examples") {
      for (const e of matched) {
        void saveExample({
          id: id("ex"),
          routeId: e.routeId!,
          name: `${e.status} ${statusText(e.status)}`,
          status: e.status,
          ms: e.ms,
          bytes: e.bytes,
          savedAt: Date.now(),
          body: e.responseBody || "{}",
          usedByMock: false,
          usedBySpec: false,
        } satisfies Example);
      }
    } else if (target === "checks") {
      // A promoted request proves the route responds with this status — flip those cells to pass.
      const routeIds = new Set(matched.map((e) => e.routeId!));
      useStore.setState((s) => ({
        checks: s.checks.map((c) =>
          routeIds.has(c.routeId) ? { ...c, cells: { ...c.cells, responds: "pass", status: "pass" } } : c,
        ),
      }));
    } else if (target === "flow") {
      useStore.setState((s) => ({
        flows: s.flows.map((f, i) =>
          i === 0
            ? { ...f, steps: [...f.steps, ...matched.map((e) => ({ id: id("st"), routeId: e.routeId! }))] }
            : f,
        ),
      }));
    }
    pushToast({
      kind: "info",
      text: `${entries.length} requests promoted`,
      sub: `→ ${PROMOTE_OPTIONS.find((o) => o.value === target)?.label.toLowerCase()}`,
    });
    onDone();
  };

  return (
    <DialogFrame
      title={`Promote ${entries.length} requests`}
      width={560}
      onClose={onClose}
      footer={
        <DialogFooterSplit
          right={
            <>
              <GhostButton onClick={onClose}>Cancel</GhostButton>
              <AccentButton onClick={promote}>Promote</AccentButton>
            </>
          }
        />
      }
    >
      <RadioGroup
        value={target}
        onValueChange={(v) => setTarget(v as PromoteTarget)}
        aria-label="Promote to"
        className="gap-1"
      >
        {PROMOTE_OPTIONS.map((o) => {
          const Icon = o.icon;
          const active = o.value === target;
          return (
            <label
              key={o.value}
              htmlFor={`promote-${o.value}`}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left",
                "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
                active ? "bg-ds-gray-alpha-200" : "hover:bg-ds-gray-alpha-100",
              )}
            >
              <RadioGroupItem id={`promote-${o.value}`} value={o.value} />
              <Icon size={16} strokeWidth={1.5} className="shrink-0 text-ink-2" />
              <span className="flex min-w-0 flex-col">
                <span className="text-base font-medium text-ink">{o.label}</span>
                <span className="truncate text-xs text-ink-3">{o.sub}</span>
              </span>
            </label>
          );
        })}
      </RadioGroup>

      <div className="mt-5 mb-2 caps-label">Will write</div>
      <div className="flex flex-col gap-1.5 rounded-lg bg-sunken p-3.5">
        {willWrite.map((w) => (
          <span key={w.line} className={cn("font-mono text-sm", w.tone === "add" ? "text-ok" : "text-ink-3")}>
            {w.line}
          </span>
        ))}
      </div>
    </DialogFrame>
  );
}

/* ── live session ─────────────────────────────────────────────────────────── */

function LiveHeaderActions({ paused, onPause, onEnd }: { paused: boolean; onPause: () => void; onEnd: () => void }) {
  return (
    <>
      <GhostButton onClick={onPause}>{paused ? "Resume" : "Pause"}</GhostButton>
      <GhostButton onClick={onEnd}>End session</GhostButton>
    </>
  );
}

/* data.ts re-subscribes tap:entry on every loadAll (StrictMode double-mount
   duplicates the handler in dev) — dedupe by id for presentation. */
function dedupeById(entries: HistoryEntry[]): HistoryEntry[] {
  const seen = new Set<string>();
  const out: HistoryEntry[] = [];
  for (const e of entries) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}

function LiveView() {
  const navigate = useStore((s) => s.navigate);
  const pushToast = useStore((s) => s.pushToast);
  const rawLive = useStore((s) => s.liveEntries);
  const liveEntries = dedupeById(rawLive);
  const routes = useStore((s) => s.routes);
  const historyDays = useStore((s) => s.historyDays);
  const saveExample = useStore((s) => s.saveExample);
  const saveMock = useStore((s) => s.saveMock);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [paused, setPaused] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);

  const total = historyDays.reduce((n, d) => n + d.count, 0) + liveEntries.length;
  const sessionAt = clockTime(liveEntries.at(-1)?.at ?? APP_START).slice(0, 5);
  const selectedEntries = liveEntries.filter((e) => selected.has(e.id));

  const toggle = (eid: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(eid)) next.delete(eid);
      else next.add(eid);
      return next;
    });

  const togglePause = () => {
    freezeFixtures(!paused);
    setPaused(!paused);
  };

  const endSession = () => {
    freezeFixtures(false);
    navigate({ go: "history", mode: "recorded" });
  };

  const saveAsExamples = () => {
    const matched = selectedEntries.filter((e) => e.routeId);
    for (const e of matched) {
      void saveExample({
        id: id("ex"),
        routeId: e.routeId!,
        name: `${e.status} ${statusText(e.status)}`,
        status: e.status,
        ms: e.ms,
        bytes: e.bytes,
        savedAt: Date.now(),
        body: e.responseBody || "{}",
        usedByMock: false,
        usedBySpec: false,
      } satisfies Example);
    }
    pushToast({ kind: "info", text: `${matched.length} examples saved` });
    setSelected(new Set());
  };

  const seedMocks = () => {
    const matched = selectedEntries.filter((e) => e.routeId);
    for (const e of matched) {
      void saveMock({
        id: id("mock"),
        name: `${e.status} ${statusText(e.status)}`,
        routeId: e.routeId!,
        statusCode: e.status,
        delayMs: null,
        enabled: true,
        headers: [],
        body: e.responseBody || "{}",
        recentHits: [],
      } satisfies Mock);
    }
    pushToast({ kind: "info", text: `${matched.length} mocks seeded`, sub: "serving on :23501" });
    setSelected(new Set());
  };

  const addToFlow = () => {
    const matched = selectedEntries.filter((e) => e.routeId);
    useStore.setState((s) => ({
      flows: s.flows.map((f, i) =>
        i === 0 ? { ...f, steps: [...f.steps, ...matched.map((e) => ({ id: id("st"), routeId: e.routeId! }))] } : f,
      ),
    }));
    pushToast({ kind: "info", text: `${matched.length} steps added to checkout` });
    setSelected(new Set());
  };

  const columns: Array<ColumnDef<HistoryEntry>> = [
    {
      id: "check",
      header: "",
      width: 40,
      cell: (e) => (
        <Checkbox
          checked={selected.has(e.id)}
          onCheckedChange={() => toggle(e.id)}
          onClick={(ev) => ev.stopPropagation()}
          aria-label={`Select ${e.method} ${e.path}`}
        />
      ),
    },
    { id: "time", header: "Time", width: 96, cell: (e) => timeCell(e.at) },
    { id: "method", header: "Method", width: 72, cell: (e) => <MethodBadge method={e.method} /> },
    { id: "path", header: "Path", cell: (e) => pathCell(e.path) },
    {
      id: "route",
      header: "Route",
      width: 220,
      cell: (e) => {
        const route = e.routeId ? routes.find((r) => r.id === e.routeId) : null;
        if (!route)
          return (
            <button
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                navigate({ go: "history", mode: "live", filter: "unmatched" });
              }}
              className="rounded-full"
            >
              <Pill tone="warn" className="font-mono">
                unmatched
              </Pill>
            </button>
          );
        return (
          <span className="truncate rounded-md bg-ds-gray-alpha-200 px-1.5 py-0.5 font-mono text-xs text-ink-2">
            {route.method} {route.path.replace(/^\/api\/v1/, "") || "/"}
          </span>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      width: 116,
      cell: (e) => <StatusChip code={e.status} label={`${e.status} ${statusText(e.status)}`} />,
    },
    { id: "ms", header: "Duration", width: 88, align: "right", cell: (e) => msCell(e.ms) },
  ];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <PageFrame
        title="Live"
        meta={
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full bg-ok",
                !paused && "animate-pulse",
              )}
            />
            zestman run — pnpm dev · session {sessionAt}
          </span>
        }
        actions={<LiveHeaderActions paused={paused} onPause={togglePause} onEnd={endSession} />}
        footer={
          <>
            <Dot tone={paused ? "muted" : "ok"} />
            <span>
              live tail · {total} requests today · .zestman/history/
            </span>
          </>
        }
      >
        {liveEntries.length === 0 ? (
          <EmptyState
            className="h-64"
            icon={
              <span className="flex size-8 items-center justify-center rounded-lg bg-sunken text-ds-gray-600">
                <Radio size={16} strokeWidth={1.5} />
              </span>
            }
            title="Waiting for traffic…"
            sub="requests through zestman run appear here in real time"
          />
        ) : (
          <DataTable
            label="Live requests"
            columns={columns}
            rows={liveEntries}
            rowKey={(e) => e.id}
            rowHeight={32}
            onRowClick={(e) => toggle(e.id)}
            isSelected={(e) => selected.has(e.id)}
          />
        )}
      </PageFrame>

      {selected.size > 0 ? (
        <div
          className={cn(
            "absolute bottom-12 left-1/2 flex h-11 -translate-x-1/2 items-center gap-1 rounded-lg",
            "border border-line-strong bg-ds-background-100 pr-1.5 pl-4 shadow-[var(--ds-shadow-menu)]",
            "animate-in fade-in-0 slide-in-from-bottom-2 duration-[var(--dur-base)] ease-[var(--ease-out)]",
          )}
        >
          <span className="mr-2 text-base font-medium whitespace-nowrap text-ink tabular-nums">
            {selected.size} selected
          </span>
          <Button variant="ghost" size="sm" onClick={saveAsExamples} className="text-base font-normal text-ink-2 hover:text-ink">
            Save as example
          </Button>
          <Button variant="ghost" size="sm" onClick={seedMocks} className="text-base font-normal text-ink-2 hover:text-ink">
            Seed mock
          </Button>
          <Button variant="ghost" size="sm" onClick={addToFlow} className="text-base font-normal text-ink-2 hover:text-ink">
            Add to flow
          </Button>
          <AccentButton className="ml-1 h-8" onClick={() => setPromoteOpen(true)}>
            Promote…
          </AccentButton>
        </div>
      ) : null}

      {promoteOpen ? (
        <PromoteDialog
          entries={selectedEntries}
          onClose={() => setPromoteOpen(false)}
          onDone={() => {
            setPromoteOpen(false);
            setSelected(new Set());
          }}
        />
      ) : null}
    </div>
  );
}

/* ── unmatched triage ─────────────────────────────────────────────────────── */

function UnmatchedView() {
  const navigate = useStore((s) => s.navigate);
  const liveEntries = dedupeById(useStore((s) => s.liveEntries));
  const pushToast = useStore((s) => s.pushToast);
  const [paused, setPaused] = useState(false);

  const streamed: UnmatchedRow[] = liveEntries
    .filter((e) => !e.routeId)
    .map((e) => ({
      id: e.id,
      at: e.at,
      method: e.method,
      path: e.path,
      suggestion: e.suggestion ?? "ignore",
      kind: e.suggestion ? "mean" : "ignore",
      note: e.caller ?? "this session",
    }));
  const rows = [...streamed, ...UNMATCHED_SEED];

  const columns: Array<ColumnDef<UnmatchedRow>> = [
    { id: "time", header: "Time", width: 96, cell: (r) => timeCell(r.at) },
    { id: "method", header: "Method", width: 72, cell: (r) => <MethodBadge method={r.method} /> },
    { id: "path", header: "Path", cell: (r) => pathCell(r.path) },
    {
      id: "suggestion",
      header: "Suggestion",
      width: 280,
      cell: (r) => {
        if (r.kind === "chip")
          return (
            <GhostButton
              size="sm"
              onClick={() =>
                pushToast({ kind: "info", text: "manualRoute added", sub: "zestman.config.ts → manualRoutes" })
              }
              className="font-mono text-xs"
            >
              {r.suggestion}
            </GhostButton>
          );
        if (r.kind === "mean") return <span className="truncate font-mono text-sm text-link-z">{r.suggestion}</span>;
        return <span className="font-mono text-sm text-ink-3">{r.suggestion}</span>;
      },
    },
    { id: "note", header: "Note", width: 200, cell: (r) => <span className="truncate text-base text-ink-3">{r.note}</span> },
  ];

  return (
    <PageFrame
      lead={<BackLink onClick={() => navigate({ go: "history", mode: "live" })}>Live session</BackLink>}
      title="Unmatched traffic"
      meta="requests that hit no discovered route"
      actions={
        <LiveHeaderActions
          paused={paused}
          onPause={() => {
            freezeFixtures(!paused);
            setPaused(!paused);
          }}
          onEnd={() => {
            freezeFixtures(false);
            navigate({ go: "history", mode: "recorded" });
          }}
        />
      }
      banner={
        <Alert className="border-transparent bg-sunken">
          <Info size={16} strokeWidth={1.5} className="text-ink-3" />
          <AlertDescription className="text-base text-ink-2">
            Unmatched calls are typos, hidden endpoints, or third-party traffic — triage them here.
          </AlertDescription>
        </Alert>
      }
      footer={
        <span>
          {rows.length} unmatched calls this session · filter: unmatched · .zestman/history/
        </span>
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowHeight={32}
      />
    </PageFrame>
  );
}

/* ── page switch ──────────────────────────────────────────────────────────── */

export function HistoryPage() {
  const mode = useStore((s) => s.sections.history.mode);
  const filter = useStore((s) => s.sections.history.filter);
  const entryId = useStore((s) => s.sections.history.entryId);
  const historyEntries = useStore((s) => s.historyEntries);

  if (mode === "live") {
    if (filter === "unmatched") return <UnmatchedView />;
    return <LiveView />;
  }
  const entry = entryId ? historyEntries.find((e) => e.id === entryId) : null;
  if (entry) return <EntryDetail entry={entry} />;
  return <RecordedList />;
}
