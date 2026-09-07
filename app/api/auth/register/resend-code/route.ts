import { apiError, apiSuccess } from '@/lib/api/response';
import { RegistrationError, resendVerificationCode } from '@/lib/server/registration';
import { MailDeliveryError } from '@/lib/server/mail';
import { RegistrationRateLimitError, limitOtpSend } from '@/lib/server/registration-rate-limit';
import { requestIp } from '@/lib/server/login-rate-limit';
import { assertSameOrigin, SameOriginError } from '@/lib/server/same-origin';
import { getDb } from '@/lib/db'; import { z } from 'zod';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
const schema = z.object({ applicationId: z.string().uuid() }).strict();
export async function POST(request: Request) { try { assertSameOrigin(request); const data = schema.safeParse(await request.json().catch(() => null)); if (!data.success) return apiError('VALIDATION_ERROR', '验证码错误或已失效。', 400); const application = await getDb().registrationApplication.findUnique({ where: { id: data.data.applicationId }, select: { email: true } }); if (!application) return apiError('OTP_INVALID', '验证码错误或已失效。', 400); limitOtpSend(requestIp(request), application.email); return apiSuccess(await resendVerificationCode(data.data.applicationId)); } catch (error) { if (error instanceof SameOriginError) return apiError('FORBIDDEN', error.message, 403); if (error instanceof RegistrationRateLimitError) return apiError('RATE_LIMITED', error.message, 429); if (error instanceof MailDeliveryError) return apiError('MAIL_UNAVAILABLE', error.message, 503); if (error instanceof RegistrationError) return apiError('OTP_INVALID', error.message, 400); return apiError('REQUEST_FAILED', '暂时无法重发验证码。', 500); } }
