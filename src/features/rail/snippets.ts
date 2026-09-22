import type { RequestDraft } from "@/daemon/types";
import type { EditorLanguage } from "@/lib/codemirror/CodeEditor";

/* ── The request a snippet reproduces ─────────────────────────────────────
   Built from the open tab's draft (unsaved edits included), in the same order
   the daemon assembles a send: path params into the URL, enabled query rows
   appended, enabled headers, then auth folded in (bearer / api-key as headers
   or query, basic and digest left to each client's own helper). Every
   generator below emits code that runs as written against that request.
   ───────────────────────────────────────────────────────────────────────── */

export interface SnippetField {
  name: string;
  value: string;
  /** Set for a form-data file row: the file name to read from disk. */
  file?: string;
}

export type SnippetBody =
  | { kind: "none" }
  | { kind: "json"; value: unknown }
  | { kind: "text"; text: string; contentType: string }
  | { kind: "urlencoded"; fields: SnippetField[] }
  | { kind: "form"; fields: SnippetField[] }
  | { kind: "file"; fileName: string };

export type SnippetAuth =
  | { kind: "none" }
  | { kind: "basic"; username: string; password: string }
  | { kind: "digest"; username: string; password: string }
  | { kind: "oauth2" };

export interface SnippetRequest {
  method: string;
  url: string;
  headers: Array<[string, string]>;
  auth: SnippetAuth;
  body: SnippetBody;
  isWs: boolean;
}

export interface Snippet {
  code: string;
  language: EditorLanguage;
}

const RAW_CONTENT_TYPE: Record<RequestDraft["body"]["raw"]["language"], string> = {
  json: "application/json",
  text: "text/plain",
  xml: "application/xml",
  html: "text/html",
  javascript: "application/javascript",
};

/** `:id` / `[id]` / `{id}` replaced by the draft's params — the daemon's rule; an empty value stays a placeholder. */
function substitutePathParams(url: string, params: RequestDraft["params"]): string {
  let out = url;
  for (const p of params) {
    if (!p.enabled || !p.key || !p.value) continue;
    const v = /\{\{/.test(p.value) ? p.value : encodeURIComponent(p.value);
    out = out
      .replace(new RegExp(`:${p.key}(?=/|$|\\?)`, "g"), v)
      .replace(new RegExp(`\\[${p.key}\\]`, "g"), v)
      .replace(new RegExp(`\\{${p.key}\\}`, "g"), v);
  }
  return out;
}

/** Encode a query part, leaving `{{variables}}` readable. */
function encodePart(s: string): string {
  return s
    .split(/(\{\{[^{}]*\}\})/)
    .map((piece) => (piece.startsWith("{{") ? piece : encodeURIComponent(piece)))
    .join("");
}

/**
 * The snippet's request from a draft. `resolve` substitutes variables (or is
 * the identity when the rail shows them unresolved).
 */
export function snippetRequest(draft: RequestDraft, isWs: boolean, resolve: (s: string) => string): SnippetRequest {
  const query: Array<[string, string]> = draft.query
    .filter((q) => q.enabled && q.key)
    .map((q) => [q.key, q.value]);
  const headers: Array<[string, string]> = draft.headers
    .filter((h) => h.enabled && h.key)
    .map((h) => [resolve(h.key), resolve(h.value)]);

  let auth: SnippetAuth = { kind: "none" };
  const a = draft.auth;
  switch (a.mode) {
    case "bearer":
      if (a.bearer.token) headers.push(["Authorization", `Bearer ${resolve(a.bearer.token)}`]);
      break;
    case "api-key":
      if (a.apiKey.key) {
        if (a.apiKey.addTo === "query") query.push([a.apiKey.key, a.apiKey.value]);
        else headers.push([resolve(a.apiKey.key), resolve(a.apiKey.value)]);
      }
      break;
    case "basic":
      if (a.basic.username) auth = { kind: "basic", username: resolve(a.basic.username), password: resolve(a.basic.password) };
      break;
    case "digest":
      if (a.digest.username) auth = { kind: "digest", username: resolve(a.digest.username), password: resolve(a.digest.password) };
      break;
    case "oauth2":
      auth = { kind: "oauth2" };
      break;
    // "inherit" and "none" send no credentials — the daemon does the same.
  }

  let url = resolve(substitutePathParams(draft.url, draft.params));
  if (query.length) {
    const qs = query.map(([k, v]) => `${encodePart(resolve(k))}=${encodePart(resolve(v))}`).join("&");
    url += (url.includes("?") ? "&" : "?") + qs;
  }

  return { method: draft.method.toUpperCase(), url, headers, auth, body: snippetBody(draft.body, resolve), isWs };
}

function snippetBody(b: RequestDraft["body"], resolve: (s: string) => string): SnippetBody {
  switch (b.mode) {
    case "raw": {
      const text = resolve(b.raw.text);
      if (!text.trim()) return { kind: "none" };
      if (b.raw.language === "json") {
        try {
          return { kind: "json", value: JSON.parse(text) };
        } catch {
          /* not JSON yet (an unquoted variable, a half-typed body): send it as written */
        }
      }
      return { kind: "text", text, contentType: RAW_CONTENT_TYPE[b.raw.language] };
    }
    case "urlencoded": {
      const fields = b.urlencoded.filter((r) => r.enabled && r.key).map((r) => ({ name: resolve(r.key), value: resolve(r.value) }));
      return fields.length ? { kind: "urlencoded", fields } : { kind: "none" };
    }
    case "form-data": {
      const fields = b.formData
        .filter((r) => r.enabled && r.key)
        .map((r) =>
          r.type === "file"
            ? { name: resolve(r.key), value: "", file: r.fileName || "file" }
            : { name: resolve(r.key), value: resolve(r.value) },
        );
      return fields.length ? { kind: "form", fields } : { kind: "none" };
    }
    case "binary":
      return b.binary ? { kind: "file", fileName: b.binary.fileName } : { kind: "none" };
    case "graphql": {
      let variables: unknown = {};
      try {
        variables = JSON.parse(resolve(b.graphql.variables) || "{}");
      } catch {
        variables = {};
      }
      return { kind: "json", value: { query: resolve(b.graphql.query), variables } };
    }
    default:
      return { kind: "none" };
  }
}

/* ── Literal helpers ─────────────────────────────────────────────────────── */

const hasHeader = (req: SnippetRequest, name: string) => req.headers.some(([k]) => k.toLowerCase() === name.toLowerCase());

/** The content type the body needs, unless the user set one themselves. */
function contentTypeFor(req: SnippetRequest): string | null {
  if (hasHeader(req, "content-type")) return null;
  switch (req.body.kind) {
    case "json":
      return "application/json";
    case "text":
      return req.body.contentType;
    case "file":
      return "application/octet-stream";
    default:
      return null;
  }
}

const dq = (s: string) => JSON.stringify(s);
const sq = (s: string) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
const rbq = (s: string) => dq(s).replace(/#\{/g, "\\#{");
const rsq = (s: string) => dq(s).replace(/\\u([0-9a-fA-F]{4})/g, "\\u{$1}");

interface LiteralStyle {
  unit: string;
  nul: string;
  tru: string;
  fal: string;
  str: (s: string) => string;
  key: (k: string) => string;
  sep: string;
  obj: [string, string];
  arr: [string, string];
  /** How an empty object is written, when `obj` alone would not say "object". */
  emptyObj?: string;
  trailing: boolean;
}

/** A JSON value as a literal in the target language, one member per line. */
function literal(v: unknown, style: LiteralStyle, level: number): string {
  if (v === null || v === undefined) return style.nul;
  if (v === true) return style.tru;
  if (v === false) return style.fal;
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return style.str(v);
  const pad = style.unit.repeat(level + 1);
  const end = style.unit.repeat(level);
  const tail = style.trailing ? "," : "";
  if (Array.isArray(v)) {
    if (!v.length) return style.arr.join("");
    const items = v.map((x) => pad + literal(x, style, level + 1));
    return `${style.arr[0]}\n${items.join(",\n")}${tail}\n${end}${style.arr[1]}`;
  }
  const entries = Object.entries(v as Record<string, unknown>);
  if (!entries.length) return style.emptyObj ?? style.obj.join("");
  const items = entries.map(([k, x]) => `${pad}${style.key(k)}${style.sep}${literal(x, style, level + 1)}`);
  return `${style.obj[0]}\n${items.join(",\n")}${tail}\n${end}${style.obj[1]}`;
}

const PY: LiteralStyle = { unit: "    ", nul: "None", tru: "True", fal: "False", str: dq, key: dq, sep: ": ", obj: ["{", "}"], arr: ["[", "]"], trailing: true };
const RB: LiteralStyle = { unit: "  ", nul: "nil", tru: "true", fal: "false", str: rbq, key: rbq, sep: " => ", obj: ["{", "}"], arr: ["[", "]"], trailing: true };
// PHP has one array type: an empty `[]` json_encodes as a list, so an empty object must be a stdClass.
const PHP: LiteralStyle = { unit: "    ", nul: "null", tru: "true", fal: "false", str: sq, key: sq, sep: " => ", obj: ["[", "]"], arr: ["[", "]"], emptyObj: "new \\stdClass()", trailing: true };

/** Pretty JSON indented to sit inside a block that is itself indented by `indent`. */
const jsonAt = (v: unknown, indent: string) => JSON.stringify(v, null, 2).replace(/\n/g, `\n${indent}`);

/** Lines of `text` each prefixed by `indent` — for multi-line string blocks. */
const indentLines = (text: string, indent: string) =>
  text
    .split("\n")
    .map((l) => (l ? indent + l : l))
    .join("\n");

const bodyText = (req: SnippetRequest): string | null =>
  req.body.kind === "json" ? JSON.stringify(req.body.value, null, 2) : req.body.kind === "text" ? req.body.text : null;

const authNote = (req: SnippetRequest, comment: string): string[] =>
  req.auth.kind === "oauth2"
    ? [`${comment} OAuth 2.0: send the access token as "Authorization: Bearer <token>"`]
    : [];

/* ── HTTP generators ─────────────────────────────────────────────────────── */

function curl(req: SnippetRequest): string {
  const head = `curl ${req.method !== "GET" ? `-X ${req.method} ` : ""}${shq(req.url)}`;
  const args: string[] = [];
  if (req.auth.kind === "basic") args.push(`-u ${shq(`${req.auth.username}:${req.auth.password}`)}`);
  if (req.auth.kind === "digest") args.push(`--digest -u ${shq(`${req.auth.username}:${req.auth.password}`)}`);
  for (const [k, v] of req.headers) args.push(`-H ${shq(`${k}: ${v}`)}`);
  const ct = contentTypeFor(req);
  if (ct) args.push(`-H ${shq(`Content-Type: ${ct}`)}`);
  const b = req.body;
  if (b.kind === "json" || b.kind === "text") args.push(`--data-raw ${shq(bodyText(req) ?? "")}`);
  if (b.kind === "urlencoded") for (const f of b.fields) args.push(`--data-urlencode ${shq(`${f.name}=${f.value}`)}`);
  if (b.kind === "form") for (const f of b.fields) args.push(`-F ${shq(f.file ? `${f.name}=@${f.file}` : `${f.name}=${f.value}`)}`);
  if (b.kind === "file") args.push(`--data-binary ${shq(`@${b.fileName}`)}`);
  return [...authNote(req, "#"), [head, ...args].join(" \\\n  ")].join("\n");
}

function fetchJs(req: SnippetRequest): string {
  const lines: string[] = [...authNote(req, "//")];
  const b = req.body;
  const needsFs = b.kind === "file" || (b.kind === "form" && b.fields.some((f) => f.file));
  if (needsFs) lines.push(`import { openAsBlob } from "node:fs";`, "");
  if (b.kind === "form") {
    lines.push("const form = new FormData();");
    for (const f of b.fields) {
      lines.push(
        f.file
          ? `form.append(${dq(f.name)}, await openAsBlob(${dq(f.file)}), ${dq(f.file)});`
          : `form.append(${dq(f.name)}, ${dq(f.value)});`,
      );
    }
    lines.push("");
  }
  const headers: Array<[string, string]> = req.headers.map(([k, v]) => [dq(k), dq(v)]);
  const ct = contentTypeFor(req);
  if (ct) headers.push([dq("Content-Type"), dq(ct)]);
  if (req.auth.kind === "basic") {
    headers.push([dq("Authorization"), `"Basic " + btoa(${dq(`${req.auth.username}:${req.auth.password}`)})`]);
  }
  const opts: string[] = [`  method: ${dq(req.method)},`];
  if (headers.length) opts.push("  headers: {", ...headers.map(([k, v]) => `    ${k}: ${v},`), "  },");
  if (b.kind === "json") opts.push(`  body: JSON.stringify(${jsonAt(b.value, "  ")}),`);
  if (b.kind === "text") opts.push(`  body: ${dq(b.text)},`);
  if (b.kind === "urlencoded") {
    opts.push("  body: new URLSearchParams([", ...b.fields.map((f) => `    [${dq(f.name)}, ${dq(f.value)}],`), "  ]),");
  }
  if (b.kind === "form") opts.push("  body: form,");
  if (b.kind === "file") opts.push(`  body: await openAsBlob(${dq(b.fileName)}),`);
  lines.push(`const res = await fetch(${dq(req.url)}, {`, ...opts, "});", "console.log(res.status, await res.text());");
  return lines.join("\n");
}

function axiosTs(req: SnippetRequest): string {
  const b = req.body;
  const lines: string[] = [...authNote(req, "//"), `import axios from "axios";`];
  const needsFs = b.kind === "file" || (b.kind === "form" && b.fields.some((f) => f.file));
  if (needsFs) lines.push(`import { openAsBlob } from "node:fs";`);
  lines.push("");
  if (b.kind === "form") {
    lines.push("const form = new FormData();");
    for (const f of b.fields) {
      lines.push(
        f.file
          ? `form.append(${dq(f.name)}, await openAsBlob(${dq(f.file)}), ${dq(f.file)});`
          : `form.append(${dq(f.name)}, ${dq(f.value)});`,
      );
    }
    lines.push("");
  }
  const headers: Array<[string, string]> = req.headers.map(([k, v]) => [dq(k), dq(v)]);
  const ct = contentTypeFor(req);
  if (ct && b.kind !== "json") headers.push([dq("Content-Type"), dq(ct)]);
  const opts: string[] = [`  method: ${dq(req.method.toLowerCase())},`, `  url: ${dq(req.url)},`];
  if (headers.length) opts.push("  headers: {", ...headers.map(([k, v]) => `    ${k}: ${v},`), "  },");
  if (b.kind === "json") opts.push(`  data: ${jsonAt(b.value, "  ")},`);
  if (b.kind === "text") opts.push(`  data: ${dq(b.text)},`);
  if (b.kind === "urlencoded") {
    opts.push("  data: new URLSearchParams([", ...b.fields.map((f) => `    [${dq(f.name)}, ${dq(f.value)}],`), "  ]),");
  }
  if (b.kind === "form") opts.push("  data: form,");
  if (b.kind === "file") opts.push(`  data: await openAsBlob(${dq(b.fileName)}),`);
  if (req.auth.kind === "basic") {
    opts.push(`  auth: { username: ${dq(req.auth.username)}, password: ${dq(req.auth.password)} },`);
  }
  lines.push("const res = await axios.request({", ...opts, "});", "console.log(res.status, res.data);");
  return lines.join("\n");
}

function python(req: SnippetRequest): string {
  const b = req.body;
  const lines: string[] = [...authNote(req, "#"), "import requests"];
  if (req.auth.kind === "digest") lines.push("from requests.auth import HTTPDigestAuth");
  lines.push("");
  const args: string[] = [`    ${dq(req.method)},`, `    ${dq(req.url)},`];
  const headers = Object.fromEntries(req.headers);
  const ct = contentTypeFor(req);
  if (ct && b.kind !== "json") headers["Content-Type"] = ct;
  if (Object.keys(headers).length) args.push(`    headers=${literal(headers, PY, 1)},`);
  if (b.kind === "json") args.push(`    json=${literal(b.value, PY, 1)},`);
  if (b.kind === "text") args.push(`    data=${dq(b.text)},`);
  if (b.kind === "urlencoded") args.push(`    data=[\n${b.fields.map((f) => `        (${dq(f.name)}, ${dq(f.value)}),`).join("\n")}\n    ],`);
  if (b.kind === "form") {
    const text = b.fields.filter((f) => !f.file);
    const files = b.fields.filter((f) => f.file);
    if (text.length) args.push(`    data=${literal(Object.fromEntries(text.map((f) => [f.name, f.value])), PY, 1)},`);
    if (files.length) {
      args.push(`    files={\n${files.map((f) => `        ${dq(f.name)}: open(${dq(f.file ?? "")}, "rb"),`).join("\n")}\n    },`);
    }
  }
  if (b.kind === "file") args.push(`    data=open(${dq(b.fileName)}, "rb"),`);
  if (req.auth.kind === "basic") args.push(`    auth=(${dq(req.auth.username)}, ${dq(req.auth.password)}),`);
  if (req.auth.kind === "digest") args.push(`    auth=HTTPDigestAuth(${dq(req.auth.username)}, ${dq(req.auth.password)}),`);
  lines.push("res = requests.request(", ...args, ")", "print(res.status_code, res.text)");
  return lines.join("\n");
}

function goNetHttp(req: SnippetRequest): string {
  const b = req.body;
  const imports = new Set(["fmt", "io", "net/http"]);
  const pre: string[] = [];
  let bodyExpr = "nil";
  let ctExpr: string | null = contentTypeFor(req) ? dq(contentTypeFor(req) ?? "") : null;
  const text = bodyText(req);
  if (text !== null) {
    imports.add("strings");
    bodyExpr = "body";
    pre.push(!text.includes("`") ? `\tbody := strings.NewReader(\`${text}\`)` : `\tbody := strings.NewReader(${dq(text)})`);
  }
  if (b.kind === "urlencoded") {
    imports.add("net/url").add("strings");
    bodyExpr = "strings.NewReader(form.Encode())";
    pre.push("\tform := url.Values{}", ...b.fields.map((f) => `\tform.Add(${dq(f.name)}, ${dq(f.value)})`));
    if (!hasHeader(req, "content-type")) ctExpr = dq("application/x-www-form-urlencoded");
  }
  if (b.kind === "form") {
    imports.add("bytes").add("mime/multipart");
    bodyExpr = "&buf";
    pre.push("\tvar buf bytes.Buffer", "\tw := multipart.NewWriter(&buf)");
    for (const f of b.fields) {
      if (f.file) {
        imports.add("os");
        pre.push(
          `\tif f, err := os.Open(${dq(f.file)}); err == nil {`,
          `\t\tpart, _ := w.CreateFormFile(${dq(f.name)}, ${dq(f.file)})`,
          "\t\tio.Copy(part, f)",
          "\t\tf.Close()",
          "\t} else {",
          "\t\tpanic(err)",
          "\t}",
        );
      } else {
        pre.push(`\tw.WriteField(${dq(f.name)}, ${dq(f.value)})`);
      }
    }
    pre.push("\tw.Close()");
    if (!hasHeader(req, "content-type")) ctExpr = "w.FormDataContentType()";
  }
  if (b.kind === "file") {
    imports.add("os");
    bodyExpr = "file";
    pre.push(`\tfile, err := os.Open(${dq(b.fileName)})`, "\tif err != nil {", "\t\tpanic(err)", "\t}", "\tdefer file.Close()");
  }

  const main: string[] = [...pre];
  if (pre.length) main.push("");
  main.push(
    `\treq, err := http.NewRequest(${dq(req.method)}, ${dq(req.url)}, ${bodyExpr})`,
    "\tif err != nil {",
    "\t\tpanic(err)",
    "\t}",
    ...req.headers.map(([k, v]) => `\treq.Header.Set(${dq(k)}, ${dq(v)})`),
    ...(ctExpr ? [`\treq.Header.Set("Content-Type", ${ctExpr})`] : []),
    ...(req.auth.kind === "basic" ? [`\treq.SetBasicAuth(${dq(req.auth.username)}, ${dq(req.auth.password)})`] : []),
    "",
    "\tres, err := http.DefaultClient.Do(req)",
    "\tif err != nil {",
    "\t\tpanic(err)",
    "\t}",
    "\tdefer res.Body.Close()",
    "",
    "\tout, _ := io.ReadAll(res.Body)",
    "\tfmt.Println(res.Status, string(out))",
  );
  return [
    ...authNote(req, "//"),
    "package main",
    "",
    "import (",
    ...[...imports].sort().map((i) => `\t${dq(i)}`),
    ")",
    "",
    "func main() {",
    ...main,
    "}",
  ].join("\n");
}

const RUBY_METHODS: Record<string, string> = {
  GET: "Get",
  POST: "Post",
  PUT: "Put",
  PATCH: "Patch",
  DELETE: "Delete",
  HEAD: "Head",
  OPTIONS: "Options",
};

function ruby(req: SnippetRequest): string {
  const b = req.body;
  const lines: string[] = [...authNote(req, "#")];
  if (b.kind === "json") lines.push(`require "json"`);
  lines.push(`require "net/http"`, `require "uri"`, "", `uri = URI(${rbq(req.url)})`);
  const cls = RUBY_METHODS[req.method];
  lines.push(
    cls ? `req = Net::HTTP::${cls}.new(uri)` : `req = Net::HTTPGenericRequest.new(${rbq(req.method)}, true, true, uri)`,
  );
  for (const [k, v] of req.headers) lines.push(`req[${rbq(k)}] = ${rbq(v)}`);
  const ct = contentTypeFor(req);
  if (ct) lines.push(`req["Content-Type"] = ${rbq(ct)}`);
  if (req.auth.kind === "basic") lines.push(`req.basic_auth(${rbq(req.auth.username)}, ${rbq(req.auth.password)})`);
  if (b.kind === "json") lines.push(`req.body = JSON.generate(${literal(b.value, RB, 0)})`);
  if (b.kind === "text") lines.push(`req.body = ${rbq(b.text)}`);
  if (b.kind === "urlencoded") lines.push(`req.set_form_data(${literal(Object.fromEntries(b.fields.map((f) => [f.name, f.value])), RB, 0)})`);
  if (b.kind === "form") {
    const parts = b.fields.map((f) => (f.file ? `  [${rbq(f.name)}, File.open(${rbq(f.file)})],` : `  [${rbq(f.name)}, ${rbq(f.value)}],`));
    lines.push("req.set_form([", ...parts, `], "multipart/form-data")`);
  }
  if (b.kind === "file") lines.push(`req.body = File.binread(${rbq(b.fileName)})`);
  lines.push(
    "",
    `res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == "https") do |http|`,
    "  http.request(req)",
    "end",
    "puts res.code, res.body",
  );
  return lines.join("\n");
}

function php(req: SnippetRequest): string {
  const b = req.body;
  const opts: string[] = [];
  const headers = Object.fromEntries(req.headers);
  const ct = contentTypeFor(req);
  if (ct && b.kind !== "json") headers["Content-Type"] = ct;
  if (Object.keys(headers).length) opts.push(`    'headers' => ${literal(headers, PHP, 1)},`);
  if (b.kind === "json") opts.push(`    'json' => ${literal(b.value, PHP, 1)},`);
  if (b.kind === "text") opts.push(`    'body' => ${sq(b.text)},`);
  if (b.kind === "urlencoded") opts.push(`    'form_params' => ${literal(Object.fromEntries(b.fields.map((f) => [f.name, f.value])), PHP, 1)},`);
  if (b.kind === "form") {
    const parts = b.fields.map((f) =>
      f.file
        ? `        ['name' => ${sq(f.name)}, 'contents' => fopen(${sq(f.file)}, 'r'), 'filename' => ${sq(f.file)}],`
        : `        ['name' => ${sq(f.name)}, 'contents' => ${sq(f.value)}],`,
    );
    opts.push("    'multipart' => [", ...parts, "    ],");
  }
  if (b.kind === "file") opts.push(`    'body' => fopen(${sq(b.fileName)}, 'r'),`);
  if (req.auth.kind === "basic") opts.push(`    'auth' => [${sq(req.auth.username)}, ${sq(req.auth.password)}],`);
  if (req.auth.kind === "digest") opts.push(`    'auth' => [${sq(req.auth.username)}, ${sq(req.auth.password)}, 'digest'],`);
  return [
    "<?php",
    ...authNote(req, "//"),
    "require 'vendor/autoload.php';",
    "",
    "$client = new GuzzleHttp\\Client();",
    opts.length
      ? [`$res = $client->request(${sq(req.method)}, ${sq(req.url)}, [`, ...opts, "]);"].join("\n")
      : `$res = $client->request(${sq(req.method)}, ${sq(req.url)});`,
    `echo $res->getStatusCode(), "\\n", $res->getBody();`,
  ].join("\n");
}

/** Methods OkHttp refuses to send without a body (it throws), so they get an empty one. */
const BODY_REQUIRED = new Set(["POST", "PUT", "PATCH"]);

function javaTextBlock(text: string, indent: string): string {
  const escaped = text.replace(/\\/g, "\\\\").replace(/"""/g, '\\"""');
  return `"""\n${indentLines(escaped, indent)}\n${indent}"""`;
}

function java(req: SnippetRequest): string {
  const b = req.body;
  const lines: string[] = [...authNote(req, "//"), "OkHttpClient client = new OkHttpClient();", ""];
  const ct = contentTypeFor(req) ?? req.headers.find(([k]) => k.toLowerCase() === "content-type")?.[1] ?? null;
  let bodyVar = "null";
  const text = bodyText(req);
  if (text !== null) {
    lines.push(`RequestBody body = RequestBody.create(${javaTextBlock(text, "    ")}, MediaType.parse(${dq(ct ?? "text/plain")}));`);
    bodyVar = "body";
  } else if (b.kind === "urlencoded") {
    lines.push("RequestBody body = new FormBody.Builder()", ...b.fields.map((f) => `    .add(${dq(f.name)}, ${dq(f.value)})`), "    .build();");
    bodyVar = "body";
  } else if (b.kind === "form") {
    lines.push("RequestBody body = new MultipartBody.Builder()", "    .setType(MultipartBody.FORM)");
    for (const f of b.fields) {
      lines.push(
        f.file
          ? `    .addFormDataPart(${dq(f.name)}, ${dq(f.file)}, RequestBody.create(new File(${dq(f.file)}), MediaType.parse("application/octet-stream")))`
          : `    .addFormDataPart(${dq(f.name)}, ${dq(f.value)})`,
      );
    }
    lines.push("    .build();");
    bodyVar = "body";
  } else if (b.kind === "file") {
    lines.push(`RequestBody body = RequestBody.create(new File(${dq(b.fileName)}), MediaType.parse(${dq(ct ?? "application/octet-stream")}));`);
    bodyVar = "body";
  } else if (BODY_REQUIRED.has(req.method)) {
    lines.push(`RequestBody body = RequestBody.create(new byte[0]);`);
    bodyVar = "body";
  }
  if (bodyVar !== "null") lines.push("");
  lines.push(
    "Request request = new Request.Builder()",
    `    .url(${dq(req.url)})`,
    `    .method(${dq(req.method)}, ${bodyVar})`,
    ...req.headers.map(([k, v]) => `    .addHeader(${dq(k)}, ${dq(v)})`),
    ...(req.auth.kind === "basic" ? [`    .addHeader("Authorization", Credentials.basic(${dq(req.auth.username)}, ${dq(req.auth.password)}))`] : []),
    "    .build();",
    "",
    "try (Response response = client.newCall(request).execute()) {",
    `  System.out.println(response.code() + " " + response.body().string());`,
    "}",
  );
  return lines.join("\n");
}

/** A C# raw string literal: nothing inside is escaped, so the delimiter outgrows any run of quotes. */
function csharpRaw(text: string, indent: string): string {
  const longest = Math.max(2, ...(text.match(/"+/g) ?? []).map((q) => q.length));
  const fence = '"'.repeat(longest + 1);
  return `${fence}\n${indentLines(text, indent)}\n${indent}${fence}`;
}

function csharp(req: SnippetRequest): string {
  const b = req.body;
  const lines: string[] = [...authNote(req, "//")];
  const usings = new Set<string>();
  // Content-Type is a content header: HttpClient refuses it on the request, it rides on the content.
  const userCt = req.headers.find(([k]) => k.toLowerCase() === "content-type")?.[1];
  const ct = userCt ?? contentTypeFor(req);
  const body: string[] = [];
  const text = bodyText(req);
  if (text !== null) {
    usings.add("System.Text");
    body.push(`request.Content = new StringContent(${csharpRaw(text, "    ")}, Encoding.UTF8, ${dq(ct ?? "text/plain")});`);
  } else if (b.kind === "urlencoded") {
    body.push(
      "request.Content = new FormUrlEncodedContent(new[]",
      "{",
      ...b.fields.map((f) => `    new KeyValuePair<string, string>(${dq(f.name)}, ${dq(f.value)}),`),
      "});",
    );
  } else if (b.kind === "form") {
    body.push("var form = new MultipartFormDataContent();");
    for (const f of b.fields) {
      body.push(
        f.file
          ? `form.Add(new StreamContent(File.OpenRead(${dq(f.file)})), ${dq(f.name)}, ${dq(f.file)});`
          : `form.Add(new StringContent(${dq(f.value)}), ${dq(f.name)});`,
      );
    }
    body.push("request.Content = form;");
  } else if (b.kind === "file") {
    usings.add("System.Net.Http.Headers");
    body.push(
      `request.Content = new StreamContent(File.OpenRead(${dq(b.fileName)}));`,
      `request.Content.Headers.ContentType = new MediaTypeHeaderValue(${dq(ct ?? "application/octet-stream")});`,
    );
  }
  if (req.auth.kind === "basic") usings.add("System.Net.Http.Headers").add("System.Text");
  if (usings.size) lines.push(...[...usings].sort().map((u) => `using ${u};`), "");
  lines.push(
    "using var client = new HttpClient();",
    `using var request = new HttpRequestMessage(new HttpMethod(${dq(req.method)}), ${dq(req.url)});`,
    ...req.headers
      .filter(([k]) => k.toLowerCase() !== "content-type")
      .map(([k, v]) => `request.Headers.TryAddWithoutValidation(${dq(k)}, ${dq(v)});`),
    ...(req.auth.kind === "basic"
      ? [
          `request.Headers.Authorization = new AuthenticationHeaderValue("Basic",`,
          `    Convert.ToBase64String(Encoding.UTF8.GetBytes(${dq(`${req.auth.username}:${req.auth.password}`)})));`,
        ]
      : []),
    ...body,
    "",
    "using var response = await client.SendAsync(request);",
    `Console.WriteLine($"{(int)response.StatusCode} {await response.Content.ReadAsStringAsync()}");`,
  );
  return lines.join("\n");
}

const RUST_METHODS = new Set(["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "CONNECT", "PATCH", "TRACE"]);

function rust(req: SnippetRequest): string {
  const b = req.body;
  const method = RUST_METHODS.has(req.method)
    ? `reqwest::Method::${req.method}`
    : `reqwest::Method::from_bytes(${rsq(req.method)}.as_bytes())?`;
  const chain: string[] = [`        .request(${method}, ${rsq(req.url)})`];
  for (const [k, v] of req.headers) chain.push(`        .header(${rsq(k)}, ${rsq(v)})`);
  const ct = contentTypeFor(req);
  if (ct && b.kind !== "json") chain.push(`        .header("Content-Type", ${rsq(ct)})`);
  if (req.auth.kind === "basic") chain.push(`        .basic_auth(${rsq(req.auth.username)}, Some(${rsq(req.auth.password)}))`);
  const pre: string[] = [];
  if (b.kind === "json") chain.push(`        .json(&serde_json::json!(${jsonAt(b.value, "        ").replace(/\\u([0-9a-fA-F]{4})/g, "\\u{$1}")}))`);
  if (b.kind === "text") chain.push(`        .body(${rsq(b.text)})`);
  if (b.kind === "urlencoded") chain.push(`        .form(&[${b.fields.map((f) => `(${rsq(f.name)}, ${rsq(f.value)})`).join(", ")}])`);
  if (b.kind === "form") {
    pre.push("    let form = reqwest::multipart::Form::new()");
    for (const f of b.fields) {
      pre.push(f.file ? `        .file(${rsq(f.name)}, ${rsq(f.file)})\n        .await?` : `        .text(${rsq(f.name)}, ${rsq(f.value)})`);
    }
    pre[pre.length - 1] += ";";
    pre.push("");
    chain.push("        .multipart(form)");
  }
  if (b.kind === "file") chain.push(`        .body(tokio::fs::read(${rsq(b.fileName)}).await?)`);
  return [
    ...authNote(req, "//"),
    "#[tokio::main]",
    "async fn main() -> Result<(), Box<dyn std::error::Error>> {",
    ...pre,
    "    let res = reqwest::Client::new()",
    ...chain,
    "        .send()",
    "        .await?;",
    "",
    `    println!("{} {}", res.status(), res.text().await?);`,
    "    Ok(())",
    "}",
  ].join("\n");
}

/* ── WebSocket: only the languages with a real client session to show ──── */

const wscat = (req: SnippetRequest) => `wscat -c ${shq(req.url)}`;

const wsJs = (req: SnippetRequest) =>
  [
    `const ws = new WebSocket(${dq(req.url)});`,
    "",
    "ws.onopen = () => ws.send(JSON.stringify({ ping: 1 }));",
    "ws.onmessage = (event) => console.log(event.data);",
  ].join("\n");

const wsPython = (req: SnippetRequest) =>
  [
    "from websockets.sync.client import connect",
    "",
    `with connect(${dq(req.url)}) as ws:`,
    `    ws.send('{"ping": 1}')`,
    "    print(ws.recv())",
  ].join("\n");

/* ── Registry ────────────────────────────────────────────────────────────── */

interface Generator {
  language: EditorLanguage;
  /** The client library the snippet is written against. */
  variant: string;
  build: (req: SnippetRequest) => string;
}

const HTTP: Record<string, Generator> = {
  cURL: { language: "shell", variant: "", build: curl },
  JavaScript: { language: "javascript", variant: "fetch", build: fetchJs },
  TypeScript: { language: "typescript", variant: "axios", build: axiosTs },
  Python: { language: "python", variant: "requests", build: python },
  Go: { language: "go", variant: "net/http", build: goNetHttp },
  Ruby: { language: "ruby", variant: "net/http", build: ruby },
  PHP: { language: "php", variant: "guzzle", build: php },
  Java: { language: "java", variant: "okhttp", build: java },
  "C#": { language: "csharp", variant: "HttpClient", build: csharp },
  Rust: { language: "rust", variant: "reqwest", build: rust },
};

const WS: Record<string, Generator> = {
  cURL: { language: "shell", variant: "wscat", build: wscat },
  JavaScript: { language: "javascript", variant: "WebSocket", build: wsJs },
  TypeScript: { language: "typescript", variant: "WebSocket", build: wsJs },
  Python: { language: "python", variant: "websockets", build: wsPython },
};

export function snippetVariant(lang: string, isWs: boolean): string {
  return (isWs ? WS : HTTP)[lang]?.variant ?? "";
}

/** Languages we can emit a runnable snippet for, given the route's protocol. */
export function snippetLanguages(isWs: boolean): string[] {
  return Object.keys(isWs ? WS : HTTP);
}

/** Runnable snippet for `lang`, or null when that language has none. */
export function buildSnippet(lang: string, req: SnippetRequest): Snippet | null {
  const gen = (req.isWs ? WS : HTTP)[lang];
  return gen ? { code: gen.build(req), language: gen.language } : null;
}
