"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@stky/db";
import { auth } from "@/auth";
import { normalizeCustomerId } from "@/lib/google-ads/format";
import { fetchAccountDisplayName } from "@/lib/google-ads/dashboard";
import { clearDashboardCache } from "@/lib/google-ads/cache";
import type { GoogleAdsConnectionDto } from "@/lib/google-ads/types";
import { requirePermission } from "@/lib/server/guard";

async function requireStaff() {
  const session = await auth();
  if (!session?.user?.isStaff) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function getGoogleAdsSettings() {
  await requireStaff();
  const settings = await prisma.googleAdsSettings.findUnique({
    where: { id: "default" },
  });
  return settings;
}

export async function saveGoogleAdsSettings(loginCustomerId: string) {
  await requirePermission("integration:update", { entity: "GoogleAdsSettings" });
  await requireStaff();
  const normalized = normalizeCustomerId(loginCustomerId);
  if (normalized.length < 10) {
    throw new Error("Manager customer ID must be at least 10 digits");
  }
  await prisma.googleAdsSettings.upsert({
    where: { id: "default" },
    create: { id: "default", loginCustomerId: normalized },
    update: { loginCustomerId: normalized },
  });
  revalidatePath("/dashboard/google-ads");
  revalidatePath("/dashboard/google-ads/settings");
}

export async function listGoogleAdsConnections(): Promise<
  GoogleAdsConnectionDto[]
> {
  await requireStaff();
  const rows = await prisma.googleAdsConnection.findMany({
    include: { client: { select: { id: true, name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    clientName: r.client?.name ?? null,
    googleAdsCustomerId: r.googleAdsCustomerId,
    label: r.label,
    displayName: r.displayName,
    lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
  }));
}

export async function upsertGoogleAdsConnection(input: {
  googleAdsCustomerId: string;
  clientId?: string | null;
  label?: string | null;
}) {
  await requirePermission("integration:update", { entity: "GoogleAdsConnection" });
  await requireStaff();
  const googleAdsCustomerId = normalizeCustomerId(input.googleAdsCustomerId);
  if (googleAdsCustomerId.length < 10) {
    throw new Error("Ads customer ID must be at least 10 digits");
  }
  const displayName = await fetchAccountDisplayName(googleAdsCustomerId);
  const clientId = input.clientId?.trim() || null;

  await prisma.googleAdsConnection.upsert({
    where: { googleAdsCustomerId },
    create: {
      googleAdsCustomerId,
      clientId,
      label: input.label?.trim() || null,
      displayName,
    },
    update: {
      clientId,
      label: input.label?.trim() || null,
      ...(displayName ? { displayName } : {}),
    },
  });
  clearDashboardCache(googleAdsCustomerId);
  revalidatePath("/dashboard/google-ads");
  revalidatePath("/dashboard/google-ads/settings");
}

export async function deleteGoogleAdsConnection(id: string) {
  await requirePermission("integration:delete", { entity: "GoogleAdsConnection", entityId: id });
  await requireStaff();
  const row = await prisma.googleAdsConnection.delete({ where: { id } });
  clearDashboardCache(row.googleAdsCustomerId);
  revalidatePath("/dashboard/google-ads");
  revalidatePath("/dashboard/google-ads/settings");
}

export async function syncConnectionDisplayNames() {
  await requirePermission("integration:update", { entity: "GoogleAdsConnection" });
  await requireStaff();
  const rows = await prisma.googleAdsConnection.findMany();
  for (const row of rows) {
    const name = await fetchAccountDisplayName(row.googleAdsCustomerId);
    if (name) {
      await prisma.googleAdsConnection.update({
        where: { id: row.id },
        data: { displayName: name },
      });
    }
  }
  revalidatePath("/dashboard/google-ads/settings");
}
