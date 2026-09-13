import { apiError, apiSuccess } from '@/lib/api/response';
import { RegistrationError, startRegistration } from '@/lib/server/registration';
import { RegistrationRateLimitError, limitRegistrationStart } from '@/lib/server/registration-rate-limit';
import { requestIp } from '@/lib/server/login-rate-limit';
import { assertSameOrigin, SameOriginError } from '@/lib/server/same-origin';
import { AccountPolicyError, normalizeStudentId } from '@/lib/account-policy-core';
import { z } from 'zod';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
const schema = z.object({ name: z.string().max(100), studentId: z.string().max(100), requestedDepartmentId: z.string().uuid().nullable().optional() }).strict();
export async function POST(request: Request) { try { assertSameOrigin(request); const data = schema.safeParse(await request.json().catch(() => null)); if (!data.success) return apiError('VALIDATION_ERROR', '申请信息不合法。', 400); limitRegistrationStart(requestIp(request), normalizeStudentId(data.data.studentId)); return apiSuccess(await startRegistration(data.data), 201); } catch (error) { if (error instanceof SameOriginError) return apiError('FORBIDDEN', error.message, 403); if (error instanceof RegistrationRateLimitError) return apiError('RATE_LIMITED', error.message, 429); if (error instanceof AccountPolicyError || error instanceof RegistrationError) return apiError('REGISTRATION_REJECTED', error.message, 400); return apiError('REQUEST_FAILED', '暂时无法提交申请。', 500); } }
