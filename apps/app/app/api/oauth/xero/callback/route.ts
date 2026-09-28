/**
 * GET /api/oauth/xero/callback
 *
 * Handles the redirect from Xero after staff approves the consent screen.
 * Exchanges the code for tokens, resolves the organisation that was just
 * authorised, encrypts the refresh token, and stores the XeroCredential row.
 * Redirects to /dashboard/settings/xero on success or with ?error= on failure.
 */

import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  XERO_STATE_COOKIE,
  exchangeXeroCode,
  getXeroConnections,
  readJwtClaim,
  saveXeroCredential,
  xeroOAuthConfigured,
} from "@/lib/xero/oauth";

export const dynamic = "force-dynamic";

const SETTINGS_URL = "/dashboard/settings/xero";

function redirectWith(request: NextRequest, key: string, value: string) {
  const url = new URL(SETTINGS_URL, request.url);
  url.searchParams.set(key, value);
  const res = NextResponse.redirect(url);
  res.cookies.delete({ name: XERO_STATE_COOKIE, path: "/api/oauth/xero" });
  return res;
}

function stateMatches(expected: string | undefined, actual: string): boolean {
  if (!expected || expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.isStaff) {
    return NextResponse.redirect(new URL("/dashboard/staff-login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return redirectWith(request, "error", oauthError);
  }

  if (!code || !state) {
    return redirectWith(request, "error", "missing_code");
  }

  if (!stateMatches(request.cookies.get(XERO_STATE_COOKIE)?.value, state)) {
    return redirectWith(request, "error", "invalid_state");
  }

  if (!xeroOAuthConfigured()) {
    return redirectWith(request, "error", "oauth_not_configured");
  }

  try {
    const tokens = await exchangeXeroCode(code);
    if (!tokens.refresh_token) {
      // Only returned when offline_access was granted.
      return redirectWith(request, "error", "no_refresh_token");
    }

    // Only the organisation(s) authorised in this consent, not every org the
    // Xero user has ever connected to this app.
    const authEventId = readJwtClaim(tokens.access_token, "authentication_event_id");
    const tenants = await getXeroConnections(tokens.access_token, authEventId);
    if (tenants.length === 0) {
      return redirectWith(request, "error", "no_organisation");
    }
    if (tenants.length > 1) {
      // Single-org by design — ask staff to pick exactly one on Xero's screen.
      return redirectWith(request, "error", "multiple_organisations");
    }

    const [tenant] = tenants;
    await saveXeroCredential({
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName,
      refreshToken: tokens.refresh_token,
    });

    revalidatePath(SETTINGS_URL);
    return redirectWith(request, "connected", "xero");
  } catch (err) {
    console.error("Xero OAuth callback error:", err);
    return redirectWith(
      request,
      "error",
      err instanceof Error ? err.message : "unknown_error"
    );
  }
}
