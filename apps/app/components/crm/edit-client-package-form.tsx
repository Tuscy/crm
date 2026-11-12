"use client";

import { useState } from "react";
import { Button } from "@stky/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@stky/ui";
import { updateClientPackageAndServices } from "@/lib/server/actions/clients";
import { PACKAGE_DISPLAY_LABELS, type PackageType } from "@stky/crm";

const PACKAGE_OPTIONS = [
  { value: "", label: PACKAGE_DISPLAY_LABELS.NONE },
  { value: "VOLTAGE", label: PACKAGE_DISPLAY_LABELS.VOLTAGE },
  { value: "CHARGE", label: PACKAGE_DISPLAY_LABELS.CHARGE },
  { value: "GRID", label: PACKAGE_DISPLAY_LABELS.GRID },
] as const;

const SERVICE_OPTIONS = [
  { value: "BRANDING", label: "Branding" },
  { value: "WEB", label: "Web" },
  { value: "ADS", label: "Google Ads" },
] as const;

export function EditClientPackageForm({
  clientId,
  initialPackage,
  initialServices,
}: {
  clientId: string;
  initialPackage: string | null;
  initialServices: string[];
}) {
  const [packageType, setPackageType] = useState(initialPackage ?? "");
  const [services, setServices] = useState<string[]>(initialServices);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggleService(type: string) {
    setServices((prev) =>
      prev.includes(type) ? prev.filter((s) => s !== type) : [...prev, type]
    );
    setSaved(false);
  }

  async function handleSave() {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await updateClientPackageAndServices(clientId, {
        package:
          (packageType as "VOLTAGE" | "CHARGE" | "GRID" | "") || null,
        services: services as ("BRANDING" | "WEB" | "ADS")[],
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Package &amp; services</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium">Package</label>
          <select
            value={packageType}
            onChange={(e) => {
              setPackageType(e.target.value);
              setSaved(false);
            }}
            className="mt-1 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {PACKAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-sm font-medium mb-2">Active services</p>
          <div className="flex flex-wrap gap-3">
            {SERVICE_OPTIONS.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={services.includes(o.value)}
                  onChange={() => toggleService(o.value)}
                />
                {o.label}
              </label>
            ))}
          </div>
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="text-sm text-green-600">Saved.</p>
        ) : null}
        <Button type="button" size="sm" onClick={() => void handleSave()} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
