import { beforeEach, describe, expect, it } from 'vitest';

import {
  decodeSessionHint,
  DOM_AUTH_AVATAR_ATTR,
  DOM_AUTH_STATE_ATTR,
  encodeSessionHint,
  SESSION_HINT_COOKIE,
  SESSION_HINT_INLINE_SCRIPT,
} from './sessionHint';

describe('sessionHint utilities', () => {
  describe('encodeSessionHint', () => {
    it('encodes mentor status without avatar', () => {
      const result = encodeSessionHint({ isMentor: true });
      expect(result).toBe('1');
    });

    it('encodes non-mentor status without avatar', () => {
      const result = encodeSessionHint({ isMentor: false });
      expect(result).toBe('0');
    });

    it('encodes mentor status with avatar', () => {
      const result = encodeSessionHint({
        isMentor: true,
        avatar: 'https://example.com/avatar.jpg?sz=50&id=123',
      });
      expect(result).toBe(
        '1|https%3A%2F%2Fexample.com%2Favatar.jpg%3Fsz%3D50%26id%3D123'
      );
    });

    it('encodes non-mentor status with avatar', () => {
      const result = encodeSessionHint({
        isMentor: false,
        avatar: 'https://example.com/avatar.jpg',
      });
      expect(result).toBe('0|https%3A%2F%2Fexample.com%2Favatar.jpg');
    });

    it('discards avatar when encoded URL exceeds 1000 characters', () => {
      const longAvatar = 'https://example.com/avatar.png?' + 'a'.repeat(1000);
      const result = encodeSessionHint({
        isMentor: true,
        avatar: longAvatar,
      });
      expect(result).toBe('1');
    });
  });

  describe('decodeSessionHint', () => {
    it('decodes old mentor cookie value "1"', () => {
      const result = decodeSessionHint('1');
      expect(result).toEqual({ isMentor: true });
    });

    it('decodes old non-mentor cookie value "0"', () => {
      const result = decodeSessionHint('0');
      expect(result).toEqual({ isMentor: false });
    });

    it('decodes new mentor cookie with encoded avatar', () => {
      const result = decodeSessionHint(
        '1|https%3A%2F%2Fexample.com%2Favatar.jpg%3Fsz%3D50%26id%3D123'
      );
      expect(result).toEqual({
        isMentor: true,
        avatar: 'https://example.com/avatar.jpg?sz=50&id=123',
      });
    });

    it('decodes new non-mentor cookie with encoded avatar', () => {
      const result = decodeSessionHint(
        '0|https%3A%2F%2Fexample.com%2Favatar.jpg'
      );
      expect(result).toEqual({
        isMentor: false,
        avatar: 'https://example.com/avatar.jpg',
      });
    });

    it('discards avatar on URI decode error', () => {
      const result = decodeSessionHint(
        '1|https%3A%2F%2Fexample.com%2Finvalid%%url'
      );
      expect(result).toEqual({
        isMentor: true,
      });
    });

    it('filters out unsafe avatar protocols', () => {
      const result = decodeSessionHint('1|javascript%3Aalert(1)');
      expect(result).toEqual({
        isMentor: true,
      });
    });

    it('returns null on invalid input', () => {
      expect(decodeSessionHint(null)).toBeNull();
      expect(decodeSessionHint(undefined)).toBeNull();
      expect(decodeSessionHint('')).toBeNull();
      expect(decodeSessionHint('garbage')).toBeNull();
      expect(decodeSessionHint('garbage|url')).toBeNull();
    });
  });

  describe('SESSION_HINT_INLINE_SCRIPT', () => {
    const runInlineScript = () => {
      // Execute the exported inline script in JSDOM
      // eslint-disable-next-line no-eval
      eval(SESSION_HINT_INLINE_SCRIPT);
    };

    beforeEach(() => {
      // Clear data attributes, cookies, and body content
      document.cookie = `${SESSION_HINT_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      document.documentElement.removeAttribute(DOM_AUTH_STATE_ATTR);
      document.documentElement.removeAttribute(DOM_AUTH_AVATAR_ATTR);
      document.body.innerHTML = '';
    });

    it('sets state attribute for mentor with avatar and pre-fills CSS custom property', () => {
      document.cookie = `${SESSION_HINT_COOKIE}=1|https%3A%2F%2Fexample.com%2Favatar.png`;

      runInlineScript();

      expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
        'mentor'
      );
      expect(document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)).toBe(
        'https://example.com/avatar.png'
      );
      expect(
        document.documentElement.style.getPropertyValue('--auth-avatar')
      ).toBe('url("https://example.com/avatar.png")');
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
      document.cookie = `${SESSION_HINT_COOKIE}=1|javascript%3Aalert(1)`;

      runInlineScript();

      expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
        'mentor'
      );
      expect(
        document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)
      ).toBeNull();
    });

    it('gracefully handles malformed URI encoding in the inline script', () => {
      document.cookie = `${SESSION_HINT_COOKIE}=1|https%3A%2F%2Fexample.com%2Finvalid%%url`;

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
});
