import { apiClient } from '@/lib/apiClient';
import type { components } from '@/types/api';

import { AuthResponse, createGeneralErrorResponse } from '../types';

type ResetPasswordByEmailApiResponse =
  components['schemas']['ApiResponse_EmailSentVO_'];

export async function resetPassword(email: string): Promise<AuthResponse> {
  try {
    const result = await apiClient.get<ResetPasswordByEmailApiResponse>(
      '/v1/auth/password/reset/email',
      {
        params: { email },
        auth: false,
      }
    );

    if (result.code === '0') return { status: 'success', code: 200 };
    throw createGeneralErrorResponse(200, result.msg || '信件寄送失敗');
  } catch (error) {
    if ((error as AuthResponse)?.status === 'error') throw error;
    throw createGeneralErrorResponse(
      500,
      error instanceof Error ? error.message : '信件寄送失敗'
    );
  }
}
