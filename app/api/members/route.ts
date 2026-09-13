import bcrypt from 'bcryptjs';
import { Role } from '@/generated/prisma/client';
import { apiError, apiSuccess } from '@/lib/api/response';
import { AccountPolicyError, getInitialAccountPassword, requireAllowedAccountEmail } from '@/lib/server/account-policy';
import { AuthenticationError, AuthorizationError, PasswordChangeRequiredError, requirePermission, requireReadyUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getDb } from '@/lib/db';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const openableRoles = [Role.DEPUTY_SECRETARY, Role.MINISTER, Role.VICE_MINISTER, Role.MEMBER, Role.GUEST] as const;
const createMemberSchema = z.object({ name: z.string().trim().min(1).max(100), email: z.string().trim().email().max(254), role: z.enum(openableRoles), departmentId: z.string().uuid().nullable() });

function failure(error: unknown) {
  if (error instanceof AuthenticationError) return apiError('UNAUTHORIZED', error.message, 401);
  if (error instanceof PasswordChangeRequiredError) return apiError('PASSWORD_CHANGE_REQUIRED', error.message, 403);
  if (error instanceof AuthorizationError) return apiError('FORBIDDEN', error.message, 403);
  if (error instanceof AccountPolicyError) return apiError('VALIDATION_ERROR', error.message, 400);
  if (error instanceof Error && error.message === 'DEPARTMENT_NOT_FOUND') return apiError('VALIDATION_ERROR', '所选部门不存在。', 400);
  if (error instanceof Error && error.message.includes('Unique constraint')) return apiError('EMAIL_EXISTS', '该邮箱已经开通账号。', 409);
  return apiError('REQUEST_FAILED', '成员操作失败。', 500);
}

export async function GET() {
  try {
    const user = await requireReadyUser();
    if (!can(user, 'member:view')) throw new AuthorizationError('你没有查看成员的权限。');
    const manage = can(user, 'member:manage');
    const members = await getDb().profile.findMany({ select: { id: true, name: true, email: true, avatar: true, role: true, departmentId: true, accountEnabled: true, mustChangePassword: true, department: { select: { id: true, name: true, shortName: true } } }, orderBy: { joinedAt: 'asc' } });
    return apiSuccess(members.map((item) => ({ id: item.id, name: item.name, avatar: item.avatar ?? undefined, role: item.role, departmentId: item.departmentId ?? undefined, department: item.department ?? undefined, ...(manage ? { email: item.email, accountEnabled: item.accountEnabled, mustChangePassword: item.mustChangePassword } : {}) })));
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    await requirePermission('member:manage');
    const parsed = createMemberSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError('VALIDATION_ERROR', '成员资料不合法。', 400);
    const email = requireAllowedAccountEmail(parsed.data.email);
    if (parsed.data.departmentId && !await getDb().department.findUnique({ where: { id: parsed.data.departmentId }, select: { id: true } })) throw new Error('DEPARTMENT_NOT_FOUND');
    const passwordHash = await bcrypt.hash(getInitialAccountPassword(), 12);
    const member = await getDb().profile.create({ data: { ...parsed.data, email, passwordHash, mustChangePassword: true, accountEnabled: true } });
    return apiSuccess({ id: member.id, name: member.name, email: member.email, role: member.role, departmentId: member.departmentId, mustChangePassword: member.mustChangePassword, accountEnabled: member.accountEnabled }, 201);
  } catch (error) { return failure(error); }
}
