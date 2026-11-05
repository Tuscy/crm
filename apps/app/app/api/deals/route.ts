import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@stky/db";
import { isValidDealStage } from "@stky/crm";
import { requireAutomationAuth } from "@/lib/api-auth";
import { ApiScope } from "@/lib/api-scopes";
import { notifyDealCreated } from "@/lib/crm/webhook-events";

export async function POST(request: NextRequest) {
  if (
    !(await requireAutomationAuth(request, "POST /api/deals", ApiScope.DEALS_WRITE, "deal:create"))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { leadId, value, stage } = body;

    if (!leadId || !stage) {
      return NextResponse.json(
        { error: "leadId and stage are required" },
        { status: 400 }
      );
    }

    if (!isValidDealStage(stage)) {
      return NextResponse.json({ error: "Invalid deal stage" }, { status: 400 });
    }

    const deal = await prisma.deal.create({
      data: {
        leadId,
        value: value ?? undefined,
        stage,
      },
      include: { lead: true },
    });

    await notifyDealCreated(deal);

    return NextResponse.json(deal);
  } catch (error) {
    console.error("POST /api/deals:", error);
    return NextResponse.json(
      { error: "Failed to create deal" },
      { status: 500 }
    );
  }
}
