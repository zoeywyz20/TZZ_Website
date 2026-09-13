import { apiError } from '@/lib/api/response';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function POST() { return apiError('REGISTRATION_FLOW_CHANGED', '邮箱验证码已停用，请重新提交申请。', 410); }
