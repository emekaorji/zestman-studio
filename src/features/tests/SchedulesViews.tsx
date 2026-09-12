import { Play, Plus, Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AccentButton, GhostButton, Pill, StatusChip } from "@/components/primitives";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Schedule } from "@/daemon/types";
import { formatMs, relTime } from "@/lib/format";
import { ROW_DATA, ROW_MD } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { useStore } from "@/state/store";
import { BackLink, PageBody, PageHead, SectionLabel, timeHM } from "./bits";

/* ── cron helpers ─────────────────────────────────────────────────────────── */

const pad = (n: number) => String(n).padStart(2, "0");
const fmtHM = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function minuteStep(cron: string): number | null {
  if (cron === "* * * * *") return 1;
  const m = /^\*\/(\d+) \* \* \* \*$/.exec(cron);
  return m ? Number(m[1]) : null;
}

/** "next runs · 09:45 · 09:50 · 09:55" preview under the cron input. */
function nextRunsLabel(cron: string): string {
  const now = new Date();
  const step = minuteStep(cron);
  if (step != null) {
    const d = new Date(now);
    d.setSeconds(0, 0);
    d.setMinutes(Math.floor(d.getMinutes() / step) * step);
    const out: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      d.setMinutes(d.getMinutes() + step);
      out.push(fmtHM(d));
    }
    return `next runs · ${out.join(" · ")}`;
  }
  const hourStep = /^0 \*(?:\/(\d+))? \* \* \*$/.exec(cron);
  if (hourStep) {
    const every = hourStep[1] ? Number(hourStep[1]) : 1;
    const d = new Date(now);
    d.setMinutes(0, 0, 0);
    d.setHours(Math.floor(d.getHours() / every) * every);
    const out: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      d.setHours(d.getHours() + every);
      out.push(fmtHM(d));
    }
    return `next runs · ${out.join(" · ")}`;
  }
  if (cron === "0 0 * * *") return "next run · 00:00";
  return "next runs · —";
}

function nextRunShort(cron: string): string {
  const step = minuteStep(cron);
  if (step != null) return `next run in ${step} m`;
  if (cron === "0 0 * * *") return "next run at 00:00";
  const hourStep = /^0 \*(?:\/(\d+))? \* \* \*$/.exec(cron);
  if (hourStep) {
    const every = hourStep[1] ? Number(hourStep[1]) : 1;
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(Math.floor(d.getHours() / every) * every + every);
    return `next run at ${fmtHM(d)}`;
  }
  return "next run soon";
}

/* ── shared cells ─────────────────────────────────────────────────────────── */

function ResultCell({ result }: { result: number | "skipped" | "passed" }) {
  if (result === "skipped") return <span className="text-base text-ink-3">skipped</span>;
  if (result === "passed") return <Pill tone="ok">passed</Pill>;
  return <StatusChip code={result} label={String(result)} />;
}

/** Cron expression as Vercel renders a code token: sunken chip, mono 13. */
function CronChip({ cron }: { cron: string }) {
  return (
    <span className="truncate rounded-md border border-line bg-ds-gray-100 px-1.5 font-mono text-sm text-ink-2">
      {cron}
    </span>
  );
}

/* ── Schedules list ───────────────────────────────────────────────────────── */

interface RunRow {
  key: string;
  at: number;
  schedule: string;
  result: number | "skipped" | "passed";
  ms: number | null;
  note?: string;
}

/** Schedules — table of cron jobs plus the merged recent-run feed. */
export function SchedulesList() {
  const schedules = useStore((s) => s.schedules);
  const navigate = useStore((s) => s.navigate);
  const saveSchedule = useStore((s) => s.saveSchedule);
  const pushToast = useStore((s) => s.pushToast);

  const recent = useMemo<RunRow[]>(() => {
    const rows = schedules.flatMap((sch) =>
      sch.results.slice(0, 4).map((r, i) => ({
        key: `${sch.id}_${i}`,
        at: r.at,
        schedule: sch.name,
        result: r.result,
        ms: r.ms,
        note: r.note,
      })),
    );
    return rows.sort((a, b) => b.at - a.at).slice(0, 5);
  }, [schedules]);

  const columns: Array<ColumnDef<Schedule>> = [
    {
      id: "name",
      header: "Name",
      cell: (s) => <span className="truncate text-ink">{s.name}</span>,
    },
    {
      id: "cron",
      header: "Cron",
      width: 150,
      cell: (s) => <CronChip cron={s.cron} />,
    },
    {
      id: "scope",
      header: "Scope",
      width: 180,
      cell: (s) => <span className="truncate text-ink-2">{s.scope}</span>,
    },
    {
      id: "lastRun",
      header: "Last run",
      width: 150,
      cell: (s) =>
        s.lastRun ? (
          <>
            {s.lastRun.code === "passed" ? (
              <Pill tone="ok">passed</Pill>
            ) : (
              <StatusChip code={s.lastRun.code} label={String(s.lastRun.code)} />
            )}
            <span className="truncate text-xs whitespace-nowrap text-ink-3">
              {relTime(s.lastRun.at)}
            </span>
          </>
        ) : (
          <span className="text-ink-3">—</span>
        ),
    },
    {
      id: "enabled",
      header: "Enabled",
      width: 84,
      cell: (s) => (
        <Switch
          checked={s.enabled}
          aria-label={`${s.name} enabled`}
          onClick={(e) => e.stopPropagation()}
          onCheckedChange={(v) => void saveSchedule({ ...s, enabled: v })}
          className="transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]"
        />
      ),
    },
    {
      id: "run",
      header: "",
      width: 44,
      align: "right",
      cell: (s) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Run ${s.name} now`}
              onClick={(e) => {
                e.stopPropagation();
                pushToast({ kind: "info", text: `Running "${s.name}" now`, sub: s.scope });
              }}
              className="text-ink-2 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink"
            >
              <Play size={16} strokeWidth={1.5} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Run now</TooltipContent>
        </Tooltip>
      ),
    },
  ];

  const runColumns: Array<ColumnDef<RunRow>> = [
    {
      id: "time",
      header: "Time",
      width: 140,
      mono: true,
      cell: (r) => <span className="tabular-nums text-ink-3">{timeHM(r.at)}</span>,
    },
    {
      id: "schedule",
      header: "Schedule",
      cell: (r) => <span className="truncate text-ink-2">{r.schedule}</span>,
    },
    {
      id: "result",
      header: "Result",
      width: 200,
      cell: (r) =>
        r.result === "skipped" ? (
          <span className="truncate whitespace-nowrap text-ink-3">skipped — window missed</span>
        ) : (
          <ResultCell result={r.result} />
        ),
    },
    {
      id: "duration",
      header: "Duration",
      width: 100,
      align: "right",
      mono: true,
      cell: (r) => (
        <span className="tabular-nums text-ink-3">{r.ms != null ? formatMs(r.ms) : "—"}</span>
      ),
    },
  ];

  return (
    <PageBody>
      <PageHead
        title="Schedules"
        sub={`${schedules.length} schedules · ${schedules[0]?.nextRunLabel ?? "none queued"}`}
        actions={
          <AccentButton onClick={() => navigate({ go: "tests", tab: "schedules", create: true })}>
            <Plus size={16} strokeWidth={1.5} />
            New schedule
          </AccentButton>
        }
      />

      <DataTable
        className="mt-5"
        label="Schedules"
        columns={columns}
        rows={schedules}
        rowKey={(s) => s.id}
        rowHeight={ROW_MD}
        onRowClick={(s) => navigate({ go: "tests", tab: "schedules", id: s.id })}
      />

      <SectionLabel className="mt-8">Recent runs</SectionLabel>
      <DataTable
        className="[&_th]:static"
        columns={runColumns}
        rows={recent}
        rowKey={(r) => r.key}
        rowHeight={ROW_DATA}
      />
    </PageBody>
  );
}

/* ── Schedule detail ──────────────────────────────────────────────────────── */

/** Read-only definition row: caps label over a hairline-underlined value. */
function Field({
  label,
  children,
  right,
}: {
  label: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-ink-3">{label}</div>
      <div className="flex h-9 items-center justify-between gap-3 border-b border-line">
        {children}
        {right}
      </div>
    </div>
  );
}

interface ResultRow {
  key: string;
  at: number;
  result: number | "skipped" | "passed";
  ms: number | null;
  note?: string;
}

/** One schedule — config fields and the last-10 results with their notes. */
export function ScheduleDetail({ scheduleId }: { scheduleId: string }) {
  const schedule = useStore((s) => s.schedules.find((x) => x.id === scheduleId));
  const navigate = useStore((s) => s.navigate);
  const saveSchedule = useStore((s) => s.saveSchedule);
  const pushDialog = useStore((s) => s.pushDialog);
  const pushToast = useStore((s) => s.pushToast);

  const resultRows = useMemo<ResultRow[]>(
    () =>
      (schedule?.results ?? []).map((r, i) => ({
        key: `${r.at}_${i}`,
        at: r.at,
        result: r.result,
        ms: r.ms,
        note: r.note,
      })),
    [schedule?.results],
  );

  if (!schedule) return null;

  const deleteSchedule = () => {
    pushDialog({
      kind: "confirm",
      title: "Delete schedule",
      body: `"${schedule.name}" and its run history will be removed.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        void useStore.getState().deleteSchedule(schedule.id);
        navigate({ go: "tests", tab: "schedules" });
        pushToast({ kind: "info", text: `Schedule "${schedule.name}" deleted` });
      },
    });
  };

  const resultColumns: Array<ColumnDef<ResultRow>> = [
    {
      id: "time",
      header: "Time",
      width: 140,
      mono: true,
      cell: (r) => <span className="tabular-nums text-ink-3">{timeHM(r.at)}</span>,
    },
    {
      id: "result",
      header: "Result",
      width: 140,
      cell: (r) => <ResultCell result={r.result} />,
    },
    {
      id: "duration",
      header: "Duration",
      width: 100,
      mono: true,
      cell: (r) => (
        <span className="tabular-nums text-ink-3">{r.ms != null ? formatMs(r.ms) : "—"}</span>
      ),
    },
    {
      id: "note",
      header: "Note",
      cell: (r) => {
        const errored = typeof r.result === "number" && r.result >= 400;
        return r.note ? (
          <span
            className={cn(
              "truncate font-mono text-sm",
              errored ? "text-err" : "text-ink-3",
            )}
          >
            {r.note}
          </span>
        ) : (
          <span className="text-ink-3">—</span>
        );
      },
    },
  ];

  return (
    <PageBody>
      <BackLink label="Schedules" onClick={() => navigate({ go: "tests", tab: "schedules" })} />

      <PageHead
        className="mt-4"
        title={schedule.name}
        actions={
          <>
            <GhostButton
              onClick={() =>
                pushToast({
                  kind: "info",
                  text: `Running "${schedule.name}" now`,
                  sub: schedule.scope,
                })
              }
            >
              <Play size={16} strokeWidth={1.5} />
              Run now
            </GhostButton>
            <GhostButton tone="danger" onClick={deleteSchedule}>
              <Trash2 size={16} strokeWidth={1.5} />
              Delete
            </GhostButton>
          </>
        }
      >
        <Switch
          checked={schedule.enabled}
          aria-label={`${schedule.name} enabled`}
          onCheckedChange={(v) => void saveSchedule({ ...schedule, enabled: v })}
          className="transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]"
        />
      </PageHead>

      <div className="mt-6 grid max-w-[1120px] grid-cols-1 gap-x-9 gap-y-5 md:grid-cols-2">
        <Field label="Target">
          <span className="truncate text-base text-ink">{schedule.scope}</span>
        </Field>
        <Field label="Cron" right={<span className="text-xs text-ink-3">{schedule.nextRunLabel}</span>}>
          <CronChip cron={schedule.cron} />
        </Field>
        <Field label="Notify">
          <span className="text-base text-ink">on failure</span>
        </Field>
        <Field label="Timeout">
          <span className="text-base text-ink">30 s</span>
        </Field>
      </div>

      <SectionLabel className="mt-8">Results · last {resultRows.length}</SectionLabel>
      <DataTable
        className="[&_th]:static"
        columns={resultColumns}
        rows={resultRows}
        rowKey={(r) => r.key}
        rowHeight={ROW_DATA}
      />
    </PageBody>
  );
}

/* ── New schedule ─────────────────────────────────────────────────────────── */

const CRON_PRESETS: Array<{ label: string; cron: string }> = [
  { label: "Every minute", cron: "* * * * *" },
  { label: "Every 5 min", cron: "*/5 * * * *" },
  { label: "15 min", cron: "*/15 * * * *" },
  { label: "30 min", cron: "*/30 * * * *" },
  { label: "Hourly", cron: "0 * * * *" },
  { label: "Every 6 h", cron: "0 */6 * * *" },
  { label: "Daily", cron: "0 0 * * *" },
];

/** New schedule — name, target, cron presets + free cron, create. */
export function NewScheduleForm() {
  const navigate = useStore((s) => s.navigate);
  const saveSchedule = useStore((s) => s.saveSchedule);
  const pushToast = useStore((s) => s.pushToast);
  const routes = useStore((s) => s.routes);
  const flows = useStore((s) => s.flows);

  const nameId = useId();
  const targetId = useId();
  const cronId = useId();
  const httpRouteCount = routes.filter((r) => r.protocol === "http").length;
  /* Scope is a free string on Schedule, so offer the targets that really
     exist: every route, or one of the discovered flows. */
  const scopes = useMemo(
    () => [`All routes (${httpRouteCount})`, ...flows.map((f) => `${f.name} flow`)],
    [httpRouteCount, flows],
  );

  const [name, setName] = useState("API health");
  const [cron, setCron] = useState("*/5 * * * *");
  const [scope, setScope] = useState(scopes[0]);

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      pushToast({ kind: "info", text: "Name the schedule first" });
      return;
    }
    void saveSchedule({
      id: `sch_${Date.now().toString(36)}`,
      name: trimmed,
      cron,
      scope,
      enabled: true,
      lastRun: null,
      nextRunLabel: nextRunShort(cron),
      results: [],
    });
    navigate({ go: "tests", tab: "schedules" });
    pushToast({ kind: "info", text: `Schedule "${trimmed}" created`, sub: nextRunShort(cron) });
  };

  return (
    <PageBody>
      <BackLink label="Schedules" onClick={() => navigate({ go: "tests", tab: "schedules" })} />

      <PageHead className="mt-4" title="New schedule" sub="cron runs your checks against a target" />

      <div className="mt-6 flex max-w-[640px] flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={nameId} className="text-xs font-normal text-ink-3">
            Name
          </Label>
          <Input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="API health"
            className="h-9 bg-ds-gray-100 text-base"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={targetId} className="text-xs font-normal text-ink-3">
            Target
          </Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger
              id={targetId}
              className="h-9 w-full border-line bg-ds-gray-100 text-base text-ink [&_svg]:stroke-[1.5] dark:bg-ds-gray-100 dark:hover:bg-ds-gray-200"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scopes.map((s) => (
                <SelectItem key={s} value={s} className="text-base">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <span className="caps-label">Cron</span>
          <ToggleGroup
            type="single"
            value={cron}
            onValueChange={(v) => {
              if (v) setCron(v);
            }}
            aria-label="Cron preset"
            className="flex-wrap"
          >
            {CRON_PRESETS.map((p) => (
              <ToggleGroupItem
                key={p.cron}
                value={p.cron}
                variant="outline"
                aria-label={p.label}
                className={cn(
                  "h-8 rounded-md border-line px-3 text-base font-normal whitespace-nowrap",
                  "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
                  "text-ink-2 hover:bg-ds-gray-alpha-100 hover:text-ink",
                  "data-[state=on]:border-line-strong data-[state=on]:bg-ds-gray-200 data-[state=on]:font-medium data-[state=on]:text-ink",
                )}
              >
                {p.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={cronId} className="text-xs font-normal text-ink-3">
            Expression
          </Label>
          <Input
            id={cronId}
            value={cron}
            onChange={(e) => setCron(e.target.value)}
            className="h-9 bg-ds-gray-100 font-mono text-sm tracking-[0.08em]"
          />
          <span className="text-xs text-ink-3">{nextRunsLabel(cron)}</span>
        </div>

        <div className="mt-2 flex items-center justify-end gap-2">
          <GhostButton onClick={() => navigate({ go: "tests", tab: "schedules" })}>
            Cancel
          </GhostButton>
          <AccentButton onClick={create}>Create schedule</AccentButton>
        </div>
      </div>
    </PageBody>
  );
}
