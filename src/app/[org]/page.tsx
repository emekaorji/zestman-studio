import { notFound } from "next/navigation";
import { StudioMount } from "@/studio/StudioMount";
import { isLocalOrg, isReservedSlug } from "@/lib/slugs";

export const metadata = { title: "Projects", robots: { index: false, follow: false } };

/**
 * `/<org>` with no project: the studio connects and corrects the URL to
 * whichever project opened. Only `~` exists until accounts do — a real org
 * slug here would be a promise we cannot keep yet.
 */
export default async function OrgPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const decoded = decodeURIComponent(org);
  if (!isLocalOrg(decoded) || (isReservedSlug(decoded) && !isLocalOrg(decoded))) notFound();
  return <StudioMount org={decoded} projectSlug={null} />;
}
