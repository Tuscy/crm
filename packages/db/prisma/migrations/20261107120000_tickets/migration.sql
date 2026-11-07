-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('NEW', 'TRIAGED', 'IN_PROGRESS', 'AWAITING_REVIEW', 'AWAITING_CLIENT', 'NEEDS_HUMAN', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('SITE_CHANGE', 'BUG', 'CONTENT', 'HOSTING_UPTIME', 'SEO_ADS_REPORTING', 'BILLING_ADMIN', 'INTERNAL', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketSource" AS ENUM ('CRM', 'PORTAL', 'SITE_FORM', 'EMAIL', 'UPTIME', 'AGENT');

-- CreateEnum
CREATE TYPE "TicketActorType" AS ENUM ('CLIENT', 'STAFF', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TicketAssigneeType" AS ENUM ('NONE', 'HUMAN', 'AGENT');

-- CreateEnum
CREATE TYPE "TicketVisibility" AS ENUM ('PUBLIC', 'INTERNAL');

-- CreateTable
CREATE TABLE "TicketCounter" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TicketCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "siteId" TEXT,
    "requesterType" "TicketActorType" NOT NULL,
    "requesterName" TEXT,
    "requesterEmail" TEXT,
    "source" "TicketSource" NOT NULL,
    "type" "TicketType" NOT NULL DEFAULT 'OTHER',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TicketStatus" NOT NULL DEFAULT 'NEW',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assigneeType" "TicketAssigneeType" NOT NULL DEFAULT 'NONE',
    "assigneeId" TEXT,
    "agentEligible" BOOLEAN NOT NULL DEFAULT false,
    "statusSummary" TEXT,
    "finalMessage" TEXT,
    "shareTechnicalDetails" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorType" "TicketActorType" NOT NULL,
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "visibility" "TicketVisibility" NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "prUrl" TEXT,
    "previewUrl" TEXT,
    "costEstimate" DECIMAL(10,4),
    "rawLogRef" TEXT,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketEvent" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "runId" TEXT,
    "seq" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "actorType" "TicketActorType" NOT NULL,
    "actorName" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_reference_key" ON "Ticket"("reference");

-- CreateIndex
CREATE INDEX "Ticket_clientId_idx" ON "Ticket"("clientId");

-- CreateIndex
CREATE INDEX "Ticket_siteId_idx" ON "Ticket"("siteId");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_createdAt_idx" ON "Ticket"("createdAt");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_ticketId_idx" ON "AgentRun"("ticketId");

-- CreateIndex
CREATE INDEX "TicketEvent_ticketId_createdAt_idx" ON "TicketEvent"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TicketEvent_ticketId_seq_key" ON "TicketEvent"("ticketId", "seq");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Seed the single ticket counter row (TKT-0001 sequence).
INSERT INTO "TicketCounter" ("id", "lastNumber") VALUES (1, 0);

-- TicketEvent is an append-only activity log. Application code never updates
-- or deletes rows; this trigger enforces it. UPDATE is always refused. DELETE is
-- refused when issued directly, but allowed when it arrives through an FK cascade
-- (pg_trigger_depth() > 1) so deleting a Ticket or Client, including a client's
-- delete-on-request, still removes its events.
CREATE FUNCTION ticket_event_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'TicketEvent is append-only: updates are not allowed';
  END IF;
  IF TG_OP = 'DELETE' AND pg_trigger_depth() <= 1 THEN
    RAISE EXCEPTION 'TicketEvent is append-only: direct deletes are not allowed';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ticket_event_no_mutate
BEFORE UPDATE OR DELETE ON "TicketEvent"
FOR EACH ROW EXECUTE FUNCTION ticket_event_append_only();

-- Bind a tickets:intake key to one site (deleting the site deletes the key).
ALTER TABLE "IntegrationApiKey" ADD COLUMN "siteId" TEXT;
CREATE INDEX "IntegrationApiKey_siteId_idx" ON "IntegrationApiKey"("siteId");
ALTER TABLE "IntegrationApiKey" ADD CONSTRAINT "IntegrationApiKey_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
