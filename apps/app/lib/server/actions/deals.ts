"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@stky/db";
import { isValidDealStage } from "@stky/crm";
import {
  notifyDealCreated,
  notifyDealUpdated,
} from "@/lib/crm/webhook-events";
import { enrolMatchingFlows } from "@/lib/email-flows/trigger";
import { requirePermission } from "@/lib/server/guard";

export async function getDealsByStage() {
  const deals = await prisma.deal.findMany({
    include: { lead: true },
    orderBy: { createdAt: "desc" },
  });
  return deals;
}

export async function updateDealStage(dealId: string, stage: string) {
  await requirePermission("deal:update", { entity: "Deal", entityId: dealId });
  if (!isValidDealStage(stage)) {
    throw new Error("Invalid deal stage");
  }
  const existing = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { lead: true },
  });
  if (!existing) {
    throw new Error("Deal not found");
  }
  const deal = await prisma.deal.update({
    where: { id: dealId },
    data: { stage },
    include: { lead: true },
  });
  await notifyDealUpdated(deal, existing.stage);
  if (existing.stage !== deal.stage) {
    await enrolMatchingFlows(
      "DEAL_STAGE_CHANGED",
      { leadId: deal.leadId },
      { stage: deal.stage }
    );
  }
  revalidatePath("/dashboard/pipeline");
  revalidatePath("/dashboard");
  return deal;
}

export async function createDeal(
  leadId: string,
  stage: string,
  value?: number,
  opts?: {
    closeDate?: Date;
    probability?: number;
    packageType?: "VOLTAGE" | "CHARGE" | "GRID";
  }
) {
  await requirePermission("deal:create", { entity: "Deal" });
  if (!isValidDealStage(stage)) {
    throw new Error("Invalid deal stage");
  }
  let probability = opts?.probability;
  if (probability != null) {
    probability = Math.min(100, Math.max(0, Math.round(probability)));
  }
  const deal = await prisma.deal.create({
    data: {
      leadId,
      stage,
      value,
      closeDate: opts?.closeDate,
      probability,
      packageType: opts?.packageType,
    },
    include: { lead: true },
  });
  await notifyDealCreated(deal);
  await enrolMatchingFlows("DEAL_CREATED", { leadId: deal.leadId });
  revalidatePath("/dashboard/pipeline");
  revalidatePath("/dashboard");
  return deal;
}
