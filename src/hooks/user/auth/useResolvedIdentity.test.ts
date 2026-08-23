import { renderHook, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DOM_AUTH_AVATAR_ATTR,
  DOM_AUTH_STATE_ATTR,
  SESSION_HINT_COOKIE,
} from '@/lib/auth/sessionHint';

import { useResolvedIdentity } from './useResolvedIdentity';

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

const mockUseSession = vi.mocked(useSession);

function setCookie(value: string | undefined): void {
  if (value === undefined) {
    document.cookie = `${SESSION_HINT_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    return;
  }
  document.cookie = `${SESSION_HINT_COOKIE}=${value}`;
}

describe('useResolvedIdentity', () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'loading',
    } as never);
  });

  afterEach(() => {
    setCookie(undefined);
    document.documentElement.removeAttribute(DOM_AUTH_STATE_ATTR);
    document.documentElement.removeAttribute(DOM_AUTH_AVATAR_ATTR);
    document.documentElement.style.removeProperty('--auth-avatar');
  });

  it('resolves to guest immediately during loading when no hint cookie is present, and stays guest once unauthenticated is confirmed', async () => {
    const { result, rerender } = renderHook(() => useResolvedIdentity());

    // No hint cookie means the last middleware pass saw no valid token, so
    // treat the visitor as a guest right away instead of waiting on
    // useSession() to resolve.
    await waitFor(() => expect(result.current.isLoggedIn).toBe(false));
    expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
      'guest'
    );

    // Once resolved to unauthenticated, stays guest
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    } as never);
    rerender();

    await waitFor(() => {
      expect(result.current.isLoggedIn).toBe(false);
      expect(result.current.authKnown).toBe(true);
    });
  });

  it('resolves to authenticated mentor when cookie value is "1"', async () => {
    setCookie('1');
    const { result } = renderHook(() => useResolvedIdentity());
    await waitFor(() =>
      expect(result.current).toMatchObject({
        isLoggedIn: true,
        isMentor: true,
        userId: undefined,
        avatar: undefined,
      })
    );
  });

  it('resolves to authenticated non-mentor when cookie value is "0"', async () => {
    setCookie('0');
    const { result } = renderHook(() => useResolvedIdentity());
    await waitFor(() =>
      expect(result.current).toMatchObject({
        isLoggedIn: true,
        isMentor: false,
      })
    );
  });

  it('treats an unrecognized cookie value as guest', async () => {
    setCookie('garbage');
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    } as never);

    const { result } = renderHook(() => useResolvedIdentity());
    await waitFor(() => expect(result.current.isLoggedIn).toBe(false));
  });

  it('clears stale mentor/mentee DOM attributes and marks guest when no cookie is present', async () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    } as never);

    document.documentElement.setAttribute(DOM_AUTH_STATE_ATTR, 'mentor');
    document.documentElement.setAttribute(
      DOM_AUTH_AVATAR_ATTR,
      'https://example.com/avatar.png'
    );
    document.documentElement.style.setProperty(
      '--auth-avatar',
      'url("https://example.com/avatar.png")'
    );

    const { result } = renderHook(() => useResolvedIdentity());

    await waitFor(() => {
      expect(result.current.isLoggedIn).toBe(false);
      expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
        'guest'
      );
      expect(
        document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)
      ).toBeNull();
      expect(
        document.documentElement.style.getPropertyValue('--auth-avatar')
      ).toBe('');
    });
  });

  it('clears avatar attributes and CSS variables when logged in without avatar', async () => {
    document.documentElement.setAttribute(DOM_AUTH_STATE_ATTR, 'mentee');
    document.documentElement.setAttribute(
      DOM_AUTH_AVATAR_ATTR,
      'https://example.com/avatar.png'
    );
    document.documentElement.style.setProperty(
      '--auth-avatar',
      'url("https://example.com/avatar.png")'
    );

    setCookie('1');

    const { result } = renderHook(() => useResolvedIdentity());

    await waitFor(() => {
      expect(result.current).toMatchObject({
        isLoggedIn: true,
        isMentor: true,
        avatar: undefined,
      });
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
  });

  it('actively syncs DOM attributes and style property when hint is resolved with avatar', async () => {
    setCookie('1||https%3A%2F%2Fexample.com%2Favatar.png');

    const { result } = renderHook(() => useResolvedIdentity());

    await waitFor(() => {
      expect(result.current).toMatchObject({
        isLoggedIn: true,
        isMentor: true,
        avatar: 'https://example.com/avatar.png',
      });
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
  });

  it('escapes double quotes in avatar URL to prevent CSS injection in style property', async () => {
    setCookie(
      '1||https%3A%2F%2Fexample.com%2Favatar.png%22%3Bbackground%3Ared'
    );

    const { result } = renderHook(() => useResolvedIdentity());

    await waitFor(() => {
      expect(result.current).toMatchObject({
        isLoggedIn: true,
        isMentor: true,
        avatar: 'https://example.com/avatar.png";background:red',
      });
      expect(document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)).toBe(
        'https://example.com/avatar.png";background:red'
      );

      // Verify quotes are escaped to %22 to completely block CSS Injection breakout
      expect(
        document.documentElement.style.getPropertyValue('--auth-avatar')
      ).toBe('url("https://example.com/avatar.png%22;background:red")');
    });
  });

  it('clears stale avatar/cookie state and marks guest on unauthenticated (logout) session status', async () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    } as never);

    setCookie('1');

    document.documentElement.setAttribute(DOM_AUTH_STATE_ATTR, 'mentor');
    document.documentElement.setAttribute(DOM_AUTH_AVATAR_ATTR, 'url');
    document.documentElement.style.setProperty('--auth-avatar', 'url("url")');

    const { result } = renderHook(() => useResolvedIdentity());

    await waitFor(() => {
      expect(result.current.isLoggedIn).toBe(false);
      expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
        'guest'
      );
      expect(
        document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)
      ).toBeNull();
      expect(
        document.documentElement.style.getPropertyValue('--auth-avatar')
      ).toBe('');
      expect(document.cookie).not.toContain(`${SESSION_HINT_COOKIE}=`);
    });
  });

  it('synchronizes DOM and style property with real authenticated session data', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-123',
          isMentor: true,
          avatar: 'https://example.com/real-avatar.png',
        },
      },
      status: 'authenticated',
    } as never);

    const { result } = renderHook(() => useResolvedIdentity());

    await waitFor(() => {
      expect(result.current).toMatchObject({
        isLoggedIn: true,
        isMentor: true,
        avatar: 'https://example.com/real-avatar.png',
        userId: 'user-123',
        hasFullUser: true,
      });
      expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
        'mentor'
      );
      expect(document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)).toBe(
        'https://example.com/real-avatar.png'
      );
      expect(
        document.documentElement.style.getPropertyValue('--auth-avatar')
      ).toBe('url("https://example.com/real-avatar.png")');
    });
  });

  it('ignores unsafe avatar protocols in updateAvatarStyle and does not write them to DOM', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-123',
          isMentor: true,
          avatar: 'javascript:alert(1)',
        },
      },
      status: 'authenticated',
    } as never);

    const { result } = renderHook(() => useResolvedIdentity());

    await waitFor(() => {
      expect(result.current).toMatchObject({
        isLoggedIn: true,
        isMentor: true,
        avatar: 'javascript:alert(1)',
        userId: 'user-123',
      });
      expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
        'mentor'
      );
      // Should NOT set the avatar attribute or styles because javascript: protocol is completely blocked!
      expect(
        document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)
      ).toBeNull();
      expect(
        document.documentElement.style.getPropertyValue('--auth-avatar')
      ).toBe('');
    });
  });

  it('gracefully handles malformed URI encoding in cookie in useResolvedIdentity without throwing', async () => {
    setCookie('1||https%3A%2F%2Fexample.com%2Finvalid%%url');

    const { result } = renderHook(() => useResolvedIdentity());

    await waitFor(() => {
      expect(result.current).toMatchObject({
        isLoggedIn: true,
        isMentor: true,
        avatar: undefined,
      });
      expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
        'mentor'
      );
      expect(
        document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)
      ).toBeNull();
    });
  });
});
