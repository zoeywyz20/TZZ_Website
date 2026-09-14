import 'server-only';

import path from 'node:path';
import { rm } from 'node:fs/promises';
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
  if ([Role.SUPER_ADMIN, Role.SECRETARY].includes(user.role)) return true;
  // SPECIFIED is used for staged archival material.  Until explicit ACL support
  // is added, it is intentionally leadership-only rather than accidentally
  // inheriting department visibility.
  if (file.visibility === Visibility.SPECIFIED) return false;
  if (user.role === Role.GUEST) return false;
  const participates = file.task?.assignees.some((assignee) => assignee.profileId === user.id) ?? false;
  const sameDepartment = Boolean(user.departmentId && file.departmentId === user.departmentId);
  if (user.role === Role.DEPUTY_SECRETARY) return sameDepartment || file.uploaderId === user.id;
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
  if ([Role.SUPER_ADMIN, Role.SECRETARY].includes(user.role)) return {};
  if (user.role === Role.GUEST) return { id: '__guest_cannot_view_files__' };
  if (user.role === Role.DEPUTY_SECRETARY) return { OR: [{ departmentId: user.departmentId ?? '__no_department__' }, { uploaderId: user.id }] };
  const participates = { task: { assignees: { some: { profileId: user.id } } } };
  const nonStaged = { visibility: { not: Visibility.SPECIFIED } };
  if ([Role.MINISTER, Role.VICE_MINISTER].includes(user.role)) {
    return { AND: [nonStaged, { OR: [{ departmentId: user.departmentId ?? '__no_department__' }, participates] }] };
  }
  return { AND: [nonStaged, { OR: [{ uploaderId: user.id }, participates, { visibility: Visibility.ALL }] }] };
}

export async function findFileForAccess(id: string) {
  return getDb().fileRecord.findFirst({ where: { id, deletedAt: null }, include: fileInclude });
}

async function findFileIncludingDeleted(id: string) {
  return getDb().fileRecord.findUnique({ where: { id }, include: fileInclude });
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
      await tx.fileVersion.create({ data: { fileId: file.id, versionNumber: 1, storageKey: staged.storageKey, size: staged.size, hash: staged.sha256, mimeType: input.mimeType, uploaderId: user.id } });
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
}

function canManageTrash(user: AuthUser) { return [Role.SUPER_ADMIN, Role.SECRETARY].includes(user.role); }

export async function listTrash(user: AuthUser) {
  if (!canManageTrash(user)) throw new Error('FILE_FORBIDDEN');
  const files = await getDb().fileRecord.findMany({ where: { deletedAt: { not: null } }, include: fileInclude, orderBy: { deletedAt: 'desc' } });
  return files.map((file) => ({ ...serializeFile(file, user), deletedAt: file.deletedAt?.toISOString(), deletedBy: file.deletedBy ?? undefined }));
}

export async function restoreFile(user: AuthUser, id: string) {
  if (!canManageTrash(user)) throw new Error('FILE_FORBIDDEN');
  const file = await findFileIncludingDeleted(id);
  if (!file || !file.deletedAt) throw new Error('FILE_NOT_FOUND');
  await openStoredFile(file.storageKey);
  return getDb().fileRecord.update({ where: { id }, data: { deletedAt: null, deletedBy: null } });
}

export async function purgeFile(user: AuthUser, id: string) {
  if (!canManageTrash(user)) throw new Error('FILE_FORBIDDEN');
  const file = await findFileIncludingDeleted(id);
  if (!file || !file.deletedAt) throw new Error('FILE_NOT_FOUND');
  const keys = await getDb().$transaction(async (tx) => {
    const [submissions, reviews, versions] = await Promise.all([tx.submission.count({ where: { fileId: id } }), tx.reviewRecord.count({ where: { fileId: id } }), tx.fileVersion.findMany({ where: { fileId: id }, select: { storageKey: true } })]);
    if (submissions || reviews) throw new Error('FILE_HAS_REFERENCES');
    await tx.fileRecord.delete({ where: { id } });
    return [...new Set(versions.map((version) => version.storageKey))];
  });
  const failures: string[] = [];
  for (const key of keys) { try { if (await getDb().fileVersion.count({ where: { storageKey: key } }) === 0) await deleteStoredFile(key); } catch { failures.push(key); } }
  return { purged: true, pendingStorageCleanup: failures.length };
}

export async function uploadFileVersion(user: AuthUser, id: string, request: Request, input: { originalFilename: string; mimeType: string; changeNote?: string }) {
  const file = await findFileForAccess(id);
  if (!file || !canAccessFile(user, file) || file.status === FileStatus.ARCHIVED) throw new Error('FILE_FORBIDDEN');
  assertUploadAllowed(input.originalFilename, input.mimeType, request.headers.get('content-length') ? Number(request.headers.get('content-length')) : undefined);
  const staged = await writeRequestToTemporaryFile(request.body, input.originalFilename);
  if (file.hash === staged.sha256) { await rm(staged.temporaryPath, { force: true }); return { unchanged: true, currentVersion: file.currentVersion }; }
  let committed = false;
  try {
    await commitTemporaryFile(staged.temporaryPath, staged.storageKey); committed = true;
    const created = await getDb().$transaction(async (tx) => {
      const fresh = await tx.fileRecord.findFirst({ where: { id, deletedAt: null }, select: { currentVersion: true, hash: true, status: true } });
      if (!fresh || fresh.status === FileStatus.ARCHIVED) throw new Error('FILE_FORBIDDEN');
      if (fresh.hash === staged.sha256) return { unchanged: true as const, currentVersion: fresh.currentVersion };
      const versionNumber = fresh.currentVersion + 1;
      await tx.fileVersion.create({ data: { fileId: id, versionNumber, storageKey: staged.storageKey, size: staged.size, hash: staged.sha256, mimeType: input.mimeType, uploaderId: user.id, changeNote: input.changeNote?.trim().slice(0, 1000) || null } });
      await tx.fileRecord.update({ where: { id }, data: { originalFilename: input.originalFilename, storageKey: staged.storageKey, size: staged.size, hash: staged.sha256, mimeType: input.mimeType, currentVersion: versionNumber } });
      return { unchanged: false as const, currentVersion: versionNumber };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (created.unchanged) { await deleteStoredFile(staged.storageKey); committed = false; }
    return created;
  } catch (error) { if (committed) await deleteStoredFile(staged.storageKey).catch(() => undefined); else await rm(staged.temporaryPath, { force: true }).catch(() => undefined); throw error; }
}

export async function listFileVersions(user: AuthUser, id: string) {
  const file = await findFileForAccess(id); if (!file || !canAccessFile(user, file)) throw new Error('FILE_FORBIDDEN');
  const versions = await getDb().fileVersion.findMany({ where: { fileId: id }, include: { uploader: { select: { id: true, name: true } } }, orderBy: { versionNumber: 'desc' } });
  return versions.map((version) => ({ id: version.id, versionNumber: version.versionNumber, size: version.size.toString(), hash: version.hash ?? undefined, mimeType: version.mimeType ?? undefined, uploader: version.uploader, changeNote: version.changeNote ?? undefined, createdAt: version.createdAt.toISOString(), isCurrent: version.versionNumber === file.currentVersion }));
}

export async function contentForFileVersion(user: AuthUser, id: string, versionNumber: number) {
  const file = await findFileForAccess(id); if (!file || !can(user, 'file:download') || !canAccessFile(user, file)) throw new Error('FILE_FORBIDDEN');
  const version = await getDb().fileVersion.findUnique({ where: { fileId_versionNumber: { fileId: id, versionNumber } } });
  if (!version) throw new Error('VERSION_NOT_FOUND');
  return { file, version, stored: await openStoredFile(version.storageKey) };
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
  const isLeadership = [Role.SUPER_ADMIN, Role.SECRETARY].includes(user.role);
  const participates = task?.assignees.some((assignee) => assignee.profileId === user.id) ?? false;
  const canDeliverAcrossDepartments = user.role === Role.DEPUTY_SECRETARY;
  if (!isLeadership && !canDeliverAcrossDepartments && task && !participates && task.departmentId !== user.departmentId) throw new Error('FILE_FORBIDDEN');
  if (input.departmentId && !isLeadership && !canDeliverAcrossDepartments && input.departmentId !== user.departmentId) throw new Error('FILE_FORBIDDEN');
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
