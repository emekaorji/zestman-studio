import { notFound } from "next/navigation";
import { StudioMount } from "@/studio/StudioMount";
import { isLocalOrg, isReservedSlug } from "@/lib/slugs";

export const metadata = { robots: { index: false, follow: false } };

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ org: string; project: string }>;
}) {
  const { org, project } = await params;
  const decodedOrg = decodeURIComponent(org);
  if (!isLocalOrg(decodedOrg) || isReservedSlug(decodeURIComponent(project))) notFound();
  return <StudioMount org={decodedOrg} projectSlug={decodeURIComponent(project)} />;
}
