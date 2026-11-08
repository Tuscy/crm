"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@stky/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@stky/ui";
import { findOrCreateClientFromDeal } from "@/lib/server/actions/clients";

type DealWithLead = {
  id: string;
  stage: string;
  lead: {
    id: string;
    name: string;
    email: string;
    company: string | null;
    clientId: string | null;
  };
};

export function DealToClientConversion({ deal }: { deal: DealWithLead }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show for Won deals without linked client
  if (deal.stage !== "WON" || deal.lead.clientId) {
    return null;
  }

  async function handleConvert() {
    if (
      !confirm(
        `Convert this won deal to a client?\n\nThis will check for duplicate clients and either link to an existing client or create a new one for:\n${deal.lead.company || deal.lead.name} (${deal.lead.email})`
      )
    ) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const client = await findOrCreateClientFromDeal(deal.id);
      if (client) {
        router.push(`/dashboard/clients/${client.id}`);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to convert deal");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border-green-200 bg-green-50">
      <CardHeader>
        <CardTitle className="text-base text-green-900">
          Convert to Client
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-green-800 mb-4">
          This deal is won! Convert it to a client record to manage ongoing
          services, invoicing, and project work.
        </p>
        {error ? (
          <p className="text-sm text-destructive mb-4" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="button"
          onClick={handleConvert}
          disabled={pending}
          className="bg-green-600 hover:bg-green-700"
        >
          {pending ? "Converting…" : "Convert to Client"}
        </Button>
        <p className="text-xs text-green-700 mt-2">
          Duplicate check: Email-based matching to avoid duplicate clients
        </p>
      </CardContent>
    </Card>
  );
}
