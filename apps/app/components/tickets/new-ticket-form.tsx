"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@stky/ui";
import { createTicketAction } from "@/lib/server/actions/tickets";

type ClientOption = { id: string; name: string; sites: { id: string; label: string }[] };

const TYPES = ["SITE_CHANGE", "BUG", "CONTENT", "HOSTING_UPTIME", "SEO_ADS_REPORTING", "BILLING_ADMIN", "INTERNAL", "OTHER"];
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];
const field = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function NewTicketForm({ clients, initialClientId }: { clients: ClientOption[]; initialClientId?: string }) {
  const router = useRouter();
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sites = clients.find((c) => c.id === clientId)?.sites ?? [];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const res = await createTicketAction({
      clientId,
      siteId: String(form.get("siteId") ?? ""),
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      type: String(form.get("type") ?? ""),
      priority: String(form.get("priority") ?? ""),
      requesterName: String(form.get("requesterName") ?? ""),
      requesterEmail: String(form.get("requesterEmail") ?? ""),
    });
    setPending(false);
    if (!res.ok) return setError(res.error);
    router.push(`/dashboard/tickets/${res.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-2xl">
      <div>
        <label className="text-sm font-medium">Client</label>
        <select required value={clientId} onChange={(e) => setClientId(e.target.value)} className={field}>
          <option value="">Select a client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      {sites.length > 0 ? (
        <div>
          <label className="text-sm font-medium">Site (optional)</label>
          <select name="siteId" className={field} defaultValue="">
            <option value="">No specific site</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      ) : null}
      <div>
        <label className="text-sm font-medium">Title</label>
        <input name="title" required maxLength={200} className={field} />
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <textarea name="description" required rows={6} className={field} />
        <p className="mt-1 text-xs text-muted-foreground">Don&apos;t paste passwords or keys here.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Type</label>
          <select name="type" defaultValue="OTHER" className={field}>
            {TYPES.map((t) => (<option key={t} value={t}>{t.replace(/_/g, " ").toLowerCase()}</option>))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Priority</label>
          <select name="priority" defaultValue="NORMAL" className={field}>
            {PRIORITIES.map((p) => (<option key={p} value={p}>{p.toLowerCase()}</option>))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Requester name</label>
          <input name="requesterName" className={field} />
        </div>
        <div>
          <label className="text-sm font-medium">Requester email</label>
          <input name="requesterEmail" type="email" className={field} />
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create ticket"}</Button>
    </form>
  );
}
