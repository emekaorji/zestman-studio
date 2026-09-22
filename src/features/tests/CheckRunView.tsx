import { CircleCheck, CircleX, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { GhostButton, Pill } from "@/components/primitives";
import { SourceRef } from "@/components/SourceRef";
import { getClient } from "@/app/client";
import type { CheckDetail, CheckType } from "@/daemon/types";
import { CodeEditor } from "@/lib/codemirror/CodeEditor";
import { prettyJson } from "@/lib/prettyBody";
import { cn } from "@/lib/utils";
import { useStore } from "@/state/store";
import { BackLink, PageBody, PageHead, SectionLabel } from "./bits";

const pretty = (body: string | undefined) => (body ? (prettyJson(body) ?? body) : "");

/** Check-run detail: what was sent, what came back, the derived assertion. */
export function CheckRunView({ routeId }: { routeId: string }) {
  const route = useStore((s) => s.routes.find((r) => r.id === routeId));
  const checks = useStore((s) => s.checks.find((c) => c.routeId === routeId));
  const navigate = useStore((s) => s.navigate);
  const runChecks = useStore((s) => s.runChecks);
  const askOperator = useStore((s) => s.askOperator);

  const failingEntry = Object.entries(checks?.cells ?? {}).find(([, cell]) => cell === "fail");
  const failing = failingEntry != null;
  const checkType = (failingEntry?.[0] ?? "responds") as CheckType;

  const [detail, setDetail] = useState<CheckDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setLoadError(null);
    getClient()
      .getCheckDetail(routeId, checkType)
      .then((d) => {
        if (alive) setDetail(d);
      })
      .catch((e: unknown) => {
        if (alive) setLoadError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, [routeId, checkType, generation]);

  if (!route) return null;

  const rerun = async () => {
    if (rerunning) return;
    setRerunning(true);
    try {
      await runChecks([routeId]);
      setGeneration((g) => g + 1);
    } catch {
      /* the daemon's message is already toasted by the client */
    } finally {
      setRerunning(false);
    }
  };

  const explain = () => {
    navigate({ go: "rail", tab: "ai", open: true });
    void askOperator(`Why is check ${checkType} failing for ${route.method} ${route.path}?`);
  };

  const statusCode = detail?.responseStatus ?? null;
  const provenance = detail?.provenance ?? route.schemaRef ?? null;

  return (
    <PageBody>
      <BackLink label="Checks" onClick={() => navigate({ go: "tests", tab: "checks" })} />

      <PageHead
        className="mt-4"
        title={`${checkType} check`}
        leading={
          failing ? (
            <CircleX size={16} strokeWidth={1.5} className="shrink-0 text-err" />
          ) : (
            <CircleCheck size={16} strokeWidth={1.5} className="shrink-0 text-ok" />
          )
        }
        actions={
          <>
            <GhostButton onClick={() => void rerun()} disabled={rerunning} aria-busy={rerunning}>
              {rerunning ? (
                <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
              ) : (
                <RefreshCw size={16} strokeWidth={1.5} />
              )}
              Re-run
            </GhostButton>
            {failing ? (
              <GhostButton onClick={explain}>
                <Sparkles size={16} strokeWidth={1.5} />
                Explain
              </GhostButton>
            ) : null}
          </>
        }
      >
        <span className="min-w-0 truncate font-mono text-sm text-ink-2">
          {route.method} {route.path}
        </span>
        <Pill tone={failing ? "err" : "ok"}>{failing ? "failing" : "passing"}</Pill>
      </PageHead>

      <div className="mt-5 flex h-9 items-center gap-1.5 rounded-md bg-ds-gray-100 px-3">
        <span className="text-base text-ink-2">assertion derived from</span>
        {provenance ? (
          <SourceRef fileRef={provenance} />
        ) : (
          <span className="truncate font-mono text-sm text-ink-3">{checkType} check · built-in</span>
        )}
        <span className="hidden text-xs text-ink-3 sm:inline">· updated when schema changes</span>
      </div>

      {loadError ? (
        <div className="mt-4 flex h-9 items-center rounded-md bg-err-soft px-3 font-mono text-xs text-err">
          {loadError}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
        <section>
          <SectionLabel>Request sent</SectionLabel>
          <CodeEditor
            ariaLabel="Request sent by this check"
            value={pretty(detail?.requestBody)}
            language="json"
            readOnly
            minHeight="136px"
            highlightVariables={false}
          />
        </section>
        <section>
          <SectionLabel>Response{statusCode != null ? ` · ${statusCode}` : ""}</SectionLabel>
          <CodeEditor
            ariaLabel="Response received by this check"
            value={pretty(detail?.responseBody)}
            language="json"
            readOnly
            minHeight="136px"
            highlightVariables={false}
          />
        </section>
      </div>

      <SectionLabel className="mt-4">Assertion</SectionLabel>
      <div className="rounded-md border border-line bg-ds-gray-100 px-3 py-2 font-mono text-sm leading-5">
        <div className="text-ink-2">{detail?.assertion ?? (detail ? "" : "…")}</div>
        <div className={cn("tabular-nums", failing ? "text-err" : "text-ok")}>{detail?.received ?? ""}</div>
      </div>
    </PageBody>
  );
}
