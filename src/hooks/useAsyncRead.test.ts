import { renderHook, waitFor } from '@testing-library/react';
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
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current).toEqual({
      data: 'hook-data',
      isLoading: false,
      error: null,
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
    });

    // Synchronously change key during render (Derived State)
    rerender({ key: 'key2' });

    // Should synchronously yield cached-2 without needing any useEffect cycle
    expect(result.current).toEqual({
      data: 'cached-2',
      isLoading: false,
      error: null,
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
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
