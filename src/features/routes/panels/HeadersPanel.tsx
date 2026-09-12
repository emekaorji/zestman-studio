import { useState } from "react";
import type { KVRow, Route } from "@/daemon/types";
import type { OpenTab } from "@/state/slices/workbench";
import { useStore } from "@/state/store";
import { CapsHeader, GhostButton, Pill } from "@/components/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { id } from "@/lib/ids";
import { ROW_MD } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { KeyValueTable } from "./KeyValueTable";
import { BulkEditor, bulkToRows, rowsToBulk } from "./BulkEditor";

const makeKv = (): KVRow => ({ id: id("kv"), key: "", value: "", description: "", enabled: true });

const LEAD_W = 36; // matches the KeyValueTable checkbox column, so keys line up
const KEY_W = 240;
const VALUE_W = 300;
const STAGGER_MS = 15;

const HEAD = "h-10 border-b border-line px-1.5 text-base font-normal text-ds-gray-600";
/* No per-row hairlines — structure comes from the hover fill, Vercel-style. */
const CELL = cn(
  "border-0 px-1.5 py-0 align-middle",
  "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
  "group-hover/row:bg-ds-gray-alpha-100",
);

/** Read-only table of the headers the daemon adds for you. */
function AutoHeaders({ headers }: { headers: Route["autoHeaders"] }) {
  return (
    <Table
      aria-label="Auto-generated headers"
      className="w-full table-fixed border-separate border-spacing-0 text-base"
    >
      <colgroup>
        <col style={{ width: LEAD_W }} />
        <col style={{ width: KEY_W }} />
        <col style={{ width: VALUE_W }} />
        <col />
      </colgroup>
      <TableHeader>
        <TableRow className="border-0 hover:bg-transparent">
          <TableHead className={cn(HEAD, "pl-2")} />
          <TableHead scope="col" className={HEAD}>
            Key
          </TableHead>
          <TableHead scope="col" className={HEAD}>
            Value
          </TableHead>
          <TableHead scope="col" className={cn(HEAD, "pr-2")}>
            Description
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {headers.map((h, i) => {
          const isAuto = h.note === "auto";
          return (
            <TableRow
              key={h.key}
              style={{ animationDelay: `${i * STAGGER_MS}ms` }}
              className="group/row animate-in fade-in-0 fill-mode-both border-0 duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-transparent"
            >
              <TableCell className={cn(CELL, "rounded-l-md pl-2")}>
                <div style={{ height: ROW_MD }} />
              </TableCell>
              <TableCell className={CELL}>
                <div className="flex items-center" style={{ height: ROW_MD }}>
                  <span className="truncate font-mono text-sm text-ink-2">{h.key}</span>
                </div>
              </TableCell>
              <TableCell className={CELL}>
                <div className="flex items-center" style={{ height: ROW_MD }}>
                  {isAuto ? (
                    <Pill tone="ok" className="font-mono">
                      auto
                    </Pill>
                  ) : (
                    <span className="truncate font-mono text-sm text-ink-2">{h.value}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className={cn(CELL, "rounded-r-md pr-2")}>
                <div className="flex items-center" style={{ height: ROW_MD }}>
                  <span className="truncate text-base text-ink-3">{isAuto ? h.value : h.note}</span>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function HeadersPanel({ tab, route }: { tab: OpenTab; route: Route }) {
  const patchDraft = useStore((s) => s.patchDraft);
  const [bulk, setBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const toggleBulk = () => {
    if (!bulk) setBulkText(rowsToBulk(tab.draft.headers));
    else patchDraft(tab.id, { headers: bulkToRows(bulkText, tab.draft.headers) });
    setBulk(!bulk);
  };

  return (
    <div className="flex flex-col gap-6">
      <section>
        <CapsHeader right={<span className="text-xs text-ink-3">derived from body &amp; environment</span>}>
          Auto-generated
        </CapsHeader>
        <AutoHeaders headers={route.autoHeaders} />
      </section>

      <section>
        <CapsHeader
          right={
            <GhostButton size="sm" onClick={toggleBulk} aria-label={bulk ? "Finish bulk edit" : "Bulk edit headers"}>
              {bulk ? "Done" : "Bulk Edit"}
            </GhostButton>
          }
        >
          Custom headers
        </CapsHeader>
        {bulk ? (
          <BulkEditor value={bulkText} onChange={setBulkText} label="Bulk edit headers" />
        ) : (
          <KeyValueTable
            label="Custom headers"
            rows={tab.draft.headers}
            onChange={(headers) => patchDraft(tab.id, { headers })}
            makeRow={makeKv}
          />
        )}
      </section>
    </div>
  );
}
