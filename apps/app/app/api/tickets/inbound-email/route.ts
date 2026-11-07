import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@stky/db";
import { requireTicketAuth } from "@/lib/api-auth";
import { ApiScope } from "@/lib/api-scopes";
import { addTicketMessage, appendEvent, createTicket, transitionTicket } from "@/lib/tickets/events";
import { extractReference, normaliseEmail, stripQuotedReply } from "@/lib/tickets/email-in";
import { errorResponse, readJson, str, unauthorized } from "@/lib/tickets/api";

/** Everything we ignore returns the same 202, so the endpoint can't be used to probe which addresses are clients. */
const IGNORED = () => NextResponse.json({ ok: true, ignored: true }, { status: 202 });

async function clientIdForSender(email: string): Promise<string | null> {
  const client = await prisma.client.findFirst({
    where: {
      OR: [
        { primaryContactEmail: { equals: email, mode: "insensitive" } },
        { memberships: { some: { user: { email: { equals: email, mode: "insensitive" } } } } },
      ],
    },
    select: { id: true },
  });
  return client?.id ?? null;
}

/**
 * Creates a ticket from an email, or threads a reply onto an existing one when the subject
 * carries [TKT-0001]. Called by an email forwarder (n8n, Resend inbound, etc.) holding a
 * tickets:email key. Only senders who are a known client contact are accepted.
 */
export async function POST(request: NextRequest) {
  const caller = await requireTicketAuth(request, "POST /api/tickets/inbound-email", [ApiScope.TICKETS_EMAIL], "ticket:create");
  if (!caller) return unauthorized();

  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const from = (body.from ?? {}) as Record<string, unknown>;
  const email = normaliseEmail(from.email);
  const text = stripQuotedReply(str(body.text, 50_000) ?? "").slice(0, 10_000);
  const subject = (str(body.subject, 300) ?? "").trim();
  const messageId = str(body.messageId, 300);
  if (!email) return NextResponse.json({ error: "from.email is required" }, { status: 422 });
  if (!text) return IGNORED();

  try {
    if (messageId) {
      const seen = await prisma.ticketEvent.findFirst({
        where: { kind: "email.received", payload: { path: ["emailMessageId"], equals: messageId } },
        select: { id: true },
      });
      if (seen) return NextResponse.json({ ok: true, duplicate: true });
    }

    const senderName = str(from.name, 200) ?? null;
    const actor = { type: "CLIENT" as const, name: email };
    const reference = extractReference(subject);

    let ticketId: string | null = null;
    if (reference) {
      const ticket = await prisma.ticket.findUnique({
        where: { reference },
        select: { id: true, clientId: true, status: true, requesterEmail: true },
      });
      if (!ticket) return IGNORED();
      const senderClientId = await clientIdForSender(email);
      const isRequester = ticket.requesterEmail?.toLowerCase() === email;
      if (senderClientId !== ticket.clientId && !isRequester) return IGNORED();

      await addTicketMessage(ticket.id, actor, { body: text, visibility: "PUBLIC" });
      if (ticket.status === "AWAITING_CLIENT") {
        await transitionTicket(ticket.id, "TRIAGED", actor, { summary: "Thanks, we've got your reply." });
      }
      ticketId = ticket.id;
    } else {
      const clientId = await clientIdForSender(email);
      if (!clientId) return IGNORED();
      const created = await createTicket(
        {
          clientId,
          title: subject.replace(/^((re|fwd?):\s*)+/i, "").slice(0, 200) || "Email enquiry",
          description: text,
          source: "EMAIL",
          requesterType: "CLIENT",
          requesterName: senderName,
          requesterEmail: email,
        },
        actor
      );
      ticketId = created.id;
    }

    if (messageId && ticketId) {
      const id = ticketId;
      await prisma.$transaction((tx) =>
        appendEvent(tx, { ticketId: id, kind: "email.received", actor, payload: { emailMessageId: messageId } })
      );
    }
    return NextResponse.json({ ok: true, ticketId }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "POST /api/tickets/inbound-email");
  }
}
