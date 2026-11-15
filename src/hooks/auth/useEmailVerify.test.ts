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
    resendVerificationEmail: vi.fn(),
  },
}));

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
  sanitize: (val: string) => val,
}));

import { ApiError } from '@/lib/apiClient';
import { PENDING_VERIFICATION_EMAIL_KEY } from '@/lib/auth/authFlowStorage';
import { captureFlowFailure } from '@/lib/monitoring';
import { authClient } from '@/services/auth/authClient';
import { mockRouter } from '@/test/mocks/navigation';
import { mockToast } from '@/test/mocks/useToast';

import { useEmailVerify } from './useEmailVerify';

const mockResendVerificationEmail = vi.mocked(
  authClient.resendVerificationEmail
);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);

describe('useEmailVerify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it('redirects to home when pending verification email is absent', () => {
    const { result } = renderHook(() => useEmailVerify());

    expect(result.current.email).toBeNull();
    expect(result.current.isResending).toBe(false);
    expect(mockRouter.push).toHaveBeenCalledWith('/');
  });

  it('exposes isResending while resending verification email via authClient and shows success toast', async () => {
    window.sessionStorage.setItem(
      PENDING_VERIFICATION_EMAIL_KEY,
      'pending@example.com'
    );

    let resolveResend!: () => void;
    const resendPromise = new Promise<void>((resolve) => {
      resolveResend = resolve;
    });
    mockResendVerificationEmail.mockReturnValueOnce(resendPromise);

    const { result } = renderHook(() => useEmailVerify());

    expect(result.current.email).toBe('pending@example.com');
    expect(result.current.isResending).toBe(false);

    let pendingCall!: Promise<void>;
    act(() => {
      pendingCall = result.current.handleResendEmail();
    });

    expect(result.current.isResending).toBe(true);

    await act(async () => {
      resolveResend();
      await pendingCall;
    });

    expect(result.current.isResending).toBe(false);
    expect(mockResendVerificationEmail).toHaveBeenCalledWith(
      'pending@example.com'
    );
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'default',
      title: '已重新寄送',
      description: '驗證信已重新寄送！',
    });
  });

  it('surfaces ApiError message, logs structured captureFlowFailure without email PII, and navigates home on handleNavigateHome', async () => {
    window.sessionStorage.setItem(
      PENDING_VERIFICATION_EMAIL_KEY,
      'pending@example.com'
    );
    mockResendVerificationEmail.mockRejectedValueOnce(
      new ApiError(429, '請稍後再重新寄送驗證信')
    );

    const { result } = renderHook(() => useEmailVerify());

    await act(async () => {
      await result.current.handleResendEmail();
    });

    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'email_verification',
        step: 'resend',
        message: '請稍後再重新寄送驗證信',
        errorCode: '429',
        level: 'info',
      })
    );
    expect(JSON.stringify(mockCaptureFlowFailure.mock.calls)).not.toContain(
      'pending@example.com'
    );
    expect(mockToast).toHaveBeenCalledWith(
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
