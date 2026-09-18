import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CapsHeader, GhostButton } from "@/components/primitives";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

/** "4 minutes ago", for the last time an app was connected. */
function ago(at: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 60) return "moments ago";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const RETRY_MS = 4000;

/**
 * The projects are known, nothing is running.
 *
 * A project that has been seen once stays in the switcher, so the studio is
 * never empty and nobody has to paste a link to get back in. This keeps
 * retrying by itself, so starting the app is the only step.
 */
export function WaitingScreen() {
  const projects = useStore((s) => s.knownProjects);
  const retryConnection = useStore((s) => s.retryConnection);
  const connState = useStore((s) => s.connState);
  const [selectedId, setSelectedId] = useState(projects[0]?.id ?? "");
  const selected = projects.find((p) => p.id === selectedId) ?? projects[0];

  useEffect(() => {
    const timer = setInterval(() => void retryConnection(), RETRY_MS);
    return () => clearInterval(timer);
  }, [retryConnection]);

  return (
    <div className="flex h-full flex-col bg-canvas">
      {/* the switcher stays, so the studio still looks like your workspace */}
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
        <span className="shrink-0 text-base font-semibold text-ink">Zestman</span>
        <span aria-hidden className="text-base text-ink-3">
          /
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              aria-pressed={p.id === selected?.id}
              className={cn(
                "flex h-7 items-center gap-2 rounded-md px-2 font-mono text-sm transition-colors",
                p.id === selected?.id ? "bg-ds-gray-alpha-100 text-ink" : "text-ink-2 hover:bg-ds-gray-alpha-100",
              )}
            >
              <span className="size-1.5 shrink-0 rounded-full bg-ink-3" />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto">
        <div className="flex w-180 max-w-[calc(100vw-4rem)] shrink-0 flex-col pt-28">
          <h1 className="text-xl font-semibold text-ink">
            {selected ? `${selected.name} is not running` : "Nothing is running"}
          </h1>
          <p className="mt-3 text-base leading-6 text-ink-2">
            Start it and this page picks it up on its own. Nothing to paste, no link to find.
          </p>

          {selected ? (
            <div className="mt-8">
              <CapsHeader>Where it lives</CapsHeader>
              <div className="mt-2 rounded-md border border-line bg-sunken p-3">
                <div className="font-mono text-sm break-all text-ink-2">{selected.rootPath}</div>
              </div>
              <p className="mt-3 text-sm text-ink-3">
                {selected.routeCount} route{selected.routeCount === 1 ? "" : "s"} when it was last up
                {selected.lastSeen ? ` · ${ago(selected.lastSeen)}` : ""}
              </p>
            </div>
          ) : null}

          <div className="mt-10 flex items-center gap-3">
            <GhostButton onClick={() => void retryConnection()} disabled={connState === "booting"}>
              Check now
            </GhostButton>
            <span className="flex items-center gap-2 font-mono text-xs text-ink-3">
              <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
              watching for it
            </span>
          </div>
        </div>

        <div className="mt-auto shrink-0 pt-10 pb-10 font-mono text-xs text-ink-3">
          nothing leaves your machine — this page only talks to your own daemon
        </div>
      </div>
    </div>
  );
}
