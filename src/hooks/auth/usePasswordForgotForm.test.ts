import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

vi.mock('@/services/auth/resetPasswordByEmail', () => ({
  resetPassword: vi.fn(),
}));

import { resetPassword } from '@/services/auth/resetPasswordByEmail';
import { mockRouter } from '@/test/mocks/navigation';
import { mockToast } from '@/test/mocks/useToast';

import usePasswordForgotForm from './usePasswordForgotForm';

const mockResetPassword = vi.mocked(resetPassword);

const validValues = {
  email: 'test@example.com',
};

describe('usePasswordForgotForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits form successfully and redirects to forgot success page', async () => {
    mockResetPassword.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => usePasswordForgotForm());

    await act(async () => {
      await result.current.onSubmit(validValues);
    });

    expect(mockResetPassword).toHaveBeenCalledWith(validValues.email);
    expect(sessionStorage.getItem('pending_reset_email')).toBe(
      validValues.email
    );
    expect(mockRouter.push).toHaveBeenCalledWith(
      '/auth/password-forgot-success'
    );
  });

  it('handles ApiError / general error and triggers toast', async () => {
    mockResetPassword.mockRejectedValueOnce(
      new Error('Reset link generation failed')
    );

    const { result } = renderHook(() => usePasswordForgotForm());

    await act(async () => {
      await result.current.onSubmit(validValues);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '信件寄送失敗',
      description: 'Reset link generation failed',
    });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
