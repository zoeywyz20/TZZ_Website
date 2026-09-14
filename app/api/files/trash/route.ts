import { apiError, apiSuccess } from '@/lib/api/response';
import { AuthenticationError, PasswordChangeRequiredError, requireReadyUser } from '@/lib/auth';
import { listTrash } from '@/lib/server/files';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function GET() { try { return apiSuccess(await listTrash(await requireReadyUser())); } catch (error) { if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401); if (error instanceof PasswordChangeRequiredError) return apiError('PASSWORD_CHANGE_REQUIRED', error.message, 403); return apiError('FORBIDDEN', '无权查看回收站。', 403); } }
