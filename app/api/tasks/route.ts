import { apiError, apiSuccess } from '@/lib/api/response';
import { AuthenticationError, AuthorizationError, PasswordChangeRequiredError, requirePermission, requireReadyUser } from '@/lib/auth';
import { createTaskSchema } from '@/lib/validations/task';
import { createTask, listTasks } from '@/lib/services/tasks';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireReadyUser();
    const url = new URL(request.url);
    const filters = z.object({
      status: z.enum(['DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'ARCHIVED', 'CANCELLED']).optional(),
      q: z.string().trim().max(100).optional(),
    }).safeParse({ status: url.searchParams.get('status') ?? undefined, q: url.searchParams.get('q') ?? undefined });
    if (!filters.success) return apiError('VALIDATION_ERROR', '任务筛选参数不合法。', 400);
    return apiSuccess(await listTasks(user, filters.data));
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401);
    if (error instanceof PasswordChangeRequiredError) return apiError('PASSWORD_CHANGE_REQUIRED', error.message, 403);
    return apiError('REQUEST_FAILED', '暂时无法读取任务。', 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission('task:create');
    const parsed = createTaskSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '任务数据不合法。', 400);
    return apiSuccess(await createTask(user, parsed.data), 201);
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401);
    if (error instanceof PasswordChangeRequiredError) return apiError('PASSWORD_CHANGE_REQUIRED', error.message, 403);
    if (error instanceof AuthorizationError) return apiError('FORBIDDEN', error.message, 403);
    if (error instanceof Error && error.message === 'DEPARTMENT_NOT_FOUND') return apiError('DEPARTMENT_NOT_FOUND', '所选部门不存在。', 400);
    if (error instanceof Error && error.message === 'LEADER_NOT_FOUND') return apiError('LEADER_NOT_FOUND', '所选负责人不存在。', 400);
    if (error instanceof Error && ['DEPARTMENT_SCOPE_FORBIDDEN', 'TASK_MEMBER_SCOPE_FORBIDDEN'].includes(error.message)) return apiError('FORBIDDEN', '只能为本部门成员创建本部门范围内的任务。', 403);
    return apiError('REQUEST_FAILED', '暂时无法创建任务。', 500);
  }
}
