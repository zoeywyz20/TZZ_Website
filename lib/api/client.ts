import type { ApiEnvelope } from './contracts';

export class ApiClientError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
  }
}

export async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  const body = await response.json().catch(() => null) as ApiEnvelope<T> & { error?: { code?: string; message?: string } } | null;
  if (!response.ok || !body?.success) {
    throw new ApiClientError(body?.error?.code ?? 'REQUEST_FAILED', body?.error?.message ?? '请求失败，请稍后重试。', response.status);
  }
  return body.data;
}
