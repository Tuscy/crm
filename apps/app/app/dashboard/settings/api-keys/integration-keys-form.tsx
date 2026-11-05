"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { IntegrationKeyRow } from "@/lib/server/actions/integration-keys";
import {
  createIntegrationKey,
  listIntegrationKeys,
  revokeIntegrationKey,
} from "@/lib/server/actions/integration-keys";
import { Button } from "@stky/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@stky/ui";

function SubmitCreate() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create key"}
    </Button>
  );
}

const SCOPE_OPTIONS: { value: string; label: string }[] = [
  { value: "*", label: "Full access (*)" },
  { value: "leads:read", label: "leads:read" },
  { value: "leads:write", label: "leads:write (create/update)" },
  { value: "leads:delete", label: "leads:delete" },
  { value: "deals:write", label: "deals:write" },
  { value: "analytics:read", label: "analytics:read" },
  { value: "google-ads:read", label: "google-ads:read" },
  { value: "tasks:read", label: "tasks:read" },
  { value: "tasks:write", label: "tasks:write (create/update)" },
  { value: "tasks:delete", label: "tasks:delete" },
];

export function IntegrationKeysForm({
  initialKeys,
}: {
  initialKeys: IntegrationKeyRow[];
}) {
  const [keys, setKeys] = useState(initialKeys);
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(formData: FormData) {
    setError(null);
    setPlainKey(null);
    const name = (formData.get("name") as string)?.trim() || null;
    const raw = formData.getAll("scopes") as string[];
    const scopes =
      raw.includes("*") || raw.length === 0 ? ["*"] : raw.filter(Boolean);

    try {
      const created = await createIntegrationKey(name, scopes);
      setPlainKey(created.plainKey);
      const next = await listIntegrationKeys();
      setKeys(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create key");
    }
  }

  async function onRevoke(id: string) {
    setError(null);
    if (!confirm("Revoke this key? Integrations using it will stop working.")) {
      return;
    }
    try {
      await revokeIntegrationKey(id);
      const next = await listIntegrationKeys();
      setKeys(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke");
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {plainKey && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              Copy this key now
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              It won&apos;t be shown again. Store it in your secrets manager.
            </p>
            <code className="block break-all rounded bg-muted p-3 text-sm">
              {plainKey}
            </code>
            <Button type="button" size="sm" variant="outline" onClick={() => setPlainKey(null)}>
              I&apos;ve saved it
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Create key</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={onCreate} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Label (optional)</label>
              <input
                name="name"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                placeholder="n8n production"
              />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Scopes</p>
              <div className="flex flex-wrap gap-3">
                {SCOPE_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input type="checkbox" name="scopes" value={o.value} defaultChecked={o.value === "*"} />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>
            <SubmitCreate />
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Existing keys</CardTitle>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No keys yet.</p>
          ) : (
            <ul className="divide-y">
              {keys.map((k) => (
                <li key={k.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-mono text-sm">
                      {k.keyPrefix}…
                      {k.revokedAt && (
                        <span className="text-destructive ml-2">revoked</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {k.name ?? "—"} ·{" "}
                      {k.scopes.includes("*")
                        ? "*"
                        : k.scopes.join(", ")}{" "}
                      · last used{" "}
                      {k.lastUsedAt
                        ? new Date(k.lastUsedAt).toLocaleString()
                        : "never"}
                    </div>
                  </div>
                  {!k.revokedAt && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => onRevoke(k.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
