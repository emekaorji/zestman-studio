/**
 * Shared {{variable}} tokenization & resolution for the client UI.
 * Mirrors the server resolver (src/server/proxy.ts) so highlighting agrees
 * with execution. The `{{ key }}` form tolerates surrounding whitespace.
 */

export const VAR_PATTERN = "\\{\\{\\s*([^{}]+?)\\s*\\}\\}";

/** Postman-style dynamic variables (resolved server-side at send time). */
export const DYNAMIC_VARS = [
  "$guid",
  "$randomUUID",
  "$timestamp",
  "$epoch",
  "$isoTimestamp",
  "$randomInt",
  "$randomBoolean",
  "$randomEmail",
  "$randomFirstName",
  "$randomLastName",
  "$randomFullName",
  "$randomColor",
  "$randomHexColor",
];
const DYNAMIC_SET = new Set(DYNAMIC_VARS);

/** True for variables that resolve at send time without being in the var map. */
export function isDynamicVar(key: string): boolean {
  return DYNAMIC_SET.has(key.trim());
}

export interface KVish {
  key: string;
  value: string;
  enabled: boolean;
}

/** Build a name→value map from enabled variable rows. */
export function buildVarMap(...sources: Array<KVish[] | undefined>): Map<string, string> {
  const map = new Map<string, string>();
  for (const rows of sources) {
    if (!rows) continue;
    for (const v of rows) {
      if (v.enabled && v.key) map.set(v.key, v.value);
    }
  }
  return map;
}

export interface VarToken {
  type: "text" | "var";
  value: string;
  key?: string;
  resolved?: boolean;
}

/** Split text into literal and {{var}} tokens, marking each var resolved or not. */
export function tokenizeVariables(text: string, vars: Map<string, string>): VarToken[] {
  const tokens: VarToken[] = [];
  const re = new RegExp(VAR_PATTERN, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      tokens.push({ type: "text", value: text.slice(last, m.index) });
    }
    const key = m[1].trim();
    tokens.push({ type: "var", value: m[0], key, resolved: vars.has(key) || isDynamicVar(key) });
    last = m.index + m[0].length;
    if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-length
  }
  if (last < text.length) tokens.push({ type: "text", value: text.slice(last) });
  return tokens;
}

/** Substitute variables, returning the resolved string and any unresolved tokens. */
export function resolveText(
  text: string,
  vars: Map<string, string>
): { resolved: string; unresolved: string[] } {
  const unresolved: string[] = [];
  const resolved = text.replace(new RegExp(VAR_PATTERN, "g"), (full, k: string) => {
    const key = k.trim();
    if (vars.has(key)) return vars.get(key) ?? "";
    if (!unresolved.includes(full)) unresolved.push(full);
    return full;
  });
  return { resolved, unresolved };
}

export function isResolved(key: string, vars: Map<string, string>): boolean {
  return vars.has(key.trim()) || isDynamicVar(key);
}
