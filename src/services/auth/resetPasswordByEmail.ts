import { apiClient } from '@/lib/apiClient';

export async function resetPassword(email: string): Promise<void> {
  await apiClient.getUnwrapped<null>('/v1/auth/password/reset/email', {
    params: { email },
    auth: false,
  });
}
