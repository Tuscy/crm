"use client";

import { useState } from "react";
import { setClientXeroContact } from "@/lib/server/actions/xero";
import type { XeroContact } from "@/lib/xero/client";

type ClientRow = { id: string; name: string; xeroContactId: string | null };

export function XeroContactMappingForm({
  clients,
  contacts,
}: {
  clients: ClientRow[];
  contacts: XeroContact[];
}) {
  const [rows, setRows] = useState(clients);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const contactIds = new Set(contacts.map((c) => c.contactId));

  async function onChange(clientId: string, xeroContactId: string) {
    setError(null);
    setSavingId(clientId);
    try {
      await setClientXeroContact(clientId, xeroContactId || null);
      setRows((prev) =>
        prev.map((r) => (r.id === clientId ? { ...r, xeroContactId: xeroContactId || null } : r))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4">CRM client</th>
              <th className="py-2 pr-4">Xero contact</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-4 text-muted-foreground">
                  No clients yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const stale = r.xeroContactId !== null && !contactIds.has(r.xeroContactId);
                return (
                  <tr key={r.id} className="border-b">
                    <td className="py-2 pr-4 font-medium">{r.name}</td>
                    <td className="py-2 pr-4">
                      <select
                        value={r.xeroContactId ?? ""}
                        onChange={(e) => onChange(r.id, e.target.value)}
                        disabled={savingId === r.id}
                        className="w-full max-w-xs rounded-md border px-3 py-2 text-sm bg-background"
                      >
                        <option value="">— Not mapped —</option>
                        {stale && (
                          <option value={r.xeroContactId!}>
                            Unknown contact ({r.xeroContactId!.slice(0, 8)}…)
                          </option>
                        )}
                        {contacts.map((c) => (
                          <option key={c.contactId} value={c.contactId}>
                            {c.name}
                            {c.email ? ` (${c.email})` : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {savingId === r.id
                        ? "Saving…"
                        : stale
                          ? "Not found in this Xero organisation"
                          : ""}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
