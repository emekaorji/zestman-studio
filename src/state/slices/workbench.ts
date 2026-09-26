import type { StateCreator } from "zustand";
import type { StudioStore } from "../store";
import type { RequestTabId, ResponseTabId } from "../types";
import type { ExecResult, RequestDraft, Route } from "@/daemon/types";
import { getClient } from "@/studio/client";
import { id } from "@/lib/ids";
import { buildVarMap, resolveText } from "@/lib/variables";

/** The tab's draft is the canonical `RequestDraft` the daemon receives on send. */
export type { RequestDraft };

export interface OpenTab {
  id: string;
  routeId: string;
  requestTab: RequestTabId;
  responseTab: ResponseTabId;
  draft: RequestDraft;
  dirty: boolean;
  sending: boolean;
  response: ExecResult | null;
}

export interface WorkbenchSlice {
  openTabs: OpenTab[];
  activeTabId: string | null;
  urlFocusNonce: number;
  /** Route whose editor should enter title-edit mode (sidebar "Rename"). */
  titleEditRouteId: string | null;

  openRoute: (routeId: string, requestTab?: RequestTabId) => void;
  closeTab: (tabId: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (tabId: string) => void;
  cycleTab: (dir: 1 | -1) => void;
  setRequestTab: (tabId: string, tab: RequestTabId) => void;
  setResponseTab: (tabId: string, tab: ResponseTabId) => void;
  patchDraft: (tabId: string, patch: Partial<RequestDraft>) => void;
  send: (tabId: string) => Promise<void>;
  cancelSend: (tabId: string) => void;
  focusUrl: () => void;
  /** Ask the route editor to enter title-edit mode (sidebar "Rename"). */
  requestTitleEdit: (routeId: string) => void;
  clearTitleEdit: () => void;
}

export function draftFromRoute(route: Route): RequestDraft {
  return {
    method: route.method,
    url: route.protocol === "websocket" ? route.path : `{{baseUrl}}${route.path}`,
    params: structuredClone(route.params),
    query: structuredClone(route.query),
    headers: structuredClone(route.headers),
    body: structuredClone(route.body),
    auth: structuredClone(route.auth),
    scripts: structuredClone(route.scripts),
    settings: structuredClone(route.settings),
    name: route.name,
    description: route.description,
    tags: [...route.tags],
  };
}

/** An ExecResult for a request that never produced a response. */
function failedResult(errorMessage: string): ExecResult {
  return {
    status: 0,
    statusLabel: "ERR",
    headers: [],
    cookies: [],
    body: "",
    bodyKind: "text",
    ms: 0,
    bytes: 0,
    at: Date.now(),
    timeline: [],
    tests: [],
    consoleLines: [],
    errorMessage,
  };
}

/** In-flight send cancel callbacks, keyed by tab id (not state — not renderable). */
const sendCancels = new Map<string, () => void>();

export const createWorkbenchSlice: StateCreator<StudioStore, [], [], WorkbenchSlice> = (set, get) => ({
  openTabs: [],
  activeTabId: null,
  urlFocusNonce: 0,
  titleEditRouteId: null,

  openRoute: (routeId, requestTab) => {
    const s = get();
    const existing = s.openTabs.find((t) => t.routeId === routeId);
    if (existing) {
      set({
        activeTabId: existing.id,
        openTabs: requestTab
          ? s.openTabs.map((t) => (t.id === existing.id ? { ...t, requestTab } : t))
          : s.openTabs,
      });
      return;
    }
    const route = s.routes.find((r) => r.id === routeId);
    if (!route) return;
    const tab: OpenTab = {
      id: id("tab"),
      routeId,
      requestTab: requestTab ?? "params",
      responseTab: "response",
      draft: draftFromRoute(route),
      dirty: false,
      sending: false,
      response: null,
    };
    set({ openTabs: [...s.openTabs, tab], activeTabId: tab.id });
  },

  closeTab: (tabId) => {
    const s = get();
    sendCancels.get(tabId)?.();
    sendCancels.delete(tabId);
    const idx = s.openTabs.findIndex((t) => t.id === tabId);
    const remaining = s.openTabs.filter((t) => t.id !== tabId);
    let activeTabId = s.activeTabId;
    if (s.activeTabId === tabId) {
      activeTabId = remaining[Math.max(0, idx - 1)]?.id ?? null;
    }
    set({ openTabs: remaining, activeTabId });
  },

  closeAllTabs: () => {
    for (const cancel of sendCancels.values()) cancel();
    sendCancels.clear();
    set({ openTabs: [], activeTabId: null });
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  cycleTab: (dir) => {
    const s = get();
    if (s.openTabs.length < 2 || !s.activeTabId) return;
    const idx = s.openTabs.findIndex((t) => t.id === s.activeTabId);
    const next = (idx + dir + s.openTabs.length) % s.openTabs.length;
    set({ activeTabId: s.openTabs[next].id });
  },

  setRequestTab: (tabId, tab) =>
    set((s) => ({ openTabs: s.openTabs.map((t) => (t.id === tabId ? { ...t, requestTab: tab } : t)) })),

  setResponseTab: (tabId, tab) =>
    set((s) => ({ openTabs: s.openTabs.map((t) => (t.id === tabId ? { ...t, responseTab: tab } : t)) })),

  patchDraft: (tabId, patch) =>
    set((s) => ({
      openTabs: s.openTabs.map((t) =>
        t.id === tabId ? { ...t, draft: { ...t.draft, ...patch }, dirty: true } : t,
      ),
    })),

  send: async (tabId) => {
    const s = get();
    const tab = s.openTabs.find((t) => t.id === tabId);
    if (!tab || tab.sending) return;
    set((st) => ({
      openTabs: st.openTabs.map((t) => (t.id === tabId ? { ...t, sending: true } : t)),
      drawerOpen: true,
    }));
    const active = s.environments.find((e) => e.isActive);
    const vars = buildVarMap(s.globals, active?.variables);
    const { resolved } = resolveText(tab.draft.url, vars);
    const handle = getClient().send(tab.routeId, tab.draft, resolved);
    sendCancels.set(tabId, handle.cancel);
    try {
      for await (const ev of handle.events) {
        if (ev.t === "done" || ev.t === "error") {
          set((st) => ({
            openTabs: st.openTabs.map((t) =>
              t.id === tabId ? { ...t, sending: false, response: ev.result, responseTab: "response" } : t,
            ),
          }));
          // refresh history mirror
          await get().refreshHistory();
        }
      }
    } catch (e) {
      // The stream failed (socket dropped, daemon error) — show it as a network error.
      const message = e instanceof Error ? e.message : String(e);
      set((st) => ({
        openTabs: st.openTabs.map((t) =>
          t.id === tabId ? { ...t, sending: false, response: failedResult(message), responseTab: "response" } : t,
        ),
      }));
    } finally {
      sendCancels.delete(tabId);
      // A cancel that never produced a frame must still release the tab.
      set((st) => ({
        openTabs: st.openTabs.map((t) => (t.id === tabId && t.sending ? { ...t, sending: false } : t)),
      }));
    }
  },

  cancelSend: (tabId) => {
    sendCancels.get(tabId)?.();
    set((st) => ({
      openTabs: st.openTabs.map((t) => (t.id === tabId ? { ...t, sending: false } : t)),
    }));
  },

  focusUrl: () => set((s) => ({ urlFocusNonce: s.urlFocusNonce + 1 })),
  requestTitleEdit: (routeId) => set({ titleEditRouteId: routeId }),
  clearTitleEdit: () => set({ titleEditRouteId: null }),
});
