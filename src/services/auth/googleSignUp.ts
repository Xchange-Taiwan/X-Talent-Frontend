import { apiClient, ApiError } from '@/lib/apiClient';

import { AuthResponse, createGeneralErrorResponse } from '../types';
import {
  createEmailAlreadyRegisteredResponse,
  createRateLimitResponse,
  createSignUpSuccessResponse,
  createValidationErrorResponse,
} from './signUpResponseHandlers';

export interface GoogleSignUpType {
  email: string;
  access_token: string;
  oauth_id: string;
}

interface GoogleSignUpApiResponse {
  code: string;
  message?: string;
}

export async function googleSignUp(
  values: GoogleSignUpType
): Promise<AuthResponse> {
  try {
    const result = await apiClient.post<GoogleSignUpApiResponse>(
      '/oauth/signup/GOOGLE',
      values,
      { auth: false }
    );

    if (result.code === '0') return createSignUpSuccessResponse();
    throw createGeneralErrorResponse(200, result.message || '註冊失敗');
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
