import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { rateLimit } from "@stky/security/edge";

const STAFF_COOKIE = "stky_staff_gate";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function dashboardAuthConfigured(): boolean {
  if (process.env.AUTH_SECRET) return true;
  if (!process.env.STAFF_DASHBOARD_PASSWORD) return false;
  if (!isProduction()) return true;
  return process.env.ALLOW_LEGACY_STAFF_PASSWORD === "true";
}

function legacyCookieAllowed(): boolean {
  if (!process.env.STAFF_DASHBOARD_PASSWORD) return false;
  /** Local dev: shared password works without the explicit prod escape hatch. */
  if (!isProduction()) return true;
  return process.env.ALLOW_LEGACY_STAFF_PASSWORD === "true";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authSecret = process.env.AUTH_SECRET;

  // Lazy + memoized: only decoded for paths that actually need it below
  // (/api/* to decide on the rate-limit skip, /dashboard/* for the auth
  // gate) — a JWT decode is local/cheap, but no need to pay it on every
  // request the matcher covers (e.g. /auth/*, /client/login/*).
  let staffTokenChecked = false;
  let cachedIsAuthenticatedStaff = false;
  async function isAuthenticatedStaff(): Promise<boolean> {
    if (staffTokenChecked) return cachedIsAuthenticatedStaff;
    staffTokenChecked = true;
    if (!authSecret) return false;
    const token = await getToken({
      req: request,
      secret: authSecret,
      secureCookie: process.env.NODE_ENV === "production",
    });
    cachedIsAuthenticatedStaff = Boolean(
      token && (token as { isStaff?: boolean }).isStaff === true
    );
    return cachedIsAuthenticatedStaff;
  }

  if (pathname.startsWith("/api/")) {
    // Internal dashboard API calls from an already-authenticated staff
    // session don't need the same protection as public/unauthenticated
    // traffic — skip the Redis round-trip for them; still rate-limit
    // everything else (public webhooks, OAuth callbacks, anonymous callers).
    if (!(await isAuthenticatedStaff())) {
      const blocked = await rateLimit(request, "api");
      if (blocked) return blocked;
    }
  } else if (
    pathname.startsWith("/dashboard/staff-login") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/client/login")
  ) {
    const blocked = await rateLimit(request, "auth");
    if (blocked) return blocked;
  }

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/dashboard/staff-login")) {
    return NextResponse.next();
  }

  if (pathname === "/dashboard/sites" || pathname.startsWith("/dashboard/sites/")) {
    return NextResponse.redirect(new URL("/dashboard/clients", request.url));
  }

  if (
    pathname === "/dashboard/analytics" ||
    pathname.startsWith("/dashboard/analytics/")
  ) {
    return NextResponse.redirect(new URL("/dashboard/pipeline", request.url));
  }

  if (isProduction() && !dashboardAuthConfigured()) {
    return new NextResponse(
      "CRM misconfiguration: set AUTH_SECRET in production (see CRM README).",
      {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }
    );
  }

  const legacyPassword = process.env.STAFF_DASHBOARD_PASSWORD;

  if (authSecret && (await isAuthenticatedStaff())) {
    return NextResponse.next();
  }

  if (
    legacyCookieAllowed() &&
    legacyPassword &&
    request.cookies.get(STAFF_COOKIE)?.value === "1"
  ) {
    return NextResponse.next();
  }

  /** Dev convenience: no AUTH_SECRET and no shared password = dashboard open (see README). */
  if (!authSecret && !legacyPassword) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/dashboard/staff-login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/:path*",
    "/auth/:path*",
    "/client/login/:path*",
  ],
};
