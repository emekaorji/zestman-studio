import { useRef } from "react";
import { X } from "lucide-react";
import type { FormRow, KVRow } from "@/daemon/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBytes } from "@/lib/format";
import { id } from "@/lib/ids";
import { ROW_MD, TABLE_HEAD_H } from "@/lib/metrics";
import { cn } from "@/lib/utils";

const CHECK_W = 36;
const KEY_W = 240;
const VALUE_W = 300;
const TYPE_W = 96;
const ACTION_W = 36;

/* Rows fade in with a short stagger — same choreography as DataTable. */
const STAGGER_MS = 15;
const STAGGER_MAX = 12;

/**
 * A borderless cell input: reads as plain text until hovered or focused, then
 * shows the real control. Everything is a shadcn `Input`, so the focus ring,
 * disabled handling and placeholder colour come from the component.
 */
const CELL_INPUT = cn(
  "h-8 rounded-md border-transparent bg-transparent px-2 font-mono text-sm shadow-none",
  "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
  "hover:border-ds-gray-400 dark:bg-transparent dark:hover:bg-transparent",
);

/**
 * The editable key/value grid behind Params, Headers, form-data and urlencoded.
 *
 * Vercel's dense-table treatment: one hairline under the h40 header and none
 * between rows, h36 rows whose hover/selection is an inset rounded fill, mono
 * 13px data. The trailing muted row becomes a real row on the first keystroke
 * and keeps the caret, so typing never breaks.
 */
export function KeyValueTable<Row extends KVRow>({
  rows,
  onChange,
  makeRow,
  showType = false,
  label,
  className,
}: {
  rows: Row[];
  onChange: (rows: Row[]) => void;
  /** Builds a fresh empty row (typed for KVRow vs FormRow). */
  makeRow: () => Row;
  showType?: boolean;
  /** Accessible name for the table. */
  label?: string;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  const patch = (rowId: string, p: Partial<Row>) =>
    onChange(rows.map((r) => (r.id === rowId ? { ...r, ...p } : r)));

  const addFrom = (field: "key" | "value" | "description", text: string) => {
    const row = { ...makeRow(), id: id("kv"), [field]: text } as Row;
    onChange([...rows, row]);
    // move focus into the freshly created row so typing continues seamlessly
    requestAnimationFrame(() => {
      const el = rootRef.current?.querySelector<HTMLInputElement>(
        `input[data-rowid="${row.id}"][data-field="${field}"]`,
      );
      el?.focus();
      el?.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const setType = (row: Row & Partial<FormRow>, next: "text" | "file") => {
    const p: Partial<FormRow> =
      next === "file"
        ? { type: next, fileName: row.fileName ?? "avatar.png", fileSize: row.fileSize ?? 24 * 1024 }
        : { type: next, fileName: undefined, fileSize: undefined };
    patch(row.id, p as unknown as Partial<Row>);
  };

  const head = cn(
    "h-10 border-b border-line px-1.5 text-base font-normal text-ds-gray-600",
  );

  return (
    <div ref={rootRef} className={cn("min-w-0", className)}>
      <Table
        aria-label={label}
        className="w-full table-fixed border-separate border-spacing-0 text-base"
        style={{ minWidth: CHECK_W + KEY_W + VALUE_W + ACTION_W + 200 }}
      >
        <colgroup>
          <col style={{ width: CHECK_W }} />
          <col style={{ width: KEY_W }} />
          {showType ? <col style={{ width: TYPE_W }} /> : null}
          <col style={{ width: VALUE_W }} />
          <col />
          <col style={{ width: ACTION_W }} />
        </colgroup>
        <TableHeader>
          <TableRow className="border-0 hover:bg-transparent">
            <TableHead className={cn(head, "pl-2")}>
              <span className="sr-only">Enabled</span>
            </TableHead>
            <TableHead scope="col" className={head} style={{ height: TABLE_HEAD_H }}>
              Key
            </TableHead>
            {showType ? (
              <TableHead scope="col" className={head}>
                Type
              </TableHead>
            ) : null}
            <TableHead scope="col" className={head}>
              Value
            </TableHead>
            <TableHead scope="col" className={head}>
              Description
            </TableHead>
            <TableHead className={cn(head, "pr-2")}>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((row, index) => {
            const f = row as Row & Partial<FormRow>;
            const isFile = showType && f.type === "file";
            const cell = cn(
              "border-0 px-1.5 py-0 align-middle",
              "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
              "group-hover/row:bg-ds-gray-alpha-100 group-focus-within/row:bg-ds-gray-alpha-100",
            );
            return (
              <TableRow
                key={row.id}
                style={{ animationDelay: `${Math.min(index, STAGGER_MAX) * STAGGER_MS}ms` }}
                className={cn(
                  "group/row animate-in fade-in-0 fill-mode-both border-0 hover:bg-transparent",
                  "duration-[var(--dur-base)] ease-[var(--ease-out)]",
                )}
              >
                <TableCell className={cn(cell, "rounded-l-md pl-2")}>
                  <div className="flex items-center" style={{ height: ROW_MD }}>
                    <Checkbox
                      checked={row.enabled}
                      aria-label={row.key ? `Enable ${row.key}` : "Enable row"}
                      onCheckedChange={(v) => patch(row.id, { enabled: v === true } as Partial<Row>)}
                    />
                  </div>
                </TableCell>

                <TableCell className={cell}>
                  <Input
                    value={row.key}
                    placeholder="Key"
                    aria-label={`Key, row ${index + 1}`}
                    data-rowid={row.id}
                    data-field="key"
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(e) => patch(row.id, { key: e.target.value } as Partial<Row>)}
                    className={cn(CELL_INPUT, "text-ink")}
                  />
                </TableCell>

                {showType ? (
                  <TableCell className={cell}>
                    <Select
                      value={f.type === "file" ? "file" : "text"}
                      onValueChange={(v) => setType(f, v as "text" | "file")}
                    >
                      <SelectTrigger
                        size="sm"
                        aria-label="Field type"
                        className="h-8 w-full border-transparent bg-transparent px-2 text-base text-ink-2 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:border-ds-gray-400 hover:text-ink dark:bg-transparent dark:hover:bg-transparent"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" align="start">
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="file">File</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                ) : null}

                <TableCell className={cell}>
                  {isFile ? (
                    <div className="flex items-center" style={{ height: ROW_MD }}>
                      <span className="inline-flex h-6 min-w-0 items-center gap-1.5 rounded-md bg-ds-gray-alpha-200 pr-1 pl-2 font-mono text-xs text-ink-2">
                        <span className="truncate">
                          {f.fileName ?? "file"} · {formatBytes(f.fileSize ?? 0)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Remove file ${f.fileName ?? ""}`}
                          onClick={() => setType(f, "text")}
                          className="size-4 shrink-0 text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:bg-transparent hover:text-ink"
                        >
                          <X size={14} strokeWidth={1.5} />
                        </Button>
                      </span>
                    </div>
                  ) : (
                    <Input
                      value={row.value}
                      placeholder="Value"
                      aria-label={row.key ? `Value for ${row.key}` : `Value, row ${index + 1}`}
                      data-rowid={row.id}
                      data-field="value"
                      spellCheck={false}
                      autoComplete="off"
                      onChange={(e) => patch(row.id, { value: e.target.value } as Partial<Row>)}
                      className={cn(CELL_INPUT, "text-ink")}
                    />
                  )}
                </TableCell>

                <TableCell className={cell}>
                  <Input
                    value={row.description ?? ""}
                    placeholder="Description"
                    aria-label={row.key ? `Description for ${row.key}` : `Description, row ${index + 1}`}
                    data-rowid={row.id}
                    data-field="description"
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(e) => patch(row.id, { description: e.target.value } as Partial<Row>)}
                    className={cn(CELL_INPUT, "font-sans text-base text-ink-3")}
                  />
                </TableCell>

                <TableCell className={cn(cell, "rounded-r-md pr-2")}>
                  <div className="flex items-center justify-end" style={{ height: ROW_MD }}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={row.key ? `Remove ${row.key}` : "Remove row"}
                      onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                      className={cn(
                        "text-ink-3 opacity-0 hover:text-ink",
                        "transition-[opacity,color] duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
                        "group-hover/row:opacity-100 focus-visible:opacity-100",
                      )}
                    >
                      <X size={16} strokeWidth={1.5} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}

          {/* trailing placeholder row — typing here promotes it to a real row */}
          <TableRow className="group/row border-0 hover:bg-transparent">
            <TableCell className="border-0 px-1.5 py-0 pl-2">
              <div style={{ height: ROW_MD }} />
            </TableCell>
            <TableCell className="border-0 px-1.5 py-0">
              <Input
                value=""
                placeholder="Key"
                aria-label="New key"
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => e.target.value && addFrom("key", e.target.value)}
                className={cn(CELL_INPUT, "text-ink-3")}
              />
            </TableCell>
            {showType ? <TableCell className="border-0 px-1.5 py-0" /> : null}
            <TableCell className="border-0 px-1.5 py-0">
              <Input
                value=""
                placeholder="Value"
                aria-label="New value"
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => e.target.value && addFrom("value", e.target.value)}
                className={cn(CELL_INPUT, "text-ink-3")}
              />
            </TableCell>
            <TableCell className="border-0 px-1.5 py-0">
              <Input
                value=""
                placeholder="Description"
                aria-label="New description"
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => e.target.value && addFrom("description", e.target.value)}
                className={cn(CELL_INPUT, "font-sans text-base text-ink-3")}
              />
            </TableCell>
            <TableCell className="border-0 px-1.5 py-0 pr-2" />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
