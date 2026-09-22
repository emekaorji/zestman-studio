import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { useStore } from "@/state/store";
import type { OpenTab } from "@/state/slices/workbench";
import type { Route } from "@/daemon/types";
import { cn } from "@/lib/utils";
import { DUR, EDITOR_TABS_H } from "@/lib/metrics";
import { Button } from "@/components/ui/button";
import { Dot, MethodBadge } from "@/components/primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { tabLabel } from "./lib";

/**
 * One editor tab.
 *
 * The wrapper is `role="presentation"` so the `button[role=tab]` stays a direct
 * child of the tablist for assistive tech, while the close button lives beside
 * it rather than nested inside it (nested buttons are invalid HTML). Opening
 * and closing animate the wrapper's width via a 0fr→1fr grid track, so a tab
 * grows and shrinks instead of popping in and out.
 */
function TabItem({
  tab,
  route,
  active,
  wsConnected,
  closing,
  onClose,
  onKeyDown,
}: {
  tab: OpenTab;
  route: Route;
  active: boolean;
  wsConnected: boolean;
  closing: boolean;
  onClose: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const setActiveTab = useStore((s) => s.setActiveTab);
  const isWs = route.protocol === "websocket";
  const ref = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  const open = entered && !closing;

  return (
    <div
      ref={ref}
      role="presentation"
      data-open={open}
      className={cn(
        "grid h-full shrink-0 grid-cols-[0fr] opacity-0",
        "transition-[grid-template-columns,opacity] duration-[var(--dur-base)] ease-[var(--ease-panel)]",
        "data-[open=true]:grid-cols-[1fr] data-[open=true]:opacity-100",
      )}
    >
      <div className="group/tabitem relative flex h-full min-w-0 overflow-hidden">
        <button
          type="button"
          role="tab"
          id={`editor-tab-${tab.id}`}
          aria-selected={active}
          tabIndex={active ? 0 : -1}
          data-tab-id={tab.id}
          onClick={() => setActiveTab(tab.id)}
          onKeyDown={onKeyDown}
          onAuxClick={(e) => {
            if (e.button === 1) onClose();
          }}
          className={cn(
            "group/tab relative flex h-full items-center gap-2 border-r border-line py-0 pr-9 pl-3.5",
            "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
            active
              ? "bg-canvas"
              : "border-b bg-transparent hover:bg-ds-gray-alpha-100 focus-visible:bg-ds-gray-alpha-100",
          )}
        >
          {active ? (
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-0.5 animate-in fade-in-0 bg-accent-z duration-[var(--dur-base)] ease-[var(--ease-out)]"
            />
          ) : null}
          <MethodBadge method={route.method} fixed={false} />
          <span className={cn("font-mono text-sm whitespace-nowrap", active ? "text-ink" : "text-ink-2")}>
            {tabLabel(route)}
          </span>
          {isWs && wsConnected ? (
            <Dot tone="ok" />
          ) : tab.dirty ? (
            <Dot tone="warn" />
          ) : null}
        </button>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Close ${tabLabel(route)}`}
          onClick={onClose}
          className={cn(
            "absolute top-1/2 right-2 -translate-y-1/2 text-ink-3 opacity-0",
            "transition-[opacity,color,background-color] duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
            "hover:bg-ds-gray-alpha-200 hover:text-ink",
            "group-hover/tabitem:opacity-100 focus-visible:opacity-100",
            active && "opacity-70",
          )}
        >
          <X size={14} strokeWidth={1.5} />
        </Button>
      </div>
    </div>
  );
}

export function EditorTabs() {
  const openTabs = useStore((s) => s.openTabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const routes = useStore((s) => s.routes);
  const wsConnected = useStore((s) => s.wsConnected);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const closeTab = useStore((s) => s.closeTab);
  const pushDialog = useStore((s) => s.pushDialog);

  const stripRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  /** Tabs playing their close animation; removed from the store when it ends. */
  const [closing, setClosing] = useState<string[]>([]);

  const routesById = new Map(routes.map((r) => [r.id, r]));

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    check();
    /* A tab enters at zero width and grows, so re-check while that plays out:
       observe every child, not just the (fixed-width) strip. */
    const ro = new ResizeObserver(check);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    el.addEventListener("transitionend", check);
    return () => {
      ro.disconnect();
      el.removeEventListener("transitionend", check);
    };
  }, [openTabs.length]);

  /* Let the width/opacity transition finish before the store drops the tab. */
  const requestClose = useCallback(
    (tabId: string) => {
      setClosing((prev) => (prev.includes(tabId) ? prev : [...prev, tabId]));
      window.setTimeout(() => {
        setClosing((prev) => prev.filter((t) => t !== tabId));
        closeTab(tabId);
      }, DUR.base);
    },
    [closeTab],
  );

  /* Roving tabindex across the strip: ←/→/Home/End move and activate. */
  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const ids = openTabs.map((t) => t.id);
    const i = ids.indexOf(e.currentTarget.dataset.tabId ?? "");
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? ids.length - 1
          : Math.min(ids.length - 1, Math.max(0, i + (e.key === "ArrowRight" ? 1 : -1)));
    const id = ids[next];
    if (!id) return;
    setActiveTab(id);
    stripRef.current?.querySelector<HTMLButtonElement>(`button[data-tab-id="${id}"]`)?.focus();
  };

  /* New sits right after the last tab. Once the tabs overflow it moves out of
     the scroller to the right edge, where the scroller's fade cannot dim it. */
  const newRequest = (
    <div role="presentation" className="flex shrink-0 items-center border-b border-line px-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="New request"
            onClick={() => pushDialog({ kind: "import", tab: "postman" })}
            className="text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:bg-ds-gray-alpha-200 hover:text-ink"
          >
            <Plus size={16} strokeWidth={1.5} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>New request</TooltipContent>
      </Tooltip>
    </div>
  );

  return (
    <div
      className="relative flex shrink-0 items-stretch bg-sunken"
      style={{ height: EDITOR_TABS_H }}
    >
      <div
        ref={stripRef}
        role="tablist"
        aria-label="Open requests"
        aria-orientation="horizontal"
        className="fade-scroll-x hide-scrollbar flex min-w-0 flex-1 items-stretch overflow-x-auto"
      >
        {openTabs.map((tab) => {
          const route = routesById.get(tab.routeId);
          if (!route) return null;
          return (
            <TabItem
              key={tab.id}
              tab={tab}
              route={route}
              active={tab.id === activeTabId}
              wsConnected={wsConnected}
              closing={closing.includes(tab.id)}
              onClose={() => requestClose(tab.id)}
              onKeyDown={onTabKeyDown}
            />
          );
        })}
        {overflowing ? null : newRequest}
        <div role="presentation" className="min-w-4 flex-1 border-b border-line" />
      </div>

      {overflowing ? newRequest : null}

      {overflowing ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="All open tabs"
              className={cn(
                "h-full w-9 shrink-0 rounded-none border-b border-line text-ink-3",
                "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink",
              )}
            >
              <ChevronDown size={16} strokeWidth={1.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4} className="min-w-56">
            {openTabs.map((t) => {
              const route = routesById.get(t.routeId);
              if (!route) return null;
              return (
                <DropdownMenuItem
                  key={t.id}
                  onSelect={() => setActiveTab(t.id)}
                  className="gap-2 font-mono text-sm"
                >
                  <MethodBadge method={route.method} />
                  <span className="min-w-0 truncate text-ink-2">{tabLabel(route)}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
