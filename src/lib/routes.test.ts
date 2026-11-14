import { describe, expect, it } from 'vitest';

import {
  ABOUT_HREF,
  API_ANNOUNCEMENT_HREF,
  API_AUTH_PREFIX,
  apiAuthPrefix,
  classifyPathname,
  DEFAULT_LOGIN,
  evaluateMiddlewareGate,
  FIND_MENTOR_HREF,
  getBecomeMentorHref,
  getMentorOnboardingUrl,
  getMentorScheduleManagementUrl,
  getOpenScheduleHref,
  getProfileEditUrl,
  getPublicProfileUrl,
  getReservationRoleUrl,
  getSignInUrl,
  HOME_HREF,
  isDisallowedCallbackPathname,
  MAINTENANCE_HREF,
  MENTOR_ONBOARDING_KEY,
  type MiddlewareGateDecision,
  type MiddlewareSessionState,
  ONBOARDING_HREF,
  OPEN_SCHEDULE_DIALOG_KEY,
  PROFILE_CARD_HREF,
  RESERVATION_HISTORY_HREF,
  RESERVATION_INDEX_HREF,
  RESERVATION_MENTEE_HREF,
  RESERVATION_MENTOR_HREF,
  resolveAuthSurfaceRedirect,
  sanitizeCallbackUrl,
  shouldVerifyMiddlewareSession,
  SIGNIN_HREF,
  SIGNUP_HREF,
} from './routes';

const VISITOR_SESSION: MiddlewareSessionState | null = null;

const MENTEE_INCOMPLETE_ONBOARDING: MiddlewareSessionState = {
  isAuthenticated: true,
  onBoarding: false,
  isMentor: false,
};

const MENTEE_ONBOARDED: MiddlewareSessionState = {
  isAuthenticated: true,
  onBoarding: true,
  isMentor: false,
};

const MENTOR_SESSION: MiddlewareSessionState = {
  isAuthenticated: true,
  onBoarding: true,
  isMentor: true,
};

describe('src/lib/routes', () => {
  describe('route constants and URL builders', () => {
    it('exports canonical route constants', () => {
      expect(HOME_HREF).toBe('/');
      expect(ABOUT_HREF).toBe('/about');
      expect(FIND_MENTOR_HREF).toBe('/mentor-pool');
      expect(MAINTENANCE_HREF).toBe('/maintenance');
      expect(SIGNIN_HREF).toBe('/auth/signin');
      expect(DEFAULT_LOGIN).toBe('/auth/signin');
      expect(SIGNUP_HREF).toBe('/auth/signup');
      expect(ONBOARDING_HREF).toBe('/auth/onboarding');
      expect(PROFILE_CARD_HREF).toBe('/profile/card');
      expect(RESERVATION_INDEX_HREF).toBe('/reservation');
      expect(RESERVATION_MENTEE_HREF).toBe('/reservation/mentee');
      expect(RESERVATION_MENTOR_HREF).toBe('/reservation/mentor');
      expect(RESERVATION_HISTORY_HREF).toBe('/reservation/history');
      expect(API_AUTH_PREFIX).toBe('/api/auth');
      expect(apiAuthPrefix).toBe('/api/auth');
      expect(API_ANNOUNCEMENT_HREF).toBe('/api/announcement');
      expect(MENTOR_ONBOARDING_KEY).toBe('mentor-onboarding');
      expect(OPEN_SCHEDULE_DIALOG_KEY).toBe('open-schedule');
    });

    it('builds profile and mentor onboarding URLs consistently', () => {
      expect(getPublicProfileUrl('u1')).toBe('/profile/u1');
      expect(getPublicProfileUrl(42)).toBe('/profile/42');
      expect(getProfileEditUrl('u1')).toBe('/profile/u1/edit');
      expect(getProfileEditUrl(42)).toBe('/profile/42/edit');
      expect(getMentorOnboardingUrl('u1')).toBe(
        '/profile/u1/edit?mentor-onboarding=true'
      );
      expect(getBecomeMentorHref('u1')).toBe(
        '/profile/u1/edit?mentor-onboarding=true'
      );
      expect(getBecomeMentorHref(undefined)).toBe('/auth/signup');
      expect(getMentorScheduleManagementUrl('u1')).toBe(
        '/profile/u1?open-schedule=true'
      );
      expect(getOpenScheduleHref('u1')).toBe('/profile/u1?open-schedule=true');
      expect(getOpenScheduleHref(undefined)).toBe('/');
    });

    it('builds reservation role URLs and sanitized sign-in callback URLs', () => {
      expect(getReservationRoleUrl('mentee')).toBe('/reservation/mentee');
      expect(getReservationRoleUrl('mentor')).toBe('/reservation/mentor');
      expect(getSignInUrl()).toBe('/auth/signin');
      expect(getSignInUrl(null)).toBe('/auth/signin');
      expect(getSignInUrl('/maintenance')).toBe('/auth/signin');
      expect(getSignInUrl('/auth/signin')).toBe('/auth/signin');
      expect(
        getSignInUrl('/reservation/mentee?tab=history&reservationId=101')
      ).toBe(
        '/auth/signin?callbackUrl=%2Freservation%2Fmentee%3Ftab%3Dhistory%26reservationId%3D101'
      );
    });
  });

  describe('classifyPathname (table-driven)', () => {
    it.each([
      { pathname: '/_next/static/css/main.css', expectedKind: 'bypass' },
      { pathname: '/static/banner.png', expectedKind: 'bypass' },
      { pathname: '/assets/logo.svg', expectedKind: 'bypass' },
      { pathname: '/landing/hero.webp', expectedKind: 'bypass' },
      { pathname: '/favicon.ico', expectedKind: 'bypass' },
      { pathname: '/logo.svg', expectedKind: 'bypass' },
      { pathname: '/monitoring', expectedKind: 'bypass' },
      { pathname: '/monitoring/envelope', expectedKind: 'bypass' },
      { pathname: '/maintenance', expectedKind: 'maintenance' },
      { pathname: '/api/auth', expectedKind: 'api_auth' },
      { pathname: '/api/auth/session', expectedKind: 'api_auth' },
      { pathname: '/api/auth/callback/credentials', expectedKind: 'api_auth' },
      { pathname: '/api/announcement', expectedKind: 'api_public' },
      { pathname: '/api/mentors', expectedKind: 'api_protected' },
      { pathname: '/api/users/avatar.jpg', expectedKind: 'api_protected' },
      { pathname: '/auth/signin', expectedKind: 'auth_credentials' },
      { pathname: '/auth/signup', expectedKind: 'auth_credentials' },
      { pathname: '/auth/onboarding', expectedKind: 'onboarding' },
      {
        pathname: '/auth/google/callback/redirect',
        expectedKind: 'auth_public',
      },
      { pathname: '/auth/password-forgot', expectedKind: 'auth_public' },
      {
        pathname: '/auth/password-forgot-success',
        expectedKind: 'auth_public',
      },
      { pathname: '/auth/password-reset', expectedKind: 'auth_public' },
      { pathname: '/auth/password-reset-success', expectedKind: 'auth_public' },
      { pathname: '/auth/email-verify', expectedKind: 'auth_public' },
      { pathname: '/auth/email-verified', expectedKind: 'auth_public' },
      { pathname: '/', expectedKind: 'public' },
      { pathname: '/about', expectedKind: 'public' },
      { pathname: '/privacy', expectedKind: 'public' },
      { pathname: '/terms', expectedKind: 'public' },
      { pathname: '/mentor-pool', expectedKind: 'public' },
      { pathname: '/profile/42', expectedKind: 'public' },
      { pathname: '/profile/john.doe', expectedKind: 'public' },
      { pathname: '/profile/john.js', expectedKind: 'public' },
      { pathname: '/profile/graphic-design.svg', expectedKind: 'public' },
      { pathname: '/profile/card', expectedKind: 'protected' },
      { pathname: '/profile/42/edit', expectedKind: 'protected' },
      { pathname: '/reservation', expectedKind: 'protected' },
      { pathname: '/reservation/mentee', expectedKind: 'protected' },
      { pathname: '/reservation/mentor', expectedKind: 'protected' },
      { pathname: '/reservation/history', expectedKind: 'protected' },
      { pathname: '/unknown-future-route', expectedKind: 'protected' },
    ])(
      'classifies $pathname as $expectedKind',
      ({ pathname, expectedKind }) => {
        const result = classifyPathname(pathname);
        expect(result.kind).toBe(expectedKind);
      }
    );

    it('distinguishes /profile/card, /profile/:pageUserId/edit, and /profile/:pageUserId accurately', () => {
      expect(classifyPathname('/profile/card')).toEqual({
        kind: 'protected',
        pathname: '/profile/card',
        access: 'authenticated',
        requiresCompletedOnboarding: false,
      });

      expect(classifyPathname('/profile/99/edit')).toEqual({
        kind: 'protected',
        pathname: '/profile/99/edit',
        access: 'authenticated',
        requiresCompletedOnboarding: true,
        params: { pageUserId: '99' },
      });

      expect(classifyPathname('/profile/99')).toEqual({
        kind: 'public',
        pathname: '/profile/99',
        params: { pageUserId: '99' },
      });

      expect(classifyPathname('/reservation/mentor')).toEqual({
        kind: 'protected',
        pathname: '/reservation/mentor',
        access: 'mentor_only',
        requiresCompletedOnboarding: true,
      });
    });

    it('handles malformed percent-encoding without throwing URIError', () => {
      expect(() => classifyPathname('/profile/%E0%A4%A')).not.toThrow();
      expect(classifyPathname('/profile/%E0%A4%A')).toEqual({
        kind: 'public',
        pathname: '/profile/%E0%A4%A',
        params: { pageUserId: '%E0%A4%A' },
      });
    });
  });

  describe('shouldVerifyMiddlewareSession', () => {
    it.each([
      {
        pathname: '/_next/static/chunk.js',
        maintenance: false,
        expected: false,
      },
      { pathname: '/monitoring', maintenance: true, expected: false },
      { pathname: '/api/auth/session', maintenance: false, expected: false },
      { pathname: '/maintenance', maintenance: false, expected: false },
      { pathname: '/maintenance', maintenance: true, expected: false },
      { pathname: '/mentor-pool', maintenance: true, expected: false },
      { pathname: '/mentor-pool', maintenance: false, expected: true },
      { pathname: '/reservation/mentee', maintenance: false, expected: true },
      { pathname: '/profile/card', maintenance: false, expected: true },
    ])(
      'returns $expected for $pathname (maintenance=$maintenance)',
      ({ pathname, maintenance, expected }) => {
        expect(
          shouldVerifyMiddlewareSession(classifyPathname(pathname), maintenance)
        ).toBe(expected);
      }
    );
  });

  describe('evaluateMiddlewareGate (table-driven)', () => {
    describe('bypass routes', () => {
      it.each([
        '/_next/static/css/main.css',
        '/static/hero.png',
        '/assets/logo.svg',
        '/landing/cover.webp',
        '/favicon.ico',
        '/logo.svg',
        '/monitoring',
        '/monitoring/envelope',
      ])(
        'always lets %s pass through even under maintenance mode',
        (pathname) => {
          expect(
            evaluateMiddlewareGate({
              pathname,
              isInMaintenanceMode: true,
              session: VISITOR_SESSION,
            })
          ).toEqual({
            action: 'next',
            syncSessionHint: false,
          });
        }
      );
    });

    describe('maintenance mode', () => {
      it.each<{
        desc: string;
        pathname: string;
        isInMaintenanceMode: boolean;
        expected: MiddlewareGateDecision;
      }>([
        {
          desc: 'allows /maintenance when maintenance mode is active',
          pathname: '/maintenance',
          isInMaintenanceMode: true,
          expected: { action: 'next', syncSessionHint: false },
        },
        {
          desc: 'redirects normal pages to /maintenance when maintenance mode is active',
          pathname: '/mentor-pool',
          isInMaintenanceMode: true,
          expected: {
            action: 'redirect',
            destination: '/maintenance',
            syncSessionHint: false,
          },
        },
        {
          desc: 'redirects dynamic profile routes with dots to /maintenance when active',
          pathname: '/profile/john.doe',
          isInMaintenanceMode: true,
          expected: {
            action: 'redirect',
            destination: '/maintenance',
            syncSessionHint: false,
          },
        },
        {
          desc: 'returns 503 decision for /api/* routes when maintenance mode is active',
          pathname: '/api/mentors',
          isInMaintenanceMode: true,
          expected: { action: 'maintenance_api_503', syncSessionHint: false },
        },
        {
          desc: 'redirects /maintenance to / when maintenance mode is inactive',
          pathname: '/maintenance',
          isInMaintenanceMode: false,
          expected: {
            action: 'redirect',
            destination: '/',
            syncSessionHint: false,
          },
        },
      ])('$desc', ({ pathname, isInMaintenanceMode, expected }) => {
        expect(
          evaluateMiddlewareGate({
            pathname,
            isInMaintenanceMode,
            session: MENTOR_SESSION,
          })
        ).toEqual(expected);
      });
    });

    describe('visitor (unauthenticated)', () => {
      it.each<{
        pathname: string;
        search?: string;
        expected: MiddlewareGateDecision;
      }>([
        {
          pathname: '/',
          expected: { action: 'next', syncSessionHint: true },
        },
        {
          pathname: '/mentor-pool',
          expected: { action: 'next', syncSessionHint: true },
        },
        {
          pathname: '/profile/42',
          expected: { action: 'next', syncSessionHint: true },
        },
        {
          pathname: '/auth/signin',
          expected: { action: 'next', syncSessionHint: true },
        },
        {
          pathname: '/auth/signup',
          expected: { action: 'next', syncSessionHint: true },
        },
        {
          pathname: '/api/announcement',
          expected: { action: 'next', syncSessionHint: true },
        },
        {
          pathname: '/api/auth/session',
          expected: { action: 'next', syncSessionHint: false },
        },
        {
          pathname: '/auth/onboarding',
          expected: {
            action: 'redirect',
            destination: '/auth/signin',
            syncSessionHint: false,
          },
        },
        {
          pathname: '/profile/card',
          expected: {
            action: 'redirect',
            destination: '/auth/signin?callbackUrl=%2Fprofile%2Fcard',
            syncSessionHint: false,
          },
        },
        {
          pathname: '/profile/42/edit',
          expected: {
            action: 'redirect',
            destination: '/auth/signin?callbackUrl=%2Fprofile%2F42%2Fedit',
            syncSessionHint: false,
          },
        },
        {
          pathname: '/reservation/mentee',
          search: '?tab=history&reservationId=101',
          expected: {
            action: 'redirect',
            destination:
              '/auth/signin?callbackUrl=%2Freservation%2Fmentee%3Ftab%3Dhistory%26reservationId%3D101',
            syncSessionHint: false,
          },
        },
        {
          pathname: '/reservation/mentor',
          expected: {
            action: 'redirect',
            destination: '/auth/signin?callbackUrl=%2Freservation%2Fmentor',
            syncSessionHint: false,
          },
        },
        {
          pathname: '/api/protected-endpoint',
          expected: {
            action: 'redirect',
            destination: '/auth/signin',
            syncSessionHint: false,
          },
        },
      ])(
        'evaluates visitor request to $pathname$search',
        ({ pathname, search, expected }) => {
          expect(
            evaluateMiddlewareGate({
              pathname,
              search,
              session: VISITOR_SESSION,
            })
          ).toEqual(expected);
        }
      );
    });

    describe('mentee with onBoarding: false', () => {
      it.each<{
        pathname: string;
        method?: string;
        expected: MiddlewareGateDecision;
      }>([
        {
          pathname: '/auth/onboarding',
          expected: { action: 'next', syncSessionHint: true },
        },
        {
          pathname: '/auth/signin',
          expected: {
            action: 'redirect',
            destination: '/auth/onboarding',
            syncSessionHint: false,
          },
        },
        {
          pathname: '/auth/signup',
          expected: {
            action: 'redirect',
            destination: '/auth/onboarding',
            syncSessionHint: false,
          },
        },
        {
          pathname: '/auth/signin',
          method: 'POST',
          expected: { action: 'next', syncSessionHint: false },
        },
        {
          pathname: '/reservation/mentee',
          expected: {
            action: 'redirect',
            destination: '/auth/onboarding',
            syncSessionHint: false,
          },
        },
        {
          pathname: '/reservation/mentor',
          expected: {
            action: 'redirect',
            destination: '/auth/onboarding',
            syncSessionHint: false,
          },
        },
        {
          pathname: '/profile/42/edit',
          expected: {
            action: 'redirect',
            destination: '/auth/onboarding',
            syncSessionHint: false,
          },
        },
        {
          pathname: '/profile/card',
          expected: { action: 'next', syncSessionHint: true },
        },
        {
          pathname: '/mentor-pool',
          expected: { action: 'next', syncSessionHint: true },
        },
      ])(
        'evaluates incomplete-onboarding mentee ($method $pathname)',
        ({ pathname, method, expected }) => {
          expect(
            evaluateMiddlewareGate({
              pathname,
              method,
              session: MENTEE_INCOMPLETE_ONBOARDING,
            })
          ).toEqual(expected);
        }
      );
    });

    describe('mentee with onBoarding: true', () => {
      it.each<{
        pathname: string;
        expected: MiddlewareGateDecision;
      }>([
        {
          pathname: '/auth/onboarding',
          expected: {
            action: 'redirect',
            destination: '/',
            syncSessionHint: false,
          },
        },
        {
          pathname: '/auth/signin',
          expected: {
            action: 'redirect',
            destination: '/',
            syncSessionHint: false,
          },
        },
        {
          pathname: '/auth/signup',
          expected: {
            action: 'redirect',
            destination: '/',
            syncSessionHint: false,
          },
        },
        {
          pathname: '/reservation/mentee',
          expected: { action: 'next', syncSessionHint: true },
        },
        {
          pathname: '/reservation/history',
          expected: { action: 'next', syncSessionHint: true },
        },
        {
          pathname: '/reservation/mentor',
          expected: {
            action: 'redirect',
            destination: '/reservation/mentee',
            syncSessionHint: false,
          },
        },
        {
          pathname: '/profile/card',
          expected: { action: 'next', syncSessionHint: true },
        },
        {
          pathname: '/profile/42/edit',
          expected: { action: 'next', syncSessionHint: true },
        },
      ])(
        'evaluates onboarded mentee request to $pathname',
        ({ pathname, expected }) => {
          expect(
            evaluateMiddlewareGate({
              pathname,
              session: MENTEE_ONBOARDED,
            })
          ).toEqual(expected);
        }
      );
    });

    describe('mentor (isMentor: true, onBoarding: true)', () => {
      it.each<{
        pathname: string;
        expected: MiddlewareGateDecision;
      }>([
        {
          pathname: '/reservation/mentor',
          expected: { action: 'next', syncSessionHint: true },
        },
        {
          pathname: '/reservation/mentee',
          expected: { action: 'next', syncSessionHint: true },
        },
        {
          pathname: '/profile/card',
          expected: { action: 'next', syncSessionHint: true },
        },
        {
          pathname: '/auth/onboarding',
          expected: {
            action: 'redirect',
            destination: '/',
            syncSessionHint: false,
          },
        },
        {
          pathname: '/auth/signin',
          expected: {
            action: 'redirect',
            destination: '/',
            syncSessionHint: false,
          },
        },
      ])('evaluates mentor request to $pathname', ({ pathname, expected }) => {
        expect(
          evaluateMiddlewareGate({
            pathname,
            session: MENTOR_SESSION,
          })
        ).toEqual(expected);
      });
    });
  });

  describe('resolveAuthSurfaceRedirect (table-driven)', () => {
    it.each([
      { surface: 'sign_shell' as const, user: null, expected: null },
      {
        surface: 'sign_shell' as const,
        user: { id: '1', onBoarding: false },
        expected: null,
      },
      {
        surface: 'sign_shell' as const,
        user: { id: '1', onBoarding: true },
        expected: '/',
      },
      {
        surface: 'sign_shell' as const,
        user: { id: '1' },
        expected: '/',
      },
      { surface: 'credentials' as const, user: null, expected: null },
      {
        surface: 'credentials' as const,
        user: { id: '1', onBoarding: false },
        expected: '/auth/onboarding',
      },
      {
        surface: 'credentials' as const,
        user: { id: '1', onBoarding: true },
        expected: '/',
      },
      {
        surface: 'onboarding' as const,
        user: null,
        expected: '/auth/signin',
      },
      {
        surface: 'onboarding' as const,
        user: { id: '1', onBoarding: false },
        expected: null,
      },
      {
        surface: 'onboarding' as const,
        user: { id: '1', onBoarding: true },
        expected: '/',
      },
    ])(
      'resolves $surface with user=$user to $expected',
      ({ surface, user, expected }) => {
        expect(resolveAuthSurfaceRedirect(surface, user)).toBe(expected);
      }
    );
  });

  describe('sanitizeCallbackUrl and isDisallowedCallbackPathname (table-driven)', () => {
    it.each([
      { pathname: '/maintenance', expected: true },
      { pathname: '/maintenance/status', expected: true },
      { pathname: '/auth', expected: true },
      { pathname: '/auth/signin', expected: true },
      { pathname: '/auth/signup', expected: true },
      { pathname: '/auth/onboarding', expected: true },
      { pathname: '/api', expected: true },
      { pathname: '/api/auth/session', expected: true },
      { pathname: '/monitoring', expected: true },
      { pathname: '/_next/static/chunk.js', expected: true },
      { pathname: '/favicon.ico', expected: true },
      { pathname: '//evil.example.com', expected: true },
      { pathname: 'relative-without-slash', expected: true },
      { pathname: '/', expected: false },
      { pathname: '/mentor-pool', expected: false },
      { pathname: '/profile/card', expected: false },
      { pathname: '/profile/42', expected: false },
      { pathname: '/reservation/mentee', expected: false },
      { pathname: '/reservation/mentor', expected: false },
    ])(
      'isDisallowedCallbackPathname($pathname) -> $expected',
      ({ pathname, expected }) => {
        expect(isDisallowedCallbackPathname(pathname)).toBe(expected);
      }
    );

    it.each([
      {
        raw: '/reservation/mentee?tab=history&reservationId=101#card',
        origin: undefined,
        expected: '/reservation/mentee?tab=history&reservationId=101#card',
      },
      {
        raw: 'https://x-talent.example.com/mentor-pool?topic=frontend',
        origin: 'https://x-talent.example.com',
        expected: '/mentor-pool?topic=frontend',
      },
      { raw: '/maintenance', origin: undefined, expected: null },
      { raw: '/maintenance?from=home', origin: undefined, expected: null },
      {
        raw: 'https://x-talent.example.com/maintenance',
        origin: 'https://x-talent.example.com',
        expected: null,
      },
      { raw: '/auth/signin', origin: undefined, expected: null },
      { raw: '/auth/signup', origin: undefined, expected: null },
      { raw: '/auth/onboarding', origin: undefined, expected: null },
      { raw: '/api/auth/session', origin: undefined, expected: null },
      { raw: '/monitoring', origin: undefined, expected: null },
      {
        raw: 'https://evil.example.com/mentor-pool',
        origin: 'https://x-talent.example.com',
        expected: null,
      },
      { raw: '//evil.example.com/phish', origin: undefined, expected: null },
      {
        raw: `/${String.fromCharCode(92)}evil.example.com`,
        origin: undefined,
        expected: null,
      },
      { raw: 'javascript:alert(1)', origin: undefined, expected: null },
    ])(
      'sanitizeCallbackUrl($raw, $origin) -> $expected',
      ({ raw, origin, expected }) => {
        expect(sanitizeCallbackUrl(raw, origin)).toBe(expected);
      }
    );
  });
});
