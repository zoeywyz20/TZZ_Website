import { FileStatus, Visibility } from '@/generated/prisma/client';
import { apiError, apiSuccess } from '@/lib/api/response';
import { AuthenticationError, AuthorizationError, requirePermission, requireUser } from '@/lib/auth';
import { listFiles, uploadFile } from '@/lib/server/files';
import { StorageValidationError } from '@/lib/server/file-storage';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  departmentId: z.string().uuid().optional(),
  folderId: z.string().uuid().nullable().optional(),
  status: z.nativeEnum(FileStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

const uploadHeaderSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().trim().min(1).max(255).default('application/octet-stream'),
  taskId: z.string().uuid().optional(),
  deliverableId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  folderId: z.string().uuid().optional(),
  visibility: z.nativeEnum(Visibility).default(Visibility.DEPARTMENT),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    if (user.role === 'GUEST') return apiError('FORBIDDEN', '访客不能浏览材料中心。', 403);
    const url = new URL(request.url);
    const parsed = listSchema.safeParse({
      q: url.searchParams.get('q') ?? undefined,
      departmentId: url.searchParams.get('departmentId') ?? undefined,
      folderId: url.searchParams.get('folderId') === 'root' ? null : url.searchParams.get('folderId') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
    });
    if (!parsed.success) return apiError('VALIDATION_ERROR', '文件筛选参数不合法。', 400);
    return apiSuccess(await listFiles(user, parsed.data));
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401);
    return apiError('REQUEST_FAILED', '暂时无法读取材料列表。', 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission('file:upload');
    const parsed = uploadHeaderSchema.safeParse({
      filename: decodeFilename(request.headers.get('x-file-name')),
      mimeType: request.headers.get('x-file-type') ?? request.headers.get('content-type')?.split(';')[0] ?? undefined,
      taskId: request.headers.get('x-task-id') ?? undefined,
      deliverableId: request.headers.get('x-deliverable-id') ?? undefined,
      departmentId: request.headers.get('x-department-id') ?? undefined,
      folderId: request.headers.get('x-folder-id') ?? undefined,
      visibility: request.headers.get('x-file-visibility') ?? undefined,
    });
    if (!parsed.success) return apiError('VALIDATION_ERROR', '上传元数据不合法。', 400);
    const file = await uploadFile(user, request, { ...parsed.data, originalFilename: parsed.data.filename });
    return apiSuccess({ id: file.id }, 201);
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401);
    if (error instanceof AuthorizationError || error instanceof StorageValidationError || (error instanceof Error && error.message === 'FILE_FORBIDDEN')) {
      return apiError(error instanceof StorageValidationError ? 'UPLOAD_REJECTED' : 'FORBIDDEN', error.message, error instanceof StorageValidationError ? 400 : 403);
    }
    if (error instanceof Error && ['TASK_NOT_FOUND', 'FOLDER_NOT_FOUND', 'UPLOAD_TARGET_MISMATCH', 'DEPARTMENT_REQUIRED'].includes(error.message)) return apiError('VALIDATION_ERROR', error.message === 'DEPARTMENT_REQUIRED' ? '部门可见文件必须指定所属部门。' : '文件关联对象不合法。', 400);
    return apiError('UPLOAD_FAILED', '文件上传失败，未创建材料记录。', 500);
  }
}

function decodeFilename(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}
