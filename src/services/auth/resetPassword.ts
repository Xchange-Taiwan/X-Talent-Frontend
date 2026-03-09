import { AuthResponse, createGeneralErrorResponse } from '../types';

export async function resetPassword(
  verifyToken: string,
  password: string,
  confirmPassword: string
): Promise<AuthResponse> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/auth/password/reset?verify_token=${encodeURIComponent(verifyToken)}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          password,
          confirm_password: confirmPassword,
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const result = await response.json();

    if (response.ok) {
      return { status: 'success', code: response.status };
    }

    throw createGeneralErrorResponse(
      response.status,
      result.message || '密碼重設失敗'
    );
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw createGeneralErrorResponse(
        0,
        '無法連接到伺服器。請檢查您的網絡連接。'
      );
    }

    if ((error as AuthResponse)?.status === 'error') {
      throw error;
    }

    throw createGeneralErrorResponse(500, '系統錯誤，請稍後再試');
  }
}
