import { Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';

interface SessionPayload {
  id: string;
  name: string;
  onBoarding: boolean;
  isMentor: boolean;
  /** Becomes session.accessToken via auth.config.ts session callback */
  token: string;
  jobTitle?: string;
  company?: string;
  personalLinks?: { platform: string; url: string }[];
}

/**
 * Forge a properly signed next-auth.session-token cookie so that
 * getSession() / getServerSession() return a real decoded session —
 * without hitting the real backend.
 *
 * The secret must match the running dev server's NEXTAUTH_SECRET.
 * Defaults to 'secret', which matches .env.development.local.
 */
export async function setSignedSessionCookie(
  page: Page,
  payload: SessionPayload
): Promise<void> {
  const signed = await encode({
    token: payload,
    secret: process.env.NEXTAUTH_SECRET ?? 'secret',
  });

  await page.context().addCookies([
    {
      name: 'next-auth.session-token',
      value: signed,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}
