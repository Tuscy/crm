import { listIntegrationKeys } from "@/lib/server/actions/integration-keys";
import { IntegrationKeysForm } from "./integration-keys-form";

export default async function IntegrationApiKeysPage() {
  const keys = await listIntegrationKeys();

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
      <IntegrationKeysForm initialKeys={keys} />
    </div>
  );
}
