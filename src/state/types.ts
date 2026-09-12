/** Internal SPA navigation — no URLs. Every destination is a NavCommand. */

export type SectionId =
  | "overview"
  | "routes"
  | "docs"
  | "specs"
  | "insights"
  | "tests"
  | "mocks"
  | "history"
  | "environment";

export type RequestTabId = "params" | "auth" | "headers" | "body" | "scripts" | "settings";
export type ResponseTabId = "response" | "tests" | "timeline" | "console";
export type SpecsTab = "document" | "timeline";
export type InsightsTab = "traffic" | "coverage" | "diagnostics";
export type TestsTab = "checks" | "flows" | "schedules";
export type HistoryMode = "live" | "recorded";
export type EnvironmentView = "environment" | "globals" | "vault" | "dynamic";
export type RailTab = "ai" | "doc" | "code" | "xray";

export type DialogInstance =
  | { kind: "runner"; scope?: "all" | "selection" }
  | { kind: "import"; tab?: "postman" | "openapi" | "curl" }
  | { kind: "export" }
  | { kind: "cookies" }
  | { kind: "oauth-tokens" }
  | { kind: "examples"; routeId: string }
  | { kind: "shortcuts" }
  | { kind: "appearance" }
  | { kind: "scan-onboarding" }
  | { kind: "confirm"; title: string; body: string; confirmLabel?: string; onConfirm: () => void };

export type NavCommand =
  | { go: "section"; section: SectionId }
  | { go: "route"; routeId: string; requestTab?: RequestTabId }
  | { go: "doc"; docId: string }
  | { go: "specs"; tab: SpecsTab; diffChangeId?: string | null }
  | { go: "insights"; tab: InsightsTab }
  | { go: "tests"; tab: TestsTab; id?: string | null; create?: boolean }
  | { go: "checkRun"; checkId: string }
  | { go: "flowRun"; flowId: string }
  | { go: "reconcile" }
  | { go: "ci-setup" }
  | { go: "mock"; mockId?: string | null }
  | { go: "history"; mode: HistoryMode; day?: string | null; entryId?: string | null; filter?: "all" | "unmatched" }
  | { go: "environment"; view: EnvironmentView; envId?: string | null; bulk?: boolean }
  | { go: "dialog"; dialog: DialogInstance }
  | { go: "rail"; tab: RailTab; open?: boolean };

export interface SectionsNav {
  routes: { view: "workbench" | "reconcile" };
  docs: { selectedDocId: string };
  specs: { tab: SpecsTab; diffChangeId: string | null };
  insights: { tab: InsightsTab };
  tests: {
    tab: TestsTab;
    checkId: string | null;
    checkRun: boolean;
    ciSetup: boolean;
    flowId: string | null;
    flowRun: boolean;
    scheduleId: string | null;
    creating: boolean;
  };
  mocks: { selectedMockId: string | null };
  history: { mode: HistoryMode; day: string | null; entryId: string | null; filter: "all" | "unmatched" };
  environment: { view: EnvironmentView; envId: string | null; bulk: boolean };
}

export interface BackEntry {
  section: SectionId;
  sections: SectionsNav;
}
