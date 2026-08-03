import { get } from '@vercel/edge-config';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { match } from 'path-to-regexp';

import {
  encodeSessionHint,
  SESSION_HINT_COOKIE,
  SESSION_HINT_COOKIE_OPTIONS,
} from '@/lib/auth/sessionHint';
import { apiAuthPrefix, DEFAULT_LOGIN, publicRoutes } from '@/routes';

// Helper to read from Edge Config with a timeout to avoid blocking middleware
async function getWithTimeout(key: string, timeoutMs = 500): Promise<unknown> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn(`Edge Config read timed out after ${timeoutMs}ms`);
      resolve(null);
    }, timeoutMs);

    get(key)
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        console.error('Error reading from Edge Config:', err);
        resolve(null);
      });
  });
}

// Convert Next.js dynamic route → express style (:id)
function normalizeRoute(route: string): string {
  return route.replace(/\[([^\]]+)\]/g, ':$1');
}

export async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // -------- 0. Bypass Static Assets and Sentry Tunnel --------
  // Sentry tunnel route — bypass middleware so anonymous-user envelope POSTs
  // aren't redirected to /auth/signin (defined by withSentryConfig
  // tunnelRoute in next.config.js).
  const isAsset =
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/landing/') ||
    pathname === '/favicon.ico' ||
    pathname === '/logo.svg' ||
    /^\/profile\/(graphic-design|seo-writing|ui-design|ux-design)\.svg$/.test(
      pathname
    );

  const isMonitoring =
    pathname === '/monitoring' || pathname.startsWith('/monitoring/');

  if (isAsset || isMonitoring) {
    return NextResponse.next();
  }

  // -------- 0.05 Check Maintenance Bypass --------
  const bypassParam = nextUrl.searchParams.get('bypass');
  const bypassToken = process.env.MAINTENANCE_BYPASS_TOKEN;

  // If correct bypass token is in query param, set cookie and redirect to clear the URL query param
  if (bypassToken && bypassParam === bypassToken) {
    const nextUrlClean = new URL(req.url);
    nextUrlClean.searchParams.delete('bypass');

    const response = NextResponse.redirect(nextUrlClean);
    response.cookies.set('maintenance_bypass', bypassToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7200, // 2 hours
    });
    return response;
  }

  const bypassCookie = req.cookies.get('maintenance_bypass')?.value;
  const hasValidBypass = !!(bypassToken && bypassCookie === bypassToken);

  // -------- 0.1 Check Maintenance Mode --------
  let isInMaintenanceMode = false;
  const isEnvMaintenance =
    process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true' ||
    process.env.MAINTENANCE_MODE === 'true';

  if (isEnvMaintenance) {
    isInMaintenanceMode = true;
  } else if (process.env.EDGE_CONFIG) {
    const value = await getWithTimeout('isInMaintenanceMode', 500);
    isInMaintenanceMode = value === true || value === 'true';
  }

  // Override maintenance mode if a valid bypass token is present
  if (hasValidBypass) {
    isInMaintenanceMode = false;
  }

  const isMaintenancePage = pathname === '/maintenance';

  if (isInMaintenanceMode) {
    if (isMaintenancePage) {
      return NextResponse.next();
    }

    // For API routes under maintenance, return 503
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Service Unavailable (Maintenance Mode)' },
        { status: 503, headers: { 'X-Maintenance-Mode': '1' } }
      );
    }

    // Redirect any other page requests to /maintenance
    const redirectUrl = new URL('/maintenance', nextUrl);
    return NextResponse.redirect(redirectUrl);
  } else {
    // If not in maintenance mode, redirect /maintenance to /
    if (isMaintenancePage) {
      const redirectUrl = new URL('/', nextUrl);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // -------- 1. Verify session via NextAuth getToken (JWT signature + exp) --------
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const hasRefreshError = token?.error === 'RefreshTokenError';
  const isLoggedIn = !!token && !hasRefreshError;
  const currentHint = req.cookies.get(SESSION_HINT_COOKIE)?.value;

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

    if (currentHint !== undefined) {
      response.cookies.delete(SESSION_HINT_COOKIE);
    }
    return response;
  }

  // -------- 5. Keep the client-readable hint in sync with the verified token --------
  // UI-only signal for instant header rendering — never used for auth decisions.
  // Only emit Set-Cookie when the value actually changes: writing on every
  // request would mark otherwise-cacheable public responses (e.g. `/`)
  // as uncacheable for CDNs and Next's route cache.
  const response = NextResponse.next();

  if (isLoggedIn) {
    const nextHint = encodeSessionHint({ isMentor: Boolean(token?.isMentor) });
    if (currentHint !== nextHint) {
      response.cookies.set(
        SESSION_HINT_COOKIE,
        nextHint,
        SESSION_HINT_COOKIE_OPTIONS
      );
    }
  } else if (currentHint !== undefined) {
    response.cookies.delete(SESSION_HINT_COOKIE);
  }

  return response;
}

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
