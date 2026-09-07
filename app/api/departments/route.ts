import { apiError, apiSuccess } from '@/lib/api/response';
import { AuthenticationError, AuthorizationError, PasswordChangeRequiredError, requirePermission } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requirePermission('department:view');
    const departments = await getDb().department.findMany({ include: { _count: { select: { members: true } } }, orderBy: { createdAt: 'asc' } });
    return apiSuccess(departments.map((item) => ({ id: item.id, name: item.name, shortName: item.shortName, description: item.description ?? undefined, leaderId: item.leaderId ?? undefined, memberCount: item._count.members, createdAt: item.createdAt.toISOString() })));
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401);
    if (error instanceof PasswordChangeRequiredError) return apiError('PASSWORD_CHANGE_REQUIRED', error.message, 403);
    if (error instanceof AuthorizationError) return apiError('FORBIDDEN', error.message, 403);
    throw error;
  }
}
