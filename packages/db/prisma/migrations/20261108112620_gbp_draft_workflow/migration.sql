-- CreateTable: GBP Draft/Review Workflow
CREATE TABLE "GBPDraft" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "contentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GBPDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GBPDraft_clientId_idx" ON "GBPDraft"("clientId");
CREATE INDEX "GBPDraft_createdById_idx" ON "GBPDraft"("createdById");
CREATE INDEX "GBPDraft_status_idx" ON "GBPDraft"("status");

ALTER TABLE "GBPDraft" ADD CONSTRAINT "GBPDraft_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GBPDraft" ADD CONSTRAINT "GBPDraft_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GBPDraft" ADD CONSTRAINT "GBPDraft_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
