import Link from "next/link";
import { getCurrentMembership } from "@stky/auth";
import { Button } from "@stky/ui";
import { clientLogout } from "@/lib/server/actions/client-auth";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const clientUser = await getCurrentMembership();

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-14 items-center px-4 justify-between">
          <div className="flex items-center gap-4">
            <Link href="/client" className="font-semibold">
              Client Portal
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link
                href="/client"
                className="text-muted-foreground hover:text-foreground"
              >
                Dashboard
              </Link>
              <Link
                href="/client/leads"
                className="text-muted-foreground hover:text-foreground"
              >
                Leads
              </Link>
              <Link
                href="/client/tickets"
                className="text-muted-foreground hover:text-foreground"
              >
                Requests
              </Link>
              <Link
                href="/client/analytics"
                className="text-muted-foreground hover:text-foreground"
              >
                Analytics
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {clientUser ? (
              <>
                <span className="text-muted-foreground hidden sm:inline">
                  {clientUser.client.name}
                </span>
                <form action={clientLogout}>
                  <Button type="submit" size="sm" variant="outline">
                    Sign out
                  </Button>
                </form>
              </>
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link href="/client/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4">{children}</main>
    </div>
  );
}

