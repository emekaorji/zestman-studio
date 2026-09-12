import { CircleCheck, TriangleAlert, Upload } from "lucide-react";
import { useState } from "react";
import { AccentButton, CapsHeader, GhostButton, MethodBadge } from "@/components/primitives";
import { DialogFrame } from "@/components/dialogs/DialogFrame";
import { TabStrip } from "@/components/tabstrip/TabStrip";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

type ImportTab = "postman" | "openapi" | "curl";
type ImportMode = "merge" | "overwrite";

const TABS: Array<{ id: ImportTab; label: string }> = [
  { id: "postman", label: "Postman" },
  { id: "openapi", label: "OpenAPI" },
  { id: "curl", label: "cURL" },
];

const CURL_LINES = [
  "curl -X POST http://localhost:3000/api/v1/users \\",
  "  -H 'Content-Type: application/json' \\",
  `  -d '{"name": "Ada Lovelace", "email": "ada@example.dev",`,
  `      "role": "member"}'`,
];

const WARNINGS = [
  "Pre-request script on 'Login' preserved as metadata — not executed",
  "Unsupported auth 'hawk' on 'Legacy ping' — set to none",
];

const MODES: Array<{ value: ImportMode; label: string; sub: string }> = [
  { value: "merge", label: "Merge", sub: "add new, keep existing" },
  { value: "overwrite", label: "Overwrite", sub: "replace everything" },
];

/** Mono code well — the same surface the workbench uses for raw payloads. */
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

export function ImportDialog({ initialTab }: { initialTab?: ImportTab }) {
  const popDialog = useStore((s) => s.popDialog);
  const navigate = useStore((s) => s.navigate);
  const [tab, setTab] = useState<ImportTab>(initialTab ?? "postman");
  const [mode, setMode] = useState<ImportMode>("merge");
  const [pasted, setPasted] = useState("");
  const [imported, setImported] = useState(false);

  const openCreateUser = () => {
    const s = useStore.getState();
    const route = s.routes.find((r) => r.method === "POST" && r.path === "/api/v1/users");
    s.popDialog();
    if (route) s.navigate({ go: "route", routeId: route.id });
  };

  const footer = imported ? (
    <>
      <GhostButton
        onClick={() => {
          popDialog();
          navigate({ go: "section", section: "routes" });
        }}
      >
        View routes
      </GhostButton>
      <AccentButton onClick={popDialog}>Done</AccentButton>
    </>
  ) : tab === "curl" ? (
    <>
      <GhostButton onClick={popDialog}>Cancel</GhostButton>
      <AccentButton onClick={openCreateUser}>Import &amp; open</AccentButton>
    </>
  ) : (
    <>
      <GhostButton onClick={popDialog}>Cancel</GhostButton>
      <AccentButton onClick={() => setImported(true)}>Import</AccentButton>
    </>
  );

  return (
    <DialogFrame title="Import" width={560} footer={footer}>
      {imported ? (
        <div className="animate-in fade-in-0 duration-[var(--dur-slow)] ease-[var(--ease-out)]">
          <div className="flex items-start gap-3">
            <CircleCheck size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-ok" />
            <div className="min-w-0">
              <div className="text-base font-medium text-ink">
                Imported 27 requests from postman-collection.json
              </div>
              <div className="mt-1 text-xs text-ink-3">
                12 merged · 15 added · 3 variables drafted into Staging
              </div>
            </div>
          </div>
          <CapsHeader className="mt-4">Warnings · {WARNINGS.length}</CapsHeader>
          <div className="flex flex-col gap-2">
            {/* shadcn <Alert> — Geist's Note surface: amber-100 fill behind an
                amber-400 hairline, not a solid amber slab. The `role="alert"`
                is the point: these appear only after the import runs. */}
            {WARNINGS.map((w, i) => (
              <Alert
                key={w}
                style={{ animationDelay: `${i * 40}ms` }}
                className={cn(
                  /* text-warn on the root: Alert paints its svg with
                     `text-current`, so the colour has to come from here or the
                     glyph stays body-grey against amber text. */
                  "items-center border-warn-line bg-ds-amber-100 py-2 text-warn",
                  "*:[svg]:translate-y-0",
                  "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both",
                  "duration-[var(--dur-base)] ease-[var(--ease-out)]",
                )}
              >
                <TriangleAlert size={16} strokeWidth={1.5} />
                <AlertTitle className="truncate text-base font-normal">{w}</AlertTitle>
              </Alert>
            ))}
          </div>
        </div>
      ) : (
        <>
          <TabStrip
            tabs={TABS}
            active={tab}
            onSelect={setTab}
            variant="request"
            className="-mt-1"
            label="Import source"
          />
          <div
            key={tab}
            className="animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]"
          >
            {tab === "curl" ? (
              <>
                <CodeWell lines={CURL_LINES} className="mt-4" />
                <CapsHeader className="mt-3">Preview</CapsHeader>
                <div className="flex items-center gap-2.5">
                  <MethodBadge method="POST" fixed={false} />
                  <span className="font-mono text-sm text-ink">/api/v1/users</span>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {[
                    ["Content-Type", "application/json"],
                    ["Accept", "application/json"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center">
                      <span className="w-32.5 shrink-0 font-mono text-xs text-ink-3">{k}</span>
                      <span className="font-mono text-xs text-ink-2">{v}</span>
                    </div>
                  ))}
                </div>
                <CodeWell
                  className="mt-3"
                  lines={[`{ "name": "Ada Lovelace",`, `  "email": "ada@example.dev",`, `  "role": "member" }`]}
                />
                <div className="mt-2.5 text-xs text-ink-3">1 request will be created in users</div>
              </>
            ) : (
              <>
                <div className="mt-4 flex h-30 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong">
                  <Upload size={16} strokeWidth={1.5} className="text-ink-2" />
                  <div className="text-base text-ink-2">
                    Drop {tab === "postman" ? "a Postman collection" : "an OpenAPI spec"}, or browse
                  </div>
                  <div className="text-xs text-ink-3">.json · .yaml</div>
                </div>

                <CapsHeader className="mt-2">Or paste contents</CapsHeader>
                <Textarea
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  aria-label="Paste collection or spec contents"
                  placeholder={tab === "postman" ? "Paste collection JSON…" : "Paste spec JSON or YAML…"}
                  className="h-24 min-h-24 resize-none border-line bg-sunken font-mono text-sm text-ink dark:bg-sunken"
                />

                <CapsHeader className="mt-3">On conflict</CapsHeader>
                <RadioGroup
                  value={mode}
                  onValueChange={(v) => setMode(v as ImportMode)}
                  className="gap-0"
                >
                  {MODES.map((m) => (
                    <Label
                      key={m.value}
                      htmlFor={`import-mode-${m.value}`}
                      className="flex h-9 items-center gap-2.5 rounded-md px-1 font-normal transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:bg-hoverbg"
                    >
                      <RadioGroupItem id={`import-mode-${m.value}`} value={m.value} />
                      <span className="text-base font-medium text-ink">{m.label}</span>
                      <span className="text-xs text-ink-3">{m.sub}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </>
            )}
          </div>
        </>
      )}
    </DialogFrame>
  );
}
