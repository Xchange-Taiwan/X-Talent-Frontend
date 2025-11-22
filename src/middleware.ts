import { NextResponse } from 'next/server';
import { match } from 'path-to-regexp';

import { apiAuthPrefix, DEFAULT_LOGIN, publicRoutes } from '@/routes';

// Convert Next.js dynamic route → express style (:id)
function normalizeRoute(route: string): string {
  return route.replace(/\[([^\]]+)\]/g, ':$1');
}

export function middleware(req: any) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // -------- 1. 判斷是否登入（讀 cookie 而非 NextAuth middleware）--------
  // NextAuth v4 session token cookie
  const token =
    req.cookies.get('next-auth.session-token')?.value ||
    req.cookies.get('__Secure-next-auth.session-token')?.value;

  const isLoggedIn = !!token;

  // -------- 2. API auth route --------
  const isApiAuthRoute = pathname.startsWith(apiAuthPrefix);

  if (isApiAuthRoute) {
    return NextResponse.next();
  }

  // -------- 3. Public Routes 判斷 --------
  const isMatchedPublicRoute = publicRoutes.some((route) => {
    const normalized = normalizeRoute(route);
    const matcher = match(normalized, { decode: decodeURIComponent });
    return matcher(pathname);
  });

  // /profile/[id]/edit 永遠要保護
  const isEditProfile = /^\/profile\/[^\/]+\/edit$/.test(pathname);

  const isPublicRoute = isMatchedPublicRoute && !isEditProfile;

  // -------- 4. 判斷是否要 redirect --------
  if (!isPublicRoute && !isLoggedIn) {
    const redirectUrl = new URL(DEFAULT_LOGIN, nextUrl);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
