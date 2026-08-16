import { describe, expect, it, vi } from 'vitest';

import type { CookieStore } from './oauthRefreshBridge';
import {
  consumeOAuthRefreshBridge,
  OAUTH_REFRESH_BRIDGE_COOKIE,
  OAUTH_REFRESH_BRIDGE_TTL_SECONDS,
  setOAuthRefreshBridge,
} from './oauthRefreshBridge';

describe('oauthRefreshBridge', () => {
  describe('setOAuthRefreshBridge', () => {
    it('sets the refresh token cookie when token is provided', () => {
      const mockCookieStore = {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
      } as unknown as CookieStore;

      setOAuthRefreshBridge(mockCookieStore, 'test-refresh-token');

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        OAUTH_REFRESH_BRIDGE_COOKIE,
        'test-refresh-token',
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: OAUTH_REFRESH_BRIDGE_TTL_SECONDS,
        }
      );
    });

    it('does nothing when token is empty, null, or undefined', () => {
      const mockCookieStore = {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
      } as unknown as CookieStore;

      setOAuthRefreshBridge(mockCookieStore, null);
      setOAuthRefreshBridge(mockCookieStore, undefined);
      setOAuthRefreshBridge(mockCookieStore, '');

      expect(mockCookieStore.set).not.toHaveBeenCalled();
    });
  });

  describe('consumeOAuthRefreshBridge', () => {
    it('reads and immediately deletes the cookie when it exists', () => {
      const mockCookieStore = {
        get: vi.fn().mockReturnValue({ value: 'token-to-consume' }),
        set: vi.fn(),
        delete: vi.fn(),
      } as unknown as CookieStore;

      const result = consumeOAuthRefreshBridge(mockCookieStore);

      expect(result).toBe('token-to-consume');
      expect(mockCookieStore.get).toHaveBeenCalledWith(
        OAUTH_REFRESH_BRIDGE_COOKIE
      );
      expect(mockCookieStore.delete).toHaveBeenCalledWith(
        OAUTH_REFRESH_BRIDGE_COOKIE
      );
    });

    it('returns undefined and does not delete if cookie does not exist', () => {
      const mockCookieStore = {
        get: vi.fn().mockReturnValue(undefined),
        set: vi.fn(),
        delete: vi.fn(),
      } as unknown as CookieStore;

      const result = consumeOAuthRefreshBridge(mockCookieStore);

      expect(result).toBeUndefined();
      expect(mockCookieStore.get).toHaveBeenCalledWith(
        OAUTH_REFRESH_BRIDGE_COOKIE
      );
      expect(mockCookieStore.delete).not.toHaveBeenCalled();
    });
  });
});
