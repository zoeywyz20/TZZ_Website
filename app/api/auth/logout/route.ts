import { apiSuccess } from '@/lib/api/response';
import { destroyCurrentSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  await destroyCurrentSession();
  return apiSuccess({ loggedOut: true });
}
