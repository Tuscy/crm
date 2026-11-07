import { NextResponse } from "next/server";
import type { TicketCaller } from "@/lib/api-auth";
import { TicketError, type TicketActor } from "./events";

export const TICKET_TYPES = [
  "SITE_CHANGE",
  "BUG",
  "CONTENT",
  "HOSTING_UPTIME",
  "SEO_ADS_REPORTING",
  "BILLING_ADMIN",
  "INTERNAL",
  "OTHER",
] as const;
export const TICKET_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const TICKET_SOURCES = ["CRM", "PORTAL", "SITE_FORM", "EMAIL", "UPTIME", "AGENT"] as const;

export function oneOf<T extends string>(list: readonly T[], value: unknown): T | undefined {
  return typeof value === "string" && (list as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

export function str(value: unknown, max = 10_000): string | undefined {
  return typeof value === "string" ? value.slice(0, max) : undefined;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function errorResponse(error: unknown, context: string) {
  if (error instanceof TicketError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "INVALID_TRANSITION"
          ? 409
          : error.code === "FORBIDDEN"
            ? 403
            : 422;
    return NextResponse.json({ error: error.message }, { status });
  }
  console.error(context, error);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function actorFor(caller: TicketCaller): TicketActor {
  if (caller.kind === "staff") return { type: "STAFF", name: caller.staff.email };
  if (caller.scopes.includes("tickets:agent")) return { type: "AGENT", name: caller.name ?? "agent" };
  if (caller.scopes.includes("tickets:intake")) return { type: "CLIENT", name: null };
  return { type: "SYSTEM", name: caller.name ?? "system" };
}

/** Agent keys may only touch tickets assigned to that agent (by key name). */
export function mayTouch(
  caller: TicketCaller,
  ticket: { assigneeType: string; assigneeId: string | null }
): boolean {
  if (caller.kind === "staff") return true;
  if (caller.scopes.includes("tickets:write")) return true;
  if (caller.scopes.includes("tickets:agent")) {
    return ticket.assigneeType === "AGENT" && !!caller.name && ticket.assigneeId === caller.name;
  }
  return false;
}

export function isStaffOrAgent(caller: TicketCaller): boolean {
  return caller.kind === "staff" || caller.scopes.includes("tickets:agent");
}
