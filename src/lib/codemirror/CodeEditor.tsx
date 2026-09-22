import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { html as htmlLang } from "@codemirror/lang-html";
import { javascript as jsLang } from "@codemirror/lang-javascript";
import { json as jsonLang, jsonParseLinter } from "@codemirror/lang-json";
import { xml as xmlLang } from "@codemirror/lang-xml";
import { StreamLanguage, bracketMatching, indentOnInput } from "@codemirror/language";
import { lintKeymap, linter, lintGutter } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  drawSelection,
  keymap,
  lineNumbers,
  placeholder as cmPlaceholder,
} from "@codemirror/view";
import { useEffect, useRef } from "react";

import { useActiveVariables } from "@/hooks/useActiveVariables";
import { zestmanCmTheme } from "@/lib/codemirror/theme";
import { setEditorVars, variableExtension } from "@/lib/codemirror/variables";
import { varCompletionExtension } from "@/lib/codemirror/varCompletion";
import { cn } from "@/lib/utils";

export type EditorLanguage =
  | "javascript"
  | "typescript"
  | "json"
  | "text"
  | "xml"
  | "html"
  | "graphql"
  | "shell"
  | "python"
  | "go"
  | "ruby"
  | "php"
  | "java"
  | "csharp"
  | "rust";

/**
 * Languages only code snippets use, loaded on first sight so the request
 * editors do not carry every grammar in the main bundle.
 */
const LAZY_LANGUAGES: Partial<Record<EditorLanguage, () => Promise<Extension>>> = {
  python: async () => (await import("@codemirror/lang-python")).python(),
  go: async () => (await import("@codemirror/lang-go")).go(),
  php: async () => (await import("@codemirror/lang-php")).php({ plain: true }),
  java: async () => (await import("@codemirror/lang-java")).java(),
  rust: async () => (await import("@codemirror/lang-rust")).rust(),
  shell: async () => StreamLanguage.define((await import("@codemirror/legacy-modes/mode/shell")).shell),
  ruby: async () => StreamLanguage.define((await import("@codemirror/legacy-modes/mode/ruby")).ruby),
  csharp: async () => StreamLanguage.define((await import("@codemirror/legacy-modes/mode/clike")).csharp),
};

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  language?: EditorLanguage;
  className?: string;
  readOnly?: boolean;
  minHeight?: string;
  /** Highlight + autocomplete {{variables}}. Disable for response bodies. */
  highlightVariables?: boolean;
  /**
   * Accessible name for the editor. CodeMirror's content node is a
   * role="textbox", which takes its name ONLY from aria-label — its text is not
   * a naming source — so without this a screen reader announces "edit, blank".
   */
  ariaLabel: string;
  /** Classes for CodeMirror's own scroller, for editors that scroll inside a fixed box. */
  scrollerClassName?: string;
  /** Line-number gutter. Off for short snippets. */
  showLineNumbers?: boolean;
  /** Soft-wrap long lines. Off for code samples, which scroll sideways like any code block. */
  wrap?: boolean;
}

const activeLineDeco = Decoration.line({ class: "cm-activeLine" });

/**
 * The current-line band, only while the editor has focus and nothing is
 * selected. CodeMirror's own `highlightActiveLine` also marks the line the
 * selection ends on; that band sits on top of the selection layer, so one line
 * of a selection read as a different colour from the rest. It also banded
 * line 1 of every idle editor on the page.
 */
const activeLineWhileTyping = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet || u.viewportChanged || u.focusChanged) this.decorations = this.build(u.view);
    }
    build(view: EditorView): DecorationSet {
      const { ranges } = view.state.selection;
      if (!view.hasFocus || ranges.some((r) => !r.empty)) return Decoration.none;
      const starts = [...new Set(ranges.map((r) => view.lineBlockAt(r.head).from))].sort((a, b) => a - b);
      return Decoration.set(starts.map((from) => activeLineDeco.range(from)));
    }
  },
  { decorations: (p) => p.decorations },
);

/**
 * Read-only keeps the editor focusable: the text can be clicked into, selected,
 * searched and ⌘A'd within the editor (not the whole page), but never changed.
 * `EditorView.editable(false)` would make the content inert, which is what
 * sent ⌘A to the page. `inputmode=none` keeps phones from raising a keyboard.
 */
function readOnlyExtension(readOnly: boolean): Extension {
  return readOnly
    ? [
        EditorState.readOnly.of(true),
        EditorView.contentAttributes.of({ "aria-readonly": "true", inputmode: "none" }),
      ]
    : [];
}

/**
 * CodeMirror only listens on its text. A click in the empty space below the
 * last line (the rest of the box) lands outside it and did nothing; here it
 * focuses the editor and puts the cursor where a code editor would: the
 * nearest position to the click, i.e. on the last line.
 */
function clickIntoEditor(view: EditorView | null, e: React.MouseEvent<HTMLDivElement>) {
  if (!view || e.button !== 0 || e.defaultPrevented) return;
  const target = e.target as HTMLElement;
  if (view.contentDOM.contains(target) || target.closest(".cm-gutters, .cm-tooltip, .cm-panels")) return;
  e.preventDefault();
  const pos = view.posAtCoords({ x: e.clientX, y: e.clientY }, false);
  view.focus();
  view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
}

function languageExtension(language: EditorLanguage): Extension {
  switch (language) {
    case "json":
      return [jsonLang(), linter(jsonParseLinter()), lintGutter()];
    case "javascript":
    case "graphql":
      return jsLang();
    case "typescript":
      return jsLang({ typescript: true });
    case "xml":
      return xmlLang();
    case "html":
      return htmlLang();
    default:
      return [];
  }
}

export function CodeEditor({
  value,
  onChange,
  placeholder = "",
  language = "text",
  className,
  readOnly = false,
  minHeight = "200px",
  highlightVariables = true,
  ariaLabel,
  scrollerClassName,
  showLineNumbers = true,
  wrap = true,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const langCompartment = useRef(new Compartment());
  const editableCompartment = useRef(new Compartment());

  const ariaLabelRef = useRef(ariaLabel);
  ariaLabelRef.current = ariaLabel;

  const { map: varsMap } = useActiveVariables();
  const varsRef = useRef(varsMap);
  varsRef.current = varsMap;

  // Create the editor view once.
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value ?? "",
      extensions: [
        ...(showLineNumbers ? [lineNumbers()] : []),
        activeLineWhileTyping,
        history(),
        drawSelection(),
        bracketMatching(),
        closeBrackets(),
        indentOnInput(),
        highlightSelectionMatches(),
        autocompletion(),
        ...(wrap ? [EditorView.lineWrapping] : []),
        cmPlaceholder(placeholder),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...searchKeymap,
          ...lintKeymap,
          indentWithTab,
        ]),
        zestmanCmTheme,
        EditorView.contentAttributes.of({ "aria-label": ariaLabelRef.current }),
        ...(highlightVariables ? [variableExtension, varCompletionExtension] : []),
        langCompartment.current.of(languageExtension(language)),
        editableCompartment.current.of(readOnlyExtension(readOnly)),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current?.(u.state.doc.toString());
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    if (scrollerClassName) view.scrollDOM.classList.add(...scrollerClassName.split(/\s+/).filter(Boolean));
    if (highlightVariables) {
      view.dispatch({ effects: setEditorVars.of(varsRef.current) });
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes without resetting cursor on our own echoes.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if ((value ?? "") !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value ?? "" },
      });
    }
  }, [value]);

  useEffect(() => {
    let current = true;
    viewRef.current?.dispatch({
      effects: langCompartment.current.reconfigure(languageExtension(language)),
    });
    void LAZY_LANGUAGES[language]?.().then((ext) => {
      if (current) viewRef.current?.dispatch({ effects: langCompartment.current.reconfigure(ext) });
    });
    return () => {
      current = false;
    };
  }, [language]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: editableCompartment.current.reconfigure(readOnlyExtension(readOnly)),
    });
  }, [readOnly]);

  useEffect(() => {
    if (!highlightVariables) return;
    viewRef.current?.dispatch({ effects: setEditorVars.of(varsMap) });
  }, [varsMap, highlightVariables]);

  return (
    <div
      ref={containerRef}
      onMouseDown={(e) => clickIntoEditor(viewRef.current, e)}
      className={cn(
        "flex flex-col overflow-hidden rounded-md border border-border bg-card text-left",
        className
      )}
      style={{ minHeight }}
    />
  );
}
