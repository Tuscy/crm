import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorised } from "@/lib/cron-auth";
import { purgeRawAgentOutput } from "@/lib/tickets/retention";

/** Daily: purge raw agent output older than 12 months (and old webhook payloads). */
export async function GET(request: NextRequest) {
  if (!isCronAuthorised(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await purgeRawAgentOutput());
}
