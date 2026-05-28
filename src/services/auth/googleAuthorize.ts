import { apiClient } from '@/lib/apiClient';
import type { components } from '@/types/api';

type ApiResponse = components['schemas']['ApiResponse_GoogleAuthorizeVO_'];
type GoogleAuthorizeVO = components['schemas']['GoogleAuthorizeVO'];

export async function getGoogleAuthorizeLoginUrl(): Promise<GoogleAuthorizeVO> {
  console.log('[GoogleAuth] POST /v2/oauth/google/authorize/login');
  const res = await apiClient.post<ApiResponse>(
    '/v2/oauth/google/authorize/login',
    {},
    { auth: false }
  );
  console.log(
    '[GoogleAuth] authorize/login response (full):',
    JSON.stringify(res, null, 2)
  );
  if (!res.data?.authorization_url) {
    throw new Error('無法取得 Google 授權連結');
  }
  return res.data;
}

export async function getGoogleAuthorizeSignupUrl(): Promise<GoogleAuthorizeVO> {
  console.log('[GoogleAuth] POST /v2/oauth/google/authorize/signup');
  const res = await apiClient.post<ApiResponse>(
    '/v2/oauth/google/authorize/signup',
    {},
    { auth: false }
  );
  console.log(
    '[GoogleAuth] authorize/signup response (full):',
    JSON.stringify(res, null, 2)
  );
  if (!res.data?.authorization_url) {
    throw new Error('無法取得 Google 授權連結');
  }
  return res.data;
}
