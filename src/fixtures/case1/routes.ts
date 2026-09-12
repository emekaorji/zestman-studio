import type {
  KVRow,
  RequestBody,
  Route,
  RouteAuth,
  RouteScripts,
  RouteSettings,
  SourceFile,
} from "@/daemon/types";
import type { HttpMethod } from "@/lib/methods";

/* Canonical project: test-backend-case-1 — 27 routes across 35 files. */

let seq = 0;
const rid = () => `r_${(seq += 1).toString(36).padStart(3, "0")}`;
const kv = (key: string, value: string, description = "", enabled = true): KVRow => ({
  id: `kv_${key}_${(seq += 1).toString(36)}`,
  key,
  value,
  description,
  enabled,
});

const CANON_BODY = `{\n  "name": "Ada Lovelace",\n  "email": "ada@example.dev",\n  "role": "member"\n}`;

const defaultBody = (): RequestBody => ({
  mode: "none",
  raw: { language: "json", text: "" },
  formData: [],
  urlencoded: [],
  binary: null,
  graphql: {
    query: `query GetUser($id: ID!) {\n  user(id: $id) {\n    id\n    name\n    email\n    role\n  }\n}`,
    variables: `{\n  "id": "usr_8f3k2"\n}`,
    schemaFetched: true,
    typeCount: 42,
  },
});

const defaultAuth = (inferred?: string): RouteAuth => ({
  mode: inferred ? "bearer" : "none",
  inferredFrom: inferred,
  bearer: { token: "{{token}}" },
  basic: { username: "", password: "" },
  apiKey: { key: "X-API-Key", value: "{{apiKey}}", addTo: "header" },
  digest: { username: "", password: "" },
  oauth2: {
    grantType: "authorization_code",
    authUrl: "https://auth.example.dev/authorize",
    tokenUrl: "https://auth.example.dev/oauth/token",
    clientId: "zst_1a2b3c",
    clientSecret: "••••••••",
    scope: "read write",
    clientAuth: "basic",
    usePkce: true,
    tokenState: { active: true, expiresInMin: 52 },
  },
});

const defaultScripts = (): RouteScripts => ({
  preRequest: "",
  postResponse: `pm.test("status is 201", () => {\n  pm.expect(pm.response.code).to.equal(201)\n})\n\nconst body = pm.response.json()\npm.environment.set("userId", body.id)`,
});

const defaultSettings = (): RouteSettings => ({
  sslVerify: false,
  followRedirects: true,
  followOriginalMethod: false,
  followAuthHeader: false,
  removeRefererOnRedirect: false,
  cookieJar: true,
  timeoutMs: 30000,
  maxRedirects: 5,
  proxyUrl: "",
  clientCertPath: "",
  clientKeyPath: "",
  caCertPath: "",
});

interface RouteSeed {
  method: HttpMethod;
  path: string;
  name: string;
  file: string;
  line: number;
  module: string;
  description?: string;
  schemaRef?: string;
  provenance?: Route["provenance"];
  confidence?: number;
  auth?: boolean;
  bodyJson?: string;
  query?: KVRow[];
  params?: KVRow[];
  docFields?: Route["docFields"];
}

/** Derive body-schema doc rows from a JSON body (the daemon does this from Zod). */
function inferDocFields(bodyJson: string | undefined): Route["docFields"] {
  if (!bodyJson) return [];
  try {
    const parsed: unknown = JSON.parse(bodyJson);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return [];
    return Object.entries(parsed).map(([name, v]) => ({
      name,
      type: v === null ? "null" : Array.isArray(v) ? "array" : typeof v,
      required: true,
    }));
  } catch {
    return [];
  }
}

function makeRoute(s: RouteSeed): Route {
  const id = rid();
  const body = defaultBody();
  if (s.bodyJson) {
    body.mode = "raw";
    body.raw = { language: "json", text: s.bodyJson };
  }
  const hasId = s.path.includes(":id");
  return {
    id,
    method: s.method,
    path: s.path,
    protocol: "http",
    name: s.name,
    description:
      s.description ??
      `${s.name}. Validation runs against the Zod schema before the handler executes.`,
    tags: [s.module],
    provenance: s.provenance ?? "static",
    confidence: s.confidence ?? 0.98,
    sourceLocations: [
      { fileId: `f_${s.file}`, file: `${s.file}:${s.line}`, line: s.line, role: "handler" },
      { fileId: "f_app.ts", file: "app.ts:31", line: 31, role: "mount" },
    ],
    schemaRef: s.schemaRef ?? null,
    docFields: s.docFields ?? inferDocFields(s.bodyJson),
    middleware: s.auth ? ["requireAuth"] : [],
    params: hasId
      ? [kv("id", "usr_8f3k2", "(Required) resource id")]
      : (s.params ?? []),
    query: s.query ?? [],
    headers: [
      kv("Accept", "application/json"),
      kv("Idempotency-Key", "usr-create-8f3k2", "safe to retry"),
    ],
    autoHeaders: [
      { key: "Content-Type", value: "application/json", note: "set for JSON body" },
      { key: "Authorization", value: "Bearer — from environment · Local", note: "auto" },
      { key: "User-Agent", value: "Zestman/0.1.0", note: "" },
    ],
    body,
    auth: defaultAuth(s.auth ? "requireAuth middleware" : undefined),
    scripts: defaultScripts(),
    settings: defaultSettings(),
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 172,
    updatedAt: Date.now() - 1000 * 60 * 2,
  };
}

const seeds: RouteSeed[] = [
  // users.controller.ts — 5
  { method: "GET", path: "/api/v1/users", name: "List users", file: "users.controller.ts", line: 14, module: "users", auth: true },
  {
    method: "POST",
    path: "/api/v1/users",
    name: "Create user",
    file: "users.controller.ts",
    line: 22,
    module: "users",
    description: "Creates a user record. Validation runs against the Zod schema before the handler executes.",
    schemaRef: "users.schema.ts:12",
    auth: true,
    bodyJson: CANON_BODY,
    docFields: [
      { name: "name", type: "string", required: true },
      { name: "email", type: "string", required: true },
      { name: "role", type: "enum", required: false },
    ],
    query: [
      kv("notify", "true", "Send welcome email after create"),
      kv("source", "studio", "Attribution tag"),
    ],
  },
  { method: "GET", path: "/api/v1/users/:id", name: "Get user", file: "users.controller.ts", line: 31, module: "users", auth: true },
  { method: "PATCH", path: "/api/v1/users/:id", name: "Update user", file: "users.controller.ts", line: 40, module: "users", schemaRef: "users.schema.ts:24", auth: true },
  { method: "DELETE", path: "/api/v1/users/:id", name: "Delete user", file: "users.controller.ts", line: 49, module: "users", auth: true },
  // posts.controller.ts — 6
  { method: "GET", path: "/api/v1/posts", name: "List posts", file: "posts.controller.ts", line: 12, module: "posts" },
  { method: "POST", path: "/api/v1/posts", name: "Create post", file: "posts.controller.ts", line: 20, module: "posts", schemaRef: "posts.schema.ts:9", auth: true },
  { method: "GET", path: "/api/v1/posts/:id", name: "Get post", file: "posts.controller.ts", line: 29, module: "posts" },
  { method: "PATCH", path: "/api/v1/posts/:id", name: "Update post", file: "posts.controller.ts", line: 38, module: "posts", auth: true },
  { method: "DELETE", path: "/api/v1/posts/:id", name: "Delete post", file: "posts.controller.ts", line: 47, module: "posts", auth: true },
  { method: "GET", path: "/api/v1/posts/:id/comments", name: "List comments", file: "posts.controller.ts", line: 56, module: "posts" },
  // categories.controller.ts — 5
  { method: "GET", path: "/api/v1/categories", name: "List categories", file: "categories.controller.ts", line: 11, module: "categories" },
  { method: "POST", path: "/api/v1/categories", name: "Create category", file: "categories.controller.ts", line: 19, module: "categories", auth: true },
  { method: "GET", path: "/api/v1/categories/:id", name: "Get category", file: "categories.controller.ts", line: 28, module: "categories" },
  { method: "PATCH", path: "/api/v1/categories/:id", name: "Update category", file: "categories.controller.ts", line: 37, module: "categories", auth: true },
  { method: "DELETE", path: "/api/v1/categories/:id", name: "Delete category", file: "categories.controller.ts", line: 46, module: "categories", auth: true },
  // products.controller.ts — 5
  { method: "GET", path: "/api/v1/products", name: "List products", file: "products.controller.ts", line: 13, module: "products" },
  { method: "GET", path: "/api/v1/products/:id", name: "Get product", file: "products.controller.ts", line: 22, module: "products" },
  { method: "POST", path: "/api/v1/products", name: "Create product", file: "products.controller.ts", line: 31, module: "products", schemaRef: "products.schema.ts:15", auth: true },
  { method: "PATCH", path: "/api/v1/products/:id", name: "Update product", file: "products.controller.ts", line: 40, module: "products", auth: true },
  { method: "DELETE", path: "/api/v1/products/:id", name: "Delete product", file: "products.controller.ts", line: 49, module: "products", auth: true },
  // orders.controller.ts — 5
  { method: "GET", path: "/api/v1/orders", name: "List orders", file: "orders.controller.ts", line: 11, module: "orders", auth: true },
  { method: "POST", path: "/api/v1/orders", name: "Create order", file: "orders.controller.ts", line: 19, module: "orders", schemaRef: "orders.schema.ts:24", auth: true, bodyJson: `{\n  "userId": "usr_8f3k2",\n  "items": [{ "sku": "ZM-401", "qty": 2 }]\n}` },
  { method: "GET", path: "/api/v1/orders/:id", name: "Get order", file: "orders.controller.ts", line: 27, module: "orders", auth: true },
  {
    method: "PATCH",
    path: "/api/v1/orders/:id/status",
    name: "Update order status",
    file: "orders.controller.ts",
    line: 36,
    module: "orders",
    provenance: "inferred",
    confidence: 0.6,
    auth: true,
  },
  {
    method: "POST",
    path: "/api/v1/orders/:id/cancel",
    name: "Cancel order",
    file: "orders.controller.ts",
    line: 46,
    module: "orders",
    description: "Cancels an order and restocks its items. Validation runs against the Zod schema before the handler executes.",
    schemaRef: "orders.schema.ts:24",
    auth: true,
    bodyJson: `{\n  "reason": "customer",\n  "notify": true\n}`,
  },
  // app.ts — 1
  { method: "GET", path: "/health", name: "Health", file: "app.ts", line: 18, module: "app" },
];

export const routes: Route[] = seeds.map(makeRoute);

/* WebSocket demo route */
routes.push({
  ...makeRoute({
    method: "GET",
    path: "wss://echo.websocket.events",
    name: "Echo socket",
    file: "app.ts",
    line: 64,
    module: "app",
    description: "Manual WebSocket session — proxied through the studio (multi-connection capable).",
  }),
  method: "WS",
  protocol: "websocket",
});

const fileOrder = [
  ["users.controller.ts", "users"],
  ["orders.controller.ts", "orders"],
  ["posts.controller.ts", "posts"],
  ["categories.controller.ts", "categories"],
  ["products.controller.ts", "products"],
  ["app.ts", "app"],
] as const;

export const sourceFiles: SourceFile[] = fileOrder.map(([shortName, module]) => ({
  id: `f_${shortName}`,
  path: module === "app" ? `src/${shortName}` : `src/modules/${module}/${shortName}`,
  shortName,
  module,
  routeIds: routes
    .filter((r) => r.sourceLocations[0]?.file.startsWith(shortName))
    .map((r) => r.id),
}));

export const routeByKey = (method: string, path: string): Route | undefined =>
  routes.find((r) => r.method === method && r.path === path);

export const CANON = {
  createUser: routeByKey("POST", "/api/v1/users")!,
  cancelOrder: routeByKey("POST", "/api/v1/orders/:id/cancel")!,
  statusOrder: routeByKey("PATCH", "/api/v1/orders/:id/status")!,
  listProducts: routeByKey("GET", "/api/v1/products")!,
  ws: routes.find((r) => r.protocol === "websocket")!,
};
