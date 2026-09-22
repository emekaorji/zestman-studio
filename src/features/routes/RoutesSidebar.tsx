import { usePersistentState, setCodec } from "@/state/persist";
import { ChevronRight, Ellipsis, Folder, Play } from "lucide-react";
import { useStore } from "@/state/store";
import type { Route } from "@/daemon/types";
import { cn } from "@/lib/utils";
import { ROW_NAV } from "@/lib/metrics";
import { MethodBadge } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { IslandRow, SidebarLevel2 } from "@/components/shell/Sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";


/** Routes the studio owns; code-discovered ones are removed in source. */
const OWNED_PROVENANCE = new Set<Route["provenance"]>(["manual", "spec"]);

/** One route row, with its right-click menu. */
function RouteLeaf({ route, active, loose = false }: { route: Route; active: boolean; loose?: boolean }) {
  const navigate = useStore((s) => s.navigate);
  const requestTitleEdit = useStore((s) => s.requestTitleEdit);
  const createRoute = useStore((s) => s.createRoute);
  const deleteRoute = useStore((s) => s.deleteRoute);
  const pushDialog = useStore((s) => s.pushDialog);
  const pushToast = useStore((s) => s.pushToast);
  const owned = OWNED_PROVENANCE.has(route.provenance);

  const duplicate = async () => {
    const { id: _id, createdAt: _c, updatedAt: _u, sourceLocations: _s, ...rest } = route;
    try {
      const copy = await createRoute({ ...rest, name: `${route.name} copy`, provenance: "manual" });
      navigate({ go: "route", routeId: copy.id });
    } catch {
      /* the daemon's message is already toasted by the client */
    }
  };

  const confirmDelete = () => {
    pushDialog({
      kind: "confirm",
      title: "Delete route",
      body: `${route.method} ${route.path} is removed from the project. Open tabs close.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        void deleteRoute(route.id)
          .then(() => pushToast({ kind: "info", text: `Deleted ${route.method} ${route.path}` }))
          .catch(() => undefined);
      },
    });
  };

  return (
    <ContextMenu>
      {/* The trigger is a plain wrapper; the row itself stays a real button. */}
      <ContextMenuTrigger className="block">
        <IslandRow
          active={active}
          indent={!loose}
          onClick={() => navigate({ go: "route", routeId: route.id })}
          className={cn("gap-1.5 pr-2", loose ? "pl-2" : "pl-5")}
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
        <ContextMenuItem className="text-base" onSelect={() => void duplicate()}>
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
        {owned ? (
          <ContextMenuItem className="text-base text-err" onSelect={confirmDelete}>
            Delete
          </ContextMenuItem>
        ) : (
          <ContextMenuItem disabled className="flex-col items-start gap-0.5 text-base">
            Delete
            <span className="text-xs leading-snug text-ink-3">
              defined in code — remove the route in source
            </span>
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/**
 * Requests are grouped by their first tag: the tag the OpenAPI/Swagger document
 * gives an operation, or, for routes found in code, the resource the path names
 * (`/api/v1/users/:id` → `users`). Every discovery path has tags, so every
 * route lands in the tree; a file name never names anything (spec routes have
 * no file, and `index.js` says nothing about what a request does). A tag with
 * a single request is not worth a folder: that request sits at the top level.
 */
interface RouteGroup {
  id: string;
  label: string;
  routes: Route[];
}

function groupRoutes(routes: Route[]): { folders: RouteGroup[]; loose: Route[] } {
  const byTag = new Map<string, RouteGroup>();
  for (const route of routes) {
    if (route.protocol !== "http") continue;
    const label = route.tags.find((t) => t.trim())?.trim() ?? "other";
    const key = label.toLowerCase();
    let group = byTag.get(key);
    if (!group) byTag.set(key, (group = { id: `tag:${key}`, label, routes: [] }));
    group.routes.push(route);
  }
  const folders: RouteGroup[] = [];
  const loose: Route[] = [];
  for (const group of byTag.values()) {
    if (group.routes.length > 1) folders.push(group);
    else loose.push(...group.routes);
  }
  return { folders, loose };
}

/** A tag and the requests under it — a real Collapsible, so it eases. */
function TagGroup({
  group,
  activeRouteId,
  open,
  onOpenChange,
}: {
  group: RouteGroup;
  activeRouteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger
        className={cn(
          "group/tag mx-2 flex w-[calc(100%-16px)] shrink-0 items-center gap-1.5 rounded-md px-2 text-left",
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
            "group-data-[state=open]/tag:rotate-90",
          )}
        />
        <Folder size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
        <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{group.label}</span>
        <span className="shrink-0 pl-2 font-mono text-xs tabular-nums text-ink-3">{group.routes.length}</span>
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden duration-[var(--dur-slow)] ease-[var(--ease-panel)] data-open:animate-collapsible-down data-closed:animate-collapsible-up">
        <div className="flex flex-col pt-0.5 pb-1">
          {group.routes.map((route) => (
            <RouteLeaf key={route.id} route={route} active={route.id === activeRouteId} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function RoutesSidebar() {
  const routes = useStore((s) => s.routes);
  const openTabs = useStore((s) => s.openTabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const pushDialog = useStore((s) => s.pushDialog);
  const navigate = useStore((s) => s.navigate);

  const activeProjectId = useStore((st) => st.activeProjectId);
  const { folders, loose } = groupRoutes(routes);
  // First visit: the first three folders open, the rest fold — the tree stays scannable.
  const [expanded, setExpanded] = usePersistentState<Set<string>>(
    `zestman:ws:${activeProjectId}:tree:v2`,
    new Set(folders.slice(0, 3).map((g) => g.id)),
    setCodec,
  );

  const activeRouteId = openTabs.find((t) => t.id === activeTabId)?.routeId ?? null;
  const wsRoute = routes.find((r) => r.protocol === "websocket");

  const setOpen = (groupId: string, open: boolean) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(groupId);
      else next.delete(groupId);
      return next;
    });

  const options = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Routes options"
          className="text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:bg-ds-gray-alpha-200 hover:text-ink data-[state=open]:text-ink"
        >
          <Ellipsis size={16} strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-52">
        <DropdownMenuItem className="gap-2 text-base" onSelect={() => pushDialog({ kind: "runner", scope: "all" })}>
          <Play size={16} strokeWidth={1.5} className="text-ink-3" />
          Run all
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 text-base"
          disabled={!wsRoute}
          onSelect={() => wsRoute && navigate({ go: "route", routeId: wsRoute.id })}
        >
          <span className="w-4 text-center font-mono text-xs font-semibold text-method-ws">WS</span>
          WebSocket console
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <SidebarLevel2 title="Routes" action={options}>

      {/* tree */}
      <div className="flex flex-col gap-0.5 pt-2 pb-3">
        {folders.map((group) => (
          <TagGroup
            key={group.id}
            group={group}
            activeRouteId={activeRouteId}
            open={expanded.has(group.id)}
            onOpenChange={(open) => setOpen(group.id, open)}
          />
        ))}
        {loose.map((route) => (
          <RouteLeaf key={route.id} route={route} active={route.id === activeRouteId} loose />
        ))}
      </div>
    </SidebarLevel2>
  );
}
