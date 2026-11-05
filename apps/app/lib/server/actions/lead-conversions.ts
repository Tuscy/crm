"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@stky/db";
import type { PackageType } from "@stky/db";
import { requirePermission } from "@/lib/server/guard";

export type LeadConversionInput = {
  package?: PackageType | null;
  purchaseDate?: Date | null;
  agreedDetails?: string | null;
};

export async function getLeadConversion(leadId: string) {
  return prisma.leadConversion.findUnique({
    where: { leadId },
  });
}

export async function upsertLeadConversion(
  leadId: string,
  data: LeadConversionInput
) {
  await requirePermission("lead:update", { entity: "Lead" });
  const conversion = await prisma.leadConversion.upsert({
    where: { leadId },
    create: {
      leadId,
      package: data.package ?? null,
      purchaseDate: data.purchaseDate ?? null,
      agreedDetails: data.agreedDetails ?? null,
    },
    update: {
      ...(data.package !== undefined && { package: data.package }),
      ...(data.purchaseDate !== undefined && { purchaseDate: data.purchaseDate }),
      ...(data.agreedDetails !== undefined && { agreedDetails: data.agreedDetails }),
    },
  });

  revalidatePath(`/dashboard/leads/${leadId}`);

  // Future: auto-create Client record when conversion is saved with required fields.

  return conversion;
}
