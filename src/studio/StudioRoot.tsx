"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { App } from "./App";
import { installDevHandle } from "./devHandle";
import { ScopeProvider } from "./scope";
import { useStore } from "@/state/store";
import { projectPath } from "@/lib/slugs";

/**
 * The studio's entry point on a route. The URL owns which project is open:
 * this boots the daemon connection for the slug in the path, and when the path
 * names no project (`/<org>`), it corrects the URL to the one that opened.
 */
export function StudioRoot({ org, projectSlug }: { org: string; projectSlug: string | null }) {
  const router = useRouter();
  const boot = useStore((s) => s.boot);
  const applyLaunchLink = useStore((s) => s.applyLaunchLink);
  const projects = useStore((s) => s.projects);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const connState = useStore((s) => s.connState);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") installDevHandle();
  }, []);

  useEffect(() => {
    void boot(projectSlug);
    // A launch link opened on an already-loaded studio only changes the hash —
    // no reload — so it has to be consumed here too.
    const onHash = () => {
      if (/(^|[#&])c=/.test(window.location.hash)) void applyLaunchLink(window.location.hash);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [boot, applyLaunchLink, projectSlug]);

  /* The URL is the source of truth, so it must end up naming what is open:
     `/<org>` picks a project, and a launch link can open a different one. */
  useEffect(() => {
    if (connState !== "connected") return;
    const open = projects.find((p) => p.id === activeProjectId);
    if (open && open.slug !== projectSlug) router.replace(projectPath(org, open.slug));
  }, [connState, projects, activeProjectId, projectSlug, org, router]);

  return (
    <ScopeProvider value={{ org, projectSlug }}>
      <App />
    </ScopeProvider>
  );
}
