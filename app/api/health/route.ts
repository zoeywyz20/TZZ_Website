import { apiError } from '@/lib/api/response';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    await getDb().$queryRaw`SELECT 1`;

    return Response.json(
      {
        success: true,
        database: 'connected',
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    const details = {
      name: error instanceof Error ? error.name : 'UnknownError',
      code:
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : undefined,
    };

    console.error('[health] PostgreSQL connectivity check failed', details);

    if (!process.env.DATABASE_URL?.trim()) {
      return apiError(
        'DATABASE_NOT_CONFIGURED',
        '数据库尚未配置。',
        503,
      );
    }

    return apiError(
      'DATABASE_UNAVAILABLE',
      '数据库暂时不可用，请稍后重试。',
      503,
    );
  }
}
