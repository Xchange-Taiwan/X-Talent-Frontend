import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('@/services/auth/authClient', () => ({
  authClient: {
    resetPasswordWithToken: vi.fn(),
  },
}));

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
  sanitize: (val: string) => val,
}));

import { PENDING_PASSWORD_RESET_EMAIL_KEY } from '@/lib/auth/authFlowStorage';
import { captureFlowFailure } from '@/lib/monitoring';
import { authClient } from '@/services/auth/authClient';
import { mockRouter, mockSearchParams } from '@/test/mocks/navigation';
import { mockToast } from '@/test/mocks/useToast';

import usePasswordResetForm from './usePasswordResetForm';

const mockResetPassword = vi.mocked(authClient.resetPasswordWithToken);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);

describe('usePasswordResetForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mockSearchParams.get.mockReturnValue(null);
  });

  it('URL has no token → toast shows 缺少驗證 Token, logs captureFlowFailure, resetPassword is NOT called, no redirect', async () => {
    mockSearchParams.get.mockReturnValue(null);

    const { result } = renderHook(() => usePasswordResetForm());

    await act(async () => {
      await result.current.onSubmit({
        password: 'NewPass1!',
        confirm_password: 'NewPass1!',
      });
    });

    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'password_reset',
        step: 'missing_token',
        message: 'Missing password reset verification token',
        level: 'info',
      })
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '驗證失敗',
        description: expect.stringContaining('缺少驗證 Token'),
      })
    );
    expect(mockResetPassword).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
  });

  it('URL has token + resetPassword resolves → clears pending_reset_email PII from sessionStorage and redirects to success page (#904)', async () => {
    window.sessionStorage.setItem(
      PENDING_PASSWORD_RESET_EMAIL_KEY,
      'pending-reset@example.com'
    );
    mockSearchParams.get.mockReturnValue('valid-token');
    mockResetPassword.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => usePasswordResetForm());

    await act(async () => {
      await result.current.onSubmit({
        password: 'NewPass1!',
        confirm_password: 'NewPass1!',
      });
    });

    expect(mockResetPassword).toHaveBeenCalledWith({
      verifyToken: 'valid-token',
      password: 'NewPass1!',
      confirmPassword: 'NewPass1!',
    });
    expect(
      window.sessionStorage.getItem(PENDING_PASSWORD_RESET_EMAIL_KEY)
    ).toBeNull();
    expect(mockRouter.push).toHaveBeenCalledWith(
      '/auth/password-reset-success'
    );
    expect(mockToast).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(true);
  });

  it('URL has token + resetPassword throws → logs captureFlowFailure without token/password PII and shows toast', async () => {
    mockSearchParams.get.mockReturnValue('secret-reset-tok-777');
    mockResetPassword.mockRejectedValueOnce(new Error('密碼格式錯誤'));

    const { result } = renderHook(() => usePasswordResetForm());

    await act(async () => {
      await result.current.onSubmit({
        password: 'NewPass1!',
        confirm_password: 'NewPass1!',
      });
    });

    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'password_reset',
        step: 'submit_new_password',
        message: '密碼格式錯誤',
        level: 'info',
      })
    );
    expect(JSON.stringify(mockCaptureFlowFailure.mock.calls)).not.toContain(
      'secret-reset-tok-777'
    );
    expect(JSON.stringify(mockCaptureFlowFailure.mock.calls)).not.toContain(
      'NewPass1!'
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '密碼重設失敗',
        description: '密碼格式錯誤',
      })
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
  });
});
