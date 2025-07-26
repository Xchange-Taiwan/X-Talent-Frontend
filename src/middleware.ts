import { match } from 'path-to-regexp';

import { apiAuthPrefix, DEFAULT_LOGIN, publicRoutes } from '@/routes';

import { auth } from './auth';

function normalizeRoute(route: string): string {
  return route.replace(/\[([^\]]+)\]/g, ':$1');
}

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const pathname = nextUrl.pathname;

  const isApiAuthRoute = pathname.startsWith(apiAuthPrefix);

  const isMatchedPublicRoute = publicRoutes.some((route) => {
    const normalized = normalizeRoute(route); // Replace [param] → :param
    const matcher = match(normalized, { decode: decodeURIComponent });
    return matcher(pathname);
  });

  // 明確排除編輯頁面
  const isEditProfile = /^\/profile\/[^\/]+\/edit$/.test(pathname);
  const isPublicRoute = isMatchedPublicRoute && !isEditProfile;

  if (isApiAuthRoute) return null;

  if (!isPublicRoute && !isLoggedIn) {
    return Response.redirect(new URL(DEFAULT_LOGIN, nextUrl));
  }

  return null;
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
