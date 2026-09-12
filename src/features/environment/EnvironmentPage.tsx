import { Copy, Eye, EyeOff, Lock, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useStore } from "@/state/store";
import type { Environment, EnvVar } from "@/daemon/types";
import { AccentButton, GhostButton, Pill } from "@/components/primitives";
import { DataTable, type ColumnDef } from "@/components/table/DataTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CodeEditor } from "@/lib/codemirror/CodeEditor";
import { id } from "@/lib/ids";
import { cn } from "@/lib/utils";

/** Row affordances that fade in on hover (DataTable reveals `.opacity-0`). */
const REVEAL = "opacity-0 focus-visible:opacity-100";

/** Inline table input: no chrome until you point at it, then Geist's input. */
const CELL_INPUT = cn(
  "h-8 rounded-md border-transparent bg-transparent px-1.5 font-mono text-sm text-ink shadow-none",
  "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
  "hover:border-line-strong hover:bg-ds-gray-100 focus-visible:bg-ds-gray-100 dark:bg-transparent dark:hover:bg-ds-gray-100",
);

/* ── page frame ───────────────────────────────────────────────────────────── */

function PageFrame({
  title,
  meta,
  actions,
  children,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-3 px-7 mt-5">
        <h1 className="shrink-0 text-md font-semibold text-ink">{title}</h1>
        {meta ? <span className="min-w-0 truncate text-base text-ink-3">{meta}</span> : null}
        {actions ? <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="fade-scroll min-h-0 flex-1 overflow-y-auto px-7 pt-4 pb-16">{children}</div>
    </div>
  );
}

function SectionHead({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mt-7 mb-1 flex h-8 items-baseline gap-3 first:mt-0">
      <span className="caps-label">{children}</span>
      {sub ? <span className="text-xs text-ink-3">{sub}</span> : null}
    </div>
  );
}

/* ── editable variables table ─────────────────────────────────────────────── */

function VarsTable({
  vars,
  onChange,
  withAddRow = false,
  label,
}: {
  vars: EnvVar[];
  onChange: (vars: EnvVar[]) => void;
  withAddRow?: boolean;
  label: string;
}) {
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const [draft, setDraft] = useState({ key: "", value: "" });

  const patch = (vid: string, p: Partial<EnvVar>) => onChange(vars.map((v) => (v.id === vid ? { ...v, ...p } : v)));
  const remove = (vid: string) => onChange(vars.filter((v) => v.id !== vid));
  const toggleReveal = (vid: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(vid)) next.delete(vid);
      else next.add(vid);
      return next;
    });

  const commitDraft = () => {
    if (!draft.key.trim()) return;
    onChange([...vars, { id: id("ev"), key: draft.key.trim(), value: draft.value, type: "default", enabled: true }]);
    setDraft({ key: "", value: "" });
  };

  const columns: Array<ColumnDef<EnvVar>> = [
    {
      id: "name",
      header: "Name",
      width: 240,
      cell: (v) => (
        <Input
          value={v.key}
          onChange={(e) => patch(v.id, { key: e.target.value })}
          aria-label={`Name of ${v.key}`}
          className={CELL_INPUT}
        />
      ),
    },
    {
      id: "type",
      header: "Type",
      width: 110,
      cell: (v) =>
        v.type === "secret" ? <Pill tone="warn">secret</Pill> : <span className="text-base text-ink-3">default</span>,
    },
    {
      id: "value",
      header: "Value",
      cell: (v) => {
        const secret = v.type === "secret";
        const hidden = secret && !revealed.has(v.id);
        return (
          <Input
            type={hidden ? "password" : "text"}
            value={v.value}
            onChange={(e) => patch(v.id, { value: e.target.value })}
            aria-label={`Value of ${v.key}`}
            className={CELL_INPUT}
          />
        );
      },
    },
    {
      id: "actions",
      header: "",
      width: 84,
      align: "right",
      cell: (v) => (
        <span className="flex items-center justify-end gap-0.5">
          {v.type === "secret" ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={revealed.has(v.id) ? `Hide value of ${v.key}` : `Reveal value of ${v.key}`}
              aria-pressed={revealed.has(v.id)}
              onClick={() => toggleReveal(v.id)}
              className="text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink"
            >
              {revealed.has(v.id) ? (
                <EyeOff size={16} strokeWidth={1.5} />
              ) : (
                <Eye size={16} strokeWidth={1.5} />
              )}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${v.key}`}
            onClick={() => remove(v.id)}
            className={cn(
              "text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-err",
              REVEAL,
            )}
          >
            <Trash2 size={16} strokeWidth={1.5} />
          </Button>
        </span>
      ),
    },
  ];

  return (
    <DataTable
      label={label}
      columns={columns}
      rows={vars}
      rowKey={(v) => v.id}
      rowHeight={36}
      trailing={
        withAddRow ? (
          <div className="flex h-9 items-center">
            <Input
              value={draft.key}
              onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && commitDraft()}
              placeholder="Name"
              aria-label="New variable name"
              className={cn(CELL_INPUT, "w-[226px] shrink-0")}
            />
            <span aria-hidden className="w-[122px] shrink-0" />
            <Input
              value={draft.value}
              onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && commitDraft()}
              onBlur={commitDraft}
              placeholder="Value"
              aria-label="New variable value"
              className={cn(CELL_INPUT, "min-w-0 flex-1")}
            />
          </div>
        ) : null
      }
    />
  );
}

/* ── bulk editor ──────────────────────────────────────────────────────────── */

function BulkEditor({ env }: { env: Environment }) {
  const navigate = useStore((s) => s.navigate);
  const environments = useStore((s) => s.environments);
  const saveEnvironments = useStore((s) => s.saveEnvironments);
  const pushToast = useStore((s) => s.pushToast);
  const [text, setText] = useState(() =>
    env.variables.map((v) => `${v.enabled ? "" : "# "}${v.key}=${v.value}`).join("\n"),
  );

  const apply = () => {
    const parsed: EnvVar[] = [];
    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      const enabled = !line.startsWith("#");
      const body = enabled ? line : line.replace(/^#+\s*/, "");
      const eq = body.indexOf("=");
      if (eq <= 0) continue;
      const key = body.slice(0, eq).trim();
      const value = body.slice(eq + 1).trim();
      const existing = env.variables.find((v) => v.key === key);
      parsed.push({
        id: existing?.id ?? id("ev"),
        key,
        value,
        type: existing?.type ?? "default",
        enabled,
      });
    }
    void saveEnvironments(environments.map((e) => (e.id === env.id ? { ...e, variables: parsed } : e)));
    navigate({ go: "environment", view: "environment", envId: env.id, bulk: false });
    pushToast({ kind: "info", text: `${env.name} updated`, sub: `${parsed.length} variables` });
  };

  return (
    <div className="max-w-[880px] animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]">
      <p className="text-base text-ink-3">one variable per line — key=value · prefix # to disable</p>
      <div className="mt-3 overflow-hidden rounded-lg border border-line">
        <CodeEditor
          value={text}
          onChange={setText}
          language="text"
          minHeight="180px"
          highlightVariables={false}
          ariaLabel="Environment variables, bulk edit"
        />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <GhostButton
          onClick={() => navigate({ go: "environment", view: "environment", envId: env.id, bulk: false })}
        >
          Cancel
        </GhostButton>
        <AccentButton onClick={apply}>Apply</AccentButton>
      </div>
    </div>
  );
}

/* ── environment view ─────────────────────────────────────────────────────── */

function EnvironmentView() {
  const navigate = useStore((s) => s.navigate);
  const environments = useStore((s) => s.environments);
  const globals = useStore((s) => s.globals);
  const saveEnvironments = useStore((s) => s.saveEnvironments);
  const saveGlobals = useStore((s) => s.saveGlobals);
  const envId = useStore((s) => s.sections.environment.envId);
  const bulk = useStore((s) => s.sections.environment.bulk);

  const env = environments.find((e) => e.id === envId) ?? environments.find((e) => e.isActive) ?? environments[0];
  if (!env) return null;

  const setVars = (vars: EnvVar[]) =>
    void saveEnvironments(environments.map((e) => (e.id === env.id ? { ...e, variables: vars } : e)));

  const newEnvironment = () => {
    const created: Environment = { id: id("env"), name: "New environment", variables: [], isActive: false };
    void saveEnvironments([...environments, created]);
    navigate({ go: "environment", view: "environment", envId: created.id });
  };

  return (
    <PageFrame
      title={env.name}
      meta={env.isActive ? <Pill tone="ok">active</Pill> : undefined}
      actions={
        bulk ? null : (
          <>
            <GhostButton
              onClick={() => navigate({ go: "environment", view: "environment", envId: env.id, bulk: true })}
            >
              Bulk edit
            </GhostButton>
            <GhostButton onClick={newEnvironment}>
              <Plus size={16} strokeWidth={1.5} />
              New environment
            </GhostButton>
          </>
        )
      }
    >
      {bulk ? (
        <BulkEditor key={env.id} env={env} />
      ) : (
        <>
          <SectionHead sub={`${env.variables.length} defined`}>Variables</SectionHead>
          <VarsTable label={`${env.name} variables`} vars={env.variables} onChange={setVars} withAddRow />

          <SectionHead sub="inherited by every environment">Globals</SectionHead>
          <VarsTable label="Global variables" vars={globals} onChange={(vars) => void saveGlobals(vars)} />
        </>
      )}
    </PageFrame>
  );
}

/* ── globals view ─────────────────────────────────────────────────────────── */

function GlobalsView() {
  const globals = useStore((s) => s.globals);
  const saveGlobals = useStore((s) => s.saveGlobals);
  return (
    <PageFrame title="Globals" meta="available in every environment">
      <SectionHead sub={`${globals.length} defined`}>Variables</SectionHead>
      <VarsTable
        label="Global variables"
        vars={globals}
        onChange={(vars) => void saveGlobals(vars)}
        withAddRow
      />
    </PageFrame>
  );
}

/* ── vault view ───────────────────────────────────────────────────────────── */

function VaultView() {
  const navigate = useStore((s) => s.navigate);
  const vaultRefs = useStore((s) => s.vaultRefs);
  const [prompting, setPrompting] = useState<ReadonlySet<string>>(new Set());

  const requestReveal = (vid: string) => setPrompting((prev) => new Set(prev).add(vid));

  const addSecret = () => {
    const name = `SECRET_${vaultRefs.length + 1}`;
    useStore.setState((s) => ({
      vaultRefs: [
        ...s.vaultRefs,
        { id: id("vr"), name, reference: `{{secret:${name}}}`, revealState: "locked" as const },
      ],
    }));
  };

  const columns: Array<ColumnDef<(typeof vaultRefs)[number]>> = [
    {
      id: "name",
      header: "Name",
      width: 240,
      cell: (r) => <span className="truncate font-mono text-sm text-ink">{r.name}</span>,
    },
    {
      id: "ref",
      header: "Reference",
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-2">
          <Lock size={14} strokeWidth={1.5} className="shrink-0 text-ink-3" />
          <span className="truncate font-mono text-sm text-link-z">{r.reference}</span>
        </span>
      ),
    },
    {
      id: "reveal",
      header: "",
      width: 160,
      align: "right",
      cell: (r) =>
        r.revealState === "prompt" || prompting.has(r.id) ? (
          <Pill tone="neutral">Touch ID to reveal</Pill>
        ) : (
          <GhostButton size="sm" aria-label={`Reveal ${r.name}`} onClick={() => requestReveal(r.id)}>
            <Eye size={16} strokeWidth={1.5} />
            Reveal
          </GhostButton>
        ),
    },
  ];

  return (
    <PageFrame title="Vault" meta="OS keychain — files hold references only">
      <SectionHead sub="values live in the OS keychain">Secrets</SectionHead>
      <DataTable
        label="Vault secrets"
        columns={columns}
        rows={vaultRefs}
        rowKey={(r) => r.id}
        rowHeight={36}
        trailing={
          <Button
            variant="ghost"
            onClick={addSecret}
            className="h-9 w-full justify-start gap-1.5 px-1.5 text-base font-normal text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:bg-ds-gray-alpha-100 hover:text-ink"
          >
            <Plus size={16} strokeWidth={1.5} />
            Add secret
          </Button>
        }
      />

      <SectionHead>Redaction</SectionHead>
      <Alert className="border-transparent bg-sunken">
        <ShieldCheck size={16} strokeWidth={1.5} className="text-ok" />
        <AlertDescription className="flex w-full items-center gap-3 text-base text-ink-2">
          <span className="min-w-0 flex-1">2 recorded responses contained STRIPE_KEY — redacted automatically</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ go: "history", mode: "recorded" })}
            className="shrink-0 text-base font-normal text-link-z hover:text-link-z"
          >
            View audit
          </Button>
        </AlertDescription>
      </Alert>
    </PageFrame>
  );
}

/* ── dynamic variables view ───────────────────────────────────────────────── */

function DynamicView() {
  const dynamicVars = useStore((s) => s.dynamicVars);
  const pushToast = useStore((s) => s.pushToast);

  const copy = (name: string) => {
    void navigator.clipboard?.writeText(`{{${name}}}`);
    pushToast({ kind: "info", text: `Copied {{${name}}}` });
  };

  const columns: Array<ColumnDef<(typeof dynamicVars)[number]>> = [
    {
      id: "var",
      header: "Variable",
      width: 280,
      cell: (v) => <span className="truncate font-mono text-sm text-link-z">{`{{${v.name}}}`}</span>,
    },
    {
      id: "sample",
      header: "Sample output",
      cell: (v) => (
        <span className="flex min-w-0 items-center gap-2">
          {v.swatch ? (
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-sm border border-line"
              style={{ backgroundColor: v.swatch }}
            />
          ) : null}
          <span className="truncate font-mono text-sm text-ink-3">{v.sample}</span>
        </span>
      ),
    },
    {
      id: "copy",
      header: "",
      width: 44,
      align: "right",
      cell: (v) => (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Copy {{${v.name}}}`}
          onClick={() => copy(v.name)}
          className={cn(
            "text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink",
            REVEAL,
          )}
        >
          <Copy size={16} strokeWidth={1.5} />
        </Button>
      ),
    },
  ];

  return (
    <PageFrame title="Dynamic variables" meta="generated fresh on every send">
      <p className="mb-4 max-w-[620px] text-base text-ink-2">
        Use these anywhere variables work — in URLs, headers, bodies and scripts. Each one resolves at send time,
        so no two requests share a value.
      </p>
      <DataTable
        label="Dynamic variables"
        columns={columns}
        rows={dynamicVars}
        rowKey={(v) => v.name}
        rowHeight={32}
      />
    </PageFrame>
  );
}

/* ── page switch ──────────────────────────────────────────────────────────── */

export function EnvironmentPage() {
  const view = useStore((s) => s.sections.environment.view);
  if (view === "globals") return <GlobalsView />;
  if (view === "vault") return <VaultView />;
  if (view === "dynamic") return <DynamicView />;
  return <EnvironmentView />;
}
