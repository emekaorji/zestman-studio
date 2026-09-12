import type { Route } from "@/daemon/types";

/**
 * Editor-tab label: path segments after /api/v1 with :param → [param],
 * joined by " · ". The lowercased method is appended when the path has no
 * trailing action segment (matches "users · post", "orders · [id] · get").
 */
export function tabLabel(route: Route): string {
  if (route.protocol === "websocket") {
    const host = route.path.replace(/^wss?:\/\//, "");
    return host.split(".")[0] || "socket";
  }
  const segs = route.path
    .replace(/^\/api\/v1\//, "")
    .replace(/^\//, "")
    .split("/")
    .filter(Boolean)
    .map((s) => (s.startsWith(":") ? `[${s.slice(1)}]` : s));
  if (segs.length === 1 && segs[0] === "health") return "health";
  const last = segs[segs.length - 1];
  const endsWithAction = segs.length > 1 && last != null && !last.startsWith("[");
  const parts = endsWithAction ? segs : [...segs, route.method.toLowerCase()];
  return parts.join(" · ");
}

/** The 9 pm.* snippets in the Scripts panel popover. */
export const SCRIPT_SNIPPETS: Array<{ label: string; code: string }> = [
  { label: "Set an environment variable", code: `pm.environment.set("key", "value")` },
  { label: "Get a variable", code: `const value = pm.environment.get("key")` },
  { label: "Set Authorization header", code: `pm.request.headers.add({ key: "Authorization", value: "Bearer " + pm.environment.get("token") })` },
  { label: "Send a request", code: `pm.sendRequest("{{baseUrl}}/health", (err, res) => {\n  console.log(res.code)\n})` },
  { label: "Test: status is 200", code: `pm.test("status is 200", () => {\n  pm.expect(pm.response.code).to.equal(200)\n})` },
  { label: "Test: response time < 500ms", code: `pm.test("response under 500 ms", () => {\n  pm.expect(pm.response.responseTime).to.be.below(500)\n})` },
  { label: "Test: JSON field equals", code: `pm.test("field equals", () => {\n  pm.expect(pm.response.json().field).to.equal("value")\n})` },
  { label: "Save a value from response", code: `const body = pm.response.json()\npm.environment.set("userId", body.id)` },
  { label: "Log the response body", code: `console.log(pm.response.text())` },
];
