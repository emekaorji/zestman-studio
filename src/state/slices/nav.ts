import type { StateCreator } from "zustand";
import type {
  BackEntry,
  DialogInstance,
  NavCommand,
  SectionId,
  SectionsNav,
} from "../types";
import type { StudioStore } from "../store";

const initialSections: SectionsNav = {
  routes: { view: "workbench" },
  docs: { selectedDocId: "introduction" },
  specs: { tab: "document", diffChangeId: null },
  insights: { tab: "traffic" },
  tests: {
    tab: "checks",
    checkId: null,
    checkRun: false,
    ciSetup: false,
    flowId: null,
    flowRun: false,
    scheduleId: null,
    creating: false,
  },
  mocks: { selectedMockId: null },
  history: { mode: "recorded", day: null, entryId: null, filter: "all" },
  environment: { view: "environment", envId: null, bulk: false },
};

export interface NavSlice {
  section: SectionId;
  sections: SectionsNav;
  dialogStack: DialogInstance[];
  paletteOpen: boolean;
  backStack: BackEntry[];

  navigate: (cmd: NavCommand) => void;
  goBack: () => void;
  pushDialog: (d: DialogInstance) => void;
  popDialog: () => void;
  setPaletteOpen: (open: boolean) => void;
  /** Esc semantics: top dialog → palette → nothing. Returns true if consumed. */
  escape: () => boolean;
}

const MAX_BACK = 20;

export const createNavSlice: StateCreator<StudioStore, [], [], NavSlice> = (set, get) => ({
  section: "overview",
  sections: initialSections,
  dialogStack: [],
  paletteOpen: false,
  backStack: [],

  navigate: (cmd) => {
    const s = get();

    if (cmd.go === "dialog") {
      s.pushDialog(cmd.dialog);
      return;
    }
    if (cmd.go === "rail") {
      s.setRailTab(cmd.tab);
      if (cmd.open !== undefined) s.setRailOpen(cmd.open);
      else s.setRailOpen(true);
      return;
    }

    const snapshot: BackEntry = { section: s.section, sections: s.sections };
    const patch = (section: SectionId, sections: Partial<SectionsNav>) => {
      set({
        // Any real navigation puts the sidebar back on the page's own level.
        sidebarRoot: false,
        section,
        sections: { ...s.sections, ...sections },
        backStack:
          section !== s.section
            ? [...s.backStack.slice(-(MAX_BACK - 1)), snapshot]
            : s.backStack,
      });
    };

    switch (cmd.go) {
      case "section":
        // Landing on Routes from elsewhere always shows the workbench, never a stale reconcile view.
        patch(cmd.section, cmd.section === "routes" ? { routes: { view: "workbench" } } : {});
        break;
      case "route":
        patch("routes", { routes: { view: "workbench" } });
        s.openRoute(cmd.routeId, cmd.requestTab);
        break;
      case "reconcile":
        patch("routes", { routes: { view: "reconcile" } });
        break;
      case "doc":
        patch("docs", { docs: { selectedDocId: cmd.docId } });
        break;
      case "specs":
        patch("specs", {
          specs: { tab: cmd.tab, diffChangeId: cmd.diffChangeId ?? null },
        });
        break;
      case "insights":
        patch("insights", { insights: { tab: cmd.tab } });
        break;
      case "tests":
        patch("tests", {
          tests: {
            ...initialSections.tests,
            tab: cmd.tab,
            checkId: cmd.tab === "checks" ? (cmd.id ?? null) : null,
            flowId: cmd.tab === "flows" ? (cmd.id ?? null) : null,
            scheduleId: cmd.tab === "schedules" ? (cmd.id ?? null) : null,
            creating: cmd.create ?? false,
          },
        });
        break;
      case "checkRun":
        patch("tests", {
          tests: { ...initialSections.tests, tab: "checks", checkId: cmd.checkId, checkRun: true },
        });
        break;
      case "flowRun":
        patch("tests", {
          tests: { ...initialSections.tests, tab: "flows", flowId: cmd.flowId, flowRun: true },
        });
        break;
      case "ci-setup":
        patch("tests", { tests: { ...initialSections.tests, tab: "checks", ciSetup: true } });
        break;
      case "mock":
        patch("mocks", { mocks: { selectedMockId: cmd.mockId ?? null } });
        break;
      case "history":
        patch("history", {
          history: {
            mode: cmd.mode,
            day: cmd.day ?? (cmd.mode === "recorded" ? get().sections.history.day : null),
            entryId: cmd.entryId ?? null,
            filter: cmd.filter ?? "all",
          },
        });
        break;
      case "environment":
        patch("environment", {
          environment: {
            view: cmd.view,
            envId: cmd.envId ?? get().sections.environment.envId,
            bulk: cmd.bulk ?? false,
          },
        });
        break;
    }
  },

  goBack: () => {
    const s = get();
    const prev = s.backStack.at(-1);
    if (!prev) return;
    set({ section: prev.section, sections: prev.sections, backStack: s.backStack.slice(0, -1) });
  },

  pushDialog: (d) => set((s) => ({ dialogStack: [...s.dialogStack, d] })),
  popDialog: () => set((s) => ({ dialogStack: s.dialogStack.slice(0, -1) })),
  setPaletteOpen: (open) => set({ paletteOpen: open }),

  escape: () => {
    const s = get();
    if (s.dialogStack.length > 0) {
      s.popDialog();
      return true;
    }
    if (s.paletteOpen) {
      s.setPaletteOpen(false);
      return true;
    }
    return false;
  },
});
