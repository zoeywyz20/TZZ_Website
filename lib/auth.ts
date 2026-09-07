import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';
import { can, type Action } from '@/lib/permissions';
import { Role, type Profile } from '@/types';
import type { AuthUser } from '@/lib/api/contracts';

export const SESSION_COOKIE_NAME = 'tzz_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export class AuthenticationError extends Error {}
export class AuthorizationError extends Error {}
export class PasswordChangeRequiredError extends Error {}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function toAuthUser(profile: {
  id: string; name: string; email: string; avatar: string | null; role: string; phone: string | null;
  studentId: string | null; departmentId: string | null; joinedAt: Date; createdAt: Date; updatedAt: Date;
  mustChangePassword: boolean;
}): AuthUser {
  return {
    id: profile.id, name: profile.name, email: profile.email, avatar: profile.avatar ?? undefined,
    role: profile.role as Role, phone: profile.phone ?? undefined, studentId: profile.studentId ?? undefined,
    departmentId: profile.departmentId ?? undefined, joinedAt: profile.joinedAt.toISOString(),
    createdAt: profile.createdAt.toISOString(), updatedAt: profile.updatedAt.toISOString(),
    mustChangePassword: profile.mustChangePassword,
  };
}

export async function createSession(profileId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await getDb().session.create({ data: { profileId, tokenHash: hashToken(token), expiresAt } });
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
}

export async function destroyCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (token) await getDb().session.deleteMany({ where: { tokenHash: hashToken(token) } });
  await clearSessionCookie();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await getDb().session.findUnique({ where: { tokenHash: hashToken(token) }, include: { profile: true } });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await getDb().session.delete({ where: { id: session.id } });
    await clearSessionCookie();
    return null;
  }
  if (!session.profile.accountEnabled) {
    await getDb().session.deleteMany({ where: { profileId: session.profileId } });
    await clearSessionCookie();
    return null;
  }
  return toAuthUser(session.profile);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthenticationError('请先登录。');
  return user;
}

export async function requirePermission(action: Action) {
  const user = await requireReadyUser();
  if (!can(user as Profile, action)) throw new AuthorizationError('你没有执行此操作的权限。');
  return user;
}

export async function requireReadyUser() {
  const user = await requireUser();
  if (user.mustChangePassword) throw new PasswordChangeRequiredError('请先修改初始密码。');
  return user;
}
