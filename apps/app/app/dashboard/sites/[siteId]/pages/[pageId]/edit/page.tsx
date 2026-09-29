import Link from "next/link";
import { notFound } from "next/navigation";
import { getPageEditorBundle, togglePagePublished } from "@/lib/server/actions/sites";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@stky/ui";
import { SectionEditor } from "@/components/sites/section-editor";

export default async function EditPagePage({
  params,
}: {
  params: Promise<{ siteId: string; pageId: string }>;
}) {
  const { siteId, pageId } = await params;
  const bundle = await getPageEditorBundle(pageId);
  if (!bundle || bundle.siteId !== siteId) notFound();

  const webBase = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3001";
  const path = bundle.slug ? `/${bundle.slug}` : "/";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/dashboard/sites/${siteId}/pages`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Pages
          </Link>
          <h1 className="mt-1 text-2xl font-bold">
            Edit page{" "}
            <span className="font-mono text-lg">
              {bundle.slug === "" ? "(home)" : bundle.slug}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Client: {bundle.site.client.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a
              href={`${webBase}${path}?siteId=${siteId}`}
              target="_blank"
              rel="noreferrer"
            >
              Open preview
            </a>
          </Button>
          <form>
            <input type="hidden" name="pageId" value={pageId} />
            <input type="hidden" name="published" value={bundle.published ? "0" : "1"} />
            <Button
              type="submit"
              variant={bundle.published ? "secondary" : "default"}
              size="sm"
              formAction={async (fd) => {
                "use server";
                const id = fd.get("pageId") as string;
                const pub = fd.get("published") === "1";
                await togglePagePublished(id, pub);
              }}
            >
              {bundle.published ? "Unpublish" : "Publish"}
            </Button>
          </form>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sections</CardTitle>
        </CardHeader>
        <CardContent>
          <SectionEditor sections={bundle.sections} pageId={pageId} />
        </CardContent>
      </Card>
    </div>
  );
}
