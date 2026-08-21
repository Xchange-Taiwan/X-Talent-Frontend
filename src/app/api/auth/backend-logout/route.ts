import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

const BFF_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const refreshToken =
    typeof token?.refreshToken === 'string' ? token.refreshToken : '';
  const userId = typeof token?.id === 'string' ? token.id : '';

  if (!BFF_URL || !refreshToken || !/^\d+$/.test(userId)) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    await fetch(`${BFF_URL}/v1/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `refresh_token=${refreshToken}`,
      },
      body: JSON.stringify({ user_id: Number(userId) }),
      cache: 'no-store',
    });
  } catch {
    // Local NextAuth sign-out must still complete when the BFF is unavailable.
  }

  return new NextResponse(null, { status: 204 });
}
