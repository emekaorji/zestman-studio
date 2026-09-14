import type { HttpMethod, RouteProtocol } from "@/lib/methods";

/* ── Projects ───────────────────────────────────────────────────────────── */

export interface ProjectSummary {
  id: string;
  name: string;
  framework: string; // "express"
  rootPath: string;
  routeCount: number;
  fileCount: number;
  online: boolean;
}

/* ── Routes & source ────────────────────────────────────────────────────── */

export interface SourceFile {
  id: string;
  path: string; // "src/modules/users/users.controller.ts"
  shortName: string; // "users.controller.ts"
  module: string; // "users"
  routeIds: string[];
}

export type Provenance = "static" | "inferred" | "manual" | "runtime" | "spec";

export interface SourceLocation {
  fileId: string;
  file: string;
  line: number;
  role: "handler" | "mount" | "schema" | "middleware";
}

export interface KVRow {
  id: string;
  key: string;
  value: string;
  description?: string;
  enabled: boolean;
}

export type BodyMode = "none" | "form-data" | "urlencoded" | "raw" | "binary" | "graphql";

export interface FormRow extends KVRow {
  type: "text" | "file";
  fileName?: string;
  fileSize?: number;
  /** Id returned by the daemon's upload endpoint; the bytes live in the daemon's tmp store. */
  fileId?: string;
}

export interface RequestBody {
  mode: BodyMode;
  raw: { language: "json" | "text" | "xml" | "html" | "javascript"; text: string };
  formData: FormRow[];
  urlencoded: KVRow[];
  binary: { fileName: string; size: number; fileId?: string } | null;
  graphql: { query: string; variables: string; schemaFetched: boolean; typeCount: number };
}

export type AuthMode = "none" | "inherit" | "bearer" | "basic" | "api-key" | "digest" | "oauth2";

export interface RouteAuth {
  mode: AuthMode;
  inferredFrom?: string; // "requireAuth middleware"
  bearer: { token: string };
  basic: { username: string; password: string };
  apiKey: { key: string; value: string; addTo: "header" | "query" };
  digest: { username: string; password: string };
  oauth2: {
    grantType: "authorization_code" | "client_credentials";
    authUrl: string;
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    scope: string;
    clientAuth: "basic" | "body";
    usePkce: boolean;
    tokenState: { active: boolean; expiresInMin: number } | null;
  };
}

export interface RouteScripts {
  preRequest: string;
  postResponse: string;
}

export interface RouteSettings {
  sslVerify: boolean;
  followRedirects: boolean;
  followOriginalMethod: boolean;
  followAuthHeader: boolean;
  removeRefererOnRedirect: boolean;
  cookieJar: boolean;
  timeoutMs: number;
  maxRedirects: number;
  proxyUrl: string;
  clientCertPath: string;
  clientKeyPath: string;
  caCertPath: string;
}

export interface Route {
  id: string;
  method: HttpMethod | "WS";
  path: string; // "/api/v1/users"
  protocol: RouteProtocol;
  name: string; // "Create user"
  description: string;
  tags: string[];
  provenance: Provenance;
  confidence: number; // 0..1
  sourceLocations: SourceLocation[];
  schemaRef: string | null; // "users.schema.ts:12"
  /** Body-schema doc rows — the daemon derives these from the Zod schema. */
  docFields: Array<{ name: string; type: string; required: boolean }>;
  middleware: string[];
  params: KVRow[]; // path variables
  query: KVRow[];
  headers: KVRow[];
  autoHeaders: Array<{ key: string; value: string; note: string }>;
  body: RequestBody;
  auth: RouteAuth;
  scripts: RouteScripts;
  settings: RouteSettings;
  createdAt: number;
  updatedAt: number;
}

/* ── Environments / secrets ─────────────────────────────────────────────── */

export interface EnvVar {
  id: string;
  key: string;
  value: string;
  type: "default" | "secret";
  enabled: boolean;
}

export interface Environment {
  id: string;
  name: string;
  variables: EnvVar[];
  isActive: boolean;
}

export interface VaultRef {
  id: string;
  name: string;
  reference: string; // "{{secret:STRIPE_KEY}}"
  revealState: "locked" | "prompt";
}

export interface DynamicVar {
  name: string; // "$guid"
  sample: string;
  swatch?: string;
}

export interface CookieRow {
  id: string;
  domain: string;
  name: string;
  value: string;
  path: string;
  expires: string; // "session" | date
  flags: Array<"HttpOnly" | "Secure">;
}

export interface OAuthTokenRow {
  id: string;
  routeScope: string; // "POST /api/v1/users · auth.example.dev"
  masked: string;
  state: "active" | "expired";
  expiresLabel: string; // "expires in 52 m" | "expired 2 h ago"
  hasRefresh: boolean;
}

/** What the workbench sends: the tab's draft, resolved against the active env by the daemon. */
export interface RequestDraft {
  method: string;
  url: string; // "{{baseUrl}}/api/v1/users"
  params: KVRow[];
  query: KVRow[];
  headers: KVRow[];
  body: RequestBody;
  auth: RouteAuth;
  scripts: RouteScripts;
  settings: RouteSettings;
  name: string;
  description: string;
  tags: string[];
}

/* ── Execution ──────────────────────────────────────────────────────────── */

export interface TimelinePhase {
  name: string; // dns / connect / tls / ttfb / download
  ms: number;
}

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export interface ExecResult {
  status: number; // 0 = network error
  statusLabel: string; // "201 Created" | "ERR"
  headers: Array<{ key: string; value: string }>;
  cookies: CookieRow[];
  body: string;
  bodyKind: "json" | "text" | "html" | "binary";
  ms: number;
  bytes: number;
  at: number;
  timeline: TimelinePhase[];
  tests: TestResult[];
  consoleLines: string[];
  errorMessage?: string;
  unresolvedVars?: string[];
}

export type SendEvent =
  | { t: "start" }
  | { t: "phase"; phase: TimelinePhase }
  | { t: "done"; result: ExecResult }
  | { t: "error"; result: ExecResult };

export interface RunItem {
  routeId: string;
  iteration: number;
  status: "queued" | "running" | "pass" | "fail";
  code?: number;
  ms?: number;
  note?: string;
}

export type RunEvent =
  | { t: "item"; item: RunItem }
  | { t: "done"; summary: { ok: number; failed: number; testsPass: number; testsFail: number; totalMs: number } };

/* ── History / live ─────────────────────────────────────────────────────── */

export interface HistoryEntry {
  id: string;
  at: number;
  method: string;
  path: string;
  url: string;
  routeId: string | null; // null = unmatched
  status: number;
  ms: number;
  bytes: number;
  caller?: string; // live tap: "web-app" | "curl"
  suggestion?: string; // unmatched triage
  requestHeaders: Array<{ key: string; value: string }>;
  requestBody: string | null;
  responseHeaders: Array<{ key: string; value: string }>;
  responseBody: string;
}

export interface HistoryDay {
  date: string; // "Today" | "Yesterday" | "Aug 27"
  count: number;
  entryIds: string[];
}

/* ── Tests: checks / flows / schedules ──────────────────────────────────── */

export type CheckType = "responds" | "status" | "schema" | "auth401" | "bad400";
export type CheckCell = "pass" | "fail" | "na" | "inferred";

export interface RouteChecks {
  routeId: string;
  cells: Record<CheckType, CheckCell>;
}

export interface CheckDetail {
  routeId: string;
  type: CheckType;
  failing: boolean;
  provenance: string; // "orders.schema.ts:18"
  requestBody: string;
  responseBody: string;
  responseStatus: number;
  assertion: string;
  received: string;
}

export interface FlowStep {
  id: string;
  routeId: string;
  extraction?: string; // "→ {{steps.create.body.id}}"
  usesVar?: string;
  stale?: string; // "stale ref: body.total"
  runState?: "pass" | "fail" | "pending";
  ms?: number;
  failNote?: string;
}

export interface Flow {
  id: string;
  name: string;
  file: string; // ".zestman/flows/checkout.flow"
  steps: FlowStep[];
  lastRun: { at: number; passed: number; total: number } | null;
}

export interface Schedule {
  id: string;
  name: string;
  cron: string;
  scope: string; // "All routes (27)"
  enabled: boolean;
  lastRun: { at: number; code: number | "passed" } | null;
  nextRunLabel: string;
  results: Array<{
    at: number;
    result: number | "skipped" | "passed";
    ms: number | null;
    note?: string;
  }>;
}

/* ── Mocks ──────────────────────────────────────────────────────────────── */

export interface Mock {
  id: string;
  name: string;
  routeId: string;
  statusCode: number;
  delayMs: number | null;
  enabled: boolean;
  headers: KVRow[];
  body: string;
  recentHits: Array<{ at: number; caller: string; path: string; status: number; ms: number }>;
}

export interface MockServerStatus {
  running: boolean;
  port: number;
  url: string;
  total: number;
  enabled: number;
}

/* ── Spec / drift ───────────────────────────────────────────────────────── */

export interface SpecOperation {
  routeId: string;
  summary: string;
  expanded?: boolean;
}

export interface SpecCommit {
  sha: string;
  label?: string; // "0.4.0"
  magnitude: "none" | "minor" | "warn" | "breaking";
}

export type DriftVerdict = "BREAKING" | "ADDED" | "REMOVED" | "DOCS" | "AUTH";

/** One request-body field as it appears on either side of a change. */
export interface DriftField {
  name: string;
  type: string;
  required: boolean;
}

export interface DriftChange {
  id: string;
  verdict: DriftVerdict;
  method: string;
  path: string;
  text: string;
  fileRef: string | null;
  /** Body fields before/after, when the change is about the request body. */
  fields?: { before: DriftField[]; after: DriftField[] };
}

export interface GitInfo {
  isRepo: boolean;
  branch: string | null;
  head: string | null;
  /** Whether .zestman/spec.json differs from the committed version. */
  specDirty: boolean;
}

/* ── Insights / diagnostics ─────────────────────────────────────────────── */

export interface Diagnostic {
  id: string;
  level: "error" | "warning" | "info";
  message: string;
  source: string; // "routes.ts:88" | "watcher"
  route: string | null;
  fix?: string;
  action?: string; // "add manualRoute"
}

export interface InsightsBundle {
  requestsToday: number;
  hourly: number[]; // 12 bars
  errorRate: number; // 0.023
  errorNote: string;
  p95: number;
  p50: number;
  latencyBars: number[];
  latencySpikeIdx: number;
  topRoute: { method: string; path: string; note: string };
  slowest: { label: string };
}

/* ── Examples / docs ────────────────────────────────────────────────────── */

export interface Example {
  id: string;
  routeId: string;
  name: string; // "201 Created"
  status: number;
  ms: number;
  bytes: number;
  savedAt: number;
  body: string;
  usedByMock: boolean;
  usedBySpec: boolean;
}

export interface DocPage {
  id: string; // "introduction" | "authentication" | "errors" | routeId
  title: string;
  kind: "page" | "endpoint";
}

/* ── Rail / operator / scan ─────────────────────────────────────────────── */

export interface CodeSnippet {
  language: string;
  variant: string; // "axios"
  lines: Array<{ text: string; tone: "key" | "str" | "num" | "plain" | "dim" }>;
}

export interface XrayLink {
  step: string; // "Route declared"
  fileRef: string; // "users.controller.ts:22"
  icon: string;
}

export type OperatorEvent =
  | {
      t: "card";
      kind: "ran-check" | "read-source" | "proposed-fix" | "note";
      title: string;
      body?: string;
      diff?: Array<{ line: string; tone: "add" | "del" | "ctx" }>;
      pill?: string;
      /** Daemon-side id; present on cards that can be applied (proposed-fix). */
      cardId?: string;
    }
  | { t: "thinking"; on: boolean }
  | { t: "done" };

export type ScanEvent =
  | { t: "file"; path: string; state: "done" | "active" | "pending" }
  | { t: "stat"; routes: number; schemas: number; auth: number }
  | { t: "progress"; pct: number; files: number; seconds: number }
  | { t: "done" };

export type WsEvent =
  | { t: "system"; text: string; at: number }
  | { t: "sent"; text: string; at: number }
  | { t: "recv"; text: string; at: number; binary?: { bytes: number } }
  | { t: "status"; connected: boolean };
