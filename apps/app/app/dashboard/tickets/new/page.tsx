import Link from "next/link";
import { prisma } from "@stky/db";
import { requirePermission } from "@/lib/server/guard";
import { NewTicketForm } from "@/components/tickets/new-ticket-form";

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  await requirePermission("ticket:create", { entity: "Ticket" });
  const { clientId } = await searchParams;
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      sites: { select: { id: true, slug: true, customDomain: true, subdomain: true } },
    },
  });
  const options = clients.map((c) => ({
    id: c.id,
    name: c.name,
    sites: c.sites.map((s) => ({
      id: s.id,
      label: s.customDomain ?? s.subdomain ?? s.slug ?? s.id,
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/tickets" className="text-sm text-muted-foreground hover:text-foreground">← Back to tickets</Link>
        <h1 className="text-2xl font-bold mt-1">New ticket</h1>
      </div>
      <NewTicketForm clients={options} initialClientId={clientId} />
    </div>
  );
}
