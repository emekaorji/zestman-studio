import { useStore } from "@/state/store";
import { useBaseUrl } from "@/hooks/useBaseUrl";
import { CapsHeader, EmptyState, Pill } from "@/components/primitives";
import { SourceRef } from "@/components/SourceRef";
import { Button } from "@/components/ui/button";
import { relTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buildSnippet, routeBodyJson, snippetLanguages, snippetUrl } from "./snippets";

/** Rail · Doc — mini reference of the open route (provenance-first). */
export function DocTab() {
  const routes = useStore((s) => s.routes);
  const openTabs = useStore((s) => s.openTabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const examples = useStore((s) => s.examples);
  const pushDialog = useStore((s) => s.pushDialog);
  const baseUrl = useBaseUrl();

  const tab = openTabs.find((t) => t.id === activeTabId);
  const route = routes.find((r) => r.id === tab?.routeId);
  if (!route) return <EmptyState title="Open a route to see its doc" />;

  const isWs = route.protocol === "websocket";
  const routeExamples = examples.filter((e) => e.routeId === route.id);

  // Param rows: body-schema docs first (daemon derives from Zod), else path vars, else query.
  const paramRows: Array<{ name: string; type: string }> =
    route.docFields.length > 0
      ? route.docFields.map((f) => ({ name: f.name, type: `${f.type} · ${f.required ? "req" : "opt"}` }))
      : route.params.length > 0
        ? route.params.map((p) => ({ name: p.key, type: "string · req" }))
        : route.query.map((q) => ({ name: q.key, type: "string · opt" }));

  // Response rows: what the route has actually answered with (or its OpenAPI document declares),
  // plus statuses the user saved examples for. Nothing is shown that the daemon does not know.
  const responseRows: Array<{ code: string; label: string; ok: boolean }> = (route.responses ?? []).map((r) => ({
    code: String(r.status),
    label: `· ${r.label || "—"}${routeExamples.some((e) => e.status === r.status) ? " · example ✓" : ""}`,
    ok: r.status < 400,
  }));
  for (const e of routeExamples) {
    if (!responseRows.some((r) => r.code === String(e.status))) {
      responseRows.push({ code: String(e.status), label: "· example ✓", ok: e.status < 400 });
    }
  }

  /* Example request — the same generator the Code rail uses, so the doc and the
     snippet can never drift apart. */
  const curlLines =
    buildSnippet("cURL", {
      method: route.method,
      url: snippetUrl(baseUrl, route.path),
      body: routeBodyJson(route),
      isWs,
    }) ?? [];
  const langCount = snippetLanguages(isWs).length;

  return (
    <div
      key={route.id}
      className="flex flex-col gap-3 p-3 animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]"
    >
      <div>
        <div className="text-base font-semibold text-ink">{route.name}</div>
        <div className="mt-0.5 text-xs text-ink-3">
          created {new Date(route.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · updated{" "}
          {relTime(route.updatedAt)}
        </div>
      </div>
      <p className="text-base leading-5 text-ink-2">{route.description}</p>
      {route.schemaRef ? (
        <span className="inline-flex h-5 w-fit items-center rounded-md bg-accent-z-soft px-1.5">
          <SourceRef fileRef={route.schemaRef} className="text-xs" />
        </span>
      ) : null}

      {paramRows.length > 0 ? (
        <div>
          <CapsHeader>Params</CapsHeader>
          <div className="flex flex-col">
            {paramRows.map((p, i) => (
              <div
                key={p.name}
                style={{ animationDelay: `${Math.min(i, 8) * 25}ms` }}
                className="flex h-7 items-center justify-between gap-2 animate-in fade-in-0 fill-mode-both duration-[var(--dur-base)] ease-[var(--ease-out)]"
              >
                <span className="truncate font-mono text-sm text-ink">{p.name}</span>
                <span className="shrink-0 font-mono text-xs text-ink-3">{p.type}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!isWs ? (
        <div>
          <CapsHeader>Responses</CapsHeader>
          {responseRows.map((r) => (
            <div key={r.code} className="flex h-7 items-center gap-1.5">
              <span className={cn("font-mono text-sm font-medium", r.ok ? "text-ok" : "text-err")}>
                {r.code}
              </span>
              <span className="text-base text-ink-2">{r.label}</span>
            </div>
          ))}
          {responseRows.length === 0 ? (
            <div className="flex h-7 items-center text-base text-ink-3">None seen yet — send it once</div>
          ) : null}
        </div>
      ) : null}

      <div>
        <CapsHeader
          right={
            <Button
              variant="link"
              size="xs"
              onClick={() => pushDialog({ kind: "examples", routeId: route.id })}
              className="h-5 px-0 text-xs font-normal text-link-z"
            >
              Manage
            </Button>
          }
        >
          Examples · {routeExamples.length}
        </CapsHeader>
        {routeExamples.slice(0, 1).map((e) => (
          <div key={e.id} className="flex h-7 items-center gap-1.5">
            <span className="truncate font-mono text-sm text-ok">{e.name}</span>
            <span className="shrink-0 text-base text-ink-2">example ✓</span>
          </div>
        ))}
        {routeExamples.length === 0 ? (
          <div className="flex h-7 items-center text-base text-ink-3">None saved yet</div>
        ) : null}
      </div>

      <div className="border-t border-line pt-3">
        <CapsHeader right={<Pill tone="neutral">{langCount} languages</Pill>}>
          {isWs ? "Example session" : "Example request"}
        </CapsHeader>
        <div className="fade-scroll-x overflow-x-auto rounded-md border border-line bg-sunken p-2.5">
          {curlLines.map((l, i) => (
            <div key={i} className={cn("font-mono text-sm whitespace-pre", l.c)}>
              {l.t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
