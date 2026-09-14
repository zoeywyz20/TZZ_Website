import { apiError, apiSuccess } from '@/lib/api/response';
import { AuthenticationError, PasswordChangeRequiredError, requireReadyUser } from '@/lib/auth';
import { canAccessFile, canDeleteFile, deleteFile, findFileForAccess, purgeFile, restoreFile, serializeFile } from '@/lib/server/files';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireReadyUser();
    const file = await findFileForAccess((await context.params).id);
    if (!file || !canAccessFile(user, file)) return apiError('NOT_FOUND', '文件不存在或无权访问。', 404);
    return apiSuccess(serializeFile(file, user));
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401);
    if (error instanceof PasswordChangeRequiredError) return apiError('PASSWORD_CHANGE_REQUIRED', error.message, 403);
    return apiError('REQUEST_FAILED', '暂时无法读取文件信息。', 500);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireReadyUser();
    const file = await findFileForAccess((await context.params).id);
    if (!file || !canDeleteFile(user, file)) return apiError('NOT_FOUND', '文件不存在或无权删除。', 404);
    await deleteFile(user, file);
    return apiSuccess({ id: file.id, deleted: true });
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401);
    if (error instanceof PasswordChangeRequiredError) return apiError('PASSWORD_CHANGE_REQUIRED', error.message, 403);
    return apiError('DELETE_FAILED', '删除文件失败。', 500);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireReadyUser();
    const body = await request.json().catch(() => null);
    const id = (await context.params).id;
    if (body?.action === 'restore') { await restoreFile(user, id); return apiSuccess({ restored: true }); }
    if (body?.action === 'purge') return apiSuccess(await purgeFile(user, id));
    return apiError('VALIDATION_ERROR', '不支持的文件操作。', 400);
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401);
    if (error instanceof PasswordChangeRequiredError) return apiError('PASSWORD_CHANGE_REQUIRED', error.message, 403);
    if (error instanceof Error && error.message === 'FILE_FORBIDDEN') return apiError('FORBIDDEN', '无权恢复文件。', 403);
    if (error instanceof Error && error.message === 'FILE_HAS_REFERENCES') return apiError('CONFLICT', '文件仍被提交或审核记录引用，不能彻底删除。', 409);
    return apiError('REQUEST_FAILED', '恢复文件失败。', 500);
  }
}
