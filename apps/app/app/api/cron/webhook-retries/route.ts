import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { processDueDeliveries } from "@/lib/webhooks/ticket-dispatch";

function sameSecret(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Retries due ticket webhook deliveries. Vercel Cron calls this every minute
 * with `Authorization: Bearer $CRON_SECRET`. Anything else gets 401.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !token || !sameSecret(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await processDueDeliveries();
  return NextResponse.json(result);
}
