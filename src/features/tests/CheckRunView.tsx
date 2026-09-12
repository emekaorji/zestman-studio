import { CircleCheck, CircleX, RefreshCw, Sparkles } from "lucide-react";
import { GhostButton, Pill } from "@/components/primitives";
import { CodeEditor } from "@/lib/codemirror/CodeEditor";
import { cn } from "@/lib/utils";
import { useStore } from "@/state/store";
import { BackLink, PageBody, PageHead, SectionLabel } from "./bits";

const REQUEST_SENT = `{
  "reason": "customer_request",
  "items": 2,
  "refund": "original_method",
  "notify": true
}`;

const RESPONSE_500 = `{
  "error": "body.total is required",
  "code": "SCHEMA_VALIDATION"
}`;

const RESPONSE_200 = `{
  "status": "ok"
}`;

/** Check-run detail: what was sent, what came back, the derived assertion. */
export function CheckRunView({ routeId }: { routeId: string }) {
  const route = useStore((s) => s.routes.find((r) => r.id === routeId));
  const checks = useStore((s) => s.checks.find((c) => c.routeId === routeId));
  const navigate = useStore((s) => s.navigate);
  const pushToast = useStore((s) => s.pushToast);
  if (!route) return null;

  const failingEntry = Object.entries(checks?.cells ?? {}).find(([, cell]) => cell === "fail");
  const failing = failingEntry != null;
  const checkType = failingEntry?.[0] ?? "responds";

  // Failing canon = the cancel-order 500; passing runs show the route's own body + 200.
  const requestSent = failing
    ? REQUEST_SENT
    : route.body.mode === "raw" && route.body.raw.text.trim()
      ? route.body.raw.text
      : `{}`;
  const responseText = failing ? RESPONSE_500 : RESPONSE_200;
  const statusCode = failing ? 500 : 200;
  const schemaSource = failing ? "orders.schema.ts:18" : (route.schemaRef ?? "responds check · built-in");

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
            <GhostButton
              onClick={() =>
                pushToast({
                  kind: "info",
                  text: "Check re-ran",
                  sub: failing ? "still failing · 500" : "still passing · 200",
                })
              }
            >
              <RefreshCw size={16} strokeWidth={1.5} />
              Re-run
            </GhostButton>
            {failing ? (
              <GhostButton
                onClick={() =>
                  pushToast({
                    kind: "operator",
                    text: "orders.schema.ts now requires body.total",
                    sub: "the request sent has no total — add it, or relax the schema",
                  })
                }
              >
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
        <span className="truncate font-mono text-sm text-link-z">{schemaSource}</span>
        <span className="hidden text-xs text-ink-3 sm:inline">· updated when schema changes</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
        <section>
          <SectionLabel>Request sent</SectionLabel>
          <CodeEditor
            ariaLabel="Request sent by this check"
            value={requestSent}
            language="json"
            readOnly
            minHeight="136px"
            highlightVariables={false}
          />
        </section>
        <section>
          <SectionLabel>Response · {statusCode}</SectionLabel>
          <CodeEditor
            ariaLabel="Response received by this check"
            value={responseText}
            language="json"
            readOnly
            minHeight="136px"
            highlightVariables={false}
          />
        </section>
      </div>

      <SectionLabel className="mt-4">Assertion</SectionLabel>
      <div className="rounded-md border border-line bg-ds-gray-100 px-3 py-2 font-mono text-sm leading-5">
        <div className="text-ink-2">
          {failing ? "expect(status).toBeOneOf([201, 400])" : "expect(status).toBeOneOf([200])"}
        </div>
        <div className={cn("tabular-nums", failing ? "text-err" : "text-ok")}>
          received: {statusCode}
        </div>
      </div>
    </PageBody>
  );
}
