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
} as const;

export type ApiScopeName = (typeof ApiScope)[keyof typeof ApiScope];

export function scopeAllows(scopes: string[], required: string): boolean {
  if (scopes.includes("*")) return true;
  if (scopes.length === 0) return true;
  return scopes.includes(required);
}
