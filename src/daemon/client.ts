import type {
  CheckDetail,
  CookieRow,
  Diagnostic,
  DocPage,
  DriftChange,
  GitInfo,
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
  OperatorEvent,
  ProjectSummary,
  RequestDraft,
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
  XrayLink,
} from "./types";
import type { ImportResult } from "./wire";

export type Unsubscribe = () => void;

export interface UploadedFile {
  fileId: string;
  fileName: string;
  size: number;
  contentType: string;
}

export interface GraphqlIntrospection {
  status: number;
  typeCount: number;
  types: Array<{ name: string; kind: string; fields: string[] }>;
  error?: string;
}

export interface OAuthTokenState {
  active: boolean;
  expiresInMin: number;
  masked: string;
}

export type ConnectionState = "connecting" | "open" | "closed";

/**
 * Daemon push events. Everything except `connection` arrives as a
 * `{ t: "event" }` frame on the shared socket; `connection` is the socket's
 * own state, raised by the client.
 */
export interface DaemonEvents {
  "tap:entry": HistoryEntry;
  "watcher:change": { file: string; note: string };
  "mock:status": MockServerStatus;
  /** No payload — refetch routes, source files and diagnostics. */
  "routes:updated": undefined;
  "diagnostics:updated": undefined;
  "projects:changed": undefined;
  "instance:online": { instanceId: string };
  "instance:offline": { instanceId: string };
  connection: { state: ConnectionState };
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

export interface DocPageContent {
  id: string;
  title: string;
  kind: DocPage["kind"];
  content: string;
}

export interface XrayResult {
  confidence: string;
  links: XrayLink[];
  weakest: string;
}

/**
 * The seam between the studio UI and the local daemon.
 * Production: HttpDaemonClient. FixtureClient exists only for tests.
 * The UI's state slices are the ONLY consumers.
 */
export interface DaemonClient {
  listProjects(): Promise<ProjectSummary[]>;

  listRoutes(): Promise<Route[]>;
  listSourceFiles(): Promise<SourceFile[]>;
  createRoute(partial: Partial<Route>): Promise<Route>;
  updateRoute(id: string, patch: Partial<Route>): Promise<Route>;
  deleteRoute(id: string): Promise<void>;

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
  clearHistory(): Promise<void>;

  listChecks(): Promise<RouteChecks[]>;
  getCheckDetail(routeId: string, type: string): Promise<CheckDetail>;
  runChecks(routeIds?: string[]): Promise<RouteChecks[]>;
  listFlows(): Promise<Flow[]>;
  saveFlow(f: Flow): Promise<Flow>;
  deleteFlow(id: string): Promise<void>;
  runFlow(id: string): Promise<Flow>;
  listSchedules(): Promise<Schedule[]>;
  saveSchedule(s: Schedule): Promise<Schedule>;
  deleteSchedule(id: string): Promise<void>;
  runSchedule(id: string): Promise<Schedule>;

  listMocks(): Promise<Mock[]>;
  saveMock(m: Mock): Promise<Mock>;
  deleteMock(id: string): Promise<void>;
  getMockServerStatus(): Promise<MockServerStatus>;

  getOpenApi(): Promise<unknown>;
  getSpecCommits(): Promise<SpecCommit[]>;
  getDriftChanges(): Promise<DriftChange[]>;
  getGitInfo(): Promise<GitInfo>;
  regenerateSpec(): Promise<{ operations: number }>;
  getDiagnostics(): Promise<Diagnostic[]>;
  getInsights(): Promise<InsightsBundle>;
  listExamples(routeId?: string): Promise<Example[]>;
  saveExample(e: Example): Promise<Example>;
  deleteExample(id: string): Promise<void>;
  listDocPages(): Promise<DocPage[]>;
  getDocPage(id: string): Promise<DocPageContent>;
  saveDocPage(id: string, patch: { title?: string; content: string }): Promise<DocPage>;

  getXray(routeId: string): Promise<XrayResult>;

  importPostman(text: string): Promise<ImportResult>;
  importOpenApi(input: { text?: string; url?: string }): Promise<ImportResult>;
  importCurl(text: string): Promise<Route>;
  exportPostman(): Promise<unknown>;

  openSource(file: string, line?: number): Promise<void>;
  applyOperatorFix(cardId: string): Promise<{ ok: true; file: string }>;
  /** Multipart upload into the daemon's tmp store; the id goes on a form-data row or the binary body. */
  uploadFile(file: File): Promise<UploadedFile>;
  introspectGraphql(url: string, headers?: Record<string, string>): Promise<GraphqlIntrospection>;
  fetchOAuthToken(routeId: string, draft: RequestDraft): Promise<OAuthTokenState>;

  send(routeId: string, draft: RequestDraft, resolvedUrl: string): SendHandle;
  runAll(iterations: number, routeIds?: string[]): RunHandle;
  openWsSession(routeId: string): WsSessionHandle;
  operatorRun(prompt: string, context?: { routeId?: string }): AsyncIterable<OperatorEvent>;
  startScan(): AsyncIterable<ScanEvent>;

  on<K extends keyof DaemonEvents>(event: K, handler: (payload: DaemonEvents[K]) => void): Unsubscribe;
  dispose(): void;
}
