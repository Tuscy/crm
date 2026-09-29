import Link from "next/link";
import { listSites, createSite } from "@/lib/server/actions/sites";
import { getClients } from "@/lib/server/actions/clients";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@stky/ui";

export default async function SitesPage() {
  const [sites, clients] = await Promise.all([listSites(), getClients()]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Sites</h1>
        <p className="text-sm text-muted-foreground">
          Multi-tenant sites map to <code className="rounded bg-muted px-1">customDomain</code> or{" "}
          <code className="rounded bg-muted px-1">subdomain</code> + ROOT_DOMAIN on the web app.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create site</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createSite} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Client</label>
              <select
                name="clientId"
                required
                className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
                defaultValue=""
              >
                <option value="" disabled>
                  Select client…
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Subdomain (optional)</label>
              <input
                name="subdomain"
                placeholder="acme"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Custom domain (optional)</label>
              <input
                name="customDomain"
                placeholder="www.example.com"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Internal slug / label (optional)</label>
              <input
                name="slug"
                placeholder="main-site"
                className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Create site</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All sites</CardTitle>
        </CardHeader>
        <CardContent>
          {sites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sites yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2">Client</th>
                    <th className="p-2">Subdomain</th>
                    <th className="p-2">Domain</th>
                    <th className="p-2">Pages</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {sites.map((s) => (
                    <tr key={s.id} className="border-b">
                      <td className="p-2">{s.client.name}</td>
                      <td className="p-2 font-mono text-xs">{s.subdomain ?? "—"}</td>
                      <td className="p-2 font-mono text-xs">{s.customDomain ?? "—"}</td>
                      <td className="p-2">{s._count.pages}</td>
                      <td className="p-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/sites/${s.id}/pages`}>Pages</Link>
                        </Button>
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
