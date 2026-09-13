import type { StateCreator } from "zustand";
import type { StudioStore } from "../store";
import type { RailTab } from "../types";
import { loadUi } from "../persistence";

export type ThemeId = "graphite" | "paper";

export interface SessionSlice {
  theme: ThemeId;

  /** Panel geometry. Sizes are px; every panel collapses to zero and back. */
  sidebarCollapsed: boolean;
  sidebarW: number;
  railCollapsed: boolean;
  railW: number;
  drawerCollapsed: boolean;
  drawerH: number;

  railTab: RailTab;
  onboarded: boolean;
  /** Sidebar shows its top-level nav without leaving the current page. */
  sidebarRoot: boolean;
  /** Narrow viewports float the panels over the content instead of beside it.
      These are transient — never persisted, so a phone visit cannot overwrite
      the collapse preferences you set on a desktop. */
  sidebarOverlayOpen: boolean;
  railOverlayOpen: boolean;

  setTheme: (t: ThemeId) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setSidebarW: (px: number) => void;
  toggleRail: () => void;
  setRailCollapsed: (v: boolean) => void;
  setRailW: (px: number) => void;
  toggleDrawer: () => void;
  setDrawerCollapsed: (v: boolean) => void;
  setDrawerH: (px: number) => void;
  setRailTab: (tab: RailTab) => void;
  setOnboarded: (v: boolean) => void;
  setSidebarRoot: (v: boolean) => void;
  setSidebarOverlayOpen: (v: boolean) => void;
  setRailOverlayOpen: (v: boolean) => void;

  /** Back-compat aliases used across features. */
  sidebarVisible: boolean;
  railOpen: boolean;
  drawerOpen: boolean;
  setRailOpen: (open: boolean) => void;
  setDrawerOpen: (open: boolean) => void;
}

function applyTheme(t: ThemeId) {
  document.documentElement.dataset.theme = t;
}

export const createSessionSlice: StateCreator<StudioStore, [], [], SessionSlice> = (set, get) => {
  const ui = loadUi();
  applyTheme(ui.theme);
  return {
  theme: ui.theme,

  sidebarCollapsed: ui.sidebarCollapsed,
  sidebarW: ui.sidebarW,
  railCollapsed: ui.railCollapsed,
  railW: ui.railW,
  drawerCollapsed: ui.drawerCollapsed,
  drawerH: ui.drawerH,

  railTab: ui.railTab,
  onboarded: ui.onboarded,
  sidebarRoot: false,
  sidebarOverlayOpen: false,
  railOverlayOpen: false,

  setTheme: (t) => {
    applyTheme(t);
    set({ theme: t });
  },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed, sidebarVisible: s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v, sidebarVisible: !v }),
  setSidebarW: (px) => set({ sidebarW: px }),

  toggleRail: () => set((s) => ({ railCollapsed: !s.railCollapsed, railOpen: s.railCollapsed })),
  setRailCollapsed: (v) => set({ railCollapsed: v, railOpen: !v }),
  setRailW: (px) => set({ railW: px }),

  toggleDrawer: () => set((s) => ({ drawerCollapsed: !s.drawerCollapsed, drawerOpen: s.drawerCollapsed })),
  setDrawerCollapsed: (v) => set({ drawerCollapsed: v, drawerOpen: !v }),
  setDrawerH: (px) => set({ drawerH: px }),

  setRailTab: (tab) => set({ railTab: tab }),
  setOnboarded: (v) => set({ onboarded: v }),
  setSidebarRoot: (v) => set({ sidebarRoot: v }),
  setSidebarOverlayOpen: (v) => set({ sidebarOverlayOpen: v }),
  setRailOverlayOpen: (v) => set({ railOverlayOpen: v }),

  sidebarVisible: !ui.sidebarCollapsed,
  railOpen: !ui.railCollapsed,
  drawerOpen: !ui.drawerCollapsed,
  setRailOpen: (open) => set({ railOpen: open, railCollapsed: !open }),
  setDrawerOpen: (open) => set({ drawerOpen: open, drawerCollapsed: !open }),
  };
};
