import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
/** Edge-safe client (fetch); default `@upstash/redis` entry targets Node. */
import { Redis } from "@upstash/redis/cloudflare";

/**
 * intake: public ticket form, per key + visitor IP. intakeSite: per key overall.
 */
export type RateLimitKind = "api" | "auth" | "general" | "intake" | "intakeSite";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

function getRedis(): Redis | null {
  if (!redisUrl || !redisToken) return null;
  return new Redis({ url: redisUrl, token: redisToken });
}

const limiters: Partial<Record<RateLimitKind, Ratelimit | null>> = {};

function getLimiter(kind: RateLimitKind): Ratelimit | null {
  if (limiters[kind] !== undefined) {
    return limiters[kind] ?? null;
  }
  const redis = getRedis();
  if (!redis) {
    limiters[kind] = null;
    return null;
  }
  const config =
    kind === "api"
      ? { requests: 120, window: "1 m" as const }
      : kind === "auth"
        ? { requests: 30, window: "1 m" as const }
        : kind === "intake"
          ? { requests: 5, window: "10 m" as const }
          : kind === "intakeSite"
            ? { requests: 30, window: "1 h" as const }
            : { requests: 300, window: "1 m" as const };

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.requests, config.window),
    prefix: `stky:rl:${kind}`,
    analytics: true,
  });
  limiters[kind] = limiter;
  return limiter;
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return request.ip ?? "unknown";
}

/**
 * Returns a 429 response if rate limited, or null if allowed / rate limiting disabled.
 * When Upstash env vars are unset, allows all traffic (configure Redis for production).
 */
export async function rateLimit(
  request: NextRequest,
  kind: RateLimitKind
): Promise<NextResponse | null> {
  return rateLimitByIdentity(getClientIp(request), kind);
}

/** Server actions / route handlers: rate limit by arbitrary key (e.g. IP + email). */
/** Returns true if the identity is over the limit (caller should reject the request). */
export async function isOverRateLimit(
  identity: string,
  kind: RateLimitKind
): Promise<boolean> {
  const limiter = getLimiter(kind);
  if (!limiter) {
    return false;
  }
  const result = await limiter.limit(identity);
  return !result.success;
}

export async function rateLimitByIdentity(
  identity: string,
  kind: RateLimitKind
): Promise<NextResponse | null> {
  const limiter = getLimiter(kind);
  if (!limiter) {
    return null;
  }
  const result = await limiter.limit(identity);
  if (result.success) {
    return null;
  }
  const retrySec =
    typeof result.reset === "number"
      ? Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
      : 60;
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "Retry-After": String(retrySec),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    }
  );
}
