import { apiError, apiSuccess } from '@/lib/api/response';
import { AuthenticationError, PasswordChangeRequiredError, requireReadyUser } from '@/lib/auth';
import { createFolder, listFolders } from '@/lib/server/folders';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const schema = z.object({ name: z.string(), parentId: z.string().uuid().nullable().optional(), departmentId: z.string().uuid().nullable().optional() });

export async function GET(request: Request) {
  try {
    const user = await requireReadyUser(); const url = new URL(request.url);
    const parent = url.searchParams.get('parentId'); const departmentId = url.searchParams.get('departmentId') ?? undefined;
    if (parent !== null && parent !== 'root' && !z.string().uuid().safeParse(parent).success) return apiError('VALIDATION_ERROR', 'parentId 不合法。', 400);
    if (departmentId && !z.string().uuid().safeParse(departmentId).success) return apiError('VALIDATION_ERROR', 'departmentId 不合法。', 400);
    return apiSuccess(await listFolders(user, { parentId: parent === 'root' ? null : parent ?? undefined, departmentId }));
  } catch (error) { if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401); if (error instanceof PasswordChangeRequiredError) return apiError('PASSWORD_CHANGE_REQUIRED', error.message, 403); if (error instanceof Error && error.message === 'FOLDER_FORBIDDEN') return apiError('FORBIDDEN', '无权浏览目录。', 403); return apiError('REQUEST_FAILED', '目录读取失败。', 500); }
}

export async function POST(request: Request) {
  try { const user = await requireReadyUser(); const data = schema.safeParse(await request.json().catch(() => null)); if (!data.success) return apiError('VALIDATION_ERROR', '目录数据不合法。', 400); return apiSuccess(await createFolder(user, data.data), 201); }
  catch (error) { if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401); if (error instanceof PasswordChangeRequiredError) return apiError('PASSWORD_CHANGE_REQUIRED', error.message, 403); return folderError(error); }
}

function folderError(error: unknown) { const code = error instanceof Error ? error.message : ''; if (['FOLDER_FORBIDDEN', 'FOLDER_SCOPE_MISMATCH'].includes(code)) return apiError('FORBIDDEN', '无权管理该目录。', 403); if (['FOLDER_NAME_INVALID', 'FOLDER_NOT_FOUND'].includes(code)) return apiError('VALIDATION_ERROR', '目录参数不合法。', 400); if (code.includes('Unique constraint')) return apiError('FOLDER_EXISTS', '同一目录下已存在同名文件夹。', 409); return apiError('REQUEST_FAILED', '目录操作失败。', 500); }
