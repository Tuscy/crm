"use client";

import { useSession } from "next-auth/react";
import { can, type Permission } from "@/lib/permissions";

/**
 * UI hint only (hides buttons the role can't use). The role comes from the
 * JWT, so it can lag a role change until next sign-in; the server re-checks
 * every action against the database regardless.
 */
export function useCan(permission: Permission): boolean {
  const { data } = useSession();
  return can(data?.user?.staffRole, permission);
}
