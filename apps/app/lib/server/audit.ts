import { prisma } from "@stky/db";
import type { Prisma } from "@stky/db";

export type AuditActor = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
};

export type AuditInput = {
  actor?: AuditActor | null;
  action: string; // "<entity>.<verb>", e.g. "lead.delete"
  entity?: string;
  entityId?: string | null;
  outcome?: "ALLOWED" | "DENIED";
  metadata?: Record<string, unknown>;
};

/**
 * Record an audit entry. Never throws: auditing must not break the action
 * being audited (failures are logged to the server console instead).
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actor?.id ?? null,
        actorEmail: input.actor?.email ?? null,
        actorRole: input.actor?.role ?? null,
        action: input.action,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        outcome: input.outcome ?? "ALLOWED",
        metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });
  } catch (error) {
    console.error("audit log write failed:", input.action, error);
  }
}
