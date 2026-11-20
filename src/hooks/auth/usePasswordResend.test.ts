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
  PENDING_PASSWORD_RESET_EMAIL_KEY,
} from '@/lib/auth/sessionLifecycle';
import { mockRouter } from '@/test/mocks/navigation';
import { mockToast } from '@/test/mocks/useToast';

import usePasswordResend from './usePasswordResend';

describe('usePasswordResend (#940)', () => {
  const requestPasswordResetEmail = vi.fn();
  let storage = createInMemorySessionStorage();

  beforeEach(() => {
    vi.clearAllMocks();
    storage = createInMemorySessionStorage();
    const scoped = createAuthLifecycle({
      authClient: { requestPasswordResetEmail },
      storage,
      captureFailure: vi.fn(),
    });
    vi.spyOn(authLifecycle, 'getPendingPasswordResetEmail').mockImplementation(
      (overrides) => scoped.getPendingPasswordResetEmail(overrides)
    );
    vi.spyOn(authLifecycle, 'resendPasswordReset').mockImplementation(
      (email, overrides) => scoped.resendPasswordReset(email, overrides)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes email via authLifecycle.getPendingPasswordResetEmail() and delegates resend & handleChangeEmail', async () => {
    storage.setItem(PENDING_PASSWORD_RESET_EMAIL_KEY, 'user@example.com');
    requestPasswordResetEmail.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => usePasswordResend());
    expect(authLifecycle.getPendingPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(result.current.email).toBe('user@example.com');

    await act(async () => {
      await result.current.handleResend();
    });

    expect(requestPasswordResetEmail).toHaveBeenCalledWith('user@example.com');
    expect(mockToast).toHaveBeenCalledWith({
      title: '已成功重新發送',
      description: '請至您的電子郵箱查看。',
    });
    expect(result.current.isResending).toBe(false);

    act(() => {
      result.current.handleChangeEmail();
    });
    expect(mockRouter.push).toHaveBeenCalledWith('/auth/password-forgot');
  });

  it('surfaces missing-email toast via authLifecycle when no email is stored', async () => {
    const { result } = renderHook(() => usePasswordResend());

    await act(async () => {
      await result.current.handleResend();
    });

    expect(requestPasswordResetEmail).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '發送失敗',
        description: '找不到您的電子郵件地址，請嘗試重新操作。',
      })
    );
    expect(result.current.isResending).toBe(false);
  });
});
