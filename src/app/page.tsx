import Link from "next/link";
import { CONN_KEY, PROJECTS_KEY, UI_KEY } from "@/state/keys";
import { LOCAL_ORG } from "@/lib/slugs";

/**
 * The website. Deliberately thin: the real thing gets designed in Pencil once
 * the product is worth showing.
 *
 * A browser that has already been paired with a daemon goes straight to the
 * app, the way vercel.com sends a signed-in visitor to their dashboard. The
 * check runs in an inline script so it happens before first paint — a redirect
 * in an effect would flash the marketing page at someone who just wanted their
 * project. `?site` (and the link below) opts out for the rest of the tab.
 */
const AUTO_OPEN = `
(function () {
  try {
    var params = new URLSearchParams(location.search);
    if (params.has("site")) { sessionStorage.setItem("zestman:stay-on-site", "1"); return; }
    if (sessionStorage.getItem("zestman:stay-on-site")) return;
    if (!localStorage.getItem(${JSON.stringify(CONN_KEY)})) return;
    var projects = JSON.parse(localStorage.getItem(${JSON.stringify(PROJECTS_KEY)}) || "[]");
    if (!projects.length) return;
    var lastId = (JSON.parse(localStorage.getItem(${JSON.stringify(UI_KEY)}) || "{}") || {}).activeProjectId;
    var open = projects.filter(function (p) { return p && p.slug; });
    var chosen = open.filter(function (p) { return p.id === lastId; })[0] || open[0];
    if (chosen) location.replace("/${LOCAL_ORG}/" + encodeURIComponent(chosen.slug));
  } catch (e) {
    /* a browser with storage blocked just sees the site */
  }
})();
`;

export default function SitePage() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: AUTO_OPEN }} />
      <main className="mx-auto flex h-full max-w-2xl flex-col justify-center gap-6 px-6">
        <div>
          <h1 className="text-lg font-semibold text-ink">Zestman</h1>
          <p className="mt-2 text-base leading-6 text-ink-2">
            An API client and test suite that starts from your running backend. Your app reports its
            own routes, the request schemas it enforces and the responses it really returns — there
            is no collection to maintain.
          </p>
        </div>

        <pre className="rounded-md border border-line bg-sunken p-3 font-mono text-sm text-ink-2">
          pnpm add -D @zestman/express
        </pre>

        <Link href={`/${LOCAL_ORG}`} className="text-base text-link-z hover:underline">
          Open the projects running on this machine →
        </Link>
      </main>
    </>
  );
}
