import type { DaemonClient } from "@/daemon/client";
import { HttpDaemonClient } from "@/daemon/http/HttpDaemonClient";
import type { ConnectionInfo } from "@/daemon/wire";
import { useStore } from "@/state/store";
import { getConnection } from "./connection";

/**
 * The one place a client is constructed. Always an HttpDaemonClient against
 * the saved connection — there is no fallback. The App boots a connection
 * before anything calls getClient().
 */
let client: DaemonClient | null = null;
let currentConn: ConnectionInfo | null = null;
let currentProjectId = "";

function surfaceError(message: string, context: string) {
  useStore.getState().pushToast({ kind: "info", text: message, sub: context });
}

function build(conn: ConnectionInfo, projectId: string): DaemonClient {
  return new HttpDaemonClient(conn, projectId, { onError: surfaceError });
}

/** Construct the client for a freshly probed connection. */
export function createClient(conn: ConnectionInfo, projectId: string): DaemonClient {
  client?.dispose();
  currentConn = conn;
  currentProjectId = projectId;
  client = build(conn, projectId);
  return client;
}

export function getClient(): DaemonClient {
  if (client) return client;
  const conn = getConnection();
  if (!conn) {
    throw new Error("No daemon connection — the studio must connect before it can talk to the daemon.");
  }
  currentConn = conn;
  client = build(conn, currentProjectId);
  return client;
}

/** Same connection, a different project. */
export function recreateClient(projectId: string): DaemonClient {
  const conn = currentConn ?? getConnection();
  if (!conn) {
    throw new Error("No daemon connection — cannot switch project before connecting.");
  }
  client?.dispose();
  currentConn = conn;
  currentProjectId = projectId;
  client = build(conn, projectId);
  return client;
}

export function currentClientProjectId(): string {
  return currentProjectId;
}

export function disposeClient(): void {
  client?.dispose();
  client = null;
}
