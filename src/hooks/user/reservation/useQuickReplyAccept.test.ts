import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

import { mockToast } from '@/test/mocks/useToast';

import { useQuickReplyAccept } from './useQuickReplyAccept';

describe('useQuickReplyAccept', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs the action and reports success without a toast', async () => {
    const { result } = renderHook(() => useQuickReplyAccept());
    const action = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.execute(action);
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.isSubmitting).toBe(false);
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('shows the fallback destructive toast and swallows the error on failure', async () => {
    const { result } = renderHook(() => useQuickReplyAccept());
    const action = vi.fn().mockRejectedValue(new Error('API Error'));

    await act(async () => {
      await result.current.execute(action);
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: '接受預約失敗,請稍後再試',
      })
    );
  });

  it('sets isSubmitting while the action is in flight', async () => {
    const { result } = renderHook(() => useQuickReplyAccept());
    let resolveAction!: () => void;
    const action = vi.fn(
      () => new Promise<void>((resolve) => (resolveAction = resolve))
    );

    let executePromise: Promise<unknown>;
    act(() => {
      executePromise = result.current.execute(action);
    });

    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      resolveAction();
      await executePromise;
    });

    expect(result.current.isSubmitting).toBe(false);
  });
});
