"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@stky/ui";
import { getInvoicesForClient, type ClientInvoicesResult } from "@/lib/server/actions/xero";

const STATUS_STYLES: Record<string, string> = {
  PAID: "bg-green-100 text-green-800",
  AUTHORISED: "bg-amber-100 text-amber-800",
  SUBMITTED: "bg-blue-100 text-blue-800",
  DRAFT: "bg-muted text-muted-foreground",
  VOIDED: "bg-muted text-muted-foreground line-through",
};

const STATUS_LABELS: Record<string, string> = {
  AUTHORISED: "Awaiting payment",
  SUBMITTED: "Awaiting approval",
};

function money(v: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(v);
}

function formatDate(d: string | null) {
  return d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB") : "—";
}

function isOverdue(status: string, dueDate: string | null) {
  return status === "AUTHORISED" && !!dueDate && dueDate < new Date().toISOString().slice(0, 10);
}

/** Live from Xero on page load — same pattern as the reporting sections. */
export function ClientInvoicesCard({ clientId }: { clientId: string }) {
  const [result, setResult] = useState<ClientInvoicesResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await getInvoicesForClient(clientId));
    } catch {
      setResult({ status: "error", error: "Failed to load invoices from Xero" });
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices (Xero)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!loading && result?.status === "not_connected" && (
          <p className="text-sm text-muted-foreground">
            Xero is not connected.{" "}
            <Link href="/dashboard/settings/xero" className="underline hover:text-foreground">
              Connect Xero →
            </Link>
          </p>
        )}

        {!loading && result?.status === "not_mapped" && (
          <p className="text-sm text-muted-foreground">
            This client isn&apos;t mapped to a Xero contact.{" "}
            <Link href="/dashboard/settings/xero" className="underline hover:text-foreground">
              Map in settings →
            </Link>
          </p>
        )}

        {!loading && result?.status === "error" && (
          <p className="text-sm text-destructive">{result.error}</p>
        )}

        {!loading && result?.status === "ok" && result.invoices.length === 0 && (
          <p className="text-sm text-muted-foreground">No invoices for this contact in Xero.</p>
        )}

        {!loading && result?.status === "ok" && result.invoices.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Number</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Due</th>
                  <th className="py-2 pr-3 text-right">Total</th>
                  <th className="py-2 pr-3 text-right">Outstanding</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {result.invoices.map((inv) => {
                  const overdue = isOverdue(inv.status, inv.dueDate);
                  return (
                    <tr key={inv.invoiceId} className="border-b">
                      <td className="py-2 pr-3 font-medium">{inv.number ?? "Draft"}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            overdue
                              ? "bg-red-100 text-red-800"
                              : STATUS_STYLES[inv.status] ?? "bg-muted text-muted-foreground"
                          }`}
                        >
                          {overdue ? "Overdue" : STATUS_LABELS[inv.status] ?? inv.status.charAt(0) + inv.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="py-2 pr-3">{formatDate(inv.dueDate)}</td>
                      <td className="py-2 pr-3 text-right">{money(inv.total, inv.currency)}</td>
                      <td className="py-2 pr-3 text-right">{money(inv.amountDue, inv.currency)}</td>
                      <td className="py-2 text-right">
                        <a
                          href={inv.xeroUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs underline hover:text-foreground text-muted-foreground"
                        >
                          Open in Xero ↗
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
