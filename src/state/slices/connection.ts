import type { StateCreator } from "zustand";
import type { StudioStore } from "../store";
import type { ConnectionState } from "@/daemon/client";
import type { ProjectSummary } from "@/daemon/types";
import { DaemonHttpError } from "@/daemon/http/HttpDaemonClient";
import {
  consumeLaunchHash,
  findDaemon,
  getConnection,
  loadKnownProjects,
  parseLaunchLink,
  probe,
  saveConnection,
  saveKnownProjects,
} from "@/studio/connection";
import { createClient, currentClientProjectId, disposeClient } from "@/studio/client";
import { loadUi } from "../persistence";

export type ConnState = "booting" | "no-connection" | "unreachable" | "unauthorized" | "connected";

export interface ConnectionSlice {
  connState: ConnState;
  /** Last daemon error while connecting/loading — shown under the state copy. */
  connError: string | null;
  connPort: number | null;
  /** Projects from the last time we were connected; what the waiting view lists. */
  knownProjects: ProjectSummary[];
  /** The shared WebSocket's state; anything but `open` shows in the status bar. */
  wsState: ConnectionState;
  /** Whether the socket has ever been open this session (connecting vs. reconnecting). */
  wsEverOpen: boolean;

  /** Connects, then opens the project the URL names (`null` = pick one). */
  boot: (projectSlug?: string | null) => Promise<void>;
  retryConnection: () => Promise<void>;
  /** Accepts a launch URL, a `#c=…` fragment or `port.token`. False when unparsable. */
  applyLaunchLink: (input: string) => Promise<boolean>;
  setWsState: (state: ConnectionState) => void;
}

/** StrictMode mounts App twice; one boot at a time. */
let bootInFlight: Promise<void> | null = null;
/** `p=` from the launch link, honoured on the next boot. */
let requestedProjectId: string | null = null;
/** The slug in the URL, honoured after a launch link and before the last-used project. */
let requestedSlug: string | null = null;

export function connStateForError(e: unknown): { connState: ConnState; connError: string } {
  const status = e instanceof DaemonHttpError ? e.status : 0;
  const message = e instanceof Error ? e.message : String(e);
  return { connState: status === 401 || status === 403 ? "unauthorized" : "unreachable", connError: message };
}

export const createConnectionSlice: StateCreator<StudioStore, [], [], ConnectionSlice> = (set, get) => {
  const runBoot = async () => {
    set({ connState: "booting", connError: null });

    const launch = consumeLaunchHash();
    if (launch.projectId) requestedProjectId = launch.projectId;
    const saved = getConnection();
    if (!saved) {
      disposeClient();
      set({ connState: "no-connection", connPort: null, knownProjects: loadKnownProjects() });
      return;
    }
    set({ connPort: saved.port });

    let conn = saved;
    let result = await probe(conn);
    if (result === "unreachable") {
      // The daemon may have restarted on another port; the token still fits.
      const found = await findDaemon(saved.token, saved.port);
      if (found) {
        conn = found;
        set({ connPort: conn.port });
        result = await probe(conn);
      }
    }
    if (result !== "ok") {
      disposeClient();
      set({ connState: result, knownProjects: loadKnownProjects() });
      return;
    }

    const client = createClient(conn, get().activeProjectId);
    let projects;
    try {
      projects = await client.listProjects();
    } catch (e) {
      set(connStateForError(e));
      return;
    }

    /* The launch link wins (it names one project on purpose), then the URL,
       then whatever was open last. */
    const wanted = requestedProjectId ?? (get().activeProjectId || loadUi().activeProjectId);
    requestedProjectId = null;
    const bySlug = requestedSlug ? projects.find((p) => p.slug === requestedSlug)?.id : undefined;
    const chosen = bySlug ?? projects.find((p) => p.id === wanted)?.id ?? projects[0]?.id ?? "";
    if (chosen !== currentClientProjectId()) createClient(conn, chosen);

    if (chosen !== get().activeProjectId) get().closeAllTabs();
    saveKnownProjects(projects);
    set({ projects, knownProjects: projects, activeProjectId: chosen, connState: "connected", loaded: false, liveEntries: [] });
    await get().loadAll();
  };

  const boot = (projectSlug?: string | null) => {
    if (projectSlug !== undefined) requestedSlug = projectSlug;
    if (bootInFlight) return bootInFlight;
    bootInFlight = runBoot().finally(() => {
      bootInFlight = null;
    });
    return bootInFlight;
  };

  return {
    connState: "booting",
    connError: null,
    connPort: null,
    knownProjects: [],
    wsState: "closed",
    wsEverOpen: false,

    boot,
    retryConnection: () => boot(),

    applyLaunchLink: async (input) => {
      const link = parseLaunchLink(input);
      if (!link?.conn) return false;
      saveConnection(link.conn);
      if (link.projectId) requestedProjectId = link.projectId;
      await boot();
      return true;
    },

    setWsState: (state) =>
      set((s) => ({ wsState: state, wsEverOpen: s.wsEverOpen || state === "open" })),
  };
};
