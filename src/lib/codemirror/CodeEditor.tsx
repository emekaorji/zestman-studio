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
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { lintKeymap, linter, lintGutter } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
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
  | "json"
  | "text"
  | "xml"
  | "html"
  | "graphql";

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
}

function languageExtension(language: EditorLanguage): Extension {
  switch (language) {
    case "json":
      return [jsonLang(), linter(jsonParseLinter()), lintGutter()];
    case "javascript":
    case "graphql":
      return jsLang();
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
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        bracketMatching(),
        closeBrackets(),
        indentOnInput(),
        highlightSelectionMatches(),
        autocompletion(),
        EditorView.lineWrapping,
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
        EditorView.contentAttributes.of({
          "aria-label": ariaLabelRef.current,
          ...(readOnly ? { "aria-readonly": "true" } : {}),
        }),
        ...(highlightVariables ? [variableExtension, varCompletionExtension] : []),
        langCompartment.current.of(languageExtension(language)),
        editableCompartment.current.of([
          EditorView.editable.of(!readOnly),
          EditorState.readOnly.of(readOnly),
        ]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current?.(u.state.doc.toString());
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
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
    viewRef.current?.dispatch({
      effects: langCompartment.current.reconfigure(languageExtension(language)),
    });
  }, [language]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: editableCompartment.current.reconfigure([
        EditorView.editable.of(!readOnly),
        EditorState.readOnly.of(readOnly),
      ]),
    });
  }, [readOnly]);

  useEffect(() => {
    if (!highlightVariables) return;
    viewRef.current?.dispatch({ effects: setEditorVars.of(varsMap) });
  }, [varsMap, highlightVariables]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "overflow-hidden rounded-md border border-border bg-card text-left",
        className
      )}
      style={{ minHeight }}
    />
  );
}
