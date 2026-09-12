import { useState } from "react";
import { Paperclip } from "lucide-react";
import type { BodyMode, FormRow, KVRow, RequestBody, Route } from "@/daemon/types";
import type { OpenTab } from "@/state/slices/workbench";
import { useStore } from "@/state/store";
import { CapsHeader, Dot, GhostButton, Pill } from "@/components/primitives";
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
  const [bulk, setBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const body = tab.draft.body;
  const patchBody = (p: Partial<RequestBody>) => patchDraft(tab.id, { body: { ...body, ...p } });

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
          <Pill tone="accent" className="font-mono">
            inferred · {route.schemaRef}
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
          onClick={() =>
            body.binary
              ? patchBody({ binary: null })
              : pushToast({
                  kind: "info",
                  text: "File picking needs the local daemon",
                  sub: "the browser build cannot read your disk",
                })
          }
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
            "Drop a file here or click to browse"
          )}
        </button>
      ) : null}

      {body.mode === "graphql" ? (
        <div className={cn("flex flex-col gap-3", ENTER)}>
          <div className="flex h-8 items-center gap-2">
            <Dot tone="ok" />
            <span className="text-base text-ink-2">schema fetched · {body.graphql.typeCount} types</span>
            <div className="flex-1" />
            <GhostButton
              size="sm"
              onClick={() => {
                patchBody({ graphql: { ...body.graphql, schemaFetched: true } });
                pushToast({
                  kind: "info",
                  text: "Schema refetched",
                  sub: `${body.graphql.typeCount} types · no changes`,
                });
              }}
            >
              Refetch
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
