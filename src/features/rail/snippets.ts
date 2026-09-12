import type { Route } from "@/daemon/types";

/** Parse the route's JSON body into an object, or null when there is none. */
export function routeBodyJson(route: Route): Record<string, unknown> | null {
  const b = route.body;
  if (b.mode !== "raw" || b.raw.language !== "json" || !b.raw.text.trim()) return null;
  try {
    const v: unknown = JSON.parse(b.raw.text);
    return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/* ── Snippets ─────────────────────────────────────────────────────────────
   One generator per language the picker offers. Every entry emits code that
   would actually run — a snippet header that says "Python · requests" over
   axios is worse than no snippet at all.
   Line tone is a token utility, never a literal.
   ───────────────────────────────────────────────────────────────────────── */

export interface SnippetLine {
  /** Empty string renders as a blank spacer line. */
  t: string;
  /** Token colour utility for the line. */
  c: string;
}

const CODE = "text-ink-2";
const STR = "text-syntax-str";
const KEY = "text-syntax-key";

export interface SnippetRequest {
  method: string;
  /** Fully-composed request URL (base + path), variables resolved or not. */
  url: string;
  body: Record<string, unknown> | null;
  isWs: boolean;
}

/** `{ "name": "Ada" }` — compact, one line, for embedding in a string literal. */
function jsonOneLine(body: Record<string, unknown>): string {
  return JSON.stringify(body);
}

/** Pretty entries as `key: value` pairs indented by `pad`, in the given syntax. */
function pairs(
  body: Record<string, unknown>,
  pad: string,
  fmt: (k: string, v: unknown) => string,
): SnippetLine[] {
  const entries = Object.entries(body);
  return entries.map(([k, v], i) => ({
    t: `${pad}${fmt(k, v)}${i === entries.length - 1 ? "" : ","}`,
    c: STR,
  }));
}

/* — HTTP — */

function curl({ method, url, body }: SnippetRequest): SnippetLine[] {
  return [
    { t: `curl -X ${method.toUpperCase()} \\`, c: CODE },
    { t: `  '${url}'${body ? " \\" : ""}`, c: STR },
    ...(body
      ? [
          { t: "  -H 'content-type: application/json' \\", c: CODE },
          { t: `  -d '${jsonOneLine(body)}'`, c: STR },
        ]
      : []),
  ];
}

function javascript({ method, url, body }: SnippetRequest): SnippetLine[] {
  return [
    { t: `const res = await fetch(`, c: CODE },
    { t: `  "${url}",`, c: STR },
    { t: "  {", c: CODE },
    { t: `    method: "${method.toUpperCase()}",`, c: STR },
    ...(body
      ? [
          { t: `    headers: { "content-type": "application/json" },`, c: STR },
          { t: `    body: JSON.stringify(${jsonOneLine(body)}),`, c: STR },
        ]
      : []),
    { t: "  },", c: CODE },
    { t: ")", c: CODE },
  ];
}

function typescript({ method, url, body }: SnippetRequest): SnippetLine[] {
  return [
    { t: `import axios from "axios"`, c: KEY },
    { t: "", c: "" },
    { t: `const res = await axios.${method.toLowerCase()}(`, c: CODE },
    { t: `  "${url}",`, c: STR },
    ...(body
      ? [
          { t: "  {", c: CODE },
          ...pairs(body, "    ", (k, v) => `${k}: ${JSON.stringify(v)}`),
          { t: "  },", c: CODE },
        ]
      : []),
    { t: ")", c: CODE },
  ];
}

function python({ method, url, body }: SnippetRequest): SnippetLine[] {
  return [
    { t: "import requests", c: KEY },
    { t: "", c: "" },
    { t: `res = requests.${method.toLowerCase()}(`, c: CODE },
    { t: `    "${url}",`, c: STR },
    ...(body
      ? [
          { t: "    json={", c: CODE },
          ...pairs(body, "        ", (k, v) => `"${k}": ${JSON.stringify(v)}`),
          { t: "    },", c: CODE },
        ]
      : []),
    { t: ")", c: CODE },
  ];
}

function go({ method, url, body }: SnippetRequest): SnippetLine[] {
  return [
    ...(body ? [{ t: `body := strings.NewReader(\`${jsonOneLine(body)}\`)`, c: STR }] : []),
    {
      t: `req, _ := http.NewRequest("${method.toUpperCase()}", "${url}", ${body ? "body" : "nil"})`,
      c: STR,
    },
    ...(body ? [{ t: `req.Header.Set("content-type", "application/json")`, c: STR }] : []),
    { t: "res, err := http.DefaultClient.Do(req)", c: CODE },
    { t: "defer res.Body.Close()", c: CODE },
  ];
}

function ruby({ method, url, body }: SnippetRequest): SnippetLine[] {
  const verb = method.toLowerCase() === "get" ? "get" : "post";
  return [
    { t: `uri = URI("${url}")`, c: STR },
    ...(body
      ? [
          { t: `res = Net::HTTP.${verb}(`, c: CODE },
          { t: "  uri,", c: CODE },
          { t: `  '${jsonOneLine(body)}',`, c: STR },
          { t: `  "content-type" => "application/json",`, c: STR },
          { t: ")", c: CODE },
        ]
      : [{ t: "res = Net::HTTP.get_response(uri)", c: CODE }]),
  ];
}

function php({ method, url, body }: SnippetRequest): SnippetLine[] {
  return [
    { t: "$client = new GuzzleHttp\\Client();", c: CODE },
    { t: `$res = $client->${method.toLowerCase()}(`, c: CODE },
    { t: `    '${url}'${body ? "," : ""}`, c: STR },
    ...(body
      ? [
          { t: "    ['json' => [", c: CODE },
          ...pairs(body, "        ", (k, v) => `'${k}' => ${JSON.stringify(v)}`),
          { t: "    ]]", c: CODE },
        ]
      : []),
    { t: ");", c: CODE },
  ];
}

function java({ method, url, body }: SnippetRequest): SnippetLine[] {
  const escaped = body ? jsonOneLine(body).replace(/"/g, '\\"') : "";
  return [
    ...(body
      ? [
          { t: "RequestBody body = RequestBody.create(", c: CODE },
          { t: `    "${escaped}",`, c: STR },
          { t: `    MediaType.parse("application/json"));`, c: STR },
        ]
      : []),
    { t: "Request req = new Request.Builder()", c: CODE },
    { t: `    .url("${url}")`, c: STR },
    { t: body ? `    .${method.toLowerCase()}(body)` : "    .get()", c: CODE },
    { t: "    .build();", c: CODE },
    { t: "Response res = client.newCall(req).execute();", c: CODE },
  ];
}

function csharp({ method, url, body }: SnippetRequest): SnippetLine[] {
  const escaped = body ? jsonOneLine(body).replace(/"/g, '\\"') : "";
  const verb = method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
  return [
    { t: "using var client = new HttpClient();", c: CODE },
    ...(body
      ? [
          { t: "var body = new StringContent(", c: CODE },
          { t: `    "${escaped}",`, c: STR },
          { t: `    Encoding.UTF8, "application/json");`, c: STR },
          { t: `var res = await client.${verb}Async("${url}", body);`, c: STR },
        ]
      : [{ t: `var res = await client.GetAsync("${url}");`, c: STR }]),
  ];
}

function rust({ method, url, body }: SnippetRequest): SnippetLine[] {
  return [
    { t: "let res = reqwest::Client::new()", c: CODE },
    { t: `    .${method.toLowerCase()}("${url}")`, c: STR },
    ...(body
      ? [
          { t: "    .json(&serde_json::json!({", c: CODE },
          ...pairs(body, "        ", (k, v) => `"${k}": ${JSON.stringify(v)}`),
          { t: "    }))", c: CODE },
        ]
      : []),
    { t: "    .send()", c: CODE },
    { t: "    .await?;", c: CODE },
  ];
}

/* — WebSocket. Only the languages we can emit a real session for. — */

function curlWs({ url }: SnippetRequest): SnippetLine[] {
  return [
    { t: `wscat -c '${url}'`, c: CODE },
    { t: `> { "ping": 1 }`, c: STR },
    { t: `< { "ping": 1 }`, c: STR },
  ];
}

function jsWs({ url }: SnippetRequest): SnippetLine[] {
  return [
    { t: `const ws = new WebSocket("${url}")`, c: STR },
    { t: "", c: "" },
    { t: "ws.onmessage = (e) => console.log(e.data)", c: CODE },
    { t: `ws.onopen = () => ws.send('{ "ping": 1 }')`, c: STR },
  ];
}

function pythonWs({ url }: SnippetRequest): SnippetLine[] {
  return [
    { t: "from websockets.sync.client import connect", c: KEY },
    { t: "", c: "" },
    { t: `with connect("${url}") as ws:`, c: STR },
    { t: `    ws.send('{ "ping": 1 }')`, c: STR },
    { t: "    print(ws.recv())", c: CODE },
  ];
}

type Generator = (req: SnippetRequest) => SnippetLine[];

const HTTP_GENERATORS: Record<string, Generator> = {
  cURL: curl,
  JavaScript: javascript,
  TypeScript: typescript,
  Python: python,
  Go: go,
  Ruby: ruby,
  PHP: php,
  Java: java,
  "C#": csharp,
  Rust: rust,
};

const WS_GENERATORS: Record<string, Generator> = {
  cURL: curlWs,
  JavaScript: jsWs,
  TypeScript: jsWs,
  Python: pythonWs,
};

/** The client each snippet is written against — different per protocol. */
const HTTP_VARIANTS: Record<string, string> = {
  cURL: "",
  JavaScript: "fetch",
  TypeScript: "axios",
  Python: "requests",
  Go: "net/http",
  Ruby: "net/http",
  PHP: "guzzle",
  Java: "okhttp",
  "C#": "HttpClient",
  Rust: "reqwest",
};

const WS_VARIANTS: Record<string, string> = {
  cURL: "wscat",
  JavaScript: "WebSocket",
  TypeScript: "WebSocket",
  Python: "websockets",
};

export function snippetVariant(lang: string, isWs: boolean): string {
  return (isWs ? WS_VARIANTS : HTTP_VARIANTS)[lang] ?? "";
}

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Join the environment base to a route path — unless the route already carries
 * an absolute URL (external websockets do), in which case the base is not ours
 * to prepend.
 */
export function snippetUrl(base: string, path: string): string {
  return ABSOLUTE_URL.test(path) ? path : `${base}${path}`;
}

/** Languages we can emit a runnable snippet for, given the route's protocol. */
export function snippetLanguages(isWs: boolean): string[] {
  return Object.keys(isWs ? WS_GENERATORS : HTTP_GENERATORS);
}

/** Runnable snippet for `lang`, or null when that language has none. */
export function buildSnippet(lang: string, req: SnippetRequest): SnippetLine[] | null {
  const gen = (req.isWs ? WS_GENERATORS : HTTP_GENERATORS)[lang];
  return gen ? gen(req) : null;
}
