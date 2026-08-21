import { apiClient } from '@/lib/apiClient';

const TIMEOUT_MS = 3000;

export async function revokeBffSession(
  refreshToken: string,
  userId: number
): Promise<void> {
  await apiClient.post(
    '/v1/auth/logout',
    { user_id: userId },
    {
      auth: false,
      headers: { Cookie: `refresh_token=${refreshToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }
  );
}
