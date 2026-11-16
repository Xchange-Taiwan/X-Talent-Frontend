import { NextRequest, NextResponse } from 'next/server';
import { decode, getToken } from 'next-auth/jwt';

import {
  encodeSessionHint,
  safeDecodeURIComponent,
  SESSION_HINT_COOKIE,
  SESSION_HINT_COOKIE_OPTIONS,
} from '@/lib/auth/sessionHint';
import { isFavoritesEnabled } from '@/lib/featureFlags';
import {
  getMaintenanceBypassToken,
  getMaintenanceMode,
} from '@/lib/globalConfig';
import {
  classifyPathname,
  evaluateMiddlewareGate,
  shouldVerifyMiddlewareSession,
} from '@/lib/routes';

export async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const route = classifyPathname(pathname);

  // -------- 0. Short-circuit Static Assets and Sentry Tunnel --------
  if (route.kind === 'bypass') {
    return NextResponse.next();
  }

  // -------- 1. Resolve Maintenance Bypass & Mode --------
  const bypassParam = nextUrl.searchParams.get('bypass');
  const bypassCookie = req.cookies.get('maintenance_bypass')?.value;

  const e2eMaintenanceCookie = req.cookies.get('__e2e_maintenance')?.value;
  const e2eMaintenanceOverride =
    e2eMaintenanceCookie && process.env.NEXTAUTH_SECRET
      ? await decode({
          token: e2eMaintenanceCookie,
          secret: process.env.NEXTAUTH_SECRET,
        }).catch(() => null)
      : null;

  let bypassToken: string | undefined =
    (typeof e2eMaintenanceOverride?.bypassToken === 'string'
      ? e2eMaintenanceOverride.bypassToken
      : undefined) || process.env.MAINTENANCE_BYPASS_TOKEN;
  if (!bypassToken && (bypassParam || bypassCookie)) {
    const bypassResult = await getMaintenanceBypassToken(500);
    bypassToken = bypassResult.value ?? undefined;
  }

  if (bypassToken && bypassParam === bypassToken) {
    const nextUrlClean = new URL(req.url);
    nextUrlClean.searchParams.delete('bypass');

    const response = NextResponse.redirect(nextUrlClean);
    response.cookies.set('maintenance_bypass', bypassToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7200,
    });
    return response;
  }

  const hasValidBypass = Boolean(bypassToken && bypassCookie === bypassToken);
  const isMaintenancePage = route.kind === 'maintenance';

  let isInMaintenanceMode = false;
  const isEnvMaintenance =
    e2eMaintenanceOverride?.maintenanceMode === true ||
    process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true' ||
    process.env.MAINTENANCE_MODE === 'true';

  if (isEnvMaintenance) {
    isInMaintenanceMode = true;
  } else {
    const result = await getMaintenanceMode(500);
    isInMaintenanceMode = result.success ? result.value : isMaintenancePage;
  }

  if (hasValidBypass) {
    isInMaintenanceMode = false;
  }

  // -------- 2. Short-circuit /api/auth/* & maintenance before getToken() --------
  const needsSessionCheck = shouldVerifyMiddlewareSession(
    route,
    isInMaintenanceMode
  );

  const token = needsSessionCheck
    ? await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
      })
    : null;

  const hasRefreshError = token?.error === 'RefreshTokenError';
  const isLoggedIn = Boolean(token) && !hasRefreshError;

  const rawCurrentHint = req.cookies.get(SESSION_HINT_COOKIE)?.value;
  const currentHint =
    rawCurrentHint !== undefined
      ? safeDecodeURIComponent(rawCurrentHint)
      : undefined;

  const e2eFeatureFlagsCookie = req.cookies.get('__e2e_feature_flags')?.value;
  const e2eFeatureFlagsOverride =
    e2eFeatureFlagsCookie && process.env.NEXTAUTH_SECRET
      ? await decode({
          token: e2eFeatureFlagsCookie,
          secret: process.env.NEXTAUTH_SECRET,
        }).catch(() => null)
      : null;

  const effectiveFavoritesEnabled =
    typeof e2eFeatureFlagsOverride?.favorites === 'boolean'
      ? e2eFeatureFlagsOverride.favorites
      : isFavoritesEnabled();

  // -------- 3. Delegate Gate Decision --------
  const decision = evaluateMiddlewareGate({
    pathname,
    search: nextUrl.search,
    method: req.method,
    isInMaintenanceMode,
    isFavoritesEnabled: effectiveFavoritesEnabled,
    session: isLoggedIn
      ? {
          isAuthenticated: true,
          onBoarding:
            typeof token?.onBoarding === 'boolean'
              ? token.onBoarding
              : undefined,
          isMentor: Boolean(token?.isMentor),
        }
      : null,
  });

  if (decision.action === 'maintenance_api_503') {
    return NextResponse.json(
      { error: 'Service Unavailable (Maintenance Mode)' },
      { status: 503, headers: { 'X-Maintenance-Mode': '1' } }
    );
  }

  if (decision.action === 'redirect') {
    const redirectUrl = new URL(decision.destination, nextUrl);
    const response = NextResponse.redirect(redirectUrl);

    if (hasRefreshError) {
      scrubBrokenSessionCookies(response);
    }

    if (!isLoggedIn && currentHint !== undefined) {
      response.cookies.delete(SESSION_HINT_COOKIE);
    }

    return response;
  }

  // -------- 4. Preserve ADR-0001 Session-Hint Cookie Sync --------
  const response = NextResponse.next();

  if (hasRefreshError) {
    scrubBrokenSessionCookies(response);
  }

  if (decision.syncSessionHint) {
    if (isLoggedIn) {
      const nextHint = encodeSessionHint({
        isMentor: Boolean(token?.isMentor),
        userId: typeof token?.id === 'string' ? token.id : undefined,
        avatar:
          typeof token?.avatar === 'string' && token.avatar
            ? token.avatar
            : typeof token?.picture === 'string' && token.picture
              ? token.picture
              : undefined,
      });
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
  } else if (hasRefreshError && currentHint !== undefined) {
    response.cookies.delete(SESSION_HINT_COOKIE);
  }

  return response;
}

function scrubBrokenSessionCookies(response: NextResponse): void {
  response.cookies.delete('next-auth.session-token');
  response.cookies.delete('__Secure-next-auth.session-token');
}

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
