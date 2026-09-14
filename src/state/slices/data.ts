import type { StateCreator } from "zustand";
import type { StudioStore } from "../store";
import type {
  CookieRow,
  Diagnostic,
  DocPage,
  DriftChange,
  DynamicVar,
  Environment,
  EnvVar,
  Example,
  Flow,
  HistoryDay,
  HistoryEntry,
  InsightsBundle,
  Mock,
  MockServerStatus,
  OAuthTokenRow,
  ProjectSummary,
  Route,
  RouteChecks,
  Schedule,
  SourceFile,
  SpecCommit,
  VaultRef,
} from "@/daemon/types";
import type { DaemonClient } from "@/daemon/client";
import { getClient, recreateClient } from "@/app/client";
import { loadUi, loadWorkspace, resetWorkspaceWatermark, restoreWorkspace } from "../persistence";
import { connStateForError } from "./connection";

/** Event-bus unsubscribers — loadAll() may run more than once (StrictMode, project switch). */
let eventUnsubs: Array<() => void> = [];

/**
 * Mirror of everything the UI reads. The ONLY consumer of DaemonClient.
 */
export interface DataSlice {
  projects: ProjectSummary[];
  activeProjectId: string;
  routes: Route[];
  files: SourceFile[];
  environments: Environment[];
  globals: EnvVar[];
  vaultRefs: VaultRef[];
  dynamicVars: DynamicVar[];
  cookies: CookieRow[];
  oauthTokens: OAuthTokenRow[];
  historyDays: HistoryDay[];
  historyEntries: HistoryEntry[];
  liveEntries: HistoryEntry[];
  checks: RouteChecks[];
  flows: Flow[];
  schedules: Schedule[];
  mocks: Mock[];
  mockServer: MockServerStatus | null;
  specCommits: SpecCommit[];
  driftChanges: DriftChange[];
  diagnostics: Diagnostic[];
  insights: InsightsBundle | null;
  examples: Example[];
  docPages: DocPage[];
  loaded: boolean;

  loadAll: () => Promise<void>;
  switchProject: (projectId: string) => Promise<void>;
  activateEnvironment: (envId: string) => Promise<void>;
  createRoute: (partial: Partial<Route>) => Promise<Route>;
  updateRoute: (routeId: string, patch: Partial<Route>) => Promise<void>;
  deleteRoute: (routeId: string) => Promise<void>;
  saveEnvironments: (envs: Environment[]) => Promise<void>;
  saveGlobals: (vars: EnvVar[]) => Promise<void>;
  saveCookies: (rows: CookieRow[]) => Promise<void>;
  saveMock: (m: Mock) => Promise<void>;
  deleteMock: (id: string) => Promise<void>;
  saveSchedule: (s: Schedule) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  runSchedule: (id: string) => Promise<Schedule>;
  runChecks: (routeIds?: string[]) => Promise<RouteChecks[]>;
  saveFlow: (f: Flow) => Promise<Flow>;
  deleteFlow: (id: string) => Promise<void>;
  runFlow: (id: string) => Promise<Flow>;
  saveExample: (e: Example) => Promise<void>;
  deleteExample: (id: string) => Promise<void>;
  saveOAuthTokens: (rows: OAuthTokenRow[]) => Promise<void>;
  clearHistory: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  refreshSpec: () => Promise<void>;
  openSource: (file: string, line?: number) => Promise<void>;
}

/** Split "users.controller.ts:22" into file + line. */
export function splitFileRef(ref: string): { file: string; line?: number } {
  const m = /^(.*):(\d+)$/.exec(ref);
  if (!m) return { file: ref };
  return { file: m[1], line: Number(m[2]) };
}

export const createDataSlice: StateCreator<StudioStore, [], [], DataSlice> = (set, get) => {
  const subscribeEvents = (client: DaemonClient) => {
    eventUnsubs.forEach((off) => off());

    const refetchProjects = async () => {
      try {
        const projects = await client.listProjects();
        set({ projects });
        // The studio came up before any app did: adopt the first project that appears.
        if (!get().activeProjectId && projects[0]) void get().switchProject(projects[0].id);
      } catch {
        /* surfaced by the client's error hook */
      }
    };

    eventUnsubs = [
      client.on("connection", ({ state }) => get().setWsState(state)),
      client.on("tap:entry", (entry) => {
        set((s) =>
          s.liveEntries.some((e) => e.id === entry.id)
            ? s
            : { liveEntries: [entry, ...s.liveEntries].slice(0, 200) },
        );
      }),
      client.on("watcher:change", ({ note }) => {
        get().pushToast({ kind: "watcher", text: note });
      }),
      client.on("mock:status", (mockServer) => {
        set({ mockServer });
        // Hit counts live on the mocks themselves; the status event is the cue to refresh them.
        void client.listMocks().then((mocks) => set({ mocks })).catch(() => undefined);
      }),
      client.on("routes:updated", () => {
        void (async () => {
          try {
            const [routes, files, diagnostics] = await Promise.all([
              client.listRoutes(),
              client.listSourceFiles(),
              client.getDiagnostics(),
            ]);
            set({ routes, files, diagnostics });
          } catch {
            /* surfaced by the client's error hook */
          }
        })();
      }),
      client.on("diagnostics:updated", () => {
        void client
          .getDiagnostics()
          .then((diagnostics) => set({ diagnostics }))
          .catch(() => undefined);
      }),
      client.on("projects:changed", () => void refetchProjects()),
      client.on("instance:online", () => void refetchProjects()),
      client.on("instance:offline", () => void refetchProjects()),
    ];
  };

  return {
    projects: [],
    activeProjectId: loadUi().activeProjectId,
    routes: [],
    files: [],
    environments: [],
    globals: [],
    vaultRefs: [],
    dynamicVars: [],
    cookies: [],
    oauthTokens: [],
    historyDays: [],
    historyEntries: [],
    liveEntries: [],
    checks: [],
    flows: [],
    schedules: [],
    mocks: [],
    mockServer: null,
    specCommits: [],
    driftChanges: [],
    diagnostics: [],
    insights: null,
    examples: [],
    docPages: [],
    loaded: false,

    loadAll: async () => {
      const client = getClient();

      /* No project registered with the daemon yet (studio opened before the
         app). Load what is project-independent and wait for projects:changed. */
      if (!get().activeProjectId) {
        try {
          const [projects, dynamicVars] = await Promise.all([client.listProjects(), client.listDynamicVars()]);
          if (projects[0]) {
            recreateClient(projects[0].id);
            set({ projects, activeProjectId: projects[0].id });
            await get().loadAll();
            return;
          }
          subscribeEvents(client);
          set({ projects, dynamicVars, loaded: true });
        } catch (e) {
          set(connStateForError(e));
        }
        return;
      }

      let data;
      try {
        data = await Promise.all([
          client.listProjects(),
          client.listRoutes(),
          client.listSourceFiles(),
          client.listEnvironments(),
          client.getGlobals(),
          client.listVaultRefs(),
          client.listDynamicVars(),
          client.listCookies(),
          client.listOAuthTokens(),
          client.listHistoryDays(),
          client.listHistoryEntries(),
          client.listChecks(),
          client.listFlows(),
          client.listSchedules(),
          client.listMocks(),
          client.getMockServerStatus(),
          client.getSpecCommits(),
          client.getDriftChanges(),
          client.getDiagnostics(),
          client.getInsights(),
          client.listExamples(),
          client.listDocPages(),
        ]);
      } catch (e) {
        set(connStateForError(e));
        return;
      }

      const [
        projects,
        routes,
        files,
        environments,
        globals,
        vaultRefs,
        dynamicVars,
        cookies,
        oauthTokens,
        historyDays,
        historyEntries,
        checks,
        flows,
        schedules,
        mocks,
        mockServer,
        specCommits,
        driftChanges,
        diagnostics,
        insights,
        examples,
        docPages,
      ] = data;

      subscribeEvents(client);

      /* Read + restore the workspace in the SAME set() as the data. A separate
         set() would let the persistence subscriber observe loaded:true with an
         empty tab list and write that over the saved workspace. */
      const saved = loadWorkspace(get().activeProjectId);
      const workspace = restoreWorkspace(saved, new Set(routes.map((r) => r.id)));

      set({
        projects,
        routes,
        files,
        environments,
        globals,
        vaultRefs,
        dynamicVars,
        cookies,
        oauthTokens,
        historyDays,
        historyEntries,
        checks,
        flows,
        schedules,
        mocks,
        mockServer,
        specCommits,
        driftChanges,
        diagnostics,
        insights,
        examples,
        docPages,
        loaded: true,
        ...workspace,
      });
      resetWorkspaceWatermark(get());
    },

    switchProject: async (projectId) => {
      if (projectId === get().activeProjectId) return;
      recreateClient(projectId);
      set({ activeProjectId: projectId, loaded: false, liveEntries: [] });
      get().closeAllTabs();
      await get().loadAll();
      // loadAll() restored the new project's own saved workspace.
    },

    activateEnvironment: async (envId) => {
      const envs = get().environments.map((e) => ({ ...e, isActive: e.id === envId }));
      set({ environments: envs });
      await getClient().saveEnvironments(envs);
    },

    createRoute: async (partial) => {
      const client = getClient();
      const route = await client.createRoute(partial);
      set((s) => ({ routes: s.routes.some((r) => r.id === route.id) ? s.routes.map((r) => (r.id === route.id ? route : r)) : [...s.routes, route] }));
      try {
        set({ files: await client.listSourceFiles() });
      } catch {
        /* surfaced by the client's error hook */
      }
      return route;
    },

    updateRoute: async (routeId, patch) => {
      set((s) => ({
        routes: s.routes.map((r) => (r.id === routeId ? { ...r, ...patch, updatedAt: Date.now() } : r)),
      }));
      await getClient().updateRoute(routeId, patch);
    },

    deleteRoute: async (routeId) => {
      await getClient().deleteRoute(routeId);
      const s = get();
      for (const tab of s.openTabs.filter((t) => t.routeId === routeId)) s.closeTab(tab.id);
      set((st) => ({
        routes: st.routes.filter((r) => r.id !== routeId),
        files: st.files.map((f) => ({ ...f, routeIds: f.routeIds.filter((id) => id !== routeId) })),
      }));
    },

    saveEnvironments: async (envs) => {
      set({ environments: envs });
      await getClient().saveEnvironments(envs);
    },
    saveGlobals: async (vars) => {
      set({ globals: vars });
      await getClient().saveGlobals(vars);
    },
    saveCookies: async (rows) => {
      set({ cookies: rows });
      await getClient().saveCookies(rows);
    },
    saveMock: async (m) => {
      set((s) => ({
        mocks: s.mocks.some((x) => x.id === m.id) ? s.mocks.map((x) => (x.id === m.id ? m : x)) : [...s.mocks, m],
      }));
      await getClient().saveMock(m);
      const mockServer = await getClient().getMockServerStatus();
      set({ mockServer });
    },
    deleteMock: async (id) => {
      await getClient().deleteMock(id);
      set((s) => ({ mocks: s.mocks.filter((x) => x.id !== id) }));
      const mockServer = await getClient().getMockServerStatus();
      set({ mockServer });
    },
    saveSchedule: async (sch) => {
      set((s) => ({
        schedules: s.schedules.some((x) => x.id === sch.id)
          ? s.schedules.map((x) => (x.id === sch.id ? sch : x))
          : [...s.schedules, sch],
      }));
      const saved = await getClient().saveSchedule(sch);
      set((s) => ({ schedules: s.schedules.map((x) => (x.id === saved.id ? saved : x)) }));
    },
    deleteSchedule: async (id) => {
      set((s) => ({ schedules: s.schedules.filter((x) => x.id !== id) }));
      await getClient().deleteSchedule(id);
    },
    runSchedule: async (id) => {
      const ran = await getClient().runSchedule(id);
      set((s) => ({ schedules: s.schedules.map((x) => (x.id === ran.id ? ran : x)) }));
      return ran;
    },
    runChecks: async (routeIds) => {
      const result = await getClient().runChecks(routeIds);
      if (!routeIds) {
        set({ checks: result });
      } else {
        set((s) => {
          const byId = new Map(result.map((c) => [c.routeId, c]));
          const merged = s.checks.map((c) => byId.get(c.routeId) ?? c);
          for (const c of result) if (!s.checks.some((x) => x.routeId === c.routeId)) merged.push(c);
          return { checks: merged };
        });
      }
      return result;
    },
    saveFlow: async (f) => {
      set((s) => ({
        flows: s.flows.some((x) => x.id === f.id) ? s.flows.map((x) => (x.id === f.id ? f : x)) : [...s.flows, f],
      }));
      const saved = await getClient().saveFlow(f);
      set((s) => ({ flows: s.flows.map((x) => (x.id === saved.id ? saved : x)) }));
      return saved;
    },
    deleteFlow: async (id) => {
      await getClient().deleteFlow(id);
      set((s) => ({ flows: s.flows.filter((x) => x.id !== id) }));
    },
    runFlow: async (id) => {
      const ran = await getClient().runFlow(id);
      set((s) => ({ flows: s.flows.map((x) => (x.id === ran.id ? ran : x)) }));
      return ran;
    },
    saveExample: async (e) => {
      set((s) => ({ examples: [...s.examples.filter((x) => x.id !== e.id), e] }));
      await getClient().saveExample(e);
    },
    deleteExample: async (id) => {
      set((s) => ({ examples: s.examples.filter((x) => x.id !== id) }));
      await getClient().deleteExample(id);
    },
    saveOAuthTokens: async (rows) => {
      set({ oauthTokens: rows });
      await getClient().saveOAuthTokens(rows);
    },
    clearHistory: async () => {
      await getClient().clearHistory();
      set({ historyEntries: [], liveEntries: [] });
      try {
        set({ historyDays: await getClient().listHistoryDays() });
      } catch {
        /* surfaced by the client's error hook */
      }
    },
    refreshHistory: async () => {
      const client = getClient();
      const [historyEntries, historyDays] = await Promise.all([client.listHistoryEntries(), client.listHistoryDays()]);
      set({ historyEntries, historyDays });
    },
    refreshSpec: async () => {
      const client = getClient();
      const [specCommits, driftChanges] = await Promise.all([client.getSpecCommits(), client.getDriftChanges()]);
      set({ specCommits, driftChanges });
    },
    openSource: async (file, line) => {
      await getClient().openSource(file, line);
    },
  };
};
