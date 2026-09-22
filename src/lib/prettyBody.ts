import type { EditorLanguage } from "@/lib/codemirror/CodeEditor";

/**
 * Re-indent a JSON document without parsing its values: strings, numbers and
 * key order come out exactly as the server sent them. `JSON.parse` +
 * `JSON.stringify` would round 64-bit ids (`9007199254740993` → `…992`) and
 * turn `1.0` into `1`, which misreports what the API actually returned.
 * Returns null when the text is not one well-formed JSON value.
 */
export function prettyJson(text: string, indent = 2): string | null {
  const src = text.trim();
  if (!src || !"{[\"-0123456789tfn".includes(src[0])) return null;
  try {
    JSON.parse(src);
  } catch {
    return null;
  }

  const pad = (depth: number) => "\n" + " ".repeat(depth * indent);
  let out = "";
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"') {
      // Copy the whole string literal verbatim, escapes included.
      let j = i + 1;
      while (j < src.length && src[j] !== '"') j += src[j] === "\\" ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j;
      continue;
    }
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") continue;
    if (ch === "{" || ch === "[") {
      // An empty object/array stays on one line: `{}`, `[]`.
      let k = i + 1;
      while (k < src.length && /\s/.test(src[k])) k++;
      if (src[k] === (ch === "{" ? "}" : "]")) {
        out += ch + src[k];
        i = k;
        continue;
      }
      depth++;
      out += ch + pad(depth);
      continue;
    }
    if (ch === "}" || ch === "]") {
      depth--;
      out += pad(depth) + ch;
      continue;
    }
    if (ch === ",") {
      out += "," + pad(depth);
      continue;
    }
    if (ch === ":") {
      out += ": ";
      continue;
    }
    out += ch;
  }
  return out;
}

/** A response body as it should be read: pretty when it is JSON, verbatim otherwise. */
export function prettyBody(body: string, kind: string): { text: string; language: EditorLanguage } {
  if (kind === "json" || kind === "text") {
    const pretty = prettyJson(body);
    if (pretty !== null) return { text: pretty, language: "json" };
  }
  if (kind === "html") return { text: body, language: "html" };
  if (/^\s*<\?xml|^\s*<[a-zA-Z][\w:-]*[\s>]/.test(body) && kind !== "json") return { text: body, language: "xml" };
  return { text: body, language: kind === "json" ? "json" : "text" };
}
