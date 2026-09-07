import 'server-only';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, { count: number; firstFailureAt: number }>();

function key(ip: string, email: string) { return `${ip}\u0000${email}`; }

export function loginAllowed(ip: string, email: string) {
  const entry = failures.get(key(ip, email));
  if (!entry) return true;
  if (Date.now() - entry.firstFailureAt >= WINDOW_MS) {
    failures.delete(key(ip, email));
    return true;
  }
  return entry.count < MAX_FAILURES;
}

export function recordLoginFailure(ip: string, email: string) {
  const id = key(ip, email);
  const current = failures.get(id);
  if (!current || Date.now() - current.firstFailureAt >= WINDOW_MS) failures.set(id, { count: 1, firstFailureAt: Date.now() });
  else current.count += 1;
}

export function clearLoginFailures(ip: string, email: string) { failures.delete(key(ip, email)); }

export function requestIp(request: Request) {
  // This app is normally behind a trusted same-host reverse proxy. Do not trust an arbitrary later value.
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim() || 'unknown';
}
