import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AsyncReadManager } from '@/lib/asyncReadManager';

import { useAsyncRead } from './useAsyncRead';

describe('useAsyncRead hook tests', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it('synchronously updates state on key change (Derived State Pattern) without visual flicker', () => {
    const manager = new AsyncReadManager<string, string>();
    manager.set('key1', 'cached-1');
    manager.set('key2', 'cached-2');

    const { result, rerender } = renderHook(
      ({ key }) => useAsyncRead(manager, key, () => Promise.resolve('')),
      { initialProps: { key: 'key1' } }
    );

    expect(result.current).toEqual({
      data: 'cached-1',
      isLoading: false,
      error: null,
      refetch: expect.any(Function),
    });

    rerender({ key: 'key2' });

    expect(result.current).toEqual({
      data: 'cached-2',
      isLoading: false,
      error: null,
      refetch: expect.any(Function),
    });
  });

  it('performs non-destructive TTL SWR revalidation without flashing a loading skeleton on render', async () => {
    vi.useFakeTimers();
    const manager = new AsyncReadManager<string, string>({ ttlMs: 1_000 });
    manager.set('key', 'stale-value');

    // Expire the entry before mounting
    vi.advanceTimersByTime(1_001);

    let resolveRevalidation: (value: string) => void = () => {};
    const fetcher = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveRevalidation = resolve;
        })
    );

    const renderedStates: Array<{ data: string | null; isLoading: boolean }> =
      [];
    const { result } = renderHook(() => {
      const res = useAsyncRead(manager, 'key', fetcher);
      renderedStates.push({ data: res.data, isLoading: res.isLoading });
      return res;
    });

    // Synchronous first render AND post-effect subscription keep stale-value with isLoading: false
    expect(renderedStates[0]).toEqual({
      data: 'stale-value',
      isLoading: false,
    });
    expect(result.current.data).toBe('stale-value');
    expect(result.current.isLoading).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();

    await act(async () => {
      resolveRevalidation('fresh-value');
      await Promise.resolve();
    });

    expect(result.current.data).toBe('fresh-value');
    expect(result.current.isLoading).toBe(false);
    expect(
      renderedStates.every((snapshot) => snapshot.isLoading === false)
    ).toBe(true);
  });

  it('aborts request and cleans up when component unmounts', () => {
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

  it('respects initialData on initial render, warms the cache post-mount without redundant refetch, and preserves fresher client-primed entries', () => {
    const manager = new AsyncReadManager<string, string>();
    const fetcher = vi.fn().mockResolvedValue('hook-data');

    const renderedValues: Array<{
      data: string | null;
      isLoading: boolean;
      error: string | null;
      refetch: () => void;
    }> = [];
    const { unmount } = renderHook(() => {
      const res = useAsyncRead(manager, 'key', fetcher, {
        initialData: 'initial-data',
      });
      renderedValues.push(res);
      return res;
    });

    expect(renderedValues[0]).toEqual({
      data: 'initial-data',
      isLoading: false,
      error: null,
      refetch: expect.any(Function),
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(manager.get('key')).toBe('initial-data');

    unmount();

    // If a fresher client value is primed later, stale SSR initialData does not overwrite it
    manager.prime('key', 'client-primed');
    const { result: hydratedWithStaleSsr } = renderHook(() =>
      useAsyncRead(manager, 'key', fetcher, {
        initialData: 'stale-ssr-data',
      })
    );
    expect(hydratedWithStaleSsr.current.data).toBe('client-primed');
    expect(manager.get('key')).toBe('client-primed');
  });

  it('does not cache initialData when shouldCache returns false, still subscribes, and fetches valid network data', async () => {
    const manager = new AsyncReadManager<string, string>();
    let resolveFetch: (value: string) => void = () => {};
    const fetcher = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFetch = resolve;
        })
    );

    const { result, unmount } = renderHook(() =>
      useAsyncRead(manager, 'key', fetcher, {
        initialData: 'invalid-ssr-data',
        shouldCache: (val) => val !== 'invalid-ssr-data',
      })
    );

    expect(result.current.data).toBe('invalid-ssr-data');
    expect(result.current.isLoading).toBe(false);
    expect(manager.get('key')).toBeUndefined();
    expect(manager.peek('key')).toBeUndefined();
    expect(manager.getListenerCount('key')).toBe(1);
    expect(fetcher).toHaveBeenCalledOnce();

    await act(async () => {
      resolveFetch('valid-network-data');
      await Promise.resolve();
    });

    expect(result.current.data).toBe('valid-network-data');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(manager.get('key')).toBe('valid-network-data');

    unmount();
  });

  it('preserves stale cache over SSR initialData without aborting SWR revalidation, then updates to fresh network value', async () => {
    vi.useFakeTimers();
    const manager = new AsyncReadManager<string, string>({ ttlMs: 1_000 });
    manager.set('key', 'stale-value');

    // Expire the entry before mounting with SSR initialData
    vi.advanceTimersByTime(1_001);

    let aborted = false;
    let resolveRevalidation: (value: string) => void = () => {};
    const fetcher = vi.fn((signal: AbortSignal) => {
      signal.addEventListener('abort', () => {
        aborted = true;
      });
      return new Promise<string>((resolve) => {
        resolveRevalidation = resolve;
      });
    });

    const renderedStates: Array<{ data: string | null; isLoading: boolean }> =
      [];
    const first = renderHook(() => {
      const res = useAsyncRead(manager, 'key', fetcher, {
        initialData: 'ssr-initial-data',
      });
      renderedStates.push({ data: res.data, isLoading: res.isLoading });
      return res;
    });

    expect(renderedStates[0]).toEqual({
      data: 'stale-value',
      isLoading: false,
    });
    expect(first.result.current.data).toBe('stale-value');
    expect(first.result.current.isLoading).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(aborted).toBe(false);
    expect(manager.peek('key')).toBe('stale-value');

    // Mounting another consumer with SSR initialData while SWR is in flight must not abort it
    const second = renderHook(() =>
      useAsyncRead(manager, 'key', fetcher, {
        initialData: 'ssr-initial-data-2',
      })
    );
    expect(second.result.current.data).toBe('stale-value');
    expect(second.result.current.isLoading).toBe(false);
    expect(aborted).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();

    await act(async () => {
      resolveRevalidation('fresh-network-value');
      await Promise.resolve();
    });

    expect(aborted).toBe(false);
    expect(first.result.current.data).toBe('fresh-network-value');
    expect(first.result.current.isLoading).toBe(false);
    expect(second.result.current.data).toBe('fresh-network-value');
    expect(manager.get('key')).toBe('fresh-network-value');
  });

  it('triggers a fresh fetch with force: true options when refetch is called', async () => {
    const manager = new AsyncReadManager<string, string>();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce('data-1')
      .mockResolvedValueOnce('data-2');

    const { result } = renderHook(() => useAsyncRead(manager, 'key', fetcher));

    await waitFor(() => {
      expect(result.current.data).toBe('data-1');
    });

    expect(fetcher).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.data).toBe('data-2');
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not carry force: true to subsequent keys after a refetch has occurred', async () => {
    const manager = new AsyncReadManager<string, string>();
    const fetcher = vi.fn().mockResolvedValue('data');
    const subscribeSpy = vi.spyOn(manager, 'subscribe');

    const { result, rerender } = renderHook(
      ({ key }) => useAsyncRead(manager, key, fetcher),
      { initialProps: { key: 'key1' } }
    );

    await waitFor(() => {
      expect(result.current.data).toBe('data');
    });

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(subscribeSpy.mock.calls[0][3]?.force).toBeUndefined();

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(subscribeSpy).toHaveBeenCalledTimes(2);
    });
    expect(subscribeSpy.mock.calls[1][3]?.force).toBe(true);

    rerender({ key: 'key2' });

    await waitFor(() => {
      expect(subscribeSpy).toHaveBeenCalledTimes(3);
    });
    expect(subscribeSpy.mock.calls[2][3]?.force).not.toBe(true);
  });
});
