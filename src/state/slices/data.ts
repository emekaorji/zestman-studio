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
import { getClient, recreateClient, setInitialProject } from "@/app/client";
import { loadUi, loadWorkspace, resetWorkspaceWatermark, restoreWorkspace } from "../persistence";

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
  updateRoute: (routeId: string, patch: Partial<Route>) => Promise<void>;
  saveEnvironments: (envs: Environment[]) => Promise<void>;
  saveGlobals: (vars: EnvVar[]) => Promise<void>;
  saveCookies: (rows: CookieRow[]) => Promise<void>;
  saveMock: (m: Mock) => Promise<void>;
  saveSchedule: (s: Schedule) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  saveExample: (e: Example) => Promise<void>;
  deleteExample: (id: string) => Promise<void>;
  saveOAuthTokens: (rows: OAuthTokenRow[]) => Promise<void>;
}

/* The client must be pointed at the remembered project before it is first
   constructed, or loadAll() would fetch the default project's data. */
const bootProjectId = loadUi().activeProjectId;
setInitialProject(bootProjectId);

export const createDataSlice: StateCreator<StudioStore, [], [], DataSlice> = (set, get) => ({
  projects: [],
  activeProjectId: bootProjectId,
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
    ] = await Promise.all([
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

    eventUnsubs.forEach((off) => off());
    eventUnsubs = [
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
    ];

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

  updateRoute: async (routeId, patch) => {
    set((s) => ({
      routes: s.routes.map((r) => (r.id === routeId ? { ...r, ...patch, updatedAt: Date.now() } : r)),
    }));
    await getClient().updateRoute(routeId, patch);
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
  saveSchedule: async (sch) => {
    set((s) => ({
      schedules: s.schedules.some((x) => x.id === sch.id)
        ? s.schedules.map((x) => (x.id === sch.id ? sch : x))
        : [...s.schedules, sch],
    }));
    await getClient().saveSchedule(sch);
  },
  deleteSchedule: async (id) => {
    set((s) => ({ schedules: s.schedules.filter((x) => x.id !== id) }));
    await getClient().deleteSchedule(id);
  },
  saveExample: async (e) => {
    set((s) => ({ examples: [...s.examples, e] }));
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
});
