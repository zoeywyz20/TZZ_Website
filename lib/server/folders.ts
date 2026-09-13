import 'server-only';

import type { AuthUser } from '@/lib/api/contracts';
import { getDb } from '@/lib/db';
import { Role } from '@/types';

type CreateFolderInput = { name: string; parentId?: string | null; departmentId?: string | null };
type UpdateFolderInput = { name?: string; parentId?: string | null; departmentId?: string | null };
const LEGACY_REVIEW_ROOT = '历史材料（暂未开放）';

function isArchiveAdministrator(user: AuthUser) {
  return [Role.SUPER_ADMIN, Role.SECRETARY, Role.DEPUTY_SECRETARY].includes(user.role);
}

export function canReadFolder(user: AuthUser, folder: { departmentId: string | null }) {
  if (user.role === Role.GUEST) return false;
  if (isArchiveAdministrator(user)) return true;
  return folder.departmentId === null || folder.departmentId === user.departmentId;
}

export function canManageFolder(user: AuthUser, folder: { departmentId: string | null }) {
  if (isArchiveAdministrator(user)) return true;
  return user.role === Role.MINISTER && Boolean(user.departmentId) && folder.departmentId === user.departmentId;
}

export async function listFolders(user: AuthUser, filters: { parentId?: string | null; departmentId?: string }) {
  if (user.role === Role.GUEST) throw new Error('FOLDER_FORBIDDEN');
  const db = getDb();
  const [records, nodes] = await Promise.all([db.folder.findMany({
    where: {
      ...(filters.parentId !== undefined ? { parentId: filters.parentId } : {}),
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    },
    include: { _count: { select: { children: true, files: { where: { deletedAt: null } } } }, department: { select: { id: true, name: true, shortName: true } } },
    orderBy: [{ name: 'asc' }],
  }), db.folder.findMany({ select: { id: true, name: true, parentId: true } })]);
  const lockedIds = lockedArchiveFolderIds(nodes);
  return records.filter((folder) => canReadFolder(user, folder) && (isArchiveAdministrator(user) || !lockedIds.has(folder.id))).map((folder) => ({
    id: folder.id, name: folder.name, parentId: folder.parentId, department: folder.department,
    childrenCount: folder._count.children, fileCount: folder._count.files,
    createdAt: folder.createdAt.toISOString(), updatedAt: folder.updatedAt.toISOString(),
    canManage: canManageFolder(user, folder),
  }));
}

export async function createFolder(user: AuthUser, input: CreateFolderInput) {
  const context = await folderContext(user, input);
  return getDb().folder.create({ data: { name: normalizedName(input.name), parentId: input.parentId ?? null, departmentId: context.departmentId } });
}

export async function updateFolder(user: AuthUser, id: string, input: UpdateFolderInput) {
  const current = await getDb().folder.findUnique({ where: { id } });
  if (!current || !canManageFolder(user, current)) throw new Error('FOLDER_FORBIDDEN');
  if (!isArchiveAdministrator(user) && await isLockedArchiveFolder(id)) throw new Error('FOLDER_FORBIDDEN');
  if (input.parentId === id) throw new Error('FOLDER_CYCLE');
  if (input.parentId !== undefined && input.parentId !== current.parentId) {
    await assertNotDescendant(id, input.parentId);
  }
  const parentId = input.parentId === undefined ? current.parentId : input.parentId;
  const departmentId = input.departmentId === undefined ? current.departmentId : input.departmentId;
  const context = await folderContext(user, { parentId, departmentId });
  return getDb().folder.update({ where: { id }, data: { ...(input.name !== undefined ? { name: normalizedName(input.name) } : {}), parentId, departmentId: context.departmentId } });
}

export async function deleteFolder(user: AuthUser, id: string) {
  const folder = await getDb().folder.findUnique({ where: { id }, include: { _count: { select: { children: true, files: { where: { deletedAt: null } } } } } });
  if (!folder || !canManageFolder(user, folder)) throw new Error('FOLDER_FORBIDDEN');
  if (!isArchiveAdministrator(user) && await isLockedArchiveFolder(id)) throw new Error('FOLDER_FORBIDDEN');
  if (folder._count.children > 0 || folder._count.files > 0) throw new Error('FOLDER_NOT_EMPTY');
  await getDb().folder.delete({ where: { id } });
}

async function folderContext(user: AuthUser, input: { parentId?: string | null; departmentId?: string | null }) {
  const isAdmin = [Role.SUPER_ADMIN, Role.SECRETARY, Role.DEPUTY_SECRETARY].includes(user.role);
  const parent = input.parentId ? await getDb().folder.findUnique({ where: { id: input.parentId } }) : null;
  if (input.parentId && !parent) throw new Error('FOLDER_NOT_FOUND');
  if (parent && !isArchiveAdministrator(user) && await isLockedArchiveFolder(parent.id)) throw new Error('FOLDER_FORBIDDEN');
  const departmentId = parent?.departmentId ?? input.departmentId ?? (isAdmin ? null : user.departmentId);
  if (!isAdmin && (user.role !== Role.MINISTER || !user.departmentId || departmentId !== user.departmentId)) throw new Error('FOLDER_FORBIDDEN');
  if (parent && parent.departmentId !== departmentId) throw new Error('FOLDER_SCOPE_MISMATCH');
  return { departmentId };
}

function lockedArchiveFolderIds(nodes: Array<{ id: string; name: string; parentId: string | null }>) {
  const children = new Map<string, string[]>();
  for (const node of nodes) children.set(node.parentId ?? '', [...(children.get(node.parentId ?? '') ?? []), node.id]);
  const locked = new Set(nodes.filter((node) => node.name === LEGACY_REVIEW_ROOT).map((node) => node.id));
  for (const id of locked) for (const child of children.get(id) ?? []) locked.add(child);
  // A stack avoids relying on a fixed maximum archive depth.
  const stack = [...locked];
  while (stack.length) for (const child of children.get(stack.pop()!) ?? []) if (!locked.has(child)) { locked.add(child); stack.push(child); }
  return locked;
}

async function isLockedArchiveFolder(id: string) {
  const nodes = await getDb().folder.findMany({ select: { id: true, name: true, parentId: true } });
  return lockedArchiveFolderIds(nodes).has(id);
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
