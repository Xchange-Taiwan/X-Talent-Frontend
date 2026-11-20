import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

import {
  authLifecycle,
  createAuthLifecycle,
  createInMemorySessionStorage,
} from '@/lib/auth/sessionLifecycle';
import { mockRouter } from '@/test/mocks/navigation';
import { mockGetSession, mockSession, mockSignIn } from '@/test/mocks/nextAuth';
import { mockToast } from '@/test/mocks/useToast';

import useSignInForm from './useSignInForm';

const validValues = { email: 'user@example.com', password: 'Password1!' };

describe('useSignInForm (#940)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignIn.mockResolvedValue({ error: null });
    mockGetSession.mockResolvedValue(mockSession);

    const scoped = createAuthLifecycle({
      storage: createInMemorySessionStorage(),
      trackEvent: vi.fn(),
      setAnalyticsUserContext: vi.fn(),
      captureFailure: vi.fn(),
      getSearch: () => '?callbackUrl=%2Freservation%2Fmentee',
      getOrigin: () => 'https://xtalent.tw',
    });
    vi.spyOn(authLifecycle, 'signInWithCredentials').mockImplementation(
      (values, overrides) => scoped.signInWithCredentials(values, overrides)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes empty credentials and blocks invalid RHF submissions before invoking authLifecycle', async () => {
    const { result } = renderHook(() => useSignInForm());

    expect(result.current.form.getValues()).toEqual({
      email: '',
      password: '',
    });

    const onValid = vi.fn();
    const onInvalid = vi.fn();
    await act(async () => {
      await result.current.form.handleSubmit(onValid, onInvalid)();
    });

    expect(onValid).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalledTimes(1);
    expect(authLifecycle.signInWithCredentials).not.toHaveBeenCalled();
  });

  it('delegates signInWithCredentials with NextAuth adapters, guards concurrent submits, and resets isSubmitting', async () => {
    let resolveLogin!: (val: { error: string | null }) => void;
    mockSignIn.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLogin = resolve;
      })
    );

    const { result } = renderHook(() => useSignInForm());

    let p1!: Promise<void>;
    let p2!: Promise<void>;
    act(() => {
      p1 = result.current.onSubmit(validValues);
      p2 = result.current.onSubmit(validValues);
    });

    expect(result.current.isSubmitting).toBe(true);
    expect(authLifecycle.signInWithCredentials).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveLogin({ error: null });
      await Promise.all([p1, p2]);
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(mockRouter.push).toHaveBeenCalledWith('/reservation/mentee');
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('forwards toast adapter so authLifecycle surfaces invalid credentials without redirecting', async () => {
    mockSignIn.mockResolvedValueOnce({ error: 'CredentialsSignin' });

    const { result } = renderHook(() => useSignInForm());

    await act(async () => {
      await result.current.onSubmit(validValues);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: 'Invalid credentials!',
      })
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
  });
});
