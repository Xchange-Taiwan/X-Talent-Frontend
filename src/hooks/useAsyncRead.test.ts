import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AsyncReadManager } from '@/lib/asyncReadManager';
import { createKeyedCache } from '@/lib/createKeyedCache';

import { useAsyncRead } from './useAsyncRead';

describe('useAsyncRead hook tests', () => {
  it('correctly mounts, triggers subscription, and returns resolved value', async () => {
    const manager = new AsyncReadManager<string, string>();
    const fetcher = vi.fn().mockResolvedValue('hook-data');

    const { result } = renderHook(() => useAsyncRead(manager, 'key', fetcher));

    expect(result.current).toEqual({
      data: null,
      isLoading: true,
      error: null,
      refetch: expect.any(Function),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current).toEqual({
      data: 'hook-data',
      isLoading: false,
      error: null,
      refetch: expect.any(Function),
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('synchronously updates state on key change (Derived State Pattern) without visual flicker', async () => {
    const cache = createKeyedCache<string, string>();
    cache.set('key1', 'cached-1');
    cache.set('key2', 'cached-2');
    const manager = new AsyncReadManager<string, string>(cache);

    const { result, rerender } = renderHook(
      ({ key }) => useAsyncRead(manager, key, () => Promise.resolve('')),
      { initialProps: { key: 'key1' } }
    );

    // Initial render synchronously uses cache-1
    expect(result.current).toEqual({
      data: 'cached-1',
      isLoading: false,
      error: null,
      refetch: expect.any(Function),
    });

    // Synchronously change key during render (Derived State)
    rerender({ key: 'key2' });

    // Should synchronously yield cached-2 without needing any useEffect cycle
    expect(result.current).toEqual({
      data: 'cached-2',
      isLoading: false,
      error: null,
      refetch: expect.any(Function),
    });
  });

  it('aborts request and cleans up when component unmounts', async () => {
    const manager = new AsyncReadManager<string, string>();
    let aborted = false;
    const fetcher = (signal: AbortSignal) => {
      signal.addEventListener('abort', () => {
        aborted = true;
      });
      return new Promise<string>(() => {});
    };

    const { unmount } = renderHook(() => useAsyncRead(manager, 'key', fetcher));

    expect(aborted).toBe(false);

    unmount();
    expect(aborted).toBe(true);
  });

  it('skips fetching and returns empty state when key is null or undefined', () => {
    const manager = new AsyncReadManager<string, string>();
    const fetcher = vi.fn();

    const { result } = renderHook(() => useAsyncRead(manager, null, fetcher));

    expect(result.current).toEqual({
      data: null,
      isLoading: false,
      error: null,
      refetch: expect.any(Function),
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('respects initialData and returns it synchronously on initial render', async () => {
    const manager = new AsyncReadManager<string, string>();
    const fetcher = vi.fn().mockResolvedValue('hook-data');

    const renderedValues: Array<{
      data: string | null;
      isLoading: boolean;
      error: string | null;
      refetch: () => void;
    }> = [];
    const { result } = renderHook(() => {
      const res = useAsyncRead(manager, 'key', fetcher, {
        initialData: 'initial-data',
      });
      renderedValues.push(res);
      return res;
    });

    // The very first rendered value (during the synchronous render phase, before useEffect)
    // should have data: 'initial-data' and isLoading: false.
    expect(renderedValues[0]).toEqual({
      data: 'initial-data',
      isLoading: false,
      error: null,
      refetch: expect.any(Function),
    });

    // It should still eventually trigger fetcher and update data
    await waitFor(() => {
      expect(result.current.data).toBe('hook-data');
    });

    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('triggers a fresh fetch with force: true options when refetch is called', async () => {
    const cache = createKeyedCache<string, string>();
    const manager = new AsyncReadManager<string, string>(cache);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce('data-1')
      .mockResolvedValueOnce('data-2');

    const { result } = renderHook(() => useAsyncRead(manager, 'key', fetcher));

    await waitFor(() => {
      expect(result.current.data).toBe('data-1');
    });

    expect(fetcher).toHaveBeenCalledTimes(1);

    // Trigger refetch
    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.data).toBe('data-2');
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
