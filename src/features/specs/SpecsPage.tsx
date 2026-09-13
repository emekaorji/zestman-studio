import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  GitBranch,
  RefreshCw,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useStore } from "@/state/store";
import type { SpecsTab } from "@/state/types";
import type { DriftChange, Route, SpecCommit } from "@/daemon/types";
import { cn } from "@/lib/utils";
import { ROW_DATA, ROW_LG } from "@/lib/metrics";
import { MethodBadge, Pill, SegmentedControl } from "@/components/primitives";
import { DataTable, type ColumnDef } from "@/components/table/DataTable";
import { TabStrip } from "@/components/tabstrip/TabStrip";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CodeEditor } from "@/lib/codemirror/CodeEditor";

/* ── Page frame (mirrors the Tests/Mocks frame) ───────────────────────────── */

function PageBody({ children }: { children: ReactNode }) {
  return (
    <div className="fade-scroll min-h-0 flex-1 overflow-y-auto px-4 sm:px-7 pt-6 pb-10">{children}</div>
  );
}

function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-8 items-center", className)}>
      <span className="caps-label">{children}</span>
    </div>
  );
}

/** Icon-only toolbar action — a real shadcn Button with a tooltip and a label. */
function IconAction({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          onClick={onClick}
          className="text-ink-2 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink focus-visible:text-ink"
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/* ── Rendered-spec source data ────────────────────────────────────────────── */

interface SpecParam {
  name: string;
  type: string;
  required: "required" | "optional";
}

const USERS_PARAMS: SpecParam[] = [
  { name: "name", type: "string", required: "required" },
  { name: "email", type: "string", required: "required" },
  { name: "role", type: "string", required: "optional" },
];

const RAW_OPENAPI = `{
  "openapi": "3.0.3",
  "info": {
    "title": "test-backend-case-1",
    "version": "1.0.0"
  },
  "servers": [{ "url": "http://localhost:3000" }],
  "paths": {
    "/api/v1/users": {
      "get": {
        "summary": "List users",
        "tags": ["users"],
        "responses": { "200": { "description": "OK" } }
      },
      "post": {
        "summary": "Create a user",
        "tags": ["users"],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["name", "email"],
                "properties": {
                  "name": { "type": "string", "minLength": 2, "maxLength": 64 },
                  "email": { "type": "string", "format": "email" },
                  "role": { "type": "string", "enum": ["member", "admin"] }
                }
              }
            }
          }
        },
        "responses": {
          "201": { "description": "Created" },
          "400": { "description": "Validation failed" }
        }
      }
    },
    "/api/v1/orders/{id}/cancel": {
      "post": {
        "summary": "Cancel an order",
        "tags": ["orders"],
        "responses": { "200": { "description": "OK" } }
      }
    }
  }
}`;

const PARAM_COLUMNS: Array<ColumnDef<SpecParam>> = [
  {
    id: "name",
    header: "Field",
    width: 200,
    mono: true,
    cell: (p) => <span className="truncate text-ink">{p.name}</span>,
  },
  {
    id: "type",
    header: "Type",
    width: 160,
    mono: true,
    cell: (p) => <span className="text-ink-3">{p.type}</span>,
  },
  {
    id: "required",
    header: "Presence",
    cell: (p) => <span className="text-ink-3">{p.required}</span>,
  },
];

/* ── Document tab ─────────────────────────────────────────────────────────── */

/**
 * One spec operation. shadcn Collapsible, so opening animates its height over
 * --dur-base instead of snapping the panel into place.
 */
function Operation({
  route,
  summary,
  open,
  onOpenChange,
}: {
  route: Route;
  summary: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger
        className={cn(
          "group/op flex w-full items-center gap-3 rounded-md border-b border-line/70 px-2 text-left",
          "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
          "hover:bg-ds-gray-alpha-100 focus-visible:bg-ds-gray-alpha-100",
        )}
        style={{ height: ROW_LG }}
      >
        <span className="w-14 shrink-0">
          <MethodBadge method={route.method} fixed={false} />
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{route.path}</span>
        <span className="hidden w-72 shrink-0 truncate text-base text-ink-3 md:block">
          {summary}
        </span>
        <ChevronRight
          size={16}
          strokeWidth={1.5}
          className={cn(
            "shrink-0 text-ink-3",
            "transition-transform duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
            open && "rotate-90",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="border-b border-line/70 py-3 pl-4">
          <div className="max-w-[620px]">
            <DataTable
              className="[&_th]:static"
              label={`${route.method} ${route.path} request fields`}
              columns={PARAM_COLUMNS}
              rows={USERS_PARAMS}
              rowKey={(p) => p.name}
              rowHeight={ROW_DATA}
            />
          </div>
          <div className="mt-3 flex items-center gap-1.5 pl-2">
            <span className="font-mono text-sm font-semibold text-ok">201</span>
            <span className="text-xs text-ink-3">· application/json · example attached</span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function DocumentTab() {
  const routes = useStore((s) => s.routes);
  const pushToast = useStore((s) => s.pushToast);
  const [mode, setMode] = useState<"rendered" | "raw">("rendered");
  const [expandedId, setExpandedId] = useState<string | null>(
    () => routes.find((r) => r.method === "POST" && r.path === "/api/v1/users")?.id ?? null,
  );

  const byKey = (method: string, path: string) =>
    routes.find((r) => r.method === method && r.path === path);

  const userOps: Array<{ route: Route | undefined; summary: string }> = [
    { route: byKey("GET", "/api/v1/users"), summary: "List users" },
    { route: byKey("POST", "/api/v1/users"), summary: "Create a user" },
    { route: byKey("GET", "/api/v1/users/:id"), summary: "Get a user" },
    { route: byKey("PATCH", "/api/v1/users/:id"), summary: "Update a user" },
    { route: byKey("DELETE", "/api/v1/users/:id"), summary: "Delete a user" },
  ];
  const orderOps: Array<{ route: Route | undefined; summary: string }> = [
    { route: byKey("GET", "/api/v1/orders"), summary: "List orders" },
    { route: byKey("POST", "/api/v1/orders"), summary: "Create an order" },
    { route: byKey("POST", "/api/v1/orders/:id/cancel"), summary: "Cancel an order" },
  ];

  const renderOps = (ops: Array<{ route: Route | undefined; summary: string }>) =>
    ops.map(({ route, summary }, i) =>
      route ? (
        <div
          key={route.id}
          style={{ animationDelay: `${Math.min(i, 8) * 15}ms` }}
          className="animate-in fade-in-0 fill-mode-both duration-[var(--dur-base)] ease-[var(--ease-out)]"
        >
          <Operation
            route={route}
            summary={summary}
            open={expandedId === route.id}
            onOpenChange={(next) => setExpandedId(next ? route.id : null)}
          />
        </div>
      ) : null,
    );

  const copySpec = () => {
    void navigator.clipboard?.writeText(RAW_OPENAPI);
    pushToast({ kind: "info", text: "Spec copied", sub: "OpenAPI 3.0.3 · JSON" });
  };

  return (
    <PageBody>
      <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="shrink-0 text-md font-semibold text-ink">OpenAPI 3.0.3</h1>
        <span className="min-w-0 truncate text-xs text-ink-3 max-md:order-last max-md:basis-full">
          generated 2 m ago · 14 paths · 27 operations · merged with api.yaml (3 ops)
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <SegmentedControl
            options={[
              { value: "rendered" as const, label: "Rendered" },
              { value: "raw" as const, label: "Raw" },
            ]}
            value={mode}
            onChange={setMode}
          />
          <IconAction
            label="Copy spec"
            onClick={copySpec}
            icon={<Copy size={16} strokeWidth={1.5} />}
          />
          <IconAction
            label="Download spec"
            onClick={() =>
              pushToast({ kind: "info", text: "Spec written", sub: ".zestman/openapi.json" })
            }
            icon={<Download size={16} strokeWidth={1.5} />}
          />
          <IconAction
            label="Regenerate spec"
            onClick={() =>
              pushToast({ kind: "info", text: "Spec regenerated", sub: "27 operations" })
            }
            icon={<RefreshCw size={16} strokeWidth={1.5} />}
          />
        </div>
      </div>

      {mode === "rendered" ? (
        <div className="animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]">
          <div className="mt-5">
            <div className="text-base font-semibold text-ink">API Specification</div>
            <div className="mt-1 font-mono text-sm text-ink-2">
              v1.0.0 · server http://localhost:3000
            </div>
          </div>

          <SectionLabel className="mt-5">Users</SectionLabel>
          {renderOps(userOps)}

          <SectionLabel className="mt-5">Orders</SectionLabel>
          {renderOps(orderOps)}

          <div className="flex h-11 items-center pl-2 text-base text-ink-3">
            … 14 more operations
          </div>
        </div>
      ) : (
        <div className="mt-5 animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]">
          <div className="overflow-hidden rounded-lg border border-line">
            <CodeEditor
              ariaLabel="OpenAPI specification"
              value={RAW_OPENAPI}
              language="json"
              readOnly
              minHeight="480px"
              highlightVariables={false}
            />
          </div>
        </div>
      )}
    </PageBody>
  );
}

/* ── Timeline tab ─────────────────────────────────────────────────────────── */

const COMMIT_COL_W = 76;

function CommitDot({ magnitude }: { magnitude: SpecCommit["magnitude"] }) {
  if (magnitude === "breaking")
    return <span className="size-3 rounded-full bg-err ring-4 ring-err-soft" />;
  if (magnitude === "warn") return <span className="size-2.5 rounded-full bg-warn" />;
  if (magnitude === "minor") return <span className="size-2 rounded-full bg-ds-gray-600" />;
  return <span className="size-2 rounded-full bg-ds-gray-400" />;
}

const MAGNITUDE_WORD: Record<SpecCommit["magnitude"], string> = {
  breaking: "breaking change",
  warn: "risky change",
  minor: "minor change",
  none: "no contract change",
};

/** Commit rail — token dots on a hairline connector, fogged when it overflows. */
function CommitStrip({ commits }: { commits: SpecCommit[] }) {
  return (
    <div className="fade-scroll-x hide-scrollbar -mx-2 mt-5 overflow-x-auto px-2 pb-1">
      <ol
        className="relative flex"
        style={{ width: Math.max(commits.length, 1) * COMMIT_COL_W }}
        aria-label="Spec commits"
      >
        <span
          aria-hidden
          className="absolute top-1.5 h-px bg-line"
          style={{
            left: COMMIT_COL_W / 2,
            width: Math.max(commits.length - 1, 0) * COMMIT_COL_W,
          }}
        />
        {commits.map((c, i) => (
          <li
            key={c.sha}
            style={{ width: COMMIT_COL_W, animationDelay: `${Math.min(i, 12) * 25}ms` }}
            className="flex shrink-0 flex-col items-center animate-in fade-in-0 fill-mode-both duration-[var(--dur-base)] ease-[var(--ease-out)]"
          >
            <span className="relative flex h-3 items-center justify-center">
              <CommitDot magnitude={c.magnitude} />
            </span>
            <span className="mt-2 font-mono text-2xs text-ink-3">{c.sha}</span>
            {c.label ? (
              <span className="mt-0.5 font-mono text-2xs text-ds-gray-600">{c.label}</span>
            ) : null}
            <span className="sr-only">{MAGNITUDE_WORD[c.magnitude]}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const VERDICT_TONE: Record<DriftChange["verdict"], "err" | "ok" | "warn" | "neutral"> = {
  BREAKING: "err",
  ADDED: "ok",
  REMOVED: "err",
  DOCS: "neutral",
  AUTH: "warn",
};

/**
 * A drift row. Only BREAKING rows open a diff, so only those are buttons —
 * the rest stay plain rows rather than becoming clickable divs.
 */
function DriftRow({
  change,
  index,
  onOpen,
}: {
  change: DriftChange;
  index: number;
  onOpen?: () => void;
}) {
  const inner = (
    <>
      <Pill
        tone={VERDICT_TONE[change.verdict]}
        className="w-[76px] shrink-0 justify-center font-semibold tracking-[0.06em]"
      >
        {change.verdict}
      </Pill>
      <MethodBadge method={change.method} />
      <span className="shrink-0 font-mono text-sm text-ink">{change.path}</span>
      <span className="min-w-0 flex-1 truncate text-base text-ink-2">— {change.text}</span>
      {change.fileRef ? (
        <span className="hidden shrink-0 font-mono text-sm text-link-z lg:inline">
          {change.fileRef}
        </span>
      ) : null}
    </>
  );

  const shared = cn(
    "flex w-full items-center gap-3 rounded-md border-b border-line/70 px-2 text-left",
    "animate-in fade-in-0 fill-mode-both duration-[var(--dur-base)] ease-[var(--ease-out)]",
  );
  const style = { height: ROW_LG, animationDelay: `${Math.min(index, 10) * 20}ms` };

  if (!onOpen) {
    return (
      <div className={shared} style={style}>
        {inner}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      style={style}
      className={cn(
        shared,
        "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
        "hover:bg-ds-gray-alpha-100 focus-visible:bg-ds-gray-alpha-100",
      )}
    >
      {inner}
    </button>
  );
}

function BranchChip({
  name,
  sha,
  current = false,
}: {
  name: string;
  sha: string;
  current?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 font-mono text-sm",
        current ? "bg-ds-gray-200 text-ink" : "border border-line text-ink-2",
      )}
    >
      <GitBranch size={14} strokeWidth={1.5} className="text-ink-3" />
      {name} · {sha}
    </span>
  );
}

function TimelineTab() {
  const specCommits = useStore((s) => s.specCommits);
  const driftChanges = useStore((s) => s.driftChanges);
  const navigate = useStore((s) => s.navigate);
  const pushToast = useStore((s) => s.pushToast);

  return (
    <PageBody>
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        <h1 className="shrink-0 text-md font-semibold text-ink">Contract timeline</h1>
        <BranchChip name="main" sha="a1b2c3d" />
        <span className="text-xs text-ds-gray-600">→</span>
        <BranchChip name="feat/orders-v2" sha="f9e8d7c" current />
        <div className="ml-auto shrink-0">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() =>
              pushToast({
                kind: "info",
                text: "PR check posted",
                sub: "1 breaking · 1 added · 1 auth · 1 docs",
              })
            }
            className={cn(
              "h-9 rounded-lg border-ds-gray-400 bg-transparent px-3 text-base font-medium text-ink-2",
              "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
              "hover:bg-hoverbg hover:text-ink dark:bg-transparent dark:hover:bg-hoverbg",
            )}
          >
            Post PR check
          </Button>
        </div>
      </div>

      <CommitStrip commits={specCommits} />

      <SectionLabel className="mt-5">
        Changes <span className="normal-case">· feat/orders-v2 vs main</span>
      </SectionLabel>
      <div className="border-t border-line">
        {driftChanges.map((dr, i) => (
          <DriftRow
            key={dr.id}
            change={dr}
            index={i}
            onOpen={
              dr.verdict === "BREAKING"
                ? () => navigate({ go: "specs", tab: "timeline", diffChangeId: dr.id })
                : undefined
            }
          />
        ))}
      </div>

      <div className="mt-5 text-xs text-ink-3">
        changelog paragraph auto-drafted — used by PR checks and the docs portal
      </div>
    </PageBody>
  );
}

/* ── Route diff view ──────────────────────────────────────────────────────── */

interface DiffParam {
  name: string;
  type: string;
  required: string;
  added?: boolean;
}

const MAIN_PARAMS: DiffParam[] = [
  { name: "name", type: "string", required: "required" },
  { name: "email", type: "string", required: "required" },
  { name: "role", type: "string", required: "optional" },
];

const BRANCH_PARAMS: DiffParam[] = [
  ...MAIN_PARAMS,
  { name: "total", type: "number", required: "required", added: true },
];

function DiffColumn({ title, sha, params }: { title: string; sha: string; params: DiffParam[] }) {
  return (
    <div>
      <div className="flex h-8 items-center border-b border-line">
        <span className="caps-label">
          {title} <span className="normal-case">· {sha}</span>
        </span>
      </div>
      <ul>
        {params.map((p, i) => (
          <li
            key={p.name}
            style={{ height: ROW_DATA, animationDelay: `${Math.min(i, 8) * 20}ms` }}
            className={cn(
              "flex items-center gap-3",
              "animate-in fade-in-0 fill-mode-both duration-[var(--dur-base)] ease-[var(--ease-out)]",
              p.added ? "my-1 rounded-md bg-err-soft px-2" : "border-b border-line/70",
            )}
          >
            <span className="w-32 shrink-0 truncate font-mono text-sm text-ink">{p.name}</span>
            <span className="w-24 shrink-0 font-mono text-sm text-ink-3">{p.type}</span>
            <span className="text-base text-ink-3">{p.required}</span>
            {p.added ? (
              <Pill tone="err" className="ml-auto border-err-line bg-transparent font-semibold">
                + new
              </Pill>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RouteDiffView({ change }: { change: DriftChange }) {
  const navigate = useStore((s) => s.navigate);
  return (
    <PageBody>
      <div className="flex min-h-9 items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate({ go: "specs", tab: "timeline", diffChangeId: null })}
          className={cn(
            "-ml-2 gap-1 px-2 text-base font-normal text-ink-2",
            "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
            "hover:bg-ds-gray-alpha-100 hover:text-ink focus-visible:bg-ds-gray-alpha-100 focus-visible:text-ink",
          )}
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
          Timeline
        </Button>
        <MethodBadge method={change.method} fixed={false} />
        <span className="min-w-0 truncate font-mono text-base font-medium text-ink">
          {change.path}
        </span>
      </div>

      <div
        role="alert"
        className={cn(
          "mt-5 flex min-h-12 flex-wrap items-center justify-between gap-3 rounded-lg bg-err-soft px-4 py-2",
          "animate-in fade-in-0 slide-in-from-top-1 duration-[var(--dur-base)] ease-[var(--ease-out)]",
        )}
      >
        <span className="text-base font-medium text-err">
          BREAKING — required field added to request body
        </span>
        <span className="rounded-full bg-ds-background-100 px-2.5 py-1 font-mono text-xs text-ink-2">
          rule: request-required-added
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-2">
        <DiffColumn title="Main" sha="a1b2c3d" params={MAIN_PARAMS} />
        <DiffColumn title="feat/orders-v2" sha="f9e8d7c" params={BRANCH_PARAMS} />
      </div>

      <SectionLabel className="mt-8">Blame</SectionLabel>
      <div className="border-t border-line">
        <div
          className="flex items-center gap-1.5 border-b border-line/70 font-mono text-sm text-ink-2"
          style={{ height: ROW_DATA }}
        >
          <span className="text-link-z">added</span>
          <span className="text-ink-3">in</span>
          <span className="text-link-z">f9e8d7c</span>
          <span className="text-ds-gray-600">·</span>
          <span className="truncate text-link-z">{change.fileRef ?? "orders.schema.ts:24"}</span>
        </div>
        <div
          className="flex items-center border-b border-line/70 text-base text-ink-3"
          style={{ height: ROW_DATA }}
        >
          by you · 2 h ago
        </div>
      </div>
    </PageBody>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export function SpecsPage() {
  const tab = useStore((s) => s.sections.specs.tab);
  const diffChangeId = useStore((s) => s.sections.specs.diffChangeId);
  const driftChanges = useStore((s) => s.driftChanges);
  const navigate = useStore((s) => s.navigate);

  const diffChange = diffChangeId ? driftChanges.find((d) => d.id === diffChangeId) : undefined;

  if (diffChange) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <RouteDiffView change={diffChange} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TabStrip<SpecsTab>
        label="Spec views"
        variant="page"
        className="px-4 sm:px-7"
        tabs={[
          { id: "document", label: "Document" },
          { id: "timeline", label: "Timeline" },
        ]}
        active={tab}
        onSelect={(t) => navigate({ go: "specs", tab: t })}
      />
      <div key={tab} className="flex min-h-0 flex-1 flex-col animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]">
        {tab === "document" ? <DocumentTab /> : <TimelineTab />}
      </div>
    </div>
  );
}
