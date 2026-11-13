import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorised } from "@/lib/cron-auth";
import { purgeOldCompletedTasks } from "@/lib/tasks/retention";

export const dynamic = "force-dynamic";

/** Daily: delete completed personal/staff tasks past the retention window. */
export async function GET(request: NextRequest) {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await purgeOldCompletedTasks();
  return NextResponse.json(summary);
}
