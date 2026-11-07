"use client";

import { useState } from "react";

/**
 * "Report a problem" form for StickySites client sites (copy into site-template).
 * Posts to this site's own /api/report-problem route, which holds the ticket key.
 * The key is never in the browser. Fields stay minimal: just enough to reply.
 */
export function ReportProblemForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/report-problem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    if (res.ok) {
      setState("sent");
    } else {
      setState("error");
      setMessage(res.status === 429 ? "You've sent a few already. Please try again later." : "Something went wrong. Please try again.");
    }
  }

  if (state === "sent") {
    return <p role="status">Thanks, we&apos;ve got it. You&apos;ll hear from us by email.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        Your name
        <input name="name" required maxLength={200} autoComplete="name" className="mt-1 w-full rounded border px-3 py-2" />
      </label>
      <label className="block">
        Your email
        <input name="email" type="email" required maxLength={320} autoComplete="email" className="mt-1 w-full rounded border px-3 py-2" />
      </label>
      <label className="block">
        What&apos;s the problem?
        <textarea name="description" required rows={5} maxLength={5000} className="mt-1 w-full rounded border px-3 py-2" />
      </label>
      <p className="text-sm opacity-70">Please don&apos;t include passwords or keys.</p>
      {/* Honeypot: real visitors never see or fill this. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}>
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {/* Cloudflare Turnstile: add the widget here; it fills a hidden field named cf-turnstile-response. */}
      {state === "error" ? <p role="alert">{message}</p> : null}
      <button type="submit" disabled={state === "sending"} className="rounded bg-black px-4 py-2 text-white">
        {state === "sending" ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
