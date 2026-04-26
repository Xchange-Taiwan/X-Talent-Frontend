import { Page } from '@playwright/test';
import { encode, JWT } from 'next-auth/jwt';

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

// Derive cookie domain + secure flag from BASE_URL so the same helper works
// against both http://localhost:3000 (local dev server) and remote https
// deployments like https://xtalentdev.vercel.app.
function getCookieTarget(): { domain: string; secure: boolean } {
  const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
  const url = new URL(baseUrl);
  return { domain: url.hostname, secure: url.protocol === 'https:' };
}

/**
 * Forge a properly signed next-auth.session-token cookie so that
 * getSession() / getServerSession() return a real decoded session —
 * without hitting the real backend.
 *
 * The secret must match the running server's NEXTAUTH_SECRET. Defaults to
 * 'secret' (matches .env.development.local). When BASE_URL targets a remote
 * deployment, set NEXTAUTH_SECRET to that deployment's secret or the cookie
 * will fail to decrypt and the user will appear signed-out.
 */
export async function setSignedSessionCookie(
  page: Page,
  payload: SessionPayload
): Promise<void> {
  const signed = await encode({
    token: payload as JWT,
    secret: process.env.NEXTAUTH_SECRET ?? 'secret',
  });

  const { domain, secure } = getCookieTarget();
  await page.context().addCookies([
    {
      name: 'next-auth.session-token',
      value: signed,
      domain,
      path: '/',
      httpOnly: true,
      secure,
      sameSite: 'Lax',
    },
  ]);
}

/**
 * Set a raw (intentionally invalid) session-token cookie. Used by onboarding
 * tests where the middleware only checks for cookie existence and the
 * server-side guard tolerates a decode failure.
 */
export async function setRawSessionCookie(
  page: Page,
  value: string
): Promise<void> {
  const { domain, secure } = getCookieTarget();
  await page.context().addCookies([
    {
      name: 'next-auth.session-token',
      value,
      domain,
      path: '/',
      httpOnly: true,
      secure,
      sameSite: 'Lax',
    },
  ]);
}
