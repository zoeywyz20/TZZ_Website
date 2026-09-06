import 'server-only';

import type { AuthUser } from '@/lib/api/contracts';
import { getDb } from '@/lib/db';
import { Role } from '@/types';

type FolderInput = { name: string; parentId?: string | null; departmentId?: string | null };

export function canReadFolder(user: AuthUser, folder: { departmentId: string | null }) {
  if (user.role === Role.GUEST) return false;
  if ([Role.SUPER_ADMIN, Role.SECRETARY, Role.DEPUTY_SECRETARY].includes(user.role)) return true;
  return folder.departmentId === null || folder.departmentId === user.departmentId;
}

export function canManageFolder(user: AuthUser, folder: { departmentId: string | null }) {
  if ([Role.SUPER_ADMIN, Role.SECRETARY, Role.DEPUTY_SECRETARY].includes(user.role)) return true;
  return user.role === Role.MINISTER && Boolean(user.departmentId) && folder.departmentId === user.departmentId;
}

export async function listFolders(user: AuthUser, filters: { parentId?: string | null; departmentId?: string }) {
  if (user.role === Role.GUEST) throw new Error('FOLDER_FORBIDDEN');
  const records = await getDb().folder.findMany({
    where: {
      ...(filters.parentId !== undefined ? { parentId: filters.parentId } : {}),
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    },
    include: { _count: { select: { children: true, files: { where: { deletedAt: null } } } }, department: { select: { id: true, name: true, shortName: true } } },
    orderBy: [{ name: 'asc' }],
  });
  return records.filter((folder) => canReadFolder(user, folder)).map((folder) => ({
    id: folder.id, name: folder.name, parentId: folder.parentId, department: folder.department,
    childrenCount: folder._count.children, fileCount: folder._count.files,
    createdAt: folder.createdAt.toISOString(), updatedAt: folder.updatedAt.toISOString(),
    canManage: canManageFolder(user, folder),
  }));
}

export async function createFolder(user: AuthUser, input: FolderInput) {
  const context = await folderContext(user, input);
  return getDb().folder.create({ data: { name: normalizedName(input.name), parentId: input.parentId ?? null, departmentId: context.departmentId } });
}

export async function updateFolder(user: AuthUser, id: string, input: FolderInput) {
  const current = await getDb().folder.findUnique({ where: { id } });
  if (!current || !canManageFolder(user, current)) throw new Error('FOLDER_FORBIDDEN');
  if (input.parentId === id) throw new Error('FOLDER_CYCLE');
  if (input.parentId !== undefined && input.parentId !== current.parentId) {
    await assertNotDescendant(id, input.parentId);
  }
  const context = await folderContext(user, { ...input, departmentId: input.departmentId ?? current.departmentId });
  return getDb().folder.update({ where: { id }, data: { name: normalizedName(input.name), parentId: input.parentId ?? current.parentId, departmentId: context.departmentId } });
}

export async function deleteFolder(user: AuthUser, id: string) {
  const folder = await getDb().folder.findUnique({ where: { id }, include: { _count: { select: { children: true, files: { where: { deletedAt: null } } } } } });
  if (!folder || !canManageFolder(user, folder)) throw new Error('FOLDER_FORBIDDEN');
  if (folder._count.children > 0 || folder._count.files > 0) throw new Error('FOLDER_NOT_EMPTY');
  await getDb().folder.delete({ where: { id } });
}

async function folderContext(user: AuthUser, input: FolderInput) {
  const isAdmin = [Role.SUPER_ADMIN, Role.SECRETARY, Role.DEPUTY_SECRETARY].includes(user.role);
  const parent = input.parentId ? await getDb().folder.findUnique({ where: { id: input.parentId } }) : null;
  if (input.parentId && !parent) throw new Error('FOLDER_NOT_FOUND');
  const departmentId = parent?.departmentId ?? input.departmentId ?? (isAdmin ? null : user.departmentId);
  if (!isAdmin && (user.role !== Role.MINISTER || !user.departmentId || departmentId !== user.departmentId)) throw new Error('FOLDER_FORBIDDEN');
  if (parent && parent.departmentId !== departmentId) throw new Error('FOLDER_SCOPE_MISMATCH');
  return { departmentId };
}

async function assertNotDescendant(folderId: string, proposedParentId: string | null | undefined) {
  let cursor = proposedParentId;
  while (cursor) {
    if (cursor === folderId) throw new Error('FOLDER_CYCLE');
    const parent = await getDb().folder.findUnique({ where: { id: cursor }, select: { parentId: true } });
    if (!parent) throw new Error('FOLDER_NOT_FOUND');
    cursor = parent.parentId;
  }
}

function normalizedName(name: string) {
  const value = name.trim();
  if (!value || value.length > 120 || /[\\/\0]/.test(value) || value === '.' || value === '..') throw new Error('FOLDER_NAME_INVALID');
  return value;
}
