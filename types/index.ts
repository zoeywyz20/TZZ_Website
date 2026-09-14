// ============================================================
// Ocean Youth League Workspace — Core Type Definitions
// ============================================================

// ---------- Enums ----------

export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  SECRETARY = 'SECRETARY',
  DEPUTY_SECRETARY = 'DEPUTY_SECRETARY',
  MINISTER = 'MINISTER',
  VICE_MINISTER = 'VICE_MINISTER',
  MEMBER = 'MEMBER',
  GUEST = 'GUEST',
}

export const RoleLabel: Record<Role, string> = {
  [Role.SUPER_ADMIN]: '超级管理员',
  [Role.SECRETARY]: '总书记',
  [Role.DEPUTY_SECRETARY]: '副书记',
  [Role.MINISTER]: '部长',
  [Role.VICE_MINISTER]: '副部长',
  [Role.MEMBER]: '部员',
  [Role.GUEST]: '访客',
};

export enum TaskStatus {
  DRAFT = 'DRAFT',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  REVISION_REQUIRED = 'REVISION_REQUIRED',
  APPROVED = 'APPROVED',
  ARCHIVED = 'ARCHIVED',
  CANCELLED = 'CANCELLED',
}

export const TaskStatusLabel: Record<TaskStatus, string> = {
  [TaskStatus.DRAFT]: '草稿',
  [TaskStatus.ASSIGNED]: '已下发',
  [TaskStatus.IN_PROGRESS]: '进行中',
  [TaskStatus.SUBMITTED]: '已提交',
  [TaskStatus.UNDER_REVIEW]: '待审核',
  [TaskStatus.REVISION_REQUIRED]: '退回修改',
  [TaskStatus.APPROVED]: '审核通过',
  [TaskStatus.ARCHIVED]: '已归档',
  [TaskStatus.CANCELLED]: '已取消',
};

export enum TaskPriority {
  NORMAL = 'NORMAL',
  IMPORTANT = 'IMPORTANT',
  URGENT = 'URGENT',
}

export const TaskPriorityLabel: Record<TaskPriority, string> = {
  [TaskPriority.NORMAL]: '普通',
  [TaskPriority.IMPORTANT]: '重要',
  [TaskPriority.URGENT]: '紧急',
};

export enum FileStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  ARCHIVED = 'ARCHIVED',
}

export const FileStatusLabel: Record<FileStatus, string> = {
  [FileStatus.DRAFT]: '草稿',
  [FileStatus.PENDING_REVIEW]: '待审核',
  [FileStatus.APPROVED]: '正式稿',
  [FileStatus.ARCHIVED]: '归档',
};

export enum ReviewAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export const ReviewActionLabel: Record<ReviewAction, string> = {
  [ReviewAction.APPROVE]: '通过',
  [ReviewAction.REJECT]: '退回修改',
};

export enum NotificationType {
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  DEADLINE_APPROACHING = 'DEADLINE_APPROACHING',
  TASK_OVERDUE = 'TASK_OVERDUE',
  SUBMISSION_RECEIVED = 'SUBMISSION_RECEIVED',
  REVIEW_APPROVED = 'REVIEW_APPROVED',
  REVIEW_REJECTED = 'REVIEW_REJECTED',
  MENTION = 'MENTION',
  SYSTEM = 'SYSTEM',
}

export enum Visibility {
  ALL = 'ALL',
  DEPARTMENT = 'DEPARTMENT',
  SPECIFIED = 'SPECIFIED',
}

export const VisibilityLabel: Record<Visibility, string> = {
  [Visibility.ALL]: '所有成员',
  [Visibility.DEPARTMENT]: '所在部门',
  [Visibility.SPECIFIED]: '指定人员',
};

// ---------- Models ----------

export interface Profile {
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
  mustChangePassword?: boolean;
}

export interface Department {
  id: string;
  name: string;
  shortName: string;
  description?: string;
  leaderId?: string;
  memberCount: number;
  createdAt: string;
}

export interface DepartmentMember {
  id: string;
  departmentId: string;
  profileId: string;
  role: Role;
  joinedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  source?: string;
  departmentId: string;
  creatorId: string;
  leaderId: string;
  status: TaskStatus;
  priority: TaskPriority;
  visibility: Visibility;
  internalDeadline: string;
  finalDeadline: string;
  tags: string[];
  deliverables: Deliverable[];
  assignees: TaskAssignee[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskAssignee {
  id: string;
  taskId: string;
  profileId: string;
  role: 'executor' | 'collaborator' | 'reviewer';
}

export interface Deliverable {
  id: string;
  taskId: string;
  name: string;
  description?: string;
  required: boolean;
  allowedFormats?: string[];
  maxFiles?: number;
  maxFileSize?: number; // bytes
  templateFileId?: string;
  assigneeId?: string;
  reviewerId?: string;
  submissions: Submission[];
  status: 'pending' | 'submitted' | 'approved' | 'revision_required';
  createdAt: string;
}

export interface Submission {
  id: string;
  deliverableId: string;
  taskId: string;
  submitterId: string;
  fileId: string;
  version: number;
  changeNote?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
}

export interface FileRecord {
  id: string;
  originalFilename: string;
  storageKey: string;
  mimeType: string;
  size: number; // bytes
  hash?: string;
  uploaderId: string;
  taskId?: string;
  deliverableId?: string;
  departmentId?: string;
  folderId?: string;
  visibility?: Visibility;
  status: FileStatus;
  currentVersion: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  deletedBy?: string;
}

export interface FileVersion {
  id: string;
  fileId: string;
  versionNumber: number;
  storageKey: string;
  size: number;
  uploaderId: string;
  changeNote?: string;
  createdAt: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  departmentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewRecord {
  id: string;
  taskId?: string;
  deliverableId?: string;
  submissionId?: string;
  fileId?: string;
  reviewerId: string;
  action: ReviewAction;
  comment?: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  linkTo?: string;
  isRead: boolean;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  actorId: string;
  action: string;
  targetType: 'task' | 'file' | 'review' | 'member' | 'department' | 'system';
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  description?: string;
  fileId: string;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
}

// ---------- Dashboard types ----------

export interface DashboardStats {
  myTasks: number;
  approaching: number;
  overdue: number;
  pendingReview: number;
  completedThisMonth: number;
}

export interface AttentionItem {
  id: string;
  title: string;
  type: 'deadline' | 'review' | 'overdue' | 'new_task';
  description: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
  count?: number;
  linkTo: string;
}
