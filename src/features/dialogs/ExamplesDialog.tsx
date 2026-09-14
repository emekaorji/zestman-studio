import { Plus } from "lucide-react";
import { useState } from "react";
import { AccentButton, CapsHeader, Dot, GhostButton, StatusChip } from "@/components/primitives";
import { DialogFrame, DialogFooterSplit } from "@/components/dialogs/DialogFrame";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/lib/codemirror/CodeEditor";
import { useStore } from "@/state/store";
import { formatBytes, formatMs, relTime, statusText } from "@/lib/format";
import { id } from "@/lib/ids";
import { cn } from "@/lib/utils";

export function ExamplesDialog({ routeId }: { routeId: string }) {
  const route = useStore((s) => s.routes.find((r) => r.id === routeId));
  const storeExamples = useStore((s) => s.examples);
  const saveExample = useStore((s) => s.saveExample);
  const deleteExample = useStore((s) => s.deleteExample);
  const mocks = useStore((s) => s.mocks);
  const saveMock = useStore((s) => s.saveMock);
  const mockServer = useStore((s) => s.mockServer);
  const popDialog = useStore((s) => s.popDialog);
  const pushToast = useStore((s) => s.pushToast);
  const [selId, setSelId] = useState<string | null>(null);

  const list = storeExamples.filter((e) => e.routeId === routeId);
  const sel = list.find((e) => e.id === selId) ?? list[0];

  const fromLastResponse = () => {
    const s = useStore.getState();
    const tab = s.openTabs.find((t) => t.routeId === routeId && t.response != null);
    const res = tab?.response;
    if (!res) {
      pushToast({ kind: "info", text: "Send the request first — no response to save" });
      return;
    }
    const example = {
      id: id("ex"),
      routeId,
      name: `${res.status} ${statusText(res.status)}`,
      status: res.status,
      ms: res.ms,
      bytes: res.bytes,
      savedAt: Date.now(),
      body: res.body,
      usedByMock: false,
      usedBySpec: false,
    };
    void saveExample(example);
    setSelId(example.id);
  };

  /* Seed the route's mock (or create one) from the selected example. */
  const useInMock = async () => {
    if (!sel) return;
    const existing = mocks.find((m) => m.routeId === routeId);
    const stamp = Date.now().toString(36);
    const mock = existing
      ? { ...existing, statusCode: sel.status, body: sel.body }
      : {
          id: `mock_${stamp}`,
          name: sel.name,
          routeId,
          statusCode: sel.status,
          delayMs: null,
          enabled: true,
          headers: [{ id: `mh_ct_${stamp}`, key: "Content-Type", value: "application/json", description: "", enabled: true }],
          body: sel.body,
          recentHits: [],
        };
    try {
      await saveMock(mock);
      if (!sel.usedByMock) await saveExample({ ...sel, usedByMock: true });
      pushToast({ kind: "info", text: `“${sel.name}” set as mock response`, sub: mock.name });
      popDialog();
    } catch {
      /* the daemon's message is already toasted by the client */
    }
  };

  const applyToEditor = () => {
    if (!sel) return;
    const s = useStore.getState();
    s.navigate({ go: "route", routeId, requestTab: "body" });
    const s2 = useStore.getState();
    const tab = s2.openTabs.find((t) => t.id === s2.activeTabId);
    if (tab) {
      s2.patchDraft(tab.id, {
        body: { ...tab.draft.body, mode: "raw", raw: { language: "json", text: sel.body } },
      });
    }
    s2.popDialog();
  };

  return (
    <DialogFrame
      title={`Examples — ${route?.method ?? ""} ${route?.path ?? ""}`}
      width={640}
      footer={
        <DialogFooterSplit
          left={
            sel ? (
              <GhostButton
                tone="danger"
                onClick={() => {
                  void deleteExample(sel.id);
                  setSelId(null);
                }}
              >
                Delete
              </GhostButton>
            ) : undefined
          }
          right={
            <>
              <GhostButton onClick={applyToEditor} disabled={!sel}>
                Apply to editor
              </GhostButton>
              <AccentButton disabled={!sel} onClick={() => void useInMock()}>
                Use in mock
              </AccentButton>
            </>
          }
        />
      }
    >
      <div className="flex min-h-[280px] gap-4">
        {/* Saved examples — a single-select list; the selected row carries
            aria-current so a screen reader announces which one is showing. */}
        <div
          role="list"
          aria-label="Saved examples"
          className="flex w-50 shrink-0 flex-col gap-0.5"
        >
          {list.map((e, i) => {
            const active = sel?.id === e.id;
            return (
              <div role="listitem" key={e.id} style={{ animationDelay: `${Math.min(i, 8) * 25}ms` }} className="animate-in fade-in-0 fill-mode-both duration-[var(--dur-base)] ease-[var(--ease-out)]">
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => setSelId(e.id)}
                  className={cn(
                    "flex h-9 w-full items-center rounded-md px-2.5 text-left text-base",
                    "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
                    active
                      ? "bg-ds-gray-200 font-medium text-ink"
                      : "text-ink-2 hover:bg-ds-gray-100 hover:text-ink focus-visible:bg-ds-gray-100 focus-visible:text-ink",
                  )}
                >
                  <span className="truncate">{e.name}</span>
                </button>
              </div>
            );
          })}
          <Button
            variant="ghost"
            size="lg"
            onClick={fromLastResponse}
            className="mt-0.5 justify-start px-2.5 text-base font-normal text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink-2"
          >
            <Plus size={14} strokeWidth={1.5} />
            From last response
          </Button>
        </div>

        <div className="min-w-0 flex-1 border-l border-line pl-4">
          {sel ? (
            <div
              key={sel.id}
              className="animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]"
            >
              <div className="flex items-center gap-2.5">
                <StatusChip code={sel.status} label={`${sel.status} ${statusText(sel.status)}`} />
                <span className="text-xs text-ink-3">
                  {formatMs(sel.ms)} · {formatBytes(sel.bytes)} · saved {relTime(sel.savedAt)}
                </span>
              </div>
              <div className="mt-3 h-40 overflow-hidden rounded-md border border-line">
                <CodeEditor
                  ariaLabel="Example response body"
                  value={sel.body}
                  language="json"
                  readOnly
                  minHeight="160px"
                  highlightVariables={false}
                  className="h-full"
                />
              </div>
              <CapsHeader className="mt-2">Used by</CapsHeader>
              {sel.usedByMock ? (
                <div className="flex h-7 items-center gap-2">
                  <Dot tone="ok" />
                  <span className="text-base text-ink-2">
                    mock “{sel.name}”{mockServer ? ` (:${mockServer.port})` : ""}
                  </span>
                </div>
              ) : null}
              {sel.usedBySpec ? (
                <div className="flex h-7 items-center gap-2">
                  <Dot tone="ok" />
                  <span className="text-base text-ink-2">OpenAPI response example</span>
                </div>
              ) : null}
              {!sel.usedByMock && !sel.usedBySpec ? (
                <div className="flex h-7 items-center text-base text-ink-3">Not referenced yet</div>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-base text-ink-3">
              No examples saved for this route
            </div>
          )}
        </div>
      </div>
    </DialogFrame>
  );
}
