/**
 * GET /api/oauth/google
 *
 * Initiates a Google OAuth 2.0 flow to obtain a refresh token for GA4,
 * Search Console, or Google Business Profile. Staff-only — redirects straight
 * to Google after verifying a live staff session.
 *
 * Query params:
 *   type        "GA4" | "SEARCH_CONSOLE" | "GBP"
 *   accountId   GA4 property ID, GSC site URL, or GBP location resource name
 *               (accounts/{accountId}/locations/{locationId})
 *   clientId    (optional) CRM client ID; omit for org-level credential
 */

import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { auth } from "@/auth";

const SCOPES: Record<string, string> = {
  GA4: "https://www.googleapis.com/auth/analytics.readonly",
  SEARCH_CONSOLE: "https://www.googleapis.com/auth/webmasters.readonly",
  GBP: "https://www.googleapis.com/auth/business.manage",
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.isStaff) {
    return NextResponse.json({ error: "Staff session required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const accountId = searchParams.get("accountId")?.trim() ?? "";
  const clientId = searchParams.get("clientId")?.trim() || null;

  if (type !== "GA4" && type !== "SEARCH_CONSOLE" && type !== "GBP") {
    return NextResponse.json(
      { error: "type must be GA4, SEARCH_CONSOLE, or GBP" },
      { status: 400 }
    );
  }
  if (!accountId) {
    return NextResponse.json(
      { error: "accountId is required" },
      { status: 400 }
    );
  }

  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_OAUTH_REDIRECT_URL
  ) {
    return NextResponse.json(
      { error: "Google OAuth env vars not configured" },
      { status: 503 }
    );
  }

  const oauthClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URL
  );

  // Encode intent as opaque state — server will verify it in the callback
  const state = Buffer.from(JSON.stringify({ type, accountId, clientId })).toString(
    "base64url"
  );

  const url = oauthClient.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // always return refresh_token
    scope: SCOPES[type],
    state,
  });

  return NextResponse.redirect(url);
}
