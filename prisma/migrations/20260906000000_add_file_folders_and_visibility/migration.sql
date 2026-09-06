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

CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'COMPLETED');

CREATE TABLE "import_records" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "relative_path" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "file_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "import_records_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "files" ADD COLUMN "folder_id" TEXT;
ALTER TABLE "files" ADD COLUMN "visibility" "Visibility" NOT NULL DEFAULT 'DEPARTMENT';

CREATE INDEX "folders_parent_id_idx" ON "folders"("parent_id");
CREATE INDEX "folders_department_id_idx" ON "folders"("department_id");
CREATE UNIQUE INDEX "folders_child_parent_name_key" ON "folders"("parent_id", "name") WHERE "parent_id" IS NOT NULL;
CREATE UNIQUE INDEX "folders_root_department_name_key" ON "folders"("department_id", "name") WHERE "parent_id" IS NULL AND "department_id" IS NOT NULL;
CREATE UNIQUE INDEX "folders_root_global_name_key" ON "folders"("name") WHERE "parent_id" IS NULL AND "department_id" IS NULL;
CREATE INDEX "files_folder_id_idx" ON "files"("folder_id");
CREATE INDEX "files_visibility_idx" ON "files"("visibility");
CREATE UNIQUE INDEX "import_records_storage_key_key" ON "import_records"("storage_key");
CREATE UNIQUE INDEX "import_records_file_id_key" ON "import_records"("file_id");
CREATE UNIQUE INDEX "import_records_source_relative_path_key" ON "import_records"("source", "relative_path");
CREATE INDEX "import_records_status_idx" ON "import_records"("status");

ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "folders" ADD CONSTRAINT "folders_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "files" ADD CONSTRAINT "files_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "import_records" ADD CONSTRAINT "import_records_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
