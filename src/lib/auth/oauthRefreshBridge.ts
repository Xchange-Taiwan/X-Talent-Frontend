import { cookies } from 'next/headers';

export const OAUTH_REFRESH_BRIDGE_COOKIE = 'g_oauth_rt';
export const OAUTH_REFRESH_BRIDGE_TTL_SECONDS = 60;

export type CookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * Sets the OAuth refresh token in the cookie bridge.
 * If token is empty, null, or undefined, it deletes any existing bridge cookie.
 */
export function setOAuthRefreshBridge(
  cookieStore: CookieStore,
  token: string | null | undefined
): void {
  if (!token) {
    cookieStore.delete(OAUTH_REFRESH_BRIDGE_COOKIE);
    return;
  }
  cookieStore.set(OAUTH_REFRESH_BRIDGE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: OAUTH_REFRESH_BRIDGE_TTL_SECONDS,
  });
}

/**
 * Consumes (reads and immediately deletes) the OAuth refresh token from the cookie bridge.
 * Returns the token if found, or undefined if not.
 */
export function consumeOAuthRefreshBridge(
  cookieStore: CookieStore
): string | undefined {
  const cookie = cookieStore.get(OAUTH_REFRESH_BRIDGE_COOKIE);
  if (cookie) {
    cookieStore.delete(OAUTH_REFRESH_BRIDGE_COOKIE);
  }
  return cookie?.value;
}
