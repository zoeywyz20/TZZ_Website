import { apiError, apiSuccess } from '@/lib/api/response';
import { AuthenticationError, PasswordChangeRequiredError, requirePermission, requireReadyUser } from '@/lib/auth';
import { listFileVersions, uploadFileVersion } from '@/lib/server/files';
import { StorageValidationError } from '@/lib/server/file-storage';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { return apiSuccess(await listFileVersions(await requireReadyUser(), (await context.params).id)); }
  catch (error) { if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401); if (error instanceof PasswordChangeRequiredError) return apiError('PASSWORD_CHANGE_REQUIRED', error.message, 403); return apiError('NOT_FOUND', '文件不存在或无权访问。', 404); }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('file:upload');
    const meta = z.object({ filename: z.string().min(1).max(255), mimeType: z.string().min(1).max(255), changeNote: z.string().max(1000).optional() }).safeParse({ filename: decode(request.headers.get('x-file-name')), mimeType: request.headers.get('x-file-type') ?? request.headers.get('content-type')?.split(';')[0], changeNote: request.headers.get('x-change-note') ?? undefined });
    if (!meta.success) return apiError('VALIDATION_ERROR', '版本上传元数据不合法。', 400);
    return apiSuccess(await uploadFileVersion(user, (await context.params).id, request, { originalFilename: meta.data.filename, mimeType: meta.data.mimeType, changeNote: meta.data.changeNote }));
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401);
    if (error instanceof PasswordChangeRequiredError) return apiError('PASSWORD_CHANGE_REQUIRED', error.message, 403);
    if (error instanceof StorageValidationError) return apiError('UPLOAD_REJECTED', error.message, 400);
    if (error instanceof Error && error.message === 'FILE_FORBIDDEN') return apiError('FORBIDDEN', '无权上传该文件的新版本。', 403);
    return apiError('UPLOAD_FAILED', '新版本上传失败，原版本未变更。', 500);
  }
}
function decode(value: string | null) { if (!value) return undefined; try { return decodeURIComponent(value); } catch { return undefined; } }
