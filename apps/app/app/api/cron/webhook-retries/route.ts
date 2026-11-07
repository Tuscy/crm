import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorised } from "@/lib/cron-auth";
import { processDueDeliveries } from "@/lib/webhooks/ticket-dispatch";
import { escalateStalledTickets } from "@/lib/tickets/watchdog";

/**
 * Every minute (Vercel Cron, `Authorization: Bearer $CRON_SECRET`): retry due ticket webhook
 * deliveries, then escalate agent tickets that have gone quiet. Anything else gets 401.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorised(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const deliveries = await processDueDeliveries();
  const stalled = await escalateStalledTickets();
  return NextResponse.json({ deliveries, stalled });
}
