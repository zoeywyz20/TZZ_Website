import { apiError, apiSuccess } from '@/lib/api/response';
import { AuthenticationError, AuthorizationError, PasswordChangeRequiredError, requirePermission } from '@/lib/auth';
import { RegistrationError, rejectRegistration } from '@/lib/server/registration';
import { assertSameOrigin, SameOriginError } from '@/lib/server/same-origin';
import { z } from 'zod';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
const schema = z.object({ reviewNote: z.string().max(1000).nullable().optional() }).strict();
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { try { assertSameOrigin(request); const user = await requirePermission('member:manage'); const data = schema.safeParse(await request.json().catch(() => null)); if (!data.success) return apiError('VALIDATION_ERROR', '审核信息不合法。', 400); return apiSuccess(await rejectRegistration({ ...data.data, id: (await context.params).id, actorId: user.id })); } catch (error) { if (error instanceof SameOriginError) return apiError('FORBIDDEN', error.message, 403); if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401); if (error instanceof PasswordChangeRequiredError || error instanceof AuthorizationError) return apiError('FORBIDDEN', error.message, 403); if (error instanceof RegistrationError) return apiError('REGISTRATION_INVALID', error.message, 400); return apiError('REQUEST_FAILED', '审核失败。', 500); } }
