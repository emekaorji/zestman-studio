import { useMemo } from "react";
import type { Route } from "@/daemon/types";
import { CodeEditor } from "@/lib/codemirror/CodeEditor";
import { resolveText } from "@/lib/variables";
import { cn } from "@/lib/utils";
import { draftFromRoute } from "@/state/slices/workbench";
import { useStore } from "@/state/store";
import { buildSnippet, snippetRequest, type Snippet } from "./snippets";

/**
 * The snippet for a route in `lang`, built from the open tab's draft when the
 * route is open (unsaved edits included) and from the saved route otherwise.
 * With `resolve`, `{{variables}}` take their values from globals and the active
 * environment — except secrets, which stay as `{{name}}` so a copied snippet
 * or a shared screen never carries one.
 */
export function useSnippet(route: Route | undefined, lang: string, resolve: boolean): Snippet | null {
  const openTabs = useStore((s) => s.openTabs);
  const environments = useStore((s) => s.environments);
  const globals = useStore((s) => s.globals);

  return useMemo(() => {
    if (!route) return null;
    const draft = openTabs.find((t) => t.routeId === route.id)?.draft ?? draftFromRoute(route);
    const vars = new Map<string, string>();
    const active = environments.find((e) => e.isActive);
    for (const v of [...globals, ...(active?.variables ?? [])]) {
      if (v.enabled && v.key && v.type !== "secret") vars.set(v.key, v.value);
      else if (v.key && v.type === "secret") vars.delete(v.key);
    }
    const res = resolve ? (s: string) => resolveText(s, vars).resolved : (s: string) => s;
    return buildSnippet(lang, snippetRequest(draft, route.protocol === "websocket", res));
  }, [route, lang, resolve, openTabs, environments, globals]);
}

/** A read-only, syntax-highlighted code sample: click in, select, ⌘A, copy. */
export function SnippetBlock({ snippet, label, className }: { snippet: Snippet; label: string; className?: string }) {
  return (
    <CodeEditor
      ariaLabel={label}
      value={snippet.code}
      language={snippet.language}
      readOnly
      showLineNumbers={false}
      wrap={false}
      minHeight="0"
      className={cn(
        "border-line bg-sunken [&_.cm-content]:py-2.5 [&_.cm-line]:px-2.5 [&_.cm-lint-marker]:hidden",
        className,
      )}
    />
  );
}
