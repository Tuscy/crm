import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@stky/db";
import { isValidDealStage } from "@stky/crm";
import { requireAutomationAuth } from "@/lib/api-auth";
import { ApiScope } from "@/lib/api-scopes";
import { notifyDealUpdated } from "@/lib/crm/webhook-events";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (
    !(await requireAutomationAuth(request, "PUT /api/deals/[id]", ApiScope.DEALS_WRITE, "deal:update"))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { value, stage } = body;

    const existing = await prisma.deal.findUnique({
      where: { id },
      include: { lead: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (stage !== undefined && !isValidDealStage(stage)) {
      return NextResponse.json({ error: "Invalid deal stage" }, { status: 400 });
    }

    const deal = await prisma.deal.update({
      where: { id },
      data: {
        ...(value !== undefined && { value }),
        ...(stage !== undefined && { stage }),
      },
      include: { lead: true },
    });

    if (stage !== undefined && stage !== existing.stage) {
      await notifyDealUpdated(deal, existing.stage);
    }

    return NextResponse.json(deal);
  } catch (error) {
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }
    console.error("PUT /api/deals/[id]:", error);
    return NextResponse.json(
      { error: "Failed to update deal" },
      { status: 500 }
    );
  }
}
