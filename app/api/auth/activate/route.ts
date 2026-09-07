import { apiError, apiSuccess } from '@/lib/api/response';
import { createSession, setSessionCookie, toAuthUser } from '@/lib/auth';
import { RegistrationError, activateRegistration } from '@/lib/server/registration';
import { RegistrationRateLimitError, limitActivation } from '@/lib/server/registration-rate-limit';
import { requestIp } from '@/lib/server/login-rate-limit';
import { assertSameOrigin, SameOriginError } from '@/lib/server/same-origin';
import { z } from 'zod';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
const schema = z.object({ token: z.string().min(32).max(256), newPassword: z.string().min(8).max(128), confirmPassword: z.string().min(8).max(128) }).strict();
export async function POST(request: Request) { try { assertSameOrigin(request); const data = schema.safeParse(await request.json().catch(() => null)); if (!data.success) return apiError('VALIDATION_ERROR', '激活信息不合法。', 400); limitActivation(requestIp(request)); const profile = await activateRegistration(data.data); const { token, expiresAt } = await createSession(profile.id); await setSessionCookie(token, expiresAt); return apiSuccess({ user: toAuthUser(profile) }); } catch (error) { if (error instanceof SameOriginError) return apiError('FORBIDDEN', error.message, 403); if (error instanceof RegistrationRateLimitError) return apiError('RATE_LIMITED', error.message, 429); if (error instanceof RegistrationError) return apiError('ACTIVATION_FAILED', error.message, 400); return apiError('ACTIVATION_FAILED', '激活链接无效或已过期。', 400); } }
