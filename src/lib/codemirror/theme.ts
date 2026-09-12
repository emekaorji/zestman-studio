import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

/**
 * Editor chrome bound to the app's CSS variables, so it follows the active
 * theme (light/dark + accent) automatically.
 */
export const zestmanEditorTheme = EditorView.theme({
  "&": {
    color: "var(--foreground)",
    backgroundColor: "transparent",
    fontSize: "12px",
    height: "100%",
  },
  ".cm-content": {
    fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, monospace)",
    padding: "10px 0",
    caretColor: "var(--foreground)",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, monospace)",
    lineHeight: "1.6",
    overflow: "auto",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "color-mix(in oklch, var(--muted-foreground) 45%, transparent)",
    border: "none",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in oklch, var(--muted) 35%, transparent)",
  },
  ".cm-activeLineGutter": { backgroundColor: "transparent" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in oklch, var(--primary) 22%, transparent)",
  },
  ".cm-placeholder": { color: "color-mix(in oklch, var(--muted-foreground) 70%, transparent)" },
  // {{variable}} decorations
  ".cm-var-resolved": {
    color: "var(--primary)",
    backgroundColor: "var(--primary-soft)",
    borderRadius: "3px",
  },
  ".cm-var-unresolved": {
    color: "var(--method-delete)",
    textDecoration: "underline wavy",
    textUnderlineOffset: "2px",
  },
  ".cm-var-tooltip": {
    padding: "3px 7px",
    fontSize: "11px",
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--primary-soft)",
    color: "var(--primary)",
  },
});

/** Token colors reusing the app's method palette for visual consistency. */
export const zestmanHighlightStyle = HighlightStyle.define([
  { tag: [t.propertyName, t.definition(t.propertyName)], color: "var(--syntax-key)" },
  { tag: [t.string, t.special(t.string)], color: "var(--syntax-str)" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "var(--syntax-num)" },
  { tag: [t.keyword, t.operator, t.modifier], color: "var(--syntax-kw)" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "var(--syntax-fn)" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: [t.bracket, t.punctuation, t.separator], color: "var(--syntax-punct)" },
  { tag: [t.tagName], color: "var(--syntax-tag)" },
  { tag: [t.attributeName], color: "var(--syntax-key)" },
  { tag: t.invalid, color: "var(--err)" },
]);

export const zestmanCmTheme = [
  zestmanEditorTheme,
  syntaxHighlighting(zestmanHighlightStyle),
];
