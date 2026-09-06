-- Virtual folders classify files in PostgreSQL; they never affect physical blob paths.
CREATE TABLE "folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "department_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "files" ADD COLUMN "folder_id" TEXT;
ALTER TABLE "files" ADD COLUMN "visibility" "Visibility" NOT NULL DEFAULT 'DEPARTMENT';

CREATE INDEX "folders_parent_id_idx" ON "folders"("parent_id");
CREATE INDEX "folders_department_id_idx" ON "folders"("department_id");
CREATE UNIQUE INDEX "folders_parent_id_name_key" ON "folders"("parent_id", "name");
CREATE INDEX "files_folder_id_idx" ON "files"("folder_id");
CREATE INDEX "files_visibility_idx" ON "files"("visibility");

ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "folders" ADD CONSTRAINT "folders_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "files" ADD CONSTRAINT "files_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
