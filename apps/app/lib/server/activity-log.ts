import { prisma } from "@stky/db";

const SYSTEM_USER_EMAIL = "system@stky.internal";

/**
 * Actor for automated ActivityLog entries (e.g. Xero webhooks), since
 * ActivityLog.actorId is required. Created on first use rather than seeded —
 * the seed also resets the staff password, so it isn't run against production.
 * Not staff and no password, so it can never sign in.
 */
export async function getSystemUserId(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: SYSTEM_USER_EMAIL },
    create: { email: SYSTEM_USER_EMAIL, name: "System", isStaff: false },
    update: {},
    select: { id: true },
  });
  return user.id;
}

export async function logActivity(input: {
  clientId: string;
  type: string;
  body?: string | null;
  actorId: string;
}) {
  return prisma.activityLog.create({
    data: {
      clientId: input.clientId,
      type: input.type,
      body: input.body?.trim() || null,
      actorId: input.actorId,
    },
  });
}
