import 'server-only';
type Entry = { count: number; startedAt: number; lastAt: number };
const entries = new Map<string, Entry>();
export class RegistrationRateLimitError extends Error {}
function consume(scope: string, key: string, limit: number, windowMs: number, minIntervalMs = 0) {
  const now = Date.now(); const id = `${scope}\u0000${key}`; const old = entries.get(id);
  if (old && now - old.startedAt < windowMs) { if (minIntervalMs && now - old.lastAt < minIntervalMs) throw new RegistrationRateLimitError('操作过于频繁，请稍后再试。'); if (old.count >= limit) throw new RegistrationRateLimitError('操作过于频繁，请稍后再试。'); old.count++; old.lastAt = now; return; }
  entries.set(id, { count: 1, startedAt: now, lastAt: now });
}
export function limitRegistrationStart(ip: string, studentId: string) { consume('start-ip', ip, 12, 60 * 60_000); consume('start-account', studentId, 5, 60 * 60_000, 60_000); }
export function limitOtpSend(ip: string, email: string) { consume('otp-ip', ip, 20, 60 * 60_000); consume('otp-email', email, 5, 60 * 60_000, 60_000); }
export function limitOtpVerify(ip: string, applicationId: string) { consume('verify-ip', ip, 30, 60 * 60_000); consume('verify-app', applicationId, 8, 60 * 60_000); }
export function limitActivation(ip: string) { consume('activate-ip', ip, 20, 60 * 60_000); }
