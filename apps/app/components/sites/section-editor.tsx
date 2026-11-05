"use client";

import { useCan } from "@/lib/use-can";
import type { Section } from "@stky/db";
import { Button } from "@stky/ui";
import {
  addSectionFromForm,
  deleteSectionFromForm,
  saveSectionFromForm,
} from "@/lib/server/actions/sites";
import { sectionTypeKeys } from "@stky/sites";

export function SectionEditor({
  sections,
  pageId,
}: {
  sections: Section[];
  pageId: string;
}) {
  const canDelete = useCan("site:delete");
  return (
    <div className="space-y-6">
      <form action={addSectionFromForm} className="flex flex-wrap items-end gap-2 rounded-lg border p-4">
        <input type="hidden" name="pageId" value={pageId} />
        <div>
          <label className="mb-1 block text-sm font-medium">Add section</label>
          <select
            name="type"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue="hero"
          >
            {sectionTypeKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit">Add</Button>
      </form>

      {sections.map((s) => (
        <div key={s.id} className="rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-sm font-medium">
              <span className="font-mono">{s.type}</span>
              <span className="ml-2 text-muted-foreground">order {s.order}</span>
            </div>
            {canDelete && (
              <form action={deleteSectionFromForm}>
                <input type="hidden" name="sectionId" value={s.id} />
                <Button type="submit" variant="destructive" size="sm">
                  Delete
                </Button>
              </form>
            )}
          </div>
          <form action={saveSectionFromForm} className="space-y-2">
            <input type="hidden" name="sectionId" value={s.id} />
            <textarea
              name="json"
              rows={8}
              defaultValue={JSON.stringify(s.content, null, 2)}
              className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
            />
            <Button type="submit" size="sm">
              Save JSON
            </Button>
          </form>
        </div>
      ))}
    </div>
  );
}
