"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@stky/db";
import type { Prisma } from "@stky/db";
import { isValidLeadStatus } from "@stky/crm";
import { notifyLeadCreated } from "@/lib/crm/webhook-events";
import { enrolMatchingFlows } from "@/lib/email-flows/trigger";
import { requirePermission } from "@/lib/server/guard";

export type CreateLeadInput = {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  website?: string;
  source?: string;
  status?: string;
  ownerId?: string;
  nextAction?: string;
  followUpDate?: Date;
};

export type UpdateLeadInput = {
  name?: string;
  email?: string;
  phone?: string | null;
  company?: string;
  website?: string;
  source?: string;
  status?: string;
  ownerId?: string | null;
  nextAction?: string | null;
  followUpDate?: Date | null;
};

export async function createLead(data: CreateLeadInput) {
  await requirePermission("lead:create", { entity: "Lead" });
  const status = data.status ?? "NEW";
  if (!isValidLeadStatus(status)) {
    throw new Error("Invalid lead status");
  }
  const lead = await prisma.lead.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone?.trim() || undefined,
      company: data.company,
      website: data.website,
      source: data.source,
      status,
      ownerId: data.ownerId,
      nextAction: data.nextAction?.trim() || undefined,
      followUpDate: data.followUpDate,
    },
    include: { deals: true },
  });
  await notifyLeadCreated(lead);
  await enrolMatchingFlows("LEAD_CREATED", { leadId: lead.id });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/pipeline");
  return lead;
}

export async function getLeads(filters?: {
  status?: string;
  source?: string;
  q?: string;
}) {
  const where: Prisma.LeadWhereInput = {
    ...(filters?.status && { status: filters.status }),
    ...(filters?.source && { source: filters.source }),
    ...(filters?.q?.trim() && {
      OR: [
        { name: { contains: filters.q.trim(), mode: "insensitive" } },
        { email: { contains: filters.q.trim(), mode: "insensitive" } },
        { phone: { contains: filters.q.trim(), mode: "insensitive" } },
        {
          company: { contains: filters.q.trim(), mode: "insensitive" },
        },
      ],
    }),
  };

  return prisma.lead.findMany({
    where,
    include: {
      deals: true,
      _count: { select: { tasks: true, notes: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getLeadById(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      deals: true,
      tasks: { include: { assignee: true } },
      notes: true,
      owner: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function updateLead(id: string, data: UpdateLeadInput) {
  await requirePermission("lead:update", { entity: "Lead", entityId: id });
  if (data.status !== undefined && !isValidLeadStatus(data.status)) {
    throw new Error("Invalid lead status");
  }
  const previous =
    data.status !== undefined
      ? await prisma.lead.findUnique({
          where: { id },
          select: { status: true },
        })
      : null;
  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.company !== undefined && { company: data.company }),
      ...(data.website !== undefined && { website: data.website }),
      ...(data.source !== undefined && { source: data.source }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.ownerId !== undefined && { ownerId: data.ownerId }),
      ...(data.nextAction !== undefined && {
        nextAction: data.nextAction?.trim() || null,
      }),
      ...(data.followUpDate !== undefined && { followUpDate: data.followUpDate }),
    },
    include: { deals: true, tasks: true, notes: true },
  });
  if (
    data.status !== undefined &&
    previous &&
    previous.status !== lead.status
  ) {
    await enrolMatchingFlows(
      "LEAD_STATUS_CHANGED",
      { leadId: lead.id },
      { status: lead.status }
    );
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/leads/" + id);
  revalidatePath("/dashboard/pipeline");
  return lead;
}

export async function deleteLead(id: string) {
  await requirePermission("lead:delete", { entity: "Lead", entityId: id });
  await prisma.lead.delete({ where: { id } });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/pipeline");
}
