import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { BASE_URL } from '@/lib/apiClient';
import { revokeBffSession } from '@/services/auth/backendLogout.server';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const refreshToken =
    typeof token?.refreshToken === 'string' ? token.refreshToken : '';
  const userId = typeof token?.id === 'string' ? token.id : '';

  if (!BASE_URL || !refreshToken || !/^\d+$/.test(userId)) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    await revokeBffSession(refreshToken, Number(userId));
  } catch {
    // Local NextAuth sign-out must still complete when the BFF is unavailable.
  }

  return new NextResponse(null, { status: 204 });
}
