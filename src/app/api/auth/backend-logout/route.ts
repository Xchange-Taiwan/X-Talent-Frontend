import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { resolveBffBaseUrl } from '@/lib/auth/bffAuth';
import { revokeBffSession } from '@/services/auth/backendLogout.server';

export async function POST(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const refreshToken = token?.refreshToken;
  const userId = token?.id ?? '';
  const baseUrl = resolveBffBaseUrl();

  if (!baseUrl || !refreshToken || !/^\d+$/.test(userId)) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    await revokeBffSession(refreshToken, Number(userId));
  } catch {
    // Local NextAuth sign-out must still complete when the BFF is unavailable.
  }

  return new NextResponse(null, { status: 204 });
}
