/**
 * How a project is addressed on the web: `zestman.xyz/<org>/<project>`.
 *
 * `~` is the org for projects that belong to no org — the ones running on this
 * machine. It keeps one routing shape for signed-out and signed-in, and it can
 * never be taken by a real org because it is reserved here.
 */
export const LOCAL_ORG = "~";

/**
 * First path segments the site owns. An org may never be named one of these,
 * and the check has to exist before the first org is created: renaming an org
 * later breaks every link anyone saved.
 */
export const RESERVED_SLUGS = new Set([
  LOCAL_ORG,
  "about",
  "account",
  "admin",
  "api",
  "auth",
  "billing",
  "blog",
  "careers",
  "changelog",
  "contact",
  "dashboard",
  "docs",
  "download",
  "enterprise",
  "events",
  "faq",
  "features",
  "help",
  "home",
  "integrations",
  "internal",
  "invite",
  "join",
  "legal",
  "login",
  "logout",
  "new",
  "news",
  "oauth",
  "onboarding",
  "org",
  "orgs",
  "partners",
  "press",
  "pricing",
  "privacy",
  "profile",
  "public",
  "roadmap",
  "search",
  "security",
  "settings",
  "signin",
  "signup",
  "sitemap",
  "static",
  "status",
  "support",
  "team",
  "teams",
  "terms",
  "trust",
  "user",
  "users",
  "webhooks",
  "well-known",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/** A name as it appears in a URL. Mirrors `projectSlug` in @zestman/core. */
export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "project";
}

/** The path a project lives at. */
export function projectPath(org: string, slug: string): string {
  return `/${encodeURIComponent(org)}/${encodeURIComponent(slug)}`;
}

/** True for the "this machine" org, which needs no account. */
export function isLocalOrg(org: string): boolean {
  return org === LOCAL_ORG;
}
