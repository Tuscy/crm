/**
 * Cloudflare Turnstile check for the public ticket form. Off (always passes)
 * unless TURNSTILE_SECRET_KEY is set; once set, a missing or bad token fails.
 */
export async function verifyTurnstile(token: string | undefined, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, ...(ip && ip !== "unknown" ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false; // fail closed: a broken check must not open the form to bots
  }
}
