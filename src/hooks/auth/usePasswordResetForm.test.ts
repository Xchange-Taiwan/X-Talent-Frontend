import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('@/services/auth/resetPassword', () => ({
  resetPassword: vi.fn(),
}));

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

import { resetPassword } from '@/services/auth/resetPassword';
import { mockRouter, mockSearchParams } from '@/test/mocks/navigation';
import { mockToast } from '@/test/mocks/useToast';

import usePasswordResetForm from './usePasswordResetForm';

const mockResetPassword = vi.mocked(resetPassword);

describe('usePasswordResetForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.get.mockReturnValue(null);
  });

  it('URL has no token → toast shows 缺少驗證 Token, resetPassword is NOT called, no redirect', async () => {
    mockSearchParams.get.mockReturnValue(null);

    const { result } = renderHook(() => usePasswordResetForm());

    await act(async () => {
      await result.current.onSubmit({
        password: 'NewPass1!',
        confirm_password: 'NewPass1!',
      });
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: expect.stringContaining('缺少驗證 Token'),
      })
    );
    expect(mockResetPassword).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('URL has token + resetPassword resolves → router.push to success page', async () => {
    mockSearchParams.get.mockReturnValue('valid-token');
    mockResetPassword.mockResolvedValueOnce({ status: 'success', code: 200 });

    const { result } = renderHook(() => usePasswordResetForm());

    await act(async () => {
      await result.current.onSubmit({
        password: 'NewPass1!',
        confirm_password: 'NewPass1!',
      });
    });

    expect(mockResetPassword).toHaveBeenCalledWith(
      'valid-token',
      'NewPass1!',
      'NewPass1!'
    );
    expect(mockRouter.push).toHaveBeenCalledWith(
      '/auth/password-reset-success'
    );
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('URL has token + resetPassword throws → toast shows 密碼重設失敗 with error message', async () => {
    mockSearchParams.get.mockReturnValue('valid-token');
    mockResetPassword.mockRejectedValueOnce({
      status: 'error',
      code: 400,
      message: '密碼格式錯誤',
    });

    const { result } = renderHook(() => usePasswordResetForm());

    await act(async () => {
      await result.current.onSubmit({
        password: 'NewPass1!',
        confirm_password: 'NewPass1!',
      });
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '密碼重設失敗',
        description: '密碼格式錯誤',
      })
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
