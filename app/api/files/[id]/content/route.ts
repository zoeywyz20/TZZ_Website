import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { apiError } from '@/lib/api/response';
import { AuthenticationError, PasswordChangeRequiredError, requireReadyUser } from '@/lib/auth';
import { contentForFile, fileContentDisposition, findFileForAccess } from '@/lib/server/files';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireReadyUser();
    const file = await findFileForAccess((await context.params).id);
    if (!file) return apiError('NOT_FOUND', '文件不存在或无权访问。', 404);
    const stored = await contentForFile(user, file);
    const range = parseRange(request.headers.get('range'), stored.size);
    if (range === 'invalid') return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${stored.size}`, 'Accept-Ranges': 'bytes' } });
    const start = range?.start ?? 0; const end = range?.end ?? stored.size - 1; const length = end - start + 1;
    return new Response(Readable.toWeb(createReadStream(stored.path, { start, end })) as ReadableStream, {
      status: range ? 206 : 200,
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Length': String(length),
        'Accept-Ranges': 'bytes',
        ...(range ? { 'Content-Range': `bytes ${start}-${end}/${stored.size}` } : {}),
        'Content-Disposition': fileContentDisposition(file.originalFilename, file.mimeType),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401);
    if (error instanceof PasswordChangeRequiredError) return apiError('PASSWORD_CHANGE_REQUIRED', error.message, 403);
    if (error instanceof Error && error.message === 'FILE_FORBIDDEN') return apiError('NOT_FOUND', '文件不存在或无权访问。', 404);
    return apiError('CONTENT_UNAVAILABLE', '文件内容暂时不可用。', 404);
  }
}

function parseRange(header: string | null, size: number): { start: number; end: number } | null | 'invalid' {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header); if (!match) return 'invalid';
  const [, rawStart, rawEnd] = match; if (!rawStart && !rawEnd) return 'invalid';
  if (!rawStart) { const length = Number(rawEnd); if (!Number.isSafeInteger(length) || length <= 0) return 'invalid'; return { start: Math.max(0, size - length), end: size - 1 }; }
  const start = Number(rawStart); const end = rawEnd ? Number(rawEnd) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return 'invalid';
  return { start, end: Math.min(end, size - 1) };
}
