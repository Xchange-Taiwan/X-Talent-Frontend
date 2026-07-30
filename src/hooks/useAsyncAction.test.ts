import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
}));

import { captureFlowFailure } from '@/lib/monitoring';
import { mockToast } from '@/test/mocks/useToast';

import useAsyncAction from './useAsyncAction';

const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);

describe('useAsyncAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs async function and toggles isPending correctly on success', async () => {
    const { result } = renderHook(() => useAsyncAction());

    expect(result.current.isPending).toBe(false);

    let resolvePromise!: (value: string) => void;
    const promise = new Promise<string>((resolve) => {
      resolvePromise = resolve;
    });

    const actionFn = vi.fn().mockReturnValue(promise);

    let runPromise: Promise<string | undefined>;
    act(() => {
      runPromise = result.current.run(actionFn);
    });

    expect(result.current.isPending).toBe(true);
    expect(actionFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePromise('success-data');
      const val = await runPromise;
      expect(val).toBe('success-data');
    });

    expect(result.current.isPending).toBe(false);
  });

  it('runs async function, toggles isPending, and triggers onError and finally resets when throwing', async () => {
    const { result } = renderHook(() => useAsyncAction());

    const error = new Error('action failed');
    const actionFn = vi.fn().mockRejectedValue(error);
    const onErrorMock = vi.fn();

    expect(result.current.isPending).toBe(false);

    let res: string | undefined;
    await act(async () => {
      res = await result.current.run(actionFn, { onError: onErrorMock });
    });

    expect(result.current.isPending).toBe(false);
    expect(res).toBeUndefined();
    expect(onErrorMock).toHaveBeenCalledWith(error);
  });

  it('rethrows when rethrow is true', async () => {
    const { result } = renderHook(() => useAsyncAction());

    const error = new Error('action failed');
    const actionFn = vi.fn().mockRejectedValue(error);

    await act(async () => {
      await expect(
        result.current.run(actionFn, { rethrow: true })
      ).rejects.toThrow('action failed');
    });

    expect(result.current.isPending).toBe(false);
  });

  it('captures flow failure and triggers toast with correct details on error', async () => {
    const { result } = renderHook(() => useAsyncAction());

    const error = new Error('some unexpected network issue');
    const actionFn = vi.fn().mockRejectedValue(error);

    await act(async () => {
      await result.current.run(actionFn, {
        captureFailure: {
          flow: 'test_flow',
          step: 'test_step',
          level: 'warning',
        },
        toastOnError: {
          title: 'Custom Title',
          description: (err) =>
            err instanceof Error ? `Failed: ${err.message}` : 'Failed',
          duration: 2000,
        },
      });
    });

    expect(mockCaptureFlowFailure).toHaveBeenCalledWith({
      flow: 'test_flow',
      step: 'test_step',
      message: 'some unexpected network issue',
      level: 'warning',
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: 'Custom Title',
      description: 'Failed: some unexpected network issue',
      duration: 2000,
    });
  });

  it('captures flow failure with dynamic message callback', async () => {
    const { result } = renderHook(() => useAsyncAction());

    const error = new Error('database timeout');
    const actionFn = vi.fn().mockRejectedValue(error);

    await act(async () => {
      await result.current.run(actionFn, {
        captureFailure: {
          flow: 'dynamic_flow',
          step: 'dynamic_step',
          message: (err) =>
            err instanceof Error ? `Dynamic error: ${err.message}` : 'fallback',
        },
      });
    });

    expect(mockCaptureFlowFailure).toHaveBeenCalledWith({
      flow: 'dynamic_flow',
      step: 'dynamic_step',
      message: 'Dynamic error: database timeout',
      level: undefined,
    });
  });

  it('calls onSuccess on successful execution', async () => {
    const { result } = renderHook(() => useAsyncAction());

    const actionFn = vi.fn().mockResolvedValue('ok');
    const onSuccessMock = vi.fn();

    let res: string | undefined;
    await act(async () => {
      res = await result.current.run(actionFn, { onSuccess: onSuccessMock });
    });

    expect(res).toBe('ok');
    expect(onSuccessMock).toHaveBeenCalledWith('ok');
  });
});
