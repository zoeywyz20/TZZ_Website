-- Version snapshots are nullable so all existing imported and production files
-- remain valid without rewriting their storage objects.
ALTER TABLE "file_versions"
  ADD COLUMN IF NOT EXISTS "hash" TEXT,
  ADD COLUMN IF NOT EXISTS "mime_type" TEXT;

CREATE INDEX IF NOT EXISTS "file_versions_file_id_hash_idx" ON "file_versions"("file_id", "hash");
