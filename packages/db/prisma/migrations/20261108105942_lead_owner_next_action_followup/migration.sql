-- AlterTable: Add owner, nextAction, and followUpDate to Lead
ALTER TABLE "Lead" ADD COLUMN "ownerId" TEXT,
ADD COLUMN "nextAction" TEXT,
ADD COLUMN "followUpDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Lead_ownerId_idx" ON "Lead"("ownerId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
