/**
 * GET  /api/gbp/posts?clientId=   — list local posts, sync results to GBPPost cache
 * POST /api/gbp/posts             — create a post via the GBP API (staff only)
 */

import { denyUnlessCan } from "@/lib/server/guard";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@stky/db";
import { requireAutomationAuth } from "@/lib/api-auth";
import { ApiScope } from "@/lib/api-scopes";
import { resolveGBPCredential } from "@/lib/gbp/resolver";
import { createPost, listPosts } from "@/lib/gbp/client";
import { syncLocalPosts, upsertLocalPost } from "@/lib/gbp/post-sync";
import type { CreatePostInput } from "@/lib/gbp/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await requireAutomationAuth(request, "GET /api/gbp/posts", ApiScope.GBP_READ))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const cred = await resolveGBPCredential(clientId);
  if (!cred) {
    return NextResponse.json(
      { error: "GBP credentials not configured", notConfigured: true },
      { status: 404 }
    );
  }

  try {
    const apiPosts = await listPosts(cred.locationName, cred.refreshToken);
    await syncLocalPosts(clientId, apiPosts);
    const posts = await prisma.gBPPost.findMany({
      where: { clientId },
      orderBy: { createTime: "desc" },
    });
    return NextResponse.json({ posts, isOrgLevel: cred.isOrgLevel });
  } catch (err) {
    console.error("GBP posts error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "GBP API error" },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Write operation — staff session only, no API key fallback
  const session = await auth();
  if (!session?.user?.isStaff) {
    return NextResponse.json({ error: "Staff session required" }, { status: 401 });
  }
  const denied = await denyUnlessCan("gbp:create", { entity: "GBPPost" });
  if (denied) return denied;

  let body: CreatePostInput & { clientId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = body.clientId?.trim();
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }
  if (!body.summary?.trim()) {
    return NextResponse.json({ error: "summary is required" }, { status: 400 });
  }
  if (body.summary.length > 1500) {
    return NextResponse.json(
      { error: "summary must be 1,500 characters or fewer" },
      { status: 400 }
    );
  }
  if (!["STANDARD", "EVENT", "OFFER"].includes(body.type)) {
    return NextResponse.json(
      { error: "type must be STANDARD, EVENT, or OFFER" },
      { status: 400 }
    );
  }

  const cred = await resolveGBPCredential(clientId);
  if (!cred) {
    return NextResponse.json(
      { error: "GBP credentials not configured", notConfigured: true },
      { status: 404 }
    );
  }

  try {
    const created = await createPost(
      cred.locationName,
      {
        type: body.type,
        summary: body.summary.trim(),
        ctaType: body.ctaType,
        ctaUrl: body.ctaUrl,
        eventTitle: body.eventTitle,
        eventStart: body.eventStart,
        eventEnd: body.eventEnd,
        offerTitle: body.offerTitle,
        offerCode: body.offerCode,
      },
      cred.refreshToken
    );
    const row = await upsertLocalPost(clientId, created);
    return NextResponse.json({ post: row }, { status: 201 });
  } catch (err) {
    console.error("GBP create post error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "GBP API error" },
      { status: 502 }
    );
  }
}
