CREATE TYPE "RegistrationStatus" AS ENUM ('EMAIL_PENDING', 'PENDING', 'APPROVED', 'REJECTED', 'ACTIVATED');

CREATE TABLE "registration_applications" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "requested_department_id" TEXT,
  "status" "RegistrationStatus" NOT NULL DEFAULT 'EMAIL_PENDING',
  "email_verified_at" TIMESTAMP(3),
  "verification_code_hash" TEXT,
  "verification_expires_at" TIMESTAMP(3),
  "verification_attempts" INTEGER NOT NULL DEFAULT 0,
  "verification_sent_at" TIMESTAMP(3),
  "approved_role" "Role",
  "approved_department_id" TEXT,
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "review_note" TEXT,
  "activation_token_hash" TEXT,
  "activation_expires_at" TIMESTAMP(3),
  "activated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "registration_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actor_id" TEXT,
  "application_id" TEXT,
  "target_email" TEXT,
  "old_status" "RegistrationStatus",
  "new_status" "RegistrationStatus",
  "approved_role" "Role",
  "approved_department_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "registration_applications_email_key" ON "registration_applications"("email");
CREATE UNIQUE INDEX "registration_applications_activation_token_hash_key" ON "registration_applications"("activation_token_hash");
CREATE INDEX "registration_applications_student_id_idx" ON "registration_applications"("student_id");
CREATE INDEX "registration_applications_status_created_at_idx" ON "registration_applications"("status", "created_at");
CREATE INDEX "registration_applications_reviewed_at_idx" ON "registration_applications"("reviewed_at");
CREATE INDEX "audit_logs_application_id_created_at_idx" ON "audit_logs"("application_id", "created_at");
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

ALTER TABLE "registration_applications" ADD CONSTRAINT "registration_applications_requested_department_id_fkey" FOREIGN KEY ("requested_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "registration_applications" ADD CONSTRAINT "registration_applications_approved_department_id_fkey" FOREIGN KEY ("approved_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "registration_applications" ADD CONSTRAINT "registration_applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "registration_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
