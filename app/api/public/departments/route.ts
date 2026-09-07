import { apiSuccess } from '@/lib/api/response';
import { publicDepartments } from '@/lib/server/registration';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function GET() { return apiSuccess(await publicDepartments()); }
