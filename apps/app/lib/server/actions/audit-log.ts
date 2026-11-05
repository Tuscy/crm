"use server";

import { prisma } from "@stky/db";
import { requirePermission } from "@/lib/server/guard";

export type AuditLogRow = {
  id: string;
  createdAt: Date;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  outcome: string;
  metadata: unknown;
};

export async function listAuditLog(opts?: {
  outcome?: "ALLOWED" | "DENIED";
  action?: string;
  take?: number;
}): Promise<AuditLogRow[]> {
  await requirePermission("audit:read", { entity: "AuditLog" });
  return prisma.auditLog.findMany({
    where: {
      ...(opts?.outcome ? { outcome: opts.outcome } : {}),
      ...(opts?.action ? { action: { contains: opts.action } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(opts?.take ?? 200, 500),
    select: {
      id: true,
      createdAt: true,
      actorEmail: true,
      actorRole: true,
      action: true,
      entity: true,
      entityId: true,
      outcome: true,
      metadata: true,
    },
  });
}
