"use server";

import { prisma } from "@stky/db";
import { generateIntegrationApiKey, hashApiKey } from "@stky/security";
import { requireStaffSession } from "@/lib/auth";
import { logStky } from "@/lib/observability";
import { requirePermission } from "@/lib/server/guard";

export type IntegrationKeyRow = {
  id: string;
  name: string | null;
  keyPrefix: string;
  scopes: string[];
  siteId: string | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export async function listIntegrationKeys(): Promise<IntegrationKeyRow[]> {
  await requirePermission("integration:read", { entity: "IntegrationApiKey" });
  return prisma.integrationApiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      siteId: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
}

/** Plain key is returned once; store it securely. Default scope is full access. */
export async function createIntegrationKey(
  name: string | null,
  scopes: string[] | null,
  siteId?: string | null
): Promise<{ plainKey: string; keyPrefix: string }> {
  await requirePermission("integration:create", { entity: "IntegrationApiKey" });
  await requireStaffSession();
  const { plainKey, keyPrefix } = generateIntegrationApiKey();
  const keyHash = hashApiKey(plainKey);
  const scopeList =
    scopes && scopes.length > 0 ? scopes : (["*"] as string[]);

  // A website-form key can only post tickets, and only for the one site it is bound to.
  const isIntake = scopeList.includes("tickets:intake");
  if (isIntake) {
    if (scopeList.length !== 1) {
      throw new Error("A tickets:intake key can't carry any other scope");
    }
    if (!siteId) throw new Error("Choose the site this form key belongs to");
    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
    if (!site) throw new Error("Site not found");
  } else if (siteId) {
    throw new Error("Only tickets:intake keys are bound to a site");
  }

  await prisma.integrationApiKey.create({
    data: {
      name: name?.trim() || null,
      keyPrefix,
      keyHash,
      scopes: scopeList,
      siteId: isIntake ? siteId : null,
    },
  });

  logStky("integration_key_created", { keyPrefix });
  return { plainKey, keyPrefix };
}

export async function revokeIntegrationKey(id: string): Promise<void> {
  await requirePermission("integration:delete", { entity: "IntegrationApiKey", entityId: id });
  await requireStaffSession();
  await prisma.integrationApiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
  logStky("integration_key_revoked", { id });
}

export type KeySiteOption = { id: string; label: string };

/** Sites a tickets:intake key can be bound to. */
export async function listSitesForKeys(): Promise<KeySiteOption[]> {
  await requirePermission("integration:read", { entity: "IntegrationApiKey" });
  const sites = await prisma.site.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      customDomain: true,
      subdomain: true,
      client: { select: { name: true } },
    },
  });
  return sites.map((s) => ({
    id: s.id,
    label: `${s.client.name} · ${s.customDomain ?? s.subdomain ?? s.slug ?? s.id}`,
  }));
}
