/**
 * Studio ↔ daemon wire contract.
 *
 * A copy of the pieces the studio needs from the daemon's
 * `src/protocol/wire.ts` — the studio is its own package and must not import
 * across repos. Keep the two in step.
 *
 *  - REST under `/api/*`, every call carries `Authorization: Bearer <token>`.
 *  - `GET /health` is public and identifies a daemon.
 *  - One multiplexed WebSocket at `/ws`: the first frame is `{ t: "auth" }`,
 *    then events and every long-running stream share the socket.
 */
import type { OperatorEvent, RunEvent, ScanEvent, SendEvent, WsEvent } from "./types";

export const PROTOCOL_VERSION = 1;

/** Default daemon port. The daemon walks upward from here if it is taken. */
export const DEFAULT_DAEMON_PORT = 23456;

/** Where the hosted studio lives. */
export const HOSTED_STUDIO_URL = "https://local.zestman.xyz";

/** Browser origins allowed to talk to the daemon (plus the daemon's own origin). */
export const STUDIO_ORIGINS = [HOSTED_STUDIO_URL, "http://localhost:5200", "http://127.0.0.1:5200"];

/** The daemon only ever binds loopback. */
export const DAEMON_HOST = "127.0.0.1";

/* ── Studio ↔ daemon (WebSocket `/ws`) ───────────────────────────────────── */

export type StreamKind = "send" | "run" | "ws" | "operator" | "scan";

export type StreamEvent = SendEvent | RunEvent | WsEvent | OperatorEvent | ScanEvent;

export type StudioToDaemon =
  | { t: "auth"; token: string }
  | { t: "start"; id: string; kind: StreamKind; project: string; params: unknown }
  | { t: "cancel"; id: string }
  /** WebSocket-console input. */
  | { t: "input"; id: string; text: string }
  | { t: "close"; id: string };

export type DaemonToStudio =
  | { t: "auth-ok"; daemonVersion: string }
  | { t: "event"; project: string; event: string; payload: unknown }
  | { t: "ev"; id: string; ev: StreamEvent }
  | { t: "end"; id: string }
  | { t: "error"; id?: string; message: string };

/* ── Studio ↔ daemon (HTTP) ──────────────────────────────────────────────── */

export interface HealthResponse {
  name: "zestman";
  version: string;
  protocol: number;
  /** Whether the studio bundle is served at `/`. */
  studio: boolean;
}

export interface ImportResult {
  routes: number;
  warnings: string[];
  title?: string;
}

/** Daemon connection details the studio keeps after a launch link. */
export interface ConnectionInfo {
  port: number;
  token: string;
}

/** Builds the launch URL printed by the SDK and by `zestman studio`. */
export function studioLaunchUrl(base: string, conn: ConnectionInfo, projectId?: string): string {
  const frag = `c=${conn.port}.${conn.token}` + (projectId ? `&p=${encodeURIComponent(projectId)}` : "");
  return `${base.replace(/\/$/, "")}/#${frag}`;
}

export function daemonHttpBase(conn: ConnectionInfo): string {
  return `http://${DAEMON_HOST}:${conn.port}`;
}

export function daemonWsUrl(conn: ConnectionInfo): string {
  return `ws://${DAEMON_HOST}:${conn.port}/ws`;
}
