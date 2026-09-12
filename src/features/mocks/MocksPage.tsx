import { ChevronDown, ChevronLeft, Copy, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AccentButton, Dot, GhostButton, MethodBadge, StatusChip } from "@/components/primitives";
import { DataTable, type ColumnDef } from "@/components/table/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { KVRow, Mock } from "@/daemon/types";
import { CodeEditor } from "@/lib/codemirror/CodeEditor";
import { clockTime } from "@/lib/format";
import { ROW_DATA, ROW_MD } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { useStore } from "@/state/store";

const MOCK_STATUS_CODES = [200, 201, 204, 400, 401, 403, 404, 409, 422, 500, 503];

/* ── Page frame (mirrors the Tests/Specs frame: one scroller, 28px gutter) ── */

function PageBody({ children }: { children: ReactNode }) {
  return <div className="fade-scroll h-full min-h-0 overflow-y-auto px-7 pt-6 pb-10">{children}</div>;
}

function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-8 items-center", className)}>
      <span className="caps-label">{children}</span>
    </div>
  );
}

/** Mocks section — server overview table, or the editor for one mock. */
export function MocksPage() {
  const selectedMockId = useStore((s) => s.sections.mocks.selectedMockId);
  const mock = useStore((s) => s.mocks.find((m) => m.id === s.sections.mocks.selectedMockId));
  if (selectedMockId && mock) return <MockEditor mock={mock} />;
  return <MocksHome />;
}

/* ── Mock server home ─────────────────────────────────────────────────────── */

function MocksHome() {
  const mocks = useStore((s) => s.mocks);
  const mockServer = useStore((s) => s.mockServer);
  const routes = useStore((s) => s.routes);
  const navigate = useStore((s) => s.navigate);
  const saveMock = useStore((s) => s.saveMock);
  const pushToast = useStore((s) => s.pushToast);

  const routeById = new Map(routes.map((r) => [r.id, r]));
  const enabled = mocks.filter((m) => m.enabled).length;
  const running = mockServer?.running !== false;
  const url = mockServer?.url ?? "http://localhost:23501";

  const copyBaseUrl = () => {
    void navigator.clipboard?.writeText(url);
    pushToast({ kind: "info", text: "Base URL copied", sub: url });
  };

  const newMock = () => {
    const route = routeById.get(mocks[0]?.routeId) ?? routes.find((r) => r.protocol === "http");
    if (!route) return;
    const stamp = Date.now().toString(36);
    const mock: Mock = {
      id: `mock_${stamp}`,
      name: "New mock",
      routeId: route.id,
      statusCode: 200,
      delayMs: null,
      enabled: false,
      headers: [
        {
          id: `mh_ct_${stamp}`,
          key: "Content-Type",
          value: "application/json",
          description: "",
          enabled: true,
        },
      ],
      body: "{}",
      recentHits: [],
    };
    void saveMock(mock);
    navigate({ go: "mock", mockId: mock.id });
  };

  const columns: Array<ColumnDef<Mock>> = [
    {
      id: "name",
      header: "Name",
      cell: (m) => <span className="truncate text-ink">{m.name}</span>,
    },
    {
      id: "route",
      header: "Route",
      width: 320,
      cell: (m) => {
        const route = routeById.get(m.routeId);
        return (
          <>
            <MethodBadge method={route?.method ?? "GET"} />
            <span className="truncate font-mono text-sm text-ink-2">{route?.path}</span>
          </>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      width: 90,
      cell: (m) => <StatusChip code={m.statusCode} label={String(m.statusCode)} />,
    },
    {
      id: "delay",
      header: "Delay",
      width: 90,
      mono: true,
      cell: (m) =>
        m.delayMs != null ? (
          <span className="tabular-nums text-ink-2">{m.delayMs} ms</span>
        ) : (
          <span className="text-ink-3">—</span>
        ),
    },
    {
      id: "enabled",
      header: "Enabled",
      width: 84,
      cell: (m) => (
        <Switch
          checked={m.enabled}
          aria-label={`${m.name} enabled`}
          onClick={(e) => e.stopPropagation()}
          onCheckedChange={(v) => void saveMock({ ...m, enabled: v })}
          className="transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]"
        />
      ),
    },
  ];

  return (
    <PageBody>
      <div className="flex min-h-9 items-center gap-3">
        <h1 className="shrink-0 text-md font-semibold text-ink">Mock server</h1>
        <span className="flex shrink-0 items-center gap-1.5 text-base text-ink-2">
          <Dot tone={running ? "ok" : "muted"} />
          {running ? "Running" : "Stopped"}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <GhostButton onClick={copyBaseUrl}>
            <Copy size={16} strokeWidth={1.5} />
            Copy base URL
          </GhostButton>
          <AccentButton onClick={newMock}>
            <Plus size={16} strokeWidth={1.5} />
            New mock
          </AccentButton>
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-mono text-sm text-link-z">{url}</span>
        <span className="text-xs text-ink-3">
          · {mocks.length} mocks · {enabled} enabled · port auto-assigned (studio + 1)
        </span>
      </div>

      <DataTable
        className="mt-5"
        label="Mocks"
        columns={columns}
        rows={mocks}
        rowKey={(m) => m.id}
        rowHeight={ROW_MD}
        onRowClick={(m) => navigate({ go: "mock", mockId: m.id })}
      />

      <SectionLabel className="mt-8">Seeding</SectionLabel>
      <p className="max-w-[560px] text-base leading-5 text-ink-2">
        Mocks serve saved examples. Save any response as an example in the workbench and seed a
        mock from it.
      </p>
    </PageBody>
  );
}

/* ── Mock editor ──────────────────────────────────────────────────────────── */

function MockEditor({ mock }: { mock: Mock }) {
  const route = useStore((s) => s.routes.find((r) => r.id === mock.routeId));
  const navigate = useStore((s) => s.navigate);
  const saveMock = useStore((s) => s.saveMock);
  const pushDialog = useStore((s) => s.pushDialog);

  const statusId = useId();
  const delayId = useId();
  const [delayText, setDelayText] = useState(mock.delayMs != null ? `${mock.delayMs} ms` : "");
  const [body, setBody] = useState(mock.body);
  const [newHeader, setNewHeader] = useState({ key: "", value: "" });
  const bodyTimer = useRef<number | null>(null);

  // Re-sync local fields when a different mock is opened.
  useEffect(() => {
    setDelayText(mock.delayMs != null ? `${mock.delayMs} ms` : "");
    setBody(mock.body);
    setNewHeader({ key: "", value: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mock.id]);

  const commitDelay = () => {
    const parsed = /\d+/.exec(delayText);
    const delayMs = parsed ? Number(parsed[0]) : null;
    setDelayText(delayMs != null ? `${delayMs} ms` : "");
    if (delayMs !== mock.delayMs) void saveMock({ ...mock, delayMs });
  };

  const commitBody = (next: string) => {
    setBody(next);
    if (bodyTimer.current != null) window.clearTimeout(bodyTimer.current);
    bodyTimer.current = window.setTimeout(() => {
      const current = useStore.getState().mocks.find((m) => m.id === mock.id);
      if (current) void saveMock({ ...current, body: next });
    }, 400);
  };

  const addHeader = () => {
    const key = newHeader.key.trim();
    const value = newHeader.value.trim();
    if (!key || !value) return;
    void saveMock({
      ...mock,
      headers: [
        ...mock.headers,
        { id: `mh_${Date.now().toString(36)}`, key, value, description: "", enabled: true },
      ],
    });
    setNewHeader({ key: "", value: "" });
  };

  const headerColumns: Array<ColumnDef<KVRow>> = [
    {
      id: "key",
      header: "Header",
      width: 240,
      cell: (h) => <span className="truncate text-ink">{h.key}</span>,
    },
    {
      id: "value",
      header: "Value",
      mono: true,
      cell: (h) => <span className="truncate text-ink-2">{h.value}</span>,
    },
  ];

  const hitColumns: Array<ColumnDef<Mock["recentHits"][number]>> = [
    {
      id: "time",
      header: "Time",
      width: 140,
      mono: true,
      cell: (h) => <span className="tabular-nums text-ink-3">{clockTime(h.at)}</span>,
    },
    {
      id: "caller",
      header: "Caller",
      mono: true,
      cell: (h) => (
        <span className="truncate text-ink-2">
          {h.path} via {h.caller}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: 90,
      mono: true,
      cell: (h) => <span className="tabular-nums text-ink-2">{h.status}</span>,
    },
    {
      id: "duration",
      header: "Duration",
      width: 100,
      align: "right",
      mono: true,
      cell: (h) => <span className="tabular-nums text-ink-3">{h.ms} ms</span>,
    },
  ];

  return (
    <PageBody>
      <Button
        type="button"
        variant="ghost"
        onClick={() => navigate({ go: "mock" })}
        className={cn(
          "-ml-2 gap-1 px-2 text-base font-normal text-ink-2",
          "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
          "hover:bg-ds-gray-alpha-100 hover:text-ink focus-visible:bg-ds-gray-alpha-100 focus-visible:text-ink",
        )}
      >
        <ChevronLeft size={16} strokeWidth={1.5} />
        Mocks
      </Button>

      <div className="mt-4 flex min-h-9 items-center gap-3">
        <h1 className="shrink-0 text-md font-semibold text-ink">{mock.name}</h1>
        <MethodBadge method={route?.method ?? "GET"} />
        <span className="min-w-0 truncate font-mono text-sm text-ink-2">{route?.path}</span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Label htmlFor={`${statusId}-enabled`} className="text-base font-normal text-ink-2">
            Enabled
          </Label>
          <Switch
            id={`${statusId}-enabled`}
            checked={mock.enabled}
            onCheckedChange={(v) => void saveMock({ ...mock, enabled: v })}
            className="transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-6">
        <div className="flex w-56 flex-col gap-1.5">
          <Label htmlFor={statusId} className="text-xs font-normal text-ink-3">
            Status code
          </Label>
          <Select
            value={String(mock.statusCode)}
            onValueChange={(v) => void saveMock({ ...mock, statusCode: Number(v) })}
          >
            <SelectTrigger
              id={statusId}
              className="h-9 w-full border-line bg-ds-gray-100 font-mono text-sm text-ink [&_svg]:stroke-[1.5] dark:bg-ds-gray-100 dark:hover:bg-ds-gray-200"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MOCK_STATUS_CODES.map((c) => (
                <SelectItem key={c} value={String(c)} className="font-mono text-sm">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex w-56 flex-col gap-1.5">
          <Label htmlFor={delayId} className="text-xs font-normal text-ink-3">
            Delay
          </Label>
          <Input
            id={delayId}
            value={delayText}
            onChange={(e) => setDelayText(e.target.value)}
            onBlur={commitDelay}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitDelay();
            }}
            placeholder="none"
            className="h-9 border-line bg-ds-gray-100 font-mono text-sm"
          />
        </div>
      </div>

      <SectionLabel className="mt-6">Response headers</SectionLabel>
      <DataTable
        className="[&_th]:static"
        label="Response headers"
        columns={headerColumns}
        rows={mock.headers}
        rowKey={(h) => h.id}
        rowHeight={ROW_DATA}
        trailing={
          <div className="flex h-9 items-center gap-2">
            <Input
              value={newHeader.key}
              onChange={(e) => setNewHeader((h) => ({ ...h, key: e.target.value }))}
              onBlur={addHeader}
              onKeyDown={(e) => {
                if (e.key === "Enter") addHeader();
              }}
              placeholder="Header"
              aria-label="New header name"
              className="h-8 w-[232px] border-transparent bg-transparent px-0 text-base dark:bg-transparent"
            />
            <Input
              value={newHeader.value}
              onChange={(e) => setNewHeader((h) => ({ ...h, value: e.target.value }))}
              onBlur={addHeader}
              onKeyDown={(e) => {
                if (e.key === "Enter") addHeader();
              }}
              placeholder="Value"
              aria-label="New header value"
              className="h-8 flex-1 border-transparent bg-transparent px-0 font-mono text-sm dark:bg-transparent"
            />
          </div>
        }
      />

      <SectionLabel className="mt-6">Response body</SectionLabel>
      <div className="relative">
        <div className="absolute top-2.5 right-2.5 z-10">
          <GhostButton
            size="sm"
            onClick={() => pushDialog({ kind: "examples", routeId: mock.routeId })}
          >
            Seed from example
            <ChevronDown size={16} strokeWidth={1.5} className="text-ink-3" />
          </GhostButton>
        </div>
        <CodeEditor
          ariaLabel="Mock response body"
          value={body}
          onChange={commitBody}
          language="json"
          minHeight="176px"
          highlightVariables={false}
        />
      </div>

      <SectionLabel className="mt-6">Recent hits</SectionLabel>
      {mock.recentHits.length > 0 ? (
        <DataTable
          className="[&_th]:static"
          label="Recent hits"
          columns={hitColumns}
          rows={mock.recentHits}
          rowKey={(h) => `${h.at}_${h.path}`}
          rowHeight={ROW_DATA}
        />
      ) : (
        <div className="flex h-16 items-center text-base text-ink-3">No hits recorded yet</div>
      )}
    </PageBody>
  );
}
