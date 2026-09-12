import { StateEffect, StateField, type Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  hoverTooltip,
} from "@codemirror/view";

import { VAR_PATTERN, isDynamicVar } from "@/lib/variables";

/** Dispatch this effect to update the resolvable variable map for the editor. */
export const setEditorVars = StateEffect.define<Map<string, string>>();

export const editorVarsField = StateField.define<Map<string, string>>({
  create: () => new Map(),
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setEditorVars)) return e.value;
    }
    return value;
  },
});

const resolvedMark = Decoration.mark({ class: "cm-var-resolved" });
const unresolvedMark = Decoration.mark({ class: "cm-var-unresolved" });

function buildDecorations(view: EditorView): DecorationSet {
  const vars = view.state.field(editorVarsField, false) ?? new Map<string, string>();
  const ranges: ReturnType<typeof resolvedMark.range>[] = [];
  const re = new RegExp(VAR_PATTERN, "g");
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = from + m.index;
      const end = start + m[0].length;
      const key = m[1].trim();
      const ok = vars.has(key) || isDynamicVar(key);
      ranges.push((ok ? resolvedMark : unresolvedMark).range(start, end));
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return Decoration.set(ranges, true);
}

const variableDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(u: ViewUpdate) {
      const varsChanged = u.transactions.some((tr) =>
        tr.effects.some((e) => e.is(setEditorVars))
      );
      if (u.docChanged || u.viewportChanged || varsChanged) {
        this.decorations = buildDecorations(u.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

const variableTooltip = hoverTooltip((view, pos) => {
  const vars = view.state.field(editorVarsField, false) ?? new Map<string, string>();
  const line = view.state.doc.lineAt(pos);
  const re = new RegExp(VAR_PATTERN, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(line.text)) !== null) {
    const start = line.from + m.index;
    const end = start + m[0].length;
    if (pos >= start && pos <= end) {
      const key = m[1].trim();
      const resolved = vars.has(key) ? vars.get(key) ?? "" : null;
      const dynamic = isDynamicVar(key);
      return {
        pos: start,
        end,
        above: true,
        create() {
          const dom = document.createElement("div");
          dom.className = "cm-var-tooltip";
          dom.textContent =
            resolved !== null
              ? `${key} = ${resolved}`
              : dynamic
                ? `${key} — generated at send time`
                : `${key} — unresolved`;
          return { dom };
        },
      };
    }
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return null;
});

export const variableExtension: Extension = [
  editorVarsField,
  variableDecorations,
  variableTooltip,
];
