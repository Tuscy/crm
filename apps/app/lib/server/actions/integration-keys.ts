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
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
}

/** Plain key is returned once; store it securely. Default scope is full access. */
export async function createIntegrationKey(
  name: string | null,
  scopes: string[] | null
): Promise<{ plainKey: string; keyPrefix: string }> {
  await requirePermission("integration:create", { entity: "IntegrationApiKey" });
  await requireStaffSession();
  const { plainKey, keyPrefix } = generateIntegrationApiKey();
  const keyHash = hashApiKey(plainKey);
  const scopeList =
    scopes && scopes.length > 0 ? scopes : (["*"] as string[]);

  await prisma.integrationApiKey.create({
    data: {
      name: name?.trim() || null,
      keyPrefix,
      keyHash,
      scopes: scopeList,
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
