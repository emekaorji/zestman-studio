import { useRef, useState } from "react";
import { getClient } from "@/app/client";
import { buildVarMap, resolveText } from "@/lib/variables";
import { Paperclip } from "lucide-react";
import type { BodyMode, FormRow, KVRow, RequestBody, Route } from "@/daemon/types";
import type { OpenTab } from "@/state/slices/workbench";
import { useStore } from "@/state/store";
import { CapsHeader, Dot, GhostButton, Pill } from "@/components/primitives";
import { SourceRef } from "@/components/SourceRef";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CodeEditor } from "@/lib/codemirror/CodeEditor";
import { id } from "@/lib/ids";
import { cn } from "@/lib/utils";
import { KeyValueTable } from "./KeyValueTable";
import { BulkEditor, bulkToRows, rowsToBulk } from "./BulkEditor";

const MODES: Array<{ id: BodyMode; label: string }> = [
  { id: "none", label: "none" },
  { id: "form-data", label: "form-data" },
  { id: "urlencoded", label: "x-www-form-urlencoded" },
  { id: "raw", label: "raw" },
  { id: "binary", label: "binary" },
  { id: "graphql", label: "GraphQL" },
];

const makeKv = (): KVRow => ({ id: id("kv"), key: "", value: "", description: "", enabled: true });
const makeFormRow = (): FormRow => ({ ...makeKv(), type: "text" });

/** Hide CM gutters where the design shows plain editors (query/vars/scripts). */
export const NO_GUTTER = "[&_.cm-gutters]:hidden!";

/** Each mode's editor fades in rather than snapping between shapes. */
const ENTER = "animate-in fade-in-0 slide-in-from-top-1 duration-[var(--dur-base)] ease-[var(--ease-out)]";

export function BodyPanel({ tab, route }: { tab: OpenTab; route: Route }) {
  const patchDraft = useStore((s) => s.patchDraft);
  const pushToast = useStore((s) => s.pushToast);
  const environments = useStore((s) => s.environments);
  const globals = useStore((s) => s.globals);
  const [bulk, setBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [fetchingSchema, setFetchingSchema] = useState(false);
  const binaryInput = useRef<HTMLInputElement | null>(null);

  const body = tab.draft.body;
  const patchBody = (p: Partial<RequestBody>) => patchDraft(tab.id, { body: { ...body, ...p } });

  const onBinaryPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const up = await getClient().uploadFile(file);
      patchBody({ binary: { fileName: up.fileName, size: up.size, fileId: up.fileId } });
    } catch {
      /* the client already toasted the daemon's message */
    }
  };

  const refetchSchema = async () => {
    if (fetchingSchema) return;
    setFetchingSchema(true);
    const active = environments.find((e) => e.isActive);
    const { resolved } = resolveText(tab.draft.url, buildVarMap(globals, active?.variables));
    try {
      const r = await getClient().introspectGraphql(resolved);
      if (r.error) {
        pushToast({ kind: "info", text: "Introspection failed", sub: r.error });
        return;
      }
      patchBody({ graphql: { ...body.graphql, schemaFetched: true, typeCount: r.typeCount } });
      pushToast({ kind: "info", text: "Schema fetched", sub: `${r.typeCount} types · HTTP ${r.status}` });
    } catch {
      /* the client already toasted the daemon's message */
    } finally {
      setFetchingSchema(false);
    }
  };

  const toggleBulk = (rows: KVRow[], commit: (rows: KVRow[]) => void) => {
    if (!bulk) setBulkText(rowsToBulk(rows));
    else commit(bulkToRows(bulkText, rows));
    setBulk(!bulk);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* mode chips + provenance */}
      <div className="flex min-h-8 flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          value={body.mode}
          onValueChange={(v) => v && patchBody({ mode: v as BodyMode })}
          aria-label="Body type"
          spacing={1}
          className="flex-wrap"
        >
          {MODES.map((m) => (
            <ToggleGroupItem
              key={m.id}
              value={m.id}
              className={cn(
                "h-8 rounded-md px-3 text-base font-normal",
                "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
                body.mode === m.id
                  ? "bg-ds-gray-200 font-medium text-ink data-[state=on]:bg-ds-gray-200"
                  : "text-ink-2 hover:bg-hoverbg hover:text-ink",
              )}
            >
              {m.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex-1" />
        {route.schemaRef ? (
          <Pill tone="accent" className="gap-1 font-mono">
            inferred · <SourceRef fileRef={route.schemaRef} className="text-2xs" />
          </Pill>
        ) : null}
      </div>

      {body.mode === "none" ? (
        <p className={cn("text-base text-ink-3", ENTER)}>This request has no body.</p>
      ) : null}

      {body.mode === "raw" ? (
        <div className={ENTER}>
          <CodeEditor
            ariaLabel="Request body"
            language={body.raw.language === "text" ? "text" : body.raw.language}
            value={body.raw.text}
            onChange={(text) => patchBody({ raw: { ...body.raw, text } })}
            minHeight="240px"
          />
        </div>
      ) : null}

      {body.mode === "form-data" ? (
        <section className={ENTER}>
          <CapsHeader
            right={
              <GhostButton
                size="sm"
                aria-label={bulk ? "Finish bulk edit" : "Bulk edit form data"}
                onClick={() =>
                  toggleBulk(body.formData, (rows) =>
                    patchBody({ formData: rows.map((r) => ({ type: "text", ...r })) as FormRow[] }),
                  )
                }
              >
                {bulk ? "Done" : "Bulk Edit"}
              </GhostButton>
            }
          >
            Form data
          </CapsHeader>
          {bulk ? (
            <BulkEditor value={bulkText} onChange={setBulkText} label="Bulk edit form data" />
          ) : (
            <KeyValueTable
              label="Form data"
              rows={body.formData}
              onChange={(formData) => patchBody({ formData })}
              makeRow={makeFormRow}
              showType
            />
          )}
        </section>
      ) : null}

      {body.mode === "urlencoded" ? (
        <section className={ENTER}>
          <CapsHeader
            right={
              <GhostButton
                size="sm"
                aria-label={bulk ? "Finish bulk edit" : "Bulk edit urlencoded fields"}
                onClick={() => toggleBulk(body.urlencoded, (rows) => patchBody({ urlencoded: rows }))}
              >
                {bulk ? "Done" : "Bulk Edit"}
              </GhostButton>
            }
          >
            Urlencoded
          </CapsHeader>
          {bulk ? (
            <BulkEditor value={bulkText} onChange={setBulkText} label="Bulk edit urlencoded fields" />
          ) : (
            <KeyValueTable
              label="Urlencoded fields"
              rows={body.urlencoded}
              onChange={(urlencoded) => patchBody({ urlencoded })}
              makeRow={makeKv}
            />
          )}
        </section>
      ) : null}

      {body.mode === "binary" ? (
        <button
          type="button"
          onClick={() => (body.binary ? patchBody({ binary: null }) : binaryInput.current?.click())}
          className={cn(
            "flex h-24 items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-ds-gray-100 text-base text-ink-3",
            "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
            "hover:border-line-strong hover:bg-ds-gray-200 hover:text-ink-2",
            ENTER,
          )}
        >
          <Paperclip size={16} strokeWidth={1.5} />
          {body.binary ? (
            <span className="inline-flex h-6 items-center rounded-md bg-ds-gray-alpha-200 px-2 font-mono text-xs text-ink-2">
              {body.binary.fileName} · {(body.binary.size / 1024).toFixed(0)} KB — click to clear
            </span>
          ) : (
            "Click to choose a file"
          )}
        </button>
      ) : null}
      <input ref={binaryInput} type="file" className="hidden" aria-hidden tabIndex={-1} onChange={(e) => void onBinaryPicked(e)} />

      {body.mode === "graphql" ? (
        <div className={cn("flex flex-col gap-3", ENTER)}>
          <div className="flex h-8 items-center gap-2">
            <Dot tone={body.graphql.schemaFetched ? "ok" : "muted"} />
            <span className="text-base text-ink-2">
              {body.graphql.schemaFetched ? `schema fetched · ${body.graphql.typeCount} types` : "schema not fetched yet"}
            </span>
            <div className="flex-1" />
            <GhostButton size="sm" onClick={() => void refetchSchema()} disabled={fetchingSchema}>
              {fetchingSchema ? "Fetching…" : body.graphql.schemaFetched ? "Refetch" : "Fetch schema"}
            </GhostButton>
          </div>
          <CapsHeader className="h-6">Query</CapsHeader>
          <CodeEditor
            ariaLabel="GraphQL query"
            language="graphql"
            value={body.graphql.query}
            onChange={(query) => patchBody({ graphql: { ...body.graphql, query } })}
            minHeight="160px"
            className={NO_GUTTER}
          />
          <CapsHeader className="h-6">Variables</CapsHeader>
          <CodeEditor
            ariaLabel="GraphQL variables"
            language="json"
            value={body.graphql.variables}
            onChange={(variables) => patchBody({ graphql: { ...body.graphql, variables } })}
            minHeight="96px"
            className={NO_GUTTER}
          />
        </div>
      ) : null}
    </div>
  );
}
