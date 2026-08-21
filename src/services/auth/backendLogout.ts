import { apiClient } from '@/lib/apiClient';

const TIMEOUT_MS = 3000;

export async function postBackendLogout(): Promise<void> {
  await apiClient.post('/api/auth/backend-logout', undefined, {
    auth: false,
    isLocal: true,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}
