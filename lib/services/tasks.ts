import 'server-only';

import { getDb } from '@/lib/db';
import type { TaskDto } from '@/lib/api/contracts';
import { can } from '@/lib/permissions';
import type { AuthUser } from '@/lib/api/contracts';
import type { z } from 'zod';
import type { createTaskSchema, updateTaskSchema } from '@/lib/validations/task';
import { type Prisma, TaskStatus as DbTaskStatus } from '@/generated/prisma/client';
import { Role } from '@/types';

const taskInclude = {
  department: true, creator: true, leader: true,
  assignees: { include: { profile: true } },
  deliverables: { include: { assignee: true, reviewer: true } },
} as const;

type DbTask = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

function date(value: Date | null) { return value?.toISOString(); }

function toMemberSummary(profile: { id: string; name: string; avatar: string | null; role: string } | null) {
  return profile ? { id: profile.id, name: profile.name, avatar: profile.avatar ?? undefined, role: profile.role as unknown as Role } : undefined;
}

export function toTaskDto(task: DbTask): TaskDto {
  return {
    id: task.id, title: task.title, description: task.description ?? undefined, source: task.source ?? undefined,
    departmentId: task.departmentId, creatorId: task.creatorId, leaderId: task.leaderId,
    status: task.status, priority: task.priority, visibility: task.visibility, internalDeadline: date(task.internalDeadline),
    finalDeadline: task.finalDeadline.toISOString(), tags: task.tags,
    department: { id: task.department.id, name: task.department.name, shortName: task.department.shortName },
    creator: toMemberSummary(task.creator)!,
    leader: toMemberSummary(task.leader)!,
    assignees: task.assignees.map((item) => ({ id: item.id, profileId: item.profileId, role: item.role, profile: toMemberSummary(item.profile)! })),
    deliverables: task.deliverables.map((item) => ({ id: item.id, name: item.name, description: item.description ?? undefined, required: item.required, allowedFormats: item.allowedFormats, status: item.status, assigneeId: item.assigneeId ?? undefined, reviewerId: item.reviewerId ?? undefined, assignee: toMemberSummary(item.assignee), reviewer: toMemberSummary(item.reviewer), createdAt: item.createdAt.toISOString() })),
    createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString(),
  };
}

function canReadTask(user: AuthUser, task: { departmentId: string; creatorId: string; leaderId: string; assignees: Array<{ profileId: string }> }) {
  if (can(user, 'task:view_all')) return true;
  if (can(user, 'task:view_department') && user.departmentId === task.departmentId) return true;
  return can(user, 'task:view_own') && (task.creatorId === user.id || task.leaderId === user.id || task.assignees.some((item) => item.profileId === user.id));
}

export async function listTasks(user: AuthUser, filters: { status?: string; q?: string }) {
  const where: Prisma.TaskWhereInput = {
    deletedAt: null,
    ...(filters.status && Object.values(DbTaskStatus).includes(filters.status as DbTaskStatus) ? { status: filters.status as DbTaskStatus } : {}),
    ...(filters.q ? { title: { contains: filters.q, mode: 'insensitive' } } : {}),
  };
  if (!can(user, 'task:view_all')) {
    const permittedScopes: Prisma.TaskWhereInput[] = [
      ...(can(user, 'task:view_department') && user.departmentId ? [{ departmentId: user.departmentId }] : []),
      ...(can(user, 'task:view_own') ? [{ creatorId: user.id }, { leaderId: user.id }, { assignees: { some: { profileId: user.id } } }] : []),
    ];
    where.OR = permittedScopes;
  }
  if (!can(user, 'task:view_all') && (!where.OR || where.OR.length === 0)) return [];
  const tasks = await getDb().task.findMany({ where, include: taskInclude, orderBy: { updatedAt: 'desc' } });
  return tasks.map(toTaskDto);
}

export async function findTask(user: AuthUser, id: string) {
  const task = await getDb().task.findFirst({ where: { id, deletedAt: null }, include: taskInclude });
  if (!task || !canReadTask(user, task)) return null;
  return toTaskDto(task);
}

type CreateTaskInput = z.infer<typeof createTaskSchema>;
type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

function canMutateTask(user: AuthUser, task: { departmentId: string }) {
  if (can(user, 'task:view_all')) return true;
  return Boolean(user.departmentId && task.departmentId === user.departmentId);
}

async function validateTaskPeople(input: { departmentId: string; leaderId: string; assignees?: Array<{ profileId: string }> }) {
  const profileIds = [...new Set([input.leaderId, ...(input.assignees?.map((item) => item.profileId) ?? [])])];
  const people = await getDb().profile.findMany({ where: { id: { in: profileIds }, accountEnabled: true }, select: { id: true, departmentId: true } });
  if (people.length !== profileIds.length) throw new Error('TASK_MEMBER_NOT_FOUND');
  if (people.some((person) => person.departmentId !== input.departmentId)) throw new Error('TASK_MEMBER_SCOPE_FORBIDDEN');
}

function taskAudit(tx: Prisma.TransactionClient, input: { actorId: string; action: string; taskId: string; metadata?: Prisma.InputJsonValue }) {
  return tx.auditLog.create({ data: { actorId: input.actorId, action: input.action, targetType: 'TASK', targetId: input.taskId, metadata: input.metadata } });
}

export async function createTask(user: AuthUser, input: CreateTaskInput) {
  const db = getDb();
  const [department, leader] = await Promise.all([
    db.department.findUnique({ where: { id: input.departmentId } }),
    db.profile.findUnique({ where: { id: input.leaderId } }),
  ]);
  if (!department) throw new Error('DEPARTMENT_NOT_FOUND');
  if (!leader) throw new Error('LEADER_NOT_FOUND');
  if (user.role === Role.DEPUTY_SECRETARY || user.role === Role.MINISTER) {
    if (!user.departmentId || input.departmentId !== user.departmentId || input.visibility === 'ALL') throw new Error('DEPARTMENT_SCOPE_FORBIDDEN');
  }
  if (leader.departmentId !== input.departmentId) throw new Error('TASK_MEMBER_SCOPE_FORBIDDEN');

  const task = await db.$transaction(async (tx) => {
    const created = await tx.task.create({ data: {
      title: input.title, description: input.description || null, source: input.source || null,
      departmentId: input.departmentId, creatorId: user.id, leaderId: input.leaderId,
      status: input.status, priority: input.priority, visibility: input.visibility,
      internalDeadline: input.internalDeadline ? new Date(input.internalDeadline) : null,
      finalDeadline: new Date(input.finalDeadline), tags: [...new Set(input.tags)],
      assignees: { create: { profileId: input.leaderId, role: 'executor' } },
      deliverables: { create: input.deliverables.map((item) => ({ name: item.name, description: item.description || null, required: item.required, allowedFormats: [...new Set(item.allowedFormats)], assigneeId: input.leaderId })) },
    }, include: taskInclude });
    await taskAudit(tx, { actorId: user.id, action: 'TASK_CREATED', taskId: created.id });
    return created;
  });
  return toTaskDto(task);
}

export async function updateTask(user: AuthUser, id: string, input: UpdateTaskInput) {
  const db = getDb();
  const existing = await db.task.findFirst({ where: { id, deletedAt: null }, include: { assignees: true, deliverables: true } });
  if (!existing) throw new Error('TASK_NOT_FOUND');
  if (!canMutateTask(user, existing)) throw new Error('TASK_SCOPE_FORBIDDEN');
  if (existing.status === DbTaskStatus.ARCHIVED || existing.status === DbTaskStatus.CANCELLED) throw new Error('TASK_READ_ONLY');

  const departmentId = input.departmentId ?? existing.departmentId;
  const leaderId = input.leaderId ?? existing.leaderId;
  if ((user.role === Role.DEPUTY_SECRETARY || user.role === Role.MINISTER) && (!user.departmentId || departmentId !== user.departmentId || input.visibility === 'ALL')) throw new Error('DEPARTMENT_SCOPE_FORBIDDEN');
  if (input.internalDeadline && (input.finalDeadline ?? existing.finalDeadline.toISOString()) && new Date(input.internalDeadline) > new Date(input.finalDeadline ?? existing.finalDeadline.toISOString())) throw new Error('INVALID_DEADLINE');
  await validateTaskPeople({ departmentId, leaderId, assignees: input.assignees ?? existing.assignees.map((item) => ({ profileId: item.profileId })) });

  return db.$transaction(async (tx) => {
    if (input.deliverables) {
      const known = new Set(existing.deliverables.map((item) => item.id));
      if (input.deliverables.some((item) => item.id && !known.has(item.id))) throw new Error('DELIVERABLE_NOT_FOUND');
      const requested = new Set(input.deliverables.flatMap((item) => item.id ? [item.id] : []));
      const removed = existing.deliverables.filter((item) => !requested.has(item.id));
      for (const deliverable of removed) {
        const [submissions, files, reviews] = await Promise.all([
          tx.submission.count({ where: { deliverableId: deliverable.id } }),
          tx.fileRecord.count({ where: { deliverableId: deliverable.id } }),
          tx.reviewRecord.count({ where: { deliverableId: deliverable.id } }),
        ]);
        if (submissions || files || reviews) throw new Error('DELIVERABLE_HAS_HISTORY');
      }
      if (removed.length) await tx.deliverable.deleteMany({ where: { id: { in: removed.map((item) => item.id) } } });
      for (const item of input.deliverables) {
        const data = { name: item.name, description: item.description || null, required: item.required, allowedFormats: [...new Set(item.allowedFormats)] };
        if (item.id) await tx.deliverable.update({ where: { id: item.id }, data });
        else await tx.deliverable.create({ data: { ...data, taskId: existing.id, assigneeId: leaderId } });
      }
    }
    if (input.assignees || input.leaderId) {
      const desired = input.assignees ?? existing.assignees.map((item) => ({ profileId: item.profileId, role: item.role }));
      const normalized = new Map(desired.map((item) => [`${item.profileId}:${item.role}`, item]));
      normalized.set(`${leaderId}:executor`, { profileId: leaderId, role: 'executor' });
      await tx.taskAssignee.deleteMany({ where: { taskId: existing.id } });
      await tx.taskAssignee.createMany({ data: [...normalized.values()].map((item) => ({ taskId: existing.id, profileId: item.profileId, role: item.role })) });
    }
    const updated = await tx.task.update({ where: { id: existing.id }, data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.source !== undefined ? { source: input.source || null } : {}),
      ...(input.departmentId !== undefined ? { departmentId } : {}),
      ...(input.leaderId !== undefined ? { leaderId } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
      ...(input.internalDeadline !== undefined ? { internalDeadline: input.internalDeadline ? new Date(input.internalDeadline) : null } : {}),
      ...(input.finalDeadline !== undefined ? { finalDeadline: new Date(input.finalDeadline) } : {}),
      ...(input.tags !== undefined ? { tags: [...new Set(input.tags)] } : {}),
    }, include: taskInclude });
    await taskAudit(tx, { actorId: user.id, action: 'TASK_UPDATED', taskId: existing.id, metadata: { changedFields: Object.keys(input) } });
    return toTaskDto(updated);
  });
}

export async function deleteOrCancelTask(user: AuthUser, id: string) {
  const db = getDb();
  const task = await db.task.findFirst({ where: { id, deletedAt: null }, select: { id: true, departmentId: true, status: true } });
  if (!task) throw new Error('TASK_NOT_FOUND');
  if (!canMutateTask(user, task)) throw new Error('TASK_SCOPE_FORBIDDEN');
  if (task.status === DbTaskStatus.ARCHIVED) throw new Error('TASK_READ_ONLY');
  return db.$transaction(async (tx) => {
    const [submissions, files, reviews] = await Promise.all([
      tx.submission.count({ where: { taskId: id } }),
      tx.fileRecord.count({ where: { taskId: id } }),
      tx.reviewRecord.count({ where: { taskId: id } }),
    ]);
    if (submissions || files || reviews) {
      const updated = await tx.task.update({ where: { id }, data: { status: DbTaskStatus.CANCELLED } });
      await taskAudit(tx, { actorId: user.id, action: 'TASK_CANCELLED', taskId: id, metadata: { submissions, files, reviews } });
      return { id: updated.id, action: 'cancelled' as const };
    }
    await tx.task.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: user.id } });
    await taskAudit(tx, { actorId: user.id, action: 'TASK_DELETED', taskId: id });
    return { id, action: 'deleted' as const };
  });
}
