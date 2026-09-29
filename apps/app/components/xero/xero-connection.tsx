"use client";

import { useState } from "react";
import { Button } from "@stky/ui";
import { disconnectXero, type XeroConnectionStatus } from "@/lib/server/actions/xero";

export function XeroConnection({
  status,
  configured,
}: {
  status: XeroConnectionStatus;
  configured: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onDisconnect() {
    if (!confirm("Disconnect Xero? Invoices will stop showing on client pages.")) return;
    setBusy(true);
    setError(null);
    try {
      await disconnectXero();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <p className="text-sm text-muted-foreground">
        Set <code>XERO_CLIENT_ID</code>, <code>XERO_CLIENT_SECRET</code> and{" "}
        <code>XERO_OAUTH_REDIRECT_URL</code> in <code>.env</code> to enable connecting.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {status.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p>
              Connected to{" "}
              <span className="font-medium">{status.tenantName ?? "Xero organisation"}</span>
            </p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Since {new Date(status.connectedAt).toLocaleString("en-GB")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="/api/oauth/xero">Reconnect</a>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onDisconnect} disabled={busy}>
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Xero is not connected.</p>
          <Button asChild>
            <a href="/api/oauth/xero">Connect Xero</a>
          </Button>
        </div>
      )}
    </div>
  );
}
