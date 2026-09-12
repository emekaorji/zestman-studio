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
  startRun: () => Promise<void>;
  stopRun: () => void;
  setRunnerIterations: (n: number) => void;
  resetRunner: () => void;
}

let runCancel: (() => void) | null = null;

export const createRunnerSlice: StateCreator<StudioStore, [], [], RunnerSlice> = (set, get) => ({
  runnerRunning: false,
  runnerItems: [],
  runnerIterations: loadUi().runnerIterations,
  runnerDataFile: "users.csv",
  runnerSummary: null,

  startRun: async () => {
    if (get().runnerRunning) return;
    set({ runnerRunning: true, runnerItems: [], runnerSummary: null });
    const handle = getClient().runAll(get().runnerIterations);
    runCancel = handle.cancel;
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
        set({ runnerSummary: ev.summary, runnerRunning: false });
      }
    }
    set({ runnerRunning: false });
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
  /** Set once the user rules on a proposed fix. Undecided cards show buttons. */
  decision?: "accepted" | "rejected";
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
  /** Accept or reject a proposed fix. The daemon will apply it for real. */
  decideOperatorCard: (cardId: string, decision: "accepted" | "rejected") => void;
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

  decideOperatorCard: (cardId, decision) => {
    const card = get().operatorFeed.find((c) => c.id === cardId);
    set((s) => ({
      operatorFeed: s.operatorFeed.map((c) => (c.id === cardId ? { ...c, decision } : c)),
    }));
    get().pushToast(
      decision === "accepted"
        ? { kind: "operator", text: "Fix applied", sub: card?.body ?? "written to .zestman/" }
        : { kind: "info", text: "Fix rejected", sub: "nothing was written" },
    );
  },

  clearOperatorFeed: () => set({ operatorFeed: [] }),

  askOperator: async (prompt) => {
    set({ railMode: "act" });
    for await (const ev of getClient().operatorRun(prompt) as AsyncIterable<OperatorEvent>) {
      if (ev.t === "thinking") set({ operatorThinking: ev.on });
      else if (ev.t === "card") {
        set((s) => ({
          operatorFeed: [
            ...s.operatorFeed,
            { id: id("op"), kind: ev.kind, title: ev.title, body: ev.body, pill: ev.pill, diff: ev.diff },
          ],
        }));
      }
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
  wsConnect: () => Promise<void>;
  wsDisconnect: () => void;
  wsSend: (text: string) => void;
}

let wsSession: WsSessionHandle | null = null;

export const createWsSlice: StateCreator<StudioStore, [], [], WsSlice> = (set, get) => ({
  wsConnected: false,
  wsMessages: [],
  wsStartedAt: null,

  wsConnect: async () => {
    if (get().wsConnected) return;
    const route = get().routes.find((r) => r.protocol === "websocket");
    if (!route) return;
    wsSession = getClient().openWsSession(route.id);
    set({ wsConnected: true, wsStartedAt: Date.now(), wsMessages: [] });
    for await (const ev of wsSession.events as AsyncIterable<WsEvent>) {
      if (ev.t === "status") {
        set({ wsConnected: ev.connected });
        if (!ev.connected) break;
      } else if (ev.t === "system") {
        set((s) => ({ wsMessages: [...s.wsMessages, { id: id("ws"), kind: "system", text: ev.text, at: ev.at }] }));
      } else if (ev.t === "sent") {
        set((s) => ({ wsMessages: [...s.wsMessages, { id: id("ws"), kind: "sent", text: ev.text, at: ev.at }] }));
      } else if (ev.t === "recv") {
        set((s) => ({
          wsMessages: [
            ...s.wsMessages,
            ev.binary
              ? { id: id("ws"), kind: "binary", text: `binary frame · ${(ev.binary.bytes / 1024).toFixed(1)} KB`, at: ev.at }
              : { id: id("ws"), kind: "recv", text: ev.text, at: ev.at },
          ],
        }));
      }
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
