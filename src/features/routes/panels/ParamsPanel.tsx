import { useState } from "react";
import type { KVRow } from "@/daemon/types";
import type { OpenTab } from "@/state/slices/workbench";
import { useStore } from "@/state/store";
import { CapsHeader, GhostButton } from "@/components/primitives";
import { id } from "@/lib/ids";
import { KeyValueTable } from "./KeyValueTable";
import { BulkEditor, bulkToRows, rowsToBulk } from "./BulkEditor";

const makeKv = (): KVRow => ({ id: id("kv"), key: "", value: "", description: "", enabled: true });

export function ParamsPanel({ tab }: { tab: OpenTab }) {
  const patchDraft = useStore((s) => s.patchDraft);
  const [bulk, setBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const toggleBulk = () => {
    if (!bulk) setBulkText(rowsToBulk(tab.draft.query));
    else patchDraft(tab.id, { query: bulkToRows(bulkText, tab.draft.query) });
    setBulk(!bulk);
  };

  return (
    <div className="flex flex-col gap-6">
      <section>
        <CapsHeader
          right={
            <GhostButton size="sm" onClick={toggleBulk} aria-label={bulk ? "Finish bulk edit" : "Bulk edit query params"}>
              {bulk ? "Done" : "Bulk Edit"}
            </GhostButton>
          }
        >
          Query params
        </CapsHeader>
        {bulk ? (
          <BulkEditor value={bulkText} onChange={setBulkText} label="Bulk edit query params" />
        ) : (
          <KeyValueTable
            label="Query params"
            rows={tab.draft.query}
            onChange={(query) => patchDraft(tab.id, { query })}
            makeRow={makeKv}
          />
        )}
      </section>

      <section>
        <CapsHeader>Path variables</CapsHeader>
        {tab.draft.params.length > 0 ? (
          <KeyValueTable
            label="Path variables"
            rows={tab.draft.params}
            onChange={(params) => patchDraft(tab.id, { params })}
            makeRow={makeKv}
          />
        ) : (
          <p className="pt-1 text-base text-ink-3">No path variables for this route</p>
        )}
      </section>
    </div>
  );
}
