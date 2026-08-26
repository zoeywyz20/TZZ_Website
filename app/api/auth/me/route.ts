import { apiError, apiSuccess } from '@/lib/api/response';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  return user ? apiSuccess(user) : apiError('UNAUTHORIZED', '请先登录。', 401);
}
