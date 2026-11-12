/** Shared CRM constants / filters (pure, no DB). */

export const PIPELINE_STAGES = [
  "NEW_LEAD",
  "QUALIFIED",
  "DISCOVERY_CALL",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  NEW_LEAD: "New Lead",
  QUALIFIED: "Qualified",
  DISCOVERY_CALL: "Discovery Call",
  PROPOSAL_SENT: "Proposal Sent",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "LOST",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** @deprecated Use PIPELINE_STAGES — kept for integrations that expect DEAL_STAGES */
export const DEAL_STAGES = PIPELINE_STAGES;
export type DealStage = PipelineStage;

export function isValidDealStage(s: string): s is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(s);
}

export function isValidLeadStatus(s: string): s is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(s);
}

export const LEAD_SOURCES = [
  "BNI",
  "WEBSITE",
  "REFERRAL",
  "GOOGLE_ADS",
  "LINKEDIN",
  "SOCIAL",
  "OTHER",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  BNI: "BNI",
  WEBSITE: "Website",
  REFERRAL: "Referral",
  GOOGLE_ADS: "Google Ads",
  LINKEDIN: "LinkedIn",
  SOCIAL: "Social media",
  OTHER: "Other",
};

export function isKnownLeadSource(s: string): s is LeadSource {
  return (LEAD_SOURCES as readonly string[]).includes(s);
}

/** Display label for a stored source (known keys or legacy free text). */
export function leadSourceLabel(source: string | null | undefined): string {
  if (!source) return "—";
  if (isKnownLeadSource(source)) return LEAD_SOURCE_LABELS[source];
  return source;
}

export function resolveLeadSourceFromForm(
  selectValue: string,
  customValue: string
): string | undefined {
  const trimmed = selectValue.trim();
  if (!trimmed) return undefined;
  if (trimmed === "OTHER") {
    const custom = customValue.trim();
    return custom || "OTHER";
  }
  return trimmed;
}

/** Package type enum values stored in database */
export type PackageType = "VOLTAGE" | "CHARGE" | "GRID";

/** Display labels for package tiers */
export const PACKAGE_DISPLAY_LABELS: Record<
  PackageType | "NONE",
  string
> = {
  NONE: "None",
  VOLTAGE: "Minimum Stick",
  CHARGE: "Extra Sticky",
  GRID: "Totally Stuck",
} as const;

/** Get display label for a package type, handling null/undefined as "None" */
export function packageLabel(
  packageType: PackageType | null | undefined
): string {
  if (!packageType) return PACKAGE_DISPLAY_LABELS.NONE;
  return PACKAGE_DISPLAY_LABELS[packageType] || packageType;
}
