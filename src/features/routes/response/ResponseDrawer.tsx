import { useRef } from "react";
import { Bookmark, Check, ChevronUp, CircleAlert, Copy, Download, Loader2, X } from "lucide-react";
import type { ExecResult, Route } from "@/daemon/types";
import type { OpenTab } from "@/state/slices/workbench";
import type { ResponseTabId } from "@/state/types";
import { useStore } from "@/state/store";
import { GhostButton, StatusChip } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TabStrip } from "@/components/tabstrip/TabStrip";
import { CodeEditor } from "@/lib/codemirror/CodeEditor";
import { formatBytes, formatMs, relTime } from "@/lib/format";
import { id } from "@/lib/ids";
import { cn } from "@/lib/utils";
import { ResizeHandle, useResizeHandle } from "@/components/shell/ResizablePanel";
import { DRAWER_MIN_H } from "@/lib/metrics";

/** Height of the bar left behind when the drawer is tucked away. */
const COLLAPSED_BAR_H = 32;

const STAGGER_MS = 15;
const STAGGER_MAX = 12;

/** Icon action in the response header — a real button with a tooltip + label. */
function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
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
          className="text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ResponseView({ tab, route, result }: { tab: OpenTab; route: Route; result: ExecResult }) {
  const saveExample = useStore((s) => s.saveExample);
  const pushToast = useStore((s) => s.pushToast);

  return (
    <div className="flex min-h-0 flex-1 flex-col animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]">
      <div className="flex h-10 shrink-0 items-center gap-2.5 px-4">
        <StatusChip code={result.status} label={result.statusLabel} />
        <span className="text-xs tabular-nums text-ink-3">
          {formatMs(result.ms)} · {formatBytes(result.bytes)} · {relTime(result.at)}
        </span>
        <div className="flex-1" />
        <IconAction
          label="Copy response body"
          onClick={() => {
            void navigator.clipboard.writeText(result.body);
            pushToast({ kind: "info", text: "Response body copied" });
          }}
        >
          <Copy size={16} strokeWidth={1.5} />
        </IconAction>
        <IconAction
          label="Save as example"
          onClick={() => {
            void saveExample({
              id: id("ex"),
              routeId: tab.routeId,
              name: result.statusLabel,
              status: result.status,
              ms: result.ms,
              bytes: result.bytes,
              savedAt: Date.now(),
              body: result.body,
              usedByMock: false,
              usedBySpec: false,
            });
            pushToast({
              kind: "info",
              text: `Saved as example · ${result.statusLabel}`,
              sub: `${route.method} ${route.path}`,
            });
          }}
        >
          <Bookmark size={16} strokeWidth={1.5} />
        </IconAction>
        <IconAction
          label="Download response body"
          onClick={() => {
            const blob = new Blob([result.body], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "response.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download size={16} strokeWidth={1.5} />
        </IconAction>
      </div>
      <div className="fade-scroll min-h-0 flex-1 overflow-y-auto px-1">
        <CodeEditor
          ariaLabel="Response body"
          language={result.bodyKind === "json" ? "json" : "text"}
          value={result.body}
          readOnly
          highlightVariables={false}
          minHeight="0"
          className="rounded-none border-0 bg-transparent [&_.cm-lint-marker]:hidden"
        />
      </div>
    </div>
  );
}

function TestsView({ result }: { result: ExecResult }) {
  const passed = result.tests.filter((t) => t.passed).length;
  const failed = result.tests.length - passed;
  return (
    <div className="fade-scroll min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-4 animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]">
      <div className="flex h-9 items-center gap-1.5 text-xs">
        <span className="text-ok">{passed} passed</span>
        {failed > 0 ? (
          <>
            <span className="text-ink-3">·</span>
            <span className="text-err">{failed} failed</span>
          </>
        ) : null}
        <span className="text-ink-3">· {formatMs(result.ms)} total</span>
      </div>
      <ul className="flex flex-col">
        {result.tests.map((t, i) => (
          <li
            key={t.name}
            style={{ animationDelay: `${Math.min(i, STAGGER_MAX) * STAGGER_MS}ms` }}
            className="flex h-8 items-center gap-2.5 rounded-md px-1 animate-in fade-in-0 fill-mode-both transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-ds-gray-alpha-100"
          >
            {t.passed ? (
              <Check size={16} strokeWidth={1.5} className="shrink-0 text-ok" />
            ) : (
              <X size={16} strokeWidth={1.5} className="shrink-0 text-err" />
            )}
            <span className="min-w-0 truncate text-base text-ink">{t.name}</span>
            {t.error ? <span className="truncate font-mono text-xs text-err">{t.error}</span> : null}
          </li>
        ))}
      </ul>
      {result.errorMessage ? (
        <div className="mt-2 flex h-9 items-center rounded-md bg-err-soft px-3 font-mono text-xs text-err">
          post-response error · {result.errorMessage}
        </div>
      ) : null}
      {result.consoleLines.length > 0 ? (
        <>
          <div className="caps-label mt-4 mb-1">Console</div>
          {result.consoleLines.map((l, i) => (
            <div key={i} className="font-mono text-sm leading-6 text-ink-2">
              {l}
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}

function TimelineView({ result }: { result: ExecResult }) {
  const total = Math.max(
    1,
    result.timeline.reduce((a, p) => a + p.ms, 0),
  );
  let offset = 0;
  return (
    <div className="fade-scroll min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4 animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]">
      {result.timeline.map((p, i) => {
        const left = (offset / total) * 100;
        const width = Math.max(0.8, (p.ms / total) * 100);
        offset += p.ms;
        return (
          <div
            key={p.name}
            style={{ animationDelay: `${Math.min(i, STAGGER_MAX) * STAGGER_MS}ms` }}
            className="flex h-8 items-center gap-3 animate-in fade-in-0 fill-mode-both duration-[var(--dur-base)] ease-[var(--ease-out)]"
          >
            <span className="w-20 shrink-0 truncate font-mono text-xs text-ink-3">{p.name}</span>
            <div className="relative h-2 min-w-0 flex-1">
              <div
                className="absolute inset-y-0 rounded-sm bg-link-z/70 transition-[width] duration-[var(--dur-slow)] ease-[var(--ease-out)]"
                style={{ left: `${left}%`, width: `${width}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-ink-2">
              {formatMs(p.ms)}
            </span>
          </div>
        );
      })}
      <div className="mt-1 flex h-8 items-center gap-3 border-t border-line">
        <span className="w-20 shrink-0 font-mono text-xs text-ink-3">total</span>
        <div className="min-w-0 flex-1" />
        <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-ink">
          {formatMs(result.ms)}
        </span>
      </div>
    </div>
  );
}

function ConsoleView({ result }: { result: ExecResult }) {
  return (
    <div className="fade-scroll min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4 animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]">
      {result.consoleLines.length > 0 ? (
        result.consoleLines.map((l, i) => (
          <div
            key={i}
            style={{ animationDelay: `${Math.min(i, STAGGER_MAX) * STAGGER_MS}ms` }}
            className="font-mono text-sm leading-6 text-ink-2 animate-in fade-in-0 fill-mode-both duration-[var(--dur-base)] ease-[var(--ease-out)]"
          >
            {l}
          </div>
        ))
      ) : (
        <p className="pt-2 text-base text-ink-3">No console output</p>
      )}
    </div>
  );
}

function ErrorView({ tab, result }: { tab: OpenTab; result: ExecResult }) {
  const send = useStore((s) => s.send);
  const setRequestTab = useStore((s) => s.setRequestTab);
  return (
    <div className="flex min-h-0 flex-1 flex-col animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]">
      <div className="flex h-10 shrink-0 items-center px-4">
        <StatusChip code={0} label="ERR" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 pb-4">
        <CircleAlert size={20} strokeWidth={1.5} className="text-err" />
        <p className="text-base font-semibold text-ink">Could not send request</p>
        <p className="font-mono text-xs text-ink-3">{result.errorMessage ?? "connection failed"}</p>
        <div className="mt-2 flex items-center gap-3">
          <GhostButton size="sm" onClick={() => void send(tab.id)}>
            Retry
          </GhostButton>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => setRequestTab(tab.id, "settings")}
            className="h-8 px-0 text-base font-normal text-ink-2 hover:text-ink hover:no-underline"
          >
            Open settings
          </Button>
        </div>
      </div>
    </div>
  );
}

/** S2 response drawer: Response / Tests / Timeline / Console + drag-resize. */
export function ResponseDrawer({ tab, route }: { tab: OpenTab; route: Route }) {
  const setResponseTab = useStore((s) => s.setResponseTab);
  const drawerH = useStore((s) => s.drawerH);
  const setDrawerH = useStore((s) => s.setDrawerH);
  const drawerCollapsed = useStore((s) => s.drawerCollapsed);
  const setDrawerCollapsed = useStore((s) => s.setDrawerCollapsed);
  const rootRef = useRef<HTMLDivElement>(null);

  const { onPointerDown, onKeyDown } = useResizeHandle({
    cssVar: "--drawer-h",
    side: "bottom",
    size: drawerH,
    min: DRAWER_MIN_H,
    max: 720,
    collapsed: drawerCollapsed,
    onCommit: setDrawerH,
    onCollapsedChange: setDrawerCollapsed,
  });

  const result = tab.response;
  const isError = result != null && result.status === 0;
  const testCount =
    result && result.tests.length > 0
      ? `${result.tests.filter((t) => t.passed).length}/${result.tests.length}`
      : undefined;

  return (
    <div
      ref={rootRef}
      data-collapsed={drawerCollapsed || undefined}
      className="relative flex shrink-0 flex-col border-t border-line bg-canvas [transition:height_var(--dur-panel)_var(--ease-panel)] [.panel-dragging_&]:transition-none"
      style={{
        height: drawerCollapsed ? COLLAPSED_BAR_H : `var(--drawer-h)`,
        /* The request above the drawer needs ~300px (tabs, title, URL row,
           request tabs). On a short screen — a phone in landscape — the drawer
           yields that first, down to its usable minimum, instead of squeezing
           the request out of existence. Tall screens cap at 55% as before. */
        maxHeight: drawerCollapsed ? undefined : "clamp(120px, calc(100dvh - 300px), 55dvh)",
      }}
    >
      <ResizeHandle
        side="bottom"
        label="response"
        collapsed={drawerCollapsed}
        onToggle={() => setDrawerCollapsed(!drawerCollapsed)}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        size={drawerH}
        min={DRAWER_MIN_H}
        max={720}
      />

      {drawerCollapsed ? (
        /* Vercel keeps a persistent bar when a panel is tucked away, so the
           response is always one click from coming back. */
        <button
          type="button"
          onClick={() => setDrawerCollapsed(false)}
          className={cn(
            "flex w-full shrink-0 items-center gap-2.5 px-4 text-left",
            "text-ink-2 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
            "hover:bg-ds-gray-alpha-100 hover:text-ink focus-visible:bg-ds-gray-alpha-100",
          )}
          style={{ height: COLLAPSED_BAR_H }}
        >
          <ChevronUp size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
          <span className="text-base">Response</span>
          {result ? (
            <>
              <StatusChip code={result.status} label={result.statusLabel} />
              <span className="text-xs text-ink-3">
                {formatMs(result.ms)} · {formatBytes(result.bytes)}
              </span>
            </>
          ) : (
            <span className="text-xs text-ink-3">not sent yet</span>
          )}
        </button>
      ) : (
        <>
          <TabStrip<ResponseTabId>
            label="Response views"
        tabs={[
          { id: "response", label: "Response" },
          {
            id: "tests",
            label: "Tests",
            count: testCount,
            countTone:
              result && result.tests.length > 0
                ? result.tests.every((t) => t.passed)
                  ? ("ok" as const)
                  : ("err" as const)
                : undefined,
          },
          { id: "timeline", label: "Timeline" },
          { id: "console", label: "Console" },
        ]}
        active={tab.responseTab}
        onSelect={(t) => setResponseTab(tab.id, t)}
        variant="drawer"
        className="px-4"
      />

      {tab.sending ? (
        <div
          role="status"
          className={cn(
            "flex flex-1 items-center justify-center gap-2 text-base text-ink-3",
            "animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]",
          )}
        >
          <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
          Sending…
        </div>
      ) : result == null ? (
        <div className="flex flex-1 items-center justify-center text-base text-ink-3">
          Send the request to see the response
        </div>
      ) : isError ? (
        <ErrorView tab={tab} result={result} />
      ) : tab.responseTab === "tests" ? (
        <TestsView result={result} />
      ) : tab.responseTab === "timeline" ? (
        <TimelineView result={result} />
      ) : tab.responseTab === "console" ? (
        <ConsoleView result={result} />
      ) : (
        <ResponseView tab={tab} route={route} result={result} />
      )}
        </>
      )}
    </div>
  );
}
