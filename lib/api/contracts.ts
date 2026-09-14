import type { Role } from '@/types';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: Role;
  phone?: string;
  studentId?: string;
  departmentId?: string;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
  mustChangePassword: boolean;
}

export interface DepartmentDto {
  id: string;
  name: string;
  shortName: string;
  description?: string;
  leaderId?: string;
  memberCount: number;
  createdAt: string;
}

export interface MemberDto {
  id: string;
  name: string;
  avatar?: string;
  role: Role;
  departmentId?: string;
  department?: Pick<DepartmentDto, 'id' | 'name' | 'shortName'>;
  email?: string;
  accountEnabled?: boolean;
  mustChangePassword?: boolean;
}

export interface TaskDto {
  id: string;
  title: string;
  description?: string;
  source?: string;
  departmentId: string;
  creatorId: string;
  leaderId: string;
  status: 'DRAFT' | 'ASSIGNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'UNDER_REVIEW' | 'REVISION_REQUIRED' | 'APPROVED' | 'ARCHIVED' | 'CANCELLED';
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  visibility: 'ALL' | 'DEPARTMENT' | 'SPECIFIED';
  internalDeadline?: string;
  finalDeadline: string;
  tags: string[];
  department: Pick<DepartmentDto, 'id' | 'name' | 'shortName'>;
  creator: Pick<MemberDto, 'id' | 'name' | 'avatar' | 'role'>;
  leader: Pick<MemberDto, 'id' | 'name' | 'avatar' | 'role'>;
  assignees: Array<{ id: string; profileId: string; role: 'executor' | 'collaborator' | 'reviewer'; profile: Pick<MemberDto, 'id' | 'name' | 'avatar' | 'role'> }>;
  deliverables: Array<{ id: string; name: string; description?: string; required: boolean; allowedFormats: string[]; status: 'pending' | 'submitted' | 'approved' | 'revision_required'; assigneeId?: string; reviewerId?: string; assignee?: Pick<MemberDto, 'id' | 'name' | 'avatar' | 'role'>; reviewer?: Pick<MemberDto, 'id' | 'name' | 'avatar' | 'role'>; createdAt: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface ApiEnvelope<T> { success: boolean; data: T }
