-- Formal account lifecycle: administrator provisioning, mandatory first-password
-- change, and reversible account disabling. No accounts are created by migration.
ALTER TABLE "profiles"
  ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "password_changed_at" TIMESTAMP(3),
  ADD COLUMN "account_enabled" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "profiles_account_enabled_idx" ON "profiles"("account_enabled");
