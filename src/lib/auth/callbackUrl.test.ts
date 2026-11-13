import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearPendingSignInCallbackUrl,
  consumePendingSignInCallbackUrl,
  sanitizeCallbackUrl,
  setPendingSignInCallbackUrl,
} from './callbackUrl';

const BACKSLASH = String.fromCharCode(92);
const NEWLINE = String.fromCharCode(10);

describe('callbackUrl helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe('sanitizeCallbackUrl', () => {
    it('preserves valid internal paths and query parameters', () => {
      expect(
        sanitizeCallbackUrl('/reservation/mentor?tab=history&reservationId=401')
      ).toBe('/reservation/mentor?tab=history&reservationId=401');
    });

    it('normalizes same-origin absolute URLs while preserving full query parameters and hash (#734)', () => {
      const origin = window.location.origin;
      expect(
        sanitizeCallbackUrl(
          `${origin}/reservation/mentor?tab=history&reservationId=401#feedback`
        )
      ).toBe('/reservation/mentor?tab=history&reservationId=401#feedback');

      expect(
        sanitizeCallbackUrl(
          'https://xtalent.tw/reservation/mentor?tab=history&reservationId=408',
          '/mentor-pool',
          'https://xtalent.tw'
        )
      ).toBe('/reservation/mentor?tab=history&reservationId=408');
    });

    it('falls back to /mentor-pool when input is empty, missing, or root path (relative or same-origin)', () => {
      const origin = window.location.origin;
      expect(sanitizeCallbackUrl(null)).toBe('/mentor-pool');
      expect(sanitizeCallbackUrl(undefined)).toBe('/mentor-pool');
      expect(sanitizeCallbackUrl('   ')).toBe('/mentor-pool');
      expect(sanitizeCallbackUrl('/')).toBe('/mentor-pool');
      expect(sanitizeCallbackUrl(`${origin}/`)).toBe('/mentor-pool');
    });

    it('rejects cross-origin URLs, port/subdomain mismatches, userinfo tricks, protocol-relative URLs, backslashes, and control chars', () => {
      expect(sanitizeCallbackUrl('https://evil.example/phish')).toBe(
        '/mentor-pool'
      );
      expect(
        sanitizeCallbackUrl(
          'https://evil.xtalent.tw/reservation/mentor?reservationId=401',
          '/mentor-pool',
          'https://xtalent.tw'
        )
      ).toBe('/mentor-pool');
      expect(
        sanitizeCallbackUrl(
          'http://localhost:4000/reservation/mentor?reservationId=401',
          '/mentor-pool',
          'http://localhost:3000'
        )
      ).toBe('/mentor-pool');
      expect(
        sanitizeCallbackUrl(
          'https://user:pass@xtalent.tw/reservation/mentor?reservationId=401',
          '/mentor-pool',
          'https://xtalent.tw'
        )
      ).toBe('/mentor-pool');
      expect(sanitizeCallbackUrl('javascript:alert(1)')).toBe('/mentor-pool');
      expect(sanitizeCallbackUrl('//evil.example/phish')).toBe('/mentor-pool');
      expect(sanitizeCallbackUrl(`/${BACKSLASH}evil.example/phish`)).toBe(
        '/mentor-pool'
      );
      expect(
        sanitizeCallbackUrl(`/reservation/mentor${NEWLINE}Set-Cookie: bad`)
      ).toBe('/mentor-pool');
    });

    it('rejects dot-segment protocol-relative bypasses (#734)', () => {
      expect(sanitizeCallbackUrl('/.//evil.com')).toBe('/mentor-pool');
      expect(sanitizeCallbackUrl('/..//evil.com')).toBe('/mentor-pool');
      expect(sanitizeCallbackUrl(`/./${BACKSLASH}evil.com`)).toBe(
        '/mentor-pool'
      );
      expect(
        sanitizeCallbackUrl(
          'https://xtalent.tw//evil.com',
          '/mentor-pool',
          'https://xtalent.tw'
        )
      ).toBe('/mentor-pool');
    });

    it('rejects /auth/* and /api/* paths on both relative and same-origin absolute URLs', () => {
      const origin = window.location.origin;
      expect(sanitizeCallbackUrl('/auth/signin')).toBe('/mentor-pool');
      expect(sanitizeCallbackUrl(`${origin}/auth/signin`)).toBe('/mentor-pool');
      expect(
        sanitizeCallbackUrl('/auth/signin?callbackUrl=%2Freservation%2Fmentor')
      ).toBe('/mentor-pool');
      expect(sanitizeCallbackUrl('/api/auth/session')).toBe('/mentor-pool');
      expect(sanitizeCallbackUrl(`${origin}/api/auth/session`)).toBe(
        '/mentor-pool'
      );
    });
  });

  describe('pending sign-in callbackUrl storage', () => {
    it('stores relative and same-origin absolute URLs normalized as internal paths, consumes once, and falls back afterwards', () => {
      const origin = window.location.origin;
      setPendingSignInCallbackUrl(
        `${origin}/reservation/mentor?tab=history&reservationId=401`
      );

      expect(consumePendingSignInCallbackUrl()).toBe(
        '/reservation/mentor?tab=history&reservationId=401'
      );
      expect(consumePendingSignInCallbackUrl()).toBe('/mentor-pool');
    });

    it('clears stored value when invalid URL or clearPendingSignInCallbackUrl is called', () => {
      setPendingSignInCallbackUrl('/reservation/mentee?tab=history');
      setPendingSignInCallbackUrl('//evil.example');
      expect(consumePendingSignInCallbackUrl()).toBe('/mentor-pool');

      setPendingSignInCallbackUrl('/reservation/mentee?tab=history');
      clearPendingSignInCallbackUrl();
      expect(consumePendingSignInCallbackUrl()).toBe('/mentor-pool');
    });
  });
});
