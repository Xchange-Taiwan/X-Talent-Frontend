'use server';

import { cookies } from 'next/headers';

import {
  OAUTH_REFRESH_BRIDGE_COOKIE,
  OAUTH_REFRESH_BRIDGE_TTL_SECONDS,
} from '@/lib/auth/oauthRefreshBridge';
import type { components } from '@/types/api';

type OAuthCallbackResponse =
  components['schemas']['ApiResponse_GoogleCallbackVO_'];

const BFF_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

function extractRefreshToken(headers: Headers): string | null {
  const setCookie = headers.get('set-cookie') ?? '';
  return setCookie.match(/refresh_token=([^;,]+)/)?.[1] ?? null;
}

export async function googleCallback(
  code: string,
  state: string
): Promise<OAuthCallbackResponse> {
  console.log('[GoogleAuth][server] POST /v2/oauth/google/callback', {
    hasCode: Boolean(code),
    hasState: Boolean(state),
    codeLen: code?.length ?? 0,
  });

  const res = await fetch(`${BFF_URL}/v2/oauth/google/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state }),
  });

  console.log('[GoogleAuth][server] BFF callback response', {
    status: res.status,
    ok: res.ok,
  });

  const data = (await res.json()) as OAuthCallbackResponse;

  console.log('[GoogleAuth][server] BFF callback payload', {
    authType: data?.data?.auth_type,
    hasAuthToken: Boolean(data?.data?.auth?.token),
    hasIdToken: Boolean(data?.data?.id_token),
    hasUser: Boolean(data?.data?.user),
    userId: data?.data?.user?.user_id,
    isMentor: data?.data?.user?.is_mentor,
    onBoarding: data?.data?.user?.onboarding,
    msg: data?.msg,
  });

  const refreshToken = extractRefreshToken(res.headers);
  console.log('[GoogleAuth][server] refresh token bridge', {
    hasRefreshToken: Boolean(refreshToken),
  });
  if (refreshToken) {
    cookies().set(OAUTH_REFRESH_BRIDGE_COOKIE, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: OAUTH_REFRESH_BRIDGE_TTL_SECONDS,
    });
  }

  return data;
}
