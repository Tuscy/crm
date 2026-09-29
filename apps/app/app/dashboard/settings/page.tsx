import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@stky/ui";
import { prisma } from "@stky/db";

function envSet(key: string): boolean {
  return Boolean(process.env[key]?.trim());
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        ok ? "bg-green-500" : "bg-muted-foreground/40"
      }`}
    />
  );
}

function SettingsCard({
  title,
  description,
  href,
  status,
}: {
  title: string;
  description: string;
  href: string;
  status?: React.ReactNode;
}) {
  return (
    <Link href={href} className="block group">
      <Card className="transition-colors group-hover:border-ring">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between gap-2">
            {title}
            {status}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function SettingsPage() {
  const xeroConnected =
    envSet("XERO_CLIENT_ID") &&
    envSet("XERO_CLIENT_SECRET") &&
    (await prisma.xeroCredential.count()) > 0;

  const adsReady =
    envSet("GOOGLE_ADS_DEVELOPER_TOKEN") &&
    envSet("GOOGLE_ADS_CLIENT_ID") &&
    envSet("GOOGLE_ADS_CLIENT_SECRET") &&
    envSet("GOOGLE_ADS_REFRESH_TOKEN");

  const analyticsReady =
    envSet("GOOGLE_CLIENT_ID") &&
    envSet("GOOGLE_CLIENT_SECRET") &&
    envSet("ENCRYPTION_KEY");

  const webhookUrl = process.env.CRM_WEBHOOK_URL?.trim() ?? "";
  const n8nUrl = process.env.N8N_BASE_URL?.trim() ?? "";
  const resendKey = envSet("RESEND_API_KEY");

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform configuration and integrations.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsCard
          title="Google Ads"
          description="Manager account ID and per-client account mappings."
          href="/dashboard/google-ads/settings"
          status={<StatusDot ok={adsReady} />}
        />

        <SettingsCard
          title="Analytics"
          description="Connect GA4 properties and Search Console sites."
          href="/dashboard/settings/analytics"
          status={<StatusDot ok={analyticsReady} />}
        />

        <SettingsCard
          title="Xero"
          description="Connect Xero and map clients to Xero contacts for invoice status."
          href="/dashboard/settings/xero"
          status={<StatusDot ok={xeroConnected} />}
        />

        <SettingsCard
          title="API Keys"
          description="Scoped integration keys for automation and webhooks."
          href="/dashboard/settings/api-keys"
        />

        {/* Webhooks & Automations — read-only env status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between gap-2">
              Webhooks &amp; Automations
              <StatusDot ok={Boolean(webhookUrl || n8nUrl)} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <StatusDot ok={Boolean(webhookUrl)} />
              <span className="text-muted-foreground">
                Outbound webhook:{" "}
                {webhookUrl ? (
                  <code className="text-xs">{webhookUrl}</code>
                ) : (
                  <span className="italic">not set</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot ok={Boolean(n8nUrl)} />
              <span className="text-muted-foreground">
                n8n:{" "}
                {n8nUrl ? (
                  <code className="text-xs">{n8nUrl}</code>
                ) : (
                  <span className="italic">not set</span>
                )}
              </span>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Set <code>CRM_WEBHOOK_URL</code>, <code>CRM_WEBHOOK_SECRET</code>,
              and <code>N8N_BASE_URL</code> in <code>.env</code>.
            </p>
          </CardContent>
        </Card>

        {/* Email — read-only env status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between gap-2">
              Email (Resend)
              <StatusDot ok={resendKey} />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="flex items-center gap-2">
              <StatusDot ok={resendKey} />
              <span className="text-muted-foreground">
                API key:{" "}
                {resendKey ? (
                  <span className="text-green-600">configured</span>
                ) : (
                  <span className="italic">not set</span>
                )}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <StatusDot ok={envSet("RESEND_FROM_EMAIL")} />
              <span className="text-muted-foreground text-xs">
                From: {process.env.RESEND_FROM_EMAIL ?? <em>not set</em>}
              </span>
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              Set <code>RESEND_API_KEY</code> and <code>RESEND_FROM_EMAIL</code>{" "}
              in <code>.env</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
