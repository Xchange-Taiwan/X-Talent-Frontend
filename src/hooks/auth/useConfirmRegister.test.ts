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
  PENDING_VERIFICATION_EMAIL_KEY,
} from '@/lib/auth/sessionLifecycle';
import { mockSearchParams } from '@/test/mocks/navigation';
import { mockToast } from '@/test/mocks/useToast';

import { useConfirmRegister } from './useConfirmRegister';

describe('useConfirmRegister (#940)', () => {
  const confirmSignUpFn = vi.fn();
  const trackEvent = vi.fn();
  const captureFailure = vi.fn();
  let storage = createInMemorySessionStorage();

  beforeEach(() => {
    vi.clearAllMocks();
    storage = createInMemorySessionStorage();
    mockSearchParams.get.mockReturnValue(null);

    const scoped = createAuthLifecycle({
      authClient: { confirmSignUp: confirmSignUpFn },
      storage,
      trackEvent,
      captureFailure,
    });
    vi.spyOn(authLifecycle, 'confirmSignUp').mockImplementation(
      (token, options) => scoped.confirmSignUp(token, options)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in failure status when token is absent and delegates missing-token handling to authLifecycle', async () => {
    mockSearchParams.get.mockReturnValue(null);

    const { result } = renderHook(() => useConfirmRegister());
    expect(result.current.status).toBe('failure');

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status).toBe('failure');
    expect(confirmSignUpFn).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '驗證失敗',
        description: '缺少驗證 Token，請重新申請驗證信。',
      })
    );
  });

  it('transitions loading -> success, emits unified email_verified telemetry, clears pending email, and deduplicates Strict Mode rerenders', async () => {
    storage.setItem(PENDING_VERIFICATION_EMAIL_KEY, 'pending@example.com');
    mockSearchParams.get.mockReturnValue('valid-token');

    let resolveApi!: () => void;
    const apiPromise = new Promise<void>((resolve) => {
      resolveApi = resolve;
    });
    confirmSignUpFn.mockReturnValueOnce(apiPromise);

    const { result, rerender } = renderHook(() => useConfirmRegister());
    rerender();

    expect(result.current.status).toBe('loading');
    expect(confirmSignUpFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveApi();
      await apiPromise;
    });

    expect(result.current.status).toBe('success');
    expect(trackEvent).toHaveBeenCalledWith({
      name: 'email_verified',
      feature: 'auth',
    });
    expect(storage.getItem(PENDING_VERIFICATION_EMAIL_KEY)).toBeNull();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('transitions loading -> failure asynchronously when a non-empty token fails verification', async () => {
    mockSearchParams.get.mockReturnValue('expired-signup-token');

    let rejectApi!: (error: Error) => void;
    confirmSignUpFn.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectApi = reject;
        })
    );

    const { result } = renderHook(() => useConfirmRegister());
    expect(result.current.status).toBe('loading');
    expect(confirmSignUpFn).toHaveBeenCalledWith('expired-signup-token');

    await act(async () => {
      rejectApi(new Error('驗證連結已過期'));
    });

    expect(result.current.status).toBe('failure');
    expect(authLifecycle.confirmSignUp).toHaveReturnedWith(expect.any(Promise));
    await expect(
      vi.mocked(authLifecycle.confirmSignUp).mock.results[0].value
    ).resolves.toEqual({ ok: false, status: 'failure' });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '註冊失敗',
        description: '驗證連結已過期',
      })
    );
  });

  it('ignores stale responses across dynamic token changes and after unmount via isCurrent', async () => {
    mockSearchParams.get.mockReturnValue('token-1');

    let resolve1!: () => void;
    const promise1 = new Promise<void>((resolve) => {
      resolve1 = resolve;
    });
    confirmSignUpFn.mockReturnValueOnce(promise1);

    const { rerender, result, unmount } = renderHook(() =>
      useConfirmRegister()
    );
    expect(result.current.status).toBe('loading');

    mockSearchParams.get.mockReturnValue('token-2');
    let resolve2!: () => void;
    const promise2 = new Promise<void>((resolve) => {
      resolve2 = resolve;
    });
    confirmSignUpFn.mockReturnValueOnce(promise2);

    rerender();
    expect(result.current.status).toBe('loading');

    await act(async () => {
      resolve2();
      await promise2;
    });
    expect(result.current.status).toBe('success');
    expect(trackEvent).toHaveBeenCalledTimes(1);

    // Stale token-1 completing later must be ignored
    await act(async () => {
      resolve1();
      await promise1;
    });
    expect(result.current.status).toBe('success');
    expect(trackEvent).toHaveBeenCalledTimes(1);
    unmount();

    // Unmount while in-flight suppresses stale telemetry & toast
    trackEvent.mockClear();
    mockSearchParams.get.mockReturnValue('token-unmount');
    let resolveUnmount!: () => void;
    const unmountPromise = new Promise<void>((resolve) => {
      resolveUnmount = resolve;
    });
    confirmSignUpFn.mockReturnValueOnce(unmountPromise);

    const mounted = renderHook(() => useConfirmRegister());
    mounted.unmount();

    await act(async () => {
      resolveUnmount();
      await unmountPromise;
    });
    expect(trackEvent).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });
});
