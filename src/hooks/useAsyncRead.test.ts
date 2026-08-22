import { describe, expect, it, vi } from 'vitest';

import { createKeyedCache } from '@/lib/createKeyedCache';

import { AsyncReadManager, AsyncReadResult } from './useAsyncRead';

describe('AsyncReadManager unit tests', () => {
  it('handles loading state, success state, and provides correct result shape', async () => {
    const manager = new AsyncReadManager<string, string>();
    const fetcher = vi.fn().mockResolvedValue('test-data');
    const updates: AsyncReadResult<string>[] = [];

    const unsubscribe = manager.subscribe('key', fetcher, (res) =>
      updates.push(res)
    );

    // First update is loading
    expect(updates[0]).toEqual({ data: null, isLoading: true, error: null });

    // Wait for resolution
    await vi.waitFor(() => {
      expect(updates.length).toBe(2);
    });

    expect(updates[1]).toEqual({
      data: 'test-data',
      isLoading: false,
      error: null,
    });
    expect(fetcher).toHaveBeenCalledOnce();

    unsubscribe();
  });

  it('serves cached data immediately and does not fetch if not forced', () => {
    const cache = createKeyedCache<string, string>();
    cache.set('key', 'cached-data');
    const manager = new AsyncReadManager<string, string>(cache);
    const fetcher = vi.fn();
    const updates: AsyncReadResult<string>[] = [];

    const unsubscribe = manager.subscribe('key', fetcher, (res) =>
      updates.push(res)
    );

    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({
      data: 'cached-data',
      isLoading: false,
      error: null,
    });
    expect(fetcher).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('handles forced refresh, showing loading state with cached data, and then refreshing with new value', async () => {
    const cache = createKeyedCache<string, string>();
    cache.set('key', 'cached-data');
    const manager = new AsyncReadManager<string, string>(cache);
    const fetcher = vi.fn().mockResolvedValue('new-data');
    const updates: AsyncReadResult<string>[] = [];

    const unsubscribe = manager.subscribe(
      'key',
      fetcher,
      (res) => updates.push(res),
      { force: true }
    );

    // Initial state: loading: true, data: cached-data
    expect(updates[0]).toEqual({
      data: 'cached-data',
      isLoading: true,
      error: null,
    });

    await vi.waitFor(() => {
      expect(updates.length).toBe(2);
    });

    expect(updates[1]).toEqual({
      data: 'new-data',
      isLoading: false,
      error: null,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(cache.get('key')).toBe('new-data');

    unsubscribe();
  });

  it('performs in-flight request de-duplication across concurrent subscribers', async () => {
    const manager = new AsyncReadManager<string, string>();
    let resolveFetcher: (v: string) => void = () => {};
    const fetcherPromise = new Promise<string>((resolve) => {
      resolveFetcher = resolve;
    });
    const fetcher = vi.fn().mockReturnValue(fetcherPromise);

    const updates1: AsyncReadResult<string>[] = [];
    const updates2: AsyncReadResult<string>[] = [];

    const unsubscribe1 = manager.subscribe('key', fetcher, (res) =>
      updates1.push(res)
    );
    const unsubscribe2 = manager.subscribe('key', fetcher, (res) =>
      updates2.push(res)
    );

    expect(updates1[0]).toEqual({ data: null, isLoading: true, error: null });
    expect(updates2[0]).toEqual({ data: null, isLoading: true, error: null });
    expect(fetcher).toHaveBeenCalledOnce(); // Only called once!

    resolveFetcher('resolved-data');

    await vi.waitFor(() => {
      expect(updates1.length).toBe(2);
      expect(updates2.length).toBe(2);
    });

    expect(updates1[1]).toEqual({
      data: 'resolved-data',
      isLoading: false,
      error: null,
    });
    expect(updates2[1]).toEqual({
      data: 'resolved-data',
      isLoading: false,
      error: null,
    });

    unsubscribe1();
    unsubscribe2();
  });

  it('implements request ordering: out-of-order stale response never overwrites newer request', async () => {
    const manager = new AsyncReadManager<string, string>();

    let resolveFirst: (v: string) => void = () => {};
    const firstPromise = new Promise<string>((resolve) => {
      resolveFirst = resolve;
    });

    let resolveSecond: (v: string) => void = () => {};
    const secondPromise = new Promise<string>((resolve) => {
      resolveSecond = resolve;
    });

    const updates: AsyncReadResult<string>[] = [];

    // Trigger first subscription
    const unsubscribe1 = manager.subscribe(
      'key',
      () => firstPromise,
      (res) => updates.push(res)
    );
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ data: null, isLoading: true, error: null });

    // Trigger second subscription (forcing a newer request on the same key)
    const unsubscribe2 = manager.subscribe(
      'key',
      () => secondPromise,
      (res) => updates.push(res),
      { force: true }
    );
    expect(updates).toHaveLength(2);
    expect(updates[1]).toEqual({ data: null, isLoading: true, error: null });

    // Resolve second request first (arrives first)
    resolveSecond('second-response');
    await vi.waitFor(() => {
      expect(updates.length).toBe(4);
    });
    // Both active subscribers (sub1 and sub2) get the latest refreshed value
    expect(updates[2]).toEqual({
      data: 'second-response',
      isLoading: false,
      error: null,
    });
    expect(updates[3]).toEqual({
      data: 'second-response',
      isLoading: false,
      error: null,
    });

    // Resolve first request second (arrives second, but its promise was already aborted/cancelled on force)
    resolveFirst('first-response');

    // Allow macrotasks to run to ensure nothing else is updated
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Stale/aborted first response must not win / update the state
    expect(updates).toHaveLength(4);

    unsubscribe1();
    unsubscribe2();
  });

  it('aborts the in-flight fetch request upon subscription cancellation', async () => {
    const manager = new AsyncReadManager<string, string>();
    let aborted = false;
    const fetcher = (signal: AbortSignal) => {
      signal.addEventListener('abort', () => {
        aborted = true;
      });
      return new Promise<string>(() => {});
    };

    const unsubscribe = manager.subscribe('key', fetcher, () => {});
    expect(aborted).toBe(false);

    unsubscribe();
    expect(aborted).toBe(true);
  });

  it('implements reference counting: does not abort in-flight fetch until the last subscriber unsubscribes', () => {
    const manager = new AsyncReadManager<string, string>();
    let aborted = false;
    const fetcher = (signal: AbortSignal) => {
      signal.addEventListener('abort', () => {
        aborted = true;
      });
      return new Promise<string>(() => {});
    };

    const unsubscribe1 = manager.subscribe('key', fetcher, () => {});
    const unsubscribe2 = manager.subscribe('key', fetcher, () => {});

    unsubscribe1();
    expect(aborted).toBe(false); // Still has subscriber 2, not aborted yet!

    unsubscribe2();
    expect(aborted).toBe(true); // Last subscriber unsubscribed, aborted!
  });

  it('handles fetcher failures cleanly by reporting the error in the result', async () => {
    const manager = new AsyncReadManager<string, string>();
    const fetcher = vi.fn().mockRejectedValue(new Error('API failure'));
    const updates: AsyncReadResult<string>[] = [];

    const unsubscribe = manager.subscribe('key', fetcher, (res) =>
      updates.push(res)
    );

    expect(updates[0]).toEqual({ data: null, isLoading: true, error: null });

    await vi.waitFor(() => {
      expect(updates.length).toBe(2);
    });

    expect(updates[1]).toEqual({
      data: null,
      isLoading: false,
      error: 'API failure',
    });

    unsubscribe();
  });
});
