import Link from "next/link";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@stky/ui";
import { getEmailTemplates } from "@/lib/email-flows/templates";
import { DeleteTemplateButton } from "@/components/email-flows/delete-template-button";

export default async function EmailTemplatesPage() {
  const templates = await getEmailTemplates();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard/email-flows"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to flows
          </Link>
          <h1 className="text-2xl font-bold mt-1">Email templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drag-and-drop email designs used as steps in your flows.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/email-flows/templates/new">New template</Link>
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No templates yet. Create your first one to use it in a flow.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{tpl.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {tpl.subject}
                </p>
                {tpl.variables.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tpl.variables.slice(0, 6).map((v) => (
                      <code
                        key={v}
                        className="rounded bg-muted px-1 py-0.5 text-xs font-mono text-muted-foreground"
                      >
                        {`{{${v}}}`}
                      </code>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-auto">
                  Updated {new Date(tpl.updatedAt).toLocaleDateString()}
                </p>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/email-flows/templates/${tpl.id}`}>
                      Edit
                    </Link>
                  </Button>
                  <DeleteTemplateButton id={tpl.id} name={tpl.name} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
