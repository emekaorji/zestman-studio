import { ChevronDown, ChevronRight, Copy, FileCode2, Pencil } from "lucide-react";
import { useState } from "react";
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
import type { Route } from "@/daemon/types";
import { cn } from "@/lib/utils";
import { formatBytes, statusText } from "@/lib/format";
import { GhostButton, MethodBadge, SegmentedControl, StatusChip } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CodeEditor } from "@/lib/codemirror/CodeEditor";

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
      desc: `Validated by ${route.schemaRef ?? "the handler"} before the handler executes.`,
    }));
  } catch {
    return [];
  }
}

const RESPONSE_BODIES: Record<string, string> = {
  users: `{\n  "id": "usr_8f3k2",\n  "name": "Ada Lovelace",\n  "email": "ada@example.dev",\n  "role": "member",\n  "createdAt": "2026-08-30T09:41:07Z"\n}`,
  orders: `{\n  "id": "ord_2214",\n  "userId": "usr_8f3k2",\n  "status": "created",\n  "total": 118.4,\n  "createdAt": "2026-08-30T09:41:07Z"\n}`,
  posts: `{\n  "id": "pst_51ac",\n  "title": "Hello world",\n  "authorId": "usr_8f3k2",\n  "publishedAt": "2026-08-30T09:41:07Z"\n}`,
  categories: `{\n  "id": "cat_09",\n  "name": "Peripherals",\n  "slug": "peripherals"\n}`,
  products: `{\n  "id": "prd_401",\n  "sku": "ZM-401",\n  "name": "Split keyboard",\n  "price": 149\n}`,
  app: `{\n  "status": "ok",\n  "uptime": 91230\n}`,
};

const ERROR_400 = `{\n  "error": "Validation failed",\n  "issues": [\n    { "path": "email", "message": "Required" }\n  ]\n}`;

/* ── Code snippet generation ──────────────────────────────────────────────── */

type SnippetLang = "curl" | "js" | "python";

function exampleUrl(route: Route): string {
  return `http://localhost:3000${route.path.replace(":id", "8412")}`;
}

function bodyLines(route: Route, indent: string): string[] {
  if (route.body.mode !== "raw" || !route.body.raw.text) return [];
  return route.body.raw.text.split("\n").map((l, i) => (i === 0 ? l : indent + l));
}

function snippetFor(route: Route, lang: SnippetLang): string {
  const url = exampleUrl(route);
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
  body: string;
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
        <div className="mt-1 mb-2 overflow-hidden rounded-lg border border-line">
          <CodeEditor
            value={body}
            language="json"
            readOnly
            minHeight={minHeight}
            highlightVariables={false}
            ariaLabel="Example response body"
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ResponseSection({ route }: { route: Route }) {
  const examples = useStore((s) => s.examples);
  const okCode = route.method === "POST" ? 201 : route.method === "DELETE" ? 204 : 200;
  const example = examples.find((e) => e.routeId === route.id && e.status === okCode);
  const okBody = example?.body ?? RESPONSE_BODIES[route.tags[0] ?? "app"] ?? RESPONSE_BODIES.app;

  return (
    <>
      <SectionCaps>Responses</SectionCaps>
      <ResponseCase
        code={okCode}
        tone="ok"
        label={statusText(okCode)}
        note={example ? "example saved" : undefined}
        body={okBody}
        minHeight="176px"
        defaultOpen
      />
      {route.schemaRef ? (
        <ResponseCase
          code={400}
          tone="err"
          label="Validation failed"
          body={ERROR_400}
          minHeight="120px"
          defaultOpen={false}
        />
      ) : null}
    </>
  );
}

function ExamplesColumn({ route }: { route: Route }) {
  const examples = useStore((s) => s.examples);
  const [lang, setLang] = usePersistentState<SnippetLang>("zestman:ui:docs-lang:v1", "curl");
  const okCode = route.method === "POST" ? 201 : route.method === "DELETE" ? 204 : 200;

  /* The status picker offers whatever this route actually has examples for,
     plus its success code, so it can never point at a body we cannot show. */
  const routeExamples = examples.filter((e) => e.routeId === route.id);
  const statusOptions = [...new Set([String(okCode), ...routeExamples.map((e) => String(e.status))])].sort();
  const [status, setStatus] = useState(String(okCode));
  const shown = statusOptions.includes(status) ? status : String(okCode);

  const example =
    routeExamples.find((e) => String(e.status) === shown) ??
    examples.find((e) => e.routeId === route.id && e.status === okCode);
  const okBody = example?.body ?? RESPONSE_BODIES[route.tags[0] ?? "app"] ?? RESPONSE_BODIES.app;

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
            <GhostButton size="sm" aria-label="Choose response status">
              <span className="font-mono">{shown}</span>
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
      <CodeBlock>{snippetFor(route, lang)}</CodeBlock>

      <div className="mt-7 mb-2 caps-label">Example response</div>
      <div className="mb-2 flex items-center gap-2">
        <StatusChip code={Number(shown)} label={`${shown} ${statusText(Number(shown))}`} />
        <span className="font-mono text-xs text-ink-3">{formatBytes(example?.bytes ?? 1229)}</span>
      </div>
      <JsonBlock json={okBody} />

      <p className="mt-4 text-xs text-ink-3">Examples are generated from saved runs.</p>
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
                schema inferred from <span className="text-link-z">{route.schemaRef}</span>
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

          <p className="mt-10 text-xs text-ink-3">Generated from code · last scan 2 m ago</p>
        </div>

        <ExamplesColumn route={route} />
      </div>
    </div>
  );
}

/* ── Static pages ─────────────────────────────────────────────────────────── */

interface StaticPage {
  title: string;
  paragraphs: string[];
  code: string;
}

const STATIC_PAGES: Record<string, StaticPage> = {
  introduction: {
    title: "Introduction",
    paragraphs: [
      "test-backend-case-1 exposes a JSON API for users, posts, categories, products and orders. Every endpoint on this portal is generated from the Express source — routes, schemas and middleware are read directly from the code, so what you see here is what the server actually mounts.",
      "All endpoints live under http://localhost:3000 and speak application/json. Resource ids are opaque strings (usr_8f3k2, ord_2214) and timestamps are ISO 8601 in UTC.",
      "Start with the health probe to confirm the server is up:",
    ],
    code: `curl 'http://localhost:3000/health'\n\n{ "status": "ok", "uptime": 91230 }`,
  },
  authentication: {
    title: "Authentication",
    paragraphs: [
      "Write endpoints and everything under /api/v1/users and /api/v1/orders sit behind the requireAuth middleware. Requests authenticate with a bearer token in the Authorization header; unauthenticated calls receive 401 with an empty body.",
      "Tokens are issued by auth.example.dev via the OAuth 2.0 authorization-code flow with PKCE. Access tokens expire after one hour — refresh them server-side rather than persisting them in a client.",
    ],
    code: `curl 'http://localhost:3000/api/v1/users' \\\n  -H 'authorization: Bearer <access-token>'`,
  },
  errors: {
    title: "Errors",
    paragraphs: [
      "Errors use conventional status codes: 400 for validation failures, 401 for missing or expired credentials, 404 for unknown resources, and 500 for handler faults. The body is always a JSON object with a single error string, plus an issues array on validation failures.",
      "Validation runs against the Zod schema declared next to each handler before the handler executes, so a 400 always names the offending field:",
    ],
    code: `{\n  "error": "body.total is required",\n  "issues": [\n    { "path": "total", "message": "Required" }\n  ]\n}`,
  },
};

function StaticDoc({ page }: { page: StaticPage }) {
  return (
    <div className="fade-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="max-w-[680px] px-4 sm:px-7 lg:px-10 pt-7 pb-16">
        <h1 className="text-xl font-semibold text-ink">{page.title}</h1>
        <div className="mt-5 flex flex-col gap-4">
          {page.paragraphs.map((p, i) => (
            <p key={i} className="text-base leading-6 text-ink-2">
              {p}
            </p>
          ))}
        </div>
        <div className="mt-6">
          <CodeBlock>{page.code}</CodeBlock>
        </div>
        <p className="mt-10 text-xs text-ink-3">Generated from code · last scan 2 m ago</p>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export function DocsPage() {
  const selectedDocId = useStore((s) => s.sections.docs.selectedDocId);
  const routes = useStore((s) => s.routes);

  const staticPage = STATIC_PAGES[selectedDocId];
  if (staticPage) return <StaticDoc page={staticPage} />;

  const route = routes.find((r) => r.id === selectedDocId);
  if (!route) return <StaticDoc page={STATIC_PAGES.introduction} />;

  return <EndpointDoc route={route} />;
}
