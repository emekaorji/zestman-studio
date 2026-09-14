import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/state/store";
import type { Route } from "@/daemon/types";
import { IslandRow, SidebarLevel2 } from "@/components/shell/Sidebar";
import { MethodBadge } from "@/components/primitives";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/** Modules in discovery order; routes without a tag fall under "app" (shown as Other). */
function modulesOf(routes: Route[]): string[] {
  return [...new Set(routes.map((r) => r.tags[0] ?? "app"))];
}

const moduleLabel = (mod: string) => (mod === "app" ? "Other" : mod);
export const shortDocPath = (path: string) => path.replace(/^\/api\/v1/, "") || "/";

/**
 * One module in the endpoint tree. Radix Collapsible owns the disclosure —
 * so `aria-expanded` is wired for us and the panel animates its height over
 * --dur-panel instead of snapping open.
 */
function EndpointGroup({
  module,
  routes,
  expanded,
  onToggle,
  selectedDocId,
  onSelect,
}: {
  module: string;
  routes: Route[];
  expanded: boolean;
  onToggle: () => void;
  selectedDocId: string;
  onSelect: (routeId: string) => void;
}) {
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <CollapsibleTrigger
        className={cn(
          "group/mod mx-2 flex h-8 w-[calc(100%-16px)] items-center gap-1.5 rounded-md px-3 text-left",
          "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
          "hover:bg-ds-gray-alpha-100 focus-visible:bg-ds-gray-alpha-100",
        )}
      >
        <ChevronRight
          size={14}
          strokeWidth={1.5}
          className={cn(
            "shrink-0 text-ink-3 transition-transform duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
            expanded && "rotate-90",
          )}
        />
        <span className="caps-label min-w-0 flex-1 truncate">{moduleLabel(module)}</span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-ink-3">{routes.length}</span>
      </CollapsibleTrigger>
      <CollapsibleContent
        className={cn(
          "overflow-hidden duration-[var(--dur-panel)] ease-[var(--ease-panel)]",
          "data-open:animate-collapsible-down data-closed:animate-collapsible-up",
        )}
      >
        <div className="flex flex-col gap-0.5 pt-0.5 pb-1">
          {routes.map((r) => (
            <IslandRow
              key={r.id}
              className="h-10"
              active={selectedDocId === r.id}
              onClick={() => onSelect(r.id)}
            >
              <MethodBadge method={r.method} />
              <span className="min-w-0 flex-1 truncate font-mono text-sm">{shortDocPath(r.path)}</span>
            </IslandRow>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DocsSidebar() {
  const docPages = useStore((s) => s.docPages);
  const routes = useStore((s) => s.routes);
  const selectedDocId = useStore((s) => s.sections.docs.selectedDocId);
  const navigate = useStore((s) => s.navigate);
  const pages = docPages.filter((p) => p.kind === "page");
  const httpRoutes = routes.filter((r) => r.protocol === "http");
  const modules = modulesOf(httpRoutes);
  // First visit: the first two modules open so the tree reads as a tree, not a wall.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(modules.slice(0, 2)));

  const toggle = (mod: string) =>
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(mod)) next.delete(mod);
      else next.add(mod);
      return next;
    });

  return (
    <SidebarLevel2 title="Docs">
      <div className="flex flex-col gap-0.5 pt-1">
        {pages.map((p) => (
          <IslandRow
            key={p.id}
            className="h-10"
            active={selectedDocId === p.id}
            onClick={() => navigate({ go: "doc", docId: p.id })}
          >
            <span className="min-w-0 flex-1 truncate">{p.title}</span>
          </IslandRow>
        ))}
      </div>

      <div className="mt-5 flex h-8 items-center px-5">
        <span className="caps-label">Endpoints</span>
      </div>

      <div className="flex flex-col gap-0.5 pb-4">
        {modules.map((mod) => {
          const modRoutes = httpRoutes.filter((r) => (r.tags[0] ?? "app") === mod);
          if (modRoutes.length === 0) return null;
          return (
            <EndpointGroup
              key={mod}
              module={mod}
              routes={modRoutes}
              expanded={expanded.has(mod)}
              onToggle={() => toggle(mod)}
              selectedDocId={selectedDocId}
              onSelect={(routeId) => navigate({ go: "doc", docId: routeId })}
            />
          );
        })}
      </div>
    </SidebarLevel2>
  );
}
