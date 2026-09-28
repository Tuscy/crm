import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@stky/ui";
import { getClients } from "@/lib/server/actions/clients";
import { getXeroConnectionStatus, listXeroContacts } from "@/lib/server/actions/xero";
import type { XeroContact } from "@/lib/xero/client";
import { xeroOAuthConfigured } from "@/lib/xero/oauth";
import { XeroConnection } from "@/components/xero/xero-connection";
import { XeroContactMappingForm } from "@/components/xero/xero-contact-mapping-form";

export const dynamic = "force-dynamic";

const ERROR_HELP: Record<string, string> = {
  access_denied: "Access was declined on Xero's consent screen.",
  invalid_state: "The connect request expired or didn't start here. Try connecting again.",
  multiple_organisations:
    "More than one organisation was selected. Connect again and choose only one.",
  no_organisation: "No organisation was authorised. Connect again and pick an organisation.",
};

export default async function XeroSettingsPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string };
}) {
  const [status, allClients] = await Promise.all([
    getXeroConnectionStatus(),
    getClients(),
  ]);

  let contacts: XeroContact[] = [];
  let contactsError: string | null = null;
  if (status.connected) {
    try {
      contacts = await listXeroContacts();
    } catch (err) {
      console.error("Xero contacts fetch failed:", err);
      contactsError = "Couldn't load contacts from Xero. Try reconnecting.";
    }
  }

  const clients = allClients.map((c) => ({
    id: c.id,
    name: c.name,
    xeroContactId: c.xeroContactId,
  }));

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/dashboard/settings"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to Settings
        </Link>
        <h1 className="text-2xl font-bold mt-1">Xero settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect the StickySites Xero organisation (read-only) and map each client
          to their Xero contact so their invoices show on the client page. The
          refresh token is encrypted at rest.
        </p>
      </div>

      {searchParams.connected && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          ✓ Xero connected successfully.
        </div>
      )}

      {searchParams.error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          OAuth error: <code>{searchParams.error}</code>
          {ERROR_HELP[searchParams.error] && (
            <p className="mt-1">{ERROR_HELP[searchParams.error]}</p>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection</CardTitle>
        </CardHeader>
        <CardContent>
          <XeroConnection status={status} configured={xeroOAuthConfigured()} />
        </CardContent>
      </Card>

      {status.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client → Xero contact mapping</CardTitle>
          </CardHeader>
          <CardContent>
            {contactsError ? (
              <p className="text-sm text-destructive">{contactsError}</p>
            ) : (
              <XeroContactMappingForm clients={clients} contacts={contacts} />
            )}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Only one Xero organisation can be connected. Connecting a different
        organisation replaces the current one — contact mappings are kept but
        won&apos;t match the new organisation&apos;s contacts.
      </p>
    </div>
  );
}
