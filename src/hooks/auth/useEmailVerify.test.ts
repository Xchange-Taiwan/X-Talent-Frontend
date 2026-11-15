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

import { ApiError } from '@/lib/apiClient';
import { PENDING_VERIFICATION_EMAIL_KEY } from '@/lib/auth/authFlowStorage';
import { authClient } from '@/services/auth/authClient';
import { mockRouter } from '@/test/mocks/navigation';
import { mockToast } from '@/test/mocks/useToast';

import { useEmailVerify } from './useEmailVerify';

const mockResendVerificationEmail = vi.mocked(
  authClient.resendVerificationEmail
);

describe('useEmailVerify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it('redirects to home when pending verification email is absent', () => {
    const { result } = renderHook(() => useEmailVerify());

    expect(result.current.email).toBeNull();
    expect(mockRouter.push).toHaveBeenCalledWith('/');
  });

  it('resends verification email via authClient and shows success toast', async () => {
    window.sessionStorage.setItem(
      PENDING_VERIFICATION_EMAIL_KEY,
      'pending@example.com'
    );
    mockResendVerificationEmail.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useEmailVerify());

    expect(result.current.email).toBe('pending@example.com');

    await act(async () => {
      await result.current.handleResendEmail();
    });

    expect(mockResendVerificationEmail).toHaveBeenCalledWith(
      'pending@example.com'
    );
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'default',
      title: '已重新寄送',
      description: '驗證信已重新寄送！',
    });
  });

  it('surfaces ApiError message on resend failure and navigates home on handleNavigateHome', async () => {
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

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '寄送失敗',
      description: '請稍後再重新寄送驗證信',
    });

    act(() => {
      result.current.handleNavigateHome();
    });
    expect(mockRouter.push).toHaveBeenCalledWith('/');
  });
});
