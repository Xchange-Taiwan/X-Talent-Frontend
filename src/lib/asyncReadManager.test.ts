import { describe, expect, it, vi } from 'vitest';

import { createKeyedCache } from '@/lib/createKeyedCache';

import { AsyncReadManager, AsyncReadResult } from './asyncReadManager';

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

  it('clears all in-flight requests and aborts them on manager.clear() to prevent cache poisoning', () => {
    const manager = new AsyncReadManager<string, string>();
    let aborted = false;
    const fetcher = (signal: AbortSignal) => {
      signal.addEventListener('abort', () => {
        aborted = true;
      });
      return new Promise<string>(() => {});
    };

    manager.subscribe('key', fetcher, () => {});
    expect(manager.getInflightCount()).toBe(1);
    expect(aborted).toBe(false);

    manager.clear();
    expect(manager.getInflightCount()).toBe(0);
    expect(aborted).toBe(true); // Verifies aborting of active requests!
  });

  it('fully releases and clears internal maps when unmounting/unsubscribing completely', () => {
    const manager = new AsyncReadManager<string, string>();
    const fetcher = () => new Promise<string>(() => {});

    const unsubscribe1 = manager.subscribe('key', fetcher, () => {});
    expect(manager.getInflightCount()).toBe(1);
    expect(manager.getListenerCount('key')).toBe(1);

    const unsubscribe2 = manager.subscribe('key', fetcher, () => {});
    expect(manager.getListenerCount('key')).toBe(2);

    unsubscribe1();
    expect(manager.getInflightCount()).toBe(1); // Not zero yet, still has listener 2
    expect(manager.getListenerCount('key')).toBe(1);

    unsubscribe2();
    expect(manager.getInflightCount()).toBe(0); // Last subscriber unsubscribed, maps are fully cleared!
    expect(manager.getListenerCount('key')).toBe(0);
  });

  it('correctly updates cache and notifies active subscribers when set() is called manually', () => {
    const cache = createKeyedCache<string, string>();
    const manager = new AsyncReadManager<string, string>(cache);
    const updates: AsyncReadResult<string>[] = [];

    const unsubscribe = manager.subscribe(
      'key',
      vi.fn().mockResolvedValue('fetched'),
      (res) => updates.push(res)
    );

    // Initial state: loading (since not cached)
    expect(updates[0]).toEqual({ data: null, isLoading: true, error: null });

    // Manually set a new value
    manager.set('key', 'manually-set-value');

    // Should update cache
    expect(cache.get('key')).toBe('manually-set-value');
    expect(manager.get('key')).toBe('manually-set-value');

    // Subscription should be updated with manually set value and isLoading: false, error: null
    expect(updates[1]).toEqual({
      data: 'manually-set-value',
      isLoading: false,
      error: null,
    });

    unsubscribe();
  });

  it('does not set isLoading to true when subscribing to a stale cache entry (SWR background revalidation)', async () => {
    const cache = createKeyedCache<string, string>({ ttlMs: 10 });
    cache.set('key', 'stale-data');
    const manager = new AsyncReadManager<string, string>(cache);
    const fetcher = vi.fn().mockResolvedValue('fresh-data');
    const updates: AsyncReadResult<string>[] = [];

    // Wait for the cache entry to expire/become stale
    await new Promise((resolve) => setTimeout(resolve, 15));

    const unsubscribe = manager.subscribe('key', fetcher, (res) =>
      updates.push(res)
    );

    // It should immediately return the stale-data with isLoading: false
    expect(updates[0]).toEqual({
      data: 'stale-data',
      isLoading: false,
      error: null,
    });

    // Then background fetch resolves to fresh-data with isLoading: false
    await vi.waitFor(() => {
      expect(updates.length).toBe(2);
    });

    expect(updates[1]).toEqual({
      data: 'fresh-data',
      isLoading: false,
      error: null,
    });

    unsubscribe();
  });

  it('respects initialData and returns it synchronously with isLoading: false on cache miss', async () => {
    const manager = new AsyncReadManager<string, string>();
    const fetcher = vi.fn().mockResolvedValue('fresh-data');
    const updates: AsyncReadResult<string>[] = [];

    const unsubscribe = manager.subscribe(
      'key',
      fetcher,
      (res) => updates.push(res),
      { initialData: 'initial-data' }
    );

    // Initial state: data: 'initial-data', isLoading: false
    expect(updates[0]).toEqual({
      data: 'initial-data',
      isLoading: false,
      error: null,
    });

    // Wait for resolution
    await vi.waitFor(() => {
      expect(updates.length).toBe(2);
    });

    expect(updates[1]).toEqual({
      data: 'fresh-data',
      isLoading: false,
      error: null,
    });
    expect(fetcher).toHaveBeenCalledOnce();

    unsubscribe();
  });

  it('respects shouldCache option and does not write to cache when shouldCache returns false', async () => {
    const cache = createKeyedCache<string, string>();
    const manager = new AsyncReadManager<string, string>(cache);
    const fetcher = vi.fn().mockResolvedValue('do-not-cache');
    const updates: AsyncReadResult<string>[] = [];

    const unsubscribe = manager.subscribe(
      'key',
      fetcher,
      (res) => updates.push(res),
      { shouldCache: (val) => val !== 'do-not-cache' }
    );

    await vi.waitFor(() => {
      expect(updates.length).toBe(2);
    });

    // Check updates
    expect(updates[1]).toEqual({
      data: 'do-not-cache',
      isLoading: false,
      error: null,
    });

    // Verify it is NOT written to the cache
    expect(cache.get('key')).toBeUndefined();

    unsubscribe();
  });

  describe('write vocabulary: update() and invalidate()', () => {
    it('update() derives the next value from the current cached value and notifies subscribers', () => {
      const cache = createKeyedCache<string, string[]>();
      cache.set('key', ['a', 'b']);
      const manager = new AsyncReadManager<string, string[]>(cache);
      const updates: AsyncReadResult<string[]>[] = [];

      const unsubscribe = manager.subscribe(
        'key',
        vi.fn().mockResolvedValue(['a', 'b']),
        (res) => updates.push(res)
      );

      manager.update('key', (current) => [...(current ?? []), 'c']);

      expect(cache.get('key')).toEqual(['a', 'b', 'c']);
      expect(updates.at(-1)).toEqual({
        data: ['a', 'b', 'c'],
        isLoading: false,
        error: null,
      });

      unsubscribe();
    });

    it('update() is a no-op when the updater returns undefined (nothing to derive from)', () => {
      const cache = createKeyedCache<string, string[]>();
      const manager = new AsyncReadManager<string, string[]>(cache);
      const updates: AsyncReadResult<string[]>[] = [];

      const unsubscribe = manager.subscribe(
        'key',
        vi.fn().mockReturnValue(new Promise(() => {})),
        (res) => updates.push(res)
      );

      manager.update('key', (current) =>
        current ? [...current, 'c'] : undefined
      );

      expect(cache.get('key')).toBeUndefined();
      expect(updates).toHaveLength(1); // Only the initial loading update, no write happened

      unsubscribe();
    });

    it('invalidate() removes the cached value, cancels the in-flight fetch, and notifies subscribers', () => {
      const cache = createKeyedCache<string, string>();
      cache.set('key', 'cached-data');
      const manager = new AsyncReadManager<string, string>(cache);
      let aborted = false;
      const fetcher = (signal: AbortSignal) => {
        signal.addEventListener('abort', () => {
          aborted = true;
        });
        return new Promise<string>(() => {});
      };

      const updates: AsyncReadResult<string>[] = [];
      const unsubscribe = manager.subscribe(
        'key',
        fetcher,
        (res) => updates.push(res),
        { force: true }
      );

      manager.invalidate('key');

      expect(cache.get('key')).toBeUndefined();
      expect(manager.getInflightCount()).toBe(0);
      expect(aborted).toBe(true);
      expect(updates.at(-1)).toEqual({
        data: null,
        isLoading: false,
        error: null,
      });

      unsubscribe();
    });

    it('a write through update() supersedes an in-flight fetch, so a late response cannot overwrite it', async () => {
      const cache = createKeyedCache<string, string>();
      const manager = new AsyncReadManager<string, string>(cache);
      let resolveFetcher: (v: string) => void = () => {};
      const fetcherPromise = new Promise<string>((resolve) => {
        resolveFetcher = resolve;
      });
      const fetcher = vi.fn().mockReturnValue(fetcherPromise);
      const updates: AsyncReadResult<string>[] = [];

      const unsubscribe = manager.subscribe('key', fetcher, (res) =>
        updates.push(res)
      );
      expect(updates[0]).toEqual({ data: null, isLoading: true, error: null });
      expect(manager.getInflightCount()).toBe(1);

      // A write happens before the fetch resolves.
      manager.update('key', () => 'written-value');
      expect(manager.getInflightCount()).toBe(0);
      expect(updates[1]).toEqual({
        data: 'written-value',
        isLoading: false,
        error: null,
      });

      // The stale fetch now resolves late, it must not clobber the write.
      resolveFetcher('late-response');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(manager.get('key')).toBe('written-value');
      expect(updates).toHaveLength(2);

      unsubscribe();
    });

    it('a write through invalidate() supersedes an in-flight fetch, so a late response cannot repopulate it', async () => {
      const cache = createKeyedCache<string, string>();
      cache.set('key', 'stale-cached-data');
      const manager = new AsyncReadManager<string, string>(cache);
      let resolveFetcher: (v: string) => void = () => {};
      const fetcherPromise = new Promise<string>((resolve) => {
        resolveFetcher = resolve;
      });
      const fetcher = vi.fn().mockReturnValue(fetcherPromise);
      const updates: AsyncReadResult<string>[] = [];

      const unsubscribe = manager.subscribe(
        'key',
        fetcher,
        (res) => updates.push(res),
        { force: true }
      );
      expect(manager.getInflightCount()).toBe(1);

      manager.invalidate('key');
      expect(manager.getInflightCount()).toBe(0);
      expect(cache.get('key')).toBeUndefined();

      resolveFetcher('late-response');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(cache.get('key')).toBeUndefined();

      unsubscribe();
    });
  });
});
