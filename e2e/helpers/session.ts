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

// Derive cookie domain, secure flag, and cookie *name* from BASE_URL so the
// same helper works against both http://localhost:3000 and remote https
// deployments. NextAuth prefixes the cookie name with `__Secure-` when the
// deployment serves over HTTPS — forging without this prefix means the server
// never sees the cookie and treats the user as signed-out.
function getCookieTarget(): {
  name: string;
  domain: string;
  secure: boolean;
} {
  const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
  const url = new URL(baseUrl);
  const secure = url.protocol === 'https:';
  return {
    name: secure
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token',
    domain: url.hostname,
    secure,
  };
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

  const { name, domain, secure } = getCookieTarget();
  await page.context().addCookies([
    {
      name,
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
  const { name, domain, secure } = getCookieTarget();
  await page.context().addCookies([
    {
      name,
      value,
      domain,
      path: '/',
      httpOnly: true,
      secure,
      sameSite: 'Lax',
    },
  ]);
}
