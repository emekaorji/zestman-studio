import {
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";

import { editorVarsField } from "./variables";
import { DYNAMIC_VARS } from "@/lib/variables";

/**
 * Autocomplete environment/global variables (and dynamic {{$...}} variables)
 * after typing `{{`. Reads the resolvable map from the editor's varsField so it
 * always reflects the active environment.
 */
function varCompletionSource(ctx: CompletionContext): CompletionResult | null {
  const before = ctx.matchBefore(/\{\{[^}]*/);
  if (!before) return null;

  const vars = ctx.state.field(editorVarsField, false) ?? new Map<string, string>();

  const partial = before.text.slice(2).trim().toLowerCase();
  const options = [
    ...Array.from(vars.entries()).map(([key, value]) => ({
      label: key,
      detail: value.length > 40 ? `${value.slice(0, 40)}…` : value,
      type: "variable",
      apply: `${key}}}`,
    })),
    ...DYNAMIC_VARS.map((key) => ({
      label: key,
      detail: "dynamic",
      type: "constant",
      apply: `${key}}}`,
    })),
  ].filter((o) => o.label.toLowerCase().includes(partial));

  if (options.length === 0) return null;
  return { from: before.from + 2, options, validFor: /^[^}]*$/ };
}

/** Register the variable completion source for any language. */
export const varCompletionExtension = EditorState.languageData.of(() => [
  { autocomplete: varCompletionSource },
]);
