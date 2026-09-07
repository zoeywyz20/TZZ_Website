import bcrypt from 'bcryptjs';
import { apiError, apiSuccess } from '@/lib/api/response';
import { AuthenticationError, createSession, setSessionCookie, requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { AccountPolicyError, validateNewPassword } from '@/lib/server/account-policy';
import { changePasswordSchema } from '@/lib/validations/auth';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = changePasswordSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError('VALIDATION_ERROR', '新密码长度必须为 8 到 128 位。', 400);
    validateNewPassword(parsed.data);
    const profile = await getDb().profile.findUnique({ where: { id: user.id }, select: { passwordHash: true, accountEnabled: true } });
    const oldMatches = profile?.passwordHash ? await bcrypt.compare(parsed.data.currentPassword, profile.passwordHash) : false;
    if (!profile || !profile.accountEnabled || !oldMatches) return apiError('INVALID_CURRENT_PASSWORD', '当前密码不正确。', 400);
    if (await bcrypt.compare(parsed.data.newPassword, profile.passwordHash!)) return apiError('VALIDATION_ERROR', '新密码不能与当前密码相同。', 400);
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await getDb().$transaction([getDb().profile.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date() } }), getDb().session.deleteMany({ where: { profileId: user.id } })]);
    const { token, expiresAt } = await createSession(user.id);
    await setSessionCookie(token, expiresAt);
    return apiSuccess({ changed: true });
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401);
    if (error instanceof AccountPolicyError) return apiError('VALIDATION_ERROR', error.message, 400);
    return apiError('REQUEST_FAILED', '密码修改失败。', 500);
  }
}
