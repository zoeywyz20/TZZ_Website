import { apiError, apiSuccess } from '@/lib/api/response';
import { AuthenticationError, AuthorizationError, PasswordChangeRequiredError, requirePermission, requireReadyUser } from '@/lib/auth';
import { deleteOrCancelTask, findTask, updateTask } from '@/lib/services/tasks';
import { updateTaskSchema } from '@/lib/validations/task';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireReadyUser();
    const task = await findTask(user, (await context.params).id);
    return task ? apiSuccess(task) : apiError('NOT_FOUND', '任务不存在或无权访问。', 404);
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401);
    if (error instanceof PasswordChangeRequiredError) return apiError('PASSWORD_CHANGE_REQUIRED', error.message, 403);
    return apiError('REQUEST_FAILED', '暂时无法读取任务。', 500);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('task:edit');
    const parsed = updateTaskSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '任务数据不合法。', 400);
    const task = await updateTask(user, (await context.params).id, parsed.data);
    return apiSuccess(task);
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401);
    if (error instanceof PasswordChangeRequiredError) return apiError('PASSWORD_CHANGE_REQUIRED', error.message, 403);
    if (error instanceof AuthorizationError || (error instanceof Error && ['TASK_SCOPE_FORBIDDEN', 'DEPARTMENT_SCOPE_FORBIDDEN', 'TASK_MEMBER_SCOPE_FORBIDDEN'].includes(error.message))) return apiError('FORBIDDEN', '你不能修改这个任务。', 403);
    if (error instanceof Error && error.message === 'TASK_NOT_FOUND') return apiError('NOT_FOUND', '任务不存在或已移入回收站。', 404);
    if (error instanceof Error && error.message === 'TASK_READ_ONLY') return apiError('CONFLICT', '已归档或已取消的任务不能再编辑。', 409);
    if (error instanceof Error && error.message === 'DELIVERABLE_HAS_HISTORY') return apiError('CONFLICT', '已有提交、文件或审核记录的交付项不能删除。', 409);
    if (error instanceof Error && ['DELIVERABLE_NOT_FOUND', 'TASK_MEMBER_NOT_FOUND', 'INVALID_DEADLINE'].includes(error.message)) return apiError('VALIDATION_ERROR', '任务关联成员、交付项或截止日期不合法。', 400);
    return apiError('REQUEST_FAILED', '暂时无法更新任务。', 500);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('task:delete');
    const result = await deleteOrCancelTask(user, (await context.params).id);
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401);
    if (error instanceof PasswordChangeRequiredError) return apiError('PASSWORD_CHANGE_REQUIRED', error.message, 403);
    if (error instanceof AuthorizationError || (error instanceof Error && error.message === 'TASK_SCOPE_FORBIDDEN')) return apiError('FORBIDDEN', '你不能删除或取消这个任务。', 403);
    if (error instanceof Error && error.message === 'TASK_NOT_FOUND') return apiError('NOT_FOUND', '任务不存在或已移入回收站。', 404);
    if (error instanceof Error && error.message === 'TASK_READ_ONLY') return apiError('CONFLICT', '已归档任务不能删除或取消。', 409);
    return apiError('REQUEST_FAILED', '暂时无法删除或取消任务。', 500);
  }
}
