import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@stky/db";
import { listPagesForSite, createPage } from "@/lib/server/actions/sites";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@stky/ui";

export default async function SitePagesPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { client: true },
  });
  if (!site) notFound();

  const pages = await listPagesForSite(siteId);
  const webBase = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3001";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/sites"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Sites
        </Link>
        <h1 className="mt-1 text-2xl font-bold">
          Pages — {site.client.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Preview:{" "}
          <a
            href={`${webBase}/?siteId=${site.id}`}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            {webBase}/?siteId={site.id}
          </a>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New page</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (fd) => {
              "use server";
              await createPage(siteId, fd);
            }}
            className="flex flex-wrap items-end gap-4"
          >
            <div>
              <label className="mb-1 block text-sm font-medium">Slug</label>
              <input
                name="slug"
                placeholder="empty = home"
                className="w-56 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Use <code>about</code> or <code>legal/privacy</code>; leave blank for home.
              </p>
            </div>
            <Button type="submit">Create</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pages</CardTitle>
        </CardHeader>
        <CardContent>
          {pages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pages yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {pages.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2"
                >
                  <span>
                    <span className="font-mono">{p.slug === "" ? "(home)" : p.slug}</span>
                    <span className="ml-2 text-muted-foreground">
                      {p.published ? "published" : "draft"} · {p._count.sections} sections
                    </span>
                  </span>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/sites/${siteId}/pages/${p.id}/edit`}>Edit</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
