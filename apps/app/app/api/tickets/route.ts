import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@stky/db";
import type { Prisma } from "@stky/db";
import { requireTicketAuth } from "@/lib/api-auth";
import { getClientIp, isOverRateLimit } from "@stky/security";
import { verifyTurnstile } from "@/lib/tickets/turnstile";
import { ApiScope } from "@/lib/api-scopes";
import { createTicket } from "@/lib/tickets/events";
import { toClientView } from "@/lib/tickets/status-labels";
import type { TicketStatusName } from "@/lib/tickets/transitions";
import {
  TICKET_PRIORITIES,
  TICKET_SOURCES,
  TICKET_TYPES,
  actorFor,
  errorResponse,
  oneOf,
  readJson,
  str,
  unauthorized,
} from "@/lib/tickets/api";

export async function GET(request: NextRequest) {
  const caller = await requireTicketAuth(request, "GET /api/tickets", [ApiScope.TICKETS_READ], "ticket:read");
  if (!caller) return unauthorized();

  try {
    const sp = new URL(request.url).searchParams;
    const where: Prisma.TicketWhereInput = {
      ...(sp.get("clientId") && { clientId: sp.get("clientId")! }),
      ...(sp.get("reference") && { reference: sp.get("reference")! }),
      ...(sp.get("status") && { status: sp.get("status") as TicketStatusName }),
      ...(sp.get("type") && { type: sp.get("type") as (typeof TICKET_TYPES)[number] }),
    };
    const limit = Math.min(Math.max(Number(sp.get("limit")) || 50, 1), 200);
    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { client: { select: { id: true, name: true } } },
    });
    return NextResponse.json(tickets);
  } catch (error) {
    return errorResponse(error, "GET /api/tickets");
  }
}

export async function POST(request: NextRequest) {
  const caller = await requireTicketAuth(
    request,
    "POST /api/tickets",
    [ApiScope.TICKETS_WRITE, ApiScope.TICKETS_INTAKE],
    "ticket:create"
  );
  if (!caller) return unauthorized();

  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  try {
    const isIntake = caller.kind === "key" && caller.scopes.includes("tickets:intake") && !caller.scopes.includes("tickets:write");

    // Honeypot: a filled hidden field means a bot. Pretend it worked, store nothing.
    if (isIntake && typeof body.website === "string" && body.website.trim() !== "") {
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    if (isIntake && caller.kind === "key") {
      // Public form: per-key ceiling, per-visitor limit, optional Turnstile.
      // The site's server forwards the visitor's IP in x-visitor-ip (Vercel overwrites
      // x-forwarded-for, so that header would only ever show the site's server). The key
      // holder is trusted, so this can't be spoofed by the public.
      const ip = request.headers.get("x-visitor-ip")?.trim().slice(0, 64) || getClientIp(request);
      if (
        (await isOverRateLimit(caller.keyId, "intakeSite")) ||
        (await isOverRateLimit(`${caller.keyId}:${ip}`, "intake"))
      ) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "600" } });
      }
      if (!(await verifyTurnstile(str(body.turnstileToken, 4096), ip))) {
        return NextResponse.json({ error: "Bot check failed" }, { status: 403 });
      }
    }

    let clientId: string | undefined;
    let siteId: string | null | undefined;
    if (isIntake) {
      if (caller.kind !== "key" || !caller.siteId || !caller.clientId) {
        return NextResponse.json({ error: "Intake key is not bound to a site" }, { status: 403 });
      }
      clientId = caller.clientId;
      siteId = caller.siteId; // taken from the key, never from the body
    } else {
      clientId = str(body.clientId, 100);
      siteId = str(body.siteId, 100) ?? null;
      if (!clientId) return NextResponse.json({ error: "clientId is required" }, { status: 422 });
    }

    const requester = (body.requester ?? {}) as Record<string, unknown>;
    const ticket = await createTicket(
      {
        clientId,
        siteId,
        title: str(body.title, 200) ?? "",
        description: str(body.description) ?? "",
        type: isIntake ? "OTHER" : oneOf(TICKET_TYPES, body.type),
        priority: isIntake ? "NORMAL" : oneOf(TICKET_PRIORITIES, body.priority),
        source: isIntake ? "SITE_FORM" : (oneOf(TICKET_SOURCES, body.source) ?? "CRM"),
        requesterType: isIntake ? "CLIENT" : caller.kind === "staff" ? "STAFF" : "AGENT",
        requesterName: str(requester.name, 200),
        requesterEmail: str(requester.email, 320),
      },
      actorFor(caller)
    );

    return NextResponse.json(isIntake ? toClientView(ticket as never) : ticket, { status: 201 });
  } catch (error) {
    return errorResponse(error, "POST /api/tickets");
  }
}
