import { apiClient } from '@/lib/apiClient';

import { AuthResponse, createGeneralErrorResponse } from '../types';

export async function resetPassword(
  verifyToken: string,
  password: string,
  confirmPassword: string
): Promise<AuthResponse> {
  try {
    await apiClient.put(
      '/v1/auth/password/reset',
      { password, confirm_password: confirmPassword },
      { auth: false, params: { verify_token: verifyToken } }
    );

    return { status: 'success', code: 200 };
  } catch (error) {
    if ((error as AuthResponse)?.status === 'error') throw error;
    throw createGeneralErrorResponse(
      500,
      error instanceof Error ? error.message : '密碼重設失敗'
    );
  }
}
