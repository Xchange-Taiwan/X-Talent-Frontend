import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  DOM_AUTH_AVATAR_ATTR,
  DOM_AUTH_STATE_ATTR,
  SESSION_HINT_COOKIE,
} from '@/lib/auth/sessionHint';

import { useSessionHint } from './useSessionHint';

function setCookie(value: string | undefined): void {
  if (value === undefined) {
    document.cookie = `${SESSION_HINT_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    return;
  }
  document.cookie = `${SESSION_HINT_COOKIE}=${value}`;
}

describe('useSessionHint', () => {
  afterEach(() => {
    setCookie(undefined);
  });

  it('actively syncs DOM attributes and CSS variables with the cookie on mount', async () => {
    setCookie('1|https%3A%2F%2Fexample.com%2Favatar.png');

    const { result } = renderHook(() => useSessionHint());

    try {
      await waitFor(() => {
        expect(result.current).toEqual({
          status: 'authenticated',
          isMentor: true,
          avatar: 'https://example.com/avatar.png',
        });
        expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
          'mentor'
        );
        expect(
          document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)
        ).toBe('https://example.com/avatar.png');
        expect(
          document.documentElement.style.getPropertyValue('--auth-avatar')
        ).toBe('url("https://example.com/avatar.png")');
      });
    } finally {
      document.documentElement.removeAttribute(DOM_AUTH_STATE_ATTR);
      document.documentElement.removeAttribute(DOM_AUTH_AVATAR_ATTR);
      document.documentElement.style.removeProperty('--auth-avatar');
    }
  });

  it('resolves to guest when no hint cookie is present', async () => {
    const { result } = renderHook(() => useSessionHint());
    await waitFor(() => expect(result.current.status).toBe('guest'));
  });

  it('resolves to authenticated mentor when cookie value is "1"', async () => {
    setCookie('1');
    const { result } = renderHook(() => useSessionHint());
    await waitFor(() =>
      expect(result.current).toEqual({
        status: 'authenticated',
        isMentor: true,
      })
    );
  });

  it('resolves to authenticated non-mentor when cookie value is "0"', async () => {
    setCookie('0');
    const { result } = renderHook(() => useSessionHint());
    await waitFor(() =>
      expect(result.current).toEqual({
        status: 'authenticated',
        isMentor: false,
      })
    );
  });

  it('treats an unrecognized cookie value as guest', async () => {
    setCookie('garbage');
    const { result } = renderHook(() => useSessionHint());
    await waitFor(() => expect(result.current.status).toBe('guest'));
  });

  it('clears DOM attributes and CSS variables when no cookie is present (guest)', async () => {
    document.documentElement.setAttribute(DOM_AUTH_STATE_ATTR, 'mentor');
    document.documentElement.setAttribute(
      DOM_AUTH_AVATAR_ATTR,
      'https://example.com/avatar.png'
    );
    document.documentElement.style.setProperty(
      '--auth-avatar',
      'url("https://example.com/avatar.png")'
    );

    const { result } = renderHook(() => useSessionHint());

    await waitFor(() => {
      expect(result.current.status).toBe('guest');
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

    const { result } = renderHook(() => useSessionHint());

    await waitFor(() => {
      expect(result.current).toEqual({
        status: 'authenticated',
        isMentor: true,
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
});
