import type {
  ConnectionState,
  DaemonClient,
  DaemonEvents,
  DocPageContent,
  GraphqlIntrospection,
  OAuthTokenState,
  UploadedFile,
  RunHandle,
  SendHandle,
  Unsubscribe,
  WsSessionHandle,
  XrayResult,
} from "../client";
import type {
  CheckDetail,
  CodeSnippet,
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
} from "../types";
import {
  daemonHttpBase,
  daemonWsUrl,
  type ConnectionInfo,
  type DaemonToStudio,
  type ImportResult,
  type StreamEvent,
  type StreamKind,
  type StudioToDaemon,
} from "../wire";
import { AsyncQueue } from "./asyncQueue";

/** A non-2xx answer from the daemon. `status` 0 means the request never got through. */
export class DaemonHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly path: string,
  ) {
    super(message);
    this.name = "DaemonHttpError";
  }
}

export interface HttpDaemonClientHooks {
  /** A REST call failed with a daemon-supplied message — surface it (toast). */
  onError?: (message: string, context: string) => void;
}

/** Events that are not scoped to one project. */
const GLOBAL_EVENTS = new Set<string>(["projects:changed", "instance:online", "instance:offline"]);

const RECONNECT_MIN_MS = 500;
const RECONNECT_MAX_MS = 10_000;

type Handler = (payload: unknown) => void;

interface ActiveStream {
  queue: AsyncQueue<StreamEvent>;
  /** The daemon has already sent `end` / `error` — no `cancel` needed. */
  finished: boolean;
}

/**
 * `DaemonClient` over the daemon's REST API plus one shared, lazily opened,
 * auto-reconnecting WebSocket for events and streams.
 */
export class HttpDaemonClient implements DaemonClient {
  private readonly base: string;
  private readonly wsUrl: string;
  private readonly token: string;

  private socket: WebSocket | null = null;
  private authed = false;
  private disposed = false;
  private connState: ConnectionState = "closed";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = RECONNECT_MIN_MS;

  /** Frames written before the socket is authenticated. */
  private outbox: string[] = [];
  private streams = new Map<string, ActiveStream>();
  private handlers = new Map<keyof DaemonEvents, Set<Handler>>();
  private seq = 0;

  constructor(
    conn: ConnectionInfo,
    private readonly projectId: string,
    private readonly hooks: HttpDaemonClientHooks = {},
  ) {
    this.base = daemonHttpBase(conn);
    this.wsUrl = daemonWsUrl(conn);
    this.token = conn.token;
  }

  /* ── HTTP ─────────────────────────────────────────────────────────────── */

  async request<T>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { authorization: `Bearer ${this.token}` };
    if (body !== undefined) headers["content-type"] = "application/json";

    let res: Response;
    try {
      res = await fetch(this.base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new DaemonHttpError(`Daemon unreachable — ${message}`, 0, path);
    }

    if (!res.ok) {
      let message = `${res.status} ${res.statusText || "error"}`;
      try {
        const parsed = (await res.json()) as { error?: unknown };
        if (parsed && typeof parsed.error === "string") message = parsed.error;
      } catch {
        /* no JSON body — keep the status line */
      }
      this.hooks.onError?.(message, `${method} ${path}`);
      throw new DaemonHttpError(message, res.status, path);
    }

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  /** `/api/p/<project>/…` */
  private p(path: string): string {
    return `/api/p/${encodeURIComponent(this.projectId)}${path}`;
  }

  /* ── projects ─────────────────────────────────────────────────────────── */

  listProjects() {
    return this.request<ProjectSummary[]>("GET", "/api/projects");
  }

  /* ── routes ───────────────────────────────────────────────────────────── */

  listRoutes() {
    return this.request<Route[]>("GET", this.p("/routes"));
  }
  listSourceFiles() {
    return this.request<SourceFile[]>("GET", this.p("/source-files"));
  }
  createRoute(partial: Partial<Route>) {
    return this.request<Route>("POST", this.p("/routes"), partial);
  }
  updateRoute(id: string, patch: Partial<Route>) {
    return this.request<Route>("PATCH", this.p(`/routes/${encodeURIComponent(id)}`), patch);
  }
  async deleteRoute(id: string) {
    await this.request<{ ok: true }>("DELETE", this.p(`/routes/${encodeURIComponent(id)}`));
  }

  /* ── environments / secrets ───────────────────────────────────────────── */

  listEnvironments() {
    return this.request<Environment[]>("GET", this.p("/environments"));
  }
  async saveEnvironments(envs: Environment[]) {
    await this.request<Environment[]>("PUT", this.p("/environments"), envs);
  }
  getGlobals() {
    return this.request<EnvVar[]>("GET", this.p("/globals"));
  }
  async saveGlobals(vars: EnvVar[]) {
    await this.request<EnvVar[]>("PUT", this.p("/globals"), vars);
  }
  listVaultRefs() {
    return this.request<VaultRef[]>("GET", this.p("/vault"));
  }
  listDynamicVars() {
    return this.request<DynamicVar[]>("GET", "/api/dynamic-vars");
  }
  listCookies() {
    return this.request<CookieRow[]>("GET", this.p("/cookies"));
  }
  async saveCookies(rows: CookieRow[]) {
    await this.request<CookieRow[]>("PUT", this.p("/cookies"), rows);
  }
  listOAuthTokens() {
    return this.request<OAuthTokenRow[]>("GET", this.p("/oauth-tokens"));
  }
  async saveOAuthTokens(rows: OAuthTokenRow[]) {
    await this.request<OAuthTokenRow[]>("PUT", this.p("/oauth-tokens"), rows);
  }

  /* ── history ──────────────────────────────────────────────────────────── */

  listHistoryDays() {
    return this.request<HistoryDay[]>("GET", this.p("/history/days"));
  }
  listHistoryEntries() {
    return this.request<HistoryEntry[]>("GET", this.p("/history?limit=500"));
  }
  async clearHistory() {
    await this.request<{ ok: true }>("DELETE", this.p("/history"));
  }

  /* ── tests ────────────────────────────────────────────────────────────── */

  listChecks() {
    return this.request<RouteChecks[]>("GET", this.p("/checks"));
  }
  getCheckDetail(routeId: string, type: string) {
    return this.request<CheckDetail>(
      "GET",
      this.p(`/checks/${encodeURIComponent(routeId)}/${encodeURIComponent(type)}`),
    );
  }
  runChecks(routeIds?: string[]) {
    return this.request<RouteChecks[]>("POST", this.p("/checks/run"), routeIds ? { routeIds } : {});
  }
  listFlows() {
    return this.request<Flow[]>("GET", this.p("/flows"));
  }
  saveFlow(f: Flow) {
    return this.request<Flow>("PUT", this.p(`/flows/${encodeURIComponent(f.id)}`), f);
  }
  async deleteFlow(id: string) {
    await this.request<{ ok: true }>("DELETE", this.p(`/flows/${encodeURIComponent(id)}`));
  }
  runFlow(id: string) {
    return this.request<Flow>("POST", this.p(`/flows/${encodeURIComponent(id)}/run`));
  }
  listSchedules() {
    return this.request<Schedule[]>("GET", this.p("/schedules"));
  }
  saveSchedule(s: Schedule) {
    return this.request<Schedule>("PUT", this.p(`/schedules/${encodeURIComponent(s.id)}`), s);
  }
  async deleteSchedule(id: string) {
    await this.request<{ ok: true }>("DELETE", this.p(`/schedules/${encodeURIComponent(id)}`));
  }
  runSchedule(id: string) {
    return this.request<Schedule>("POST", this.p(`/schedules/${encodeURIComponent(id)}/run`));
  }

  /* ── mocks ────────────────────────────────────────────────────────────── */

  listMocks() {
    return this.request<Mock[]>("GET", this.p("/mocks"));
  }
  saveMock(m: Mock) {
    return this.request<Mock>("PUT", this.p(`/mocks/${encodeURIComponent(m.id)}`), m);
  }
  async deleteMock(id: string) {
    await this.request<{ ok: true }>("DELETE", this.p(`/mocks/${encodeURIComponent(id)}`));
  }
  getMockServerStatus() {
    return this.request<MockServerStatus>("GET", this.p("/mock-server"));
  }

  /* ── spec / insights / docs ───────────────────────────────────────────── */

  getOpenApi() {
    return this.request<unknown>("GET", this.p("/spec"));
  }
  getSpecCommits() {
    return this.request<SpecCommit[]>("GET", this.p("/spec/commits"));
  }
  getDriftChanges() {
    return this.request<DriftChange[]>("GET", this.p("/spec/drift"));
  }
  getGitInfo() {
    return this.request<GitInfo>("GET", this.p("/git"));
  }
  regenerateSpec() {
    return this.request<{ operations: number }>("POST", this.p("/spec/regenerate"));
  }
  getDiagnostics() {
    return this.request<Diagnostic[]>("GET", this.p("/diagnostics"));
  }
  getInsights() {
    return this.request<InsightsBundle>("GET", this.p("/insights"));
  }
  listExamples(routeId?: string) {
    const qs = routeId ? `?routeId=${encodeURIComponent(routeId)}` : "";
    return this.request<Example[]>("GET", this.p(`/examples${qs}`));
  }
  saveExample(e: Example) {
    return this.request<Example>("PUT", this.p(`/examples/${encodeURIComponent(e.id)}`), e);
  }
  async deleteExample(id: string) {
    await this.request<{ ok: true }>("DELETE", this.p(`/examples/${encodeURIComponent(id)}`));
  }
  listDocPages() {
    return this.request<DocPage[]>("GET", this.p("/docs/pages"));
  }
  getDocPage(id: string) {
    return this.request<DocPageContent>("GET", this.p(`/docs/pages/${encodeURIComponent(id)}`));
  }
  saveDocPage(id: string, patch: { title?: string; content: string }) {
    return this.request<DocPage>("PUT", this.p(`/docs/pages/${encodeURIComponent(id)}`), patch);
  }

  getSnippet(routeId: string, language: string) {
    return this.request<CodeSnippet>(
      "GET",
      this.p(`/snippet?routeId=${encodeURIComponent(routeId)}&language=${encodeURIComponent(language)}`),
    );
  }
  getXray(routeId: string) {
    return this.request<XrayResult>("GET", this.p(`/xray/${encodeURIComponent(routeId)}`));
  }

  /* ── import / export / source ─────────────────────────────────────────── */

  importPostman(text: string) {
    return this.request<ImportResult>("POST", this.p("/import/postman"), { text });
  }
  importOpenApi(input: { text?: string; url?: string }) {
    return this.request<ImportResult>("POST", this.p("/import/openapi"), input);
  }
  importCurl(text: string) {
    return this.request<Route>("POST", this.p("/import/curl"), { text });
  }
  exportPostman() {
    return this.request<unknown>("GET", this.p("/export/postman"));
  }
  async openSource(file: string, line?: number) {
    await this.request<{ ok: true }>("POST", this.p("/open-source"), line != null ? { file, line } : { file });
  }
  applyOperatorFix(cardId: string) {
    return this.request<{ ok: true; file: string }>("POST", this.p("/operator/apply"), { cardId });
  }
  async uploadFile(file: File): Promise<UploadedFile> {
    const form = new FormData();
    form.append("file", file, file.name);
    const path = this.p("/files");
    let res: Response;
    try {
      res = await fetch(this.base + path, { method: "POST", headers: { authorization: `Bearer ${this.token}` }, body: form });
    } catch (e) {
      throw new DaemonHttpError(`Daemon unreachable — ${e instanceof Error ? e.message : String(e)}`, 0, path);
    }
    if (!res.ok) {
      let message = `${res.status} ${res.statusText || "error"}`;
      try {
        const parsed = (await res.json()) as { error?: unknown };
        if (parsed && typeof parsed.error === "string") message = parsed.error;
      } catch {
        /* keep the status line */
      }
      this.hooks.onError?.(message, `POST ${path}`);
      throw new DaemonHttpError(message, res.status, path);
    }
    return (await res.json()) as UploadedFile;
  }
  introspectGraphql(url: string, headers?: Record<string, string>) {
    return this.request<GraphqlIntrospection>("POST", this.p("/graphql/introspect"), { url, headers: headers ?? {} });
  }
  fetchOAuthToken(routeId: string, draft: RequestDraft) {
    return this.request<OAuthTokenState>("POST", this.p("/oauth2/token"), { routeId, draft });
  }

  /* ── streams ──────────────────────────────────────────────────────────── */

  send(routeId: string, draft: RequestDraft, resolvedUrl: string): SendHandle {
    const { id, queue } = this.startStream<SendEvent>("send", { routeId, draft, resolvedUrl });
    return { events: queue, cancel: () => this.cancelStream(id) };
  }

  runAll(iterations: number, routeIds?: string[]): RunHandle {
    const { id, queue } = this.startStream<RunEvent>("run", routeIds ? { iterations, routeIds } : { iterations });
    return { events: queue, cancel: () => this.cancelStream(id) };
  }

  openWsSession(routeId: string): WsSessionHandle {
    const { id, queue } = this.startStream<WsEvent>("ws", { routeId });
    return {
      events: queue,
      send: (text) => this.write({ t: "input", id, text }),
      close: () => {
        this.write({ t: "close", id });
        this.finishStream(id);
      },
    };
  }

  operatorRun(prompt: string, context?: { routeId?: string }): AsyncIterable<OperatorEvent> {
    return this.startStream<OperatorEvent>("operator", context ? { prompt, context } : { prompt }).queue;
  }

  startScan(): AsyncIterable<ScanEvent> {
    return this.startStream<ScanEvent>("scan", {}).queue;
  }

  private startStream<E extends StreamEvent>(kind: StreamKind, params: unknown): { id: string; queue: AsyncQueue<E> } {
    this.seq += 1;
    const id = `${kind}_${this.seq.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const queue = new AsyncQueue<E>();
    const stream: ActiveStream = { queue: queue as unknown as AsyncQueue<StreamEvent>, finished: false };
    this.streams.set(id, stream);
    // The consumer walked away (break / return) before the daemon finished:
    // tell the daemon to stop producing.
    queue.onClose = () => {
      if (!stream.finished) this.write({ t: "cancel", id });
      this.streams.delete(id);
    };
    this.write({ t: "start", id, kind, project: this.projectId, params });
    return { id, queue };
  }

  private cancelStream(id: string) {
    const stream = this.streams.get(id);
    if (!stream) return;
    if (!stream.finished) this.write({ t: "cancel", id });
    stream.finished = true;
    stream.queue.end();
    this.streams.delete(id);
  }

  /** The stream is over from our side (ws console close) — no cancel frame. */
  private finishStream(id: string) {
    const stream = this.streams.get(id);
    if (!stream) return;
    stream.finished = true;
    stream.queue.end();
    this.streams.delete(id);
  }

  /* ── socket ───────────────────────────────────────────────────────────── */

  private write(frame: StudioToDaemon) {
    const text = JSON.stringify(frame);
    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.authed) {
      this.socket.send(text);
      return;
    }
    this.outbox.push(text);
    this.ensureSocket();
  }

  private ensureSocket() {
    if (this.disposed || this.socket) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.setConnState("connecting");
    const ws = new WebSocket(this.wsUrl);
    this.socket = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ t: "auth", token: this.token } satisfies StudioToDaemon));
    };
    ws.onmessage = (e: MessageEvent<string>) => {
      let frame: DaemonToStudio;
      try {
        frame = JSON.parse(e.data) as DaemonToStudio;
      } catch {
        return;
      }
      this.onFrame(frame);
    };
    ws.onclose = () => {
      if (this.socket !== ws) return;
      this.socket = null;
      this.authed = false;
      this.setConnState("closed");
      this.failStreams(new Error("Connection to the daemon was lost"));
      this.scheduleReconnect();
    };
    ws.onerror = () => {
      /* `close` always follows; reconnect is handled there. */
    };
  }

  private onFrame(frame: DaemonToStudio) {
    switch (frame.t) {
      case "auth-ok": {
        this.authed = true;
        this.backoffMs = RECONNECT_MIN_MS;
        this.setConnState("open");
        const queued = this.outbox.splice(0);
        for (const text of queued) this.socket?.send(text);
        return;
      }
      case "event": {
        if (!GLOBAL_EVENTS.has(frame.event) && frame.project !== this.projectId) return;
        this.emit(frame.event as keyof DaemonEvents, frame.payload);
        return;
      }
      case "ev": {
        this.streams.get(frame.id)?.queue.push(frame.ev);
        return;
      }
      case "end": {
        const stream = this.streams.get(frame.id);
        if (!stream) return;
        stream.finished = true;
        stream.queue.end();
        this.streams.delete(frame.id);
        return;
      }
      case "error": {
        if (frame.id) {
          const stream = this.streams.get(frame.id);
          if (!stream) return;
          stream.finished = true;
          stream.queue.fail(new Error(frame.message));
          this.streams.delete(frame.id);
        } else {
          this.hooks.onError?.(frame.message, "daemon");
        }
        return;
      }
    }
  }

  private failStreams(error: Error) {
    for (const [id, stream] of this.streams) {
      stream.finished = true;
      stream.queue.fail(error);
      this.streams.delete(id);
    }
    // Frames written for streams that no longer exist would confuse the daemon.
    this.outbox = [];
  }

  private scheduleReconnect() {
    if (this.disposed || this.reconnectTimer) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(RECONNECT_MAX_MS, this.backoffMs * 2);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.ensureSocket();
    }, delay);
  }

  private setConnState(state: ConnectionState) {
    if (this.connState === state) return;
    this.connState = state;
    this.emit("connection", { state });
  }

  private emit(event: keyof DaemonEvents, payload: unknown) {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of [...set]) h(payload);
  }

  /* ── events ───────────────────────────────────────────────────────────── */

  on<K extends keyof DaemonEvents>(event: K, handler: (payload: DaemonEvents[K]) => void): Unsubscribe {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    const h = handler as Handler;
    set.add(h);
    if (event === "connection") {
      // Sync the subscriber with where the socket already is.
      h({ state: this.connState });
    } else {
      this.ensureSocket();
    }
    return () => {
      set.delete(h);
    };
  }

  dispose() {
    this.disposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const ws = this.socket;
    this.socket = null;
    this.authed = false;
    this.failStreams(new Error("Client disposed"));
    ws?.close();
    this.setConnState("closed");
    this.handlers.clear();
  }
}
