import type { ComponentType, ReactNode } from "react";
import { useStore } from "@/state/store";
import type { SectionId } from "@/state/types";
import { Shell } from "@/components/shell/Shell";
import { useGlobalKeyboard } from "./keyboard";

import { OverviewPage } from "@/features/overview/OverviewPage";
import { WorkbenchPage } from "@/features/routes/WorkbenchPage";
import { RoutesSidebar } from "@/features/routes/RoutesSidebar";
import { DocsPage } from "@/features/docs/DocsPage";
import { DocsSidebar } from "@/features/docs/DocsSidebar";
import { SpecsPage } from "@/features/specs/SpecsPage";
import { InsightsPage } from "@/features/insights/InsightsPage";
import { TestsPage } from "@/features/tests/TestsPage";
import { TestsSidebar } from "@/features/tests/TestsSidebar";
import { MocksPage } from "@/features/mocks/MocksPage";
import { MocksSidebar } from "@/features/mocks/MocksSidebar";
import { HistoryPage } from "@/features/history/HistoryPage";
import { HistorySidebar } from "@/features/history/HistorySidebar";
import { EnvironmentPage } from "@/features/environment/EnvironmentPage";
import { EnvironmentSidebar } from "@/features/environment/EnvironmentSidebar";
import { DialogHost } from "@/features/dialogs/DialogHost";
import { CommandPalette } from "@/features/dialogs/CommandPalette";
import { ToastHost } from "@/features/dialogs/ToastHost";
import { ConnectScreen } from "@/features/connect/ConnectScreen";
import { WaitingScreen } from "@/features/connect/WaitingScreen";
import { TooltipProvider } from "@/components/ui/tooltip";

const PAGES: Record<SectionId, ComponentType> = {
  overview: OverviewPage,
  routes: WorkbenchPage,
  docs: DocsPage,
  specs: SpecsPage,
  insights: InsightsPage,
  tests: TestsPage,
  mocks: MocksPage,
  history: HistoryPage,
  environment: EnvironmentPage,
};

const SIDEBARS: Partial<Record<SectionId, ComponentType>> = {
  routes: RoutesSidebar,
  docs: DocsSidebar,
  tests: TestsSidebar,
  mocks: MocksSidebar,
  history: HistorySidebar,
  environment: EnvironmentSidebar,
};

function MainViewport() {
  const section = useStore((s) => s.section);
  const Page = PAGES[section];
  // Keyed so React remounts on a section change and the enter animation runs;
  // without the key it reuses the element and every section swap is a hard cut.
  return (
    <div
      key={section}
      className="flex min-h-0 flex-1 flex-col animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]"
    >
      <Page />
    </div>
  );
}

function SectionSidebar(): ReactNode {
  const section = useStore((s) => s.section);
  const SidebarL2 = SIDEBARS[section];
  return SidebarL2 ? <SidebarL2 /> : undefined;
}

export function App() {
  const connState = useStore((s) => s.connState);
  const knownProjects = useStore((s) => s.knownProjects);
  const loaded = useStore((s) => s.loaded);
  useGlobalKeyboard();

  if (connState !== "connected") {
    // Projects we have seen before still belong here: the studio shows them and
    // waits for the app, instead of asking for a link it already had.
    const waiting = knownProjects.length > 0 && connState !== "unauthorized";
    return (
      <div className="relative h-full">
        {waiting ? <WaitingScreen /> : <ConnectScreen />}
        <ToastHost />
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center bg-canvas">
        <span className="animate-in fade-in-0 text-base text-ink-3 duration-500">
          Zestman — connecting…
        </span>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={300}>
      <div className="relative h-full">
        <Shell sidebarLevel2={<SectionSidebar />}>
          <MainViewport />
        </Shell>
        <DialogHost />
        <CommandPalette />
        <ToastHost />
      </div>
    </TooltipProvider>
  );
}
