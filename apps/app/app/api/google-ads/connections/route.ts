import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@stky/db";
import { requireAutomationAuth } from "@/lib/api-auth";
import { normalizeCustomerId } from "@/lib/google-ads/format";
import { fetchAccountDisplayName } from "@/lib/google-ads/dashboard";
import { clearDashboardCache } from "@/lib/google-ads/cache";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await requireAutomationAuth(request, "GET /api/google-ads/connections"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const clientId = new URL(request.url).searchParams.get("clientId");
  const rows = await prisma.googleAdsConnection.findMany({
    where: clientId ? { clientId } : undefined,
    include: { client: { select: { id: true, name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      clientName: r.client?.name ?? null,
      googleAdsCustomerId: r.googleAdsCustomerId,
      label: r.label,
      displayName: r.displayName,
      lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
    }))
  );
}

export async function POST(request: NextRequest) {
  if (!(await requireAutomationAuth(request, "POST /api/google-ads/connections", undefined, "integration:update"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as {
    googleAdsCustomerId?: string;
    clientId?: string | null;
    label?: string | null;
  };
  const googleAdsCustomerId = normalizeCustomerId(
    body.googleAdsCustomerId ?? ""
  );
  if (googleAdsCustomerId.length < 10) {
    return NextResponse.json(
      { error: "Invalid Ads customer ID" },
      { status: 400 }
    );
  }
  const displayName = await fetchAccountDisplayName(googleAdsCustomerId);
  const row = await prisma.googleAdsConnection.upsert({
    where: { googleAdsCustomerId },
    create: {
      googleAdsCustomerId,
      clientId: body.clientId || null,
      label: body.label?.trim() || null,
      displayName,
    },
    update: {
      clientId: body.clientId || null,
      label: body.label?.trim() || null,
      ...(displayName ? { displayName } : {}),
    },
    include: { client: { select: { id: true, name: true } } },
  });
  clearDashboardCache(googleAdsCustomerId);
  return NextResponse.json({
    id: row.id,
    clientId: row.clientId,
    clientName: row.client?.name ?? null,
    googleAdsCustomerId: row.googleAdsCustomerId,
    label: row.label,
    displayName: row.displayName,
  });
}

export async function DELETE(request: NextRequest) {
  if (
    !(await requireAutomationAuth(request, "DELETE /api/google-ads/connections", undefined, "integration:delete"))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const row = await prisma.googleAdsConnection.delete({ where: { id } });
  clearDashboardCache(row.googleAdsCustomerId);
  return NextResponse.json({ ok: true });
}
