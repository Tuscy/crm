/**
 * GET /api/oauth/xero
 *
 * Initiates the Xero OAuth 2.0 flow to connect StickySites' own Xero
 * organisation (one connection, not per-client). Staff-only — redirects
 * straight to Xero after verifying a live staff session.
 *
 * Unlike the Google flow, state carries a random nonce that is also set as an
 * httpOnly cookie and checked in the callback, so a callback can't be replayed
 * into a staff session to connect someone else's organisation.
 */

import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  XERO_STATE_COOKIE,
  buildXeroAuthorizeUrl,
  xeroOAuthConfigured,
} from "@/lib/xero/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.isStaff) {
    return NextResponse.json({ error: "Staff session required" }, { status: 401 });
  }

  if (!xeroOAuthConfigured()) {
    return NextResponse.json(
      { error: "Xero OAuth env vars not configured" },
      { status: 503 }
    );
  }

  const state = randomBytes(24).toString("base64url");

  const res = NextResponse.redirect(buildXeroAuthorizeUrl(state));
  res.cookies.set(XERO_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // sent on Xero's top-level redirect back to the callback
    path: "/api/oauth/xero",
    maxAge: 10 * 60,
  });
  return res;
}
