import bcrypt from 'bcryptjs';
import { apiError, apiSuccess } from '@/lib/api/response';
import { AccountPolicyError, getInitialAccountPassword } from '@/lib/server/account-policy';
import { AuthenticationError, AuthorizationError, PasswordChangeRequiredError, requirePermission } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { z } from 'zod';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
const actionSchema = z.object({ action: z.enum(['enable', 'disable', 'reset-password']) });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('member:manage');
    const parsed = actionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError('VALIDATION_ERROR', '成员操作不合法。', 400);
    const id = (await context.params).id;
    if (!await getDb().profile.findUnique({ where: { id }, select: { id: true } })) return apiError('NOT_FOUND', '成员不存在。', 404);
    if (parsed.data.action === 'reset-password') {
      const passwordHash = await bcrypt.hash(getInitialAccountPassword(), 12);
      await getDb().$transaction([getDb().profile.update({ where: { id }, data: { passwordHash, mustChangePassword: true, passwordChangedAt: null } }), getDb().session.deleteMany({ where: { profileId: id } })]);
    } else {
      const accountEnabled = parsed.data.action === 'enable';
      await getDb().$transaction([getDb().profile.update({ where: { id }, data: { accountEnabled } }), ...(accountEnabled ? [] : [getDb().session.deleteMany({ where: { profileId: id } })])]);
    }
    return apiSuccess({ id, action: parsed.data.action });
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401);
    if (error instanceof PasswordChangeRequiredError) return apiError('PASSWORD_CHANGE_REQUIRED', error.message, 403);
    if (error instanceof AuthorizationError) return apiError('FORBIDDEN', error.message, 403);
    if (error instanceof AccountPolicyError) return apiError('CONFIGURATION_ERROR', '账户重置暂不可用。', 500);
    return apiError('REQUEST_FAILED', '成员操作失败。', 500);
  }
}
