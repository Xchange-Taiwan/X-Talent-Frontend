import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { match } from 'path-to-regexp';

import { apiAuthPrefix, DEFAULT_LOGIN, publicRoutes } from '@/routes';

// Convert Next.js dynamic route → express style (:id)
function normalizeRoute(route: string): string {
  return route.replace(/\[([^\]]+)\]/g, ':$1');
}

export async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // Sentry tunnel route — bypass middleware so anonymous-user envelope POSTs
  // aren't redirected to /auth/signin (defined by withSentryConfig
  // tunnelRoute in next.config.js).
  if (pathname === '/monitoring' || pathname.startsWith('/monitoring/')) {
    return NextResponse.next();
  }

  // -------- 1. Verify session via NextAuth getToken (JWT signature + exp) --------
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const hasRefreshError = token?.error === 'RefreshTokenError';
  const isLoggedIn = !!token && !hasRefreshError;

  // -------- 2. Allow NextAuth API routes through unconditionally --------
  const isApiAuthRoute = pathname.startsWith(apiAuthPrefix);

  if (isApiAuthRoute) {
    return NextResponse.next();
  }

  // -------- 3. Check if the request matches a public route --------
  const isMatchedPublicRoute = publicRoutes.some((route) => {
    const normalized = normalizeRoute(route);
    const matcher = match(normalized, { decode: decodeURIComponent });
    return matcher(pathname);
  });

  // /profile/[id]/edit is always protected even if its parent route is public
  const isEditProfile = /^\/profile\/[^\/]+\/edit$/.test(pathname);

  const isPublicRoute = isMatchedPublicRoute && !isEditProfile;

  // -------- 4. Redirect unauthenticated users away from protected routes --------
  if (!isPublicRoute && !isLoggedIn) {
    const redirectUrl = new URL(DEFAULT_LOGIN, nextUrl);
    const response = NextResponse.redirect(redirectUrl);

    // Stale cookie would make middleware re-evaluate the same error on every
    // request; clearing it lets the next request start from a clean state.
    if (hasRefreshError) {
      response.cookies.delete('next-auth.session-token');
      response.cookies.delete('__Secure-next-auth.session-token');
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
