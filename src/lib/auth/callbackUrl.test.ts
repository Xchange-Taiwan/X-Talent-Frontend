import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearPendingCallbackUrl,
  consumePendingCallbackUrl,
  readWindowCallbackUrl,
  resolvePostLoginRedirect,
  sanitizeCallbackUrl,
  savePendingCallbackUrl,
} from './callbackUrl';

describe('callbackUrl helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  describe('sanitizeCallbackUrl', () => {
    it('preserves safe internal reservation session_link paths with query params', () => {
      expect(
        sanitizeCallbackUrl(
          '/reservation/mentor?tab=history&reservation_id=501'
        )
      ).toBe('/reservation/mentor?tab=history&reservation_id=501');
    });

    it('rejects external origins, protocol-relative URLs, dot-segment // bypasses, auth loops, and api endpoints', () => {
      const backslashUrl = `/${String.fromCharCode(92)}evil.com`;
      expect(sanitizeCallbackUrl(null)).toBeNull();
      expect(sanitizeCallbackUrl('')).toBeNull();
      expect(sanitizeCallbackUrl('https://evil.com/reservation')).toBeNull();
      expect(sanitizeCallbackUrl('//evil.com/reservation')).toBeNull();
      expect(sanitizeCallbackUrl('/.//evil.com')).toBeNull();
      expect(sanitizeCallbackUrl('/..//evil.com')).toBeNull();
      expect(sanitizeCallbackUrl('/reservation/../..//evil.com')).toBeNull();
      expect(sanitizeCallbackUrl(backslashUrl)).toBeNull();
      expect(sanitizeCallbackUrl('/auth/signin')).toBeNull();
      expect(sanitizeCallbackUrl('/auth/onboarding')).toBeNull();
      expect(sanitizeCallbackUrl('/api/protected')).toBeNull();
    });
  });

  describe('resolvePostLoginRedirect', () => {
    it('always prioritizes /auth/onboarding when onBoarding is false', () => {
      expect(
        resolvePostLoginRedirect({
          onBoarding: false,
          callbackUrl: '/reservation/mentor?tab=history&reservation_id=501',
        })
      ).toBe('/auth/onboarding');
    });

    it('returns sanitized callbackUrl when onboarding is completed and falls back to /mentor-pool', () => {
      expect(
        resolvePostLoginRedirect({
          onBoarding: true,
          callbackUrl: '/reservation/mentor?tab=history&reservation_id=501',
        })
      ).toBe('/reservation/mentor?tab=history&reservation_id=501');

      expect(
        resolvePostLoginRedirect({
          onBoarding: true,
          callbackUrl: 'https://evil.com',
        })
      ).toBe('/mentor-pool');

      expect(
        resolvePostLoginRedirect({
          onBoarding: true,
          callbackUrl: '/.//evil.com',
        })
      ).toBe('/mentor-pool');

      expect(
        resolvePostLoginRedirect({
          onBoarding: true,
          callbackUrl: '/..//evil.com',
        })
      ).toBe('/mentor-pool');

      expect(resolvePostLoginRedirect({ onBoarding: true })).toBe(
        '/mentor-pool'
      );
    });
  });

  describe('window & sessionStorage persistence', () => {
    it('reads callbackUrl from window.location.search and manages pending sessionStorage entry', () => {
      window.history.replaceState(
        {},
        '',
        '/auth/signin?callbackUrl=%2Freservation%2Fmentor%3Ftab%3Dhistory%26reservation_id%3D88'
      );

      expect(readWindowCallbackUrl()).toBe(
        '/reservation/mentor?tab=history&reservation_id=88'
      );

      savePendingCallbackUrl(readWindowCallbackUrl());
      expect(consumePendingCallbackUrl()).toBe(
        '/reservation/mentor?tab=history&reservation_id=88'
      );
      expect(consumePendingCallbackUrl()).toBeNull();

      savePendingCallbackUrl('/reservation/mentor?tab=history');
      clearPendingCallbackUrl();
      expect(consumePendingCallbackUrl()).toBeNull();
    });

    it('degrades gracefully without throwing when sessionStorage throws SecurityError', () => {
      const setItemSpy = vi
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation(() => {
          throw new DOMException('Blocked', 'SecurityError');
        });
      const getItemSpy = vi
        .spyOn(Storage.prototype, 'getItem')
        .mockImplementation(() => {
          throw new DOMException('Blocked', 'SecurityError');
        });
      const removeItemSpy = vi
        .spyOn(Storage.prototype, 'removeItem')
        .mockImplementation(() => {
          throw new DOMException('Blocked', 'SecurityError');
        });

      try {
        expect(() =>
          savePendingCallbackUrl('/reservation/mentor?tab=history')
        ).not.toThrow();
        expect(consumePendingCallbackUrl()).toBeNull();
        expect(() => clearPendingCallbackUrl()).not.toThrow();
      } finally {
        setItemSpy.mockRestore();
        getItemSpy.mockRestore();
        removeItemSpy.mockRestore();
      }
    });
  });
});
