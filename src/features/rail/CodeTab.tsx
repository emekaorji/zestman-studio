import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore } from "@/state/store";
import { CapsHeader, MiniSwitch } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { snippetLanguages, snippetVariant } from "./snippets";
import { SnippetBlock, useSnippet } from "./SnippetBlock";

/**
 * The language picker is a real listbox: shadcn's `Command` (cmdk) gives the
 * combobox/listbox roles, aria-selected, type-ahead and ↑/↓ roving focus. The
 * highlighted option IS the selection, so arrowing through it repaints the
 * snippet live.
 */
function LanguagePicker({
  languages,
  isWs,
  value,
  onChange,
}: {
  languages: string[];
  isWs: boolean;
  value: string;
  onChange: (name: string) => void;
}) {
  return (
    <Command
      label="Snippet language"
      value={value}
      onValueChange={(v) => {
        const match = languages.find((l) => l.toLowerCase() === v.toLowerCase());
        if (match) onChange(match);
      }}
      className={cn(
        "gap-2 rounded-none! bg-transparent p-0",
        "[&_[data-slot=command-input-wrapper]]:p-0",
        "[&_[data-slot=input-group]]:h-8! [&_[data-slot=input-group]]:border-line",
        "[&_[data-slot=input-group]]:bg-sunken [&_[data-slot=input-group]]:px-1",
        "[&_[data-slot=input-group-addon]]:text-ink-3",
        "[&_[data-slot=input-group-addon]_svg]:opacity-100 [&_[data-slot=input-group-addon]_svg]:[stroke-width:1.5]",
      )}
    >
      <CommandInput placeholder="Search languages…" className="text-base text-ink placeholder:text-ink-3" />
      <CommandList className="fade-scroll hide-scrollbar max-h-56 p-0">
        <CommandEmpty className="flex h-12 items-center justify-center py-0 text-base text-ink-3">
          No languages
        </CommandEmpty>
        {languages.map((name) => (
          <CommandItem
            key={name}
            value={name}
            onSelect={() => onChange(name)}
            className={cn(
              "h-8 gap-2 rounded-md px-2 text-base",
              "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
              "data-selected:bg-ds-gray-200 data-selected:font-medium data-selected:text-ink",
              name === value ? "text-ink" : "text-ink-2",
            )}
          >
            {name}
            <CommandShortcut className="font-mono text-xs tracking-normal text-ink-3 group-data-selected/command-item:text-ink-2">
              {snippetVariant(name, isWs)}
            </CommandShortcut>
          </CommandItem>
        ))}
      </CommandList>
    </Command>
  );
}

/** Rail · Code — language browser + snippet for the open route. */
export function CodeTab() {
  const railCodeLang = useStore((s) => s.railCodeLang);
  const setRailCodeLang = useStore((s) => s.setRailCodeLang);
  const resolveVars = useStore((s) => s.railResolveVars);
  const setResolveVars = useStore((s) => s.setRailResolveVars);
  const routes = useStore((s) => s.routes);
  const openTabs = useStore((s) => s.openTabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const pushToast = useStore((s) => s.pushToast);
  const [copied, setCopied] = useState(false);

  const tab = openTabs.find((t) => t.id === activeTabId);
  const route = routes.find((r) => r.id === tab?.routeId) ?? routes.find((r) => r.protocol === "http");
  const isWs = route?.protocol === "websocket";

  const languages = useMemo(() => snippetLanguages(isWs), [isWs]);
  /* A websocket route offers fewer languages; fall back rather than showing a
     header for a language this route has no snippet for. */
  const selected = languages.includes(railCodeLang) ? railCodeLang : languages[0];

  const snippet = useSnippet(route, selected, resolveVars);
  const variant = snippetVariant(selected, isWs);

  const copy = () => {
    if (!snippet) return;
    void navigator.clipboard?.writeText(snippet.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
    pushToast({ kind: "info", text: `Copied ${selected} snippet` });
  };

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div>
        <CapsHeader
          right={
            <span className="text-xs text-ink-3">
              {languages.length} {isWs ? "with a ws client" : "runnable"}
            </span>
          }
        >
          Languages
        </CapsHeader>
        <LanguagePicker languages={languages} isWs={isWs} value={selected} onChange={setRailCodeLang} />
      </div>

      <div className="flex h-8 items-center justify-between border-t border-line pt-2">
        <span className="text-base text-ink-2">Resolve variables</span>
        <MiniSwitch on={resolveVars} onChange={setResolveVars} label="Resolve variables" />
      </div>

      <div>
        <CapsHeader
          right={
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={copy}
              aria-label={`Copy ${selected} snippet`}
              className="text-ink-2 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink"
            >
              {copied ? (
                <Check size={14} strokeWidth={1.5} className="text-ok animate-in fade-in-0 zoom-in-95" />
              ) : (
                <Copy size={14} strokeWidth={1.5} />
              )}
            </Button>
          }
        >
          {selected}
          {variant ? ` · ${variant}` : ""}
        </CapsHeader>
        {snippet ? (
          <SnippetBlock
            key={selected}
            snippet={snippet}
            label={`${selected} snippet`}
            className="animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]"
          />
        ) : null}
      </div>
    </div>
  );
}
