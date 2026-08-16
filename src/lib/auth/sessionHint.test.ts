import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearSessionHint,
  decodeSessionHint,
  DOM_AUTH_AVATAR_ATTR,
  DOM_AUTH_STATE_ATTR,
  encodeSessionHint,
  readCookie,
  resolveIdentity,
  safeDecodeURIComponent,
  SESSION_HINT_COOKIE,
  SESSION_HINT_INLINE_SCRIPT,
} from './sessionHint';

describe('sessionHint utilities', () => {
  describe('encodeSessionHint', () => {
    it('serializes a mentor flag and an avatar URL', () => {
      expect(
        encodeSessionHint({
          isMentor: true,
          avatar: 'https://example.com/avatar.png',
        })
      ).toBe('1||https%3A%2F%2Fexample.com%2Favatar.png');
    });

    it('serializes a mentor flag, userId, and an avatar URL', () => {
      expect(
        encodeSessionHint({
          isMentor: true,
          userId: 'user-123',
          avatar: 'https://example.com/avatar.png',
        })
      ).toBe('1|user-123|https%3A%2F%2Fexample.com%2Favatar.png');
    });

    it('serializes a mentor flag and userId without an avatar', () => {
      expect(encodeSessionHint({ isMentor: true, userId: 'user-123' })).toBe(
        '1|user-123'
      );
    });

    it('omits avatar and userId when not provided', () => {
      expect(encodeSessionHint({ isMentor: false })).toBe('0');
    });

    it('caps avatar URL length by completely omitting long avatar URLs', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2000) + '.png';
      const encoded = encodeSessionHint({
        isMentor: true,
        userId: 'user-123',
        avatar: longUrl,
      });
      expect(encoded).toBe('1|user-123');
    });

    it('falls back to mentor status only when the avatar URL contains an unencodable lone surrogate', () => {
      const encoded = encodeSessionHint({
        isMentor: true,
        avatar: 'https://example.com/\uD800avatar.png',
      });
      expect(encoded).toBe('1');
    });
  });

  describe('decodeSessionHint', () => {
    it('resolves valid cookie containing avatar URL', () => {
      expect(
        decodeSessionHint('1||https%3A%2F%2Fexample.com%2Favatar.png')
      ).toEqual({
        isMentor: true,
        avatar: 'https://example.com/avatar.png',
      });
    });

    it('resolves valid cookie with mentor flag only', () => {
      expect(decodeSessionHint('1')).toEqual({ isMentor: true });
      expect(decodeSessionHint('0')).toEqual({ isMentor: false });
    });

    it('resolves valid cookie containing userId and an avatar URL', () => {
      expect(
        decodeSessionHint('1|user-123|https%3A%2F%2Fexample.com%2Favatar.png')
      ).toEqual({
        isMentor: true,
        userId: 'user-123',
        avatar: 'https://example.com/avatar.png',
      });
    });

    it('resolves valid cookie with userId only', () => {
      expect(decodeSessionHint('1|user-123')).toEqual({
        isMentor: true,
        userId: 'user-123',
      });
    });

    it('filters out unsafe protocol (scheme) avatars during decoding', () => {
      expect(decodeSessionHint('1||javascript%3Aalert(1)')).toEqual({
        isMentor: true,
      });
      expect(decodeSessionHint('1||data%3Atext%2Fhtml%2Calert(1)')).toEqual({
        isMentor: true,
      });
    });

    it('recovers from uri decode errors gracefully', () => {
      expect(
        decodeSessionHint('1||https%3A%2F%2Fexample.com%2F%invalid')
      ).toEqual({
        isMentor: true,
      });
    });

    it('discards avatar URL from being parsed as userId in legacy format to ensure backward compatibility', () => {
      expect(
        decodeSessionHint('1|https%3A%2F%2Fexample.com%2Favatar.png')
      ).toEqual({
        isMentor: true,
      });
    });

    it('returns null on falsy/garbage inputs', () => {
      expect(decodeSessionHint(null as never)).toBeNull();
      expect(decodeSessionHint(undefined)).toBeNull();
      expect(decodeSessionHint('')).toBeNull();
      expect(decodeSessionHint('garbage')).toBeNull();
      expect(decodeSessionHint('garbage|url')).toBeNull();
    });
  });

  describe('safeDecodeURIComponent', () => {
    it('returns decoded value when valid', () => {
      expect(safeDecodeURIComponent('hello%20world')).toBe('hello world');
    });

    it('returns raw value on malformed URI error', () => {
      expect(safeDecodeURIComponent('%invalid')).toBe('%invalid');
    });
  });

  describe('readCookie', () => {
    beforeEach(() => {
      // Clear cookies before each test
      document.cookie = `${SESSION_HINT_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      document.cookie = 'other-cookie=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    });

    it('returns undefined when cookie is not present', () => {
      expect(readCookie('non-existent')).toBeUndefined();
    });

    it('reads and decodes a simple cookie value', () => {
      document.cookie = 'test-cookie=hello%20world';
      expect(readCookie('test-cookie')).toBe('hello world');
    });

    it('reads the correct cookie among multiple cookies', () => {
      document.cookie = 'first-cookie=first-val';
      document.cookie = 'second-cookie=second-val';
      expect(readCookie('second-cookie')).toBe('second-val');
    });

    it('falls back to raw value on decode failure', () => {
      document.cookie = 'bad-cookie=%invalid';
      expect(readCookie('bad-cookie')).toBe('%invalid');
    });
  });

  describe('SESSION_HINT_INLINE_SCRIPT', () => {
    const runInlineScript = () => {
      // Execute the exported inline script in JSDOM
      // eslint-disable-next-line no-eval
      eval(SESSION_HINT_INLINE_SCRIPT);
    };

    beforeEach(() => {
      // Clear data attributes, cookies, and style property
      document.cookie = `${SESSION_HINT_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      document.documentElement.removeAttribute(DOM_AUTH_STATE_ATTR);
      document.documentElement.removeAttribute(DOM_AUTH_AVATAR_ATTR);
      document.documentElement.style.removeProperty('--auth-avatar');
      document.body.innerHTML = '';
    });

    it('sets state attribute for mentor with avatar and pre-fills style property with quote escaping', () => {
      document.cookie = `${SESSION_HINT_COOKIE}=1||https%3A%2F%2Fexample.com%2Favatar.png%22%3Bbackground%3Ared`;

      runInlineScript();

      expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
        'mentor'
      );
      expect(document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)).toBe(
        'https://example.com/avatar.png";background:red'
      );

      // Verify quotes are escaped to %22 to completely block CSS Injection breakout
      expect(
        document.documentElement.style.getPropertyValue('--auth-avatar')
      ).toBe('url("https://example.com/avatar.png%22;background:red")');
    });

    it('sets state attribute for mentee without avatar', () => {
      document.cookie = `${SESSION_HINT_COOKIE}=0`;

      runInlineScript();

      expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
        'mentee'
      );
      expect(
        document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)
      ).toBeNull();
    });

    it('filters out unsafe protocols in the inline script', () => {
      document.cookie = `${SESSION_HINT_COOKIE}=1||javascript%3Aalert(1)`;

      runInlineScript();

      expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
        'mentor'
      );
      expect(
        document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)
      ).toBeNull();
      expect(
        document.documentElement.style.getPropertyValue('--auth-avatar')
      ).toBe('');
    });

    it('sets guest state attribute when no hint cookie is present', () => {
      runInlineScript();

      expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
        'guest'
      );
      expect(
        document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)
      ).toBeNull();
    });

    it('sets guest state attribute when the cookie value is unrecognized', () => {
      document.cookie = `${SESSION_HINT_COOKIE}=garbage`;

      runInlineScript();

      expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
        'guest'
      );
    });

    it('gracefully handles malformed URI encoding in the inline script', () => {
      document.cookie = `${SESSION_HINT_COOKIE}=1||https%3A%2F%2Fexample.com%2Finvalid%%url`;

      runInlineScript();

      // Should still set the state attribute and isMentor safely since decodeURIComponent error is caught!
      expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
        'mentor'
      );
      expect(
        document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)
      ).toBeNull();
    });
  });

  describe('clearSessionHint', () => {
    it('deletes the cookie and clears all DOM attributes and CSS variables', () => {
      // Set initial values
      document.cookie = `${SESSION_HINT_COOKIE}=1||https%3A%2F%2Fexample.com%2Favatar.png`;
      document.documentElement.setAttribute(DOM_AUTH_STATE_ATTR, 'mentor');
      document.documentElement.setAttribute(
        DOM_AUTH_AVATAR_ATTR,
        'https://example.com/avatar.png'
      );
      document.documentElement.style.setProperty(
        '--auth-avatar',
        'url("https://example.com/avatar.png")'
      );

      // Verify they are set
      expect(document.cookie).toContain(`${SESSION_HINT_COOKIE}=`);
      expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
        'mentor'
      );
      expect(document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)).toBe(
        'https://example.com/avatar.png'
      );
      expect(
        document.documentElement.style.getPropertyValue('--auth-avatar')
      ).toContain('url(');

      // Call clearSessionHint
      clearSessionHint();

      // Verify they are completely cleared
      expect(document.cookie).not.toContain(`${SESSION_HINT_COOKIE}=`);
      expect(
        document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)
      ).toBeNull();
      expect(
        document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)
      ).toBeNull();
      expect(
        document.documentElement.style.getPropertyValue('--auth-avatar')
      ).toBe('');
    });

    it('gracefully early returns in SSR environment where document is undefined', () => {
      vi.stubGlobal('document', undefined);
      expect(() => clearSessionHint()).not.toThrow();
      vi.unstubAllGlobals();
    });
  });

  describe('resolveIdentity', () => {
    const defaultOverride = {
      userId: 'user-123',
      url: 'https://example.com/override.png',
    };
    const defaultSession = {
      user: {
        id: 'user-123',
        avatar: 'https://example.com/session.png',
        isMentor: true,
      },
    };
    const defaultHint = {
      isMentor: false,
      userId: 'user-123',
      avatar: 'https://example.com/hint.png',
    };

    it('prefers session over hint when authenticated', () => {
      const identity = resolveIdentity(
        null,
        defaultSession,
        'authenticated',
        defaultHint
      );
      expect(identity.userId).toBe('user-123');
      expect(identity.isMentor).toBe(true);
      expect(identity.avatar).toBe('https://example.com/session.png');
      expect(identity.isLoggedIn).toBe(true);
    });

    it('falls back to hint when loading and session is not settled', () => {
      const identity = resolveIdentity(null, null, 'loading', defaultHint);
      expect(identity.userId).toBe('user-123');
      expect(identity.isMentor).toBe(false);
      expect(identity.avatar).toBe('https://example.com/hint.png');
      expect(identity.isLoggedIn).toBe(true);
    });

    it('applies avatar override when override userId matches resolved userId', () => {
      // Authenticated matching override
      const identityAuth = resolveIdentity(
        defaultOverride,
        defaultSession,
        'authenticated',
        null
      );
      expect(identityAuth.avatar).toBe('https://example.com/override.png');
      expect(identityAuth.isLoggedIn).toBe(true);

      // Loading matching override (from hint)
      const identityLoading = resolveIdentity(
        defaultOverride,
        null,
        'loading',
        defaultHint
      );
      expect(identityLoading.avatar).toBe('https://example.com/override.png');
      expect(identityLoading.isLoggedIn).toBe(true);
    });

    it('does not apply avatar override when override userId does not match resolved userId', () => {
      const mismatchedOverride = {
        userId: 'user-999',
        url: 'https://example.com/override.png',
      };
      const identity = resolveIdentity(
        mismatchedOverride,
        defaultSession,
        'authenticated',
        null
      );
      expect(identity.avatar).toBe('https://example.com/session.png');
      expect(identity.isLoggedIn).toBe(true);
    });

    it('resolves to guest/undefined when unauthenticated', () => {
      const identity = resolveIdentity(
        null,
        null,
        'unauthenticated',
        defaultHint
      );
      expect(identity.userId).toBeUndefined();
      expect(identity.isMentor).toBe(false);
      expect(identity.avatar).toBeUndefined();
      expect(identity.isLoggedIn).toBe(false);
    });

    it('resolves to guest/undefined when loading and no hint is present', () => {
      const identity = resolveIdentity(null, null, 'loading', null);
      expect(identity.userId).toBeUndefined();
      expect(identity.isMentor).toBe(false);
      expect(identity.avatar).toBeUndefined();
      expect(identity.isLoggedIn).toBe(false);
    });

    it('resolves SessionHintState inputs', () => {
      // 1. Unknown state
      const identityUnknown = resolveIdentity(null, null, 'loading', {
        status: 'unknown',
      });
      expect(identityUnknown.authKnown).toBe(false);
      expect(identityUnknown.isLoggedIn).toBe(false);

      // 2. Guest state
      const identityGuest = resolveIdentity(null, null, 'loading', {
        status: 'guest',
      });
      expect(identityGuest.authKnown).toBe(true);
      expect(identityGuest.isLoggedIn).toBe(false);

      // 3. Authenticated state
      const identityAuthenticated = resolveIdentity(null, null, 'loading', {
        status: 'authenticated',
        isMentor: false,
        avatar: 'avatar.png',
        userId: 'user-789',
      });
      expect(identityAuthenticated.authKnown).toBe(true);
      expect(identityAuthenticated.isLoggedIn).toBe(true);
      expect(identityAuthenticated.userId).toBe('user-789');
      expect(identityAuthenticated.isMentor).toBe(false);
    });

    it('falls back to reading the cookie when hintInput is omitted', () => {
      document.cookie = 'session-hint=0%7Cuser-abc%7C%2Favatar.png';

      const identity = resolveIdentity(null, null, 'loading');
      expect(identity.userId).toBe('user-abc');
      expect(identity.isMentor).toBe(false);
      expect(identity.avatar).toBe('/avatar.png');
      expect(identity.isLoggedIn).toBe(true);

      // Clean up cookie to prevent test pollution
      document.cookie = 'session-hint=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    });

    it('behaves correctly and does not throw in an SSR environment when reading fallback cookie', () => {
      const originalDocument = globalThis.document;
      vi.stubGlobal('document', undefined);

      const identity = resolveIdentity(null, null, 'loading');
      expect(identity.authKnown).toBe(false);
      expect(identity.isLoggedIn).toBe(false);
      expect(identity.userId).toBeUndefined();

      vi.stubGlobal('document', originalDocument);
    });
  });

  describe('golden fixture for session hint decoding and inline script', () => {
    const runInlineScript = () => {
      // eslint-disable-next-line no-eval
      eval(SESSION_HINT_INLINE_SCRIPT);
    };

    beforeEach(() => {
      document.cookie = `${SESSION_HINT_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      document.documentElement.removeAttribute(DOM_AUTH_STATE_ATTR);
      document.documentElement.removeAttribute(DOM_AUTH_AVATAR_ATTR);
      document.documentElement.style.removeProperty('--auth-avatar');
    });

    it('produces identical DOM/state output for all possible cookie value fixtures', () => {
      const fixtures = [
        '1||https%3A%2F%2Fexample.com%2Favatar.png',
        '0||https%3A%2F%2Fexample.com%2Favatar.png',
        '1|user-123|https%3A%2F%2Fexample.com%2Favatar.png',
        '1|user-123',
        '1',
        '0',
        'garbage',
        '',
        '1||javascript%3Aalert(1)',
        '1||https%3A%2F%2Fexample.com%2Favatar.png%22%3Bbackground%3Ared',
      ];

      for (const cookieVal of fixtures) {
        // --- 1. Inline script behavior ---
        // Clean state
        document.documentElement.removeAttribute(DOM_AUTH_STATE_ATTR);
        document.documentElement.removeAttribute(DOM_AUTH_AVATAR_ATTR);
        document.documentElement.style.removeProperty('--auth-avatar');

        if (cookieVal) {
          document.cookie = `${SESSION_HINT_COOKIE}=${cookieVal}`;
        } else {
          document.cookie = `${SESSION_HINT_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        }

        runInlineScript();

        const inlineState =
          document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR);
        const inlineAvatar =
          document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR);

        // --- 2. decodeSessionHint behavior ---
        const decoded = decodeSessionHint(cookieVal || null);
        let decodedState = 'guest';
        let decodedAvatar = null;

        if (decoded) {
          decodedState = decoded.isMentor ? 'mentor' : 'mentee';
          decodedAvatar = decoded.avatar ?? null;
        }

        expect(inlineState).toBe(decodedState);
        expect(inlineAvatar).toBe(decodedAvatar);
      }
    });
  });
});
