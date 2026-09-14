import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { apiError } from '@/lib/api/response';
import { AuthenticationError, PasswordChangeRequiredError, requireReadyUser } from '@/lib/auth';
import { contentForFileVersion, fileContentDisposition } from '@/lib/server/files';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: { params: Promise<{ id: string; version: string }> }) {
  try { const p = await context.params; const result = await contentForFileVersion(await requireReadyUser(), p.id, Number(p.version)); return new Response(Readable.toWeb(createReadStream(result.stored.path)) as ReadableStream, { headers: { 'Content-Type': result.version.mimeType ?? result.file.mimeType, 'Content-Length': String(result.stored.size), 'Content-Disposition': fileContentDisposition(result.file.originalFilename, result.version.mimeType ?? result.file.mimeType), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } }); }
  catch (error) { if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401); if (error instanceof PasswordChangeRequiredError) return apiError('PASSWORD_CHANGE_REQUIRED', error.message, 403); return apiError('NOT_FOUND', '版本不存在或无权访问。', 404); }
}
