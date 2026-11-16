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

import usePasswordResend from './usePasswordResend';

const mockResetPassword = vi.mocked(authClient.requestPasswordResetEmail);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);

describe('usePasswordResend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('initializes email from sessionStorage on mount', () => {
    sessionStorage.setItem('pending_reset_email', 'user@example.com');
    const { result } = renderHook(() => usePasswordResend());
    expect(result.current.email).toBe('user@example.com');
  });

  it('triggers failure toast and captureFlowFailure when email is not available', async () => {
    const { result } = renderHook(() => usePasswordResend());

    await act(async () => {
      await result.current.handleResend();
    });

    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'password_reset',
        step: 'missing_email',
        message: 'Missing pending password reset email',
        level: 'info',
      })
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '發送失敗',
        description: '找不到您的電子郵件地址，請嘗試重新操作。',
      })
    );
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('sends email successfully and triggers toast', async () => {
    sessionStorage.setItem('pending_reset_email', 'user@example.com');
    mockResetPassword.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => usePasswordResend());

    await act(async () => {
      await result.current.handleResend();
    });

    expect(mockResetPassword).toHaveBeenCalledWith('user@example.com');
    expect(mockToast).toHaveBeenCalledWith({
      title: '已成功重新發送',
      description: '請至您的電子郵箱查看。',
    });
  });

  it('handles resend errors, logs captureFlowFailure without email PII, and triggers toast', async () => {
    sessionStorage.setItem('pending_reset_email', 'user@example.com');
    mockResetPassword.mockRejectedValueOnce(new Error('Resend link blocked'));

    const { result } = renderHook(() => usePasswordResend());

    await act(async () => {
      await result.current.handleResend();
    });

    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'password_reset',
        step: 'resend_email',
        message: 'Resend link blocked',
        level: 'info',
      })
    );
    expect(JSON.stringify(mockCaptureFlowFailure.mock.calls)).not.toContain(
      'user@example.com'
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '信件寄送失敗',
        description: 'Resend link blocked',
      })
    );
  });

  it('redirects to password forgot on handleChangeEmail', () => {
    const { result } = renderHook(() => usePasswordResend());

    act(() => {
      result.current.handleChangeEmail();
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/auth/password-forgot');
  });
});
