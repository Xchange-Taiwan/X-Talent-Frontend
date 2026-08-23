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

vi.mock('@/services/auth/signUp', () => ({
  signUp: vi.fn(),
}));

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

import { trackEvent } from '@/lib/analytics';
import { ApiError } from '@/lib/apiClient';
import { captureFlowFailure } from '@/lib/monitoring';
import { signUp } from '@/services/auth/signUp';
import { mockRouter } from '@/test/mocks/navigation';
import { mockToast } from '@/test/mocks/useToast';

import useSignUpForm from './useSignUpForm';

const mockSignUp = vi.mocked(signUp);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);
const mockTrackEvent = vi.mocked(trackEvent);

const validValues = {
  email: 'test@example.com',
  password: 'Password1!',
  confirm_password: 'Password1!',
  hasReadTermsOfService: true,
};

describe('useSignUpForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup standard sessionStorage mock
    const store: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((key) => delete store[key]);
      },
    };
    Object.defineProperty(window, 'sessionStorage', {
      value: mockStorage,
      writable: true,
    });
  });

  it('tracks sign_up_started on mount', () => {
    renderHook(() => useSignUpForm());
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: 'sign_up_started',
      feature: 'auth',
    });
  });

  it('submits form successfully', async () => {
    mockSignUp.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useSignUpForm());

    await act(async () => {
      await result.current.onSubmit(validValues);
    });

    expect(mockSignUp).toHaveBeenCalledWith(validValues);
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: 'sign_up_succeeded',
      feature: 'auth',
    });
    expect(sessionStorage.getItem('email')).toBe(validValues.email);
    expect(mockRouter.push).toHaveBeenCalledWith('/auth/email-verify');
  });

  it('handles general non-ApiError during submission', async () => {
    mockSignUp.mockRejectedValueOnce(new Error('Unexpected network error'));

    const { result } = renderHook(() => useSignUpForm());

    await act(async () => {
      await result.current.onSubmit(validValues);
    });

    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'sign_up',
        step: 'submit',
        message: 'Unexpected network error',
        errorCode: undefined,
        level: 'info',
      })
    );
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '註冊失敗',
      description: 'Unexpected network error',
    });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('handles ApiError 422 (validation error)', async () => {
    const apiError = new ApiError(422, '輸入欄位驗證錯誤');
    mockSignUp.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useSignUpForm());

    await act(async () => {
      await result.current.onSubmit(validValues);
    });

    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'sign_up',
        step: 'submit',
        message: '輸入欄位驗證錯誤',
        errorCode: '422',
        level: 'info',
      })
    );
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '驗證失敗',
      description: '輸入欄位驗證錯誤',
    });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('handles ApiError 406 (email already registered)', async () => {
    const apiError = new ApiError(406, '電子郵件已被佔用');
    mockSignUp.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useSignUpForm());

    await act(async () => {
      await result.current.onSubmit(validValues);
    });

    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'sign_up',
        step: 'submit',
        message: '電子郵件已被佔用',
        errorCode: '406',
        level: 'info',
      })
    );
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '註冊失敗',
      description: '電子郵件已被佔用',
    });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('handles ApiError 429 (rate limit exceeded)', async () => {
    const apiError = new ApiError(429, 'Too many requests');
    mockSignUp.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useSignUpForm());

    await act(async () => {
      await result.current.onSubmit(validValues);
    });

    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'sign_up',
        step: 'submit',
        message: 'Too many requests',
        errorCode: '429',
        level: 'info',
      })
    );
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '請求過於頻繁',
      description: 'Too many requests',
    });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('handles other ApiErrors (e.g. 500)', async () => {
    const apiError = new ApiError(500, 'Internal DB crash');
    mockSignUp.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useSignUpForm());

    await act(async () => {
      await result.current.onSubmit(validValues);
    });

    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'sign_up',
        step: 'submit',
        message: 'Internal DB crash',
        errorCode: '500',
        level: 'info',
      })
    );
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '註冊失敗',
      description: 'Internal DB crash - HTTP狀態碼: 500。',
    });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
