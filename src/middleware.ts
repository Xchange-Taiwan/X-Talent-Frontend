import { NextRequest, NextResponse } from 'next/server';
import { match } from 'path-to-regexp';

import { apiAuthPrefix, DEFAULT_LOGIN, publicRoutes } from '@/routes';

// Convert Next.js dynamic route → express style (:id)
function normalizeRoute(route: string): string {
  return route.replace(/\[([^\]]+)\]/g, ':$1');
}

export function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // -------- 1. Determine auth state by reading the session cookie directly --------
  // NextAuth v4 session token cookie
  const token =
    req.cookies.get('next-auth.session-token')?.value ||
    req.cookies.get('__Secure-next-auth.session-token')?.value;

  const isLoggedIn = !!token;

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
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
