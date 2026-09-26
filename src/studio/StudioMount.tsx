"use client";

import dynamic from "next/dynamic";

/**
 * The studio is a client application: its store reads localStorage the moment
 * it is created, and everything it renders is driven by a daemon on this
 * machine. There is nothing for a server to render, so it is loaded with SSR
 * off rather than made to pretend.
 */
const StudioRoot = dynamic(() => import("./StudioRoot").then((m) => m.StudioRoot), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-canvas">
      <span className="animate-in fade-in-0 text-base text-ink-3 duration-500">Zestman</span>
    </div>
  ),
});

export function StudioMount({ org, projectSlug }: { org: string; projectSlug: string | null }) {
  return <StudioRoot org={org} projectSlug={projectSlug} />;
}
