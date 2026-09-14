CREATE TABLE "archive_items" (
  "id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "file_id" TEXT NOT NULL,
  "version_number" INTEGER NOT NULL,
  "department_id" TEXT,
  "folder_id" TEXT,
  "archived_by" TEXT NOT NULL,
  "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "archive_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "archive_items_task_id_file_id_version_number_key" ON "archive_items"("task_id", "file_id", "version_number");
CREATE INDEX "archive_items_task_id_archived_at_idx" ON "archive_items"("task_id", "archived_at");
CREATE INDEX "archive_items_file_id_version_number_idx" ON "archive_items"("file_id", "version_number");
ALTER TABLE "archive_items" ADD CONSTRAINT "archive_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "archive_items" ADD CONSTRAINT "archive_items_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "archive_items" ADD CONSTRAINT "archive_items_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "archive_items" ADD CONSTRAINT "archive_items_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "archive_items" ADD CONSTRAINT "archive_items_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
