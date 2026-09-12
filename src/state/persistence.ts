import type { StudioStore } from "./store";
import type { SectionsNav, SectionId } from "./types";
import type { OpenTab } from "./slices/workbench";
import type { ThemeId } from "./slices/session";
import type { RailTab } from "./types";
import { UI_KEY, readKey, writeKey, wsKey } from "./persist";
import { DRAWER_H, RAIL_W, SIDEBAR_W } from "@/lib/metrics";

/* ── Group A: chrome + preferences, global ───────────────────────────────── */

export interface UiPersisted {
  theme: ThemeId;
  sidebarCollapsed: boolean;
  sidebarW: number;
  railCollapsed: boolean;
  railW: number;
  drawerCollapsed: boolean;
  drawerH: number;
  railTab: RailTab;
  railCodeLang: string;
  railResolveVars: boolean;
  runnerIterations: number;
  onboarded: boolean;
  activeProjectId: string;
}

const UI_DEFAULTS: UiPersisted = {
  theme: "graphite",
  sidebarCollapsed: false,
  sidebarW: SIDEBAR_W,
  railCollapsed: false,
  railW: RAIL_W,
  drawerCollapsed: false,
  drawerH: DRAWER_H,
  railTab: "doc",
  railCodeLang: "TypeScript",
  railResolveVars: false,
  runnerIterations: 3,
  onboarded: false,
  activeProjectId: "case1",
};

export function loadUi(): UiPersisted {
  const ui = readKey<UiPersisted>(UI_KEY, UI_DEFAULTS);
  // A corrupted or hand-edited width must not produce an unusable panel.
  return {
    ...ui,
    sidebarW: clamp(ui.sidebarW, 160, 640, SIDEBAR_W),
    railW: clamp(ui.railW, 200, 720, RAIL_W),
    drawerH: clamp(ui.drawerH, 100, 900, DRAWER_H),
    theme: ui.theme === "paper" ? "paper" : "graphite",
  };
}

function clamp(v: unknown, min: number, max: number, fallback: number) {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

function pickUi(s: StudioStore): UiPersisted {
  return {
    theme: s.theme,
    sidebarCollapsed: s.sidebarCollapsed,
    sidebarW: s.sidebarW,
    railCollapsed: s.railCollapsed,
    railW: s.railW,
    drawerCollapsed: s.drawerCollapsed,
    drawerH: s.drawerH,
    railTab: s.railTab,
    railCodeLang: s.railCodeLang,
    railResolveVars: s.railResolveVars,
    runnerIterations: s.runnerIterations,
    onboarded: s.onboarded,
    activeProjectId: s.activeProjectId,
  };
}

/* ── Group B: workspace position, per project ────────────────────────────── */

/** A tab as stored: the draft is kept, the response and in-flight flags are not. */
interface StoredTab {
  id: string;
  routeId: string;
  requestTab: OpenTab["requestTab"];
  responseTab: OpenTab["responseTab"];
  draft: OpenTab["draft"];
  dirty: boolean;
}

export interface WorkspacePersisted {
  section: SectionId;
  sections: SectionsNav | null;
  openTabs: StoredTab[];
  activeTabId: string | null;
}

const WS_DEFAULTS: WorkspacePersisted = {
  section: "overview",
  sections: null,
  openTabs: [],
  activeTabId: null,
};

export function loadWorkspace(projectId: string): WorkspacePersisted {
  return readKey<WorkspacePersisted>(wsKey(projectId), WS_DEFAULTS);
}

function pickWorkspace(s: StudioStore): WorkspacePersisted {
  return {
    section: s.section,
    sections: s.sections,
    openTabs: s.openTabs.map((t) => ({
      id: t.id,
      routeId: t.routeId,
      requestTab: t.requestTab,
      responseTab: t.responseTab,
      draft: t.draft,
      dirty: t.dirty,
    })),
    activeTabId: s.activeTabId,
  };
}

/**
 * Rehydrate the workspace once routes are known, so tabs pointing at routes the
 * scan no longer finds are dropped rather than rendering an empty editor.
 */
export function restoreWorkspace(
  saved: WorkspacePersisted,
  knownRouteIds: Set<string>,
): Partial<StudioStore> {
  const openTabs: OpenTab[] = saved.openTabs
    .filter((t) => knownRouteIds.has(t.routeId))
    .map((t) => ({ ...t, sending: false, response: null }));

  const activeTabId = openTabs.some((t) => t.id === saved.activeTabId)
    ? saved.activeTabId
    : (openTabs.at(-1)?.id ?? null);

  const patch: Partial<StudioStore> = { openTabs, activeTabId };
  if (saved.sections) patch.sections = saved.sections;
  if (saved.section) patch.section = saved.section;
  return patch;
}

/* ── Wiring ──────────────────────────────────────────────────────────────── */

let lastUi = "";
let lastWs = "";

/**
 * Subscribe the store to localStorage. Writes are shallow-compared first, so a
 * live-tap tick or a keystroke in an unrelated field does not hit disk.
 */
export function attachPersistence(store: {
  getState: () => StudioStore;
  subscribe: (fn: (s: StudioStore) => void) => () => void;
}) {
  lastUi = JSON.stringify(pickUi(store.getState()));
  lastWs = JSON.stringify(pickWorkspace(store.getState()));

  return store.subscribe((s) => {
    const ui = JSON.stringify(pickUi(s));
    if (ui !== lastUi) {
      lastUi = ui;
      writeKey(UI_KEY, JSON.parse(ui));
    }

    // Only persist a workspace once its data has loaded, or a mid-boot empty
    // state would overwrite the saved one.
    if (!s.loaded) return;
    const ws = JSON.stringify(pickWorkspace(s));
    if (ws !== lastWs) {
      lastWs = ws;
      writeKey(wsKey(s.activeProjectId), JSON.parse(ws));
    }
  });
}

/** Called on project switch so the next writes land under the new key. */
export function resetWorkspaceWatermark(s: StudioStore) {
  lastWs = JSON.stringify(pickWorkspace(s));
}
