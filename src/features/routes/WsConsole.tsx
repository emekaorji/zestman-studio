import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Info, Plus, RadioTower } from "lucide-react";
import type { Route } from "@/daemon/types";
import type { OpenTab } from "@/state/slices/workbench";
import type { WsMessage } from "@/state/slices/misc";
import { useStore } from "@/state/store";
import { Dot, EmptyState, GhostButton, SegmentedControl } from "@/components/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clockTime } from "@/lib/format";
import { URL_ROW_H } from "@/lib/metrics";
import { cn } from "@/lib/utils";

const STAGGER_MS = 15;
const STAGGER_MAX = 12;

function MessageRow({ m, index }: { m: WsMessage; index: number }) {
  return (
    <li
      style={{ animationDelay: `${Math.min(index, STAGGER_MAX) * STAGGER_MS}ms` }}
      className={cn(
        "flex h-7 shrink-0 items-center gap-2 rounded-md px-1 font-mono text-sm",
        "animate-in fade-in-0 fill-mode-both duration-[var(--dur-base)] ease-[var(--ease-out)]",
        "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:bg-ds-gray-alpha-100",
      )}
    >
      {m.kind === "system" ? <Info size={14} strokeWidth={1.5} className="shrink-0 text-ink-3" /> : null}
      {m.kind === "sent" ? <ArrowUp size={14} strokeWidth={1.5} className="shrink-0 text-link-z" /> : null}
      {m.kind === "recv" || m.kind === "binary" ? (
        <ArrowDown size={14} strokeWidth={1.5} className="shrink-0 text-ok" />
      ) : null}
      {m.kind === "binary" ? (
        <span className="inline-flex h-5 items-center rounded-md bg-ds-gray-alpha-200 px-1.5 text-xs text-ink-2">
          {m.text}
        </span>
      ) : (
        <span className={cn("truncate", m.kind === "system" ? "text-ink-3" : "text-ink")}>{m.text}</span>
      )}
      <span className="ml-auto shrink-0 pl-3 font-mono text-xs tabular-nums text-ink-3">{clockTime(m.at)}</span>
    </li>
  );
}

/** WebSocket console — replaces the HTTP editor for WS tabs. */
export function WsConsole({ tab, route }: { tab: OpenTab; route: Route }) {
  const wsConnected = useStore((s) => s.wsConnected);
  const wsMessages = useStore((s) => s.wsMessages);
  const wsStartedAt = useStore((s) => s.wsStartedAt);
  const wsConnect = useStore((s) => s.wsConnect);
  const wsDisconnect = useStore((s) => s.wsDisconnect);
  const wsSend = useStore((s) => s.wsSend);
  const patchDraft = useStore((s) => s.patchDraft);

  const [mode, setMode] = useState<"text" | "binary">("text");
  const [message, setMessage] = useState("");
  const [, forceTick] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  // tick the "Ns" duration once a second while connected
  useEffect(() => {
    if (!wsConnected) return;
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [wsConnected]);

  // keep the log pinned to the latest message
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [wsMessages.length]);

  const duration = wsStartedAt != null ? Math.max(0, Math.round((Date.now() - wsStartedAt) / 1000)) : 0;

  const submit = () => {
    const text = message.trim();
    if (!text || !wsConnected) return;
    wsSend(mode === "binary" ? `binary · ${text}` : text);
    setMessage("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col px-6 pt-4 pb-4">
      {/* doc header */}
      <header className="flex shrink-0 items-center gap-2">
        <h1 className="truncate text-md font-semibold text-ink">{tab.draft.name}</h1>
        <div className="flex-1" />
        <Badge variant="outline" className="border-line text-2xs font-normal text-ink-2">
          ws
        </Badge>
        {tab.draft.tags.map((t) => (
          <Badge
            key={t}
            variant="outline"
            className="animate-in fade-in-0 zoom-in-95 border-line text-2xs font-normal text-ink-2 duration-[var(--dur-base)] ease-[var(--ease-out)]"
          >
            {t}
          </Badge>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label="Add tag"
          onClick={() => patchDraft(tab.id, { tags: [...tab.draft.tags, `tag-${tab.draft.tags.length + 1}`] })}
          className="h-5 gap-1 rounded-4xl border border-line px-2 text-2xs font-normal text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink"
        >
          <Plus size={14} strokeWidth={1.5} />
          tag
        </Button>
      </header>
      <p className="mt-1.5 shrink-0 truncate text-base text-ink-2">{tab.draft.description}</p>

      {/* URL row */}
      <div className="mt-4 flex shrink-0 items-center gap-2" style={{ height: URL_ROW_H }}>
        <span
          className="flex w-27 shrink-0 items-center rounded-lg border border-line bg-ds-gray-100 px-3 font-mono text-sm font-semibold tracking-[0.04em] text-method-ws"
          style={{ height: URL_ROW_H }}
        >
          WS
        </span>
        <span
          className="flex min-w-0 flex-1 items-center truncate rounded-lg border border-line bg-ds-gray-100 px-3 font-mono text-sm text-ink"
          style={{ height: URL_ROW_H }}
        >
          {route.path}
        </span>
        {wsConnected ? (
          <GhostButton onClick={wsDisconnect}>Disconnect</GhostButton>
        ) : (
          <Button
            type="button"
            size="lg"
            onClick={() => void wsConnect(route.id)}
            className="shrink-0 rounded-lg px-3.5 text-base font-medium transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]"
            style={{ height: URL_ROW_H }}
          >
            Connect
          </Button>
        )}
      </div>

      {/* status strip */}
      <div role="status" className="flex h-9 shrink-0 items-center gap-2">
        {wsConnected ? (
          <>
            <Dot tone="ok" />
            <span className="text-xs text-ink-3">
              connected · {duration} s · {wsMessages.length} messages · 28 ms ping
            </span>
          </>
        ) : (
          <>
            <span aria-hidden className="size-1.5 shrink-0 rounded-full border border-line-strong" />
            <span className="text-xs text-ink-3">disconnected</span>
          </>
        )}
      </div>

      {/* message log */}
      <div
        ref={logRef}
        className="fade-scroll mt-1 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-lg border border-line bg-ds-gray-100 p-2"
      >
        {wsMessages.length === 0 ? (
          <EmptyState icon={<RadioTower size={28} strokeWidth={1.5} />} title="Connect to start a session" />
        ) : (
          <ul aria-label="Message log" className="flex flex-col">
            {wsMessages.map((m, i) => (
              <MessageRow key={m.id} m={m} index={i} />
            ))}
          </ul>
        )}
      </div>

      {/* composer */}
      <div className="mt-3 flex shrink-0 items-center gap-2" style={{ height: URL_ROW_H }}>
        <SegmentedControl<"text" | "binary">
          options={[
            { value: "text", label: "Text" },
            { value: "binary", label: "Binary" },
          ]}
          value={mode}
          onChange={setMode}
          className="shrink-0"
        />
        <Input
          value={message}
          disabled={!wsConnected}
          aria-label="Message to send"
          placeholder={wsConnected ? "Type a message — ⏎ to send" : "Connect first"}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border-line bg-ds-gray-100 px-3 text-base transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] dark:bg-ds-gray-100"
          style={{ height: URL_ROW_H }}
        />
        <Button
          type="button"
          size="lg"
          disabled={!wsConnected || message.trim().length === 0}
          onClick={submit}
          className="shrink-0 rounded-lg px-3.5 text-base font-medium transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]"
          style={{ height: URL_ROW_H }}
        >
          Send
        </Button>
      </div>
    </div>
  );
}
