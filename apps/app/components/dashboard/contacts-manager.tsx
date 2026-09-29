"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@stky/ui";
import {
  createContact,
  deleteContact,
  updateContact,
  type ContactRow,
} from "@/lib/server/actions/contacts";

const inputClass =
  "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const labelClass = "text-sm font-medium";

const KNOWN_FROM_CHIPS = ["BNI", "Personal", "Business", "Referral"];

const KIND_LABELS: Record<ContactRow["kind"], string> = {
  contact: "Contact",
  lead: "Lead",
  client: "Client",
};

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

function ContactForm({
  initial,
  onClose,
}: {
  initial?: ContactRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [knownFrom, setKnownFrom] = useState(initial?.knownFrom ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const name = (formData.get("name") as string).trim();
      if (!name) throw new Error("Name is required");
      const birthdayRaw = formData.get("birthday") as string;

      const data = {
        name,
        email: (formData.get("email") as string).trim() || undefined,
        phone: (formData.get("phone") as string).trim() || undefined,
        address: (formData.get("address") as string).trim() || undefined,
        company: (formData.get("company") as string).trim() || undefined,
        knownFrom: knownFrom.trim() || undefined,
        birthday: birthdayRaw ? new Date(birthdayRaw) : undefined,
      };

      if (initial) {
        await updateContact(initial.id, data);
      } else {
        await createContact(data);
      }
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save contact");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {initial ? "Edit contact" : "New contact"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Name *</label>
            <input
              name="name"
              required
              defaultValue={initial?.name ?? ""}
              placeholder="e.g. Jamie Carter"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Email</label>
              <input
                name="email"
                type="email"
                defaultValue={initial?.email ?? ""}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input
                name="phone"
                defaultValue={initial?.phone ?? ""}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Address</label>
            <input
              name="address"
              defaultValue={initial?.address ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Company</label>
            <input
              name="company"
              defaultValue={initial?.company ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Known from</label>
            <input
              name="knownFrom"
              value={knownFrom}
              onChange={(e) => setKnownFrom(e.target.value)}
              placeholder="e.g. BNI, referred by..."
              className={inputClass}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {KNOWN_FROM_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setKnownFrom(chip)}
                  className="rounded-full border border-input bg-background px-3 py-1 text-xs hover:bg-accent"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass}>Birthday</label>
            <input
              name="birthday"
              type="date"
              defaultValue={toDateInputValue(initial?.birthday ?? null)}
              className={inputClass}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : initial ? "Save changes" : "Add contact"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function ContactsManager({ rows }: { rows: ContactRow[] }) {
  const router = useRouter();
  const [formState, setFormState] = useState<
    { mode: "closed" } | { mode: "create" } | { mode: "edit"; row: ContactRow }
  >({ mode: "closed" });
  const [search, setSearch] = useState("");
  const [localRows, setLocalRows] = useState(rows);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return localRows;
    return localRows.filter((row) => row.name.toLowerCase().includes(q));
  }, [localRows, search]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this contact?")) return;
    const previous = localRows;
    setLocalRows((prev) => prev.filter((row) => row.id !== id));
    setPendingDeleteId(id);
    try {
      await deleteContact(id);
      router.refresh();
    } catch (e) {
      setLocalRows(previous);
      throw e;
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contacts</h1>
        {formState.mode === "closed" ? (
          <Button onClick={() => setFormState({ mode: "create" })}>
            + Add contact
          </Button>
        ) : null}
      </div>

      {formState.mode === "create" ? (
        <ContactForm onClose={() => setFormState({ mode: "closed" })} />
      ) : null}
      {formState.mode === "edit" ? (
        <ContactForm
          initial={formState.row}
          onClose={() => setFormState({ mode: "closed" })}
        />
      ) : null}

      <input
        type="search"
        placeholder="Search by name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={inputClass + " max-w-xs"}
      />

      <Card>
        <CardHeader>
          <CardTitle>All contacts, leads & clients</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matches.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Company</th>
                    <th className="text-left p-3 font-medium">Email / Phone</th>
                    <th className="text-left p-3 font-medium">Known from</th>
                    <th className="text-left p-3 font-medium">Birthday</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={`${row.kind}-${row.id}`} className="border-b last:border-0">
                      <td className="p-3 font-medium">{row.name}</td>
                      <td className="p-3 text-muted-foreground">
                        {row.company ?? "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {row.email ?? "—"}
                        {row.phone ? (
                          <span className="block">{row.phone}</span>
                        ) : null}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {row.knownFrom ?? "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {row.birthday
                          ? new Date(row.birthday).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })
                          : "—"}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">
                          {KIND_LABELS[row.kind]}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {row.kind === "contact" ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setFormState({ mode: "edit", row })}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pendingDeleteId === row.id}
                              onClick={() => handleDelete(row.id)}
                            >
                              {pendingDeleteId === row.id ? "Deleting…" : "Delete"}
                            </Button>
                          </div>
                        ) : (
                          <Button asChild variant="ghost" size="sm">
                            <Link href={row.href ?? "#"}>View →</Link>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
