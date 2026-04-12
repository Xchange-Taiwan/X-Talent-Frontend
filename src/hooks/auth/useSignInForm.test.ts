import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

vi.mock('@/lib/actions/signIn', () => ({
  validateSignIn: vi.fn(),
}));

vi.mock('@/lib/monitoring', () => ({ captureFlowFailure: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));

import { validateSignIn } from '@/lib/actions/signIn';
import { mockRouter } from '@/test/mocks/navigation';
import { mockGetSession, mockSession, mockSignIn } from '@/test/mocks/nextAuth';
import { mockToast } from '@/test/mocks/useToast';

import useSignInForm from './useSignInForm';

const mockValidateSignIn = vi.mocked(validateSignIn);

const validValues = { email: 'user@example.com', password: 'Password1!' };

describe('useSignInForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateSignIn.mockResolvedValue({
      success: true,
      email: validValues.email,
      password: validValues.password,
    });
    mockSignIn.mockResolvedValue({ error: null });
    mockGetSession.mockResolvedValue(mockSession);
  });

  it('validateSignIn returns { error } → toast shows the error message, no redirect', async () => {
    mockValidateSignIn.mockResolvedValueOnce({ error: 'Invalid fields!' });

    const { result } = renderHook(() => useSignInForm());

    await act(async () => {
      await result.current.onSubmit(validValues);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: 'Invalid fields!',
      })
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('clientSignIn returns { error } → toast shows "Invalid credentials!", no redirect', async () => {
    mockSignIn.mockResolvedValueOnce({ error: 'CredentialsSignin' });

    const { result } = renderHook(() => useSignInForm());

    await act(async () => {
      await result.current.onSubmit(validValues);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: 'Invalid credentials!',
      })
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('getSession returns session with no accessToken → toast shows "Login failed", no redirect', async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { ...mockSession.user },
      expires: mockSession.expires,
    });

    const { result } = renderHook(() => useSignInForm());

    await act(async () => {
      await result.current.onSubmit(validValues);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: 'Login failed',
      })
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('success + onBoarding === false → router.push("/auth/onboarding")', async () => {
    mockGetSession.mockResolvedValueOnce({
      ...mockSession,
      user: { ...mockSession.user, onBoarding: false },
    });

    const { result } = renderHook(() => useSignInForm());

    await act(async () => {
      await result.current.onSubmit(validValues);
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/auth/onboarding');
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('success + onBoarding === true → router.push("/mentor-pool")', async () => {
    mockGetSession.mockResolvedValueOnce({
      ...mockSession,
      user: { ...mockSession.user, onBoarding: true },
    });

    const { result } = renderHook(() => useSignInForm());

    await act(async () => {
      await result.current.onSubmit(validValues);
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/mentor-pool');
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('unexpected error is thrown → toast shows "Something went wrong!"', async () => {
    mockValidateSignIn.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useSignInForm());

    await act(async () => {
      await result.current.onSubmit(validValues);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: 'Something went wrong!',
      })
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('after submission completes → isSubmitting is false', async () => {
    const { result } = renderHook(() => useSignInForm());

    await act(async () => {
      await result.current.onSubmit(validValues);
    });

    expect(result.current.isSubmitting).toBe(false);
  });
});
