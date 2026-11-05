/**
 * POST   /api/gbp/reviews/[reviewId]/reply — create or update the reply on a review
 * DELETE /api/gbp/reviews/[reviewId]/reply — delete an existing reply
 *
 * Write operations — staff session only, no API key fallback.
 */

import { denyUnlessCan } from "@/lib/server/guard";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveGBPCredential } from "@/lib/gbp/resolver";
import { deleteReviewReply, replyToReview } from "@/lib/gbp/client";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { reviewId: string } }
) {
  const session = await auth();
  if (!session?.user?.isStaff) {
    return NextResponse.json({ error: "Staff session required" }, { status: 401 });
  }
  const denied = await denyUnlessCan("gbp:create", { entity: "GBPReviewReply" });
  if (denied) return denied;

  let body: { clientId?: string | null; comment?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const comment = body.comment?.trim();
  if (!comment) {
    return NextResponse.json({ error: "comment is required" }, { status: 400 });
  }

  const cred = await resolveGBPCredential(body.clientId?.trim() || null);
  if (!cred) {
    return NextResponse.json(
      { error: "GBP credentials not configured", notConfigured: true },
      { status: 404 }
    );
  }

  try {
    const reply = await replyToReview(
      cred.locationName,
      params.reviewId,
      comment,
      cred.refreshToken
    );
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("GBP review reply error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "GBP API error" },
      { status: 502 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { reviewId: string } }
) {
  const session = await auth();
  if (!session?.user?.isStaff) {
    return NextResponse.json({ error: "Staff session required" }, { status: 401 });
  }
  const denied = await denyUnlessCan("gbp:delete", { entity: "GBPReviewReply" });
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId") || null;

  const cred = await resolveGBPCredential(clientId);
  if (!cred) {
    return NextResponse.json(
      { error: "GBP credentials not configured", notConfigured: true },
      { status: 404 }
    );
  }

  try {
    await deleteReviewReply(cred.locationName, params.reviewId, cred.refreshToken);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("GBP delete reply error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "GBP API error" },
      { status: 502 }
    );
  }
}
