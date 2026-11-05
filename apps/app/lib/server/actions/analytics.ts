"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@stky/db";
import { encrypt } from "@/lib/server/encrypt";
import { requirePermission } from "@/lib/server/guard";

async function requireStaff() {
  const session = await auth();
  if (!session?.user?.isStaff) throw new Error("Unauthorized");
  return session;
}

export type AnalyticsCredentialDto = {
  id: string;
  clientId: string | null;
  clientName: string | null;
  type: "GA4" | "SEARCH_CONSOLE" | "GBP";
  accountId: string;
  createdAt: string;
  updatedAt: string;
};

export async function listAnalyticsCredentials(): Promise<
  AnalyticsCredentialDto[]
> {
  await requireStaff();
  const rows = await prisma.analyticsCredential.findMany({
    include: { client: { select: { name: true } } },
    orderBy: [{ clientId: "asc" }, { type: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    clientName: r.client?.name ?? null,
    type: r.type,
    accountId: r.accountId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function saveAnalyticsCredential(input: {
  clientId?: string | null;
  type: "GA4" | "SEARCH_CONSOLE" | "GBP";
  accountId: string;
  refreshToken: string; // plain — encrypted here before storage
}) {
  await requirePermission("integration:update", { entity: "AnalyticsCredential" });
  await requireStaff();
  const clientId = input.clientId?.trim() || null;
  const accountId = input.accountId.trim();
  const encryptedToken = encrypt(input.refreshToken);

  // Cannot use upsert with a nullable field in a composite unique key
  // (PostgreSQL treats NULLs as distinct, so the constraint isn't enforced for null).
  // Use explicit find-then-create/update instead.
  const existing = await prisma.analyticsCredential.findFirst({
    where: { clientId, type: input.type },
  });

  if (existing) {
    await prisma.analyticsCredential.update({
      where: { id: existing.id },
      data: { accountId, refreshToken: encryptedToken },
    });
  } else {
    await prisma.analyticsCredential.create({
      data: {
        clientId,
        type: input.type,
        accountId,
        refreshToken: encryptedToken,
      },
    });
  }

  revalidatePath("/dashboard/settings/analytics");
  revalidatePath("/dashboard/reporting");
}

export async function deleteAnalyticsCredential(id: string) {
  await requirePermission("integration:delete", { entity: "AnalyticsCredential", entityId: id });
  await requireStaff();
  await prisma.analyticsCredential.delete({ where: { id } });
  revalidatePath("/dashboard/settings/analytics");
  revalidatePath("/dashboard/reporting");
}
