import type { AuthMode, RouteAuth } from "@/daemon/types";
import type { OpenTab } from "@/state/slices/workbench";
import { useStore } from "@/state/store";
import { getClient } from "@/studio/client";
import { CapsHeader, Dot, GhostButton, Pill } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { SelectField, SwitchRow, TextField } from "./fields";

const MODES: Array<{ id: AuthMode; label: string }> = [
  { id: "none", label: "None" },
  { id: "inherit", label: "Inherit" },
  { id: "bearer", label: "Bearer" },
  { id: "basic", label: "Basic" },
  { id: "api-key", label: "API key" },
  { id: "digest", label: "Digest" },
  { id: "oauth2", label: "OAuth 2.0" },
];

/** Two-column form grid — Vercel's settings layout. */
const GRID = "grid max-w-210 grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-2";

/** Each mode's form fades in rather than snapping between shapes. */
const ENTER = "animate-in fade-in-0 slide-in-from-top-1 duration-[var(--dur-base)] ease-[var(--ease-out)]";

export function AuthPanel({ tab }: { tab: OpenTab }) {
  const patchDraft = useStore((s) => s.patchDraft);
  const pushDialog = useStore((s) => s.pushDialog);
  const pushToast = useStore((s) => s.pushToast);

  const auth = tab.draft.auth;
  const patchAuth = (p: Partial<RouteAuth>) => patchDraft(tab.id, { auth: { ...auth, ...p } });
  const patchOauth = (p: Partial<RouteAuth["oauth2"]>) => patchAuth({ oauth2: { ...auth.oauth2, ...p } });

  return (
    <div className="flex flex-col gap-5">
      <CapsHeader
        right={
          auth.inferredFrom ? (
            <Pill tone="accent" className="font-mono">
              prefilled from {auth.inferredFrom}
            </Pill>
          ) : undefined
        }
      >
        Auth type
      </CapsHeader>

      {/* mode chips — a real radio-style toggle group (roving tabindex, arrows) */}
      <ToggleGroup
        type="single"
        value={auth.mode}
        onValueChange={(v) => v && patchAuth({ mode: v as AuthMode })}
        aria-label="Auth type"
        spacing={1}
        className="flex-wrap"
      >
        {MODES.map((m) => (
          <ToggleGroupItem
            key={m.id}
            value={m.id}
            className={cn(
              "h-8 rounded-md border px-3 text-base font-normal",
              "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
              auth.mode === m.id
                ? "border-line-strong bg-ds-gray-200 font-medium text-ink data-[state=on]:bg-ds-gray-200"
                : "border-line text-ink-2 hover:bg-hoverbg hover:text-ink",
            )}
          >
            {m.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {auth.mode === "none" ? (
        <p className={cn("text-base text-ink-3", ENTER)}>
          No auth — this request is sent without credentials.
        </p>
      ) : null}
      {auth.mode === "inherit" ? (
        <p className={cn("text-base text-ink-3", ENTER)}>Inherits auth from the project defaults.</p>
      ) : null}

      {auth.mode === "bearer" ? (
        <div className={cn(GRID, ENTER)}>
          <TextField label="Token" value={auth.bearer.token} onChange={(v) => patchAuth({ bearer: { token: v } })} />
        </div>
      ) : null}

      {auth.mode === "basic" ? (
        <div className={cn(GRID, ENTER)}>
          <TextField
            label="Username"
            value={auth.basic.username}
            onChange={(v) => patchAuth({ basic: { ...auth.basic, username: v } })}
          />
          <TextField
            label="Password"
            type="password"
            value={auth.basic.password}
            onChange={(v) => patchAuth({ basic: { ...auth.basic, password: v } })}
          />
        </div>
      ) : null}

      {auth.mode === "api-key" ? (
        <div className={cn(GRID, ENTER)}>
          <TextField
            label="Key"
            value={auth.apiKey.key}
            onChange={(v) => patchAuth({ apiKey: { ...auth.apiKey, key: v } })}
          />
          <TextField
            label="Value"
            value={auth.apiKey.value}
            onChange={(v) => patchAuth({ apiKey: { ...auth.apiKey, value: v } })}
          />
          <SelectField
            label="Add to"
            value={auth.apiKey.addTo}
            options={[
              { value: "header", label: "Header" },
              { value: "query", label: "Query params" },
            ]}
            onChange={(v) => patchAuth({ apiKey: { ...auth.apiKey, addTo: v as "header" | "query" } })}
          />
        </div>
      ) : null}

      {auth.mode === "digest" ? (
        <div className={cn(GRID, ENTER)}>
          <TextField
            label="Username"
            value={auth.digest.username}
            onChange={(v) => patchAuth({ digest: { ...auth.digest, username: v } })}
          />
          <TextField
            label="Password"
            type="password"
            value={auth.digest.password}
            onChange={(v) => patchAuth({ digest: { ...auth.digest, password: v } })}
          />
        </div>
      ) : null}

      {auth.mode === "oauth2" ? (
        <div className={cn("flex flex-col gap-5", ENTER)}>
          <div className={GRID}>
            <SelectField
              label="Grant type"
              value={auth.oauth2.grantType}
              options={[
                { value: "authorization_code", label: "Authorization code" },
                { value: "client_credentials", label: "Client credentials" },
              ]}
              onChange={(v) => patchOauth({ grantType: v as RouteAuth["oauth2"]["grantType"] })}
            />
            <TextField label="Auth URL" value={auth.oauth2.authUrl} onChange={(v) => patchOauth({ authUrl: v })} />
            <TextField label="Token URL" value={auth.oauth2.tokenUrl} onChange={(v) => patchOauth({ tokenUrl: v })} />
            <TextField label="Client ID" value={auth.oauth2.clientId} onChange={(v) => patchOauth({ clientId: v })} />
            <TextField
              label="Client secret"
              type="password"
              value={auth.oauth2.clientSecret}
              onChange={(v) => patchOauth({ clientSecret: v })}
            />
            <TextField label="Scope" value={auth.oauth2.scope} onChange={(v) => patchOauth({ scope: v })} />
            <SelectField
              label="Client auth"
              value={auth.oauth2.clientAuth}
              options={[
                { value: "basic", label: "Send as Basic header" },
                { value: "body", label: "Send in body" },
              ]}
              onChange={(v) => patchOauth({ clientAuth: v as "basic" | "body" })}
            />
          </div>

          <div className="max-w-97">
            <SwitchRow
              label="Use PKCE (S256)"
              checked={auth.oauth2.usePkce}
              onChange={(v) => patchOauth({ usePkce: v })}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <GhostButton
              onClick={async () => {
                try {
                  const t = await getClient().fetchOAuthToken(tab.routeId, tab.draft);
                  patchOauth({ tokenState: { active: t.active, expiresInMin: t.expiresInMin } });
                  pushToast({ kind: "info", text: "Access token fetched", sub: `${t.masked} · expires in ${t.expiresInMin} m` });
                } catch {
                  /* the client already toasted the daemon's message */
                }
              }}
            >
              Get new access token
            </GhostButton>
            {auth.oauth2.tokenState ? (
              <Pill tone={auth.oauth2.tokenState.active ? "ok" : "err"} className="h-7 gap-1.5 px-3">
                <Dot tone={auth.oauth2.tokenState.active ? "ok" : "err"} className="size-1.25 bg-current" />
                {auth.oauth2.tokenState.active
                  ? `token active · expires in ${auth.oauth2.tokenState.expiresInMin} m`
                  : "token expired"}
              </Pill>
            ) : null}
            <Button
              type="button"
              variant="link"
              size="lg"
              onClick={() => pushDialog({ kind: "oauth-tokens" })}
              className="h-9 px-0 text-base font-normal text-link-z"
            >
              Inspect
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
