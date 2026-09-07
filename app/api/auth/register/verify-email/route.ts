import { apiError, apiSuccess } from '@/lib/api/response';
import { RegistrationError, verifyRegistrationEmail } from '@/lib/server/registration';
import { RegistrationRateLimitError, limitOtpVerify } from '@/lib/server/registration-rate-limit';
import { requestIp } from '@/lib/server/login-rate-limit';
import { assertSameOrigin, SameOriginError } from '@/lib/server/same-origin';
import { z } from 'zod';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
const schema = z.object({ applicationId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) }).strict();
export async function POST(request: Request) { try { assertSameOrigin(request); const data = schema.safeParse(await request.json().catch(() => null)); if (!data.success) return apiError('VALIDATION_ERROR', '验证码错误或已失效。', 400); limitOtpVerify(requestIp(request), data.data.applicationId); return apiSuccess(await verifyRegistrationEmail(data.data)); } catch (error) { if (error instanceof SameOriginError) return apiError('FORBIDDEN', error.message, 403); if (error instanceof RegistrationRateLimitError) return apiError('RATE_LIMITED', error.message, 429); if (error instanceof RegistrationError) return apiError('OTP_INVALID', error.message, 400); return apiError('REQUEST_FAILED', '验证码错误或已失效。', 400); } }
