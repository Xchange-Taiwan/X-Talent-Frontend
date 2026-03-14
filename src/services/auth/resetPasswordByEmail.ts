import { apiClient } from '@/lib/apiClient';

import { AuthResponse, createGeneralErrorResponse } from '../types';

export async function resetPassword(email: string): Promise<AuthResponse> {
  try {
    await apiClient.get('/v1/auth/password/reset/email', {
      params: { email },
      auth: false,
    });

    return { status: 'success', code: 200 };
  } catch (error) {
    if ((error as AuthResponse)?.status === 'error') throw error;
    throw createGeneralErrorResponse(
      500,
      error instanceof Error ? error.message : '信件寄送失敗'
    );
  }
}
