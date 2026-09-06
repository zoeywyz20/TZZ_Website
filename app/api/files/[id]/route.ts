import { apiError, apiSuccess } from '@/lib/api/response';
import { AuthenticationError, requireUser } from '@/lib/auth';
import { canAccessFile, canDeleteFile, deleteFile, findFileForAccess, serializeFile } from '@/lib/server/files';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const file = await findFileForAccess((await context.params).id);
    if (!file || !canAccessFile(user, file)) return apiError('NOT_FOUND', '文件不存在或无权访问。', 404);
    return apiSuccess(serializeFile(file, user));
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401);
    return apiError('REQUEST_FAILED', '暂时无法读取文件信息。', 500);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const file = await findFileForAccess((await context.params).id);
    if (!file || !canDeleteFile(user, file)) return apiError('NOT_FOUND', '文件不存在或无权删除。', 404);
    await deleteFile(user, file);
    return apiSuccess({ id: file.id, deleted: true });
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401);
    return apiError('DELETE_FAILED', '删除文件失败。', 500);
  }
}
