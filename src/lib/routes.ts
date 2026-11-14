import { match } from 'path-to-regexp';

export const HOME_HREF = '/';
export const ABOUT_HREF = '/about';
export const PRIVACY_HREF = '/privacy';
export const TERMS_HREF = '/terms';
export const FIND_MENTOR_HREF = '/mentor-pool';
export const MAINTENANCE_HREF = '/maintenance';

export const SIGNIN_HREF = '/auth/signin';
export const DEFAULT_LOGIN: string = SIGNIN_HREF;
export const SIGNUP_HREF = '/auth/signup';
export const ONBOARDING_HREF = '/auth/onboarding';
export const GOOGLE_OAUTH_CALLBACK_HREF = '/auth/google/callback/redirect';
export const PASSWORD_FORGOT_HREF = '/auth/password-forgot';
export const PASSWORD_FORGOT_SUCCESS_HREF = '/auth/password-forgot-success';
export const PASSWORD_RESET_HREF = '/auth/password-reset';
export const PASSWORD_RESET_SUCCESS_HREF = '/auth/password-reset-success';
export const EMAIL_VERIFY_HREF = '/auth/email-verify';
export const EMAIL_VERIFIED_HREF = '/auth/email-verified';

export const PROFILE_CARD_HREF = '/profile/card';

export const RESERVATION_INDEX_HREF = '/reservation';
export const RESERVATION_MENTEE_HREF = '/reservation/mentee';
export const RESERVATION_MENTOR_HREF = '/reservation/mentor';
export const RESERVATION_HISTORY_HREF = '/reservation/history';

export const API_AUTH_PREFIX = '/api/auth';
export const apiAuthPrefix: string = API_AUTH_PREFIX;
export const API_ANNOUNCEMENT_HREF = '/api/announcement';
export const MONITORING_HREF = '/monitoring';

export const MENTOR_ONBOARDING_KEY = 'mentor-onboarding';
export const OPEN_SCHEDULE_DIALOG_KEY = 'open-schedule';

const INTERNAL_BASE_ORIGIN = 'https://x-talent-internal.local';
const SLASH_BACKSLASH_PREFIX = `/${String.fromCharCode(92)}`;

/**
 * Canonical public route templates (kept for declarative inspection; runtime
 * classification uses precompiled matchers below). Note that `/profile/card`
 * and `/profile/[pageUserId]/edit` take precedence over `/profile/[pageUserId]`.
 */
export const publicRoutes: readonly string[] = [
  HOME_HREF,
  ABOUT_HREF,
  SIGNIN_HREF,
  SIGNUP_HREF,
  GOOGLE_OAUTH_CALLBACK_HREF,
  PASSWORD_FORGOT_HREF,
  PASSWORD_FORGOT_SUCCESS_HREF,
  PASSWORD_RESET_HREF,
  PASSWORD_RESET_SUCCESS_HREF,
  EMAIL_VERIFY_HREF,
  EMAIL_VERIFIED_HREF,
  '/profile/[pageUserId]',
  FIND_MENTOR_HREF,
  PRIVACY_HREF,
  TERMS_HREF,
  API_ANNOUNCEMENT_HREF,
];

function safeDecodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeDynamicPattern(route: string): string {
  return route.replace(/\[([^\]]+)\]/g, ':$1');
}

function compileRouteMatcher<TParams extends Partial<Record<string, string>>>(
  routePattern: string
) {
  return match<TParams>(normalizeDynamicPattern(routePattern), {
    decode: safeDecodeSegment,
  });
}

// Precompiled once at module load time so middleware and helpers never
// re-parse or re-compile route patterns per request.
const STATIC_BYPASS_EXACT = new Set<string>([
  '/favicon.ico',
  '/logo.svg',
  MONITORING_HREF,
]);

const STATIC_BYPASS_PREFIXES = [
  '/_next/',
  '/static/',
  '/assets/',
  '/landing/',
  `${MONITORING_HREF}/`,
] as const;

const PRECOMPILED_PUBLIC_PAGE_MATCHERS = [
  compileRouteMatcher(HOME_HREF),
  compileRouteMatcher(ABOUT_HREF),
  compileRouteMatcher(PRIVACY_HREF),
  compileRouteMatcher(TERMS_HREF),
  compileRouteMatcher(FIND_MENTOR_HREF),
] as const;

const PRECOMPILED_AUTH_CREDENTIALS_MATCHERS = [
  compileRouteMatcher(SIGNIN_HREF),
  compileRouteMatcher(SIGNUP_HREF),
] as const;

const PRECOMPILED_AUTH_PUBLIC_MATCHERS = [
  compileRouteMatcher(GOOGLE_OAUTH_CALLBACK_HREF),
  compileRouteMatcher(PASSWORD_FORGOT_HREF),
  compileRouteMatcher(PASSWORD_FORGOT_SUCCESS_HREF),
  compileRouteMatcher(PASSWORD_RESET_HREF),
  compileRouteMatcher(PASSWORD_RESET_SUCCESS_HREF),
  compileRouteMatcher(EMAIL_VERIFY_HREF),
  compileRouteMatcher(EMAIL_VERIFIED_HREF),
] as const;

const matchMaintenanceRoute = compileRouteMatcher(MAINTENANCE_HREF);
const matchOnboardingRoute = compileRouteMatcher(ONBOARDING_HREF);
const matchApiAnnouncementRoute = compileRouteMatcher(API_ANNOUNCEMENT_HREF);
const matchProfileCardRoute = compileRouteMatcher(PROFILE_CARD_HREF);
const matchProfileEditRoute = compileRouteMatcher<{ pageUserId: string }>(
  '/profile/[pageUserId]/edit'
);
const matchPublicProfileRoute = compileRouteMatcher<{ pageUserId: string }>(
  '/profile/[pageUserId]'
);
const matchReservationIndexRoute = compileRouteMatcher(RESERVATION_INDEX_HREF);
const matchReservationMenteeRoute = compileRouteMatcher(
  RESERVATION_MENTEE_HREF
);
const matchReservationMentorRoute = compileRouteMatcher(
  RESERVATION_MENTOR_HREF
);
const matchReservationHistoryRoute = compileRouteMatcher(
  RESERVATION_HISTORY_HREF
);

export type ProtectedRouteAccess = 'authenticated' | 'mentor_only';

export type PathnameClassification =
  | { kind: 'bypass'; pathname: string }
  | { kind: 'maintenance'; pathname: string }
  | { kind: 'api_auth'; pathname: string }
  | { kind: 'api_public'; pathname: string }
  | { kind: 'api_protected'; pathname: string }
  | { kind: 'auth_credentials'; pathname: string }
  | { kind: 'auth_public'; pathname: string }
  | { kind: 'onboarding'; pathname: string }
  | {
      kind: 'public';
      pathname: string;
      params?: { pageUserId: string };
    }
  | {
      kind: 'protected';
      pathname: string;
      access: ProtectedRouteAccess;
      requiresCompletedOnboarding: boolean;
      params?: { pageUserId: string };
    };

export type AuthSurface = 'sign_shell' | 'credentials' | 'onboarding';

export interface AuthSurfaceUser {
  id?: string;
  onBoarding?: boolean;
  isMentor?: boolean;
}

export interface MiddlewareSessionState {
  isAuthenticated: boolean;
  onBoarding?: boolean;
  isMentor?: boolean;
}

export interface MiddlewareGateInput {
  pathname: string;
  search?: string;
  method?: string;
  isInMaintenanceMode?: boolean;
  session?: MiddlewareSessionState | null;
}

export type MiddlewareGateDecision =
  | {
      action: 'next';
      syncSessionHint: boolean;
    }
  | {
      action: 'redirect';
      destination: string;
      syncSessionHint: boolean;
    }
  | {
      action: 'maintenance_api_503';
      syncSessionHint: false;
    };

export function getPublicProfileUrl(userId: string | number): string {
  return `/profile/${userId}`;
}

export function getProfileEditUrl(userId: string | number): string {
  return `/profile/${userId}/edit`;
}

export function getMentorOnboardingUrl(userId: string | number): string {
  return `${getProfileEditUrl(userId)}?${MENTOR_ONBOARDING_KEY}=true`;
}

export function getBecomeMentorHref(userId: string | undefined): string {
  return userId ? getMentorOnboardingUrl(userId) : SIGNUP_HREF;
}

export function getMentorScheduleManagementUrl(
  userId: string | number
): string {
  return `${getPublicProfileUrl(userId)}?${OPEN_SCHEDULE_DIALOG_KEY}=true`;
}

export function getOpenScheduleHref(userId: string | undefined): string {
  return userId ? getMentorScheduleManagementUrl(userId) : HOME_HREF;
}

export function getReservationRoleUrl(role: 'mentee' | 'mentor'): string {
  return role === 'mentor' ? RESERVATION_MENTOR_HREF : RESERVATION_MENTEE_HREF;
}

export function getSignInUrl(callbackUrl?: string | null): string {
  const safeCallbackUrl = sanitizeCallbackUrl(callbackUrl);
  if (!safeCallbackUrl) {
    return SIGNIN_HREF;
  }
  const params = new URLSearchParams();
  params.set('callbackUrl', safeCallbackUrl);
  return `${SIGNIN_HREF}?${params.toString()}`;
}

function isBypassAssetOrTunnel(pathname: string): boolean {
  if (STATIC_BYPASS_EXACT.has(pathname)) {
    return true;
  }
  return STATIC_BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function classifyPathname(pathname: string): PathnameClassification {
  if (isBypassAssetOrTunnel(pathname)) {
    return { kind: 'bypass', pathname };
  }

  if (matchMaintenanceRoute(pathname)) {
    return { kind: 'maintenance', pathname };
  }

  if (
    pathname === API_AUTH_PREFIX ||
    pathname.startsWith(`${API_AUTH_PREFIX}/`)
  ) {
    return { kind: 'api_auth', pathname };
  }

  if (matchApiAnnouncementRoute(pathname)) {
    return { kind: 'api_public', pathname };
  }

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return { kind: 'api_protected', pathname };
  }

  if (
    PRECOMPILED_AUTH_CREDENTIALS_MATCHERS.some((matcher) =>
      Boolean(matcher(pathname))
    )
  ) {
    return { kind: 'auth_credentials', pathname };
  }

  if (matchOnboardingRoute(pathname)) {
    return { kind: 'onboarding', pathname };
  }

  if (
    PRECOMPILED_AUTH_PUBLIC_MATCHERS.some((matcher) =>
      Boolean(matcher(pathname))
    )
  ) {
    return { kind: 'auth_public', pathname };
  }

  if (
    PRECOMPILED_PUBLIC_PAGE_MATCHERS.some((matcher) =>
      Boolean(matcher(pathname))
    )
  ) {
    return { kind: 'public', pathname };
  }

  // Specific `/profile/card` and `/profile/:pageUserId/edit` routes MUST be
  // matched before dynamic `/profile/:pageUserId` so they are never treated as
  // public mentor profile pages.
  if (matchProfileCardRoute(pathname)) {
    return {
      kind: 'protected',
      pathname,
      access: 'authenticated',
      requiresCompletedOnboarding: false,
    };
  }

  const editMatch = matchProfileEditRoute(pathname);
  if (editMatch) {
    return {
      kind: 'protected',
      pathname,
      access: 'authenticated',
      requiresCompletedOnboarding: true,
      params: { pageUserId: editMatch.params.pageUserId },
    };
  }

  const publicProfileMatch = matchPublicProfileRoute(pathname);
  if (publicProfileMatch) {
    return {
      kind: 'public',
      pathname,
      params: { pageUserId: publicProfileMatch.params.pageUserId },
    };
  }

  if (matchReservationMentorRoute(pathname)) {
    return {
      kind: 'protected',
      pathname,
      access: 'mentor_only',
      requiresCompletedOnboarding: true,
    };
  }

  if (
    matchReservationIndexRoute(pathname) ||
    matchReservationMenteeRoute(pathname) ||
    matchReservationHistoryRoute(pathname)
  ) {
    return {
      kind: 'protected',
      pathname,
      access: 'authenticated',
      requiresCompletedOnboarding: true,
    };
  }

  return {
    kind: 'protected',
    pathname,
    access: 'authenticated',
    requiresCompletedOnboarding: true,
  };
}

/**
 * Determines whether a normalized internal pathname is unsafe or nonsensical as
 * a post-login `callbackUrl` destination (e.g. `/maintenance`, `/auth/*`,
 * `/api/*`, or static/tunnel bypass endpoints).
 */
export function isDisallowedCallbackPathname(pathname: string): boolean {
  if (
    !pathname.startsWith('/') ||
    pathname.startsWith('//') ||
    pathname.startsWith(SLASH_BACKSLASH_PREFIX)
  ) {
    return true;
  }

  if (
    pathname === '/auth' ||
    pathname.startsWith('/auth/') ||
    pathname === '/api' ||
    pathname.startsWith('/api/') ||
    pathname === MAINTENANCE_HREF ||
    pathname.startsWith(`${MAINTENANCE_HREF}/`)
  ) {
    return true;
  }

  const classification = classifyPathname(pathname);
  return (
    classification.kind === 'bypass' ||
    classification.kind === 'maintenance' ||
    classification.kind === 'api_auth' ||
    classification.kind === 'api_public' ||
    classification.kind === 'api_protected' ||
    classification.kind === 'auth_credentials' ||
    classification.kind === 'auth_public' ||
    classification.kind === 'onboarding'
  );
}

/**
 * Validates and normalizes a post-login `callbackUrl` so only safe, same-origin
 * internal paths (preserving full query string and hash) are accepted.
 * Rejects protocol-relative URLs (`//evil.com`), backslash tricks,
 * external origins, `javascript:`/`data:` schemes, `/maintenance`, and
 * `/auth/*` or `/api/*` loops.
 */
export function sanitizeCallbackUrl(
  rawCallbackUrl: string | null | undefined,
  currentOrigin?: string
): string | null {
  if (!rawCallbackUrl) return null;

  const trimmed = rawCallbackUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('/')) {
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith(SLASH_BACKSLASH_PREFIX)
    ) {
      return null;
    }

    try {
      const parsed = new URL(trimmed, INTERNAL_BASE_ORIGIN);
      if (parsed.origin !== INTERNAL_BASE_ORIGIN) {
        return null;
      }
      if (isDisallowedCallbackPathname(parsed.pathname)) {
        return null;
      }
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return null;
    }
  }

  if (currentOrigin) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.origin !== currentOrigin) {
        return null;
      }
      if (isDisallowedCallbackPathname(parsed.pathname)) {
        return null;
      }
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Resolves server-side redirect targets for auth surfaces:
 * - `sign_shell` (`src/app/auth/(sign)/layout.tsx`): shared split-cover shell
 *   for `/auth/signin`, `/auth/signup`, and `/auth/onboarding`. Redirects
 *   authenticated users with completed onboarding (`onBoarding !== false`) to
 *   `/`, while allowing visitors and incomplete-onboarding users through.
 * - `credentials` (`src/app/auth/(sign)/(credentials)/layout.tsx`): nested
 *   guard for `/auth/signin` and `/auth/signup`. Redirects authenticated users
 *   with `onBoarding === false` to `/auth/onboarding` (and completed users to
 *   `/`).
 * - `onboarding` (`/auth/onboarding`): redirects unauthenticated visitors to
 *   `/auth/signin` and already-onboarded users to `/`.
 */
export function resolveAuthSurfaceRedirect(
  surface: AuthSurface,
  user: AuthSurfaceUser | null | undefined
): string | null {
  const isAuthenticated = Boolean(user && user.id);

  switch (surface) {
    case 'sign_shell': {
      if (isAuthenticated && user?.onBoarding !== false) {
        return HOME_HREF;
      }
      return null;
    }
    case 'credentials': {
      if (!isAuthenticated) {
        return null;
      }
      return user?.onBoarding === false ? ONBOARDING_HREF : HOME_HREF;
    }
    case 'onboarding': {
      if (!isAuthenticated) {
        return DEFAULT_LOGIN;
      }
      return user?.onBoarding !== false ? HOME_HREF : null;
    }
  }
}

/**
 * Indicates whether `middleware.ts` needs to invoke `getToken()` for a classified
 * route. Bypass assets/tunnel, `/api/auth/*`, `/maintenance`, and active
 * maintenance mode short-circuit before JWT decryption.
 */
export function shouldVerifyMiddlewareSession(
  classification: PathnameClassification,
  isInMaintenanceMode: boolean
): boolean {
  if (
    classification.kind === 'bypass' ||
    classification.kind === 'api_auth' ||
    classification.kind === 'maintenance' ||
    isInMaintenanceMode
  ) {
    return false;
  }
  return true;
}

export function evaluateMiddlewareGate({
  pathname,
  search = '',
  method = 'GET',
  isInMaintenanceMode = false,
  session = null,
}: MiddlewareGateInput): MiddlewareGateDecision {
  const classification = classifyPathname(pathname);

  if (classification.kind === 'bypass') {
    return { action: 'next', syncSessionHint: false };
  }

  if (isInMaintenanceMode) {
    if (classification.kind === 'maintenance') {
      return { action: 'next', syncSessionHint: false };
    }
    if (
      classification.kind === 'api_auth' ||
      classification.kind === 'api_public' ||
      classification.kind === 'api_protected'
    ) {
      return { action: 'maintenance_api_503', syncSessionHint: false };
    }
    return {
      action: 'redirect',
      destination: MAINTENANCE_HREF,
      syncSessionHint: false,
    };
  }

  if (classification.kind === 'maintenance') {
    return {
      action: 'redirect',
      destination: HOME_HREF,
      syncSessionHint: false,
    };
  }

  if (classification.kind === 'api_auth') {
    return { action: 'next', syncSessionHint: false };
  }

  const isAuthenticated = Boolean(session?.isAuthenticated);
  const hasCompletedOnboarding = session?.onBoarding !== false;
  const isMentor = Boolean(session?.isMentor);
  const authSurfaceUser: AuthSurfaceUser | null = isAuthenticated
    ? {
        id: 'authenticated',
        onBoarding: session?.onBoarding,
        isMentor,
      }
    : null;

  if (classification.kind === 'onboarding') {
    const redirectTarget = resolveAuthSurfaceRedirect(
      'onboarding',
      authSurfaceUser
    );
    if (redirectTarget) {
      return {
        action: 'redirect',
        destination: redirectTarget,
        syncSessionHint: false,
      };
    }
    return { action: 'next', syncSessionHint: true };
  }

  if (classification.kind === 'auth_credentials') {
    const normalizedMethod = method.toUpperCase();
    const isDocumentNavigation =
      normalizedMethod === 'GET' || normalizedMethod === 'HEAD';

    if (isDocumentNavigation) {
      const redirectTarget = resolveAuthSurfaceRedirect(
        'credentials',
        authSurfaceUser
      );
      if (redirectTarget) {
        return {
          action: 'redirect',
          destination: redirectTarget,
          syncSessionHint: false,
        };
      }
      return { action: 'next', syncSessionHint: true };
    }

    // Allow non-GET/HEAD requests (e.g. Next.js Server Action POSTs on
    // /auth/signin or /auth/signup) to execute without a 307 redirect.
    return { action: 'next', syncSessionHint: false };
  }

  if (
    classification.kind === 'public' ||
    classification.kind === 'auth_public' ||
    classification.kind === 'api_public'
  ) {
    return { action: 'next', syncSessionHint: true };
  }

  if (classification.kind === 'api_protected') {
    if (!isAuthenticated) {
      return {
        action: 'redirect',
        destination: DEFAULT_LOGIN,
        syncSessionHint: false,
      };
    }
    return { action: 'next', syncSessionHint: true };
  }

  // `classification.kind === 'protected'`
  if (!isAuthenticated) {
    return {
      action: 'redirect',
      destination: getSignInUrl(`${pathname}${search}`),
      syncSessionHint: false,
    };
  }

  if (!hasCompletedOnboarding && classification.requiresCompletedOnboarding) {
    return {
      action: 'redirect',
      destination: ONBOARDING_HREF,
      syncSessionHint: false,
    };
  }

  if (classification.access === 'mentor_only' && !isMentor) {
    return {
      action: 'redirect',
      destination: RESERVATION_MENTEE_HREF,
      syncSessionHint: false,
    };
  }

  return { action: 'next', syncSessionHint: true };
}
