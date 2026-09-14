import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  GitBranch,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useStore } from "@/state/store";
import type { SpecsTab } from "@/state/types";
import type { DriftChange, DriftField, GitInfo, Route, SpecCommit } from "@/daemon/types";
import { getClient } from "@/app/client";
import { downloadJson } from "@/lib/download";
import { relTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ROW_DATA, ROW_LG } from "@/lib/metrics";
import { MethodBadge, Pill, SegmentedControl } from "@/components/primitives";
import { SourceRef } from "@/components/SourceRef";
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

/** Body fields the daemon derived from the route's schema. */
function paramsFor(route: Route): SpecParam[] {
  return route.docFields.map((f) => ({
    name: f.name,
    type: f.type,
    required: f.required ? "required" : "optional",
  }));
}

/** What the daemon's OpenAPI document tells us for the header line. */
interface SpecSummary {
  title: string | null;
  version: string | null;
  server: string | null;
  paths: number;
  operations: number;
}

const HTTP_VERBS = new Set(["get", "post", "put", "patch", "delete", "options", "head", "trace"]);

function summarize(doc: unknown): SpecSummary {
  const d = (doc && typeof doc === "object" ? doc : {}) as {
    info?: { title?: unknown; version?: unknown };
    servers?: Array<{ url?: unknown }>;
    paths?: Record<string, Record<string, unknown>>;
  };
  const paths = d.paths && typeof d.paths === "object" ? d.paths : {};
  let operations = 0;
  for (const item of Object.values(paths)) {
    if (!item || typeof item !== "object") continue;
    operations += Object.keys(item).filter((k) => HTTP_VERBS.has(k.toLowerCase())).length;
  }
  return {
    title: typeof d.info?.title === "string" ? d.info.title : null,
    version: typeof d.info?.version === "string" ? d.info.version : null,
    server: typeof d.servers?.[0]?.url === "string" ? d.servers[0].url : null,
    paths: Object.keys(paths).length,
    operations,
  };
}

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
  const examples = useStore((s) => s.examples);
  const params = paramsFor(route);
  const okCode = route.method === "POST" ? 201 : route.method === "DELETE" ? 204 : 200;
  const example = examples.find((e) => e.routeId === route.id && e.status === okCode) ?? examples.find((e) => e.routeId === route.id);
  const code = example?.status ?? okCode;
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
          {params.length > 0 ? (
            <div className="max-w-[620px]">
              <DataTable
                className="[&_th]:static"
                label={`${route.method} ${route.path} request fields`}
                columns={PARAM_COLUMNS}
                rows={params}
                rowKey={(p) => p.name}
                rowHeight={ROW_DATA}
              />
            </div>
          ) : (
            <div className="flex h-8 items-center pl-2 text-base text-ink-3">No request body fields</div>
          )}
          <div className="mt-3 flex items-center gap-1.5 pl-2">
            <span className={cn("font-mono text-sm font-semibold", code < 400 ? "text-ok" : "text-err")}>{code}</span>
            <span className="text-xs text-ink-3">
              · application/json{example ? " · example attached" : ""}
            </span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function DocumentTab() {
  const routes = useStore((s) => s.routes);
  const environments = useStore((s) => s.environments);
  const refreshSpec = useStore((s) => s.refreshSpec);
  const pushToast = useStore((s) => s.pushToast);
  const [mode, setMode] = useState<"rendered" | "raw">("rendered");
  const [doc, setDoc] = useState<unknown>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(
    () => routes.find((r) => r.protocol === "http" && r.method === "POST")?.id ?? routes[0]?.id ?? null,
  );

  const loadDoc = async () => {
    try {
      const next = await getClient().getOpenApi();
      setDoc(next);
      setFetchedAt(Date.now());
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void loadDoc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const docText = useMemo(() => (doc == null ? "" : JSON.stringify(doc, null, 2)), [doc]);
  const summary = useMemo(() => (doc == null ? null : summarize(doc)), [doc]);
  const baseUrl = environments.find((e) => e.isActive)?.variables.find((v) => v.key === "baseUrl" && v.enabled)?.value;
  const server = summary?.server ?? baseUrl ?? null;

  /* One section per module (first tag), in the order routes were discovered. */
  const groups = useMemo(() => {
    const map = new Map<string, Route[]>();
    for (const r of routes) {
      if (r.protocol !== "http") continue;
      const key = r.tags[0] ?? "other";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()];
  }, [routes]);

  const renderOps = (ops: Route[]) =>
    ops.map((route, i) => (
      <div
        key={route.id}
        style={{ animationDelay: `${Math.min(i, 8) * 15}ms` }}
        className="animate-in fade-in-0 fill-mode-both duration-[var(--dur-base)] ease-[var(--ease-out)]"
      >
        <Operation
          route={route}
          summary={route.name}
          open={expandedId === route.id}
          onOpenChange={(next) => setExpandedId(next ? route.id : null)}
        />
      </div>
    ));

  const copySpec = () => {
    if (!docText) return;
    void navigator.clipboard?.writeText(docText);
    pushToast({ kind: "info", text: "Spec copied", sub: "OpenAPI · JSON" });
  };

  const downloadSpec = async () => {
    try {
      const latest = doc ?? (await getClient().getOpenApi());
      downloadJson("openapi.json", latest);
      pushToast({ kind: "info", text: "Spec downloaded", sub: "openapi.json" });
    } catch {
      /* the daemon's message is already toasted by the client */
    }
  };

  const regenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      const { operations } = await getClient().regenerateSpec();
      await Promise.all([loadDoc(), refreshSpec()]);
      pushToast({ kind: "info", text: "Spec regenerated", sub: `${operations} operations` });
    } catch {
      /* the daemon's message is already toasted by the client */
    } finally {
      setRegenerating(false);
    }
  };

  const meta = summary
    ? [
        fetchedAt ? `generated ${relTime(fetchedAt)}` : null,
        `${summary.paths} paths`,
        `${summary.operations} operations`,
      ]
        .filter(Boolean)
        .join(" · ")
    : loadError
      ? loadError
      : "reading the spec…";

  return (
    <PageBody>
      <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="shrink-0 text-md font-semibold text-ink">OpenAPI</h1>
        <span className="min-w-0 truncate text-xs text-ink-3 max-md:order-last max-md:basis-full">{meta}</span>
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
            onClick={() => void downloadSpec()}
            icon={<Download size={16} strokeWidth={1.5} />}
          />
          <IconAction
            label="Regenerate spec"
            onClick={() => void regenerate()}
            icon={
              regenerating ? (
                <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
              ) : (
                <RefreshCw size={16} strokeWidth={1.5} />
              )
            }
          />
        </div>
      </div>

      {mode === "rendered" ? (
        <div className="animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]">
          <div className="mt-5">
            <div className="text-base font-semibold text-ink">{summary?.title ?? "API Specification"}</div>
            <div className="mt-1 font-mono text-sm text-ink-2">
              {summary?.version ? `v${summary.version}` : "—"}
              {server ? ` · server ${server}` : ""}
            </div>
          </div>

          {groups.map(([module, ops]) => (
            <div key={module}>
              <SectionLabel className="mt-5">{module}</SectionLabel>
              {renderOps(ops)}
            </div>
          ))}
          {groups.length === 0 ? (
            <div className="flex h-11 items-center pl-2 text-base text-ink-3">No HTTP routes discovered yet</div>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]">
          <div className="overflow-hidden rounded-lg border border-line">
            <CodeEditor
              ariaLabel="OpenAPI specification"
              value={docText}
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
        /* A row that is itself a button cannot nest another one — the diff
           view it opens carries the same reference as a real link. */
        onOpen ? (
          <span className="hidden shrink-0 font-mono text-sm text-link-z lg:inline">{change.fileRef}</span>
        ) : (
          <SourceRef fileRef={change.fileRef} className="hidden shrink-0 lg:inline-flex" />
        )
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

function useGitInfo(): GitInfo | null {
  const projectId = useStore((s) => s.activeProjectId);
  const [info, setInfo] = useState<GitInfo | null>(null);
  useEffect(() => {
    let alive = true;
    setInfo(null);
    getClient()
      .getGitInfo()
      .then((g) => {
        if (alive) setInfo(g);
      })
      .catch(() => {
        if (alive) setInfo({ isRepo: false, branch: null, head: null, specDirty: false });
      });
    return () => {
      alive = false;
    };
  }, [projectId]);
  return info;
}

function driftSummary(changes: DriftChange[]): string {
  if (!changes.length) return "What is running matches the committed spec.json — nothing to write up.";
  const n = (v: DriftChange["verdict"]) => changes.filter((c) => c.verdict === v).length;
  const parts = [
    [n("BREAKING"), "breaking"],
    [n("ADDED"), "added"],
    [n("REMOVED"), "removed"],
    [n("AUTH"), "auth"],
    [n("DOCS"), "docs"],
  ] as Array<[number, string]>;
  return `Against the committed spec.json the running API has ${parts
    .filter(([c]) => c > 0)
    .map(([c, l]) => `${c} ${l}`)
    .join(" · ")} change${changes.length === 1 ? "" : "s"}. Commit .zestman/spec.json to record them.`;
}

function TimelineTab() {
  const specCommits = useStore((s) => s.specCommits);
  const driftChanges = useStore((s) => s.driftChanges);
  const navigate = useStore((s) => s.navigate);
  const git = useGitInfo();

  return (
    <PageBody>
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        <h1 className="shrink-0 text-md font-semibold text-ink">Contract timeline</h1>
        {git === null ? null : git.isRepo ? (
          <>
            <BranchChip name={git.branch ?? "HEAD"} sha={git.head ?? "—"} />
            <span className="text-xs text-ds-gray-600">→</span>
            <BranchChip name="running" sha={git.specDirty ? "uncommitted" : "in sync"} current />
          </>
        ) : (
          <span className="inline-flex h-8 items-center rounded-md border border-line px-2.5 font-mono text-sm text-ink-3">
            not a git repository
          </span>
        )}
        <div className="ml-auto shrink-0">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => navigate({ go: "ci-setup" })}
            className={cn(
              "h-9 rounded-lg border-ds-gray-400 bg-transparent px-3 text-base font-medium text-ink-2",
              "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
              "hover:bg-hoverbg hover:text-ink dark:bg-transparent dark:hover:bg-hoverbg",
            )}
          >
            CI setup
          </Button>
        </div>
      </div>

      {specCommits.length ? (
        <CommitStrip commits={specCommits} />
      ) : (
        <p className="mt-4 text-sm text-ink-3">
          {git?.isRepo
            ? "No commits touch .zestman/spec.json yet — commit it and every later change shows up here."
            : "Initialise git and commit .zestman/spec.json to get a history of your API contract."}
        </p>
      )}

      <SectionLabel className="mt-5">
        Changes <span className="normal-case">· running vs committed .zestman/spec.json</span>
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
        {driftChanges.length === 0 ? (
          <div className="flex items-center text-base text-ink-3" style={{ height: ROW_DATA }}>
            No drift — the running API matches the committed spec.
          </div>
        ) : null}
      </div>

      <div className="mt-5 text-xs text-ink-3">{driftSummary(driftChanges)}</div>
    </PageBody>
  );
}

/* ── Route diff view ──────────────────────────────────────────────────────── */

function DiffColumn({ title, sub, fields, other }: { title: string; sub: string; fields: DriftField[]; other: DriftField[] }) {
  const otherByName = new Map(other.map((f) => [f.name, f]));
  return (
    <div>
      <div className="flex h-8 items-center border-b border-line">
        <span className="caps-label">
          {title} <span className="normal-case">· {sub}</span>
        </span>
      </div>
      <ul>
        {fields.map((p, i) => {
          const o = otherByName.get(p.name);
          const changed = !o || o.type !== p.type || o.required !== p.required;
          return (
            <li
              key={p.name}
              style={{ height: ROW_DATA, animationDelay: `${Math.min(i, 8) * 20}ms` }}
              className={cn(
                "flex items-center gap-3",
                "animate-in fade-in-0 fill-mode-both duration-[var(--dur-base)] ease-[var(--ease-out)]",
                changed ? "my-1 rounded-md bg-err-soft px-2" : "border-b border-line/70",
              )}
            >
              <span className="w-32 shrink-0 truncate font-mono text-sm text-ink">{p.name}</span>
              <span className="w-24 shrink-0 font-mono text-sm text-ink-3">{p.type}</span>
              <span className="text-base text-ink-3">{p.required ? "required" : "optional"}</span>
              {changed ? (
                <Pill tone="err" className="ml-auto border-err-line bg-transparent font-semibold">
                  {o ? "changed" : "+ new"}
                </Pill>
              ) : null}
            </li>
          );
        })}
        {fields.length === 0 ? (
          <li className="flex items-center text-base text-ink-3" style={{ height: ROW_DATA }}>
            no body fields
          </li>
        ) : null}
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
          {change.verdict} — {change.text}
        </span>
        <span className="rounded-full bg-ds-background-100 px-2.5 py-1 font-mono text-xs text-ink-2">
          committed spec.json vs running
        </span>
      </div>

      {change.fields ? (
        <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-2">
          <DiffColumn title="Committed" sub=".zestman/spec.json" fields={change.fields.before} other={change.fields.after} />
          <DiffColumn title="Running" sub="reported by the app" fields={change.fields.after} other={change.fields.before} />
        </div>
      ) : (
        <p className="mt-6 text-base text-ink-3">This change is not about the request body; the line above is the whole diff.</p>
      )}

      <SectionLabel className="mt-8">Blame</SectionLabel>
      <div className="border-t border-line">
        <div
          className="flex items-center gap-1.5 border-b border-line/70 font-mono text-sm text-ink-2"
          style={{ height: ROW_DATA }}
        >
          {change.fileRef ? (
            <>
              <span className="text-ink-3">handler</span>
              <SourceRef fileRef={change.fileRef} />
            </>
          ) : (
            <span className="text-ink-3">no handler location known for this route</span>
          )}
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
