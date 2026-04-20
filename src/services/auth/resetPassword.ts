import { apiClient } from '@/lib/apiClient';
import type { components } from '@/types/api';

import { AuthResponse, createGeneralErrorResponse } from '../types';

type ResetPasswordApiResponse = components['schemas']['ApiResponse_NoneType_'];

export async function resetPassword(
  verifyToken: string,
  password: string,
  confirmPassword: string
): Promise<AuthResponse> {
  try {
    const result = await apiClient.put<ResetPasswordApiResponse>(
      '/v1/auth/password/reset',
      { password, confirm_password: confirmPassword },
      { auth: false, params: { verify_token: verifyToken } }
    );

    if (result.code === '0') return { status: 'success', code: 200 };
    throw createGeneralErrorResponse(200, result.msg || '密碼重設失敗');
  } catch (error) {
    if ((error as AuthResponse)?.status === 'error') throw error;
    throw createGeneralErrorResponse(
      500,
      error instanceof Error ? error.message : '密碼重設失敗'
    );
  }
}
