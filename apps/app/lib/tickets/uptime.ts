/** Pure helpers for the Uptime Kuma webhook. */

export type UptimeAlert = {
  status: "down" | "up";
  monitorName: string;
  hostname: string | null;
  message: string;
};

export function hostnameOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Uptime Kuma sends heartbeat.status 0 = down, 1 = up (2 pending, 3 maintenance are ignored). */
export function parseUptimePayload(body: unknown): UptimeAlert | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { heartbeat?: { status?: number; msg?: string }; monitor?: { name?: string; url?: string; hostname?: string }; msg?: string };
  const code = b.heartbeat?.status;
  if (code !== 0 && code !== 1) return null;
  const monitor = b.monitor ?? {};
  return {
    status: code === 0 ? "down" : "up",
    monitorName: String(monitor.name ?? "Monitor").slice(0, 120),
    hostname: hostnameOf(monitor.url) ?? hostnameOf(monitor.hostname),
    message: String(b.heartbeat?.msg ?? b.msg ?? "").slice(0, 300),
  };
}
