import 'server-only';

import { getDb } from '@/lib/db';
import type { TaskDto } from '@/lib/api/contracts';
import { can } from '@/lib/permissions';
import type { AuthUser } from '@/lib/api/contracts';
import type { z } from 'zod';
import type { createTaskSchema } from '@/lib/validations/task';
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
  const task = await getDb().task.findUnique({ where: { id }, include: taskInclude });
  if (!task || !canReadTask(user, task)) return null;
  return toTaskDto(task);
}

type CreateTaskInput = z.infer<typeof createTaskSchema>;

export async function createTask(user: AuthUser, input: CreateTaskInput) {
  const db = getDb();
  const [department, leader] = await Promise.all([
    db.department.findUnique({ where: { id: input.departmentId } }),
    db.profile.findUnique({ where: { id: input.leaderId } }),
  ]);
  if (!department) throw new Error('DEPARTMENT_NOT_FOUND');
  if (!leader) throw new Error('LEADER_NOT_FOUND');

  const task = await db.$transaction((tx) => tx.task.create({
    data: {
      title: input.title, description: input.description || null, source: input.source || null,
      departmentId: input.departmentId, creatorId: user.id, leaderId: input.leaderId,
      status: input.status, priority: input.priority, visibility: input.visibility,
      internalDeadline: input.internalDeadline ? new Date(input.internalDeadline) : null,
      finalDeadline: new Date(input.finalDeadline), tags: [...new Set(input.tags)],
      assignees: { create: { profileId: input.leaderId, role: 'executor' } },
      deliverables: { create: input.deliverables.map((item) => ({ name: item.name, description: item.description || null, required: item.required, allowedFormats: [...new Set(item.allowedFormats)], assigneeId: input.leaderId })) },
    }, include: taskInclude,
  }));
  return toTaskDto(task);
}
