import { apiClient } from '@/lib/apiClient';

export async function resetPassword(
  verifyToken: string,
  password: string,
  confirmPassword: string
): Promise<void> {
  await apiClient.putUnwrapped<null>(
    '/v1/auth/password/reset',
    { password, confirm_password: confirmPassword },
    { auth: false, params: { verify_token: verifyToken } }
  );
}
