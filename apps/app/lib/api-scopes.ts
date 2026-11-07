/**
 * Scopes for IntegrationApiKey.scopes. Use "*" for full access.
 */
export const ApiScope = {
  LEADS_READ: "leads:read",
  LEADS_WRITE: "leads:write",
  LEADS_DELETE: "leads:delete",
  DEALS_WRITE: "deals:write",
  ANALYTICS_READ: "analytics:read",
  GOOGLE_ADS_READ: "google-ads:read",
  GOOGLE_ADS_WRITE: "google-ads:write",
  GBP_READ: "gbp:read",
  TASKS_READ: "tasks:read",
  TASKS_WRITE: "tasks:write",
  TASKS_DELETE: "tasks:delete",
  TICKETS_READ: "tickets:read",
  TICKETS_WRITE: "tickets:write",
  TICKETS_AGENT: "tickets:agent",
  TICKETS_INTAKE: "tickets:intake",
} as const;

export type ApiScopeName = (typeof ApiScope)[keyof typeof ApiScope];

export function scopeAllows(scopes: string[], required: string): boolean {
  if (scopes.includes("*")) return true;
  if (scopes.length === 0) return true;
  return scopes.includes(required);
}

/**
 * Strict variant for tickets: the exact scope must be listed. An empty list or
 * "*" does NOT grant ticket access, so a broad key can never touch tickets by accident.
 */
export function scopeAllowsStrict(scopes: string[], required: string): boolean {
  return scopes.includes(required);
}
