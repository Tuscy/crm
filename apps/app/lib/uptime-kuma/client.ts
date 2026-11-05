/**
 * Server-only client for Uptime Kuma's public status page API.
 * Reads `/api/status-page/<slug>` and `/api/status-page/heartbeat/<slug>`;
 * no API key is needed, but the monitors must be on a published status page.
 */

import type {
  MonitorState,
  OverallState,
  UptimeMonitor,
  UptimeSnapshot,
} from "./types";

const FETCH_TIMEOUT_MS = 5000;
const RECENT_BEATS = 20;
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

function baseUrl(): string {
  return (process.env.UPTIME_KUMA_BASE_URL ?? "").replace(/\/$/, "");
}

function slug(): string {
  return process.env.UPTIME_KUMA_STATUS_SLUG ?? "";
}

export function uptimeKumaConfigured(): boolean {
  return Boolean(baseUrl() && slug());
}

export function uptimeKumaStatusPageUrl(): string {
  return `${baseUrl()}/status/${encodeURIComponent(slug())}`;
}

async function kumaFetch(path: string): Promise<unknown> {
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Kuma ${res.status} for ${path}`);
  }
  return res.json();
}

function toState(status: unknown): MonitorState {
  switch (Number(status)) {
    case 1:
      return "up";
    case 0:
      return "down";
    case 2:
      return "pending";
    case 3:
      return "maintenance";
    default:
      return "unknown";
  }
}

/** Kuma heartbeat times are UTC "YYYY-MM-DD HH:mm:ss(.SSS)". */
function parseKumaTime(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

type Beat = { state: MonitorState; time: number | null };

function parseBeats(raw: unknown): Beat[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((b) => {
    const o = (b ?? {}) as Record<string, unknown>;
    return { state: toState(o.status), time: parseKumaTime(o.time) };
  });
}

function buildMonitor(
  id: string,
  name: string,
  beats: Beat[],
  uptime24h: unknown,
  now: number
): UptimeMonitor {
  const latest = beats[beats.length - 1];
  const state: MonitorState = latest?.state ?? "unknown";

  // Start of the current outage: walk back over the trailing run of "down".
  let downSince: string | null = null;
  let runStart = beats.length;
  if (state === "down") {
    while (runStart > 0 && beats[runStart - 1].state === "down") runStart -= 1;
    const t = beats[runStart]?.time;
    downSince = t ? new Date(t).toISOString() : null;
  }

  // Most recent recovered outage within 24h: last "down" run that ended
  // before the newest beat and is not the current outage.
  let recentOutage: UptimeMonitor["recentOutage"] = null;
  const searchEnd = state === "down" ? runStart : beats.length;
  for (let i = searchEnd - 1; i >= 0; i -= 1) {
    if (beats[i].state !== "down") continue;
    let start = i;
    while (start > 0 && beats[start - 1].state === "down") start -= 1;
    const endTime = beats[Math.min(i + 1, beats.length - 1)]?.time;
    const startTime = beats[start].time;
    if (startTime && endTime && now - endTime <= RECENT_WINDOW_MS) {
      recentOutage = {
        from: new Date(startTime).toISOString(),
        to: new Date(endTime).toISOString(),
      };
    }
    break;
  }

  return {
    id,
    name,
    state,
    lastCheck: latest?.time ? new Date(latest.time).toISOString() : null,
    uptime24h: typeof uptime24h === "number" ? uptime24h : null,
    recentBeats: beats.slice(-RECENT_BEATS).map((b) => b.state),
    downSince,
    recentOutage,
  };
}

function overallOf(monitors: UptimeMonitor[]): OverallState {
  if (monitors.length === 0) return "unknown";
  if (monitors.every((m) => m.state === "down")) return "down";
  if (monitors.some((m) => m.state === "down")) return "degraded";
  if (monitors.every((m) => m.state === "unknown")) return "unknown";
  return "up";
}

export async function getUptimeSnapshot(): Promise<UptimeSnapshot> {
  if (!uptimeKumaConfigured()) return { configured: false };

  const s = encodeURIComponent(slug());
  const statusPageUrl = uptimeKumaStatusPageUrl();
  const checkedAt = new Date().toISOString();

  try {
    const [page, heartbeats] = await Promise.all([
      kumaFetch(`/api/status-page/${s}`),
      kumaFetch(`/api/status-page/heartbeat/${s}`),
    ]);

    const groups =
      ((page as Record<string, unknown>).publicGroupList as unknown[]) ?? [];
    const hb = (heartbeats ?? {}) as Record<string, unknown>;
    const beatLists = (hb.heartbeatList ?? {}) as Record<string, unknown>;
    const uptimes = (hb.uptimeList ?? {}) as Record<string, unknown>;

    const now = Date.now();
    const monitors: UptimeMonitor[] = [];
    for (const g of groups) {
      const list = ((g as Record<string, unknown>).monitorList ??
        []) as Record<string, unknown>[];
      for (const m of list) {
        const id = String(m.id);
        monitors.push(
          buildMonitor(
            id,
            typeof m.name === "string" ? m.name : `Monitor ${id}`,
            parseBeats(beatLists[id]),
            uptimes[`${id}_24`],
            now
          )
        );
      }
    }

    return {
      configured: true,
      reachable: true,
      error: null,
      overall: overallOf(monitors),
      checkedAt,
      statusPageUrl,
      monitors,
    };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      error: err instanceof Error ? err.message : "Could not reach Kuma",
      overall: "unknown",
      checkedAt,
      statusPageUrl,
      monitors: [],
    };
  }
}
