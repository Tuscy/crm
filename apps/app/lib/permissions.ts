/**
 * Staff permission model. Pure (no server imports) so it can be used from
 * client components, middleware and server code alike.
 *
 * Roles are fixed tiers:
 *   ADMIN  — everything, including deletes, integrations, users and the audit log
 *   EDITOR — read + create + update on business data; no deletes, no admin areas
 *   VIEWER — read only
 */
export const STAFF_ROLES = ["ADMIN", "EDITOR", "VIEWER"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_LABELS: Record<StaffRole, string> = {
  ADMIN: "Admin — full access, including delete",
  EDITOR: "Editor — view, add and edit, no delete",
  VIEWER: "Viewer — read only",
};

const BUSINESS_RESOURCES = [
  "lead",
  "contact",
  "deal",
  "task",
  "client",
  "site",
  "siteBuild",
  "emailFlow",
  "emailTemplate",
  "gbp",
  "ticket",
] as const;

/** Areas only admins may touch at all (credentials, connections, people, logs). */
const ADMIN_ONLY_RESOURCES = [
  "integration", // API keys, Xero connection, Google Ads connections, analytics credentials
  "user",
  "audit",
] as const;

export type Resource =
  | (typeof BUSINESS_RESOURCES)[number]
  | (typeof ADMIN_ONLY_RESOURCES)[number];
export type Action = "read" | "create" | "update" | "delete";
export type Permission = `${Resource}:${Action}`;

function build(
  resources: readonly Resource[],
  actions: readonly Action[]
): Permission[] {
  return resources.flatMap((r) => actions.map((a) => `${r}:${a}` as Permission));
}

const ROLE_PERMISSIONS: Record<StaffRole, ReadonlySet<Permission>> = {
  ADMIN: new Set(
    build(
      [...BUSINESS_RESOURCES, ...ADMIN_ONLY_RESOURCES],
      ["read", "create", "update", "delete"]
    )
  ),
  EDITOR: new Set(build(BUSINESS_RESOURCES, ["read", "create", "update"])),
  VIEWER: new Set(build(BUSINESS_RESOURCES, ["read"])),
};

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value);
}

/** Unknown/missing roles get no permissions (fail closed). */
export function can(
  role: string | null | undefined,
  permission: Permission
): boolean {
  if (!isStaffRole(role)) return false;
  return ROLE_PERMISSIONS[role].has(permission);
}
