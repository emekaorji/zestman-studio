import type { ReactNode } from "react";
import { useStore } from "@/state/store";
import {
  RAIL_MAX_W,
  RAIL_MIN_W,
  SIDEBAR_MAX_W,
  SIDEBAR_MIN_W,
} from "@/lib/metrics";
import { TopNav } from "./TopNav";
import { Sidebar } from "./Sidebar";
import { RightRail } from "./RightRail";
import { StatusBar } from "./StatusBar";
import { ResizablePanel } from "./ResizablePanel";

/** The rail is about one open route (AI · Doc · Code · X-ray), so it only
    belongs where a route is open — the workbench. */
const RAIL_SECTIONS = new Set(["routes"]);

/**
 * THE app frame: TopNav / (Sidebar | Main | Rail) / StatusBar.
 * Sidebar and rail are drag-resizable and collapse to nothing.
 */
export function Shell({ sidebarLevel2, children }: { sidebarLevel2?: ReactNode; children: ReactNode }) {
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const sidebarW = useStore((s) => s.sidebarW);
  const setSidebarW = useStore((s) => s.setSidebarW);
  const setSidebarCollapsed = useStore((s) => s.setSidebarCollapsed);

  const railCollapsed = useStore((s) => s.railCollapsed);
  const railW = useStore((s) => s.railW);
  const setRailW = useStore((s) => s.setRailW);
  const setRailCollapsed = useStore((s) => s.setRailCollapsed);

  const section = useStore((s) => s.section);
  const railApplies = RAIL_SECTIONS.has(section);

  return (
    <div className="flex h-full flex-col bg-canvas text-ink">
      <TopNav />
      <div className="flex min-h-0 flex-1">
        <ResizablePanel
          side="left"
          label="sidebar"
          cssVar="--sidebar-w"
          size={sidebarW}
          min={SIDEBAR_MIN_W}
          max={SIDEBAR_MAX_W}
          collapsed={sidebarCollapsed}
          onCommit={setSidebarW}
          onCollapsedChange={setSidebarCollapsed}
          className="border-r border-line bg-canvas data-[collapsed]:border-transparent"
        >
          <Sidebar level2={sidebarLevel2} />
        </ResizablePanel>

        <main className="flex min-w-0 flex-1 flex-col">{children}</main>

        {/* Always mounted: unmounting cannot animate, so a section change would
            snap the main column open. Sections without a rail just collapse it. */}
        <ResizablePanel
          side="right"
          label="panel"
          cssVar="--rail-w"
          size={railW}
          min={RAIL_MIN_W}
          max={RAIL_MAX_W}
          collapsed={railCollapsed || !railApplies}
          onCommit={setRailW}
          onCollapsedChange={setRailCollapsed}
          className="border-l border-line bg-canvas data-[collapsed]:border-transparent"
        >
          <RightRail />
        </ResizablePanel>
      </div>
      <StatusBar />
    </div>
  );
}
