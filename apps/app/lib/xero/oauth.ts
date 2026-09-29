import { prisma } from "@stky/db";
import { decrypt, encrypt } from "@/lib/server/encrypt";

/**
 * Xero OAuth 2.0 — connect flow helpers and access-token management.
 *
 * Xero access tokens expire after 30 minutes and every refresh returns a NEW
 * refresh token (the old one is invalidated after a short grace period), so
 * the rotated token is written back to XeroCredential on every refresh.
 * Unlike Google, there is no SDK doing this for us.
 */

const AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
const TOKEN_URL = "https://identity.xero.com/connect/token";
const CONNECTIONS_URL = "https://api.xero.com/connections";

/** Read-only granular scopes — nothing broader. */
export const XERO_SCOPES = [
  "offline_access",
  "accounting.contacts.read",
  "accounting.invoices.read",
  "accounting.banktransactions.read",
].join(" ");

export const XERO_STATE_COOKIE = "stky_xero_oauth_state";

export function xeroOAuthConfigured(): boolean {
  return Boolean(
    process.env.XERO_CLIENT_ID &&
      process.env.XERO_CLIENT_SECRET &&
      process.env.XERO_OAUTH_REDIRECT_URL
  );
}

export function buildXeroAuthorizeUrl(state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.XERO_CLIENT_ID!);
  url.searchParams.set("redirect_uri", process.env.XERO_OAUTH_REDIRECT_URL!);
  url.searchParams.set("scope", XERO_SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
};

async function requestToken(body: Record<string, string>): Promise<TokenResponse> {
  const basic = Buffer.from(
    `${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`
  ).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Xero token request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as TokenResponse;
}

export function exchangeXeroCode(code: string): Promise<TokenResponse> {
  return requestToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.XERO_OAUTH_REDIRECT_URL!,
  });
}

export type XeroConnection = {
  id: string; // connection id (used to disconnect)
  tenantId: string;
  tenantName: string | null;
  tenantType: string;
};

/**
 * Tenants the access token can reach. Pass the token's authentication_event_id
 * to get only the organisation(s) authorised in this specific consent.
 */
export async function getXeroConnections(
  accessToken: string,
  authEventId?: string
): Promise<XeroConnection[]> {
  const url = new URL(CONNECTIONS_URL);
  if (authEventId) url.searchParams.set("authEventId", authEventId);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Xero connections request failed (${res.status})`);
  const rows = (await res.json()) as XeroConnection[];
  return rows.filter((r) => r.tenantType === "ORGANISATION");
}

export async function deleteXeroConnection(accessToken: string, connectionId: string) {
  await fetch(`${CONNECTIONS_URL}/${connectionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
}

/** Reads a claim from a JWT access token without verifying it (we just received it from Xero over TLS). */
export function readJwtClaim(token: string, claim: string): string | undefined {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")
    ) as Record<string, unknown>;
    const v = payload[claim];
    return typeof v === "string" ? v : undefined;
  } catch {
    return undefined;
  }
}

/** Stores the single StickySites Xero connection, replacing any previous organisation. */
export async function saveXeroCredential(input: {
  tenantId: string;
  tenantName: string | null;
  refreshToken: string;
}) {
  const refreshToken = encrypt(input.refreshToken);
  await prisma.$transaction([
    prisma.xeroCredential.deleteMany({ where: { tenantId: { not: input.tenantId } } }),
    prisma.xeroCredential.upsert({
      where: { tenantId: input.tenantId },
      create: { tenantId: input.tenantId, tenantName: input.tenantName, refreshToken },
      update: { tenantName: input.tenantName, refreshToken, connectedAt: new Date() },
    }),
  ]);
  cached = null;
}

// ── access-token management ──────────────────────────────────────────────────

export type XeroAccess = { accessToken: string; tenantId: string; tenantName: string | null };

// Per-instance cache: reuses an access token until shortly before its 30-minute
// expiry, and collapses concurrent refreshes into one request.
let cached: (XeroAccess & { expiresAt: number }) | null = null;
let inflight: Promise<XeroAccess | null> | null = null;

/**
 * Returns a valid access token for the connected organisation, refreshing
 * (and persisting the rotated refresh token) when the cached one has expired.
 * Returns null when Xero isn't connected.
 */
export async function getXeroAccess(): Promise<XeroAccess | null> {
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    const { expiresAt: _expiresAt, ...access } = cached;
    return access;
  }
  inflight ??= refreshXeroAccess().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function refreshXeroAccess(): Promise<XeroAccess | null> {
  const cred = await prisma.xeroCredential.findFirst({ orderBy: { connectedAt: "desc" } });
  if (!cred) {
    cached = null;
    return null;
  }
  if (!xeroOAuthConfigured()) throw new Error("Xero OAuth env vars not configured");

  const tokens = await requestToken({
    grant_type: "refresh_token",
    refresh_token: decrypt(cred.refreshToken),
  });

  await prisma.xeroCredential.update({
    where: { id: cred.id },
    data: { refreshToken: encrypt(tokens.refresh_token) },
  });

  const access: XeroAccess = {
    accessToken: tokens.access_token,
    tenantId: cred.tenantId,
    tenantName: cred.tenantName,
  };
  cached = { ...access, expiresAt: Date.now() + tokens.expires_in * 1000 };
  return access;
}

/** Drops the cached access token — used after disconnecting. */
export function clearXeroAccessCache() {
  cached = null;
}
