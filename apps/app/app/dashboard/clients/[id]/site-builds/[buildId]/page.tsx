import Link from "next/link";
import { notFound } from "next/navigation";
import { getSiteBuildById } from "@/lib/server/actions/site-builds";
import { SiteBuildDetail } from "@/components/crm/site-build-detail";

export default async function SiteBuildDetailPage({
  params,
}: {
  params: Promise<{ id: string; buildId: string }>;
}) {
  const { id: clientId, buildId } = await params;
  const build = await getSiteBuildById(buildId);
  if (!build || build.clientId !== clientId) notFound();

  return (
    <SiteBuildDetail
      build={{
        id: build.id,
        clientId: build.clientId,
        clientName: build.client.name,
        projectName: build.projectName,
        repoName: build.repoName,
        figmaUrl: build.figmaUrl,
        contentMode: build.contentMode,
        sanityProjectId: build.sanityProjectId,
        sanityDataset: build.sanityDataset,
        requiredRoutes: build.requiredRoutes,
        notes: build.notes,
        status: build.status,
        currentStage: build.currentStage,
        createdByName: build.createdBy.name ?? build.createdBy.email,
        createdAt: build.createdAt.toISOString(),
      }}
    />
  );
}
