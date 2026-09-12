import { ChevronRight, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { Dot, MethodBadge } from "@/components/primitives";
import { IslandRow, SidebarLevel2 } from "@/components/shell/Sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Mock, Route } from "@/daemon/types";
import { cn } from "@/lib/utils";
import { useStore } from "@/state/store";

interface FileGroup {
  file: string;
  mocks: Array<{ mock: Mock; route: Route }>;
}

/** Level-2 sidebar for Mocks — mocked routes grouped by source file. */
export function MocksSidebar() {
  const mocks = useStore((s) => s.mocks);
  const routes = useStore((s) => s.routes);
  const selectedMockId = useStore((s) => s.sections.mocks.selectedMockId);
  const navigate = useStore((s) => s.navigate);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups = useMemo<FileGroup[]>(() => {
    const routeById = new Map(routes.map((r) => [r.id, r]));
    const byFile = new Map<string, FileGroup>();
    for (const mock of mocks) {
      const route = routeById.get(mock.routeId);
      if (!route) continue;
      const handler = route.sourceLocations.find((l) => l.role === "handler");
      const file = handler?.file.split(":")[0] ?? "unknown";
      const group = byFile.get(file) ?? { file, mocks: [] };
      group.mocks.push({ mock, route });
      byFile.set(file, group);
    }
    return [...byFile.values()];
  }, [mocks, routes]);

  return (
    <SidebarLevel2 title="Mocks">
      <div className="caps-label flex h-8 items-center px-5 pt-1">Mocked routes</div>
      {groups.map((g) => {
        const open = !(collapsed[g.file] ?? false);
        return (
          <Collapsible
            key={g.file}
            open={open}
            onOpenChange={(next) => setCollapsed((c) => ({ ...c, [g.file]: !next }))}
          >
            <CollapsibleTrigger
              className={cn(
                "group/file mx-2 flex h-8 w-[calc(100%-16px)] items-center gap-1.5 rounded-md px-2 text-left",
                "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
                "hover:bg-ds-gray-alpha-100 focus-visible:bg-ds-gray-alpha-100",
              )}
            >
              <ChevronRight
                size={14}
                strokeWidth={1.5}
                className={cn(
                  "shrink-0 text-ink-3",
                  "transition-transform duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
                  open && "rotate-90",
                )}
              />
              <FileText size={14} strokeWidth={1.5} className="shrink-0 text-ink-3" />
              <span className="truncate font-mono text-sm text-ink-2 group-hover/file:text-ink">
                {g.file}
              </span>
              <span className="ml-auto shrink-0 text-xs tabular-nums text-ds-gray-600">
                {g.mocks.length}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
              {g.mocks.map(({ mock, route }) => {
                const active = mock.id === selectedMockId;
                return (
                  <IslandRow
                    key={mock.id}
                    active={active}
                    onClick={() => navigate({ go: "mock", mockId: mock.id })}
                  >
                    <MethodBadge method={route.method} />
                    <span className="truncate font-mono text-sm">{route.path}</span>
                    <span className="ml-auto flex shrink-0 items-center">
                      <Dot tone={mock.enabled ? "ok" : "muted"} />
                      <span className="sr-only">{mock.enabled ? "enabled" : "disabled"}</span>
                    </span>
                  </IslandRow>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </SidebarLevel2>
  );
}
