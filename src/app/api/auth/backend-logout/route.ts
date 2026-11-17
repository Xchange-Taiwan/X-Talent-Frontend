import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { revokeBffSession } from '@/lib/auth/bffSession.server';

export async function POST(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  try {
    await revokeBffSession(token?.refreshToken, token?.id);
  } catch {
    // Local NextAuth sign-out must still complete when the BFF is unavailable.
  }

  return new NextResponse(null, { status: 204 });
}
