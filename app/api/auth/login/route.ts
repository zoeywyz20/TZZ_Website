import bcrypt from 'bcryptjs';
import { apiError, apiSuccess } from '@/lib/api/response';
import { createSession, setSessionCookie, toAuthUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { loginSchema } from '@/lib/validations/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('VALIDATION_ERROR', '请输入有效的账号和密码。', 400);

  const profile = await getDb().profile.findUnique({ where: { email: parsed.data.email } });
  const matched = profile?.passwordHash ? await bcrypt.compare(parsed.data.password, profile.passwordHash) : false;
  if (!profile || !matched) return apiError('INVALID_CREDENTIALS', '账号或密码错误。', 401);

  const { token, expiresAt } = await createSession(profile.id);
  await setSessionCookie(token, expiresAt);
  return apiSuccess(toAuthUser(profile));
}
