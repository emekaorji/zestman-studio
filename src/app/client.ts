import type { DaemonClient } from "@/daemon/client";
import { FixtureClient } from "@/daemon/fixture/FixtureClient";

/**
 * The one place a client is constructed. Today: fixtures.
 * Later: HttpDaemonClient(local.zestman.xyz → local daemon) swaps in here.
 */
let client: DaemonClient | null = null;
let currentProjectId = "case1";

/** Point the factory at a project before the first getClient(). */
export function setInitialProject(projectId: string): void {
  if (!client) currentProjectId = projectId;
}

export function getClient(): DaemonClient {
  if (!client) {
    const c = new FixtureClient(currentProjectId);
    c.startLiveTap();
    client = c;
  }
  return client;
}

export function recreateClient(projectId: string): DaemonClient {
  client?.dispose();
  currentProjectId = projectId;
  const c = new FixtureClient(projectId);
  c.startLiveTap();
  client = c;
  return client;
}
