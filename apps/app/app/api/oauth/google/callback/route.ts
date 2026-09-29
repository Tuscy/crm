/**
 * GET /api/oauth/google/callback
 *
 * Handles the redirect from Google after staff approves the OAuth consent screen.
 * Exchanges the code for tokens, encrypts the refresh token, and upserts an
 * AnalyticsCredential row. Redirects to /dashboard/settings/analytics on success
 * or with ?error= on failure.
 */

import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { auth } from "@/auth";
import { saveAnalyticsCredential } from "@/lib/server/actions/analytics";

export const dynamic = "force-dynamic";

const SETTINGS_URL = "/dashboard/settings/analytics";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.isStaff) {
    return NextResponse.redirect(new URL("/dashboard/staff-login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    const url = new URL(SETTINGS_URL, request.url);
    url.searchParams.set("error", oauthError);
    return NextResponse.redirect(url);
  }

  if (!code || !stateRaw) {
    const url = new URL(SETTINGS_URL, request.url);
    url.searchParams.set("error", "missing_code");
    return NextResponse.redirect(url);
  }

  // Decode state
  let type: "GA4" | "SEARCH_CONSOLE" | "GBP";
  let accountId: string;
  let clientId: string | null;
  try {
    const decoded = JSON.parse(
      Buffer.from(stateRaw, "base64url").toString("utf8")
    ) as { type: string; accountId: string; clientId: string | null };
    if (
      decoded.type !== "GA4" &&
      decoded.type !== "SEARCH_CONSOLE" &&
      decoded.type !== "GBP"
    ) {
      throw new Error("invalid type");
    }
    type = decoded.type;
    accountId = decoded.accountId;
    clientId = decoded.clientId || null;
  } catch {
    const url = new URL(SETTINGS_URL, request.url);
    url.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(url);
  }

  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_OAUTH_REDIRECT_URL
  ) {
    const url = new URL(SETTINGS_URL, request.url);
    url.searchParams.set("error", "oauth_not_configured");
    return NextResponse.redirect(url);
  }

  const oauthClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URL
  );

  try {
    const { tokens } = await oauthClient.getToken(code);
    if (!tokens.refresh_token) {
      // Google only returns refresh_token on first consent — user needs to
      // revoke access and reconnect if they've connected before.
      const url = new URL(SETTINGS_URL, request.url);
      url.searchParams.set("error", "no_refresh_token");
      return NextResponse.redirect(url);
    }

    await saveAnalyticsCredential({
      clientId,
      type,
      accountId,
      refreshToken: tokens.refresh_token,
    });

    const url = new URL(SETTINGS_URL, request.url);
    url.searchParams.set("connected", type.toLowerCase());
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("OAuth callback error:", err);
    const url = new URL(SETTINGS_URL, request.url);
    url.searchParams.set(
      "error",
      err instanceof Error ? err.message : "unknown_error"
    );
    return NextResponse.redirect(url);
  }
}
