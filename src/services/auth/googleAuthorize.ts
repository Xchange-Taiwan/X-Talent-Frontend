import { apiClient } from '@/lib/apiClient';
import type { components } from '@/types/api';

type ApiResponse = components['schemas']['ApiResponse_GoogleAuthorizeVO_'];
type GoogleAuthorizeVO = components['schemas']['GoogleAuthorizeVO'];

export async function getGoogleAuthorizeLoginUrl(): Promise<GoogleAuthorizeVO> {
  const res = await apiClient.post<ApiResponse>(
    '/v2/oauth/google/authorize/login',
    {},
    { auth: false }
  );
  if (!res.data?.authorization_url) {
    throw new Error('無法取得 Google 授權連結');
  }
  return res.data;
}

export async function getGoogleAuthorizeSignupUrl(): Promise<GoogleAuthorizeVO> {
  const res = await apiClient.post<ApiResponse>(
    '/v2/oauth/google/authorize/signup',
    {},
    { auth: false }
  );
  if (!res.data?.authorization_url) {
    throw new Error('無法取得 Google 授權連結');
  }
  return res.data;
}
