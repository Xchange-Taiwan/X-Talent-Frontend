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

vi.mock('@/services/auth/authClient', () => ({
  authClient: {
    requestPasswordResetEmail: vi.fn(),
  },
}));

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
  sanitize: (val: string) => val,
}));

import { captureFlowFailure } from '@/lib/monitoring';
import { authClient } from '@/services/auth/authClient';
import { mockRouter } from '@/test/mocks/navigation';
import { mockToast } from '@/test/mocks/useToast';

import usePasswordForgotForm from './usePasswordForgotForm';

const mockResetPassword = vi.mocked(authClient.requestPasswordResetEmail);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);

const validValues = {
  email: 'test@example.com',
};

describe('usePasswordForgotForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
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
    expect(result.current.isSubmitting).toBe(true);
  });

  it('handles ApiError / general error, logs captureFlowFailure without email PII, and triggers toast', async () => {
    mockResetPassword.mockRejectedValueOnce(
      new Error('Reset link generation failed')
    );

    const { result } = renderHook(() => usePasswordForgotForm());

    await act(async () => {
      await result.current.onSubmit(validValues);
    });

    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'password_reset',
        step: 'request_email',
        message: 'Reset link generation failed',
        level: 'info',
      })
    );
    expect(JSON.stringify(mockCaptureFlowFailure.mock.calls)).not.toContain(
      'test@example.com'
    );
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
