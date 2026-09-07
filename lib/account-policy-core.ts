const DEVELOPMENT_EMAIL_DOMAIN = 'example.local';
export class AccountPolicyError extends Error {}
export function normalizeEmail(value: string) { return value.trim().toLowerCase(); }
export function getAllowedEmailDomain() {
  const domain = (process.env.SCHOOL_EMAIL_DOMAIN ?? process.env.ALLOWED_EMAIL_DOMAIN)?.trim().toLowerCase();
  if (!domain || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain)) throw new AccountPolicyError('ALLOWED_EMAIL_DOMAIN is not configured.');
  return domain;
}
export function normalizeStudentId(value: string) {
  const studentId = value.trim().toLowerCase();
  if (!studentId || !/^[a-z0-9_-]+$/.test(studentId)) throw new AccountPolicyError('学号格式不合法。');
  return studentId;
}
export function schoolEmailForStudentId(value: string) { return `${normalizeStudentId(value)}@${getAllowedEmailDomain()}`; }
export function isAllowedAccountEmail(value: string) {
  const email = normalizeEmail(value); const at = email.lastIndexOf('@'); if (at <= 0 || at === email.length - 1) return false;
  const domain = email.slice(at + 1); return domain === getAllowedEmailDomain() || (process.env.NODE_ENV !== 'production' && domain === DEVELOPMENT_EMAIL_DOMAIN);
}
export function requireAllowedAccountEmail(value: string) { const email = normalizeEmail(value); if (!isAllowedAccountEmail(email)) throw new AccountPolicyError('邮箱必须使用学校学生邮箱。'); return email; }
export function getInitialAccountPassword() { const value = process.env.INITIAL_ACCOUNT_PASSWORD; if (!value || value.length > 128) throw new AccountPolicyError('INITIAL_ACCOUNT_PASSWORD is not configured.'); return value; }
export function validateNewPassword(input: { currentPassword: string; newPassword: string; confirmPassword: string }) { if (input.newPassword !== input.confirmPassword) throw new AccountPolicyError('两次输入的新密码不一致。'); if (input.newPassword.length < 8 || input.newPassword.length > 128) throw new AccountPolicyError('新密码长度必须为 8 到 128 位。'); if (input.newPassword === getInitialAccountPassword()) throw new AccountPolicyError('新密码不能与初始密码相同。'); }
