import { Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { CapsHeader, GhostButton } from "@/components/primitives";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DAEMON_HOST } from "@/daemon/wire";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

/** Mono code well — the same surface the import dialog uses for raw payloads. */
function CodeWell({ lines, className }: { lines: string[]; className?: string }) {
  return (
    <div className={cn("rounded-md border border-line bg-sunken p-3", className)}>
      {lines.map((l, i) => (
        <div key={i} className="font-mono text-sm whitespace-pre text-ink-2">
          {l}
        </div>
      ))}
    </div>
  );
}

/** Retry + "paste a launch link" — shared by every disconnected state. */
function LinkRow({ busy }: { busy: boolean }) {
  const retryConnection = useStore((s) => s.retryConnection);
  const applyLaunchLink = useStore((s) => s.applyLaunchLink);
  const pushToast = useStore((s) => s.pushToast);
  const inputId = useId();
  const [value, setValue] = useState("");

  const connect = async () => {
    const text = value.trim();
    if (!text) return;
    const ok = await applyLaunchLink(text);
    if (!ok) {
      pushToast({ kind: "info", text: "That is not a launch link", sub: "expected a URL with #c=port.token, or port.token" });
      return;
    }
    setValue("");
  };

  return (
    <div className="mt-10 flex w-full flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Label htmlFor={inputId} className="text-xs font-normal text-ink-3">
          Paste a launch link
        </Label>
        <Input
          id={inputId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void connect();
          }}
          placeholder="https://local.zestman.xyz/#c=23456.…  or  23456.token"
          spellCheck={false}
          autoComplete="off"
          className="h-9 bg-ds-gray-100 font-mono text-sm dark:bg-ds-gray-100"
        />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <GhostButton onClick={() => void connect()} disabled={busy || value.trim() === ""}>
          Connect
        </GhostButton>
        <GhostButton onClick={() => void retryConnection()} disabled={busy}>
          Retry
        </GhostButton>
      </div>
    </div>
  );
}

/**
 * The studio without a daemon. Same column and rhythm as the first-scan
 * overlay: one heading, one concern per block, nothing decorative.
 */
export function ConnectScreen() {
  const connState = useStore((s) => s.connState);
  const connError = useStore((s) => s.connError);
  const connPort = useStore((s) => s.connPort);
  const busy = connState === "booting";

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto bg-canvas">
      <div
        className={cn(
          "flex w-180 max-w-[calc(100vw-4rem)] shrink-0 flex-col items-center pt-32",
          "animate-in fade-in-0 zoom-in-98 duration-[var(--dur-slow)] ease-[var(--ease-out)]",
        )}
      >
        <h1 className="text-xl font-semibold text-ink">Connect to your local daemon</h1>

        {connState === "booting" ? (
          <div className="mt-7 flex items-center gap-2 font-mono text-sm text-ink-3">
            <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
            {connPort ? `connecting to ${DAEMON_HOST}:${connPort}` : "looking for a connection"}
          </div>
        ) : null}

        {connState === "no-connection" ? (
          <>
            <div
              style={{ animationDelay: "120ms" }}
              className={cn(
                "mt-10 grid w-full grid-cols-1 gap-10 sm:grid-cols-2",
                "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both",
                "duration-[var(--dur-slow)] ease-[var(--ease-out)]",
              )}
            >
              <section>
                <CapsHeader>Have an Express app?</CapsHeader>
                <CodeWell lines={["pnpm add -D zestman"]} />
                <CodeWell className="mt-2" lines={['import { zestman } from "zestman/express"', "zestman(app)"]} />
                <p className="mt-3 text-base leading-5 text-ink-2">
                  Run your start script and open the link it prints.
                </p>
              </section>
              <section>
                <CapsHeader>Have an OpenAPI spec or a prod URL?</CapsHeader>
                <CodeWell lines={["npx zestman studio --spec <url|file>"]} />
                <p className="mt-3 text-base leading-5 text-ink-2">
                  The studio opens itself once the daemon is up.
                </p>
              </section>
            </div>
            <LinkRow busy={busy} />
          </>
        ) : null}

        {connState === "unreachable" ? (
          <>
            <p className="mt-7 font-mono text-sm text-ink-2">
              Daemon not answering on {DAEMON_HOST}:{connPort ?? "—"}
            </p>
            {connError ? <p className="mt-2 max-w-full truncate font-mono text-xs text-ink-3">{connError}</p> : null}
            <LinkRow busy={busy} />
          </>
        ) : null}

        {connState === "unauthorized" ? (
          <>
            <p className="mt-7 text-center font-mono text-sm text-ink-2">
              Token rejected — open a fresh link from <span className="text-ink">zestman studio</span> or your
              app&apos;s console
            </p>
            <LinkRow busy={busy} />
          </>
        ) : null}
      </div>

      <div className="mt-auto shrink-0 pt-10 pb-10 font-mono text-xs text-ink-3">
        the studio talks to a daemon on {DAEMON_HOST} — nothing leaves your machine
      </div>
    </div>
  );
}
