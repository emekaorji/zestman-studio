import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { OpenTab } from "@/state/slices/workbench";
import { useStore } from "@/state/store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TabStrip } from "@/components/tabstrip/TabStrip";
import { CodeEditor } from "@/lib/codemirror/CodeEditor";
import { cn } from "@/lib/utils";
import { SCRIPT_SNIPPETS } from "../lib";
import { NO_GUTTER } from "./BodyPanel";

type ScriptTab = "pre" | "post";

export function ScriptsPanel({ tab }: { tab: OpenTab }) {
  const patchDraft = useStore((s) => s.patchDraft);
  const [sub, setSub] = useState<ScriptTab>("post");

  const scripts = tab.draft.scripts;
  const value = sub === "post" ? scripts.postResponse : scripts.preRequest;
  const setValue = (v: string) =>
    patchDraft(tab.id, {
      scripts: sub === "post" ? { ...scripts, postResponse: v } : { ...scripts, preRequest: v },
    });

  const appendSnippet = (code: string) =>
    setValue(value.length > 0 ? `${value.replace(/\s+$/, "")}\n\n${code}` : code);

  return (
    <div className="flex flex-col gap-4">
      <TabStrip<ScriptTab>
        label="Script stage"
        tabs={[
          { id: "pre", label: "Pre-request" },
          { id: "post", label: "Post-response" },
        ]}
        active={sub}
        onSelect={setSub}
        variant="request"
      />

      <CodeEditor
        ariaLabel="Request script"
        key={sub}
        language="javascript"
        value={value}
        onChange={setValue}
        minHeight="240px"
        className={cn(NO_GUTTER, "animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]")}
        placeholder={sub === "pre" ? "// runs before the request is sent" : "// runs after the response arrives"}
      />

      <div className="flex flex-wrap items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className={cn(
                "h-9 gap-1.5 rounded-lg border-ds-gray-400 bg-transparent px-3 text-base font-medium text-ink-2",
                "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
                "hover:bg-hoverbg hover:text-ink dark:bg-transparent dark:hover:bg-hoverbg",
              )}
            >
              Snippets
              <ChevronDown
                size={16}
                strokeWidth={1.5}
                className="text-ink-3 transition-transform duration-[var(--dur-base)] ease-[var(--ease-in-out)] group-aria-expanded/button:rotate-180"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={6} className="w-72">
            {SCRIPT_SNIPPETS.map((s) => (
              <DropdownMenuItem key={s.label} onSelect={() => appendSnippet(s.code)} className="text-base">
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="font-mono text-xs text-ink-3">
          pm.environment · pm.test · pm.sendRequest available
        </span>
      </div>
    </div>
  );
}
