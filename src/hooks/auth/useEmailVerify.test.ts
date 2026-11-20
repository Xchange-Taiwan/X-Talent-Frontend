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

import { ApiError } from '@/lib/apiClient';
import {
  authLifecycle,
  createAuthLifecycle,
  createInMemorySessionStorage,
  PENDING_VERIFICATION_EMAIL_KEY,
} from '@/lib/auth/sessionLifecycle';
import { mockRouter } from '@/test/mocks/navigation';
import { mockToast } from '@/test/mocks/useToast';

import { useEmailVerify } from './useEmailVerify';

describe('useEmailVerify (#940)', () => {
  const resendVerificationEmailFn = vi.fn();
  let storage = createInMemorySessionStorage();

  beforeEach(() => {
    vi.clearAllMocks();
    storage = createInMemorySessionStorage();
    const scoped = createAuthLifecycle({
      authClient: { resendVerificationEmail: resendVerificationEmailFn },
      storage,
      captureFailure: vi.fn(),
    });
    vi.spyOn(authLifecycle, 'getPendingVerificationEmail').mockImplementation(
      (overrides) => scoped.getPendingVerificationEmail(overrides)
    );
    vi.spyOn(authLifecycle, 'resendVerificationEmail').mockImplementation(
      (email, overrides) => scoped.resendVerificationEmail(email, overrides)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects to home when authLifecycle.getPendingVerificationEmail() returns null', () => {
    const { result } = renderHook(() => useEmailVerify());

    expect(authLifecycle.getPendingVerificationEmail).toHaveBeenCalledTimes(1);
    expect(result.current.email).toBeNull();
    expect(result.current.isResending).toBe(false);
    expect(mockRouter.push).toHaveBeenCalledWith('/');
  });

  it('manages isResending, blocks concurrent resend clicks, delegates to authLifecycle, and navigates home', async () => {
    storage.setItem(PENDING_VERIFICATION_EMAIL_KEY, 'pending@example.com');

    let resolveResend!: () => void;
    const resendPromise = new Promise<void>((resolve) => {
      resolveResend = resolve;
    });
    resendVerificationEmailFn.mockReturnValueOnce(resendPromise);

    const { result } = renderHook(() => useEmailVerify());
    expect(result.current.email).toBe('pending@example.com');

    let c1!: Promise<void>;
    let c2!: Promise<void>;
    act(() => {
      c1 = result.current.handleResendEmail();
      c2 = result.current.handleResendEmail();
    });

    expect(result.current.isResending).toBe(true);
    expect(resendVerificationEmailFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveResend();
      await Promise.all([c1, c2]);
    });

    expect(result.current.isResending).toBe(false);
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'default',
      title: '已重新寄送',
      description: '驗證信已重新寄送！',
    });

    resendVerificationEmailFn.mockRejectedValueOnce(
      new ApiError(429, '請稍後再重新寄送驗證信')
    );
    await act(async () => {
      await result.current.handleResendEmail();
    });
    expect(mockToast).toHaveBeenLastCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '寄送失敗',
        description: '請稍後再重新寄送驗證信',
      })
    );

    act(() => {
      result.current.handleNavigateHome();
    });
    expect(mockRouter.push).toHaveBeenCalledWith('/');
  });
});
