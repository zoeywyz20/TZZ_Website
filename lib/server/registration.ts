import 'server-only';
import bcrypt from 'bcryptjs';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { RegistrationStatus, Role } from '@/generated/prisma/client';
import { getDb } from '@/lib/db';
import { AccountPolicyError, normalizeStudentId, schoolEmailForStudentId, validateNewPassword } from '@/lib/server/account-policy';
import { sendApplicationApproved, sendApplicationRejected, sendVerificationCode } from '@/lib/server/mail';

const OTP_TTL_MS = 10 * 60_000; const ACTIVATION_TTL_MS = 24 * 60 * 60_000; const MAX_OTP_ATTEMPTS = 5;
export class RegistrationError extends Error {}
function otpSecret() { const value = process.env.OTP_SECRET; if (!value || value.length < 32) throw new RegistrationError('注册验证暂不可用，请联系管理员。'); return value; }
function otpHash(applicationId: string, code: string) { return createHmac('sha256', otpSecret()).update(`${applicationId}:${code}`).digest('hex'); }
function tokenHash(token: string) { return createHash('sha256').update(token).digest('hex'); }
function audit(input: { action: string; applicationId: string; targetEmail: string; actorId?: string; oldStatus?: RegistrationStatus; newStatus?: RegistrationStatus; approvedRole?: Role; approvedDepartmentId?: string | null }) { return getDb().auditLog.create({ data: input }); }
function publicUrl() { const value = process.env.PUBLIC_APP_URL?.trim().replace(/\/$/, ''); if (!value || !/^https?:\/\//.test(value)) throw new RegistrationError('激活链接暂不可用，请联系管理员。'); return value; }
function safeName(value: string) { const name = value.trim().replace(/\s+/g, ' '); if (!name || name.length > 100) throw new RegistrationError('姓名不合法。'); return name; }
function matches(a: string, b: string) { const x = Buffer.from(a, 'hex'); const y = Buffer.from(b, 'hex'); return x.length === y.length && timingSafeEqual(x, y); }
function applicationForAdmin(id: string) { return getDb().registrationApplication.findUnique({ where: { id }, include: { requestedDepartment: true, approvedDepartment: true } }); }

export async function publicDepartments() { return getDb().department.findMany({ select: { id: true, name: true, shortName: true }, orderBy: { createdAt: 'asc' } }); }

export async function startRegistration(input: { name: string; studentId: string; requestedDepartmentId?: string | null }) {
  const name = safeName(input.name); const studentId = normalizeStudentId(input.studentId); const email = schoolEmailForStudentId(studentId);
  if (input.requestedDepartmentId && !await getDb().department.findUnique({ where: { id: input.requestedDepartmentId }, select: { id: true } })) throw new RegistrationError('申请信息不合法。');
  if (await getDb().profile.findFirst({ where: { OR: [{ email }, { studentId }] }, select: { id: true } })) throw new RegistrationError('该账号已存在或无法申请，请尝试登录或联系管理员。');
  const existing = await getDb().registrationApplication.findUnique({ where: { email } });
  const activeStatuses: RegistrationStatus[] = [RegistrationStatus.EMAIL_PENDING, RegistrationStatus.PENDING, RegistrationStatus.APPROVED];
  if (existing && activeStatuses.includes(existing.status)) throw new RegistrationError('该账号已存在或无法申请，请尝试登录或联系管理员。');
  const code = String(randomInt(100_000, 1_000_000)); const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const application = existing
    ? await getDb().registrationApplication.update({ where: { id: existing.id }, data: { name, studentId, requestedDepartmentId: input.requestedDepartmentId ?? null, status: RegistrationStatus.EMAIL_PENDING, emailVerifiedAt: null, verificationCodeHash: otpHash(existing.id, code), verificationExpiresAt: expiresAt, verificationAttempts: 0, verificationSentAt: new Date(), approvedRole: null, approvedDepartmentId: null, reviewedBy: null, reviewedAt: null, reviewNote: null, activationTokenHash: null, activationExpiresAt: null, activatedAt: null } })
    : await getDb().registrationApplication.create({ data: { name, studentId, email, requestedDepartmentId: input.requestedDepartmentId ?? null, verificationCodeHash: undefined, verificationExpiresAt: expiresAt, verificationAttempts: 0, verificationSentAt: new Date() } });
  if (!existing) await getDb().registrationApplication.update({ where: { id: application.id }, data: { verificationCodeHash: otpHash(application.id, code) } });
  await audit({ action: 'REGISTRATION_SUBMITTED', applicationId: application.id, targetEmail: email, oldStatus: existing?.status, newStatus: RegistrationStatus.EMAIL_PENDING });
  await sendVerificationCode(email, code);
  return { applicationId: application.id, email, status: RegistrationStatus.EMAIL_PENDING };
}

export async function resendVerificationCode(applicationId: string) {
  const application = await getDb().registrationApplication.findUnique({ where: { id: applicationId } });
  if (!application || application.status !== RegistrationStatus.EMAIL_PENDING) throw new RegistrationError('验证码错误或已失效。');
  if (application.verificationSentAt && Date.now() - application.verificationSentAt.getTime() < 60_000) throw new RegistrationError('操作过于频繁，请稍后再试。');
  const code = String(randomInt(100_000, 1_000_000));
  await getDb().registrationApplication.update({ where: { id: application.id }, data: { verificationCodeHash: otpHash(application.id, code), verificationExpiresAt: new Date(Date.now() + OTP_TTL_MS), verificationAttempts: 0, verificationSentAt: new Date() } });
  await audit({ action: 'REGISTRATION_OTP_RESENT', applicationId: application.id, targetEmail: application.email, oldStatus: application.status, newStatus: application.status });
  await sendVerificationCode(application.email, code);
  return { applicationId: application.id, status: application.status };
}

export async function verifyRegistrationEmail(input: { applicationId: string; code: string }) {
  const application = await getDb().registrationApplication.findUnique({ where: { id: input.applicationId } });
  if (!application || application.status !== RegistrationStatus.EMAIL_PENDING || !application.verificationCodeHash || !application.verificationExpiresAt || application.verificationExpiresAt <= new Date() || application.verificationAttempts >= MAX_OTP_ATTEMPTS || !/^\d{6}$/.test(input.code)) throw new RegistrationError('验证码错误或已失效。');
  if (!matches(application.verificationCodeHash, otpHash(application.id, input.code))) {
    const attempts = application.verificationAttempts + 1;
    await getDb().registrationApplication.update({ where: { id: application.id }, data: attempts >= MAX_OTP_ATTEMPTS ? { verificationAttempts: attempts, verificationCodeHash: null, verificationExpiresAt: null } : { verificationAttempts: attempts } });
    throw new RegistrationError('验证码错误或已失效。');
  }
  await getDb().$transaction(async (tx) => { await tx.registrationApplication.update({ where: { id: application.id }, data: { status: RegistrationStatus.PENDING, emailVerifiedAt: new Date(), verificationCodeHash: null, verificationExpiresAt: null, verificationAttempts: 0 } }); await tx.auditLog.create({ data: { action: 'REGISTRATION_EMAIL_VERIFIED', applicationId: application.id, targetEmail: application.email, oldStatus: RegistrationStatus.EMAIL_PENDING, newStatus: RegistrationStatus.PENDING } }); });
  return { status: RegistrationStatus.PENDING };
}

export async function listRegistrations(status?: RegistrationStatus) { return getDb().registrationApplication.findMany({ where: status ? { status } : undefined, include: { requestedDepartment: { select: { id: true, name: true, shortName: true } }, approvedDepartment: { select: { id: true, name: true, shortName: true } } }, orderBy: { createdAt: 'desc' } }); }

export async function approveRegistration(input: { id: string; actorId: string; departmentId: string; role: Role; reviewNote?: string | null }) {
  if (input.role === Role.SUPER_ADMIN) throw new RegistrationError('注册审核不能授予超级管理员。');
  const application = await getDb().registrationApplication.findUnique({ where: { id: input.id } });
  if (!application || application.status !== RegistrationStatus.PENDING || !application.emailVerifiedAt) throw new RegistrationError('申请当前不能审核。');
  if (!await getDb().department.findUnique({ where: { id: input.departmentId }, select: { id: true } })) throw new RegistrationError('申请信息不合法。');
  if (await getDb().profile.findFirst({ where: { OR: [{ email: application.email }, { studentId: application.studentId }] }, select: { id: true } })) throw new RegistrationError('该账号已存在或无法申请，请联系管理员处理。');
  const token = randomBytes(32).toString('base64url');
  await getDb().$transaction(async (tx) => { await tx.registrationApplication.update({ where: { id: application.id }, data: { status: RegistrationStatus.APPROVED, approvedRole: input.role, approvedDepartmentId: input.departmentId, reviewedBy: input.actorId, reviewedAt: new Date(), reviewNote: input.reviewNote?.trim().slice(0, 1000) || null, activationTokenHash: tokenHash(token), activationExpiresAt: new Date(Date.now() + ACTIVATION_TTL_MS) } }); await tx.auditLog.create({ data: { action: 'REGISTRATION_APPROVED', applicationId: application.id, targetEmail: application.email, actorId: input.actorId, oldStatus: RegistrationStatus.PENDING, newStatus: RegistrationStatus.APPROVED, approvedRole: input.role, approvedDepartmentId: input.departmentId } }); });
  const approved = await applicationForAdmin(application.id); if (!approved?.approvedDepartment) throw new RegistrationError('申请信息不完整。');
  try { await sendApplicationApproved({ to: approved.email, name: approved.name, email: approved.email, department: approved.approvedDepartment.name, role: approved.approvedRole!, activationUrl: `${publicUrl()}/activate?token=${encodeURIComponent(token)}` }); return { mailSent: true }; }
  catch { return { mailSent: false }; }
}

export async function resendActivation(applicationId: string, actorId: string) {
  const application = await applicationForAdmin(applicationId);
  if (!application || application.status !== RegistrationStatus.APPROVED || !application.approvedDepartment || !application.approvedRole) throw new RegistrationError('申请状态不允许发送激活邮件。');
  const token = randomBytes(32).toString('base64url');
  await getDb().$transaction(async (tx) => { await tx.registrationApplication.update({ where: { id: application.id }, data: { activationTokenHash: tokenHash(token), activationExpiresAt: new Date(Date.now() + ACTIVATION_TTL_MS) } }); await tx.auditLog.create({ data: { action: 'ACTIVATION_EMAIL_RESENT', applicationId: application.id, targetEmail: application.email, actorId, oldStatus: application.status, newStatus: application.status, approvedRole: application.approvedRole, approvedDepartmentId: application.approvedDepartmentId } }); });
  await sendApplicationApproved({ to: application.email, name: application.name, email: application.email, department: application.approvedDepartment.name, role: application.approvedRole, activationUrl: `${publicUrl()}/activate?token=${encodeURIComponent(token)}` });
  return { mailSent: true };
}

export async function rejectRegistration(input: { id: string; actorId: string; reviewNote?: string | null }) {
  const application = await getDb().registrationApplication.findUnique({ where: { id: input.id } });
  if (!application || application.status !== RegistrationStatus.PENDING) throw new RegistrationError('申请当前不能审核。');
  await getDb().$transaction(async (tx) => { await tx.registrationApplication.update({ where: { id: application.id }, data: { status: RegistrationStatus.REJECTED, reviewedBy: input.actorId, reviewedAt: new Date(), reviewNote: input.reviewNote?.trim().slice(0, 1000) || null } }); await tx.auditLog.create({ data: { action: 'REGISTRATION_REJECTED', applicationId: application.id, targetEmail: application.email, actorId: input.actorId, oldStatus: RegistrationStatus.PENDING, newStatus: RegistrationStatus.REJECTED } }); });
  try { await sendApplicationRejected({ to: application.email, name: application.name, note: input.reviewNote }); return { mailSent: true }; } catch { return { mailSent: false }; }
}

export async function activateRegistration(input: { token: string; newPassword: string; confirmPassword: string }) {
  try { validateNewPassword({ currentPassword: '', newPassword: input.newPassword, confirmPassword: input.confirmPassword }); } catch (error) { if (error instanceof AccountPolicyError) throw new RegistrationError(error.message); throw error; }
  const hash = tokenHash(input.token); const application = await getDb().registrationApplication.findUnique({ where: { activationTokenHash: hash } });
  if (!application || application.status !== RegistrationStatus.APPROVED || !application.activationExpiresAt || application.activationExpiresAt <= new Date() || !application.emailVerifiedAt || !application.approvedRole || !application.approvedDepartmentId) throw new RegistrationError('激活链接无效或已过期。');
  const passwordHash = await bcrypt.hash(input.newPassword, 12); const now = new Date();
  const profile = await getDb().$transaction(async (tx) => {
    const fresh = await tx.registrationApplication.findUnique({ where: { id: application.id } });
    if (!fresh || fresh.status !== RegistrationStatus.APPROVED || fresh.activationTokenHash !== hash || !fresh.activationExpiresAt || fresh.activationExpiresAt <= now) throw new RegistrationError('激活链接无效或已过期。');
    if (await tx.profile.findFirst({ where: { OR: [{ email: fresh.email }, { studentId: fresh.studentId }] }, select: { id: true } })) throw new RegistrationError('该账号已存在或无法激活，请联系管理员。');
    const created = await tx.profile.create({ data: { name: fresh.name, studentId: fresh.studentId, email: fresh.email, role: fresh.approvedRole!, departmentId: fresh.approvedDepartmentId!, passwordHash, accountEnabled: true, mustChangePassword: false, passwordChangedAt: now } });
    await tx.registrationApplication.update({ where: { id: fresh.id }, data: { status: RegistrationStatus.ACTIVATED, activatedAt: now, activationTokenHash: null, activationExpiresAt: null } });
    await tx.auditLog.create({ data: { action: 'ACCOUNT_ACTIVATED', applicationId: fresh.id, targetEmail: fresh.email, oldStatus: RegistrationStatus.APPROVED, newStatus: RegistrationStatus.ACTIVATED, approvedRole: fresh.approvedRole, approvedDepartmentId: fresh.approvedDepartmentId } });
    return created;
  });
  return profile;
}
