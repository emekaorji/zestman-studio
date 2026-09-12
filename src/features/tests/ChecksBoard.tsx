import { Lock, Play, Plus, Settings2, X } from "lucide-react";
import { useMemo } from "react";
import { GhostButton, MethodBadge, Pill } from "@/components/primitives";
import { DataTable, type ColumnDef, type RowGroup } from "@/components/table/DataTable";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CheckCell, CheckType, Route } from "@/daemon/types";
import { RAIL_W, ROW_DATA, ROW_MD, SIDEBAR_HEAD_H } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { useStore } from "@/state/store";
import { PageHead, SectionLabel } from "./bits";

const CHECK_TYPES: Array<{ type: CheckType; label: string }> = [
  { type: "responds", label: "Responds" },
  { type: "status", label: "Status" },
  { type: "schema", label: "Schema" },
  { type: "auth401", label: "Auth 401" },
  { type: "bad400", label: "Bad 400" },
];

const BOARD_MODULES = ["users", "orders", "app"];

const CELL_WORD: Record<CheckCell, string> = {
  pass: "passing",
  fail: "failing",
  inferred: "inferred",
  na: "not applicable",
};

interface BoardRow {
  route: Route;
  cells: Record<CheckType, CheckCell>;
}

/**
 * One board cell. Failing cells are the only actionable ones, so only they are
 * buttons — the rest are dots with a screen-reader word, never a clickable div.
 */
function CheckCellDot({
  cell,
  label,
  onOpen,
}: {
  cell: CheckCell;
  label: string;
  onOpen: () => void;
}) {
  if (cell === "fail") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`${label} failing — open check run`}
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className={cn(
              "size-6 rounded-full hover:bg-err-soft focus-visible:bg-err-soft",
              "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
            )}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-err" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label} · failing</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <span
      className={cn(
        "size-1.5 rounded-full",
        cell === "pass"
          ? "bg-ok"
          : cell === "inferred"
            ? "border border-ds-gray-500"
            : "border border-ds-gray-400",
      )}
    >
      <span className="sr-only">{`${label} ${CELL_WORD[cell]}`}</span>
    </span>
  );
}

/** Checks board — derived pass/fail grid over the discovered routes. */
export function ChecksBoard() {
  const routes = useStore((s) => s.routes);
  const checks = useStore((s) => s.checks);
  const tests = useStore((s) => s.sections.tests);
  const navigate = useStore((s) => s.navigate);
  const pushToast = useStore((s) => s.pushToast);

  const groups = useMemo<Array<RowGroup<BoardRow>>>(() => {
    const cellsById = new Map(checks.map((c) => [c.routeId, c.cells]));
    return BOARD_MODULES.map((module) => {
      const rows = routes
        .filter((r) => r.protocol === "http" && r.tags[0] === module)
        .flatMap((route) => {
          const cells = cellsById.get(route.id);
          return cells ? [{ route, cells }] : [];
        })
        // Inferred routes sink to the bottom of their group.
        .sort(
          (a, b) =>
            Number(a.route.provenance === "inferred") - Number(b.route.provenance === "inferred"),
        );
      return { label: `${module} — ${rows.length}`, rows };
    }).filter((g) => g.rows.length > 0);
  }, [routes, checks]);

  /* Real totals off the store — the footer never quotes a number we made up. */
  const totals = useMemo(() => {
    let pass = 0;
    let fail = 0;
    let inferred = 0;
    let na = 0;
    for (const row of checks) {
      for (const cell of Object.values(row.cells)) {
        if (cell === "pass") pass += 1;
        else if (cell === "fail") fail += 1;
        else if (cell === "inferred") inferred += 1;
        else na += 1;
      }
    }
    return { pass, fail, inferred, na, total: pass + fail + inferred + na };
  }, [checks]);

  const columns: Array<ColumnDef<BoardRow>> = [
    {
      id: "route",
      header: "Route",
      cell: (r) => (
        <>
          <MethodBadge method={r.route.method} />
          <span className="truncate font-mono text-sm text-ink">{r.route.path}</span>
          {r.route.provenance === "inferred" ? <Pill tone="warn">inferred</Pill> : null}
        </>
      ),
    },
    ...CHECK_TYPES.map<ColumnDef<BoardRow>>(({ type, label }) => ({
      id: type,
      header: label,
      width: 86,
      align: "center" as const,
      cell: (r: BoardRow) => (
        <CheckCellDot
          cell={r.cells[type]}
          label={`${label} on ${r.route.method} ${r.route.path}`}
          onOpen={() => navigate({ go: "checkRun", checkId: r.route.id })}
        />
      ),
    })),
  ];

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="fade-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-7 pt-6 pb-8">
        <PageHead
          title="Checks"
          sub="derived from your code — updated on every rescan"
          actions={
            <>
              <GhostButton
                onClick={() =>
                  pushToast({
                    kind: "info",
                    text: `${totals.total} checks ran`,
                    sub: `${totals.pass} passing · ${totals.fail} failing · ${totals.inferred + totals.na} n/a`,
                  })
                }
              >
                <Play size={16} strokeWidth={1.5} />
                Run all checks
              </GhostButton>
              <GhostButton onClick={() => navigate({ go: "ci-setup" })}>
                <Settings2 size={16} strokeWidth={1.5} />
                CI setup
              </GhostButton>
            </>
          }
        />

        <DataTable
          className="mt-5"
          label="Checks by route"
          columns={columns}
          groups={groups}
          rowKey={(r) => r.route.id}
          rowHeight={ROW_DATA}
          onRowClick={(r) => navigate({ go: "tests", tab: "checks", id: r.route.id })}
          isSelected={(r) => tests.checkId === r.route.id}
        />
      </div>

      <div className="mx-7 flex h-9 shrink-0 items-center gap-1.5 border-t border-line text-xs">
        <span className="text-ink-2 tabular-nums">{totals.total} checks</span>
        <span className="text-ds-gray-600">·</span>
        <span className="text-ok tabular-nums">{totals.pass} passing</span>
        <span className="text-ds-gray-600">·</span>
        <span className="text-err tabular-nums">{totals.fail} failing</span>
        <span className="text-ds-gray-600">·</span>
        <span className="text-warn tabular-nums">{totals.inferred} inferred</span>
        <span className="text-ds-gray-600">·</span>
        <span className="text-ink-3 tabular-nums">{totals.na} n/a</span>
        <span className="text-ds-gray-600">·</span>
        <span className="text-ink-3">last run 2 m ago</span>
      </div>

      {tests.checkId && !tests.checkRun ? <CheckEditorPanel routeId={tests.checkId} /> : null}
    </div>
  );
}

/**
 * Right-hand check editor — inherited assertions plus the custom check file for
 * one route. It slides and fades in over --dur-panel rather than appearing.
 */
function CheckEditorPanel({ routeId }: { routeId: string }) {
  const route = useStore((s) => s.routes.find((r) => r.id === routeId));
  const navigate = useStore((s) => s.navigate);
  const pushToast = useStore((s) => s.pushToast);
  if (!route) return null;

  const handler = route.sourceLocations.find((l) => l.role === "handler");
  const authed = route.middleware.includes("requireAuth");
  const inherited: Array<{ name: string; ref: string; muted?: boolean }> = [
    { name: "responds", ref: handler?.file ?? "—" },
    { name: `status ${route.method === "POST" ? 201 : 200}`, ref: "from examples" },
    { name: "schema", ref: route.schemaRef ?? "no schema", muted: !route.schemaRef },
    { name: "auth 401", ref: authed ? "from requireAuth" : "n/a", muted: !authed },
    { name: "invalid 400", ref: route.schemaRef ? "from schema" : "n/a", muted: !route.schemaRef },
  ];

  return (
    <aside
      aria-label={`Checks for ${route.method} ${route.path}`}
      style={{ width: RAIL_W }}
      className={cn(
        "absolute inset-y-0 right-0 z-20 flex flex-col border-l border-line bg-ds-background-100",
        "shadow-[var(--ds-shadow-medium)]",
        "animate-in fade-in-0 slide-in-from-right-4 duration-[var(--dur-panel)] ease-[var(--ease-panel)]",
      )}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4"
        style={{ height: SIDEBAR_HEAD_H }}
      >
        <span className="truncate text-base font-medium text-ink">
          {route.method} {route.path}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close check editor"
          onClick={() => navigate({ go: "tests", tab: "checks" })}
          className="-mr-1 shrink-0 text-ink-2 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink"
        >
          <X size={16} strokeWidth={1.5} />
        </Button>
      </div>

      <div className="fade-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <SectionLabel className="pt-2">Inherited</SectionLabel>
        <ul className="flex flex-col">
          {inherited.map((row, i) => (
            <li
              key={row.name}
              style={{ height: ROW_MD, animationDelay: `${i * 20}ms` }}
              className={cn(
                "flex items-center gap-2 border-b border-line/70",
                "animate-in fade-in-0 fill-mode-both duration-[var(--dur-base)] ease-[var(--ease-out)]",
              )}
            >
              <Lock size={14} strokeWidth={1.5} className="shrink-0 text-ds-gray-600" />
              <span className="text-base text-ink">{row.name}</span>
              <span
                className={cn(
                  "ml-auto truncate font-mono text-sm",
                  row.muted ? "text-ink-3" : "text-link-z",
                )}
              >
                {row.ref}
              </span>
            </li>
          ))}
        </ul>

        <SectionLabel className="mt-4">Custom</SectionLabel>
        <pre className="fade-scroll-x hide-scrollbar m-0 overflow-x-auto rounded-md bg-ds-gray-100 p-3 font-mono text-sm leading-5 text-ink-2">
          <code>
            {"pm.test("}
            <span className="text-syntax-str">&quot;creates with role&quot;</span>
            {", async () => {\n  const res = await zest.send()\n  expect(res.json.role).toBe("}
            <span className="text-syntax-str">&quot;member&quot;</span>
            {")\n})"}
          </code>
        </pre>

        <GhostButton
          className="mt-3"
          onClick={() =>
            pushToast({
              kind: "info",
              text: "Custom checks are files",
              sub: "add one under .zestman/checks/ and it shows up here",
            })
          }
        >
          <Plus size={16} strokeWidth={1.5} />
          Add custom check
        </GhostButton>
      </div>
    </aside>
  );
}
