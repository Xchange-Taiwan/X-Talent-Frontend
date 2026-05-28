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
    code,
    state,
    BFF_URL,
  });

  const res = await fetch(`${BFF_URL}/v2/oauth/google/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state }),
  });

  console.log('[GoogleAuth][server] BFF callback response', {
    status: res.status,
    ok: res.ok,
    headers: Object.fromEntries(res.headers.entries()),
  });

  const data = (await res.json()) as OAuthCallbackResponse;

  console.log(
    '[GoogleAuth][server] BFF callback payload (full):',
    JSON.stringify(data, null, 2)
  );

  const refreshToken = extractRefreshToken(res.headers);
  console.log('[GoogleAuth][server] refresh token bridge', {
    refreshToken,
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
