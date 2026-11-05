/** Shared (server + client safe) types for the Uptime Kuma status widget. */

export type MonitorState = "up" | "down" | "pending" | "maintenance" | "unknown";

export type OverallState = "up" | "down" | "degraded" | "unknown";

export type UptimeMonitor = {
  id: string;
  name: string;
  state: MonitorState;
  /** ISO timestamp of the latest check, if known. */
  lastCheck: string | null;
  /** 24h uptime as a 0-1 ratio, if Kuma reports it. */
  uptime24h: number | null;
  /** Oldest to newest, most recent ~20 checks. */
  recentBeats: MonitorState[];
  /** ISO timestamp the current outage started (only when state is "down"). */
  downSince: string | null;
  /** Most recent outage within the last 24h that has since recovered. */
  recentOutage: { from: string; to: string } | null;
};

export type UptimeSnapshot =
  | { configured: false }
  | {
      configured: true;
      /** False when Kuma could not be reached or returned bad data. */
      reachable: boolean;
      error: string | null;
      overall: OverallState;
      checkedAt: string;
      statusPageUrl: string;
      monitors: UptimeMonitor[];
    };
