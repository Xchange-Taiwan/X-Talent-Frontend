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
import { mockRouter, mockSearchParams } from '@/test/mocks/navigation';
import { mockToast } from '@/test/mocks/useToast';

import usePasswordResetForm from './usePasswordResetForm';

describe('usePasswordResetForm (#940)', () => {
  const resetPasswordWithToken = vi.fn();
  let storage = createInMemorySessionStorage();

  beforeEach(() => {
    vi.clearAllMocks();
    storage = createInMemorySessionStorage();
    mockSearchParams.get.mockReturnValue(null);
    const scoped = createAuthLifecycle({
      authClient: { resetPasswordWithToken },
      storage,
      captureFailure: vi.fn(),
    });
    vi.spyOn(authLifecycle, 'completePasswordReset').mockImplementation(
      (input, overrides) => scoped.completePasswordReset(input, overrides)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks mismatched passwords via RHF schema and resets isSubmitting=false when token is missing', async () => {
    const { result } = renderHook(() => usePasswordResetForm());

    result.current.form.setValue('password', 'NewPass1!');
    result.current.form.setValue('confirm_password', 'Different1!');
    const onInvalid = vi.fn();
    await act(async () => {
      await result.current.form.handleSubmit(vi.fn(), onInvalid)();
    });
    expect(onInvalid).toHaveBeenCalledTimes(1);
    expect(resetPasswordWithToken).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.onSubmit({
        password: 'NewPass1!',
        confirm_password: 'NewPass1!',
      });
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '驗證失敗',
      })
    );
    expect(result.current.isSubmitting).toBe(false);
  });

  it('clears pending reset email, redirects to success page, and retains isSubmitting=true when reset succeeds (#904)', async () => {
    storage.setItem(PENDING_PASSWORD_RESET_EMAIL_KEY, 'pending@example.com');
    mockSearchParams.get.mockReturnValue('valid-token');
    resetPasswordWithToken.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => usePasswordResetForm());

    await act(async () => {
      await result.current.onSubmit({
        password: 'NewPass1!',
        confirm_password: 'NewPass1!',
      });
    });

    expect(resetPasswordWithToken).toHaveBeenCalledWith({
      verifyToken: 'valid-token',
      password: 'NewPass1!',
      confirmPassword: 'NewPass1!',
    });
    expect(storage.getItem(PENDING_PASSWORD_RESET_EMAIL_KEY)).toBeNull();
    expect(mockRouter.push).toHaveBeenCalledWith(
      '/auth/password-reset-success'
    );
    expect(result.current.isSubmitting).toBe(true);
  });
});
