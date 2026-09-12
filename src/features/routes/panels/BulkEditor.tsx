import type { KVRow } from "@/daemon/types";
import { Textarea } from "@/components/ui/textarea";
import { id } from "@/lib/ids";

/** rows ⇄ "key: value · description" text (one row per line, Postman-style). */
export function rowsToBulk(rows: KVRow[]): string {
  return rows
    .map((r) => {
      const base = `${r.enabled ? "" : "// "}${r.key}: ${r.value}`;
      return r.description ? `${base} · ${r.description}` : base;
    })
    .join("\n");
}

export function bulkToRows(text: string, previous: KVRow[]): KVRow[] {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .map((line, i) => {
      let enabled = true;
      let body = line;
      if (body.trimStart().startsWith("//")) {
        enabled = false;
        body = body.trimStart().slice(2).trimStart();
      }
      const colon = body.indexOf(":");
      const key = colon >= 0 ? body.slice(0, colon).trim() : body.trim();
      let rest = colon >= 0 ? body.slice(colon + 1).trim() : "";
      let description = "";
      const dot = rest.indexOf(" · ");
      if (dot >= 0) {
        description = rest.slice(dot + 3).trim();
        rest = rest.slice(0, dot).trim();
      }
      return {
        id: previous[i]?.id ?? id("kv"),
        key,
        value: rest,
        description,
        enabled,
      };
    });
}

/** Mono textarea swap-in for the key/value table ("Bulk Edit"). */
export function BulkEditor({
  value,
  onChange,
  label = "Bulk edit rows",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <Textarea
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      rows={Math.max(4, value.split("\n").length + 1)}
      placeholder={"key: value · description\n// disabled: value"}
      className="mt-2 resize-y border-line bg-ds-gray-100 p-3 font-mono text-sm leading-6 text-ink animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)] dark:bg-ds-gray-100"
    />
  );
}
