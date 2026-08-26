import { apiError, apiSuccess } from '@/lib/api/response';
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requirePermission('member:view');
    const members = await getDb().profile.findMany({
      select: {
        id: true, name: true, avatar: true, role: true, departmentId: true,
        department: { select: { id: true, name: true, shortName: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
    return apiSuccess(members.map((item) => ({
      id: item.id, name: item.name, avatar: item.avatar ?? undefined, role: item.role,
      departmentId: item.departmentId ?? undefined,
      department: item.department ?? undefined,
    })));
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401);
    if (error instanceof AuthorizationError) return apiError('FORBIDDEN', error.message, 403);
    throw error;
  }
}
