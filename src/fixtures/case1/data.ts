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
  HistoryEntry,
  InsightsBundle,
  Mock,
  MockServerStatus,
  OAuthTokenRow,
  RouteChecks,
  Schedule,
  SpecCommit,
  VaultRef,
} from "@/daemon/types";
import { CANON, routes } from "./routes";

const MIN = 60_000;
const now = Date.now();

export const CANON_RESPONSE = `{\n  "id": "usr_8f3k2",\n  "name": "Ada Lovelace",\n  "email": "ada@example.dev",\n  "role": "member",\n  "createdAt": "2026-08-29T09:41:07Z"\n}`;

/* ── Environments ───────────────────────────────────────────────────────── */

const ev = (key: string, value: string, type: EnvVar["type"] = "default"): EnvVar => ({
  id: `ev_${key}_${Math.random().toString(36).slice(2, 6)}`,
  key,
  value,
  type,
  enabled: true,
});

export const environments: Environment[] = [
  {
    id: "env_local",
    name: "Local",
    isActive: true,
    variables: [ev("baseUrl", "http://localhost:3000"), ev("token", "sk-live-....9f2", "secret"), ev("timeout", "30000")],
  },
  {
    id: "env_staging",
    name: "Staging",
    isActive: false,
    variables: [ev("baseUrl", "https://staging.api.example.dev"), ev("token", "sk-test-....a41", "secret")],
  },
];

export const globals: EnvVar[] = [ev("apiVersion", "v1"), ev("org", "acme")];

export const vaultRefs: VaultRef[] = [
  { id: "vr_stripe", name: "STRIPE_KEY", reference: "{{secret:STRIPE_KEY}}", revealState: "locked" },
  { id: "vr_token", name: "TOKEN", reference: "{{secret:TOKEN}}", revealState: "prompt" },
];

export const dynamicVars: DynamicVar[] = [
  { name: "$guid", sample: "d9f0c1aa-7e2b-4c31-9a02-1f8e6d3b5a90" },
  { name: "$randomUUID", sample: "7c2e51b8-4f0d-49c2-b7aa-2d9c14e8f631" },
  { name: "$timestamp", sample: "1787974388" },
  { name: "$epoch", sample: "1787974388123" },
  { name: "$isoTimestamp", sample: "2026-08-30T09:41:07Z" },
  { name: "$randomInt", sample: "4821" },
  { name: "$randomBoolean", sample: "true" },
  { name: "$randomEmail", sample: "mia@example.dev" },
  { name: "$randomFirstName", sample: "Mia" },
  { name: "$randomLastName", sample: "Okafor" },
  { name: "$randomFullName", sample: "Mia Okafor" },
  { name: "$randomColor", sample: "teal" },
  { name: "$randomHexColor", sample: "#3DD68C", swatch: "#3DD68C" },
];

export const cookies: CookieRow[] = [
  { id: "ck1", domain: "localhost", name: "sid", value: "a1b2c3d4e5", path: "/", expires: "session", flags: ["HttpOnly"] },
  { id: "ck2", domain: "localhost", name: "csrf", value: "9f21aa04", path: "/", expires: "2026-09-30", flags: ["Secure"] },
  { id: "ck3", domain: "api.stripe.com", name: "__cf", value: "k3j2h1g0", path: "/", expires: "2027-01-01", flags: [] },
];

export const oauthTokens: OAuthTokenRow[] = [
  {
    id: "ot1",
    routeScope: "POST /api/v1/users · auth.example.dev",
    masked: "eyJh••••••••9f2x",
    state: "active",
    expiresLabel: "expires in 52 m",
    hasRefresh: true,
  },
  {
    id: "ot2",
    routeScope: "POST /api/v1/orders/:id/cancel · auth.example.dev",
    masked: "eyJh••••••••b1c9",
    state: "expired",
    expiresLabel: "expired 2 h ago",
    hasRefresh: false,
  },
];

/* ── History (recorded) ─────────────────────────────────────────────────── */

let hseq = 0;
const h = (
  minsAgo: number,
  method: string,
  path: string,
  status: number,
  ms: number,
  extra?: Partial<HistoryEntry>,
): HistoryEntry => {
  const route = routes.find((r) => r.method === method && r.path === path) ?? null;
  return {
    id: `h_${(hseq += 1)}`,
    at: now - minsAgo * MIN,
    method,
    path,
    url: `http://localhost:3000${path.replace(":id", "8412")}`,
    routeId: route?.id ?? null,
    status,
    ms,
    bytes: 1229,
    requestHeaders: [
      { key: "Content-Type", value: "application/json" },
      { key: "Authorization", value: "Bearer ••••9f2" },
      { key: "Idempotency-Key", value: "usr-create-8f3k2" },
    ],
    requestBody: method === "POST" || method === "PATCH" ? `{\n  "name": "Ada Lovelace",\n  "email": "ada@example.dev",\n  "role": "member"\n}` : null,
    responseHeaders: [
      { key: "content-type", value: "application/json" },
      { key: "x-request-id", value: "req_9d2f" },
      { key: "date", value: "Sat, 30 Aug 2026 09:41:07 GMT" },
    ],
    responseBody: status < 400 ? CANON_RESPONSE : `{\n  "error": "body.total is required"\n}`,
    ...extra,
  };
};

export const historyToday: HistoryEntry[] = [
  h(1, "POST", "/api/v1/users", 201, 84),
  h(2, "GET", "/api/v1/users/:id", 200, 28),
  h(3, "GET", "/api/v1/orders", 200, 45),
  h(5, "POST", "/api/v1/orders/:id/cancel", 500, 121),
  h(6, "GET", "/api/v1/orders/:id", 200, 41),
  h(8, "PATCH", "/api/v1/users/:id", 200, 58),
  h(10, "GET", "/api/v1/products", 200, 36),
  h(12, "GET", "/api/v1/unknown", 404, 12),
  h(15, "GET", "/api/v1/categories", 200, 33),
  h(20, "GET", "/health", 200, 6),
  h(25, "GET", "/api/v1/posts", 200, 39),
  h(30, "GET", "/api/v1/users", 200, 31),
];

export const historyDaysMeta = [
  { date: "Today", count: 12 },
  { date: "Yesterday", count: 41 },
  { date: "Aug 27", count: 118 },
  { date: "Aug 26", count: 43 },
];

/* ── Checks ─────────────────────────────────────────────────────────────── */

export const routeChecks: RouteChecks[] = routes
  .filter((r) => r.protocol === "http")
  .map((r) => {
    const authed = r.middleware.includes("requireAuth");
    const cells: RouteChecks["cells"] = {
      responds: "pass",
      status: "pass",
      schema: r.schemaRef ? "pass" : "na",
      auth401: authed ? "pass" : "na",
      bad400: r.schemaRef ? "pass" : "na",
    };
    if (r.id === CANON.cancelOrder.id) cells.schema = "fail";
    if (r.id === CANON.statusOrder.id) {
      cells.responds = "inferred";
      cells.status = "inferred";
      cells.schema = "inferred";
      cells.auth401 = "inferred";
      cells.bad400 = "inferred";
    }
    return { routeId: r.id, cells };
  });

/* ── Flows ──────────────────────────────────────────────────────────────── */

export const flows: Flow[] = [
  {
    id: "flow_checkout",
    name: "checkout",
    file: ".zestman/flows/checkout.flow",
    steps: [
      { id: "st1", routeId: CANON.createUser.id, extraction: "→ {{steps.create.body.id}}", runState: "pass", ms: 84 },
      {
        id: "st2",
        routeId: routes.find((r) => r.method === "POST" && r.path === "/api/v1/orders")!.id,
        extraction: "→ {{steps.order.body.id}}",
        runState: "pass",
        ms: 112,
      },
      { id: "st3", routeId: CANON.statusOrder.id, usesVar: "uses {{steps.order.body.id}}", runState: "pass", ms: 61 },
      {
        id: "st4",
        routeId: CANON.cancelOrder.id,
        stale: "stale ref: body.total",
        runState: "fail",
        ms: 210,
        failNote: "500 · body.total is required",
      },
    ],
    lastRun: { at: now - 2 * MIN, passed: 3, total: 4 },
  },
  {
    id: "flow_auth",
    name: "auth cycle",
    file: ".zestman/flows/auth-cycle.flow",
    steps: [
      { id: "sa1", routeId: CANON.createUser.id, extraction: "→ {{steps.signup.body.id}}" },
      { id: "sa2", routeId: routes.find((r) => r.method === "GET" && r.path === "/api/v1/users/:id")!.id },
    ],
    lastRun: null,
  },
];

/* ── Schedules ──────────────────────────────────────────────────────────── */

export const schedules: Schedule[] = [
  {
    id: "sch_health",
    name: "API health",
    cron: "*/5 * * * *",
    scope: "All routes (27)",
    enabled: true,
    lastRun: { at: now - 3 * MIN, code: 200 },
    nextRunLabel: "next run in 3 m",
    results: [
      { at: now - 3 * MIN, result: 200, ms: 1400 },
      { at: now - 8 * MIN, result: 200, ms: 1200 },
      { at: now - 13 * MIN, result: 500, ms: 2900, note: "connect ECONNREFUSED 127.0.0.1:3000" },
      { at: now - 18 * MIN, result: "skipped", ms: null, note: "window missed while Studio was closed" },
      { at: now - 23 * MIN, result: 200, ms: 1300 },
      { at: now - 28 * MIN, result: 200, ms: 1500 },
      { at: now - 33 * MIN, result: 200, ms: 1100 },
      { at: now - 38 * MIN, result: 200, ms: 1400 },
      { at: now - 43 * MIN, result: 200, ms: 1000 },
      { at: now - 48 * MIN, result: 200, ms: 1600 },
    ],
  },
  {
    id: "sch_smoke",
    name: "Nightly smoke",
    cron: "0 0 * * *",
    scope: "checkout flow",
    enabled: true,
    lastRun: { at: now - 9 * 60 * MIN, code: "passed" },
    nextRunLabel: "next run at 00:00",
    results: [{ at: now - 9 * 60 * MIN, result: "passed", ms: 4100 }],
  },
];

/* ── Mocks ──────────────────────────────────────────────────────────────── */

const kvRow = (key: string, value: string) => ({ id: `mh_${key}`, key, value, enabled: true, description: "" });

export const mocks: Mock[] = [
  {
    id: "mock_201",
    name: "201 Created",
    routeId: CANON.createUser.id,
    statusCode: 201,
    delayMs: 120,
    enabled: true,
    headers: [kvRow("Content-Type", "application/json"), kvRow("X-Mock", "zestman")],
    body: CANON_RESPONSE,
    recentHits: [
      { at: now - 1 * MIN, caller: "web-app", path: "POST /api/v1/users", status: 201, ms: 3 },
      { at: now - 2 * MIN, caller: "web-app", path: "GET /api/v1/users/:id", status: 200, ms: 2 },
      { at: now - 4 * MIN, caller: "curl", path: "POST /api/v1/users", status: 201, ms: 2 },
    ],
  },
  {
    id: "mock_single",
    name: "Single user",
    routeId: routes.find((r) => r.method === "GET" && r.path === "/api/v1/users/:id")!.id,
    statusCode: 200,
    delayMs: null,
    enabled: true,
    headers: [kvRow("Content-Type", "application/json")],
    body: CANON_RESPONSE,
    recentHits: [],
  },
  {
    id: "mock_order",
    name: "Order stub",
    routeId: routes.find((r) => r.method === "POST" && r.path === "/api/v1/orders")!.id,
    statusCode: 201,
    delayMs: null,
    enabled: false,
    headers: [kvRow("Content-Type", "application/json")],
    body: `{\n  "id": "ord_2214",\n  "status": "created"\n}`,
    recentHits: [],
  },
];

export const mockServerStatus: MockServerStatus = {
  running: true,
  port: 23501,
  url: "http://localhost:23501",
  total: 3,
  enabled: 2,
};

/* ── Spec timeline / drift ──────────────────────────────────────────────── */

export const specCommits: SpecCommit[] = [
  { sha: "a1b2c3d", label: "0.4.0", magnitude: "none" },
  { sha: "b3c4d5e", magnitude: "none" },
  { sha: "c5d6e7f", magnitude: "minor" },
  { sha: "d7e8f90", magnitude: "none" },
  { sha: "e63a8c1", magnitude: "warn" },
  { sha: "f0a1b2c", magnitude: "none" },
  { sha: "a9b8c7d", magnitude: "minor" },
  { sha: "b2c3d4e", magnitude: "none" },
  { sha: "f9e8d7c", magnitude: "breaking" },
];

export const driftChanges: DriftChange[] = [
  {
    id: "dr1",
    verdict: "BREAKING",
    method: "POST",
    path: "/api/v1/orders",
    text: "required field 'total' added to request body",
    fileRef: "orders.schema.ts:24",
  },
  {
    id: "dr2",
    verdict: "ADDED",
    method: "GET",
    path: "/api/v1/orders/:id/receipt",
    text: "new route",
    fileRef: "orders.controller.ts:58",
  },
  { id: "dr3", verdict: "DOCS", method: "PATCH", path: "/orders/:id/status", text: "description changed", fileRef: null },
  {
    id: "dr4",
    verdict: "AUTH",
    method: "GET",
    path: "/api/v1/orders",
    text: "requireAuth added (was public)",
    fileRef: "auth.middleware.ts:9",
  },
];

/* ── Diagnostics / insights ─────────────────────────────────────────────── */

export const diagnostics: Diagnostic[] = [
  {
    id: "dg1",
    level: "error",
    message: "Route path could not be resolved statically — computed from variable",
    source: "routes.ts:88",
    route: null,
    action: "add manualRoute",
  },
  {
    id: "dg2",
    level: "warning",
    message: "Dynamic prefix on router mount",
    source: "app.ts:31",
    route: "/api/v1/*",
    fix: "Add to zestman.config.ts → manualRoutes: [{ method: 'GET', path: '/v1/reports/:id' }]",
  },
  {
    id: "dg3",
    level: "warning",
    message: "Zod schema uses .passthrough() — extra fields allowed",
    source: "users.schema.ts:12",
    route: "POST /users",
  },
  { id: "dg4", level: "info", message: "Route pruned after rescan", source: "watcher", route: null },
  { id: "dg5", level: "info", message: "manualRoute merged", source: "zestman.config.ts:4", route: null },
  { id: "dg6", level: "info", message: "framework classified: express — runtime class", source: "scanner", route: null },
];

export const insights: InsightsBundle = {
  requestsToday: 214,
  hourly: [6, 8, 7, 10, 12, 14, 13, 18, 22, 26, 30, 36],
  errorRate: 0.023,
  errorNote: "5 of 214 · all POST /orders/:id/cancel",
  p95: 112,
  p50: 38,
  latencyBars: [14, 18, 16, 20, 24, 36, 22, 20, 18, 16, 15, 14],
  latencySpikeIdx: 5,
  topRoute: { method: "GET", path: "/api/v1/users", note: "48 hits · p50 38 ms · 0 errors" },
  slowest: { label: "slowest: POST /orders · p95 210 ms" },
};

/* ── Examples / docs ────────────────────────────────────────────────────── */

export const examples: Example[] = [
  {
    id: "ex_201",
    routeId: CANON.createUser.id,
    name: "201 Created",
    status: 201,
    ms: 84,
    bytes: 1229,
    savedAt: now - 2 * MIN,
    body: CANON_RESPONSE,
    usedByMock: true,
    usedBySpec: true,
  },
  {
    id: "ex_409",
    routeId: CANON.createUser.id,
    name: "409 Duplicate",
    status: 409,
    ms: 41,
    bytes: 214,
    savedAt: now - 60 * MIN,
    body: `{\n  "error": "email already exists"\n}`,
    usedByMock: false,
    usedBySpec: false,
  },
];

export const docPages: DocPage[] = [
  { id: "introduction", title: "Introduction", kind: "page" },
  { id: "authentication", title: "Authentication", kind: "page" },
  { id: "errors", title: "Errors", kind: "page" },
];
