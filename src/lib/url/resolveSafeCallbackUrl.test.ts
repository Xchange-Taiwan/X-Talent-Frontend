import { beforeEach, describe, expect, it } from 'vitest';

import {
  consumePostLoginCallbackUrl,
  extractSafeCallbackUrl,
  POST_LOGIN_CALLBACK_URL_KEY,
  resolveSafeCallbackUrl,
  savePostLoginCallbackUrl,
} from './resolveSafeCallbackUrl';

describe('resolveSafeCallbackUrl (#733)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('preserves valid internal paths with query parameters', () => {
    expect(
      extractSafeCallbackUrl('/reservation/history?reservation_id=101')
    ).toBe('/reservation/history?reservation_id=101');
    expect(
      resolveSafeCallbackUrl(
        '/reservation/mentee?tab=history&reservation_id=42'
      )
    ).toBe('/reservation/mentee?tab=history&reservation_id=42');
  });

  it('rejects external URLs, protocol-relative URLs, backslash URLs, dot-segment bypasses, and auth/api routes', () => {
    const backslashPrefix = `/${String.fromCharCode(92)}evil.com`;
    const dotBackslashPrefix = `/.${String.fromCharCode(92)}evil.com`;
    const doubleDotBackslashPrefix = `/..${String.fromCharCode(92)}evil.com`;
    for (const unsafeUrl of [
      null,
      undefined,
      '',
      '   ',
      'https://evil.com/phish',
      'http://evil.com',
      '//evil.com/path',
      '/.//evil.com',
      '/..//evil.com',
      '/%2e//evil.com',
      backslashPrefix,
      dotBackslashPrefix,
      doubleDotBackslashPrefix,
      'javascript:alert(1)',
      '/auth/signin',
      '/auth/signup?foo=1',
      '/foo/../auth/signin',
      '/api/auth/session',
      '/maintenance',
    ]) {
      expect(extractSafeCallbackUrl(unsafeUrl)).toBeNull();
      expect(resolveSafeCallbackUrl(unsafeUrl, '/mentor-pool')).toBe(
        '/mentor-pool'
      );
    }
  });

  it('persists and consumes safe callback URLs in sessionStorage once', () => {
    savePostLoginCallbackUrl('/reservation/history?reservation_id=88');
    expect(window.sessionStorage.getItem(POST_LOGIN_CALLBACK_URL_KEY)).toBe(
      '/reservation/history?reservation_id=88'
    );

    expect(consumePostLoginCallbackUrl()).toBe(
      '/reservation/history?reservation_id=88'
    );
    expect(consumePostLoginCallbackUrl()).toBeNull();
  });

  it('clears sessionStorage when given an unsafe callbackUrl', () => {
    savePostLoginCallbackUrl('/reservation/history?reservation_id=88');
    savePostLoginCallbackUrl('https://evil.com');

    expect(
      window.sessionStorage.getItem(POST_LOGIN_CALLBACK_URL_KEY)
    ).toBeNull();
  });
});
