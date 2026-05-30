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
  const res = await fetch(`${BFF_URL}/v2/oauth/google/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state }),
  });

  const data = (await res.json()) as OAuthCallbackResponse;

  const refreshToken = extractRefreshToken(res.headers);
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
