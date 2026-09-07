import { apiError, apiSuccess } from '@/lib/api/response';
import { AuthenticationError, AuthorizationError, PasswordChangeRequiredError, requirePermission } from '@/lib/auth';
import { RegistrationError, resendActivation } from '@/lib/server/registration';
import { MailDeliveryError } from '@/lib/server/mail';
import { assertSameOrigin, SameOriginError } from '@/lib/server/same-origin';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { try { assertSameOrigin(request); const user = await requirePermission('member:manage'); return apiSuccess(await resendActivation((await context.params).id, user.id)); } catch (error) { if (error instanceof SameOriginError) return apiError('FORBIDDEN', error.message, 403); if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401); if (error instanceof PasswordChangeRequiredError || error instanceof AuthorizationError) return apiError('FORBIDDEN', error.message, 403); if (error instanceof MailDeliveryError) return apiError('MAIL_UNAVAILABLE', error.message, 503); if (error instanceof RegistrationError) return apiError('REGISTRATION_INVALID', error.message, 400); return apiError('REQUEST_FAILED', '无法发送激活邮件。', 500); } }
