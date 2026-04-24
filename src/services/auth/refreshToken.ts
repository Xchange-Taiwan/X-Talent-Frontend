import type { components } from '@/types/api';

type RefreshResponse = components['schemas']['ApiResponse_TokenRefreshVO_'];

const BFF_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

interface RefreshResult {
  token: string;
  refreshToken: string | null;
}

function extractRefreshToken(headers: Headers): string | null {
  const setCookie = headers.get('set-cookie') ?? '';
  return setCookie.match(/refresh_token=([^;,]+)/)?.[1] ?? null;
}

export async function refreshAccessToken(
  currentRefreshToken: string
): Promise<RefreshResult> {
  const res = await fetch(`${BFF_URL}/v1/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: currentRefreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed with status ${res.status}`);
  }

  const data = (await res.json()) as RefreshResponse;

  if (!data.data?.auth.token) {
    throw new Error('Token refresh response missing token');
  }

  return {
    token: data.data.auth.token,
    refreshToken: extractRefreshToken(res.headers),
  };
}
