import { usePersistentState, setCodec } from "@/state/persist";
import { ChevronRight, FileText, Play, Plus } from "lucide-react";
import { useStore } from "@/state/store";
import type { Route, SourceFile } from "@/daemon/types";
import { cn } from "@/lib/utils";
import { ROW_NAV } from "@/lib/metrics";
import { GhostButton, MethodBadge } from "@/components/primitives";
import { IslandRow, SidebarLevel2 } from "@/components/shell/Sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const DEFAULT_EXPANDED = ["f_users.controller.ts", "f_orders.controller.ts", "f_app.ts"];

/** One route row, with its right-click menu. */
function RouteLeaf({ route, active }: { route: Route; active: boolean }) {
  const navigate = useStore((s) => s.navigate);
  const requestTitleEdit = useStore((s) => s.requestTitleEdit);
  const pushToast = useStore((s) => s.pushToast);

  return (
    <ContextMenu>
      {/* The trigger is a plain wrapper; the row itself stays a real button. */}
      <ContextMenuTrigger className="block">
        <IslandRow
          active={active}
          indent
          onClick={() => navigate({ go: "route", routeId: route.id })}
          className="gap-1.5 pr-2 pl-5"
        >
          <MethodBadge method={route.method} className="w-10" />
          <span className={cn("truncate font-mono text-sm", active ? "text-ink" : "text-ink-2")}>
            {route.path}
          </span>
        </IslandRow>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        <ContextMenuItem className="text-base" onSelect={() => navigate({ go: "route", routeId: route.id })}>
          Open
        </ContextMenuItem>
        <ContextMenuItem
          className="text-base"
          onSelect={() =>
            pushToast({
              kind: "info",
              text: "Duplicate needs the local daemon",
              sub: "route files are owned by your source tree",
            })
          }
        >
          Duplicate
        </ContextMenuItem>
        <ContextMenuItem
          className="text-base"
          onSelect={() => {
            navigate({ go: "route", routeId: route.id });
            requestTitleEdit(route.id);
          }}
        >
          Rename
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled className="flex-col items-start gap-0.5 text-base">
          Delete
          <span className="text-xs leading-snug text-ink-3">
            defined in code — remove the route in source
          </span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** A source file and the routes it declares — a real Collapsible, so it eases. */
function FileGroup({
  file,
  routes,
  activeRouteId,
  open,
  onOpenChange,
}: {
  file: SourceFile;
  routes: Route[];
  activeRouteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger
        className={cn(
          "group/file mx-2 flex w-[calc(100%-16px)] shrink-0 items-center gap-1.5 rounded-md px-2 text-left",
          "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
          "hover:bg-ds-gray-alpha-100 focus-visible:bg-ds-gray-alpha-100",
        )}
        style={{ height: ROW_NAV - 4 }}
      >
        <ChevronRight
          size={16}
          strokeWidth={1.5}
          aria-hidden
          className={cn(
            "shrink-0 text-ink-3 transition-transform duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
            "group-data-[state=open]/file:rotate-90",
          )}
        />
        <FileText size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
        <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink-2">{file.shortName}</span>
        <span className="shrink-0 pl-2 font-mono text-xs tabular-nums text-ink-3">{routes.length}</span>
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden duration-[var(--dur-slow)] ease-[var(--ease-panel)] data-open:animate-collapsible-down data-closed:animate-collapsible-up">
        <div className="flex flex-col pt-0.5 pb-1">
          {routes.map((route) => (
            <RouteLeaf key={route.id} route={route} active={route.id === activeRouteId} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function RoutesSidebar() {
  const files = useStore((s) => s.files);
  const routes = useStore((s) => s.routes);
  const openTabs = useStore((s) => s.openTabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const pushDialog = useStore((s) => s.pushDialog);
  const navigate = useStore((s) => s.navigate);

  const activeProjectId = useStore((st) => st.activeProjectId);
  const [expanded, setExpanded] = usePersistentState<Set<string>>(
    `zestman:ws:${activeProjectId}:tree:v1`,
    new Set(DEFAULT_EXPANDED),
    setCodec,
  );

  const activeRouteId = openTabs.find((t) => t.id === activeTabId)?.routeId ?? null;
  const byId = new Map(routes.map((r) => [r.id, r]));
  const wsRoute = routes.find((r) => r.protocol === "websocket");

  const setOpen = (fileId: string, open: boolean) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(fileId);
      else next.delete(fileId);
      return next;
    });

  const httpRoutesOf = (file: SourceFile): Route[] =>
    file.routeIds
      .map((id) => byId.get(id))
      .filter((r): r is Route => r != null && r.protocol === "http");

  return (
    <SidebarLevel2 title="Routes">
      {/* actions row */}
      <div className="flex h-9 shrink-0 items-center gap-1.5 px-2">
        <GhostButton size="sm" onClick={() => pushDialog({ kind: "import", tab: "postman" })}>
          <Plus size={16} strokeWidth={1.5} />
          New
        </GhostButton>
        <GhostButton
          size="sm"
          aria-label="Open the WebSocket console"
          className="font-mono font-semibold text-method-ws"
          onClick={() => wsRoute && navigate({ go: "route", routeId: wsRoute.id })}
        >
          WS
        </GhostButton>
        <div className="flex-1" />
        <GhostButton size="sm" onClick={() => pushDialog({ kind: "runner", scope: "all" })}>
          <Play size={16} strokeWidth={1.5} className="text-ink-2" />
          Run all
        </GhostButton>
      </div>

      {/* tree */}
      <div className="flex flex-col gap-0.5 pt-2 pb-3">
        {files.map((file) => (
          <FileGroup
            key={file.id}
            file={file}
            routes={httpRoutesOf(file)}
            activeRouteId={activeRouteId}
            open={expanded.has(file.id)}
            onOpenChange={(open) => setOpen(file.id, open)}
          />
        ))}
      </div>
    </SidebarLevel2>
  );
}
