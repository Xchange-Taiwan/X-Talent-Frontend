'use server';

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
): Promise<OAuthCallbackResponse & { refreshToken: string | null }> {
  const res = await fetch(`${BFF_URL}/v2/oauth/google/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state }),
  });

  const data = (await res.json()) as OAuthCallbackResponse;

  return { ...data, refreshToken: extractRefreshToken(res.headers) };
}
