import {
  apiAuthPrefix,
  authRoutes,
  DEFAULT_LOGIN_REDIRECT,
  publicRoutes,
} from '@/routes';

import { auth } from './auth';

export default auth((req) => {
  const { nextUrl } = req;
  // const isLoggedIn = !!req.auth;
  const isLoggedIn = false;

  const isApiAuthRoute = nextUrl.pathname.startsWith(apiAuthPrefix);
  const isAuthRoute = authRoutes.includes(nextUrl.pathname);
  const isPublicRoute = publicRoutes.includes(nextUrl.pathname);

  if (isApiAuthRoute) {
    return null;
  }

  if (isAuthRoute && isLoggedIn) {
    return Response.redirect(new URL(DEFAULT_LOGIN_REDIRECT, nextUrl));
  }

  if (!isPublicRoute && !isLoggedIn) {
    return Response.redirect(new URL('/auth/signin', nextUrl));
  }

  return null;
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
