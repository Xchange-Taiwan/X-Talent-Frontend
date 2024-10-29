import { z } from 'zod';

import { SignUpSchema } from '@/schemas/auth';

import {
  createEmailAlreadyRegisteredResponse,
  createGeneralErrorResponse,
  createRateLimitResponse,
  createSignUpSuccessResponse,
  createValidationErrorResponse,
} from './signupResponseHandlers';
import { AuthResponse } from './types';

export async function signUp(
  values: z.infer<typeof SignUpSchema>,
): Promise<AuthResponse> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/signup`,
      {
        method: 'POST',
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          confirm_password: values.confirm_password,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const result = await response.json();
    if (response.status === 201 && result.code === '0') {
      return createSignUpSuccessResponse();
    }

    if (response.status === 422) {
      throw createValidationErrorResponse();
    }

    if (response.status === 406) {
      throw createEmailAlreadyRegisteredResponse();
    }

    if (response.status === 429 && result.code === '42900') {
      throw createRateLimitResponse();
    }

    throw createGeneralErrorResponse(
      response.status,
      result.message || '註冊失敗',
    );
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw createGeneralErrorResponse(
        0,
        '無法連接到伺服器。請檢查您的網絡連接。',
      );
    }

    if (error instanceof Error || (error as AuthResponse)?.status === 'error') {
      throw error;
    }

    throw createGeneralErrorResponse(500, '系統錯誤，請稍後再試');
  }
}
