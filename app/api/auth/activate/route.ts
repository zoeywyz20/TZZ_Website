import { apiError } from '@/lib/api/response';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function POST() { return apiError('REGISTRATION_FLOW_CHANGED', '邮件激活已停用；请使用管理员开通的账号直接登录。', 410); }
