-- Production-safe task lifecycle extension.  All new columns are nullable so
-- existing tasks and registration audit records remain readable unchanged.
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_deleted_by_fkey"
  FOREIGN KEY ("deleted_by") REFERENCES "profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "tasks_deleted_at_idx" ON "tasks"("deleted_at");

ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "target_type" TEXT,
  ADD COLUMN IF NOT EXISTS "target_id" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE INDEX IF NOT EXISTS "audit_logs_target_type_target_id_created_at_idx"
  ON "audit_logs"("target_type", "target_id", "created_at");
