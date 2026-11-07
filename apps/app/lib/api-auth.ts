import type { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { auth } from "@/auth";
import { prisma } from "@stky/db";
import { logStky } from "@/lib/observability";
import { hashApiKey } from "@stky/security";
import { scopeAllows, scopeAllowsStrict, type ApiScopeName } from "@/lib/api-scopes";
import { can, type Permission } from "@/lib/permissions";
import { audit } from "@/lib/server/audit";
import { getStaffUser, toActor } from "@/lib/server/guard";

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  const xKey = request.headers.get("x-api-key");
  return bearer || xKey || null;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Allows automation (scoped integration key, legacy CRM_API_KEY) or staff session.
 */
export async function requireAutomationAuth(
  request: NextRequest,
  context: string,
  requiredScope?: ApiScopeName,
  /** Staff-session callers must also hold this permission. Integration keys are governed by scopes instead. */
  permission?: Permission
): Promise<boolean> {
  const token = extractToken(request);
  const legacyEnvKey = process.env.CRM_API_KEY;

  if (token) {
    const keyHash = hashApiKey(token);
    const record = await prisma.integrationApiKey.findUnique({
      where: { keyHash },
    });

    if (record && !record.revokedAt) {
      if (
        requiredScope &&
        !scopeAllows(record.scopes, requiredScope)
      ) {
        logStky("api_forbidden", { context, reason: "scope", scope: requiredScope });
        return false;
      }
      void prisma.integrationApiKey
        .update({
          where: { id: record.id },
          data: { lastUsedAt: new Date() },
        })
        .catch(() => {});
      return true;
    }

    if (legacyEnvKey && timingSafeEqualStr(token, legacyEnvKey)) {
      return true;
    }
  }

  const session = await auth();
  if (session?.user?.isStaff) {
    if (!permission) return true;
    const staff = await getStaffUser();
    if (staff && can(staff.role, permission)) {
      if (!permission.endsWith(":read")) {
        await audit({ actor: toActor(staff), action: permission, metadata: { context } });
      }
      return true;
    }
    await audit({
      actor: toActor(staff),
      action: permission,
      outcome: "DENIED",
      metadata: { context },
    });
    logStky("api_forbidden", { context, reason: "permission", permission });
    return false;
  }

  logStky("api_unauthorized", { context });
  return false;
}

export type TicketCaller =
  | { kind: "key"; keyId: string; name: string | null; scopes: string[]; siteId: string | null; clientId: string | null }
  | { kind: "staff"; staff: NonNullable<Awaited<ReturnType<typeof getStaffUser>>> };

/**
 * Auth for ticket routes. Unlike requireAutomationAuth it:
 *  - returns who called (key record or staff user),
 *  - requires the exact scope (no empty-scope or "*" wildcard),
 *  - never accepts the legacy CRM_API_KEY.
 * A staff session must hold `permission`. Returns null when not allowed.
 */
export async function requireTicketAuth(
  request: NextRequest,
  context: string,
  acceptedScopes: ApiScopeName[],
  permission: Permission
): Promise<TicketCaller | null> {
  const token = extractToken(request);

  if (token) {
    const record = await prisma.integrationApiKey.findUnique({
      where: { keyHash: hashApiKey(token) },
      include: { site: { select: { clientId: true } } },
    });
    if (record && !record.revokedAt) {
      const ok = acceptedScopes.some((s) => scopeAllowsStrict(record.scopes, s));
      if (!ok) {
        logStky("api_forbidden", { context, reason: "scope", keyId: record.id });
        return null;
      }
      void prisma.integrationApiKey
        .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
        .catch(() => {});
      return {
        kind: "key",
        keyId: record.id,
        name: record.name,
        scopes: record.scopes,
        siteId: record.siteId,
        clientId: record.site?.clientId ?? null,
      };
    }
    // An unknown token falls through to the session check, never to CRM_API_KEY.
  }

  const session = await auth();
  if (session?.user?.isStaff) {
    const staff = await getStaffUser();
    if (staff && can(staff.role, permission)) {
      if (!permission.endsWith(":read")) {
        await audit({ actor: toActor(staff), action: permission, metadata: { context } });
      }
      return { kind: "staff", staff };
    }
    await audit({ actor: toActor(staff), action: permission, outcome: "DENIED", metadata: { context } });
    logStky("api_forbidden", { context, reason: "permission", permission });
    return null;
  }

  logStky("api_unauthorized", { context });
  return null;
}
