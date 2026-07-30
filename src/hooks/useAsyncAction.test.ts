import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { captureFlowFailure } from '@/lib/monitoring';
import { mockToast } from '@/test/mocks/useToast';

import { useAsyncAction } from './useAsyncAction';

// Mock Dependencies
vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
}));

class LoggedError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'LoggedError';
  }
}

describe('useAsyncAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should toggle isPending correctly on successful execution', async () => {
    let resolveAction!: (value: string) => void;
    const actionPromise = new Promise<string>((resolve) => {
      resolveAction = resolve;
    });

    const { result } = renderHook(() => useAsyncAction());

    expect(result.current.isPending).toBe(false);

    let runPromise: Promise<string | undefined>;
    act(() => {
      runPromise = result.current.run(() => actionPromise);
    });

    // 執行中：isPending 應該為 true
    expect(result.current.isPending).toBe(true);

    await act(async () => {
      resolveAction('success-data');
      const val = await runPromise;
      expect(val).toBe('success-data');
    });

    // 執行完畢：isPending 應該還原為 false
    expect(result.current.isPending).toBe(false);
  });

  it('should reset isPending even when the action throws', async () => {
    let rejectAction!: (reason: Error) => void;
    const actionPromise = new Promise<never>((_, reject) => {
      rejectAction = reject;
    });

    const { result } = renderHook(() => useAsyncAction());

    expect(result.current.isPending).toBe(false);

    let runPromise!: Promise<never | undefined>;
    act(() => {
      runPromise = result.current.run(() => actionPromise) as Promise<never>;
    });

    expect(result.current.isPending).toBe(true);

    await act(async () => {
      rejectAction(new Error('failure-reason'));
      // 預設 throwError 為 true，因此應該拋出異常
      await expect(runPromise).rejects.toThrow('failure-reason');
    });

    // 拋出異常後：isPending 仍應被重置為 false
    expect(result.current.isPending).toBe(false);
  });

  it('should swallow error and return undefined if throwError is false', async () => {
    const { result } = renderHook(() => useAsyncAction());

    let val: string | undefined = 'initial';
    await act(async () => {
      val = await result.current.run(
        () => Promise.reject(new Error('swallowed-error')),
        { throwError: false }
      );
    });

    expect(val).toBeUndefined();
    expect(result.current.isPending).toBe(false);
  });

  it('should report failure via captureFlowFailure when flow and step are provided', async () => {
    const { result } = renderHook(() =>
      useAsyncAction({
        flow: 'test_flow',
        step: 'test_step',
      })
    );

    await act(async () => {
      await expect(
        result.current.run(() => Promise.reject(new Error('test-sentry-error')))
      ).rejects.toThrow('test-sentry-error');
    });

    expect(captureFlowFailure).toHaveBeenCalledWith({
      flow: 'test_flow',
      step: 'test_step',
      message: 'test-sentry-error',
    });
  });

  it('should gracefully handle captureFlowFailure rejections (e.g. ad blockers or network failures) without crashing and reset isPending', async () => {
    const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);
    mockCaptureFlowFailure.mockRejectedValueOnce(
      new Error('Sentry dynamic import failed')
    );

    const { result } = renderHook(() =>
      useAsyncAction({
        flow: 'test_flow',
        step: 'test_step',
      })
    );

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await act(async () => {
      await expect(
        result.current.run(() => Promise.reject(new Error('app-error')))
      ).rejects.toThrow('app-error');
    });

    expect(result.current.isPending).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[useAsyncAction] Failed to capture flow failure:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should NOT call captureFlowFailure if shouldSkipLogging returns true', async () => {
    const { result } = renderHook(() =>
      useAsyncAction({
        flow: 'test_flow',
        step: 'test_step',
        shouldSkipLogging: (err) => err instanceof LoggedError,
      })
    );

    await act(async () => {
      await expect(
        result.current.run(() =>
          Promise.reject(new LoggedError('already-logged'))
        )
      ).rejects.toThrow('already-logged');
    });

    expect(captureFlowFailure).not.toHaveBeenCalled();
  });

  it('should call toast with errorMessage when action throws and errorMessage is provided', async () => {
    const { result } = renderHook(() => useAsyncAction());

    await act(async () => {
      await expect(
        result.current.run(() => Promise.reject(new Error('some-error')), {
          errorMessage: '發生錯誤，請稍候再試',
          duration: 3000,
        })
      ).rejects.toThrow('some-error');
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      description: '發生錯誤，請稍候再試',
      duration: 3000,
    });
  });

  it('should call toast with errorTitle and errorMessage when both are provided', async () => {
    const { result } = renderHook(() => useAsyncAction());

    await act(async () => {
      await expect(
        result.current.run(() => Promise.reject(new Error('some-error')), {
          errorTitle: '發生錯誤',
          errorMessage: '請稍候再試',
        })
      ).rejects.toThrow('some-error');
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '發生錯誤',
      description: '請稍候再試',
      duration: 5000,
    });
  });

  it('should call custom onError callback if provided', async () => {
    const onErrorMock = vi.fn();
    const { result } = renderHook(() =>
      useAsyncAction({
        onError: onErrorMock,
      })
    );

    const testError = new Error('callback-error');

    await act(async () => {
      await expect(
        result.current.run(() => Promise.reject(testError))
      ).rejects.toThrow('callback-error');
    });

    expect(onErrorMock).toHaveBeenCalledWith(testError);
  });

  it('should support configuration overriding on run level', async () => {
    const { result } = renderHook(() =>
      useAsyncAction({
        flow: 'default_flow',
        step: 'default_step',
        errorMessage: 'default_toast',
      })
    );

    await act(async () => {
      await expect(
        result.current.run(() => Promise.reject(new Error('override-error')), {
          flow: 'override_flow',
          step: 'override_step',
          errorMessage: 'override_toast',
        })
      ).rejects.toThrow('override-error');
    });

    expect(captureFlowFailure).toHaveBeenCalledWith({
      flow: 'override_flow',
      step: 'override_step',
      message: 'override-error',
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      description: 'override_toast',
      duration: 5000,
    });
  });

  it('should prevent concurrent execution if preventConcurrent is true (default)', async () => {
    let resolveAction!: (value: string) => void;
    const actionPromise = new Promise<string>((resolve) => {
      resolveAction = resolve;
    });

    const secondActionSpy = vi.fn().mockResolvedValue('second-result');

    const { result } = renderHook(() => useAsyncAction());

    let runPromise1: Promise<string | undefined>;
    act(() => {
      runPromise1 = result.current.run(() => actionPromise);
    });

    expect(result.current.isPending).toBe(true);

    // 當處於 Pending 時，第二次呼叫 run 應該立即被防護攔截並返回 undefined
    let runPromise2!: Promise<string | undefined>;
    act(() => {
      runPromise2 = result.current.run(secondActionSpy);
    });

    await act(async () => {
      const res2 = await runPromise2;
      expect(res2).toBeUndefined();
      expect(secondActionSpy).not.toHaveBeenCalled();

      resolveAction('first-result');
      const res1 = await runPromise1;
      expect(res1).toBe('first-result');
    });

    expect(result.current.isPending).toBe(false);
  });

  it('should NOT prevent concurrent execution if preventConcurrent is set to false, and isPending stays true until all finish', async () => {
    let resolveAction1!: (value: string) => void;
    const actionPromise1 = new Promise<string>((resolve) => {
      resolveAction1 = resolve;
    });

    let resolveAction2!: (value: string) => void;
    const actionPromise2 = new Promise<string>((resolve) => {
      resolveAction2 = resolve;
    });

    const { result } = renderHook(() =>
      useAsyncAction({
        preventConcurrent: false,
      })
    );

    let runPromise1!: Promise<string | undefined>;
    let runPromise2!: Promise<string | undefined>;

    act(() => {
      runPromise1 = result.current.run(() => actionPromise1);
    });

    act(() => {
      runPromise2 = result.current.run(() => actionPromise2);
    });

    expect(result.current.isPending).toBe(true);

    // 完成第一個請求：isPending 應該仍保持為 true，因為第二個請求仍在執行中！
    await act(async () => {
      resolveAction1('res1');
    });
    const res1 = await runPromise1;
    expect(res1).toBe('res1');
    expect(result.current.isPending).toBe(true);

    // 完成第二個請求：此時所有併發請求結束，isPending 應該被設回 false
    await act(async () => {
      resolveAction2('res2');
    });
    const res2 = await runPromise2;
    expect(res2).toBe('res2');
    expect(result.current.isPending).toBe(false);
  });

  it('should NOT reset isPending on success if resetPendingOnSuccess is false', async () => {
    let resolveAction!: (value: string) => void;
    const actionPromise = new Promise<string>((resolve) => {
      resolveAction = resolve;
    });

    const { result } = renderHook(() =>
      useAsyncAction({
        resetPendingOnSuccess: false,
      })
    );

    let runPromise!: Promise<string | undefined>;
    act(() => {
      runPromise = result.current.run(() => actionPromise);
    });

    expect(result.current.isPending).toBe(true);

    await act(async () => {
      resolveAction('done');
      await runPromise;
    });

    // 成功後 isPending 應該保持為 true
    expect(result.current.isPending).toBe(true);
  });

  it('should be safe on component unmount and not call setState', async () => {
    let resolveAction!: (value: string) => void;
    const actionPromise = new Promise<string>((resolve) => {
      resolveAction = resolve;
    });

    const { result, unmount } = renderHook(() => useAsyncAction());

    let runPromise!: Promise<string | undefined>;
    act(() => {
      runPromise = result.current.run(() => actionPromise);
    });

    expect(result.current.isPending).toBe(true);

    // 卸載組件
    unmount();

    await act(async () => {
      resolveAction('unmounted-done');
      const res = await runPromise;
      expect(res).toBe('unmounted-done');
    });

    // 卸載後 isPending 不應更新（雖然讀取 result.current 可能還是最後的狀態，但我們不希望拋出 React 記憶體洩漏警告）
  });
});
