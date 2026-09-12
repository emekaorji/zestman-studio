import { X } from "lucide-react";
import { useState } from "react";
import { AccentButton, GhostButton, Pill } from "@/components/primitives";
import { DialogFrame, DialogFooterSplit } from "@/components/dialogs/DialogFrame";
import { DataTable, type ColumnDef } from "@/components/table/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/state/store";
import { id } from "@/lib/ids";
import { ROW_MD } from "@/lib/metrics";
import type { CookieRow } from "@/daemon/types";

const INPUT_CLS =
  "h-8 border-line bg-sunken font-mono text-sm text-ink dark:bg-sunken placeholder:text-ink-3";

export function CookiesDialog() {
  const cookies = useStore((s) => s.cookies);
  const saveCookies = useStore((s) => s.saveCookies);
  const popDialog = useStore((s) => s.popDialog);
  const [domain, setDomain] = useState("");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");

  const remove = (row: CookieRow) => void saveCookies(cookies.filter((c) => c.id !== row.id));

  const add = () => {
    if (!domain.trim() || !name.trim()) return;
    void saveCookies([
      ...cookies,
      {
        id: id("ck"),
        domain: domain.trim(),
        name: name.trim(),
        value: value.trim(),
        path: "/",
        expires: "session",
        flags: [],
      },
    ]);
    setDomain("");
    setName("");
    setValue("");
  };

  const columns: Array<ColumnDef<CookieRow>> = [
    {
      id: "domain",
      header: "Domain",
      width: 150,
      mono: true,
      cell: (r) => <span className="truncate text-ink">{r.domain}</span>,
    },
    {
      id: "name",
      header: "Name",
      width: 100,
      mono: true,
      cell: (r) => <span className="truncate text-ink-2">{r.name}</span>,
    },
    {
      id: "value",
      header: "Value",
      mono: true,
      cell: (r) => <span className="truncate text-ink-2">{r.value}</span>,
    },
    {
      id: "path",
      header: "Path",
      width: 50,
      mono: true,
      cell: (r) => <span className="text-ink-2">{r.path}</span>,
    },
    {
      id: "expires",
      header: "Expires",
      width: 100,
      mono: true,
      cell: (r) => <span className="truncate text-ink-2">{r.expires}</span>,
    },
    {
      id: "flags",
      header: "Flags",
      width: 96,
      cell: (r) =>
        r.flags.length > 0 ? (
          <span className="flex items-center gap-1">
            {r.flags.map((f) => (
              <Pill key={f} tone="neutral" className="px-1.5">
                {f}
              </Pill>
            ))}
          </span>
        ) : (
          <span className="text-base text-ink-3">—</span>
        ),
    },
    {
      id: "remove",
      header: "",
      width: 32,
      align: "right",
      cell: (r) => (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation();
            remove(r);
          }}
          aria-label={`Remove cookie ${r.name}`}
          className="text-ink-3 opacity-0 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink focus-visible:opacity-100"
        >
          <X size={14} strokeWidth={1.5} />
        </Button>
      ),
    },
  ];

  return (
    <DialogFrame
      title="Cookies"
      titleRight={<span className="font-mono text-xs text-ink-3">jar · .zestman/cookies.json</span>}
      width={680}
      footer={
        <DialogFooterSplit
          left={
            <GhostButton tone="danger" onClick={() => void saveCookies([])}>
              Clear all
            </GhostButton>
          }
          right={<AccentButton onClick={popDialog}>Done</AccentButton>}
        />
      }
    >
      <DataTable
        columns={columns}
        rows={cookies}
        rowKey={(r) => r.id}
        rowHeight={ROW_MD}
        label="Stored cookies"
      />
      <div className="mt-3 flex items-center gap-2">
        <Input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="Domain"
          aria-label="Cookie domain"
          className={`${INPUT_CLS} w-37.5`}
        />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          aria-label="Cookie name"
          className={`${INPUT_CLS} w-28`}
        />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="Value"
          aria-label="Cookie value"
          className={`${INPUT_CLS} min-w-0 flex-1`}
        />
        <GhostButton size="sm" onClick={add} disabled={!domain.trim() || !name.trim()}>
          Add
        </GhostButton>
      </div>
    </DialogFrame>
  );
}
