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

  it('uses initial hint from document.documentElement data attributes post-mount', async () => {
    document.documentElement.setAttribute(DOM_AUTH_STATE_ATTR, 'mentor');
    document.documentElement.setAttribute(
      DOM_AUTH_AVATAR_ATTR,
      'https://example.com/avatar.png'
    );

    const { result } = renderHook(() => useSessionHint());

    try {
      await waitFor(() =>
        expect(result.current).toEqual({
          status: 'authenticated',
          isMentor: true,
          avatar: 'https://example.com/avatar.png',
        })
      );
    } finally {
      document.documentElement.removeAttribute('data-auth-state');
      document.documentElement.removeAttribute('data-auth-avatar');
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
});
