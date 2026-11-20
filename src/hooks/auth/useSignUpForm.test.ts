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

import { ApiError } from '@/lib/apiClient';
import {
  authLifecycle,
  createAuthLifecycle,
  createInMemorySessionStorage,
} from '@/lib/auth/sessionLifecycle';
import { SignUpSchema } from '@/schemas/auth';
import { mockRouter } from '@/test/mocks/navigation';
import { mockToast } from '@/test/mocks/useToast';

import useSignUpForm from './useSignUpForm';

const validValues = {
  email: 'test@example.com',
  password: 'Password1!',
  confirm_password: 'Password1!',
  hasReadTermsOfService: true,
};

describe('useSignUpForm (#940)', () => {
  const signUpFn = vi.fn();
  const trackEvent = vi.fn();
  let storage = createInMemorySessionStorage();

  beforeEach(() => {
    vi.clearAllMocks();
    storage = createInMemorySessionStorage();
    const scoped = createAuthLifecycle({
      authClient: { signUp: signUpFn },
      storage,
      trackEvent,
      captureFailure: vi.fn(),
    });
    vi.spyOn(authLifecycle, 'trackSignUpStarted').mockImplementation(
      (overrides) => scoped.trackSignUpStarted(overrides)
    );
    vi.spyOn(authLifecycle, 'signUpWithCredentials').mockImplementation(
      (values, overrides) => scoped.signUpWithCredentials(values, overrides)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tracks sign_up_started on mount and keeps isSubmitting=true on successful redirect', async () => {
    signUpFn.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useSignUpForm());
    expect(trackEvent).toHaveBeenCalledWith({
      name: 'sign_up_started',
      feature: 'auth',
    });

    await act(async () => {
      await result.current.onSubmit(validValues);
    });

    expect(signUpFn).toHaveBeenCalledWith(validValues);
    expect(storage.getItem('email')).toBe(validValues.email);
    expect(mockRouter.push).toHaveBeenCalledWith('/auth/email-verify');
    expect(result.current.isSubmitting).toBe(true);
  });

  it('resets isSubmitting=false and surfaces destructive toast when signUpWithCredentials fails', async () => {
    signUpFn.mockRejectedValueOnce(new ApiError(406, '電子郵件已被佔用'));

    const { result } = renderHook(() => useSignUpForm());

    await act(async () => {
      await result.current.onSubmit(validValues);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '註冊失敗',
        description: '電子郵件已被佔用',
      })
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
  });

  it('initializes confirm_password in defaultValues and produces Traditional Chinese validation errors instead of "Required" (#804)', async () => {
    const { result } = renderHook(() => useSignUpForm());

    expect(result.current.form.getValues()).toEqual({
      email: '',
      password: '',
      confirm_password: '',
      hasReadTermsOfService: false,
    });

    const onInvalid = vi.fn();
    await act(async () => {
      await result.current.form.handleSubmit(vi.fn(), onInvalid)();
    });

    expect(onInvalid).toHaveBeenCalledTimes(1);
    const errors = onInvalid.mock.calls[0][0];
    expect(errors.email?.message).toBe('請輸入電子郵件');
    expect(errors.password?.message).toBe('密碼至少需為 8 個字');
    expect(errors.confirm_password?.message).toBe('密碼至少需為 8 個字');
    expect(errors.hasReadTermsOfService?.message).toBe('請確認並同意服務條款');

    const parsed = SignUpSchema.safeParse({});
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        expect(issue.message).not.toBe('Required');
      }
    }
  });
});
