import { AccentButton, EmptyState, GhostButton, MethodBadge } from "@/components/primitives";
import { DialogFrame } from "@/components/dialogs/DialogFrame";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";
import type { OAuthTokenRow } from "@/daemon/types";

/** "POST /api/v1/users · auth.example.dev" → { method, path, host } */
function parseScope(scope: string) {
  const [head, host] = scope.split(" · ");
  const spaceIdx = head.indexOf(" ");
  return {
    method: head.slice(0, spaceIdx),
    path: head.slice(spaceIdx + 1),
    host: host ?? "",
  };
}

export function OAuthTokensDialog() {
  const rows = useStore((s) => s.oauthTokens);
  const saveOAuthTokens = useStore((s) => s.saveOAuthTokens);
  const popDialog = useStore((s) => s.popDialog);

  const refresh = (row: OAuthTokenRow) =>
    void saveOAuthTokens(
      rows.map((r) =>
        r.id === row.id ? { ...r, state: "active", expiresLabel: "expires in 60 m", hasRefresh: true } : r,
      ),
    );

  const revoke = (row: OAuthTokenRow) => void saveOAuthTokens(rows.filter((r) => r.id !== row.id));

  return (
    <DialogFrame
      title="OAuth tokens"
      titleRight={
        <span className="font-mono text-xs text-ink-3">stored locally · .zestman/oauth-tokens.json</span>
      }
      width={620}
      footer={<AccentButton onClick={popDialog}>Done</AccentButton>}
    >
      {rows.length === 0 ? (
        <div className="h-24">
          <EmptyState title="No tokens stored" sub="Tokens appear here after an OAuth flow completes" />
        </div>
      ) : (
        <div className="flex flex-col">
          {rows.map((row, i) => {
            const scope = parseScope(row.routeScope);
            return (
              <div
                key={row.id}
                style={{ animationDelay: `${i * 40}ms` }}
                className={cn(
                  "flex h-16 items-center gap-3 animate-in fade-in-0 fill-mode-both",
                  "duration-[var(--dur-base)] ease-[var(--ease-out)]",
                  i > 0 && "border-t border-line",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-baseline gap-1.5">
                    <MethodBadge method={scope.method} fixed={false} />
                    <span className="truncate font-mono text-sm font-medium text-ink">{scope.path}</span>
                    {scope.host ? (
                      <span className="shrink-0 font-mono text-xs text-ink-3">· {scope.host}</span>
                    ) : null}
                  </div>
                  <div className="mt-1 font-mono text-xs text-ink-3">{row.masked}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className={cn("text-xs font-medium", row.state === "active" ? "text-ok" : "text-err")}>
                    {row.expiresLabel}
                  </span>
                  <span className="text-xs text-ink-3">
                    {row.hasRefresh ? "refresh token ✓" : "no refresh token"}
                  </span>
                </div>
                <GhostButton size="sm" onClick={() => refresh(row)} aria-label={`Refresh token for ${scope.path}`}>
                  Refresh
                </GhostButton>
                <GhostButton
                  size="sm"
                  tone="danger"
                  onClick={() => revoke(row)}
                  aria-label={`Revoke token for ${scope.path}`}
                >
                  Revoke
                </GhostButton>
              </div>
            );
          })}
        </div>
      )}
    </DialogFrame>
  );
}
