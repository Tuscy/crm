import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUptimeSnapshot } from "@/lib/uptime-kuma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.isStaff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getUptimeSnapshot());
}
