import { NextRequest, NextResponse } from "next/server";

/**
 * app/api/report-problem/route.ts in a client site. Forwards to the StickySites CRM with
 * this site's tickets:intake key (bound to this site in the CRM; the CRM takes the client
 * and site from the key, never from this body).
 *
 * Env: STICKY_CRM_URL, STICKY_TICKET_KEY. Optional: TURNSTILE_SECRET_KEY (verified here too).
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, string> | null;
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  // Pass the visitor's IP so the CRM can rate-limit per visitor, not per site.
  const visitorIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const description = String(body.description ?? "").slice(0, 5000);
  const res = await fetch(`${process.env.STICKY_CRM_URL}/api/tickets`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.STICKY_TICKET_KEY}`,
      "x-visitor-ip": visitorIp,
    },
    body: JSON.stringify({
      title: description.split("\n")[0].slice(0, 100) || "Website problem report",
      description,
      requester: { name: String(body.name ?? "").slice(0, 200), email: String(body.email ?? "").slice(0, 320) },
      website: body.website ?? "", // honeypot, checked by the CRM
      turnstileToken: body["cf-turnstile-response"],
    }),
  });

  // Never echo CRM errors to the visitor. Pass through only rate limiting.
  if (res.status === 429) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  return res.ok ? NextResponse.json({ ok: true }, { status: 201 }) : NextResponse.json({ error: "Could not send" }, { status: 502 });
}
