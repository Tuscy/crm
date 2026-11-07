import { logStky } from "@/lib/observability";

/**
 * Mirrors ticket activity to a Slack channel. Off unless SLACK_TICKETS_ENABLED=true
 * with SLACK_BOT_TOKEN and SLACK_TICKETS_CHANNEL_ID set. Never throws: Slack being
 * down must not break a ticket action.
 */

type MirrorTicket = {
  id: string;
  reference: string;
  title: string;
  status: string;
  type: string;
  priority: string;
  clientName?: string | null;
};

const SLACK_API = "https://slack.com/api";
const TOPIC_CACHE_MS = 10 * 60 * 1000;
const MUTED_TOPIC = /\b(do not post|no bots?|muted)\b/i;

let topicCache: { at: number; muted: boolean } | null = null;

function config() {
  if (process.env.SLACK_TICKETS_ENABLED !== "true") return null;
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_TICKETS_CHANNEL_ID;
  if (!token || !channel) return null;
  return { token, channel };
}

async function slack(method: string, token: string, body: Record<string, unknown>) {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  return (await res.json()) as { ok: boolean; error?: string; channel?: { topic?: { value?: string } } };
}

/** Checks the channel topic first (cached) and stays quiet if it says not to post. */
async function channelIsMuted(token: string, channel: string): Promise<boolean> {
  if (topicCache && Date.now() - topicCache.at < TOPIC_CACHE_MS) return topicCache.muted;
  const info = await slack("conversations.info", token, { channel });
  const muted = info.ok ? MUTED_TOPIC.test(info.channel?.topic?.value ?? "") : false;
  topicCache = { at: Date.now(), muted };
  return muted;
}

function appUrl(ticketId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "";
  return base ? `${base.replace(/\/$/, "")}/dashboard/tickets/${ticketId}` : "";
}

function line(ticket: MirrorTicket, headline: string): string {
  const link = appUrl(ticket.id);
  const ref = link ? `<${link}|${ticket.reference}>` : ticket.reference;
  const client = ticket.clientName ? ` · ${ticket.clientName}` : "";
  return `${headline} ${ref}: ${ticket.title}${client} (${ticket.type}, ${ticket.priority})`;
}

async function post(text: string): Promise<void> {
  const cfg = config();
  if (!cfg) return;
  try {
    if (await channelIsMuted(cfg.token, cfg.channel)) return;
    const res = await slack("chat.postMessage", cfg.token, {
      channel: cfg.channel,
      text,
      unfurl_links: false,
    });
    if (!res.ok) logStky("slack_post_failed", { error: res.error ?? "unknown" });
  } catch (error) {
    logStky("slack_post_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

export async function mirrorTicketCreated(ticket: MirrorTicket): Promise<void> {
  await post(line(ticket, ":ticket: New ticket"));
}

export async function mirrorStatusChanged(
  ticket: MirrorTicket,
  from: string,
  to: string
): Promise<void> {
  await post(line(ticket, `:arrows_counterclockwise: ${from} → ${to}`));
}
