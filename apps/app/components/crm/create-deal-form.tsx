"use client";

import { useState } from "react";
import { Button } from "@stky/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@stky/ui";
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  PACKAGE_DISPLAY_LABELS,
} from "@stky/crm";
import { createDeal } from "@/lib/server/actions/deals";

const inputClass = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const labelClass = "text-sm font-medium";

export function CreateDealForm({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [probability, setProbability] = useState(50);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Add deal
      </Button>
    );
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const stage = formData.get("stage") as string;
      const valueRaw = formData.get("value") as string;
      const closeDateRaw = formData.get("closeDate") as string;
      const packageType = (formData.get("packageType") as string) || undefined;

      await createDeal(
        leadId,
        stage,
        valueRaw ? Number(valueRaw) : undefined,
        {
          closeDate: closeDateRaw ? new Date(closeDateRaw) : undefined,
          probability,
          packageType: (packageType as "VOLTAGE" | "CHARGE" | "GRID") || undefined,
        }
      );
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create deal");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New deal</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Stage</label>
            <select name="stage" required className={inputClass}>
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {PIPELINE_STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Value (£)</label>
            <input
              name="value"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Close date</label>
            <input name="closeDate" type="date" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>
              Probability — {probability}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={probability}
              onChange={(e) => setProbability(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </div>
          <div>
            <label className={labelClass}>Package</label>
            <select name="packageType" className={inputClass} defaultValue="">
              <option value="">{PACKAGE_DISPLAY_LABELS.NONE}</option>
              <option value="VOLTAGE">{PACKAGE_DISPLAY_LABELS.VOLTAGE}</option>
              <option value="CHARGE">{PACKAGE_DISPLAY_LABELS.CHARGE}</option>
              <option value="GRID">{PACKAGE_DISPLAY_LABELS.GRID}</option>
            </select>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Creating…" : "Create deal"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
