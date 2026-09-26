import { ChevronDown, ChevronRight, Copy, FileCode2, Loader2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePersistentState } from "@/state/persist";
import { useStore } from "@/state/store";
import { Markdown } from "@/components/Markdown";
import type { Example, Route } from "@/daemon/types";
import type { DocPageContent } from "@/daemon/client";
import { getClient } from "@/studio/client";
import { useBaseUrl } from "@/hooks/useBaseUrl";
import { cn } from "@/lib/utils";
import { formatBytes, statusText } from "@/lib/format";
import { AccentButton, GhostButton, MethodBadge, SegmentedControl, StatusChip } from "@/components/primitives";
import { SourceRef } from "@/components/SourceRef";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CodeEditor } from "@/lib/codemirror/CodeEditor";
import { prettyJson } from "@/lib/prettyBody";

/* ── Content data ─────────────────────────────────────────────────────────── */

interface ParamDoc {
  name: string;
  type: string;
  required: boolean;
  desc: string;
}

const PARAM_DOCS: Record<string, ParamDoc[]> = {
  "POST /api/v1/users": [
    { name: "name", type: "string", required: true, desc: "Display name, 2-64 chars." },
    { name: "email", type: "string", required: true, desc: "Must be unique." },
    { name: "role", type: "enum member | admin", required: false, desc: "Defaults to member." },
  ],
  "POST /api/v1/orders": [
    { name: "userId", type: "string", required: true, desc: "References an existing user." },
    { name: "items", type: "array", required: true, desc: "Line items — sku and qty per entry." },
  ],
  "POST /api/v1/orders/:id/cancel": [
    { name: "reason", type: "enum customer | fraud", required: true, desc: "Why the order is cancelled." },
    { name: "notify", type: "boolean", required: false, desc: "Email the customer. Defaults to true." },
  ],
};

function paramDocsFor(route: Route): ParamDoc[] {
  const known = PARAM_DOCS[`${route.method} ${route.path}`];
  if (known) return known;
  if (route.body.mode !== "raw" || !route.body.raw.text) return [];
  try {
    const obj = JSON.parse(route.body.raw.text) as Record<string, unknown>;
    return Object.entries(obj).map(([name, v]) => ({
      name,
      type: Array.isArray(v) ? "array" : typeof v === "object" ? "object" : typeof v,
      required: true,
      desc: route.schemaRef ? `Validated by ${route.schemaRef}` : "",
    }));
  } catch {
    return [];
  }
}

/** One row of a route's responses as the docs show it: the best real body we have for that status. */
interface DocResponse {
  status: number;
  label: string;
  body: string | null;
  bytes: number | null;
  note: string;
}

/**
 * Saved examples first (the user chose them), then the latest real response the daemon saw,
 * then the OpenAPI document's example. Statuses nobody has seen or declared are not invented.
 */
function docResponses(route: Route, examples: Example[]): DocResponse[] {
  const byStatus = new Map<number, DocResponse>();
  for (const r of route.responses ?? []) {
    byStatus.set(r.status, {
      status: r.status,
      label: r.label || statusText(r.status),
      body: r.example,
      bytes: r.example === null ? null : new TextEncoder().encode(r.example).length,
      note: r.source === "spec" ? (r.example === null ? "documented" : "documented · example from the spec") : r.example === null ? "seen" : "latest real response",
    });
  }
  for (const e of examples.filter((x) => x.routeId === route.id)) {
    const prev = byStatus.get(e.status);
    byStatus.set(e.status, { status: e.status, label: prev?.label ?? statusText(e.status), body: e.body, bytes: e.bytes, note: `saved example · ${e.name}` });
  }
  return [...byStatus.values()].sort((a, b) => a.status - b.status);
}

/* ── Code snippet generation ──────────────────────────────────────────────── */

type SnippetLang = "curl" | "js" | "python";

function exampleUrl(route: Route, baseUrl: string): string {
  return `${baseUrl}${route.path}`;
}

function bodyLines(route: Route, indent: string): string[] {
  if (route.body.mode !== "raw" || !route.body.raw.text) return [];
  return route.body.raw.text.split("\n").map((l, i) => (i === 0 ? l : indent + l));
}

function snippetFor(route: Route, lang: SnippetLang, baseUrl: string): string {
  const url = exampleUrl(route, baseUrl);
  const hasBody = route.body.mode === "raw" && route.body.raw.text.length > 0;
  if (lang === "curl") {
    const lines = [
      `curl -X ${route.method} \\`,
      `  '${url}' \\`,
      `  -H 'content-type: application/json' \\`,
      `  -H 'authorization: Bearer ····9f2'${hasBody ? " \\" : ""}`,
    ];
    if (hasBody) lines.push(`  -d '${bodyLines(route, "    ").join("\n")}'`);
    return lines.join("\n");
  }
  if (lang === "js") {
    const lines = [
      `const res = await fetch(`,
      `  '${url}',`,
      `  {`,
      `    method: '${route.method}',`,
      `    headers: { authorization: \`Bearer \${token}\` },`,
    ];
    if (hasBody) lines.push(`    body: JSON.stringify(${bodyLines(route, "    ").join("\n")}),`);
    lines.push(`  },`, `)`, `const data = await res.json()`);
    return lines.join("\n");
  }
  const lines = [
    `import requests`,
    ``,
    `res = requests.${route.method.toLowerCase()}(`,
    `    '${url}',`,
    `    headers={'authorization': f'Bearer {token}'},`,
  ];
  if (hasBody) lines.push(`    json=${bodyLines(route, "    ").join("\n")},`);
  lines.push(`)`);
  return lines.join("\n");
}

/* ── Small blocks ─────────────────────────────────────────────────────────── */

/** Vercel's code well: sunken ground, radius 6, Geist Mono 13/20. */
function CodeBlock({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <pre
      className={cn(
        "fade-scroll-x overflow-x-auto rounded-lg bg-sunken p-3 font-mono text-sm leading-6 whitespace-pre text-ink-2",
        className,
      )}
    >
      {children}
    </pre>
  );
}

/** Minimal JSON token coloring for the examples column (presentational only). */
function JsonBlock({ json }: { json: string }) {
  const nodes: ReactNode[] = [];
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?)|(true|false|null)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(json)) !== null) {
    if (m.index > last) nodes.push(json.slice(last, m.index));
    if (m[1] != null) {
      nodes.push(
        <span key={k++} className={m[2] ? "text-syntax-key" : "text-syntax-str"}>
          {m[1]}
        </span>,
      );
      if (m[2]) nodes.push(m[2]);
    } else if (m[3] != null) {
      nodes.push(
        <span key={k++} className="text-syntax-num">
          {m[3]}
        </span>,
      );
    } else if (m[4] != null) {
      nodes.push(
        <span key={k++} className="text-syntax-num">
          {m[4]}
        </span>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < json.length) nodes.push(json.slice(last));
  return <CodeBlock>{nodes}</CodeBlock>;
}

function SectionCaps({ children }: { children: ReactNode }) {
  return (
    <div className="mt-9 mb-1 flex h-8 items-center border-b border-line">
      <span className="caps-label">{children}</span>
    </div>
  );
}

/* ── Endpoint doc ─────────────────────────────────────────────────────────── */

function ParamRow({ p }: { p: ParamDoc }) {
  return (
    <div className="flex flex-col justify-center gap-0.5 border-b border-line/60 py-2.5">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-sm font-medium text-ink">{p.name}</span>
        <span className="font-mono text-xs text-ink-3">{p.type}</span>
        {p.required ? (
          <span className="text-2xs font-medium text-warn">required</span>
        ) : (
          <span className="text-2xs text-ink-3">optional</span>
        )}
      </div>
      <div className="text-base text-ink-2">{p.desc}</div>
    </div>
  );
}

/**
 * One response case. Radix Collapsible owns the disclosure, so `aria-expanded`
 * is wired and the panel eases its height open instead of snapping.
 */
function ResponseCase({
  code,
  tone,
  label,
  note,
  body,
  minHeight,
  defaultOpen,
}: {
  code: number;
  tone: "ok" | "err";
  label: string;
  note?: string;
  body: string | null;
  minHeight: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          "-mx-2 flex h-10 w-[calc(100%+16px)] items-center gap-2 rounded-md px-2 text-left",
          "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
          "hover:bg-ds-gray-alpha-100 focus-visible:bg-ds-gray-alpha-100",
        )}
      >
        {open ? (
          <ChevronDown size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
        ) : (
          <ChevronRight size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
        )}
        <span className={cn("font-mono text-sm font-semibold", tone === "ok" ? "text-ok" : "text-err")}>
          {code}
        </span>
        <span className="text-base text-ink-2">— {label}</span>
        {note ? <span className="text-xs text-ink-3">· {note}</span> : null}
      </CollapsibleTrigger>
      <CollapsibleContent
        className={cn(
          "overflow-hidden duration-[var(--dur-panel)] ease-[var(--ease-panel)]",
          "data-open:animate-collapsible-down data-closed:animate-collapsible-up",
        )}
      >
        {body === null ? (
          <p className="mt-1 mb-3 text-sm text-ink-3">No body seen for this status yet — it fills in once the route answers with it.</p>
        ) : (
          <div className="mt-1 mb-2 overflow-hidden rounded-lg border border-line">
            <CodeEditor
              value={prettyJson(body) ?? body}
              language="json"
              readOnly
              minHeight={minHeight}
              highlightVariables={false}
              ariaLabel="Example response body"
            />
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ResponseSection({ route }: { route: Route }) {
  const examples = useStore((s) => s.examples);
  const responses = docResponses(route, examples);
  const firstOk = responses.find((r) => r.status < 400)?.status ?? responses[0]?.status;

  return (
    <>
      <SectionCaps>Responses</SectionCaps>
      {responses.length === 0 ? (
        <p className="text-base text-ink-3">No responses seen yet. Send this request from the workbench and they show up here.</p>
      ) : (
        responses.map((r) => (
          <ResponseCase
            key={r.status}
            code={r.status}
            tone={r.status < 400 ? "ok" : "err"}
            label={r.label}
            note={r.note}
            body={r.body}
            minHeight={r.status < 400 ? "176px" : "120px"}
            defaultOpen={r.status === firstOk}
          />
        ))
      )}
    </>
  );
}

function ExamplesColumn({ route }: { route: Route }) {
  const examples = useStore((s) => s.examples);
  const baseUrl = useBaseUrl();
  const [lang, setLang] = usePersistentState<SnippetLang>("zestman:ui:docs-lang:v1", "curl");
  /* The status picker offers only statuses this route has really answered with,
     was documented with, or has a saved example for. */
  const responses = docResponses(route, examples);
  const statusOptions = responses.map((r) => String(r.status));
  const fallback = String(responses.find((r) => r.status < 400)?.status ?? responses[0]?.status ?? "");
  const [status, setStatus] = useState(fallback);
  const shown = statusOptions.includes(status) ? status : fallback;
  const current = responses.find((r) => String(r.status) === shown) ?? null;

  return (
    <div className="mt-10 w-full min-w-0 shrink-0 xl:mt-0 xl:w-[400px] xl:pl-10">
      <div className="flex items-center justify-between gap-3">
        <SegmentedControl
          size="sm"
          className="flex-1"
          options={[
            { value: "curl" as const, label: "cURL" },
            { value: "js" as const, label: "JS" },
            { value: "python" as const, label: "Python" },
          ]}
          value={lang}
          onChange={setLang}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <GhostButton size="sm" aria-label="Choose response status" disabled={statusOptions.length === 0}>
              <span className="font-mono">{shown || "—"}</span>
              <ChevronDown size={14} strokeWidth={1.5} className="text-ink-3" />
            </GhostButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup value={status} onValueChange={setStatus}>
              {statusOptions.map((sc) => (
                <DropdownMenuRadioItem key={sc} value={sc}>
                  <span className="font-mono text-sm">{sc}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-7 mb-2 caps-label">Example request</div>
      <CodeBlock>{snippetFor(route, lang, baseUrl)}</CodeBlock>

      <div className="mt-7 mb-2 caps-label">Example response</div>
      {current ? (
        <>
          <div className="mb-2 flex items-center gap-2">
            <StatusChip code={current.status} label={`${current.status} ${current.label}`} />
            {current.bytes !== null ? <span className="font-mono text-xs text-ink-3">{formatBytes(current.bytes)}</span> : null}
          </div>
          {current.body !== null ? (
            <JsonBlock json={current.body} />
          ) : (
            <p className="text-sm text-ink-3">No body seen for this status yet.</p>
          )}
          <p className="mt-4 text-xs text-ink-3">{current.note}</p>
        </>
      ) : (
        <p className="text-sm text-ink-3">No responses seen yet — send this request once.</p>
      )}
    </div>
  );
}

function EndpointDoc({ route }: { route: Route }) {
  const pushToast = useStore((s) => s.pushToast);
  const navigate = useStore((s) => s.navigate);
  const params = paramDocsFor(route);
  const module = route.tags[0] ?? "api";

  const copyPath = () => {
    void navigator.clipboard?.writeText(route.path);
    pushToast({ kind: "info", text: `Copied ${route.path}` });
  };

  return (
    <div className="fade-scroll min-h-0 flex-1 overflow-y-auto">
      {/* The reference is two columns only when both fit; below that the
          examples stack under the prose rather than squeezing it. */}
      <div className="flex min-w-0 flex-col px-4 pt-7 pb-16 sm:px-7 xl:flex-row xl:px-10">
        {/* Center column */}
        <div className="min-w-0 max-w-[620px] flex-1">
          <div className="caps-label">{module === "app" ? "Other" : module}</div>
          <div className="mt-2 flex items-start justify-between gap-4">
            <h1 className="min-w-0 text-xl font-semibold text-ink">{route.name}</h1>
            <GhostButton
              size="sm"
              className="mt-1 shrink-0"
              onClick={() => navigate({ go: "route", routeId: route.id })}
            >
              <Pencil size={16} strokeWidth={1.5} />
              Edit
            </GhostButton>
          </div>

          {/* Endpoint lozenge */}
          <div className="mt-5 flex h-10 items-center gap-2.5 rounded-lg bg-sunken pr-1.5 pl-3">
            <MethodBadge method={route.method} fixed={false} />
            <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{route.path}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Copy ${route.path}`}
              onClick={copyPath}
              className="shrink-0 text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink"
            >
              <Copy size={16} strokeWidth={1.5} />
            </Button>
          </div>

          <p className="mt-5 text-base leading-6 text-ink-2">{route.description}</p>

          {/* Provenance */}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            {route.schemaRef ? (
              <span className="inline-flex min-h-6 items-center gap-1.5 rounded-md bg-accent-z-soft px-2 py-1 font-mono text-xs whitespace-nowrap text-ink-2">
                <FileCode2 size={14} strokeWidth={1.5} className="text-ink-3" />
                schema inferred from <SourceRef fileRef={route.schemaRef} className="text-xs" />
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ go: "route", routeId: route.id })}
              className="-ml-1 px-2 text-base font-normal text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:bg-ds-gray-alpha-100 hover:text-ink focus-visible:bg-ds-gray-alpha-100"
            >
              Edit description
            </Button>
          </div>

          {params.length > 0 ? (
            <>
              <SectionCaps>Body parameters</SectionCaps>
              {params.map((p) => (
                <ParamRow key={p.name} p={p} />
              ))}
            </>
          ) : null}

          <ResponseSection route={route} />

          <p className="mt-10 text-xs text-ink-3">Generated from code</p>
        </div>

        <ExamplesColumn route={route} />
      </div>
    </div>
  );
}

/* ── Daemon-backed pages ──────────────────────────────────────────────────── */

function DaemonDoc({ pageId }: { pageId: string }) {
  const listedTitle = useStore((s) => s.docPages.find((p) => p.id === pageId)?.title);
  const pushToast = useStore((s) => s.pushToast);
  const [page, setPage] = useState<DocPageContent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setPage(null);
    setLoadError(null);
    setEditing(false);
    getClient()
      .getDocPage(pageId)
      .then((p) => {
        if (alive) setPage(p);
      })
      .catch((e: unknown) => {
        if (alive) setLoadError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, [pageId]);

  const startEdit = () => {
    setDraft(page?.content ?? "");
    setEditing(true);
  };

  const save = async () => {
    if (!page || saving) return;
    setSaving(true);
    try {
      const saved = await getClient().saveDocPage(pageId, { content: draft });
      setPage({ ...page, title: saved.title, content: draft });
      useStore.setState((s) => ({ docPages: s.docPages.map((p) => (p.id === saved.id ? saved : p)) }));
      setEditing(false);
      pushToast({ kind: "info", text: `Saved ${saved.title}` });
    } catch {
      /* the daemon's message is already toasted by the client */
    } finally {
      setSaving(false);
    }
  };

  const title = page?.title ?? listedTitle ?? pageId;

  return (
    <div className="fade-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="max-w-[680px] px-4 sm:px-7 lg:px-10 pt-7 pb-16">
        <div className="flex items-start justify-between gap-4">
          <h1 className="min-w-0 text-xl font-semibold text-ink">{title}</h1>
          {page && !editing ? (
            <GhostButton size="sm" className="mt-1 shrink-0" onClick={startEdit}>
              <Pencil size={16} strokeWidth={1.5} />
              Edit
            </GhostButton>
          ) : null}
        </div>

        {loadError ? (
          <div className="mt-5 flex h-9 items-center rounded-md bg-err-soft px-3 font-mono text-xs text-err">{loadError}</div>
        ) : null}

        {!page && !loadError ? (
          <div className="mt-5 flex items-center gap-2 text-base text-ink-3">
            <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
            reading…
          </div>
        ) : null}

        {page && editing ? (
          <div className="mt-5 animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]">
            <div className="overflow-hidden rounded-lg border border-line">
              <CodeEditor
                ariaLabel={`${title} content`}
                value={draft}
                onChange={setDraft}
                language="text"
                minHeight="320px"
                highlightVariables={false}
              />
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <GhostButton onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </GhostButton>
              <AccentButton onClick={() => void save()} disabled={saving} aria-busy={saving}>
                {saving ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : null}
                Save
              </AccentButton>
            </div>
          </div>
        ) : null}

        {page && !editing ? (
          <div className="mt-5 flex flex-col gap-4 animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]">
            {page.content.trim() !== "" ? <Markdown source={page.content} /> : null}
            {page.content.trim() === "" ? (
              <p className="text-base leading-6 text-ink-3">This page is empty — edit it to add content.</p>
            ) : null}
          </div>
        ) : null}

        <p className="mt-10 text-xs text-ink-3">Stored in .zestman/docs.json</p>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export function DocsPage() {
  const selectedDocId = useStore((s) => s.sections.docs.selectedDocId);
  const routes = useStore((s) => s.routes);
  const docPages = useStore((s) => s.docPages);

  const route = routes.find((r) => r.id === selectedDocId);
  if (route) return <EndpointDoc route={route} />;

  const pageId = docPages.some((p) => p.id === selectedDocId) ? selectedDocId : (docPages[0]?.id ?? selectedDocId);
  return <DaemonDoc key={pageId} pageId={pageId} />;
}
