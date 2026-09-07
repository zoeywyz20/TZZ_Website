import 'server-only';
export class SameOriginError extends Error {}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.replace(':', '');
  if (!host || origin !== `${proto}://${host}`) throw new SameOriginError('请求来源不合法。');
}
