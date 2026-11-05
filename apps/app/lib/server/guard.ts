import { prisma } from "@stky/db";
import { auth } from "@/auth";
import { can, isStaffRole, type Permission, type StaffRole } from "@/lib/permissions";
import { audit, type AuditActor } from "@/lib/server/audit";

export type StaffUser = {
  id: string;
  email: string;
  role: StaffRole;
};

/**
 * Resolve the signed-in staff user. The role is read from the database on
 * every call (not trusted from the JWT) so a demotion or revocation takes
 * effect immediately rather than when the 7-day token expires.
 */
export async function getStaffUser(): Promise<StaffUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id || !session?.user?.isStaff) return null;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, isStaff: true, staffRole: true },
  });
  if (!user?.isStaff || !isStaffRole(user.staffRole)) return null;
  return { id: user.id, email: user.email, role: user.staffRole };
}

export function toActor(user: StaffUser | null): AuditActor | null {
  return user ? { id: user.id, email: user.email, role: user.role } : null;
}

/**
 * Require a signed-in staff user holding `permission`. Throws "Unauthorized"
 * (not signed in) or "Forbidden" (signed in, role lacks permission). Denied
 * attempts are written to the audit log.
 */
export async function requirePermission(
  permission: Permission,
  target?: { entity?: string; entityId?: string | null }
): Promise<StaffUser> {
  const user = await getStaffUser();
  if (!user) throw new Error("Unauthorized");
  if (!can(user.role, permission)) {
    await audit({
      actor: toActor(user),
      action: permission,
      entity: target?.entity,
      entityId: target?.entityId,
      outcome: "DENIED",
    });
    throw new Error("Forbidden");
  }
  // Every permitted write is recorded ("ALLOWED" = authorised at the guard;
  // the action itself may still fail validation afterwards). Reads aren't logged.
  if (!permission.endsWith(":read")) {
    await audit({
      actor: toActor(user),
      action: permission,
      entity: target?.entity,
      entityId: target?.entityId,
      outcome: "ALLOWED",
    });
  }
  return user;
}

/** Non-throwing variant for UI gating (hide buttons / pages). */
export async function currentStaffCan(permission: Permission): Promise<boolean> {
  const user = await getStaffUser();
  return !!user && can(user.role, permission);
}

/**
 * Route-handler variant: returns a 401/403 Response to return early, or null
 * when the caller is a staff user holding `permission`.
 */
export async function denyUnlessCan(
  permission: Permission,
  target?: { entity?: string; entityId?: string | null }
): Promise<Response | null> {
  try {
    await requirePermission(permission, target);
    return null;
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "Forbidden";
    return Response.json(
      { error: forbidden ? "Forbidden" : "Staff session required" },
      { status: forbidden ? 403 : 401 }
    );
  }
}
