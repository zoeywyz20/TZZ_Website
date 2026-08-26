import { apiError, apiSuccess } from '@/lib/api/response';
import { AuthenticationError, requireUser } from '@/lib/auth';
import { findTask } from '@/lib/services/tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const task = await findTask(user, (await context.params).id);
    return task ? apiSuccess(task) : apiError('NOT_FOUND', '任务不存在或无权访问。', 404);
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401);
    return apiError('REQUEST_FAILED', '暂时无法读取任务。', 500);
  }
}
