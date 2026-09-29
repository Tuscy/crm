import { notFound } from "next/navigation";
import { getEmailTemplateById } from "@/lib/email-flows/templates";
import { TemplateEditor } from "@/components/email-flows/template-editor";

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (id === "new") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">New email template</h1>
        <TemplateEditor initial={null} />
      </div>
    );
  }

  const template = await getEmailTemplateById(id);
  if (!template) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit template</h1>
      <TemplateEditor
        initial={{
          id: template.id,
          name: template.name,
          subject: template.subject,
          htmlBody: template.htmlBody,
          textBody: template.textBody,
          variables: template.variables,
        }}
      />
    </div>
  );
}
