"use server";

import { prisma } from "@stky/db";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/server/guard";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content.trim()).digest("hex");
}

export async function createGBPDraft(clientId: string, content: string) {
  await requirePermission("gbp:create", { entity: "GBPDraft" });
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const draft = await prisma.gBPDraft.create({
    data: {
      clientId,
      content: content.trim(),
      createdById: session.user.id,
      status: "DRAFT",
    },
  });

  revalidatePath(`/dashboard/business-profile`);
  return draft;
}

export async function updateGBPDraft(id: string, content: string) {
  await requirePermission("gbp:create", { entity: "GBPDraft", entityId: id });
  
  const existing = await prisma.gBPDraft.findUnique({ where: { id } });
  if (!existing) throw new Error("Draft not found");

  // If approved, editing invalidates approval
  const wasApproved = existing.status === "APPROVED";

  const draft = await prisma.gBPDraft.update({
    where: { id },
    data: {
      content: content.trim(),
      ...(wasApproved && {
        status: "DRAFT",
        approvedById: null,
        approvedAt: null,
        contentHash: null,
      }),
      updatedAt: new Date(),
    },
  });

  revalidatePath(`/dashboard/business-profile`);
  return { draft, approvalInvalidated: wasApproved };
}

export async function approveGBPDraft(id: string) {
  await requirePermission("gbp:create", { entity: "GBPDraft", entityId: id });
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const existing = await prisma.gBPDraft.findUnique({ where: { id } });
  if (!existing) throw new Error("Draft not found");
  if (existing.status !== "DRAFT") throw new Error("Only DRAFT status can be approved");

  const contentHash = hashContent(existing.content);

  const draft = await prisma.gBPDraft.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedById: session.user.id,
      approvedAt: new Date(),
      contentHash,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  revalidatePath(`/dashboard/business-profile`);
  return draft;
}

export async function mockPostGBPDraft(id: string) {
  await requirePermission("gbp:create", { entity: "GBPDraft", entityId: id });
  
  const existing = await prisma.gBPDraft.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!existing) throw new Error("Draft not found");
  if (existing.status !== "APPROVED") {
    throw new Error("Only APPROVED drafts can be posted");
  }

  // Verify content hasn't changed since approval
  const currentHash = hashContent(existing.content);
  if (existing.contentHash && currentHash !== existing.contentHash) {
    throw new Error("Content changed since approval. Re-approval required.");
  }

  // MOCK POSTING - no actual Google API call
  const draft = await prisma.gBPDraft.update({
    where: { id },
    data: { status: "POSTED_MOCK" },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  revalidatePath(`/dashboard/business-profile`);
  return draft;
}

export async function getGBPDrafts(clientId?: string) {
  const where = clientId ? { clientId } : {};
  
  return prisma.gBPDraft.findMany({
    where,
    include: {
      client: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function deleteGBPDraft(id: string) {
  await requirePermission("gbp:delete", { entity: "GBPDraft", entityId: id });
  
  await prisma.gBPDraft.delete({ where: { id } });
  revalidatePath(`/dashboard/business-profile`);
}
