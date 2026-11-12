import { listIntegrationKeys, listSitesForKeys } from "@/lib/server/actions/integration-keys";
import { currentStaffCan } from "@/lib/server/guard";
import { IntegrationKeysForm } from "./integration-keys-form";

export default async function IntegrationApiKeysPage() {
  if (!(await currentStaffCan("integration:read"))) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold">Integration API keys</h1>
          <p className="text-sm text-muted-foreground mt-2">
            You need admin access to view and manage API keys.
          </p>
        </div>
      </div>
    );
  }

  const [keys, sites] = await Promise.all([listIntegrationKeys(), listSitesForKeys()]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Integration API keys</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Scoped keys for automation (`Authorization: Bearer …` or `x-api-key`).
          The legacy <code className="text-xs">CRM_API_KEY</code> env is still
          supported but should be rotated away.
        </p>
      </div>
      <IntegrationKeysForm initialKeys={keys} sites={sites} />
    </div>
  );
}
