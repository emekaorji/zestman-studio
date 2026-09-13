import { useEffect, type ReactNode } from "react";
import { useStore } from "@/state/store";
import {
  RAIL_MAX_W,
  RAIL_MIN_W,
  SIDEBAR_MAX_W,
  SIDEBAR_MIN_W,
} from "@/lib/metrics";
import { useLayout } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";
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
 *
 * Wide viewports put the panels beside the content. Narrow ones float them over
 * it instead — 560px of sidebar + rail leaves nothing usable on a phone or an
 * iPad in portrait. Which mode applies is purely a function of width, and an
 * overlay never writes to the collapse preferences you set on a desktop.
 */
export function Shell({ sidebarLevel2, children }: { sidebarLevel2?: ReactNode; children: ReactNode }) {
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const sidebarW = useStore((s) => s.sidebarW);
  const setSidebarW = useStore((s) => s.setSidebarW);
  const setSidebarCollapsed = useStore((s) => s.setSidebarCollapsed);
  const sidebarOverlayOpen = useStore((s) => s.sidebarOverlayOpen);
  const setSidebarOverlayOpen = useStore((s) => s.setSidebarOverlayOpen);

  const railCollapsed = useStore((s) => s.railCollapsed);
  const railW = useStore((s) => s.railW);
  const setRailW = useStore((s) => s.setRailW);
  const setRailCollapsed = useStore((s) => s.setRailCollapsed);
  const railOverlayOpen = useStore((s) => s.railOverlayOpen);
  const setRailOverlayOpen = useStore((s) => s.setRailOverlayOpen);

  const section = useStore((s) => s.section);
  const railApplies = RAIL_SECTIONS.has(section);

  const { sidebarInline, railInline, coarse } = useLayout();
  const sidebarOverlay = !sidebarInline;
  const railOverlay = !railInline;

  const sidebarShut = sidebarOverlay ? !sidebarOverlayOpen : sidebarCollapsed;
  const railShut = railOverlay ? !railOverlayOpen || !railApplies : railCollapsed || !railApplies;

  // Leaving the section the rail belongs to must not leave a sheet hanging.
  useEffect(() => {
    if (!railApplies && railOverlayOpen) setRailOverlayOpen(false);
  }, [railApplies, railOverlayOpen, setRailOverlayOpen]);

  const scrimUp = (sidebarOverlay && sidebarOverlayOpen) || (railOverlay && railOverlayOpen && railApplies);

  return (
    <div className="flex h-full flex-col bg-canvas text-ink">
      <TopNav />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <ResizablePanel
          side="left"
          label="sidebar"
          cssVar="--sidebar-w"
          size={sidebarW}
          min={SIDEBAR_MIN_W}
          max={SIDEBAR_MAX_W}
          collapsed={sidebarShut}
          overlay={sidebarOverlay}
          resizable={!sidebarOverlay && !coarse}
          onCommit={setSidebarW}
          onCollapsedChange={(v) => (sidebarOverlay ? setSidebarOverlayOpen(!v) : setSidebarCollapsed(v))}
          className="border-r border-line bg-canvas data-[collapsed]:border-transparent"
        >
          <Sidebar level2={sidebarLevel2} />
        </ResizablePanel>

        <main className="flex min-w-0 flex-1 flex-col">{children}</main>

        {/* Tapping away closes whichever sheet is open — the expected gesture. */}
        <button
          type="button"
          aria-label="Close panel"
          tabIndex={scrimUp ? 0 : -1}
          aria-hidden={!scrimUp}
          onClick={() => {
            setSidebarOverlayOpen(false);
            setRailOverlayOpen(false);
          }}
          className={cn(
            "absolute inset-0 z-30 bg-overlay",
            "[transition:opacity_var(--dur-base)_var(--ease-out)]",
            scrimUp ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        />

        {/* Always mounted: unmounting cannot animate, so a section change would
            snap the main column open. Sections without a rail just collapse it. */}
        <ResizablePanel
          side="right"
          label="panel"
          cssVar="--rail-w"
          size={railW}
          min={RAIL_MIN_W}
          max={RAIL_MAX_W}
          collapsed={railShut}
          overlay={railOverlay}
          resizable={!railOverlay && !coarse}
          onCommit={setRailW}
          onCollapsedChange={(v) => (railOverlay ? setRailOverlayOpen(!v) : setRailCollapsed(v))}
          className="border-l border-line bg-canvas data-[collapsed]:border-transparent"
        >
          <RightRail />
        </ResizablePanel>
      </div>
      <StatusBar />
    </div>
  );
}
