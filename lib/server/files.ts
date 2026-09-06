import 'server-only';

import path from 'node:path';
import { FileStatus, Prisma, Visibility } from '@/generated/prisma/client';
import { can } from '@/lib/permissions';
import type { AuthUser } from '@/lib/api/contracts';
import { getDb } from '@/lib/db';
import { assertUploadAllowed, commitTemporaryFile, deleteStoredFile, openStoredFile, writeRequestToTemporaryFile } from '@/lib/server/file-storage';
import { Role } from '@/types';

type FileWithAccess = Awaited<ReturnType<typeof findFileForAccess>>;
type UploadInput = { originalFilename: string; mimeType: string; taskId?: string; deliverableId?: string; departmentId?: string; folderId?: string; visibility: Visibility };

const fileInclude = {
  uploader: { select: { id: true, name: true } },
  department: { select: { id: true, name: true, shortName: true } },
  folder: { select: { id: true, name: true, parentId: true } },
  task: { select: { id: true, departmentId: true, assignees: { select: { profileId: true } } } },
} as const;

export function canAccessFile(user: AuthUser, file: NonNullable<FileWithAccess>): boolean {
  if ([Role.SUPER_ADMIN, Role.SECRETARY, Role.DEPUTY_SECRETARY].includes(user.role)) return true;
  if (user.role === Role.GUEST) return false;
  const participates = file.task?.assignees.some((assignee) => assignee.profileId === user.id) ?? false;
  const sameDepartment = Boolean(user.departmentId && file.departmentId === user.departmentId);
  if ([Role.MINISTER, Role.VICE_MINISTER].includes(user.role)) return sameDepartment || participates;
  return file.uploaderId === user.id || participates || file.visibility === Visibility.ALL;
}

export function canDeleteFile(user: AuthUser, file: NonNullable<FileWithAccess>): boolean {
  return can(user, 'file:delete') && canAccessFile(user, file);
}

export async function listFiles(user: AuthUser, filters: { q?: string; departmentId?: string; folderId?: string | null; status?: FileStatus; page: number; pageSize: number }) {
  const where: Prisma.FileRecordWhereInput = {
    deletedAt: null,
    ...(filters.q ? { originalFilename: { contains: filters.q, mode: 'insensitive' } } : {}),
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.folderId !== undefined ? { folderId: filters.folderId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...fileVisibilityWhere(user),
  };
  const [records, total] = await getDb().$transaction([
    getDb().fileRecord.findMany({
      where,
      include: fileInclude,
      orderBy: { updatedAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    getDb().fileRecord.count({ where }),
  ]);
  return {
    items: records.filter((record) => canAccessFile(user, record)).map((record) => serializeFile(record, user)),
    pagination: { page: filters.page, pageSize: filters.pageSize, total, hasMore: filters.page * filters.pageSize < total },
  };
}

function fileVisibilityWhere(user: AuthUser): Prisma.FileRecordWhereInput {
  if ([Role.SUPER_ADMIN, Role.SECRETARY, Role.DEPUTY_SECRETARY].includes(user.role)) return {};
  if (user.role === Role.GUEST) return { id: '__guest_cannot_view_files__' };
  const participates = { task: { assignees: { some: { profileId: user.id } } } };
  if ([Role.MINISTER, Role.VICE_MINISTER].includes(user.role)) {
    return { OR: [{ departmentId: user.departmentId ?? '__no_department__' }, participates] };
  }
  return { OR: [{ uploaderId: user.id }, participates, { visibility: Visibility.ALL }] };
}

export async function findFileForAccess(id: string) {
  return getDb().fileRecord.findFirst({ where: { id, deletedAt: null }, include: fileInclude });
}

export async function uploadFile(user: AuthUser, request: Request, input: UploadInput) {
  const target = await resolveUploadTarget(user, input);
  const contentLengthHeader = request.headers.get('content-length');
  const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : undefined;
  assertUploadAllowed(input.originalFilename, input.mimeType, contentLength);
  const staged = await writeRequestToTemporaryFile(request.body, input.originalFilename);
  let moved = false;
  try {
    await commitTemporaryFile(staged.temporaryPath, staged.storageKey);
    moved = true;
    const created = await getDb().$transaction(async (tx) => {
      const file = await tx.fileRecord.create({
        data: {
          originalFilename: input.originalFilename,
          storageKey: staged.storageKey,
          mimeType: input.mimeType,
          size: staged.size,
          hash: staged.sha256,
          uploaderId: user.id,
          taskId: target.taskId,
          deliverableId: target.deliverableId,
          departmentId: target.departmentId,
          folderId: target.folderId,
          visibility: input.visibility,
        },
      });
      await tx.fileVersion.create({ data: { fileId: file.id, versionNumber: 1, storageKey: staged.storageKey, size: staged.size, uploaderId: user.id } });
      if (target.taskId && target.deliverableId) {
        await tx.submission.create({ data: { taskId: target.taskId, deliverableId: target.deliverableId, submitterId: user.id, fileId: file.id, version: 1 } });
        await tx.deliverable.updateMany({ where: { id: target.deliverableId, status: 'pending' }, data: { status: 'submitted' } });
      }
      return file;
    });
    return created;
  } catch (error) {
    if (moved) await deleteStoredFile(staged.storageKey).catch(() => undefined);
    throw error;
  }
}

export async function deleteFile(user: AuthUser, file: NonNullable<FileWithAccess>) {
  if (!canDeleteFile(user, file)) throw new Error('FILE_FORBIDDEN');
  await getDb().fileRecord.update({ where: { id: file.id }, data: { deletedAt: new Date(), deletedBy: user.id } });
  await deleteStoredFile(file.storageKey);
}

export async function contentForFile(user: AuthUser, file: NonNullable<FileWithAccess>) {
  if (!can(user, 'file:download') || !canAccessFile(user, file)) throw new Error('FILE_FORBIDDEN');
  return openStoredFile(file.storageKey);
}

export function serializeFile(file: NonNullable<FileWithAccess>, user?: AuthUser) {
  return {
    id: file.id,
    originalFilename: file.originalFilename,
    mimeType: file.mimeType,
    size: file.size.toString(),
    hash: file.hash ?? undefined,
    uploader: file.uploader,
    taskId: file.taskId ?? undefined,
    deliverableId: file.deliverableId ?? undefined,
    department: file.department ?? undefined,
    folder: file.folder ?? undefined,
    status: file.status,
    visibility: file.visibility,
    currentVersion: file.currentVersion,
    tags: file.tags,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
    canDelete: user ? canDeleteFile(user, file) : false,
  };
}

export function fileContentDisposition(filename: string, mimeType: string): string {
  const safeName = path.basename(filename).replace(/[\\"\r\n]/g, '_') || 'download';
  const fallback = safeName.replace(/[^\x20-\x7e]/g, '_').replace(/[\\"]/g, '_') || 'download';
  const disposition = mimeType === 'application/pdf' || mimeType.startsWith('image/') ? 'inline' : 'attachment';
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

async function resolveUploadTarget(user: AuthUser, input: UploadInput) {
  const db = getDb();
  const task = input.taskId ? await db.task.findUnique({ where: { id: input.taskId }, include: { assignees: { select: { profileId: true } } } }) : null;
  if (input.taskId && !task) throw new Error('TASK_NOT_FOUND');
  const isLeadership = [Role.SUPER_ADMIN, Role.SECRETARY, Role.DEPUTY_SECRETARY].includes(user.role);
  const participates = task?.assignees.some((assignee) => assignee.profileId === user.id) ?? false;
  if (!isLeadership && task && !participates && task.departmentId !== user.departmentId) throw new Error('FILE_FORBIDDEN');
  if (input.departmentId && !isLeadership && input.departmentId !== user.departmentId) throw new Error('FILE_FORBIDDEN');
  if (task && input.departmentId && task.departmentId !== input.departmentId) throw new Error('UPLOAD_TARGET_MISMATCH');
  const departmentId = task?.departmentId ?? input.departmentId ?? user.departmentId;
  if (input.visibility === Visibility.DEPARTMENT && !departmentId) throw new Error('DEPARTMENT_REQUIRED');
  if (input.folderId) {
    const folder = await db.folder.findUnique({ where: { id: input.folderId } });
    if (!folder) throw new Error('FOLDER_NOT_FOUND');
    if (folder.departmentId && folder.departmentId !== departmentId) throw new Error('UPLOAD_TARGET_MISMATCH');
  }
  if (input.deliverableId) {
    const deliverable = await db.deliverable.findUnique({ where: { id: input.deliverableId } });
    if (!deliverable || deliverable.taskId !== input.taskId) throw new Error('UPLOAD_TARGET_MISMATCH');
  }
  if (input.visibility === Visibility.ALL && !isLeadership) throw new Error('FILE_FORBIDDEN');
  return { taskId: input.taskId, deliverableId: input.deliverableId, departmentId, folderId: input.folderId };
}
