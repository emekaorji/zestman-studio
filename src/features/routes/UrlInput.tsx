import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CornerDownLeft } from "lucide-react";
import { useStore } from "@/state/store";
import { useActiveVariables } from "@/hooks/useActiveVariables";
import { DYNAMIC_VARS, tokenizeVariables } from "@/lib/variables";
import { VarChip } from "@/components/primitives";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { URL_ROW_H } from "@/lib/metrics";
import { cn } from "@/lib/utils";

const DYNAMIC_SHOWN = 5;

interface Completion {
  key: string;
  display: string; // "{{$guid}}" for dynamic, "baseUrl" for env
  value?: string;
  masked?: boolean;
  dynamic: boolean;
}

function maskValue(v: string): string {
  return `····${v.slice(-3)}`;
}

/**
 * URL field: chip-rendered {{vars}} when blurred, a real mono input when
 * focused, plus the environment/dynamic autocomplete.
 *
 * The field is a shadcn `Input` (focus ring, disabled handling) wired as a
 * combobox — `aria-expanded` / `aria-activedescendant` point at the listbox in
 * a shadcn `Popover`, so the popover is portalled, positioned and animated by
 * Radix and the keyboard contract is the standard one.
 */
export function UrlInput({
  value,
  onChange,
  onSubmit,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  className?: string;
}) {
  const urlFocusNonce = useStore((s) => s.urlFocusNonce);
  const environments = useStore((s) => s.environments);
  const { map: vars } = useActiveVariables();

  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [caret, setCaret] = useState(0);
  const [selIdx, setSelIdx] = useState(0);
  const listId = useId();

  const activeEnvName = environments.find((e) => e.isActive)?.name ?? "Local";
  const activeEnv = environments.find((e) => e.isActive);

  // ⌘L → focus
  useEffect(() => {
    if (urlFocusNonce > 0) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [urlFocusNonce]);

  /** Unclosed "{{prefix" immediately before the caret. */
  const varPrefix = useMemo(() => {
    if (!focused) return null;
    const before = value.slice(0, caret);
    const m = /\{\{([A-Za-z0-9_$]*)$/.exec(before);
    return m ? { text: m[1], start: m.index } : null;
  }, [focused, value, caret]);

  const completions = useMemo<Completion[]>(() => {
    if (varPrefix == null) return [];
    const q = varPrefix.text.toLowerCase();
    const env: Completion[] = (activeEnv?.variables ?? [])
      .filter((v) => v.enabled && v.key.toLowerCase().startsWith(q))
      .map((v) => ({
        key: v.key,
        display: v.key,
        value: v.type === "secret" ? maskValue(v.value) : v.value,
        masked: v.type === "secret",
        dynamic: false,
      }));
    const dyn: Completion[] = DYNAMIC_VARS.filter((d) => d.toLowerCase().startsWith(q) || q === "")
      .slice(0, DYNAMIC_SHOWN)
      .map((d) => ({ key: d, display: `{{${d}}}`, dynamic: true }));
    return [...env, ...dyn];
  }, [varPrefix, activeEnv]);

  useEffect(() => setSelIdx(0), [varPrefix?.text]);

  const insert = (c: Completion) => {
    if (varPrefix == null) return;
    const before = value.slice(0, varPrefix.start);
    const after = value.slice(caret);
    const inserted = `{{${c.key}}}`;
    const next = before + inserted + after;
    onChange(next);
    const pos = before.length + inserted.length;
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(pos, pos);
      setCaret(pos);
    });
  };

  const syncCaret = () => setCaret(inputRef.current?.selectionStart ?? 0);

  const tokens = tokenizeVariables(value, vars);
  const dynCount = DYNAMIC_VARS.length - DYNAMIC_SHOWN;
  const envCompletions = completions.filter((c) => !c.dynamic);
  const dynCompletions = completions.filter((c) => c.dynamic);
  const open = focused && completions.length > 0 && varPrefix != null;

  const optionRow = (c: Completion) => {
    const idx = completions.indexOf(c);
    const selected = idx === selIdx;
    return (
      <button
        key={c.key}
        type="button"
        id={`${listId}-opt-${idx}`}
        role="option"
        aria-selected={selected}
        onMouseEnter={() => setSelIdx(idx)}
        onMouseDown={(e) => {
          e.preventDefault();
          insert(c);
        }}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-3 rounded-md px-2 text-left",
          "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
          selected ? "bg-ds-gray-200" : "hover:bg-ds-gray-100",
        )}
      >
        <span className={cn("truncate font-mono text-sm", c.dynamic ? "text-ink-2" : "text-ink")}>
          {c.display}
        </span>
        {c.value ? (
          <span className="shrink-0 truncate font-mono text-xs text-ink-3">{c.value}</span>
        ) : null}
      </button>
    );
  };

  return (
    <Popover open={open}>
      <PopoverAnchor asChild>
        <div
          className={cn("relative flex min-w-0 flex-1 items-center", className)}
          style={{ height: URL_ROW_H }}
        >
          <Input
            ref={inputRef}
            value={value}
            spellCheck={false}
            autoComplete="off"
            aria-label="Request URL"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls={open ? listId : undefined}
            aria-activedescendant={open ? `${listId}-opt-${selIdx}` : undefined}
            onChange={(e) => {
              onChange(e.target.value);
              setCaret(e.target.selectionStart ?? 0);
            }}
            onFocus={() => {
              setFocused(true);
              syncCaret();
            }}
            onBlur={() => setFocused(false)}
            onSelect={syncCaret}
            onKeyUp={syncCaret}
            onClick={syncCaret}
            onKeyDown={(e) => {
              if (open) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelIdx((i) => Math.min(i + 1, completions.length - 1));
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelIdx((i) => Math.max(i - 1, 0));
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  insert(completions[selIdx]);
                  return;
                }
                if (e.key === "Escape") {
                  e.stopPropagation();
                  inputRef.current?.blur();
                  return;
                }
              }
              if (e.key === "Enter") onSubmit?.();
            }}
            className={cn(
              "h-full w-full rounded-lg border-line bg-ds-gray-100 px-3 font-mono text-sm text-ink",
              "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
              "dark:bg-ds-gray-100",
              !focused && "text-transparent caret-transparent",
            )}
          />
          {/* chip-rendered view while blurred */}
          {!focused ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-3 left-3 flex items-center gap-1 overflow-hidden whitespace-pre"
            >
              {tokens.map((t, i) =>
                t.type === "var" ? (
                  <VarChip key={i} name={t.key ?? ""} unresolved={!t.resolved} />
                ) : (
                  <span key={i} className="font-mono text-sm text-ink">
                    {t.value}
                  </span>
                ),
              )}
            </div>
          ) : null}
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="start"
        sideOffset={6}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-90 max-w-[calc(100vw-2rem)] overflow-hidden p-0"
      >
        {/* A listbox may only own `option` and `group`, so each heading becomes a
            real group label rather than a loose div, and the "N more" counter
            sits outside the listbox entirely. */}
        <div id={listId} role="listbox" aria-label="Variable suggestions" className="flex flex-col p-1">
          {envCompletions.length > 0 ? (
            <div role="group" aria-labelledby={`${listId}-env`}>
              <div id={`${listId}-env`} className="flex h-7 items-end px-2 pb-1">
                <span className="caps-label">Environment · {activeEnvName}</span>
              </div>
              {envCompletions.map(optionRow)}
            </div>
          ) : null}
          {dynCompletions.length > 0 ? (
            <div role="group" aria-labelledby={`${listId}-dyn`}>
              <div id={`${listId}-dyn`} className="flex h-7 items-end px-2 pb-1">
                <span className="caps-label">Dynamic</span>
              </div>
              {dynCompletions.map(optionRow)}
            </div>
          ) : null}
        </div>
        {dynCompletions.length > 0 && dynCount > 0 ? (
          <div className="flex h-6 items-center px-3 font-mono text-xs text-ink-3">… {dynCount} more</div>
        ) : null}
        <div className="flex h-8 items-center gap-1.5 border-t border-line px-3">
          <CornerDownLeft size={14} strokeWidth={1.5} className="text-ink-3" />
          <span className="text-xs text-ink-3">insert</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
