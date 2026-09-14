import type { StateCreator } from "zustand";
import type { StudioStore } from "../store";
import type { OperatorEvent, RunEvent, RunItem, WsEvent } from "@/daemon/types";
import type { WsSessionHandle } from "@/daemon/client";
import { getClient } from "@/app/client";
import { loadUi } from "../persistence";
import { id } from "@/lib/ids";

/* ── Runner ─────────────────────────────────────────────────────────────── */

export interface RunnerSlice {
  runnerRunning: boolean;
  runnerItems: RunItem[];
  runnerIterations: number;
  runnerDataFile: string | null;
  runnerSummary: { ok: number; failed: number; testsPass: number; testsFail: number; totalMs: number } | null;
  /** When the last run finished — the overview's "last run-all". */
  runnerFinishedAt: number | null;
  /** Route ids the next "selection" run covers (set by the page that owns the selection). */
  runnerScope: string[] | null;
  startRun: (routeIds?: string[]) => Promise<void>;
  setRunnerScope: (routeIds: string[] | null) => void;
  stopRun: () => void;
  setRunnerIterations: (n: number) => void;
  resetRunner: () => void;
}

let runCancel: (() => void) | null = null;

export const createRunnerSlice: StateCreator<StudioStore, [], [], RunnerSlice> = (set, get) => ({
  runnerRunning: false,
  runnerItems: [],
  runnerIterations: loadUi().runnerIterations,
  runnerDataFile: null,
  runnerSummary: null,
  runnerFinishedAt: null,
  runnerScope: null,
  setRunnerScope: (routeIds) => set({ runnerScope: routeIds }),

  startRun: async (routeIds) => {
    if (get().runnerRunning) return;
    set({ runnerRunning: true, runnerItems: [], runnerSummary: null });
    const handle = getClient().runAll(get().runnerIterations, routeIds);
    runCancel = handle.cancel;
    try {
      for await (const ev of handle.events as AsyncIterable<RunEvent>) {
        if (ev.t === "item") {
          set((s) => {
            const key = (i: RunItem) => `${i.routeId}:${i.iteration}`;
            const items = [...s.runnerItems];
            const idx = items.findIndex((i) => key(i) === key(ev.item));
            if (idx >= 0) items[idx] = ev.item;
            else items.push(ev.item);
            return { runnerItems: items };
          });
        } else {
          set({ runnerSummary: ev.summary, runnerRunning: false, runnerFinishedAt: Date.now() });
        }
      }
    } catch (e) {
      get().pushToast({ kind: "info", text: "Run stopped", sub: e instanceof Error ? e.message : String(e) });
    } finally {
      runCancel = null;
      set({ runnerRunning: false });
    }
  },

  stopRun: () => {
    runCancel?.();
    set({ runnerRunning: false });
  },
  setRunnerIterations: (n) => set({ runnerIterations: n }),
  resetRunner: () => set({ runnerItems: [], runnerSummary: null, runnerRunning: false }),
});

/* ── Rail / operator ────────────────────────────────────────────────────── */

export interface OperatorCard {
  id: string;
  kind: "ran-check" | "read-source" | "proposed-fix" | "note";
  title: string;
  body?: string;
  pill?: string;
  diff?: Array<{ line: string; tone: "add" | "del" | "ctx" }>;
  /** Daemon-side id; only cards that carry one can be applied. */
  cardId?: string;
  /** Set once the user rules on a proposed fix. Undecided cards show buttons. */
  decision?: "accepted" | "rejected";
  /** Where the daemon wrote the accepted fix. */
  appliedFile?: string;
}

export interface RailSlice {
  railMode: "ask" | "act";
  railCodeLang: string;
  railResolveVars: boolean;
  operatorThinking: boolean;
  operatorFeed: OperatorCard[];
  setRailMode: (m: "ask" | "act") => void;
  setRailCodeLang: (l: string) => void;
  setRailResolveVars: (v: boolean) => void;
  askOperator: (prompt: string) => Promise<void>;
  /** Accept (the daemon applies the fix) or reject (nothing is written). */
  decideOperatorCard: (cardId: string, decision: "accepted" | "rejected") => Promise<void>;
  clearOperatorFeed: () => void;
}

export const createRailSlice: StateCreator<StudioStore, [], [], RailSlice> = (set, get) => ({
  railMode: "ask",
  railCodeLang: loadUi().railCodeLang,
  railResolveVars: loadUi().railResolveVars,
  operatorThinking: false,
  operatorFeed: [],

  setRailMode: (m) => set({ railMode: m }),
  setRailCodeLang: (l) => set({ railCodeLang: l }),
  setRailResolveVars: (v) => set({ railResolveVars: v }),

  decideOperatorCard: async (feedId, decision) => {
    const card = get().operatorFeed.find((c) => c.id === feedId);
    if (!card) return;
    if (decision === "rejected") {
      set((s) => ({
        operatorFeed: s.operatorFeed.map((c) => (c.id === feedId ? { ...c, decision } : c)),
      }));
      return;
    }
    if (!card.cardId) {
      get().pushToast({ kind: "info", text: "This card cannot be applied", sub: "the daemon did not attach a fix id" });
      return;
    }
    // A failed apply is toasted by the client; the card stays undecided so it can be retried.
    const result = await getClient().applyOperatorFix(card.cardId);
    set((s) => ({
      operatorFeed: s.operatorFeed.map((c) =>
        c.id === feedId ? { ...c, decision: "accepted", appliedFile: result.file } : c,
      ),
    }));
    get().pushToast({ kind: "operator", text: "Fix applied", sub: result.file });
  },

  clearOperatorFeed: () => set({ operatorFeed: [] }),

  askOperator: async (prompt) => {
    set({ railMode: "act" });
    const s = get();
    const routeId = s.openTabs.find((t) => t.id === s.activeTabId)?.routeId;
    const stream = getClient().operatorRun(prompt, routeId ? { routeId } : undefined) as AsyncIterable<OperatorEvent>;
    try {
      for await (const ev of stream) {
        if (ev.t === "thinking") set({ operatorThinking: ev.on });
        else if (ev.t === "card") {
          set((st) => ({
            operatorFeed: [
              ...st.operatorFeed,
              {
                id: id("op"),
                kind: ev.kind,
                title: ev.title,
                body: ev.body,
                pill: ev.pill,
                diff: ev.diff,
                cardId: ev.cardId,
              },
            ],
          }));
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // Keep the failure in the feed, not only in a toast that fades: the fix is usually a config step.
      set((st) => ({
        operatorFeed: [...st.operatorFeed, { id: id("op"), kind: "note", title: "OPERATOR STOPPED", body: message }],
      }));
      get().pushToast({ kind: "info", text: "Operator stopped", sub: message });
    } finally {
      set({ operatorThinking: false });
    }
  },
});

/* ── WebSocket console ──────────────────────────────────────────────────── */

export interface WsMessage {
  id: string;
  kind: "system" | "sent" | "recv" | "binary";
  text: string;
  at: number;
  bytes?: number;
}

export interface WsSlice {
  wsConnected: boolean;
  wsMessages: WsMessage[];
  wsStartedAt: number | null;
  wsConnect: (routeId?: string) => Promise<void>;
  wsDisconnect: () => void;
  wsSend: (text: string) => void;
}

let wsSession: WsSessionHandle | null = null;

export const createWsSlice: StateCreator<StudioStore, [], [], WsSlice> = (set, get) => ({
  wsConnected: false,
  wsMessages: [],
  wsStartedAt: null,

  wsConnect: async (routeId) => {
    if (get().wsConnected) return;
    const s = get();
    const route =
      s.routes.find((r) => r.id === routeId && r.protocol === "websocket") ??
      s.routes.find((r) => r.id === s.openTabs.find((t) => t.id === s.activeTabId)?.routeId && r.protocol === "websocket") ??
      s.routes.find((r) => r.protocol === "websocket");
    if (!route) return;
    const session = getClient().openWsSession(route.id);
    wsSession = session;
    set({ wsConnected: true, wsStartedAt: Date.now(), wsMessages: [] });
    try {
      for await (const ev of session.events as AsyncIterable<WsEvent>) {
        if (ev.t === "status") {
          set({ wsConnected: ev.connected });
          if (!ev.connected) break;
        } else if (ev.t === "system") {
          set((st) => ({ wsMessages: [...st.wsMessages, { id: id("ws"), kind: "system", text: ev.text, at: ev.at }] }));
        } else if (ev.t === "sent") {
          set((st) => ({ wsMessages: [...st.wsMessages, { id: id("ws"), kind: "sent", text: ev.text, at: ev.at }] }));
        } else if (ev.t === "recv") {
          set((st) => ({
            wsMessages: [
              ...st.wsMessages,
              ev.binary
                ? { id: id("ws"), kind: "binary", text: `binary frame · ${(ev.binary.bytes / 1024).toFixed(1)} KB`, at: ev.at }
                : { id: id("ws"), kind: "recv", text: ev.text, at: ev.at },
            ],
          }));
        }
      }
    } catch (e) {
      set((st) => ({
        wsMessages: [
          ...st.wsMessages,
          { id: id("ws"), kind: "system", text: e instanceof Error ? e.message : String(e), at: Date.now() },
        ],
      }));
    } finally {
      if (wsSession === session) wsSession = null;
      set({ wsConnected: false });
    }
  },

  wsDisconnect: () => {
    wsSession?.close();
    wsSession = null;
    set({ wsConnected: false });
  },

  wsSend: (text) => {
    wsSession?.send(text);
  },
});

/* ── Toasts ─────────────────────────────────────────────────────────────── */

export interface Toast {
  id: string;
  kind: "watcher" | "operator" | "info";
  text: string;
  sub?: string;
}

export interface ToastSlice {
  toasts: Toast[];
  pushToast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
}

export const createToastSlice: StateCreator<StudioStore, [], [], ToastSlice> = (set) => ({
  toasts: [],
  pushToast: (t) => {
    const toast = { ...t, id: id("toast") };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== toast.id) }));
    }, 6000);
  },
  dismissToast: (tid) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== tid) })),
});
