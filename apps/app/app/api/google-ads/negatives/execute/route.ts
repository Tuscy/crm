import { NextRequest, NextResponse } from "next/server";
import { denyUnlessCan } from "@/lib/server/guard";
import { auth } from "@/auth";
import { normalizeCustomerId } from "@/lib/google-ads/format";
import { callPythonBridge } from "@/lib/google-ads/python-bridge";
import { prisma } from "@stky/db";
import type { NegativeKeywordInput } from "@/lib/google-ads/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  // Write operations require a staff session — no API key fallback
  const session = await auth();
  if (!session?.user?.isStaff) {
    return NextResponse.json(
      { error: "Staff session required for write operations" },
      { status: 401 }
    );
  }
  const denied = await denyUnlessCan("integration:update", { entity: "GoogleAdsNegatives" });
  if (denied) return denied;

  let body: { customerId: string; keywords: NegativeKeywordInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const customerId = normalizeCustomerId(body.customerId ?? "");
  if (customerId.length < 10) {
    return NextResponse.json(
      { error: "customerId is required (10-digit Ads account ID)" },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.keywords) || body.keywords.length === 0) {
    return NextResponse.json(
      { error: "keywords array is required and must not be empty" },
      { status: 400 }
    );
  }

  if (!process.env.GOOGLE_ADS_SCRIPTS_ROOT) {
    return NextResponse.json(
      {
        error: "Python bridge not configured",
        message:
          "Set GOOGLE_ADS_SCRIPTS_ROOT in .env to enable negative keyword operations.",
      },
      { status: 503 }
    );
  }

  const context = {
    customerId,
    keywords: body.keywords,
    execute: true,
    scriptName: "crm.negatives.execute",
    actor: session.user.id ? `staff:${session.user.id}` : "staff",
  };

  try {
    const result = await callPythonBridge("lib.services.negatives", context);

    await prisma.googleAdsAuditLog.create({
      data: {
        actorUserId: session.user.id ?? null,
        customerId,
        operation: "negatives_add",
        payload: context as object,
        result: result as object,
        execute: true,
      },
    });

    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Python bridge failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
