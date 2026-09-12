import type {
  CheckDetail,
  CodeSnippet,
  CookieRow,
  Diagnostic,
  DocPage,
  DriftChange,
  DynamicVar,
  Environment,
  EnvVar,
  Example,
  ExecResult,
  Flow,
  HistoryDay,
  HistoryEntry,
  InsightsBundle,
  Mock,
  MockServerStatus,
  OAuthTokenRow,
  OperatorEvent,
  ProjectSummary,
  Route,
  RouteChecks,
  RunEvent,
  ScanEvent,
  Schedule,
  SendEvent,
  SourceFile,
  SpecCommit,
  VaultRef,
  WsEvent,
} from "./types";

export type Unsubscribe = () => void;

export interface DaemonEvents {
  "tap:entry": HistoryEntry;
  "watcher:change": { file: string; note: string };
  "mock:status": MockServerStatus;
}

export interface SendHandle {
  events: AsyncIterable<SendEvent>;
  cancel: () => void;
}

export interface RunHandle {
  events: AsyncIterable<RunEvent>;
  cancel: () => void;
}

export interface WsSessionHandle {
  send: (text: string) => void;
  close: () => void;
  events: AsyncIterable<WsEvent>;
}

/**
 * The seam between the studio UI and the (future) local daemon.
 * Today: FixtureClient. Later: HttpDaemonClient against local.zestman.xyz→daemon.
 * The UI's data slice is the ONLY consumer.
 */
export interface DaemonClient {
  listProjects(): Promise<ProjectSummary[]>;

  listRoutes(): Promise<Route[]>;
  listSourceFiles(): Promise<SourceFile[]>;
  updateRoute(id: string, patch: Partial<Route>): Promise<Route>;

  listEnvironments(): Promise<Environment[]>;
  saveEnvironments(envs: Environment[]): Promise<void>;
  getGlobals(): Promise<EnvVar[]>;
  saveGlobals(vars: EnvVar[]): Promise<void>;
  listVaultRefs(): Promise<VaultRef[]>;
  listDynamicVars(): Promise<DynamicVar[]>;
  listCookies(): Promise<CookieRow[]>;
  saveCookies(rows: CookieRow[]): Promise<void>;
  listOAuthTokens(): Promise<OAuthTokenRow[]>;
  saveOAuthTokens(rows: OAuthTokenRow[]): Promise<void>;

  listHistoryDays(): Promise<HistoryDay[]>;
  listHistoryEntries(): Promise<HistoryEntry[]>;

  listChecks(): Promise<RouteChecks[]>;
  getCheckDetail(routeId: string, type: string): Promise<CheckDetail>;
  listFlows(): Promise<Flow[]>;
  listSchedules(): Promise<Schedule[]>;
  saveSchedule(s: Schedule): Promise<Schedule>;
  deleteSchedule(id: string): Promise<void>;

  listMocks(): Promise<Mock[]>;
  saveMock(m: Mock): Promise<Mock>;
  getMockServerStatus(): Promise<MockServerStatus>;

  getSpecCommits(): Promise<SpecCommit[]>;
  getDriftChanges(): Promise<DriftChange[]>;
  getDiagnostics(): Promise<Diagnostic[]>;
  getInsights(): Promise<InsightsBundle>;
  listExamples(routeId?: string): Promise<Example[]>;
  saveExample(e: Example): Promise<Example>;
  deleteExample(id: string): Promise<void>;
  listDocPages(): Promise<DocPage[]>;

  getSnippet(routeId: string, language: string): Promise<CodeSnippet>;
  getXray(routeId: string): Promise<{ confidence: string; links: import("./types").XrayLink[]; weakest: string }>;

  send(routeId: string, resolvedUrl: string): SendHandle;
  runAll(iterations: number): RunHandle;
  openWsSession(routeId: string): WsSessionHandle;
  operatorRun(prompt: string): AsyncIterable<OperatorEvent>;
  startScan(): AsyncIterable<ScanEvent>;

  on<K extends keyof DaemonEvents>(event: K, handler: (payload: DaemonEvents[K]) => void): Unsubscribe;
  dispose(): void;
}
