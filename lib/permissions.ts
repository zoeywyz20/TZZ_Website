import { Role, type Profile } from '@/types';

// ---------- Permission Actions ----------

export type Action =
  | 'task:create'
  | 'task:edit'
  | 'task:delete'
  | 'task:assign'
  | 'task:view_all'
  | 'task:view_department'
  | 'task:view_own'
  | 'file:upload'
  | 'file:download'
  | 'file:delete'
  | 'file:view_all'
  | 'file:view_department'
  | 'review:approve'
  | 'review:reject'
  | 'member:manage'
  | 'member:view'
  | 'department:manage'
  | 'department:view'
  | 'template:manage'
  | 'template:view'
  | 'settings:manage'
  | 'settings:view';

// ---------- Permission Matrix ----------

const permissionMatrix: Record<Role, Set<Action>> = {
  [Role.SUPER_ADMIN]: new Set<Action>([
    'task:create', 'task:edit', 'task:delete', 'task:assign', 'task:view_all',
    'task:view_department', 'task:view_own',
    'file:upload', 'file:download', 'file:delete', 'file:view_all', 'file:view_department',
    'review:approve', 'review:reject',
    'member:manage', 'member:view',
    'department:manage', 'department:view',
    'template:manage', 'template:view',
    'settings:manage', 'settings:view',
  ]),
  [Role.SECRETARY]: new Set<Action>([
    'task:create', 'task:edit', 'task:delete', 'task:assign', 'task:view_all',
    'task:view_department', 'task:view_own',
    'file:upload', 'file:download', 'file:delete', 'file:view_all', 'file:view_department',
    'review:approve', 'review:reject',
    'member:manage', 'member:view',
    'department:manage', 'department:view',
    'template:manage', 'template:view',
    'settings:manage', 'settings:view',
  ]),
  [Role.DEPUTY_SECRETARY]: new Set<Action>([
    'task:create', 'task:edit', 'task:assign', 'task:view_all',
    'task:view_department', 'task:view_own',
    'file:upload', 'file:download', 'file:view_all', 'file:view_department',
    'review:approve', 'review:reject',
    'member:view',
    'department:view',
    'template:manage', 'template:view',
    'settings:view',
  ]),
  [Role.MINISTER]: new Set<Action>([
    'task:create', 'task:edit', 'task:assign',
    'task:view_department', 'task:view_own',
    'file:upload', 'file:download', 'file:view_department',
    'review:approve', 'review:reject',
    'member:view',
    'department:view',
    'template:view',
    'settings:view',
  ]),
  [Role.VICE_MINISTER]: new Set<Action>([
    'task:view_department', 'task:view_own',
    'file:upload', 'file:download', 'file:view_department',
    'member:view',
    'department:view',
    'template:view',
  ]),
  [Role.MEMBER]: new Set<Action>([
    'task:view_own',
    'file:upload', 'file:download',
    'member:view',
    'department:view',
    'template:view',
  ]),
  [Role.GUEST]: new Set<Action>([
    'file:upload',
    'template:view',
  ]),
};

// ---------- Permission Check ----------

export function can(user: Profile | null, action: Action): boolean {
  if (!user) return false;
  return permissionMatrix[user.role]?.has(action) ?? false;
}

export function canCreateTask(user: Profile | null): boolean {
  return can(user, 'task:create');
}

export function canReview(user: Profile | null): boolean {
  return can(user, 'review:approve');
}

export function canManageMembers(user: Profile | null): boolean {
  return can(user, 'member:manage');
}

export function canManageDepartments(user: Profile | null): boolean {
  return can(user, 'department:manage');
}

export function canDeleteFile(user: Profile | null): boolean {
  return can(user, 'file:delete');
}

export function canViewAllTasks(user: Profile | null): boolean {
  return can(user, 'task:view_all');
}

export function isLeadership(role: Role): boolean {
  return [Role.SUPER_ADMIN, Role.SECRETARY, Role.DEPUTY_SECRETARY, Role.MINISTER].includes(role);
}
