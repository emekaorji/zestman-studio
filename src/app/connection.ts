/**
 * Connection bootstrap.
 *
 * The daemon (or the SDK inside the user's app) prints a launch link:
 *   https://local.zestman.xyz/#c=<port>.<token>&p=<projectId>
 * The fragment never reaches a server. We read it once, remember the
 * connection in localStorage, and strip the fragment so a copied URL does not
 * carry the token around.
 */
import { DAEMON_HOST, DEFAULT_DAEMON_PORT, type ConnectionInfo, type HealthResponse } from "@/daemon/wire";
import type { ProjectSummary } from "@/daemon/types";

export const CONN_KEY = "zestman:conn:v1";
/** The last project list we saw, so a dead daemon still shows the projects it knows. */
export const PROJECTS_KEY = "zestman:projects:v1";

/** How many ports above the default a daemon may have walked to. */
const SCAN_SPAN = 6;

export type ProbeResult = "ok" | "unauthorized" | "unreachable";

export interface LaunchLink {
  conn: ConnectionInfo | null;
  projectId: string | null;
}

const PROBE_TIMEOUT_MS = 4000;

/* ── persistence ─────────────────────────────────────────────────────────── */

export function getConnection(): ConnectionInfo | null {
  try {
    const raw = window.localStorage.getItem(CONN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConnectionInfo>;
    if (typeof parsed.port !== "number" || !Number.isInteger(parsed.port) || parsed.port <= 0) return null;
    if (typeof parsed.token !== "string" || parsed.token.length === 0) return null;
    return { port: parsed.port, token: parsed.token };
  } catch {
    return null;
  }
}

export function saveConnection(conn: ConnectionInfo): void {
  try {
    window.localStorage.setItem(CONN_KEY, JSON.stringify(conn));
  } catch {
    /* storage unavailable — the session still works, it just will not be remembered */
  }
}

export function clearConnection(): void {
  try {
    window.localStorage.removeItem(CONN_KEY);
  } catch {
    /* nothing to do */
  }
}

/* ── launch links ────────────────────────────────────────────────────────── */

function parseConnToken(value: string): ConnectionInfo | null {
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const port = Number(value.slice(0, dot));
  const token = value.slice(dot + 1).trim();
  if (!Number.isInteger(port) || port <= 0 || port > 65535 || !token) return null;
  return { port, token };
}

function parseFragment(fragment: string): LaunchLink {
  const params = new URLSearchParams(fragment.replace(/^#/, ""));
  const c = params.get("c");
  const p = params.get("p");
  return { conn: c ? parseConnToken(c) : null, projectId: p ? p : null };
}

/**
 * Accepts a full launch URL, a bare `#c=…` fragment, or `port.token`.
 * Returns null when nothing usable is found.
 */
export function parseLaunchLink(input: string): LaunchLink | null {
  const text = input.trim();
  if (!text) return null;
  if (text.startsWith("#")) {
    const link = parseFragment(text);
    return link.conn ? link : null;
  }
  if (/^\d+\.[^\s]+$/.test(text)) {
    const conn = parseConnToken(text);
    return conn ? { conn, projectId: null } : null;
  }
  try {
    const url = new URL(text);
    const link = parseFragment(url.hash);
    return link.conn ? link : null;
  } catch {
    return null;
  }
}

/**
 * Read `location.hash` once. A `c=` pair is saved; the fragment is stripped
 * either way so a token never lingers in the address bar or browser history.
 */
export function consumeLaunchHash(): LaunchLink {
  const hash = window.location.hash;
  if (!hash || hash.length < 2) return { conn: null, projectId: null };
  const link = parseFragment(hash);
  if (link.conn) saveConnection(link.conn);
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return link;
}

/* ── probing ─────────────────────────────────────────────────────────────── */

function withTimeout(): AbortSignal {
  return AbortSignal.timeout(PROBE_TIMEOUT_MS);
}

async function fetchHealth(base: string): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${base}/health`, { signal: withTimeout() });
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<HealthResponse>;
    return body && body.name === "zestman" ? (body as HealthResponse) : null;
  } catch {
    return null;
  }
}

/** `GET /health`, then `GET /api/projects` with the token. */
export async function probe(conn: ConnectionInfo): Promise<ProbeResult> {
  const base = `http://${DAEMON_HOST}:${conn.port}`;
  const health = await fetchHealth(base);
  if (!health) return "unreachable";
  try {
    const res = await fetch(`${base}/api/projects`, {
      headers: { authorization: `Bearer ${conn.token}` },
      signal: withTimeout(),
    });
    if (res.status === 401 || res.status === 403) return "unauthorized";
    if (!res.ok) return "unreachable";
    return "ok";
  } catch {
    return "unreachable";
  }
}

/* ── finding a daemon again ──────────────────────────────────────────────── */

/**
 * The daemon walks up from its default port when one is taken, and its token
 * survives restarts. A studio that connected once can therefore find it again
 * on its own: probe the range and authorise with the token we already hold.
 */
export async function findDaemon(token: string, prefer?: number): Promise<ConnectionInfo | null> {
  const ports = [...(prefer ? [prefer] : []), ...Array.from({ length: SCAN_SPAN }, (_, i) => DEFAULT_DAEMON_PORT + i)];
  for (const port of [...new Set(ports)]) {
    const conn = { port, token };
    if ((await probe(conn)) === "ok") {
      saveConnection(conn);
      return conn;
    }
  }
  return null;
}

/* ── the projects we last saw ────────────────────────────────────────────── */

export function saveKnownProjects(projects: ProjectSummary[]): void {
  try {
    window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch {
    /* storage unavailable — the switcher just starts empty next time */
  }
}

export function loadKnownProjects(): ProjectSummary[] {
  try {
    const raw = window.localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is ProjectSummary => typeof p === "object" && p !== null && typeof (p as ProjectSummary).id === "string");
  } catch {
    return [];
  }
}
