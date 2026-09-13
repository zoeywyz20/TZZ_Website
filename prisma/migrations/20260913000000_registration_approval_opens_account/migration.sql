-- Registration no longer depends on mailbox delivery. New requests wait for
-- secretary review, and approval opens an account with a mandatory password change.
ALTER TABLE "registration_applications"
  ALTER COLUMN "status" SET DEFAULT 'PENDING';
