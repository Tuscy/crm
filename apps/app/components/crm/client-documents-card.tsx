import { Card, CardContent, CardHeader, CardTitle } from "@stky/ui";

type DocumentMetadata = {
  name: string;
  url: string;
  modified: Date;
};

export function ClientDocumentsCard({
  sharepointFolderUrl,
}: {
  sharepointFolderUrl?: string | null;
}) {
  // In production, this would fetch document metadata from SharePoint
  // For now, just display the folder URL if configured
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Documents</CardTitle>
      </CardHeader>
      <CardContent>
        {sharepointFolderUrl ? (
          <div className="text-sm space-y-2">
            <a
              href={sharepointFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Open SharePoint folder →
            </a>
            <p className="text-xs text-muted-foreground">
              Document list requires SharePoint integration
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No SharePoint folder configured
          </p>
        )}
      </CardContent>
    </Card>
  );
}
