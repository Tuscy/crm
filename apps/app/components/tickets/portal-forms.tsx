"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@stky/ui";
import { createClientTicket, replyToClientTicket } from "@/lib/server/actions/client-tickets";

const field = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function PortalNewTicketForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const res = await createClientTicket({ title: String(form.get("title") ?? ""), description: String(form.get("description") ?? "") });
    setPending(false);
    if (!res.ok) return setError(res.error);
    router.push(`/client/tickets/${res.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="text-sm font-medium">What do you need?</label>
        <input name="title" required maxLength={200} className={field} />
      </div>
      <div>
        <label className="text-sm font-medium">Tell us more</label>
        <textarea name="description" required rows={5} className={field} />
        <p className="mt-1 text-xs text-muted-foreground">Please don&apos;t include passwords or keys.</p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send"}</Button>
    </form>
  );
}

export function PortalReplyForm({ id }: { id: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await replyToClientTicket({ id, body });
    setPending(false);
    if (!res.ok) return setError(res.error);
    setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} required className={field} placeholder="Write a reply…" />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending || !body.trim()}>{pending ? "Sending…" : "Send reply"}</Button>
    </form>
  );
}
