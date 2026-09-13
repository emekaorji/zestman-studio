import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pencil, Plus, TriangleAlert } from "lucide-react";
import type { Route } from "@/daemon/types";
import type { OpenTab } from "@/state/slices/workbench";
import type { RequestTabId } from "@/state/types";
import { useStore } from "@/state/store";
import { useActiveVariables } from "@/hooks/useActiveVariables";
import { tokenizeVariables } from "@/lib/variables";
import { HTTP_METHODS, methodClass } from "@/lib/methods";
import { cn } from "@/lib/utils";
import { URL_ROW_H } from "@/lib/metrics";
import { GhostButton } from "@/components/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabStrip } from "@/components/tabstrip/TabStrip";
import { UrlInput } from "./UrlInput";
import { ParamsPanel } from "./panels/ParamsPanel";
import { AuthPanel } from "./panels/AuthPanel";
import { HeadersPanel } from "./panels/HeadersPanel";
import { BodyPanel } from "./panels/BodyPanel";
import { ScriptsPanel } from "./panels/ScriptsPanel";
import { SettingsPanel } from "./panels/SettingsPanel";
import { ResponseDrawer } from "./response/ResponseDrawer";

/** Method picker — a real Radix Select, painted with the method colours. */
function MethodSelect({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label="HTTP method"
        className={cn(
          "w-27 shrink-0 justify-between rounded-lg border-line bg-ds-gray-100 px-3 font-mono text-sm font-semibold tracking-[0.04em]",
          "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] dark:bg-ds-gray-100",
          methodClass(value),
        )}
        style={{ height: URL_ROW_H }}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="min-w-32">
        {HTTP_METHODS.map((m) => (
          <SelectItem
            key={m}
            value={m}
            className={cn("font-mono text-sm font-semibold tracking-[0.04em]", methodClass(m))}
          >
            {m}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Doc header: editable title (pencil / sidebar Rename), tags, description. */
function DocHeader({ tab, route }: { tab: OpenTab; route: Route }) {
  const patchDraft = useStore((s) => s.patchDraft);
  const updateRoute = useStore((s) => s.updateRoute);
  const titleEditRouteId = useStore((s) => s.titleEditRouteId);
  const clearTitleEdit = useStore((s) => s.clearTitleEdit);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(tab.draft.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (titleEditRouteId === route.id) {
      clearTitleEdit();
      setTitle(tab.draft.name);
      setEditing(true);
    }
  }, [titleEditRouteId, route.id, tab.draft.name, clearTitleEdit]);

  // the input mounts on the render after setEditing — focus it then
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const name = title.trim();
    if (name && name !== tab.draft.name) {
      patchDraft(tab.id, { name });
      void updateRoute(route.id, { name });
    }
  };

  return (
    <header className="shrink-0">
      <div className="flex min-h-8 items-center gap-2">
        {editing ? (
          <Input
            ref={inputRef}
            value={title}
            aria-label="Route name"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                e.stopPropagation();
                setEditing(false);
              }
            }}
            className="h-8 w-72 rounded-md border-line bg-ds-gray-100 px-2 text-md font-semibold text-ink dark:bg-ds-gray-100"
          />
        ) : (
          <h1 className="truncate text-md font-semibold text-ink">{tab.draft.name}</h1>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Rename route"
          onClick={() => {
            setTitle(tab.draft.name);
            setEditing(true);
          }}
          className="shrink-0 text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink"
        >
          <Pencil size={16} strokeWidth={1.5} />
        </Button>

        <div className="flex-1" />

        <div className="flex flex-wrap items-center justify-end gap-1.5">
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
            onClick={() => {
              const tag = `tag-${tab.draft.tags.length + 1}`;
              patchDraft(tab.id, { tags: [...tab.draft.tags, tag] });
            }}
            className="h-5 gap-1 rounded-4xl border border-line px-2 text-2xs font-normal text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink"
          >
            <Plus size={14} strokeWidth={1.5} />
            tag
          </Button>
        </div>
      </div>
      <p className="mt-1.5 truncate text-base text-ink-2">{tab.draft.description}</p>
    </header>
  );
}

export function RouteEditor({ tab, route }: { tab: OpenTab; route: Route }) {
  const patchDraft = useStore((s) => s.patchDraft);
  const setRequestTab = useStore((s) => s.setRequestTab);
  const send = useStore((s) => s.send);
  const cancelSend = useStore((s) => s.cancelSend);
  const pushDialog = useStore((s) => s.pushDialog);
  const navigate = useStore((s) => s.navigate);
  const { map: vars } = useActiveVariables();

  const unresolved = useMemo(
    () =>
      tokenizeVariables(tab.draft.url, vars)
        .filter((t) => t.type === "var" && !t.resolved)
        .map((t) => t.value),
    [tab.draft.url, vars],
  );

  const headersCount =
    tab.draft.headers.filter((h) => h.enabled).length + (tab.draft.auth.mode !== "none" ? 1 : 0);

  const tabs: Array<{ id: RequestTabId; label: string; count?: string | number; dot?: boolean }> = [
    { id: "params", label: "Params", dot: tab.draft.query.length > 0 || tab.draft.params.length > 0 },
    { id: "auth", label: "Auth" },
    { id: "headers", label: "Headers", count: headersCount },
    { id: "body", label: "Body", dot: tab.draft.body.mode !== "none" },
    { id: "scripts", label: "Scripts" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Scrolls as a whole when its fixed header (title, URL row, tabs) cannot
          fit above the drawer — a phone in landscape has ~150px here. On a tall
          screen it never overflows, so nothing changes. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-4 sm:px-6">
        <DocHeader tab={tab} route={route} />

        {/* URL row */}
        {/* Wraps below sm: a method select, a URL and a Send button will not
            fit on one phone-width line without crushing the URL. */}
        <div className="mt-4 flex h-9 shrink-0 flex-wrap items-center gap-2 max-sm:h-auto">
          <MethodSelect value={tab.draft.method} onChange={(method) => patchDraft(tab.id, { method })} />
          <div className="min-w-0 flex-1 max-sm:order-3 max-sm:basis-full">
            <UrlInput
              value={tab.draft.url}
              onChange={(url) => patchDraft(tab.id, { url })}
              onSubmit={() => void send(tab.id)}
            />
          </div>
          {tab.sending ? (
            <GhostButton onClick={() => cancelSend(tab.id)}>Cancel</GhostButton>
          ) : null}
          <Button
            type="button"
            variant="default"
            size="lg"
            disabled={tab.sending}
            aria-busy={tab.sending}
            onClick={() => void send(tab.id)}
            className="shrink-0 gap-1.5 rounded-lg px-3.5 text-base font-medium transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]"
            style={{ height: URL_ROW_H }}
          >
            {tab.sending ? (
              <>
                <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                Sending
              </>
            ) : (
              <>
                Send
                <span className="font-normal opacity-60">⌘⏎</span>
              </>
            )}
          </Button>
        </div>

        {/* request tabs */}
        <TabStrip<RequestTabId>
          label="Request sections"
          tabs={tabs}
          active={tab.requestTab}
          onSelect={(t) => setRequestTab(tab.id, t)}
          variant="request"
          className="mt-3"
          right={
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => pushDialog({ kind: "cookies" })}
              className="h-7 px-0 text-base font-normal text-link-z hover:no-underline hover:opacity-80"
            >
              Cookies
            </Button>
          }
        />

        {/* panel */}
        {/* 160px floor: without it a short screen collapses the panel to 0 and
            there is nothing to scroll down to. */}
        <div className="fade-scroll min-h-40 flex-1 overflow-y-auto pt-4 pb-6">
          <div
            key={tab.requestTab}
            className="flex min-h-0 flex-1 flex-col animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]"
          >
          {tab.requestTab === "params" ? <ParamsPanel tab={tab} /> : null}
          {tab.requestTab === "auth" ? <AuthPanel tab={tab} /> : null}
          {tab.requestTab === "headers" ? <HeadersPanel tab={tab} route={route} /> : null}
          {tab.requestTab === "body" ? <BodyPanel tab={tab} route={route} /> : null}
          {tab.requestTab === "scripts" ? <ScriptsPanel tab={tab} /> : null}
          {tab.requestTab === "settings" ? <SettingsPanel tab={tab} /> : null}
          </div>
        </div>
      </div>

      {/* unresolved variables strip */}
      {unresolved.length > 0 ? (
        <div
          role="status"
          className={cn(
            "flex h-9 shrink-0 items-center gap-2 border-t border-warn-line bg-warn-soft px-6",
            "animate-in fade-in-0 slide-in-from-bottom-1 duration-[var(--dur-base)] ease-[var(--ease-out)]",
          )}
        >
          <TriangleAlert size={16} strokeWidth={1.5} className="shrink-0 text-warn" />
          <span className="min-w-0 truncate text-base text-warn">
            Unresolved variables: {unresolved.join(", ")}
          </span>
          <div className="flex-1" />
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => navigate({ go: "environment", view: "environment" })}
            className="h-7 shrink-0 px-0 text-base font-normal text-warn hover:no-underline hover:opacity-80"
          >
            Open environment
          </Button>
        </div>
      ) : null}

      <ResponseDrawer tab={tab} route={route} />
    </div>
  );
}
