import { CircleCheck, Loader2, TriangleAlert, Upload } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";
import { AccentButton, CapsHeader, GhostButton, MethodBadge } from "@/components/primitives";
import { DialogFrame } from "@/components/dialogs/DialogFrame";
import { TabStrip } from "@/components/tabstrip/TabStrip";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { getClient } from "@/studio/client";
import type { ImportResult } from "@/daemon/wire";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

type ImportTab = "postman" | "openapi" | "curl";

const TABS: Array<{ id: ImportTab; label: string }> = [
  { id: "postman", label: "Postman" },
  { id: "openapi", label: "OpenAPI" },
  { id: "curl", label: "cURL" },
];

/** Best-effort preview of a pasted cURL command: verb and path. */
function previewCurl(text: string): { method: string; path: string } | null {
  const url = /https?:\/\/[^\s'"\\]+/.exec(text)?.[0];
  if (!url) return null;
  const method = /(?:-X|--request)\s+([A-Za-z]+)/.exec(text)?.[1]?.toUpperCase() ?? (/(?:-d|--data)/.test(text) ? "POST" : "GET");
  try {
    return { method, path: new URL(url).pathname || "/" };
  } catch {
    return null;
  }
}

/** Looks like a URL rather than a document. */
const isUrl = (text: string) => /^https?:\/\/\S+$/i.test(text.trim());

export function ImportDialog({ initialTab }: { initialTab?: ImportTab }) {
  const popDialog = useStore((s) => s.popDialog);
  const navigate = useStore((s) => s.navigate);
  const pushToast = useStore((s) => s.pushToast);
  const [tab, setTab] = useState<ImportTab>(initialTab ?? "postman");
  const [pasted, setPasted] = useState("");
  const [curl, setCurl] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<(ImportResult & { source: string }) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textId = useId();
  const curlId = useId();

  const readFile = async (file: File) => {
    setPasted(await file.text());
    setFileName(file.name);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void readFile(file);
  };

  /** Refresh the route map after an import — the daemon also pushes routes:updated. */
  const refreshRoutes = async () => {
    const client = getClient();
    const [routes, files] = await Promise.all([client.listRoutes(), client.listSourceFiles()]);
    useStore.setState({ routes, files });
  };

  const importDocument = async () => {
    const text = pasted.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const client = getClient();
      const res =
        tab === "postman"
          ? await client.importPostman(text)
          : await client.importOpenApi(isUrl(text) ? { url: text } : { text });
      await refreshRoutes();
      setResult({ ...res, source: fileName ?? (isUrl(text) ? text : "pasted text") });
    } catch {
      /* the daemon's message is already toasted by the client */
    } finally {
      setBusy(false);
    }
  };

  const importCurl = async () => {
    const text = curl.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const route = await getClient().importCurl(text);
      useStore.setState((s) => ({
        routes: s.routes.some((r) => r.id === route.id) ? s.routes.map((r) => (r.id === route.id ? route : r)) : [...s.routes, route],
      }));
      await refreshRoutes();
      pushToast({ kind: "info", text: `Imported ${route.method} ${route.path}` });
      popDialog();
      navigate({ go: "route", routeId: route.id });
    } catch {
      /* the daemon's message is already toasted by the client */
    } finally {
      setBusy(false);
    }
  };

  const preview = previewCurl(curl);

  const footer = result ? (
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
      <AccentButton onClick={() => void importCurl()} disabled={busy || curl.trim() === ""} aria-busy={busy}>
        {busy ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : null}
        Import &amp; open
      </AccentButton>
    </>
  ) : (
    <>
      <GhostButton onClick={popDialog}>Cancel</GhostButton>
      <AccentButton onClick={() => void importDocument()} disabled={busy || pasted.trim() === ""} aria-busy={busy}>
        {busy ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : null}
        Import
      </AccentButton>
    </>
  );

  return (
    <DialogFrame title="Import" width={560} footer={footer}>
      {result ? (
        <div className="animate-in fade-in-0 duration-[var(--dur-slow)] ease-[var(--ease-out)]">
          <div className="flex items-start gap-3">
            <CircleCheck size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-ok" />
            <div className="min-w-0">
              <div className="text-base font-medium text-ink">
                Imported {result.routes} {result.routes === 1 ? "request" : "requests"} from {result.title ?? result.source}
              </div>
              {result.title ? <div className="mt-1 truncate text-xs text-ink-3">{result.source}</div> : null}
            </div>
          </div>
          {result.warnings.length > 0 ? (
            <>
              <CapsHeader className="mt-4">Warnings · {result.warnings.length}</CapsHeader>
              <div className="flex flex-col gap-2">
                {/* shadcn <Alert> — Geist's Note surface: amber-100 fill behind an
                    amber-400 hairline, not a solid amber slab. The `role="alert"`
                    is the point: these appear only after the import runs. */}
                {result.warnings.map((w, i) => (
                  <Alert
                    key={`${i}:${w}`}
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
            </>
          ) : null}
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
                <CapsHeader className="mt-3">
                  <label htmlFor={curlId}>Paste a cURL command</label>
                </CapsHeader>
                <Textarea
                  id={curlId}
                  value={curl}
                  onChange={(e) => setCurl(e.target.value)}
                  placeholder={"curl -X POST http://localhost:3000/api/v1/users \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"name\": \"Ada\"}'"}
                  spellCheck={false}
                  className="h-30 min-h-30 resize-none border-line bg-sunken font-mono text-sm text-ink dark:bg-sunken"
                />
                <CapsHeader className="mt-3">Preview</CapsHeader>
                {preview ? (
                  <div className="flex items-center gap-2.5">
                    <MethodBadge method={preview.method} fixed={false} />
                    <span className="font-mono text-sm text-ink">{preview.path}</span>
                  </div>
                ) : (
                  <div className="text-base text-ink-3">Paste a command to see the request it creates.</div>
                )}
                <div className="mt-2.5 text-xs text-ink-3">The daemon parses headers, body and auth — this preview only reads the URL.</div>
              </>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.yaml,.yml,application/json,text/yaml"
                  className="sr-only"
                  aria-label={tab === "postman" ? "Choose a Postman collection" : "Choose an OpenAPI spec"}
                  tabIndex={-1}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void readFile(file);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={cn(
                    "mt-4 flex h-30 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed",
                    "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
                    "hover:bg-ds-gray-alpha-100 focus-visible:bg-ds-gray-alpha-100",
                    dragOver ? "border-line-strong bg-ds-gray-alpha-100" : "border-line-strong",
                  )}
                >
                  <Upload size={16} strokeWidth={1.5} className="text-ink-2" />
                  <div className="text-base text-ink-2">
                    {fileName ? fileName : `Drop ${tab === "postman" ? "a Postman collection" : "an OpenAPI spec"}, or browse`}
                  </div>
                  <div className="text-xs text-ink-3">.json · .yaml</div>
                </button>

                <CapsHeader className="mt-2">
                  <label htmlFor={textId}>{tab === "openapi" ? "Or paste contents / a URL" : "Or paste contents"}</label>
                </CapsHeader>
                <Textarea
                  id={textId}
                  value={pasted}
                  onChange={(e) => {
                    setPasted(e.target.value);
                    setFileName(null);
                  }}
                  placeholder={tab === "postman" ? "Paste collection JSON…" : "Paste spec JSON or YAML, or https://…/openapi.json"}
                  spellCheck={false}
                  className="h-24 min-h-24 resize-none border-line bg-sunken font-mono text-sm text-ink dark:bg-sunken"
                />
              </>
            )}
          </div>
        </>
      )}
    </DialogFrame>
  );
}
