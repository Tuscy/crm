"use client";

import { useState } from "react";
import { Button } from "@stky/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@stky/ui";
import { upsertLeadConversion } from "@/lib/server/actions/lead-conversions";
import type { LeadConversion } from "@stky/db";
import { PACKAGE_DISPLAY_LABELS, type PackageType } from "@stky/crm";

const PACKAGE_OPTIONS = [
  { value: "", label: PACKAGE_DISPLAY_LABELS.NONE },
  { value: "VOLTAGE", label: PACKAGE_DISPLAY_LABELS.VOLTAGE },
  { value: "CHARGE", label: PACKAGE_DISPLAY_LABELS.CHARGE },
  { value: "GRID", label: PACKAGE_DISPLAY_LABELS.GRID },
] as const;

const inputClass =
  "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function formatDateInput(value: Date | null | undefined) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export function LeadConversionForm({
  leadId,
  initial,
}: {
  leadId: string;
  initial: LeadConversion | null;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const packageRaw = (formData.get("package") as string) ?? "";
      const purchaseDateRaw = (formData.get("purchaseDate") as string) ?? "";
      const agreedDetailsRaw = (formData.get("agreedDetails") as string) ?? "";

      await upsertLeadConversion(leadId, {
        package:
          packageRaw === ""
            ? null
            : (packageRaw as "VOLTAGE" | "CHARGE" | "GRID"),
        purchaseDate: purchaseDateRaw ? new Date(purchaseDateRaw) : null,
        agreedDetails: agreedDetailsRaw.trim() || null,
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
        <CardTitle>Conversion details</CardTitle>
        <p className="text-sm text-muted-foreground">
          Record what the lead agreed to before they become a client.
        </p>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4 max-w-lg">
          <div>
            <label className="text-sm font-medium">Package</label>
            <select
              name="package"
              defaultValue={initial?.package ?? ""}
              className={`${inputClass} max-w-xs`}
            >
              {PACKAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Date of purchase</label>
            <input
              name="purchaseDate"
              type="date"
              defaultValue={formatDateInput(initial?.purchaseDate)}
              className={`${inputClass} max-w-xs`}
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              Details of what client agreed to
            </label>
            <textarea
              name="agreedDetails"
              rows={6}
              defaultValue={initial?.agreedDetails ?? ""}
              placeholder="Services, scope, price agreed, etc."
              className={inputClass}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {saved ? <p className="text-sm text-green-600">Saved.</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save conversion"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
