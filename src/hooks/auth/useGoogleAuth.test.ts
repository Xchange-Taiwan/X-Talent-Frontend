import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

import {
  authLifecycle,
  createAuthLifecycle,
  createInMemorySessionStorage,
  PENDING_AUTH_CALLBACK_URL_KEY,
} from '@/lib/auth/sessionLifecycle';
import { mockRouter } from '@/test/mocks/navigation';
import { mockToast } from '@/test/mocks/useToast';

import { useGoogleAuth } from './useGoogleAuth';

describe('useGoogleAuth (#940)', () => {
  const getGoogleAuthorizeUrl = vi.fn();
  const trackEvent = vi.fn();
  let storage = createInMemorySessionStorage();

  beforeEach(() => {
    vi.clearAllMocks();
    storage = createInMemorySessionStorage();
    const scoped = createAuthLifecycle({
      authClient: { getGoogleAuthorizeUrl },
      storage,
      trackEvent,
      captureFailure: vi.fn(),
      getSearch: () => '?callbackUrl=%2Freservation%2Fmentee',
      getOrigin: () => 'https://xtalent.tw',
    });
    vi.spyOn(authLifecycle, 'startGoogleAuth').mockImplementation(
      (input, overrides) => scoped.startGoogleAuth(input, overrides)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates login & signup intents through authLifecycle.startGoogleAuth and retains isPending=true on redirect (#733 / #950)', async () => {
    getGoogleAuthorizeUrl
      .mockResolvedValueOnce({
        authorization_url: 'https://google.com/auth/login',
        state: 's-login',
      })
      .mockResolvedValueOnce({
        authorization_url: 'https://google.com/auth/signup',
        state: 's-signup',
      });

    const { result } = renderHook(() => useGoogleAuth());

    await act(async () => {
      await result.current.handleGoogleAuth(true);
    });

    expect(getGoogleAuthorizeUrl).toHaveBeenCalledWith('login');
    expect(storage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)).toBe(
      '/reservation/mentee'
    );
    expect(mockRouter.push).toHaveBeenCalledWith(
      'https://google.com/auth/login'
    );
    expect(result.current.isPending).toBe(true);

    await act(async () => {
      await result.current.handleGoogleAuth(false);
    });

    expect(getGoogleAuthorizeUrl).toHaveBeenCalledWith('signup');
    expect(storage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)).toBeNull();
    expect(mockRouter.push).toHaveBeenCalledWith(
      'https://google.com/auth/signup'
    );
    expect(trackEvent).toHaveBeenCalledWith({
      name: 'auth_oauth_started',
      feature: 'auth',
      metadata: { method: 'Google', flow: 'login' },
    });
    expect(trackEvent).toHaveBeenCalledWith({
      name: 'auth_oauth_started',
      feature: 'auth',
      metadata: { method: 'Google', flow: 'sign_up' },
    });
  });

  it('resets isPending=false and shows destructive toast when startGoogleAuth fails', async () => {
    getGoogleAuthorizeUrl.mockRejectedValueOnce(new Error('OAuth down'));

    const { result } = renderHook(() => useGoogleAuth());

    await act(async () => {
      await result.current.handleGoogleAuth(true);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '登入失敗',
        description: '無法完成 Google 登入，請稍後再試。',
      })
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(false);
  });
});
