import { z } from 'zod';

import { apiClient, ApiError } from '@/lib/apiClient';
import { SignUpSchema } from '@/schemas/auth';
import type { components } from '@/types/api';

import { AuthResponse, createGeneralErrorResponse } from '../types';
import {
  createEmailAlreadyRegisteredResponse,
  createRateLimitResponse,
  createSignUpSuccessResponse,
  createValidationErrorResponse,
} from './signUpResponseHandlers';

type SignUpApiResponse = components['schemas']['ApiResponse_SignupResponseVO_'];

export async function signUp(
  values: z.infer<typeof SignUpSchema>
): Promise<AuthResponse> {
  try {
    const result = await apiClient.post<SignUpApiResponse>(
      '/v1/auth/signup',
      {
        email: values.email,
        password: values.password,
        confirm_password: values.confirm_password,
      },
      { auth: false }
    );

    if (result.code === '0') return createSignUpSuccessResponse();
    throw createGeneralErrorResponse(200, result.msg || '註冊失敗');
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 422) throw createValidationErrorResponse();
      if (error.status === 406) throw createEmailAlreadyRegisteredResponse();
      if (error.status === 429) throw createRateLimitResponse();
      throw createGeneralErrorResponse(error.status, error.message);
    }

    if (error instanceof Error || (error as AuthResponse)?.status === 'error') {
      throw error;
    }

    throw createGeneralErrorResponse(500, '系統錯誤，請稍後再試');
  }
}
