import type { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "crypto";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Anything else is refused. */
export function isCronAuthorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const token =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !token) return false;
  const a = createHash("sha256").update(token).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}
