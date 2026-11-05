"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@stky/db";
import { requirePermission } from "@/lib/server/guard";

async function requireStaffId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id || !session.user.isStaff) {
    throw new Error("Staff session required");
  }
  return session.user.id;
}

export type CreateSiteBuildInput = {
  projectName: string;
  repoName?: string;
  figmaUrl?: string;
  contentMode?: "LOCAL" | "SANITY";
  sanityProjectId?: string;
  sanityDataset?: string;
  requiredRoutes?: string;
  notes?: string;
};

export async function createSiteBuild(
  clientId: string,
  input: CreateSiteBuildInput
) {
  await requirePermission("siteBuild:create", { entity: "SiteBuild" });
  const createdById = await requireStaffId();

  if (!input.projectName?.trim()) {
    throw new Error("Project name is required");
  }

  const build = await prisma.siteBuild.create({
    data: {
      clientId,
      projectName: input.projectName.trim(),
      repoName: input.repoName?.trim() || null,
      figmaUrl: input.figmaUrl?.trim() || null,
      contentMode: input.contentMode ?? "LOCAL",
      sanityProjectId: input.sanityProjectId?.trim() || null,
      sanityDataset: input.sanityDataset?.trim() || null,
      requiredRoutes: input.requiredRoutes?.trim() || null,
      notes: input.notes?.trim() || null,
      createdById,
    },
    include: { createdBy: true },
  });

  revalidatePath(`/dashboard/clients/${clientId}`);
  return build;
}

export async function listSiteBuilds(clientId: string) {
  return prisma.siteBuild.findMany({
    where: { clientId },
    include: { createdBy: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSiteBuildById(id: string) {
  return prisma.siteBuild.findUnique({
    where: { id },
    include: {
      client: true,
      createdBy: true,
    },
  });
}

export async function updateSiteBuildStage(id: string, stage: number) {
  await requirePermission("siteBuild:update", { entity: "SiteBuild", entityId: id });
  await requireStaffId();

  if (stage < 0 || stage > 5) throw new Error("Stage must be 0–5");

  const build = await prisma.siteBuild.update({
    where: { id },
    data: { currentStage: stage },
  });

  revalidatePath(`/dashboard/clients/${build.clientId}`);
  revalidatePath(`/dashboard/clients/${build.clientId}/site-builds/${id}`);
  return build;
}

export async function updateSiteBuildStatus(
  id: string,
  status: "DRAFT" | "IN_PROGRESS" | "COMPLETE" | "PAUSED"
) {
  await requirePermission("siteBuild:update", { entity: "SiteBuild", entityId: id });
  await requireStaffId();

  const build = await prisma.siteBuild.update({
    where: { id },
    data: { status },
  });

  revalidatePath(`/dashboard/clients/${build.clientId}`);
  revalidatePath(`/dashboard/clients/${build.clientId}/site-builds/${id}`);
  return build;
}
