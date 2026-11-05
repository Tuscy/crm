import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@stky/db";
import { requireAutomationAuth } from "@/lib/api-auth";
import { getGoogleAdsEnvStatus } from "@/lib/google-ads/env";
import { normalizeCustomerId } from "@/lib/google-ads/format";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await requireAutomationAuth(request, "GET /api/google-ads/settings"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await prisma.googleAdsSettings.findUnique({
    where: { id: "default" },
  });
  return NextResponse.json({
    loginCustomerId: settings?.loginCustomerId ?? null,
    env: getGoogleAdsEnvStatus(),
  });
}

export async function PUT(request: NextRequest) {
  if (!(await requireAutomationAuth(request, "PUT /api/google-ads/settings", undefined, "integration:update"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as { loginCustomerId?: string };
  const loginCustomerId = normalizeCustomerId(body.loginCustomerId ?? "");
  if (loginCustomerId.length < 10) {
    return NextResponse.json(
      { error: "Invalid manager customer ID" },
      { status: 400 }
    );
  }
  const settings = await prisma.googleAdsSettings.upsert({
    where: { id: "default" },
    create: { id: "default", loginCustomerId },
    update: { loginCustomerId },
  });
  return NextResponse.json({ loginCustomerId: settings.loginCustomerId });
}
