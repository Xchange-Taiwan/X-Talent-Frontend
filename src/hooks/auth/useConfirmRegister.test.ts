import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('@/services/auth/confirmRegister', () => ({
  confirmRegister: vi.fn(),
}));

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

import { confirmRegister } from '@/services/auth/confirmRegister';
import { mockSearchParams } from '@/test/mocks/navigation';
import { mockToast } from '@/test/mocks/useToast';

import { useConfirmRegister } from './useConfirmRegister';

const mockConfirmRegister = vi.mocked(confirmRegister);

describe('useConfirmRegister', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.get.mockReturnValue(null);
  });

  it('no token on URL → status is failure, calls toast with "缺少驗證 Token"', () => {
    mockSearchParams.get.mockReturnValue(null);

    const { result } = renderHook(() => useConfirmRegister());

    expect(result.current.status).toBe('failure');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '驗證失敗',
        description: '缺少驗證 Token，請重新申請驗證信。',
      })
    );
    expect(mockConfirmRegister).not.toHaveBeenCalled();
  });

  it('token on URL + confirmRegister succeeds → status transitions from loading to success', async () => {
    mockSearchParams.get.mockReturnValue('valid-token');

    let resolvePromise!: () => void;
    const apiPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });
    mockConfirmRegister.mockReturnValueOnce(apiPromise);

    const { result } = renderHook(() => useConfirmRegister());

    // Initial state should be loading
    expect(result.current.status).toBe('loading');

    // Resolve the promise
    await act(async () => {
      resolvePromise();
      await apiPromise;
    });

    expect(result.current.status).toBe('success');
    expect(mockConfirmRegister).toHaveBeenCalledWith('valid-token');
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('token on URL + confirmRegister fails → status transitions from loading to failure and shows toast', async () => {
    mockSearchParams.get.mockReturnValue('invalid-token');
    mockConfirmRegister.mockRejectedValueOnce(new Error('驗證連結已失效'));

    const { result } = renderHook(() => useConfirmRegister());

    // Wait for the hook to finish processing the async confirmRegister call
    await act(async () => {
      await Promise.resolve(); // allow microtasks to flush
    });

    expect(result.current.status).toBe('failure');
    expect(mockConfirmRegister).toHaveBeenCalledWith('invalid-token');
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

    // Simulate strict mode unmount & remount by rerendering (effects are re-run)
    rerender();

    await act(async () => {
      await Promise.resolve();
    });

    // API should only be called once
    expect(mockConfirmRegister).toHaveBeenCalledTimes(1);
  });

  it('token dynamically changes → resets state to loading and triggers a new API verification call', async () => {
    mockSearchParams.get.mockReturnValue('token-1');
    mockConfirmRegister.mockResolvedValue();

    const { rerender, result } = renderHook(() => useConfirmRegister());

    expect(mockConfirmRegister).toHaveBeenCalledWith('token-1');
    expect(result.current.status).toBe('loading');

    // Dynamically change token and rerender
    mockSearchParams.get.mockReturnValue('token-2');
    rerender();

    // Verification state should reset to loading while token-2 is being verified
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

    // Dynamically remove token and rerender
    mockSearchParams.get.mockReturnValue(null);
    rerender();

    // State should immediately become failure and trigger the toast
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
    // 1. Initial token: token-1
    mockSearchParams.get.mockReturnValue('token-1');

    let resolve1!: () => void;
    const promise1 = new Promise<void>((resolve) => {
      resolve1 = resolve;
    });
    mockConfirmRegister.mockReturnValueOnce(promise1);

    const { rerender, result } = renderHook(() => useConfirmRegister());

    expect(result.current.status).toBe('loading');

    // 2. Dynamically change token to token-2
    mockSearchParams.get.mockReturnValue('token-2');

    let resolve2!: () => void;
    const promise2 = new Promise<void>((resolve) => {
      resolve2 = resolve;
    });
    mockConfirmRegister.mockReturnValueOnce(promise2);

    rerender(); // Trigger effect for token-2

    // 3. Resolve promise2 first (the newer request)
    await act(async () => {
      resolve2();
      await promise2;
    });

    expect(result.current.status).toBe('success');

    // 4. Resolve promise1 last (the older/stale request)
    await act(async () => {
      resolve1();
      await promise1;
    });

    // It should still be 'success' (from token-2), NOT overwritten by the stale token-1 response!
    expect(result.current.status).toBe('success');
    expect(mockToast).not.toHaveBeenCalled();
  });
});
