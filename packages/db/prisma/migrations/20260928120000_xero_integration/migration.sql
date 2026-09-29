-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "xeroContactId" TEXT;

-- CreateTable
CREATE TABLE "XeroCredential" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantName" TEXT,
    "refreshToken" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XeroCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "XeroCredential_tenantId_key" ON "XeroCredential"("tenantId");

-- CreateIndex
CREATE INDEX "Client_xeroContactId_idx" ON "Client"("xeroContactId");

