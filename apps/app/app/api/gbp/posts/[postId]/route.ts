/**
 * DELETE /api/gbp/posts/[postId]
 *
 * Deletes a post via the GBP API and marks the local GBPPost row DELETED.
 * postId is the local GBPPost cuid (the Google resource name contains slashes).
 * Staff only — no API key fallback.
 */

import { denyUnlessCan } from "@/lib/server/guard";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@stky/db";
import { resolveGBPCredential } from "@/lib/gbp/resolver";
import { deletePost } from "@/lib/gbp/client";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { postId: string } }
) {
  const session = await auth();
  if (!session?.user?.isStaff) {
    return NextResponse.json({ error: "Staff session required" }, { status: 401 });
  }
  const denied = await denyUnlessCan("gbp:delete", { entity: "GBPPost" });
  if (denied) return denied;

  const row = await prisma.gBPPost.findUnique({ where: { id: params.postId } });
  if (!row) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const cred = await resolveGBPCredential(row.clientId);
  if (!cred) {
    return NextResponse.json(
      { error: "GBP credentials not configured", notConfigured: true },
      { status: 404 }
    );
  }

  try {
    await deletePost(row.googlePostId, cred.refreshToken);
    const updated = await prisma.gBPPost.update({
      where: { id: row.id },
      data: { state: "DELETED" },
    });
    return NextResponse.json({ post: updated });
  } catch (err) {
    console.error("GBP delete post error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "GBP API error" },
      { status: 502 }
    );
  }
}
