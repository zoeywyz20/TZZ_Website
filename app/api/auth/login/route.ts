import bcrypt from 'bcryptjs';
import { apiError, apiSuccess } from '@/lib/api/response';
import { createSession, setSessionCookie, toAuthUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { AccountPolicyError, normalizeEmail, requireAllowedAccountEmail } from '@/lib/server/account-policy';
import { clearLoginFailures, loginAllowed, recordLoginFailure, requestIp } from '@/lib/server/login-rate-limit';
import { loginSchema } from '@/lib/validations/auth';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
const invalid = () => apiError('INVALID_CREDENTIALS', '账号或密码错误。', 401);

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid();
  const email = normalizeEmail(parsed.data.email); const ip = requestIp(request);
  if (!loginAllowed(ip, email)) return apiError('LOGIN_RATE_LIMITED', '登录尝试过于频繁，请稍后再试。', 429);
  try { requireAllowedAccountEmail(email); } catch (error) {
    if (error instanceof AccountPolicyError) { recordLoginFailure(ip, email); return invalid(); }
    throw error;
  }
  const profile = await getDb().profile.findUnique({ where: { email } });
  const matched = profile?.passwordHash ? await bcrypt.compare(parsed.data.password, profile.passwordHash) : false;
  if (!profile || !matched || !profile.accountEnabled) { recordLoginFailure(ip, email); return invalid(); }
  clearLoginFailures(ip, email);
  const { token, expiresAt } = await createSession(profile.id);
  await setSessionCookie(token, expiresAt);
  return apiSuccess({ ...toAuthUser(profile), requiresPasswordChange: profile.mustChangePassword });
}
