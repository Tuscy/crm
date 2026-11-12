"use client";

import { useState } from "react";
import { Button } from "@stky/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@stky/ui";
import { resolveLeadSourceFromForm } from "@stky/crm";
import { createLead } from "@/lib/server/actions/leads";
import { LeadSourceFields } from "@/components/crm/lead-source-fields";

const inputClass =
  "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

type StaffUser = {
  id: string;
  name: string | null;
  email: string;
};

export function CreateLeadForm({ staffUsers = [] }: { staffUsers?: StaffUser[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      const followUpDateRaw = formData.get("followUpDate") as string;
      await createLead({
        name: formData.get("name") as string,
        email: formData.get("email") as string,
        phone: (formData.get("phone") as string) || undefined,
        company: (formData.get("company") as string) || undefined,
        website: (formData.get("website") as string) || undefined,
        source: resolveLeadSourceFromForm(
          (formData.get("sourceSelect") as string) ?? "",
          (formData.get("sourceCustom") as string) ?? ""
        ),
        status: (formData.get("status") as string) || "NEW",
        ownerId: (formData.get("ownerId") as string) || undefined,
        nextAction: (formData.get("nextAction") as string) || undefined,
        followUpDate: followUpDateRaw ? new Date(followUpDateRaw) : undefined,
      });
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add lead</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name *</label>
            <input name="name" required className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium">Email *</label>
            <input name="email" type="email" required className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium">Phone</label>
            <input name="phone" type="tel" className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium">Company</label>
            <input name="company" className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium">Website</label>
            <input name="website" type="url" className={inputClass} />
          </div>
          <LeadSourceFields idPrefix="create-" />
          <div>
            <label className="text-sm font-medium">Status</label>
            <input
              name="status"
              defaultValue="NEW"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Owner (optional)</label>
            <select name="ownerId" className={inputClass} defaultValue="">
              <option value="">Unassigned</option>
              {staffUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Next action (optional)</label>
            <textarea
              name="nextAction"
              rows={2}
              placeholder="e.g. Call to discuss requirements"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Follow-up date (optional)</label>
            <input name="followUpDate" type="date" className={inputClass} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
