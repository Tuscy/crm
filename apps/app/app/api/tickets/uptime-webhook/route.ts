import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@stky/db";
import { requireTicketAuth } from "@/lib/api-auth";
import { ApiScope } from "@/lib/api-scopes";
import { addTicketMessage, createTicket } from "@/lib/tickets/events";
import { parseUptimePayload } from "@/lib/tickets/uptime";
import { errorResponse, readJson, unauthorized } from "@/lib/tickets/api";

/**
 * Uptime Kuma webhook notification target. A "down" heartbeat opens a URGENT HOSTING_UPTIME
 * ticket for the matching site (or adds an internal note if one is already open); an "up"
 * heartbeat adds an internal note and leaves the ticket for a person to close.
 * Monitors that don't match a site in the CRM are ignored (a ticket needs a client).
 */
export async function POST(request: NextRequest) {
  const caller = await requireTicketAuth(request, "POST /api/tickets/uptime-webhook", [ApiScope.TICKETS_UPTIME], "ticket:create");
  if (!caller) return unauthorized();

  const alert = parseUptimePayload(await readJson(request));
  if (!alert?.hostname) return NextResponse.json({ ok: true, ignored: true }, { status: 202 });
  const host = alert.hostname;

  try {
    let site = await prisma.site.findFirst({
      where: { customDomain: { in: [host, `www.${host}`] } },
      select: { id: true, clientId: true },
    });
    if (!site) {
      const withSub = await prisma.site.findMany({
        where: { subdomain: { not: null } },
        select: { id: true, clientId: true, subdomain: true },
      });
      site = withSub.find((s) => s.subdomain && host.startsWith(`${s.subdomain.toLowerCase()}.`)) ?? null;
    }
    if (!site) return NextResponse.json({ ok: true, ignored: true }, { status: 202 });

    const open = await prisma.ticket.findFirst({
      where: { siteId: site.id, source: "UPTIME", type: "HOSTING_UPTIME", status: { notIn: ["RESOLVED", "CLOSED"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    const actor = { type: "SYSTEM" as const, name: "uptime-kuma" };
    const when = new Date().toISOString();

    if (alert.status === "down") {
      if (open) {
        await addTicketMessage(open.id, actor, { body: `Monitor still reports down at ${when}. ${alert.message}`.trim(), visibility: "INTERNAL" });
        return NextResponse.json({ ok: true, ticketId: open.id, existing: true });
      }
      const ticket = await createTicket(
        {
          clientId: site.clientId,
          siteId: site.id,
          title: `${alert.monitorName} is down`,
          description: `Uptime Kuma reports ${host} is down at ${when}. ${alert.message}`.trim(),
          type: "HOSTING_UPTIME",
          priority: "URGENT",
          source: "UPTIME",
          requesterType: "SYSTEM",
          requesterName: "Uptime Kuma",
        },
        actor
      );
      return NextResponse.json({ ok: true, ticketId: ticket.id }, { status: 201 });
    }

    if (open) {
      await addTicketMessage(open.id, actor, { body: `Monitor reports the site is back up at ${when}.`, visibility: "INTERNAL" });
      return NextResponse.json({ ok: true, ticketId: open.id, recovered: true });
    }
    return NextResponse.json({ ok: true, ignored: true }, { status: 202 });
  } catch (error) {
    return errorResponse(error, "POST /api/tickets/uptime-webhook");
  }
}
