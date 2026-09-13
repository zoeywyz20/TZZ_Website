import { apiError } from '@/lib/api/response';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function POST() { return apiError('REGISTRATION_FLOW_CHANGED', '邮件激活已停用；审核通过时账号已直接开通。', 410); }
