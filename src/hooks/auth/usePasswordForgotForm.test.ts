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

import usePasswordForgotForm from './usePasswordForgotForm';

describe('usePasswordForgotForm (#940)', () => {
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
    vi.spyOn(authLifecycle, 'requestPasswordReset').mockImplementation(
      (email, overrides) => scoped.requestPasswordReset(email, overrides)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('validates RHF email field and retains isSubmitting=true on successful redirect', async () => {
    requestPasswordResetEmail.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => usePasswordForgotForm());

    const onInvalid = vi.fn();
    await act(async () => {
      await result.current.form.handleSubmit(vi.fn(), onInvalid)();
    });
    expect(onInvalid).toHaveBeenCalledTimes(1);
    expect(requestPasswordResetEmail).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.onSubmit({ email: 'test@example.com' });
    });

    expect(requestPasswordResetEmail).toHaveBeenCalledWith('test@example.com');
    expect(storage.getItem(PENDING_PASSWORD_RESET_EMAIL_KEY)).toBe(
      'test@example.com'
    );
    expect(mockRouter.push).toHaveBeenCalledWith(
      '/auth/password-forgot-success'
    );
    expect(result.current.isSubmitting).toBe(true);
  });

  it('resets isSubmitting=false and surfaces toast when requestPasswordReset fails', async () => {
    requestPasswordResetEmail.mockRejectedValueOnce(
      new Error('Reset link generation failed')
    );

    const { result } = renderHook(() => usePasswordForgotForm());

    await act(async () => {
      await result.current.onSubmit({ email: 'test@example.com' });
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '信件寄送失敗',
        description: 'Reset link generation failed',
      })
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
  });
});
