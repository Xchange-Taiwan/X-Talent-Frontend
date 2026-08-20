import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

import { mockToast } from '@/test/mocks/useToast';

import { useConfirmActionDialog } from './useConfirmActionDialog';

describe('useConfirmActionDialog', () => {
  const errorMessage = '動作失敗，請稍後再試';
  const onOpenMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with correct default states', () => {
    const { result } = renderHook(() =>
      useConfirmActionDialog({ errorMessage, onOpen: onOpenMock })
    );

    expect(result.current.open).toBe(false);
    expect(result.current.isSubmitting).toBe(false);
  });

  it('should handle onOpenChange and call onOpen when opening', () => {
    const { result } = renderHook(() =>
      useConfirmActionDialog({ errorMessage, onOpen: onOpenMock })
    );

    act(() => {
      result.current.onOpenChange(true);
    });

    expect(result.current.open).toBe(true);
    expect(onOpenMock).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.onOpenChange(false);
    });

    expect(result.current.open).toBe(false);
    // Should not call onOpen again when closing
    expect(onOpenMock).toHaveBeenCalledTimes(1);
  });

  it('should block onOpenChange when submitting', async () => {
    const { result } = renderHook(() =>
      useConfirmActionDialog({ errorMessage, onOpen: onOpenMock })
    );

    act(() => {
      result.current.onOpenChange(true);
    });

    let promiseResolve!: () => void;
    const actionPromise = new Promise<void>((resolve) => {
      promiseResolve = resolve;
    });

    // Start executing
    let executePromise: Promise<void>;
    act(() => {
      executePromise = result.current.execute(() => actionPromise);
    });

    expect(result.current.isSubmitting).toBe(true);

    // Try to close dialog while submitting - should be ignored
    act(() => {
      result.current.onOpenChange(false);
    });
    expect(result.current.open).toBe(true);

    // Resolve action and wait for execution to finish
    await act(async () => {
      promiseResolve();
      await executePromise;
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.open).toBe(false);
  });

  it('should handle successful execution and close dialog', async () => {
    const { result } = renderHook(() =>
      useConfirmActionDialog({ errorMessage, onOpen: onOpenMock })
    );

    act(() => {
      result.current.onOpenChange(true);
    });

    const action = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.execute(action);
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.open).toBe(false);
  });

  it('should handle failed execution, show toast, keep isSubmitting false, and keep dialog open', async () => {
    const { result } = renderHook(() =>
      useConfirmActionDialog({ errorMessage, onOpen: onOpenMock })
    );

    act(() => {
      result.current.onOpenChange(true);
    });

    const action = vi.fn().mockRejectedValue(new Error('API Error'));

    await act(async () => {
      await result.current.execute(action);
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.open).toBe(true); // Should not close on error

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      description: errorMessage,
    });
  });

  it('should resolve a function errorMessage using the caught error', async () => {
    class SpecialError extends Error {}
    const errorMessageFn = vi.fn((error: unknown) =>
      error instanceof SpecialError ? 'special message' : 'generic message'
    );

    const { result } = renderHook(() =>
      useConfirmActionDialog({
        errorMessage: errorMessageFn,
        onOpen: onOpenMock,
      })
    );

    act(() => {
      result.current.onOpenChange(true);
    });

    const action = vi.fn().mockRejectedValue(new SpecialError('boom'));

    await act(async () => {
      await result.current.execute(action);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      description: 'special message',
    });
  });
});
