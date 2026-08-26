import { apiError, apiSuccess } from '@/lib/api/response';
import { AuthenticationError, AuthorizationError, requirePermission, toAuthUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requirePermission('member:view');
    const members = await getDb().profile.findMany({ include: { department: true }, orderBy: { joinedAt: 'asc' } });
    return apiSuccess(members.map((item) => ({ ...toAuthUser(item), department: item.department ? { id: item.department.id, name: item.department.name, shortName: item.department.shortName } : undefined })));
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401);
    if (error instanceof AuthorizationError) return apiError('FORBIDDEN', error.message, 403);
    throw error;
  }
}
