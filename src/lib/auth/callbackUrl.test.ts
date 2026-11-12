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

    it('falls back to /mentor-pool when input is empty or missing', () => {
      expect(sanitizeCallbackUrl(null)).toBe('/mentor-pool');
      expect(sanitizeCallbackUrl(undefined)).toBe('/mentor-pool');
      expect(sanitizeCallbackUrl('   ')).toBe('/mentor-pool');
      expect(sanitizeCallbackUrl('/')).toBe('/mentor-pool');
    });

    it('rejects external URLs, protocol-relative URLs, backslash tricks, and control chars', () => {
      expect(sanitizeCallbackUrl('https://evil.example/phish')).toBe(
        '/mentor-pool'
      );
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
    });

    it('rejects /auth/* and /api/* paths to prevent sign-in loops and API redirects', () => {
      expect(sanitizeCallbackUrl('/auth/signin')).toBe('/mentor-pool');
      expect(
        sanitizeCallbackUrl('/auth/signin?callbackUrl=%2Freservation%2Fmentor')
      ).toBe('/mentor-pool');
      expect(sanitizeCallbackUrl('/api/auth/session')).toBe('/mentor-pool');
    });
  });

  describe('pending sign-in callbackUrl storage', () => {
    it('stores, consumes once, and falls back after consumption', () => {
      setPendingSignInCallbackUrl(
        '/reservation/mentor?tab=history&reservationId=401'
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
