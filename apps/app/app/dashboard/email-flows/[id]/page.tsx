import { notFound } from "next/navigation";
import { getEmailFlowById } from "@/lib/email-flows/flows";
import { getEmailTemplates } from "@/lib/email-flows/templates";
import { getStaffUsers } from "@/lib/server/actions/tasks";
import { FlowEditor } from "@/components/email-flows/flow-editor";
import { parseSteps } from "@/lib/email-flows/types";

export default async function FlowEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const flow = await getEmailFlowById(id);
  if (!flow) notFound();

  const [templates, staff] = await Promise.all([
    getEmailTemplates(),
    getStaffUsers(),
  ]);

  return (
    <FlowEditor
      flow={{
        id: flow.id,
        name: flow.name,
        description: flow.description,
        trigger: flow.trigger,
        triggerConfig: (flow.triggerConfig as Record<string, unknown>) ?? null,
        steps: parseSteps(flow.steps),
        active: flow.active,
        n8nWorkflowId: flow.n8nWorkflowId,
      }}
      templates={templates.map((t) => ({ id: t.id, name: t.name }))}
      staff={staff.map((u) => ({
        id: u.id,
        label: u.name ?? u.email,
      }))}
    />
  );
}
