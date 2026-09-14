import 'server-only';
import { DeliverableStatus, FileStatus, ReviewAction, SubmissionStatus, TaskStatus } from '@/generated/prisma/client';
import { getDb } from '@/lib/db';
import type { AuthUser } from '@/lib/api/contracts';
import { Role } from '@/types';

function canReviewDepartment(user: AuthUser, departmentId: string) { return [Role.SUPER_ADMIN, Role.SECRETARY].includes(user.role) || Boolean(user.departmentId && user.departmentId === departmentId); }
const include = { task: { include: { department: { select: { id: true, name: true, shortName: true } } } }, deliverable: true, submitter: { select: { id: true, name: true } }, file: { select: { id: true, originalFilename: true, size: true, currentVersion: true, mimeType: true } } } as const;

export async function pendingReviews(user: AuthUser) {
  const rows = await getDb().submission.findMany({ where: { status: SubmissionStatus.pending, ...( [Role.SUPER_ADMIN, Role.SECRETARY].includes(user.role) ? {} : { task: { departmentId: user.departmentId ?? '__none__' } }) }, include, orderBy: { submittedAt: 'desc' } });
  return rows.filter((row) => canReviewDepartment(user, row.task.departmentId)).map((row) => ({ id: row.id, task: { id: row.task.id, title: row.task.title, department: row.task.department }, deliverable: { id: row.deliverable.id, name: row.deliverable.name }, submitter: row.submitter, file: { id: row.file.id, originalFilename: row.file.originalFilename, size: row.file.size.toString(), version: row.version, mimeType: row.file.mimeType }, changeNote: row.changeNote ?? undefined, submittedAt: row.submittedAt.toISOString() }));
}

export async function reviewSubmission(user: AuthUser, id: string, action: 'approve' | 'reject', comment?: string) {
  if (action === 'reject' && !comment?.trim()) throw new Error('REVIEW_COMMENT_REQUIRED');
  return getDb().$transaction(async (tx) => {
    const submission = await tx.submission.findUnique({ where: { id }, include: { task: true, deliverable: true, file: true } });
    if (!submission || submission.status !== SubmissionStatus.pending) throw new Error('SUBMISSION_NOT_PENDING');
    if (!canReviewDepartment(user, submission.task.departmentId)) throw new Error('REVIEW_FORBIDDEN');
    const approved = action === 'approve';
    await tx.reviewRecord.create({ data: { taskId: submission.taskId, deliverableId: submission.deliverableId, submissionId: id, fileId: submission.fileId, reviewerId: user.id, action: approved ? ReviewAction.APPROVE : ReviewAction.REJECT, comment: comment?.trim().slice(0, 1000) || null } });
    await tx.submission.update({ where: { id }, data: { status: approved ? SubmissionStatus.approved : SubmissionStatus.rejected } });
    await tx.deliverable.update({ where: { id: submission.deliverableId }, data: { status: approved ? DeliverableStatus.approved : DeliverableStatus.revision_required } });
    await tx.fileRecord.update({ where: { id: submission.fileId }, data: { status: approved ? FileStatus.APPROVED : FileStatus.DRAFT } });
    if (approved) { const outstanding = await tx.deliverable.count({ where: { taskId: submission.taskId, required: true, status: { not: DeliverableStatus.approved } } }); if (outstanding === 0) await tx.task.update({ where: { id: submission.taskId }, data: { status: TaskStatus.APPROVED } }); }
    else await tx.task.update({ where: { id: submission.taskId }, data: { status: TaskStatus.REVISION_REQUIRED } });
    await tx.auditLog.create({ data: { actorId: user.id, action: approved ? 'REVIEW_APPROVED' : 'REVIEW_REJECTED', targetType: 'SUBMISSION', targetId: id, metadata: { taskId: submission.taskId, fileId: submission.fileId } } });
    return { id, status: approved ? 'approved' : 'rejected' };
  });
}
