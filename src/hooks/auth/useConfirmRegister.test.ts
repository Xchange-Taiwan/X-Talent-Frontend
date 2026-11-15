import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('@/services/auth/authClient', () => ({
  authClient: {
    confirmSignUp: vi.fn(),
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

import { PENDING_VERIFICATION_EMAIL_KEY } from '@/lib/auth/authFlowStorage';
import { captureFlowFailure } from '@/lib/monitoring';
import { authClient } from '@/services/auth/authClient';
import { mockSearchParams } from '@/test/mocks/navigation';
import { mockToast } from '@/test/mocks/useToast';

import { useConfirmRegister } from './useConfirmRegister';

const mockConfirmRegister = vi.mocked(authClient.confirmSignUp);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);

describe('useConfirmRegister', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mockSearchParams.get.mockReturnValue(null);
  });

  it('no token on URL → status is failure, logs structured failure without token PII, and calls toast with "缺少驗證 Token"', () => {
    mockSearchParams.get.mockReturnValue(null);

    const { result } = renderHook(() => useConfirmRegister());

    expect(result.current.status).toBe('failure');
    expect(mockCaptureFlowFailure).toHaveBeenCalledWith({
      flow: 'email_verification',
      step: 'missing_token',
      message: 'Missing signup confirmation token',
      level: 'info',
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '驗證失敗',
        description: '缺少驗證 Token，請重新申請驗證信。',
      })
    );
    expect(mockConfirmRegister).not.toHaveBeenCalled();
  });

  it('token on URL + confirmRegister succeeds → status transitions to success and clears pending verification email PII from sessionStorage (#904)', async () => {
    window.sessionStorage.setItem(
      PENDING_VERIFICATION_EMAIL_KEY,
      'pending-user@example.com'
    );
    mockSearchParams.get.mockReturnValue('valid-token');

    let resolvePromise!: () => void;
    const apiPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });
    mockConfirmRegister.mockReturnValueOnce(apiPromise);

    const { result } = renderHook(() => useConfirmRegister());

    expect(result.current.status).toBe('loading');

    await act(async () => {
      resolvePromise();
      await apiPromise;
    });

    expect(result.current.status).toBe('success');
    expect(mockConfirmRegister).toHaveBeenCalledWith('valid-token');
    expect(
      window.sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY)
    ).toBeNull();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('token on URL + confirmRegister fails → status transitions from loading to failure, logs captureFlowFailure without raw token, and shows toast', async () => {
    mockSearchParams.get.mockReturnValue('secret-invalid-token-999');
    mockConfirmRegister.mockRejectedValueOnce(new Error('驗證連結已失效'));

    const { result } = renderHook(() => useConfirmRegister());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status).toBe('failure');
    expect(mockConfirmRegister).toHaveBeenCalledWith(
      'secret-invalid-token-999'
    );
    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'email_verification',
        step: 'confirm_token',
        message: '驗證連結已失效',
        level: 'info',
      })
    );
    expect(JSON.stringify(mockCaptureFlowFailure.mock.calls)).not.toContain(
      'secret-invalid-token-999'
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '註冊失敗',
        description: '驗證連結已失效',
      })
    );
  });

  it('Strict Mode double-mount simulation → does not call API or toast twice', async () => {
    mockSearchParams.get.mockReturnValue('valid-token');
    mockConfirmRegister.mockResolvedValueOnce();

    const { rerender } = renderHook(() => useConfirmRegister());

    rerender();

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockConfirmRegister).toHaveBeenCalledTimes(1);
  });

  it('token dynamically changes → resets state to loading and triggers a new API verification call', async () => {
    mockSearchParams.get.mockReturnValue('token-1');
    mockConfirmRegister.mockResolvedValue();

    const { rerender, result } = renderHook(() => useConfirmRegister());

    expect(mockConfirmRegister).toHaveBeenCalledWith('token-1');
    expect(result.current.status).toBe('loading');

    mockSearchParams.get.mockReturnValue('token-2');
    rerender();

    expect(result.current.status).toBe('loading');

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockConfirmRegister).toHaveBeenCalledWith('token-2');
    expect(mockConfirmRegister).toHaveBeenCalledTimes(2);
  });

  it('token dynamically removed → resets state to failure and triggers missing token toast', async () => {
    mockSearchParams.get.mockReturnValue('token-1');
    mockConfirmRegister.mockResolvedValue();

    const { rerender, result } = renderHook(() => useConfirmRegister());

    expect(result.current.status).toBe('loading');

    mockSearchParams.get.mockReturnValue(null);
    rerender();

    expect(result.current.status).toBe('failure');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '驗證失敗',
        description: '缺少驗證 Token，請重新申請驗證信。',
      })
    );
  });

  it('handles race conditions: ignores stale API responses', async () => {
    mockSearchParams.get.mockReturnValue('token-1');

    let resolve1!: () => void;
    const promise1 = new Promise<void>((resolve) => {
      resolve1 = resolve;
    });
    mockConfirmRegister.mockReturnValueOnce(promise1);

    const { rerender, result } = renderHook(() => useConfirmRegister());

    expect(result.current.status).toBe('loading');

    mockSearchParams.get.mockReturnValue('token-2');

    let resolve2!: () => void;
    const promise2 = new Promise<void>((resolve) => {
      resolve2 = resolve;
    });
    mockConfirmRegister.mockReturnValueOnce(promise2);

    rerender();

    await act(async () => {
      resolve2();
      await promise2;
    });

    expect(result.current.status).toBe('success');

    await act(async () => {
      resolve1();
      await promise1;
    });

    expect(result.current.status).toBe('success');
    expect(mockToast).not.toHaveBeenCalled();
  });
});
