import 'server-only';
import bcrypt from 'bcryptjs';
import { RegistrationStatus, Role } from '@/generated/prisma/client';
import { getDb } from '@/lib/db';
import { getInitialAccountPassword, normalizeStudentId, schoolEmailForStudentId } from '@/lib/server/account-policy';

export class RegistrationError extends Error {}
const OPENABLE_ROLES = new Set<Role>([Role.DEPUTY_SECRETARY, Role.MINISTER, Role.VICE_MINISTER, Role.MEMBER, Role.GUEST]);
function audit(input: { action: string; applicationId: string; targetEmail: string; actorId?: string; oldStatus?: RegistrationStatus; newStatus?: RegistrationStatus; approvedRole?: Role; approvedDepartmentId?: string | null }) { return getDb().auditLog.create({ data: input }); }
function safeName(value: string) { const name = value.trim().replace(/\s+/g, ' '); if (!name || name.length > 100) throw new RegistrationError('姓名不合法。'); return name; }

export async function publicDepartments() { return getDb().department.findMany({ select: { id: true, name: true, shortName: true }, orderBy: { createdAt: 'asc' } }); }

export async function startRegistration(input: { name: string; studentId: string; requestedDepartmentId?: string | null }) {
  const name = safeName(input.name); const studentId = normalizeStudentId(input.studentId); const email = schoolEmailForStudentId(studentId);
  if (input.requestedDepartmentId && !await getDb().department.findUnique({ where: { id: input.requestedDepartmentId }, select: { id: true } })) throw new RegistrationError('申请信息不合法。');
  if (await getDb().profile.findFirst({ where: { OR: [{ email }, { studentId }] }, select: { id: true } })) throw new RegistrationError('该账号已存在或无法申请，请尝试登录或联系管理员。');
  const existing = await getDb().registrationApplication.findUnique({ where: { email } });
  const activeStatuses: RegistrationStatus[] = [RegistrationStatus.PENDING];
  if (existing && activeStatuses.includes(existing.status)) throw new RegistrationError('该账号已存在或无法申请，请尝试登录或联系管理员。');
  const application = existing
    ? await getDb().registrationApplication.update({ where: { id: existing.id }, data: { name, studentId, requestedDepartmentId: input.requestedDepartmentId ?? null, status: RegistrationStatus.PENDING, emailVerifiedAt: null, verificationCodeHash: null, verificationExpiresAt: null, verificationAttempts: 0, verificationSentAt: null, approvedRole: null, approvedDepartmentId: null, reviewedBy: null, reviewedAt: null, reviewNote: null, activationTokenHash: null, activationExpiresAt: null, activatedAt: null } })
    : await getDb().registrationApplication.create({ data: { name, studentId, email, requestedDepartmentId: input.requestedDepartmentId ?? null, status: RegistrationStatus.PENDING } });
  await audit({ action: 'REGISTRATION_SUBMITTED', applicationId: application.id, targetEmail: email, oldStatus: existing?.status, newStatus: RegistrationStatus.PENDING });
  return { applicationId: application.id, status: RegistrationStatus.PENDING };
}

export async function listRegistrations(status?: RegistrationStatus) { return getDb().registrationApplication.findMany({ where: status ? { status } : undefined, include: { requestedDepartment: { select: { id: true, name: true, shortName: true } }, approvedDepartment: { select: { id: true, name: true, shortName: true } } }, orderBy: { createdAt: 'desc' } }); }

export async function approveRegistration(input: { id: string; actorId: string; departmentId: string; role: Role; reviewNote?: string | null }) {
  if (!OPENABLE_ROLES.has(input.role)) throw new RegistrationError('开通账号时只能选择副书记、部长、副部长、部员或访客。');
  const application = await getDb().registrationApplication.findUnique({ where: { id: input.id } });
  if (!application || application.status !== RegistrationStatus.PENDING) throw new RegistrationError('申请当前不能审核。');
  if (!await getDb().department.findUnique({ where: { id: input.departmentId }, select: { id: true } })) throw new RegistrationError('申请信息不合法。');
  if (await getDb().profile.findFirst({ where: { OR: [{ email: application.email }, { studentId: application.studentId }] }, select: { id: true } })) throw new RegistrationError('该账号已存在或无法申请，请联系管理员处理。');
  const passwordHash = await bcrypt.hash(getInitialAccountPassword(), 12); const now = new Date();
  const profile = await getDb().$transaction(async (tx) => {
    const fresh = await tx.registrationApplication.findUnique({ where: { id: application.id } });
    if (!fresh || fresh.status !== RegistrationStatus.PENDING) throw new RegistrationError('申请当前不能审核。');
    const created = await tx.profile.create({ data: { name: fresh.name, studentId: fresh.studentId, email: fresh.email, role: input.role, departmentId: input.departmentId, passwordHash, accountEnabled: true, mustChangePassword: true } });
    await tx.registrationApplication.update({ where: { id: fresh.id }, data: { status: RegistrationStatus.ACTIVATED, approvedRole: input.role, approvedDepartmentId: input.departmentId, reviewedBy: input.actorId, reviewedAt: now, reviewNote: input.reviewNote?.trim().slice(0, 1000) || null, activatedAt: now } });
    await tx.auditLog.create({ data: { action: 'REGISTRATION_APPROVED_ACCOUNT_OPENED', applicationId: fresh.id, targetEmail: fresh.email, actorId: input.actorId, oldStatus: RegistrationStatus.PENDING, newStatus: RegistrationStatus.ACTIVATED, approvedRole: input.role, approvedDepartmentId: input.departmentId } });
    return created;
  });
  return { accountId: profile.id, accountOpened: true };
}

export async function rejectRegistration(input: { id: string; actorId: string; reviewNote?: string | null }) {
  const application = await getDb().registrationApplication.findUnique({ where: { id: input.id } });
  if (!application || application.status !== RegistrationStatus.PENDING) throw new RegistrationError('申请当前不能审核。');
  await getDb().$transaction(async (tx) => { await tx.registrationApplication.update({ where: { id: application.id }, data: { status: RegistrationStatus.REJECTED, reviewedBy: input.actorId, reviewedAt: new Date(), reviewNote: input.reviewNote?.trim().slice(0, 1000) || null } }); await tx.auditLog.create({ data: { action: 'REGISTRATION_REJECTED', applicationId: application.id, targetEmail: application.email, actorId: input.actorId, oldStatus: RegistrationStatus.PENDING, newStatus: RegistrationStatus.REJECTED } }); });
  return { rejected: true };
}
