import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearPendingCallbackUrl,
  consumePendingCallbackUrl,
  PENDING_AUTH_CALLBACK_URL_KEY,
  persistPendingCallbackUrlFromSearch,
  sanitizeCallbackUrl,
} from './callbackUrl';

describe('callbackUrl helpers (#733)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  describe('sanitizeCallbackUrl', () => {
    it('preserves relative internal paths along with full query string and hash', () => {
      expect(
        sanitizeCallbackUrl('/reservation/mentee?tab=history&reservationId=101')
      ).toBe('/reservation/mentee?tab=history&reservationId=101');

      expect(
        sanitizeCallbackUrl(
          '/reservation/mentor?tab=history&reservationId=202#card'
        )
      ).toBe('/reservation/mentor?tab=history&reservationId=202#card');
    });

    it('accepts same-origin absolute URLs and normalizes them to path + query + hash', () => {
      expect(
        sanitizeCallbackUrl(
          'https://x-talent.example.com/reservation/mentee?tab=history&reservationId=88',
          'https://x-talent.example.com'
        )
      ).toBe('/reservation/mentee?tab=history&reservationId=88');
    });

    it('rejects external origins, protocol-relative URLs, backslash tricks, and dangerous schemes', () => {
      const backslashPayload = `/${String.fromCharCode(92)}evil.example.com`;
      expect(
        sanitizeCallbackUrl(
          'https://evil.example.com/reservation/mentee',
          'https://x-talent.example.com'
        )
      ).toBeNull();
      expect(sanitizeCallbackUrl('//evil.example.com/phish')).toBeNull();
      expect(sanitizeCallbackUrl('/foo/..//evil.example.com')).toBeNull();
      expect(sanitizeCallbackUrl('/foo/..//evil.example.com/phish')).toBeNull();
      expect(
        sanitizeCallbackUrl(
          'https://x-talent.example.com//evil.example.com',
          'https://x-talent.example.com'
        )
      ).toBeNull();
      expect(
        sanitizeCallbackUrl(
          'https://x-talent.example.com/foo/..//evil.example.com',
          'https://x-talent.example.com'
        )
      ).toBeNull();
      expect(sanitizeCallbackUrl(backslashPayload)).toBeNull();
      expect(sanitizeCallbackUrl('javascript:alert(1)')).toBeNull();
      expect(sanitizeCallbackUrl('data:text/html,hello')).toBeNull();
      expect(sanitizeCallbackUrl('')).toBeNull();
      expect(sanitizeCallbackUrl(null)).toBeNull();
      expect(sanitizeCallbackUrl(undefined)).toBeNull();
    });

    it('rejects /auth/* and /api/* paths to prevent post-login redirect loops', () => {
      expect(sanitizeCallbackUrl('/auth/signin')).toBeNull();
      expect(
        sanitizeCallbackUrl('/auth/signin?callbackUrl=/mentor-pool')
      ).toBeNull();
      expect(sanitizeCallbackUrl('/auth/signup')).toBeNull();
      expect(sanitizeCallbackUrl('/api/auth/session')).toBeNull();
    });
  });

  describe('pending OAuth callbackUrl storage', () => {
    it('persists and consumes a valid callbackUrl once from sessionStorage', () => {
      persistPendingCallbackUrlFromSearch(
        '?callbackUrl=%2Freservation%2Fmentee%3Ftab%3Dhistory%26reservationId%3D101',
        'http://localhost:3000'
      );

      expect(window.sessionStorage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)).toBe(
        '/reservation/mentee?tab=history&reservationId=101'
      );

      expect(consumePendingCallbackUrl('http://localhost:3000')).toBe(
        '/reservation/mentee?tab=history&reservationId=101'
      );
      // Consumed once — subsequent call returns null
      expect(consumePendingCallbackUrl('http://localhost:3000')).toBeNull();
    });

    it('clears stale sessionStorage entry when search has an unsafe or missing callbackUrl', () => {
      window.sessionStorage.setItem(
        PENDING_AUTH_CALLBACK_URL_KEY,
        '/reservation/mentee?tab=history'
      );

      persistPendingCallbackUrlFromSearch('?callbackUrl=//evil.example.com');
      expect(
        window.sessionStorage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)
      ).toBeNull();

      window.sessionStorage.setItem(
        PENDING_AUTH_CALLBACK_URL_KEY,
        '/reservation/mentor?tab=history'
      );
      clearPendingCallbackUrl();
      expect(
        window.sessionStorage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)
      ).toBeNull();
    });
  });
});
