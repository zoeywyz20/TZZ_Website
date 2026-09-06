import { open } from 'node:fs/promises';
import { apiError } from '@/lib/api/response';
import { AuthenticationError, requireUser } from '@/lib/auth';
import { contentForFile, fileContentDisposition, findFileForAccess } from '@/lib/server/files';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const file = await findFileForAccess((await context.params).id);
    if (!file) return apiError('NOT_FOUND', '文件不存在或无权访问。', 404);
    const stored = await contentForFile(user, file);
    const handle = await open(stored.path, 'r');
    return new Response(handle.readableWebStream() as ReadableStream, {
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Length': String(stored.size),
        'Content-Disposition': fileContentDisposition(file.originalFilename, file.mimeType),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401);
    if (error instanceof Error && error.message === 'FILE_FORBIDDEN') return apiError('NOT_FOUND', '文件不存在或无权访问。', 404);
    return apiError('CONTENT_UNAVAILABLE', '文件内容暂时不可用。', 404);
  }
}
