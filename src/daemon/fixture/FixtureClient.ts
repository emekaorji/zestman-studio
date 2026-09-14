import type {
  DaemonClient,
  DaemonEvents,
  DocPageContent,
  RunHandle,
  SendHandle,
  Unsubscribe,
  WsSessionHandle,
} from "../client";
import type {
  GitInfo,
  CheckDetail,
  CodeSnippet,
  DocPage,
  ExecResult,
  Flow,
  HistoryEntry,
  OperatorEvent,
  Route,
  RunEvent,
  RunItem,
  ScanEvent,
  SendEvent,
  WsEvent,
  XrayLink,
} from "../types";
import type { ImportResult } from "../wire";
import { routes as case1Routes, sourceFiles as case1Files, CANON } from "@/fixtures/case1/routes";
import * as fx from "@/fixtures/case1/data";
import { clockTime } from "@/lib/format";
import { id } from "@/lib/ids";

/* ── deterministic-ish timing, freezable for screenshot QA ──────────────── */

let frozen = false;
export function freezeFixtures(v: boolean) {
  frozen = v;
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, frozen ? 0 : ms));

/* ── canned responses ───────────────────────────────────────────────────── */

interface Canned {
  status: number;
  ms: number;
  body: string;
  tests?: ExecResult["tests"];
  consoleLines?: string[];
}

function cannedFor(route: Route): Canned {
  if (route.id === CANON.cancelOrder.id) {
    return {
      status: 500,
      ms: 121,
      body: `{\n  "error": "body.total is required"\n}`,
      tests: [
        { name: "status is 201", passed: false, error: "expected 500 to equal 201" },
        { name: "response under 500 ms", passed: true },
      ],
      consoleLines: ["ZodError: body.total is required", "  at orders.schema.parse (orders.schema.ts:24)"],
    };
  }
  if (route.id === CANON.listProducts.id) {
    return {
      status: 200,
      ms: 1400,
      body: `[\n  { "id": "prd_101", "name": "Relay board", "price": 129.0 },\n  { "id": "prd_102", "name": "Sensor kit", "price": 59.0 }\n]`,
    };
  }
  if (route.method === "POST" && route.path === "/api/v1/users") {
    return {
      status: 201,
      ms: 84,
      body: fx.CANON_RESPONSE,
      tests: [
        { name: "status is 201", passed: true },
        { name: "response under 500 ms", passed: true },
      ],
      consoleLines: ["created usr_8f3k2", "token refreshed"],
    };
  }
  if (route.method === "DELETE") return { status: 204, ms: 41, body: "" };
  if (route.method === "POST") return { status: 201, ms: 96, body: `{\n  "id": "new_2214",\n  "status": "created"\n}` };
  return { status: 200, ms: 30 + Math.floor(Math.random() * 40), body: fx.CANON_RESPONSE };
}

function toResult(route: Route, canned: Canned): ExecResult {
  const label =
    canned.status === 201 ? "201 Created" : canned.status === 204 ? "204 No Content" : canned.status === 500 ? "500 Error" : `${canned.status} OK`;
  const dl = Math.max(2, Math.round(canned.ms * 0.2));
  return {
    status: canned.status,
    statusLabel: label,
    headers: [
      { key: "content-type", value: "application/json" },
      { key: "x-request-id", value: "req_9d2f" },
      { key: "date", value: new Date().toUTCString() },
    ],
    cookies: [],
    body: canned.body,
    bodyKind: "json",
    ms: canned.ms,
    bytes: canned.body.length + 180,
    at: Date.now(),
    timeline: [
      { name: "dns", ms: 1 },
      { name: "connect", ms: 4 },
      { name: "ttfb", ms: canned.ms - dl - 5 },
      { name: "download", ms: dl },
    ],
    tests: canned.tests ?? [],
    consoleLines: canned.consoleLines ?? [],
  };
}

/* ── the client ─────────────────────────────────────────────────────────── */

type Handler<K extends keyof DaemonEvents> = (payload: DaemonEvents[K]) => void;

export class FixtureClient implements DaemonClient {
  private handlers: { [K in keyof DaemonEvents]: Set<Handler<K>> } = {
    "tap:entry": new Set(),
    "watcher:change": new Set(),
    "mock:status": new Set(),
    "routes:updated": new Set(),
    "diagnostics:updated": new Set(),
    "projects:changed": new Set(),
    "instance:online": new Set(),
    "instance:offline": new Set(),
    connection: new Set(),
  };
  private timers: ReturnType<typeof setInterval | typeof setTimeout>[] = [];
  private tapSeq = 0;
  private db = {
    routes: structuredClone(case1Routes),
    files: structuredClone(case1Files),
    environments: structuredClone(fx.environments),
    globals: structuredClone(fx.globals),
    cookies: structuredClone(fx.cookies),
    mocks: structuredClone(fx.mocks),
    schedules: structuredClone(fx.schedules),
    flows: structuredClone(fx.flows),
    examples: structuredClone(fx.examples),
    history: structuredClone(fx.historyToday),
    oauthTokens: structuredClone(fx.oauthTokens),
    docPages: structuredClone(fx.docPages),
    docContent: {} as Record<string, string>,
  };

  constructor(private projectId: string) {}

  startLiveTap() {
    const pool = ["GET /api/v1/users", "GET /api/v1/orders", "POST /api/v1/users", "GET /health", "GET /api/v1/products"];
    const timer = setInterval(() => {
      if (frozen) return;
      const pick = pool[this.tapSeq % pool.length];
      this.tapSeq += 1;
      const [method, path] = pick.split(" ");
      const route = this.db.routes.find((r) => r.method === method && r.path === path);
      const entry: HistoryEntry = {
        id: id("tap"),
        at: Date.now(),
        method,
        path,
        url: `http://localhost:3000${path}`,
        routeId: route?.id ?? null,
        status: method === "POST" ? 201 : 200,
        ms: 20 + Math.round(Math.random() * 80),
        bytes: 900 + Math.round(Math.random() * 600),
        caller: this.tapSeq % 3 === 0 ? "curl" : "web-app",
        requestHeaders: [],
        requestBody: null,
        responseHeaders: [],
        responseBody: "",
      };
      this.handlers["tap:entry"].forEach((h) => h(entry));
    }, 3200);
    this.timers.push(timer);

    const once = setTimeout(() => {
      this.handlers["watcher:change"].forEach((h) =>
        h({ file: "posts.controller.ts", note: "Rescanned — 1 route added · 0 pruned" }),
      );
    }, 18_000);
    this.timers.push(once);
  }

  /* reads */
  async listProjects() {
    await sleep(60);
    return [
      {
        id: "case1",
        name: "test-backend-case-1",
        framework: "express",
        rootPath: "~/dev/test-backend-case-1",
        routeCount: 27,
        fileCount: 35,
        online: true,
      },
      {
        id: "pixel-relay",
        name: "pixel-relay",
        framework: "express",
        rootPath: "~/dev/pixel-relay",
        routeCount: 6,
        fileCount: 9,
        online: true,
      },
    ];
  }
  async listRoutes() {
    await sleep(80);
    if (this.projectId === "pixel-relay") return this.db.routes.slice(0, 6);
    return structuredClone(this.db.routes);
  }
  async listSourceFiles() {
    await sleep(40);
    if (this.projectId === "pixel-relay") {
      // Must stay coherent with listRoutes(): the 6 sliced routes live in these two files.
      return structuredClone(
        this.db.files.filter((f) => f.id === "f_users.controller.ts" || f.id === "f_posts.controller.ts"),
      );
    }
    return structuredClone(this.db.files);
  }
  async updateRoute(routeId: string, patch: Partial<Route>) {
    const i = this.db.routes.findIndex((r) => r.id === routeId);
    if (i >= 0) this.db.routes[i] = { ...this.db.routes[i], ...patch, updatedAt: Date.now() };
    return structuredClone(this.db.routes[i]);
  }
  async createRoute(partial: Partial<Route>) {
    const route: Route = {
      ...structuredClone(CANON.createUser),
      ...partial,
      id: partial.id ?? id("rt"),
      provenance: partial.provenance ?? "manual",
      sourceLocations: partial.sourceLocations ?? [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.db.routes.push(route);
    return structuredClone(route);
  }
  async deleteRoute(routeId: string) {
    this.db.routes = this.db.routes.filter((r) => r.id !== routeId);
  }

  async listEnvironments() {
    await sleep(40);
    return structuredClone(this.db.environments);
  }
  async saveEnvironments(envs: typeof fx.environments) {
    this.db.environments = structuredClone(envs);
  }
  async getGlobals() {
    return structuredClone(this.db.globals);
  }
  async saveGlobals(vars: typeof fx.globals) {
    this.db.globals = structuredClone(vars);
  }
  async listVaultRefs() {
    return structuredClone(fx.vaultRefs);
  }
  async listDynamicVars() {
    return structuredClone(fx.dynamicVars);
  }
  async listCookies() {
    return structuredClone(this.db.cookies);
  }
  async saveCookies(rows: typeof fx.cookies) {
    this.db.cookies = structuredClone(rows);
  }
  async listOAuthTokens() {
    return structuredClone(this.db.oauthTokens);
  }
  async saveOAuthTokens(rows: typeof fx.oauthTokens) {
    this.db.oauthTokens = structuredClone(rows);
  }

  async listHistoryDays() {
    return fx.historyDaysMeta.map((d, i) => ({
      date: d.date,
      count: d.count,
      entryIds: i === 0 ? this.db.history.map((e) => e.id) : [],
    }));
  }
  async listHistoryEntries() {
    return structuredClone(this.db.history);
  }
  async clearHistory() {
    this.db.history = [];
  }

  async listChecks() {
    await sleep(60);
    return structuredClone(fx.routeChecks);
  }
  async getCheckDetail(routeId: string, type: string): Promise<CheckDetail> {
    const failing = routeId === CANON.cancelOrder.id && type === "schema";
    return {
      routeId,
      type: type as CheckDetail["type"],
      failing,
      provenance: "orders.schema.ts:18",
      requestBody: `{\n  "reason": "customer",\n  "notify": true\n}`,
      responseBody: `{\n  "error": "body.total is required"\n}`,
      responseStatus: failing ? 500 : 200,
      assertion: "expect(status).toBeOneOf([201, 400])",
      received: "received: 500",
    };
  }
  async runChecks(routeIds?: string[]) {
    await sleep(120);
    const all = structuredClone(fx.routeChecks);
    return routeIds ? all.filter((c) => routeIds.includes(c.routeId)) : all;
  }
  async listFlows() {
    return structuredClone(this.db.flows);
  }
  async saveFlow(f: Flow) {
    const i = this.db.flows.findIndex((x) => x.id === f.id);
    if (i >= 0) this.db.flows[i] = structuredClone(f);
    else this.db.flows.push(structuredClone(f));
    return structuredClone(f);
  }
  async deleteFlow(flowId: string) {
    this.db.flows = this.db.flows.filter((x) => x.id !== flowId);
  }
  async runFlow(flowId: string) {
    await sleep(300);
    const i = this.db.flows.findIndex((x) => x.id === flowId);
    if (i < 0) throw new Error(`flow ${flowId} not found`);
    const flow = this.db.flows[i];
    const steps = flow.steps.map((st) => {
      const route = this.db.routes.find((r) => r.id === st.routeId);
      const canned = route ? cannedFor(route) : { status: 200, ms: 30, body: "" };
      const fail = canned.status >= 500;
      return { ...st, runState: fail ? ("fail" as const) : ("pass" as const), ms: canned.ms, failNote: fail ? canned.body : undefined };
    });
    const passed = steps.filter((st) => st.runState === "pass").length;
    this.db.flows[i] = { ...flow, steps, lastRun: { at: Date.now(), passed, total: steps.length } };
    return structuredClone(this.db.flows[i]);
  }
  async listSchedules() {
    return structuredClone(this.db.schedules);
  }
  async saveSchedule(s: (typeof fx.schedules)[number]) {
    const i = this.db.schedules.findIndex((x) => x.id === s.id);
    if (i >= 0) this.db.schedules[i] = structuredClone(s);
    else this.db.schedules.push(structuredClone(s));
    return structuredClone(s);
  }
  async deleteSchedule(id: string) {
    this.db.schedules = this.db.schedules.filter((x) => x.id !== id);
  }
  async runSchedule(scheduleId: string) {
    const i = this.db.schedules.findIndex((x) => x.id === scheduleId);
    if (i < 0) throw new Error(`schedule ${scheduleId} not found`);
    const sch = this.db.schedules[i];
    const at = Date.now();
    this.db.schedules[i] = {
      ...sch,
      lastRun: { at, code: "passed" },
      results: [{ at, result: "passed" as const, ms: 240 }, ...sch.results].slice(0, 10),
    };
    return structuredClone(this.db.schedules[i]);
  }

  async listMocks() {
    return structuredClone(this.db.mocks);
  }
  async saveMock(m: (typeof fx.mocks)[number]) {
    const i = this.db.mocks.findIndex((x) => x.id === m.id);
    if (i >= 0) this.db.mocks[i] = structuredClone(m);
    else this.db.mocks.push(structuredClone(m));
    return structuredClone(m);
  }
  async deleteMock(mockId: string) {
    this.db.mocks = this.db.mocks.filter((x) => x.id !== mockId);
  }
  async getMockServerStatus() {
    const enabled = this.db.mocks.filter((m) => m.enabled).length;
    return { ...fx.mockServerStatus, total: this.db.mocks.length, enabled };
  }

  async getOpenApi(): Promise<unknown> {
    const paths: Record<string, Record<string, unknown>> = {};
    for (const r of this.db.routes.filter((x) => x.protocol === "http")) {
      const key = r.path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
      paths[key] = { ...(paths[key] ?? {}), [r.method.toLowerCase()]: { summary: r.name, tags: r.tags } };
    }
    return { openapi: "3.0.3", info: { title: this.projectId, version: "1.0.0" }, paths };
  }
  async regenerateSpec() {
    await sleep(200);
    return { operations: this.db.routes.filter((x) => x.protocol === "http").length };
  }
  async getSpecCommits() {
    return structuredClone(fx.specCommits);
  }
  async getDriftChanges() {
    return structuredClone(fx.driftChanges);
  }
  async getGitInfo(): Promise<GitInfo> {
    return { isRepo: true, branch: "main", head: "a1b2c3d", specDirty: false };
  }
  async getDiagnostics() {
    return structuredClone(fx.diagnostics);
  }
  async getInsights() {
    return structuredClone(fx.insights);
  }
  async listExamples(routeId?: string) {
    const all = structuredClone(this.db.examples);
    return routeId ? all.filter((e) => e.routeId === routeId) : all;
  }
  async saveExample(e: (typeof fx.examples)[number]) {
    this.db.examples.push(structuredClone(e));
    return structuredClone(e);
  }
  async deleteExample(id: string) {
    this.db.examples = this.db.examples.filter((x) => x.id !== id);
  }
  async listDocPages() {
    return structuredClone(this.db.docPages);
  }
  async getDocPage(pageId: string): Promise<DocPageContent> {
    const page = this.db.docPages.find((p) => p.id === pageId);
    if (!page) throw new Error(`doc page ${pageId} not found`);
    return { ...page, content: this.db.docContent[pageId] ?? "" };
  }
  async saveDocPage(pageId: string, patch: { title?: string; content: string }): Promise<DocPage> {
    const i = this.db.docPages.findIndex((p) => p.id === pageId);
    if (i < 0) throw new Error(`doc page ${pageId} not found`);
    if (patch.title) this.db.docPages[i] = { ...this.db.docPages[i], title: patch.title };
    this.db.docContent[pageId] = patch.content;
    return structuredClone(this.db.docPages[i]);
  }

  /* import / export / source */
  async importPostman(): Promise<ImportResult> {
    return { routes: 0, warnings: ["fixture client does not parse collections"] };
  }
  async importOpenApi(): Promise<ImportResult> {
    return { routes: 0, warnings: ["fixture client does not parse specs"] };
  }
  async importCurl(text: string): Promise<Route> {
    const method = /-X\s+([A-Z]+)/.exec(text)?.[1] ?? "GET";
    const url = /https?:\/\/[^\s'"]+/.exec(text)?.[0] ?? "http://localhost:3000/";
    const path = new URL(url).pathname;
    return this.createRoute({ method: method as Route["method"], path, name: `${method} ${path}`, provenance: "manual" });
  }
  async exportPostman(): Promise<unknown> {
    return { collection: { info: { name: this.projectId }, item: [] }, environments: structuredClone(this.db.environments) };
  }
  async openSource() {
    /* nothing to open in a fixture */
  }
  async applyOperatorFix(cardId: string): Promise<{ ok: true; file: string }> {
    return { ok: true, file: `.zestman/operator/${cardId}.json` };
  }
  async uploadFile(file: File) {
    return { fileId: `fx_${file.name}`, fileName: file.name, size: file.size, contentType: file.type || "application/octet-stream" };
  }
  async introspectGraphql() {
    return { status: 200, typeCount: 42, types: [] };
  }
  async fetchOAuthToken() {
    return { active: true, expiresInMin: 52, masked: "••••9f2" };
  }

  async getSnippet(routeId: string, language: string): Promise<CodeSnippet> {
    const route = this.db.routes.find((r) => r.id === routeId) ?? CANON.createUser;
    if (language === "curl") {
      return {
        language: "cURL",
        variant: "",
        lines: [
          { text: "curl -X " + route.method + " \\", tone: "plain" },
          { text: `  'http://localhost:3000${route.path}' \\`, tone: "str" },
          { text: "  -H 'content-type: application/json' \\", tone: "plain" },
          { text: "  -H 'authorization: Bearer ····9f2' \\", tone: "plain" },
          { text: `  -d '{ "name": "Ada Lovelace",`, tone: "str" },
          { text: `        "email": "ada@example.dev",`, tone: "str" },
          { text: `        "role": "member" }'`, tone: "str" },
        ],
      };
    }
    return {
      language: "TypeScript",
      variant: "axios",
      lines: [
        { text: 'import axios from "axios"', tone: "key" },
        { text: "", tone: "plain" },
        { text: `await axios.${route.method.toLowerCase()}(`, tone: "plain" },
        { text: `  "{{baseUrl}}${route.path}",`, tone: "str" },
        { text: `  { name: "Ada Lovelace",`, tone: "str" },
        { text: `    email: "ada@example.dev",`, tone: "str" },
        { text: `    role: "member" }`, tone: "str" },
        { text: ")", tone: "plain" },
      ],
    };
  }

  async getXray(routeId: string) {
    const route = this.db.routes.find((r) => r.id === routeId) ?? CANON.createUser;
    const links: XrayLink[] = [
      { step: "Route declared", fileRef: route.sourceLocations[0]?.file ?? "users.controller.ts:22", icon: "route" },
      { step: "Mounted at /api/v1", fileRef: "app.ts:31", icon: "corner-down-right" },
      { step: "Middleware requireAuth", fileRef: "middleware/auth.ts:9", icon: "shield" },
      { step: "Body schema (Zod)", fileRef: route.schemaRef ?? "users.schema.ts:12", icon: "braces" },
      { step: "Response inferred", fileRef: "users.controller.ts:31", icon: "file-output" },
    ];
    const inferred = route.provenance === "inferred";
    return {
      confidence: inferred ? "INFERRED" : "CERTAIN",
      links,
      weakest: inferred ? "route path computed from variable — verify at runtime" : "all links static — no runtime guess",
    };
  }

  /* execution */
  send(routeId: string, _draft?: unknown, _resolvedUrl?: string): SendHandle {
    const route = this.db.routes.find((r) => r.id === routeId) ?? CANON.createUser;
    let cancelled = false;
    const db = this.db;
    async function* gen(): AsyncGenerator<SendEvent> {
      const canned = cannedFor(route);
      yield { t: "start" };
      await sleep(Math.min(600, canned.ms));
      if (cancelled) {
        const res = toResult(route, { ...canned, status: 0, body: "" });
        res.statusLabel = "ERR";
        res.errorMessage = "Request cancelled";
        yield { t: "error", result: res };
        return;
      }
      const result = toResult(route, canned);
      db.history.unshift({
        id: id("h"),
        at: Date.now(),
        method: route.method,
        path: route.path,
        url: `http://localhost:3000${route.path.replace(":id", "8412")}`,
        routeId: route.id,
        status: result.status,
        ms: result.ms,
        bytes: result.bytes,
        requestHeaders: route.headers.map((h) => ({ key: h.key, value: h.value })),
        requestBody: route.body.mode === "raw" ? route.body.raw.text : null,
        responseHeaders: result.headers,
        responseBody: result.body,
      });
      yield { t: "done", result };
    }
    return { events: gen(), cancel: () => (cancelled = true) };
  }

  runAll(iterations: number, routeIds?: string[]): RunHandle {
    const httpRoutes = this.db.routes.filter((r) => r.protocol === "http" && (!routeIds || routeIds.includes(r.id)));
    let cancelled = false;
    async function* gen(): AsyncGenerator<RunEvent> {
      let ok = 0;
      let failed = 0;
      const t0 = Date.now();
      for (let it = 1; it <= iterations; it += 1) {
        for (const route of httpRoutes) {
          if (cancelled) return;
          yield { t: "item", item: { routeId: route.id, iteration: it, status: "running" } };
          await sleep(60 + Math.random() * 120);
          const canned = cannedFor(route);
          const fail = canned.status >= 500;
          if (fail) failed += 1;
          else ok += 1;
          const item: RunItem = {
            routeId: route.id,
            iteration: it,
            status: fail ? "fail" : "pass",
            code: canned.status,
            ms: canned.ms,
            note: fail ? "body.total is required" : undefined,
          };
          yield { t: "item", item };
        }
      }
      yield {
        t: "done",
        summary: { ok, failed, testsPass: ok * 2 - 4, testsFail: failed * 2, totalMs: Date.now() - t0 },
      };
    }
    return { events: gen(), cancel: () => (cancelled = true) };
  }

  openWsSession(): WsSessionHandle {
    let push: ((e: WsEvent) => void) | null = null;
    const queue: WsEvent[] = [];
    const emit = (e: WsEvent) => {
      if (push) push(e);
      else queue.push(e);
    };
    let closed = false;
    emit({ t: "system", text: "connected to wss://echo.websocket.events", at: Date.now() });
    emit({ t: "status", connected: true });
    const events: AsyncIterable<WsEvent> = {
      [Symbol.asyncIterator]() {
        return {
          next: () =>
            new Promise<IteratorResult<WsEvent>>((resolve) => {
              const q = queue.shift();
              if (q) return resolve({ value: q, done: false });
              if (closed) return resolve({ value: undefined, done: true });
              push = (e) => {
                push = null;
                resolve({ value: e, done: false });
              };
            }),
        };
      },
    };
    return {
      send: (text) => {
        emit({ t: "sent", text, at: Date.now() });
        setTimeout(() => {
          if (!closed) emit({ t: "recv", text, at: Date.now() });
        }, frozen ? 0 : 300);
      },
      close: () => {
        closed = true;
        emit({ t: "status", connected: false });
      },
      events,
    };
  }

  async *operatorRun(prompt: string, _context?: { routeId?: string }): AsyncGenerator<OperatorEvent> {
    yield { t: "thinking", on: true };
    await sleep(700);
    yield { t: "thinking", on: false };
    yield { t: "card", kind: "ran-check", title: "RAN CHECK", body: "schema · POST /orders/:id/cancel", pill: "500" };
    await sleep(600);
    yield { t: "card", kind: "read-source", title: "READ SOURCE", body: "orders.controller.ts:46-58" };
    await sleep(700);
    yield {
      t: "card",
      kind: "proposed-fix",
      title: "PROPOSED FIX",
      body: prompt.includes("doc") ? "draft docs for changed endpoints" : "~ .zestman/routes/…/cancel/post.json",
      diff: [
        { line: "~ .zestman/routes/…/cancel/post.json", tone: "ctx" },
        { line: '+ "total": 1200', tone: "add" },
        { line: "- (missing)", tone: "del" },
      ],
      cardId: "fx_card_1",
    };
    yield { t: "done" };
  }

  async *startScan(): AsyncGenerator<ScanEvent> {
    const files = [
      "src/modules/users/users.controller.ts",
      "src/modules/posts/posts.controller.ts",
      "src/modules/orders/orders.controller.ts",
      "src/modules/categories/categories.controller.ts",
      "src/modules/products/products.controller.ts",
      "src/app.ts",
    ];
    let routesFound = 0;
    for (let i = 0; i < files.length; i += 1) {
      yield { t: "file", path: files[i], state: "active" };
      await sleep(260);
      routesFound += [5, 6, 5, 5, 5, 1][i];
      yield { t: "file", path: files[i], state: "done" };
      yield { t: "stat", routes: routesFound, schemas: Math.min(11, Math.round(routesFound * 0.42)), auth: Math.min(9, Math.round(routesFound * 0.34)) };
      yield { t: "progress", pct: Math.round(((i + 1) / files.length) * 100), files: 35, seconds: 1.8 };
    }
    yield { t: "done" };
  }

  on<K extends keyof DaemonEvents>(event: K, handler: Handler<K>): Unsubscribe {
    this.handlers[event].add(handler);
    return () => this.handlers[event].delete(handler);
  }

  dispose() {
    this.timers.forEach((t) => clearTimeout(t as never));
    this.timers = [];
    (Object.keys(this.handlers) as (keyof DaemonEvents)[]).forEach((k) => this.handlers[k].clear());
  }
}

export { clockTime };
