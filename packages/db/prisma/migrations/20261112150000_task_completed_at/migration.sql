-- Add completion timestamp for hide/purge windows.
-- Task has no updatedAt; backfill already-completed rows to 8 days ago so they
-- hide immediately (7-day default) without being eligible for the 30-day purge yet.
ALTER TABLE "Task" ADD COLUMN "completedAt" TIMESTAMP(3);

UPDATE "Task"
SET "completedAt" = CURRENT_TIMESTAMP - INTERVAL '8 days'
WHERE "completed" = true AND "completedAt" IS NULL;

CREATE INDEX "Task_completed_completedAt_idx" ON "Task"("completed", "completedAt");
