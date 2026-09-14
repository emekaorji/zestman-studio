import {
  ChevronDown,
  CircleAlert,
  Columns3,
  Info,
  LayoutGrid,
  Rows3,
  Search,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useStore } from "@/state/store";
import type { InsightsTab } from "@/state/types";
import type { Diagnostic, HistoryEntry, Mock, Route, Schedule } from "@/daemon/types";
import { SourceRef } from "@/components/SourceRef";
import { cn } from "@/lib/utils";
import {
  AccentButton,
  Dot,
  EmptyState,
  GhostButton,
  MethodBadge,
  SegmentedControl,
  StatusChip,
} from "@/components/primitives";
import { TabStrip } from "@/components/tabstrip/TabStrip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePersistentState, setCodec } from "@/state/persist";
import { TOOLBAR_H } from "@/lib/metrics";
import { DataTable, type ColumnDef, type RowGroup } from "@/components/table/DataTable";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Progress } from "@/components/ui/progress";


/** A 32px sunken well so a 16px icon still reads as an illustration. */
function IconWell({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-8 items-center justify-center rounded-lg bg-sunken text-ds-gray-600">
      {children}
    </span>
  );
}

/* ── Traffic: derived route stats ─────────────────────────────────────────── */

interface TrafficRow {
  route: Route;
  lastStatus: number | null;
  p50: number | null;
  monitored: boolean;
  mocked: boolean;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** A schedule covers a route when its scope is "All routes…" or names the route. */
function isMonitored(route: Route, schedules: Schedule[]): boolean {
  return schedules.some(
    (sch) => sch.enabled && (/^all routes/i.test(sch.scope) || sch.scope.includes(`${route.method} ${route.path}`)),
  );
}

function buildTrafficRows(routes: Route[], history: HistoryEntry[], mocks: Mock[], schedules: Schedule[]): TrafficRow[] {
  const lastByRoute = new Map<string, number>();
  const msByRoute = new Map<string, number[]>();
  for (const e of [...history].sort((a, b) => a.at - b.at)) {
    if (!e.routeId) continue;
    lastByRoute.set(e.routeId, e.status);
    msByRoute.set(e.routeId, [...(msByRoute.get(e.routeId) ?? []), e.ms]);
  }
  const mockedRouteIds = new Set(mocks.filter((m) => m.enabled).map((m) => m.routeId));
  return routes
    .filter((r) => r.protocol === "http")
    .map((r) => ({
      route: r,
      lastStatus: lastByRoute.get(r.id) ?? null,
      p50: median(msByRoute.get(r.id) ?? []),
      monitored: isMonitored(r, schedules),
      mocked: mockedRouteIds.has(r.id),
    }));
}

/* ── Traffic: analytics band ──────────────────────────────────────────────── */

/**
 * A sparkline of discrete bars. Colours come from the Geist scales only; the
 * bars grow into place rather than appearing at full height.
 */
function SparkBars({
  values,
  accentIdx,
  accentClass,
  label,
}: {
  values: number[];
  accentIdx: number;
  accentClass: string;
  label: string;
}) {
  const max = Math.max(...values, 1);
  return (
    <div role="img" aria-label={label} className="flex h-9 items-end gap-[3px]">
      {values.map((v, i) => (
        <span
          key={i}
          className={cn(
            "w-1.5 origin-bottom rounded-[1px]",
            "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-backwards ease-[var(--ease-out)]",
            i === accentIdx ? accentClass : "bg-ds-gray-300",
          )}
          style={{
            height: Math.max(3, Math.round((v / max) * 36)),
            animationDelay: `${i * 12}ms`,
            animationDuration: "var(--dur-slow)",
          }}
        />
      ))}
    </div>
  );
}

function StatCell({
  label,
  value,
  children,
  footnote,
  className,
}: {
  label: string;
  value: ReactNode;
  children?: ReactNode;
  footnote?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-32 flex-1 flex-col justify-between gap-2 border-l border-line px-6 first:border-l-0",
        // Wrapped rows start a new line: a left rule there points at nothing.
        "max-xl:min-w-[calc(50%-0.75rem)] max-xl:[&:nth-child(odd)]:border-l-0 max-xl:[&:nth-child(odd)]:pl-0",
        "max-sm:min-w-full max-sm:border-l-0 max-sm:pl-0",
        className,
      )}
    >
      <span className="caps-label">{label}</span>
      <span className="text-xl font-semibold text-ink tabular-nums">{value}</span>
      {children}
      {footnote ? <span className="truncate text-xs text-ink-3">{footnote}</span> : null}
    </div>
  );
}

function AnalyticsBand() {
  const insights = useStore((s) => s.insights);
  if (!insights) return null;
  const errPct = Math.max(2, Math.round(insights.errorRate * 100));
  return (
    /* Four cards need ~1180px of content width. Below xl they wrap 2×2, below
       sm they stack; the fixed height only applies once they sit in one row. */
    <div className="flex shrink-0 flex-wrap items-stretch gap-y-5 border-b border-line px-4 py-5 sm:px-7 xl:h-[168px] xl:flex-nowrap">
      <StatCell
        label="Requests · Today"
        value={insights.requestsToday}
        footnote="by hour"
        className="pl-0"
      >
        <SparkBars
          label={`${insights.requestsToday} requests today, by hour`}
          values={insights.hourly}
          accentIdx={insights.hourly.length - 1}
          accentClass="bg-ds-blue-700"
        />
      </StatCell>

      <StatCell
        label="Error rate"
        value={`${(insights.errorRate * 100).toFixed(1)}%`}
        footnote={insights.errorNote}
      >
        <div className="flex h-9 items-center gap-1">
          <span className="h-1 flex-1 rounded-full bg-ds-green-600" />
          <span className="h-1 rounded-full bg-ds-red-800" style={{ width: `${errPct}%` }} />
        </div>
      </StatCell>

      <StatCell label="Latency p95" value={`${insights.p95} ms`} footnote={`p50 ${insights.p50} ms`}>
        <SparkBars
          label={`Latency by hour, p95 ${insights.p95} ms`}
          values={insights.latencyBars}
          accentIdx={insights.latencySpikeIdx}
          accentClass="bg-ds-amber-700"
        />
      </StatCell>

      <StatCell
        label="Top route"
        value={
          <span className="flex items-center gap-2">
            <MethodBadge method={insights.topRoute.method} fixed={false} />
            <span className="truncate font-mono text-md text-ink">{insights.topRoute.path}</span>
          </span>
        }
        footnote={insights.topRoute.note}
      >
        <span className="flex h-9 items-end truncate text-xs text-warn">{insights.slowest.label}</span>
      </StatCell>
    </div>
  );
}

/* ── Traffic tab ──────────────────────────────────────────────────────────── */

/** A multi-select filter menu. Shows how many values are active on the trigger. */
function FilterMenu({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <GhostButton size="sm" aria-label={`Filter by ${label.toLowerCase()}`}>
          {label}
          {selected.size > 0 ? <span className="text-ink-2">{selected.size}</span> : null}
          <ChevronDown size={14} strokeWidth={1.5} className="text-ink-3" />
        </GhostButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o}
            checked={selected.has(o)}
            onCheckedChange={(on) => {
              const next = new Set(selected);
              if (on) next.add(o);
              else next.delete(o);
              onChange(next);
            }}
          >
            <span className="font-mono text-sm">{o}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type GroupBy = "module" | "file" | "method" | "none";
type StatusBand = "2xx" | "4xx" | "5xx" | "none";

/** Which status family a route's last response falls in. */
function bandOf(status: number | null | undefined): StatusBand {
  if (status == null) return "none";
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  return "2xx";
}

function TrafficTab() {
  const routes = useStore((s) => s.routes);
  const historyEntries = useStore((s) => s.historyEntries);
  const mocks = useStore((s) => s.mocks);
  const schedules = useStore((s) => s.schedules);
  const insights = useStore((s) => s.insights);
  const pushDialog = useStore((s) => s.pushDialog);
  const setRunnerScope = useStore((s) => s.setRunnerScope);

  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  /* Toolbar state. Every control below drives one of these — none of them are
     decoration. */
  const [methodFilter, setMethodFilter] = useState<Set<string>>(new Set());
  const [fileFilter, setFileFilter] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<StatusBand>>(new Set());
  const [groupBy, setGroupBy] = usePersistentState<GroupBy>("zestman:ui:insights-group:v1", "module");
  const [hiddenCols, setHiddenCols] = usePersistentState<Set<string>>(
    "zestman:ui:insights-cols:v1",
    new Set(),
    setCodec,
  );
  const [dense, setDense] = usePersistentState<boolean>("zestman:ui:insights-dense:v1", false);

  const allRows = useMemo(
    () => buildTrafficRows(routes, historyEntries, mocks, schedules),
    [routes, historyEntries, mocks, schedules],
  );

  const fileNames = useMemo(
    () => [...new Set(allRows.map((r) => r.route.sourceLocations[0]?.file.split(":")[0] ?? "—"))].sort(),
    [allRows],
  );
  const methodNames = useMemo(
    () => [...new Set(allRows.map((r) => r.route.method))].sort(),
    [allRows],
  );

  const groups: Array<RowGroup<TrafficRow>> = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const methodMatch = /^method:(\w+)$/.exec(q);
    const visible = allRows.filter((row) => {
      if (methodFilter.size && !methodFilter.has(row.route.method)) return false;
      if (fileFilter.size && !fileFilter.has(row.route.sourceLocations[0]?.file.split(":")[0] ?? "—")) return false;
      if (statusFilter.size && !statusFilter.has(bandOf(row.lastStatus))) return false;
      if (!q) return true;
      if (methodMatch) return row.route.method.toLowerCase() === methodMatch[1];
      return `${row.route.method} ${row.route.path}`.toLowerCase().includes(q);
    });

    if (groupBy === "none") return [{ label: `All routes — ${visible.length}`, rows: visible }];

    const keyOf = (r: TrafficRow) =>
      groupBy === "module"
        ? (r.route.tags[0] ?? "app")
        : groupBy === "file"
          ? (r.route.sourceLocations[0]?.file.split(":")[0] ?? "—")
          : r.route.method;

    // Modules keep discovery order (the sidebar's order); other groupings sort.
    const order = groupBy === "module" ? [...new Set(visible.map(keyOf))] : [...new Set(visible.map(keyOf))].sort();

    return order
      .map((key) => {
        const rows = visible.filter((r) => keyOf(r) === key);
        return { label: `${key === "app" ? "App" : key} — ${rows.length}`, rows };
      })
      .filter((g) => g.rows.length > 0);
  }, [allRows, filter, methodFilter, fileFilter, statusFilter, groupBy]);

  const toggle = (routeId: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(routeId)) next.delete(routeId);
      else next.add(routeId);
      return next;
    });

  const allColumns: Array<ColumnDef<TrafficRow>> = [
    {
      id: "check",
      header: "",
      width: 40,
      cell: (r) => (
        <Checkbox
          checked={selected.has(r.route.id)}
          onCheckedChange={() => toggle(r.route.id)}
          onClick={(ev) => ev.stopPropagation()}
          aria-label={`Select ${r.route.method} ${r.route.path}`}
        />
      ),
    },
    { id: "method", header: "Method", width: 72, cell: (r) => <MethodBadge method={r.route.method} /> },
    {
      id: "path",
      header: "Path",
      cell: (r) => <span className="truncate font-mono text-sm text-ink">{r.route.path}</span>,
    },
    {
      id: "source",
      header: "Source",
      // Path and status are what you scan for; the file is one tap away.
      hideBelow: "md",
      width: 240,
      cell: (r) =>
        r.route.sourceLocations[0] ? (
          <SourceRef fileRef={r.route.sourceLocations[0].file} muted />
        ) : (
          <span className="font-mono text-sm text-ink-3">—</span>
        ),
    },
    {
      id: "schema",
      header: "Schema",
      width: 84,
      cell: (r) =>
        r.route.schemaRef ? (
          <span className="font-mono text-sm text-ok">zod</span>
        ) : (
          <span className="font-mono text-sm text-ink-3">—</span>
        ),
    },
    {
      id: "last",
      header: "Last",
      width: 84,
      cell: (r) =>
        r.lastStatus != null ? (
          <StatusChip code={r.lastStatus} />
        ) : (
          <span className="font-mono text-sm text-ink-3">—</span>
        ),
    },
    {
      id: "p50",
      header: "P50",
      width: 120,
      cell: (r) =>
        r.p50 != null ? (
          <span className="flex w-full items-center gap-2">
            <Progress
              value={Math.min(100, Math.round((r.p50 / 130) * 100))}
              aria-label={`p50 ${r.p50} milliseconds`}
              /* The indicator paints with --primary; re-point it at a Geist ramp. */
              style={{ "--primary": r.p50 > 100 ? "var(--ds-amber-700)" : "var(--ds-green-600)" } as CSSProperties}
              className="h-1 w-10 shrink-0 bg-ds-gray-300"
            />
            <span className="font-mono text-sm tabular-nums text-ink-2">{r.p50} ms</span>
          </span>
        ) : (
          <span className="font-mono text-sm text-ink-3">—</span>
        ),
    },
    {
      id: "mon",
      header: "Mon",
      width: 52,
      cell: (r) =>
        r.monitored ? <Dot tone="ok" label="monitored" /> : <span className="sr-only">not monitored</span>,
    },
    {
      id: "mock",
      header: "Mock",
      width: 56,
      cell: (r) =>
        r.mocked ? <Dot tone="link" label="mocked" /> : <span className="sr-only">not mocked</span>,
    },
  ];

  const columns = allColumns.filter((c) => !hiddenCols.has(c.id));
  const activeFilterCount = methodFilter.size + fileFilter.size + statusFilter.size;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      {/* ~900px of controls: one 52px row where it fits, wrapping rows where it
          does not. minHeight (not height) so a wrapped toolbar grows instead of
          clipping its second line. */}
      <div style={{ minHeight: TOOLBAR_H }}
        className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-4 py-2 sm:px-7 xl:py-0">
        <InputGroup className="h-9 w-full shrink-0 border-line bg-ds-gray-100 sm:w-[280px]">
          <InputGroupAddon>
            <Search size={16} strokeWidth={1.5} className="text-ink-3" />
          </InputGroupAddon>
          <InputGroupInput
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter — try method:POST"
            aria-label="Filter routes"
            className="font-mono text-sm"
          />
        </InputGroup>
        <FilterMenu
          label="Method"
          options={methodNames}
          selected={methodFilter}
          onChange={setMethodFilter}
        />
        <FilterMenu label="File" options={fileNames} selected={fileFilter} onChange={setFileFilter} />
        <FilterMenu
          label="Status"
          options={["2xx", "4xx", "5xx", "none"]}
          selected={statusFilter as Set<string>}
          onChange={(next) => setStatusFilter(next as Set<StatusBand>)}
        />
        {activeFilterCount > 0 ? (
          <GhostButton
            size="sm"
            onClick={() => {
              setMethodFilter(new Set());
              setFileFilter(new Set());
              setStatusFilter(new Set());
            }}
          >
            Clear {activeFilterCount}
          </GhostButton>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <GhostButton size="sm" aria-label="Change grouping">
                Group: {groupBy}
                <ChevronDown size={14} strokeWidth={1.5} className="text-ink-3" />
              </GhostButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                {(["module", "file", "method", "none"] as GroupBy[]).map((g) => (
                  <DropdownMenuRadioItem key={g} value={g}>
                    {g}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Choose columns"
                className="text-ink-2 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink"
              >
                <Columns3 size={16} strokeWidth={1.5} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {allColumns
                .filter((c) => c.id !== "check" && c.id !== "route")
                .map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={!hiddenCols.has(c.id)}
                    onCheckedChange={(on) =>
                      setHiddenCols((cur) => {
                        const next = new Set(cur);
                        if (on) next.delete(c.id);
                        else next.add(c.id);
                        return next;
                      })
                    }
                  >
                    {typeof c.header === "string" && c.header ? c.header : c.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={dense ? "Use comfortable rows" : "Use compact rows"}
            aria-pressed={dense}
            onClick={() => setDense((d) => !d)}
            className="text-ink-2 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink aria-pressed:bg-activebg aria-pressed:text-ink"
          >
            <Rows3 size={16} strokeWidth={1.5} />
          </Button>
          <AccentButton
            className="ml-1"
            disabled={selected.size === 0}
            onClick={() => {
              setRunnerScope([...selected]);
              pushDialog({ kind: "runner", scope: "selection" });
            }}
          >
            Run {selected.size} selected
          </AccentButton>
        </div>
      </div>

      <AnalyticsBand />

      {/* Grid */}
      <div className="fade-scroll min-h-0 flex-1 overflow-y-auto px-4 sm:px-7 pb-6">
        <DataTable<TrafficRow>
          label="Routes by module"
          rowHeight={dense ? 28 : 32}
          columns={columns}
          groups={groups}
          rowKey={(r) => r.route.id}
          onRowClick={(r) => toggle(r.route.id)}
          isSelected={(r) => selected.has(r.route.id)}
        />
      </div>

      {/* Footer */}
      <div className="flex h-8 shrink-0 items-center gap-1.5 border-t border-line px-4 sm:px-7 font-mono text-xs text-ink-3 min-w-0 overflow-hidden whitespace-nowrap [&>*]:min-w-0 [&>*]:truncate">
        <span className="tabular-nums">
          {allRows.length} routes · {selected.size} selected · p95 {insights?.p95 ?? "—"} ms ·
        </span>
        <Dot tone="ok" />
        <span>watching</span>
      </div>
    </div>
  );
}

/* ── Diagnostics tab ──────────────────────────────────────────────────────── */

type DiagFilter = "all" | "errors" | "warnings" | "info";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

interface DiagRow {
  kind: "diag" | "fix";
  diag: Diagnostic;
}

function LevelIcon({ level }: { level: Diagnostic["level"] }) {
  if (level === "error") return <CircleAlert size={16} strokeWidth={1.5} className="text-err" />;
  if (level === "warning") return <TriangleAlert size={16} strokeWidth={1.5} className="text-warn" />;
  return <Info size={16} strokeWidth={1.5} className="text-ink-3" />;
}

/** "routes.ts:88" is a file ref; "watcher" / "scanner" are subsystems. */
const isFileRef = (source: string) => /\.[A-Za-z0-9]+(?::\d+)?$/.test(source) && !/\s/.test(source);

function DiagnosticsTab() {
  const diagnostics = useStore((s) => s.diagnostics);
  const pushDialog = useStore((s) => s.pushDialog);
  const [filter, setFilter] = useState<DiagFilter>("all");

  const counts = {
    errors: diagnostics.filter((d) => d.level === "error").length,
    warnings: diagnostics.filter((d) => d.level === "warning").length,
    info: diagnostics.filter((d) => d.level === "info").length,
  };

  const rows: DiagRow[] = diagnostics
    .filter((d) => {
      if (filter === "all") return true;
      if (filter === "errors") return d.level === "error";
      if (filter === "warnings") return d.level === "warning";
      return d.level === "info";
    })
    .flatMap((d) =>
      d.fix
        ? [{ kind: "diag" as const, diag: d }, { kind: "fix" as const, diag: d }]
        : [{ kind: "diag" as const, diag: d }],
    );

  const columns: Array<ColumnDef<DiagRow>> = [
    {
      id: "level",
      header: "",
      width: 44,
      cell: (r) => (r.kind === "diag" ? <LevelIcon level={r.diag.level} /> : <span aria-hidden />),
    },
    {
      id: "message",
      header: "Message",
      cell: (r) =>
        r.kind === "diag" ? (
          <span className="truncate text-base text-ink">{r.diag.message}</span>
        ) : (
          <span className="truncate rounded-md bg-sunken px-2 py-1 font-mono text-sm text-ink-2">{r.diag.fix}</span>
        ),
    },
    {
      id: "source",
      header: "Source",
      // Path and status are what you scan for; the file is one tap away.
      hideBelow: "md",
      width: 260,
      cell: (r) =>
        r.kind === "diag" ? (
          isFileRef(r.diag.source) ? (
            <SourceRef fileRef={r.diag.source} muted={r.diag.level !== "error"} />
          ) : (
            <span className="truncate font-mono text-sm text-ink-3">{r.diag.source}</span>
          )
        ) : (
          <span aria-hidden />
        ),
    },
    {
      id: "route",
      header: "Route",
      width: 190,
      cell: (r) => {
        if (r.kind === "fix") return <span aria-hidden />;
        const d = r.diag;
        if (d.action)
          return (
            <span className="inline-flex h-5 items-center rounded-md border border-line px-1.5 text-2xs text-ink-2">
              {d.action}
            </span>
          );
        if (d.route)
          return (
            <span className="inline-flex h-5 items-center rounded-md border border-line px-1.5 font-mono text-2xs text-ink-2">
              {d.route}
            </span>
          );
        return <span className="font-mono text-sm text-ink-3">—</span>;
      },
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Same shell as the Traffic toolbar (TOOLBAR_H, flush, hairline) so the
          two tabs do not jump when you switch between them. */}
      <div
        style={{ minHeight: TOOLBAR_H }}
        className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2 sm:px-7 lg:py-0"
      >
        <h1 className="shrink-0 text-md font-semibold text-ink">Diagnostics</h1>
        <span className="truncate text-base text-ink-3 tabular-nums">
          {plural(counts.errors, "error")} · {plural(counts.warnings, "warning")} · {counts.info} info
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <SegmentedControl<DiagFilter>
            options={[
              { value: "all", label: "All" },
              { value: "errors", label: "Errors" },
              { value: "warnings", label: "Warnings" },
              { value: "info", label: "Info" },
            ]}
            value={filter}
            onChange={setFilter}
          />
          <GhostButton onClick={() => pushDialog({ kind: "scan-onboarding" })}>Re-sync</GhostButton>
        </div>
      </div>

      <div className="fade-scroll min-h-0 flex-1 overflow-y-auto px-4 sm:px-7 pb-10">
        <DataTable<DiagRow>
          label="Diagnostics"
          columns={columns}
          rows={rows}
          rowKey={(r) => (r.kind === "fix" ? `${r.diag.id}_fix` : r.diag.id)}
          rowHeight={32}
        />
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export function InsightsPage() {
  const tab = useStore((s) => s.sections.insights.tab);
  const navigate = useStore((s) => s.navigate);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TabStrip<InsightsTab>
        label="Insights views"
        variant="page"
        className="px-4 sm:px-7"
        tabs={[
          { id: "traffic", label: "Traffic" },
          { id: "coverage", label: "Coverage" },
          { id: "diagnostics", label: "Diagnostics" },
        ]}
        active={tab}
        onSelect={(t) => navigate({ go: "insights", tab: t })}
      />
      <div
        key={tab}
        className="flex min-h-0 flex-1 flex-col animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]"
      >
        {tab === "traffic" ? (
          <TrafficTab />
        ) : tab === "coverage" ? (
          <EmptyState
            icon={<IconWell><LayoutGrid size={16} strokeWidth={1.5} /></IconWell>}
            title="Coverage lands with the consumer graph"
            sub="routes × called × tested × documented"
          />
        ) : (
          <DiagnosticsTab />
        )}
      </div>
    </div>
  );
}
