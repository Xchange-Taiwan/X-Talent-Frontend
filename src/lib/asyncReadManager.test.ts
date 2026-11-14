import { afterEach, describe, expect, it, vi } from 'vitest';

import { AsyncReadManager, type AsyncReadResult } from './asyncReadManager';

describe('AsyncReadManager unit tests', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles loading state, success state, and provides correct result shape', async () => {
    const manager = new AsyncReadManager<string, string>();
    const fetcher = vi.fn().mockResolvedValue('test-data');
    const updates: AsyncReadResult<string>[] = [];

    const unsubscribe = manager.subscribe('key', fetcher, (res) =>
      updates.push(res)
    );

    expect(updates[0]).toEqual({ data: null, isLoading: true, error: null });

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
    const manager = new AsyncReadManager<string, string>();
    manager.set('key', 'cached-data');
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
    const manager = new AsyncReadManager<string, string>();
    manager.set('key', 'cached-data');
    const fetcher = vi.fn().mockResolvedValue('new-data');
    const updates: AsyncReadResult<string>[] = [];

    const unsubscribe = manager.subscribe(
      'key',
      fetcher,
      (res) => updates.push(res),
      { force: true }
    );

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
    expect(manager.get('key')).toBe('new-data');

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
    expect(fetcher).toHaveBeenCalledOnce();

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

    const unsubscribe1 = manager.subscribe(
      'key',
      () => firstPromise,
      (res) => updates.push(res)
    );
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ data: null, isLoading: true, error: null });

    const unsubscribe2 = manager.subscribe(
      'key',
      () => secondPromise,
      (res) => updates.push(res),
      { force: true }
    );
    expect(updates).toHaveLength(2);
    expect(updates[1]).toEqual({ data: null, isLoading: true, error: null });

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

    resolveFirst('first-response');
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(updates).toHaveLength(4);

    unsubscribe1();
    unsubscribe2();
  });

  it('aborts the in-flight fetch request upon subscription cancellation', () => {
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
    expect(aborted).toBe(false);

    unsubscribe2();
    expect(aborted).toBe(true);
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
    expect(aborted).toBe(true);
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
    expect(manager.getInflightCount()).toBe(1);
    expect(manager.getListenerCount('key')).toBe(1);

    unsubscribe2();
    expect(manager.getInflightCount()).toBe(0);
    expect(manager.getListenerCount('key')).toBe(0);
  });

  it('correctly updates cache and notifies active subscribers when set() is called manually', () => {
    const manager = new AsyncReadManager<string, string>();
    const updates: AsyncReadResult<string>[] = [];

    const unsubscribe = manager.subscribe(
      'key',
      vi.fn().mockResolvedValue('fetched'),
      (res) => updates.push(res)
    );

    expect(updates[0]).toEqual({ data: null, isLoading: true, error: null });

    manager.set('key', 'manually-set-value');

    expect(manager.get('key')).toBe('manually-set-value');
    expect(updates[1]).toEqual({
      data: 'manually-set-value',
      isLoading: false,
      error: null,
    });

    unsubscribe();
  });

  describe('non-destructive TTL and SWR snapshots (peek / getSnapshot)', () => {
    it('preserves expired TTL entries across get()/has() calls so peek(), getSnapshot(), and subscribe() perform SWR without skeleton flash', async () => {
      vi.useFakeTimers();
      const manager = new AsyncReadManager<string, string>({ ttlMs: 1_000 });
      manager.set('key', 'stale-data');

      expect(manager.get('key')).toBe('stale-data');
      expect(manager.has('key')).toBe(true);
      expect(manager.peek('key')).toBe('stale-data');
      expect(manager.getSnapshot('key')).toEqual({
        value: 'stale-data',
        isStale: false,
      });

      vi.advanceTimersByTime(1_001);

      // Freshness queries report expired without destructively deleting the entry
      expect(manager.get('key')).toBeUndefined();
      expect(manager.has('key')).toBe(false);

      // Non-destructive inspection still sees the stale entry
      expect(manager.peek('key')).toBe('stale-data');
      expect(manager.getSnapshot('key')).toEqual({
        value: 'stale-data',
        isStale: true,
      });

      const fetcher = vi.fn().mockResolvedValue('fresh-data');
      const updates: AsyncReadResult<string>[] = [];

      const unsubscribe = manager.subscribe('key', fetcher, (res) =>
        updates.push(res)
      );

      // Immediately serves stale data with isLoading: false while revalidating
      expect(updates[0]).toEqual({
        data: 'stale-data',
        isLoading: false,
        error: null,
      });
      expect(fetcher).toHaveBeenCalledOnce();

      await vi.waitFor(() => {
        expect(updates).toHaveLength(2);
      });

      expect(updates[1]).toEqual({
        data: 'fresh-data',
        isLoading: false,
        error: null,
      });
      expect(manager.get('key')).toBe('fresh-data');
      expect(manager.getSnapshot('key')).toEqual({
        value: 'fresh-data',
        isStale: false,
      });

      unsubscribe();
    });
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

    expect(updates[0]).toEqual({
      data: 'initial-data',
      isLoading: false,
      error: null,
    });

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
    const manager = new AsyncReadManager<string, string>();
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

    expect(updates[1]).toEqual({
      data: 'do-not-cache',
      isLoading: false,
      error: null,
    });
    expect(manager.get('key')).toBeUndefined();
    expect(manager.peek('key')).toBeUndefined();

    unsubscribe();
  });

  describe('write vocabulary: set(), prime(), update(), and invalidate()', () => {
    it('set() cancels a competing in-flight read so a late response never clobbers the write', async () => {
      const manager = new AsyncReadManager<string, string>();
      let aborted = false;
      let resolveSlow: (v: string) => void = () => {};
      const slowFetcher = (signal: AbortSignal) => {
        signal.addEventListener('abort', () => {
          aborted = true;
        });
        return new Promise<string>((resolve) => {
          resolveSlow = resolve;
        });
      };

      const updates: AsyncReadResult<string>[] = [];
      const unsubscribe = manager.subscribe('key', slowFetcher, (res) =>
        updates.push(res)
      );
      expect(manager.getInflightCount()).toBe(1);

      manager.set('key', 'authoritative-write');
      expect(aborted).toBe(true);
      expect(manager.getInflightCount()).toBe(0);

      resolveSlow('stale-network-response');
      await Promise.resolve();
      await Promise.resolve();

      expect(manager.get('key')).toBe('authoritative-write');
      expect(updates).toEqual([
        { data: null, isLoading: true, error: null },
        { data: 'authoritative-write', isLoading: false, error: null },
      ]);

      unsubscribe();
    });

    it('prime() cancels a competing in-flight read when overwriting, and respects ifEmpty for fresh vs expired entries', async () => {
      vi.useFakeTimers();
      const manager = new AsyncReadManager<string, string>({ ttlMs: 1_000 });
      let aborted = false;
      let resolveSlow: (v: string) => void = () => {};
      const slowFetcher = (signal: AbortSignal) => {
        signal.addEventListener('abort', () => {
          aborted = true;
        });
        return new Promise<string>((resolve) => {
          resolveSlow = resolve;
        });
      };

      const updates: AsyncReadResult<string>[] = [];
      const unsubscribe = manager.subscribe('key', slowFetcher, (res) =>
        updates.push(res)
      );

      manager.prime('key', 'primed-v1');
      expect(aborted).toBe(true);
      expect(manager.getInflightCount()).toBe(0);
      expect(manager.get('key')).toBe('primed-v1');

      resolveSlow('late-v0');
      await Promise.resolve();
      expect(manager.get('key')).toBe('primed-v1');

      // ifEmpty: true preserves a fresh entry
      manager.prime('key', 'ignored-prime', { ifEmpty: true });
      expect(manager.get('key')).toBe('primed-v1');
      expect(updates).toHaveLength(2);

      // Once expired, ifEmpty: true replaces the stale entry
      vi.advanceTimersByTime(1_001);
      manager.prime('key', 'primed-after-expiry', {
        ifEmpty: true,
        ttlMs: 5_000,
      });
      expect(manager.get('key')).toBe('primed-after-expiry');

      unsubscribe();
    });

    it('update() derives the next value from the current cached value and notifies subscribers', () => {
      const manager = new AsyncReadManager<string, string[]>();
      manager.set('key', ['a', 'b']);
      const updates: AsyncReadResult<string[]>[] = [];

      const unsubscribe = manager.subscribe(
        'key',
        vi.fn().mockResolvedValue(['a', 'b']),
        (res) => updates.push(res)
      );

      manager.update('key', (current) => [...(current ?? []), 'c']);

      expect(manager.get('key')).toEqual(['a', 'b', 'c']);
      expect(updates.at(-1)).toEqual({
        data: ['a', 'b', 'c'],
        isLoading: false,
        error: null,
      });

      unsubscribe();
    });

    it('update() is a no-op when the updater returns undefined (nothing to derive from)', () => {
      const manager = new AsyncReadManager<string, string[]>();
      const updates: AsyncReadResult<string[]>[] = [];

      const unsubscribe = manager.subscribe(
        'key',
        vi.fn().mockReturnValue(new Promise(() => {})),
        (res) => updates.push(res)
      );

      manager.update('key', (current) =>
        current ? [...current, 'c'] : undefined
      );

      expect(manager.get('key')).toBeUndefined();
      expect(updates).toHaveLength(1);

      unsubscribe();
    });

    it('invalidate() removes the cached value, cancels the in-flight fetch, and notifies subscribers', () => {
      const manager = new AsyncReadManager<string, string>();
      manager.set('key', 'cached-data');
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

      expect(manager.get('key')).toBeUndefined();
      expect(manager.peek('key')).toBeUndefined();
      expect(manager.getInflightCount()).toBe(0);
      expect(aborted).toBe(true);
      expect(updates.at(-1)).toEqual({
        data: null,
        isLoading: false,
        error: null,
      });

      unsubscribe();
    });

    it('evict() removes the cached value without cancelling an in-flight fetch or notifying subscribers', () => {
      const manager = new AsyncReadManager<string, string>();
      manager.set('key', 'stale-cached-data');
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
      const updateCountBeforeEvict = updates.length;

      manager.evict('key');

      expect(manager.get('key')).toBeUndefined();
      expect(manager.peek('key')).toBeUndefined();
      expect(manager.getInflightCount()).toBe(1);
      expect(aborted).toBe(false);
      expect(updates.length).toBe(updateCountBeforeEvict);

      unsubscribe();
    });

    it('evict() called from inside a fetcher still lets that fetch report its own real failure afterward', async () => {
      const manager = new AsyncReadManager<string, string>();
      manager.set('key', 'stale-cached-data');
      const updates: AsyncReadResult<string>[] = [];

      const fetcher = () => {
        manager.evict('key');
        return Promise.reject(new Error('real failure'));
      };

      const unsubscribe = manager.subscribe(
        'key',
        fetcher,
        (res) => updates.push(res),
        { force: true }
      );

      await vi.waitFor(() => {
        expect(updates.at(-1)?.isLoading).toBe(false);
      });

      expect(updates.at(-1)).toEqual({
        data: null,
        isLoading: false,
        error: 'real failure',
      });
      expect(manager.get('key')).toBeUndefined();

      unsubscribe();
    });

    it('a write through update() supersedes an in-flight fetch, so a late response cannot overwrite it', async () => {
      const manager = new AsyncReadManager<string, string>();
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

      manager.update('key', () => 'written-value');
      expect(manager.getInflightCount()).toBe(0);
      expect(updates[1]).toEqual({
        data: 'written-value',
        isLoading: false,
        error: null,
      });

      resolveFetcher('late-response');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(manager.get('key')).toBe('written-value');
      expect(updates).toHaveLength(2);

      unsubscribe();
    });

    it('a write through invalidate() supersedes an in-flight fetch, so a late response cannot repopulate it', async () => {
      const manager = new AsyncReadManager<string, string>();
      manager.set('key', 'stale-cached-data');
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
      expect(manager.get('key')).toBeUndefined();

      resolveFetcher('late-response');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(manager.get('key')).toBeUndefined();

      unsubscribe();
    });
  });

  describe('imperative refresh(), prefetch(), and observe()', () => {
    it('refresh() forces a network fetch even on a fresh cache hit, updates live subscribers, and survives subscriber unmount', async () => {
      const manager = new AsyncReadManager<string, string>();
      manager.set('key', 'v1');

      const updates: AsyncReadResult<string>[] = [];
      const unsubscribe = manager.subscribe(
        'key',
        () => Promise.resolve('v1'),
        (res) => updates.push(res)
      );
      updates.length = 0;

      let resolveRefresh: (v: string) => void = () => {};
      const refreshPromise = manager.refresh(
        'key',
        () =>
          new Promise<string>((resolve) => {
            resolveRefresh = resolve;
          })
      );

      // Unsubscribing the mounted reader mid-refresh must NOT abort refresh()
      unsubscribe();
      expect(manager.getInflightCount()).toBe(1);

      resolveRefresh('v2');
      const result = await refreshPromise;

      expect(result).toEqual({ data: 'v2', isLoading: false, error: null });
      expect(manager.get('key')).toBe('v2');
    });

    it('refresh() resolves to null when superseded mid-flight by set(), prime(), invalidate(), or clear()', async () => {
      const manager = new AsyncReadManager<string, string>();
      let resolveRefresh: (v: string) => void = () => {};
      const refreshPromise = manager.refresh(
        'key',
        () =>
          new Promise<string>((resolve) => {
            resolveRefresh = resolve;
          })
      );

      manager.prime('key', 'primed-winner');
      resolveRefresh('superseded-refresh');

      await expect(refreshPromise).resolves.toBeNull();
      expect(manager.get('key')).toBe('primed-winner');
    });

    it('prefetch() warms empty or stale entries, is a no-op on fresh hits, deduplicates with in-flight reads, and swallows rejections', async () => {
      vi.useFakeTimers();
      const manager = new AsyncReadManager<string, string>({ ttlMs: 1_000 });

      // 1. Warms empty cache
      const fetch1 = vi.fn().mockResolvedValue('warm-1');
      const res1 = await manager.prefetch('key', fetch1);
      expect(res1).toEqual({ data: 'warm-1', isLoading: false, error: null });
      expect(manager.get('key')).toBe('warm-1');
      expect(fetch1).toHaveBeenCalledOnce();

      // 2. Fresh hit is a no-op
      const fetch2 = vi.fn().mockResolvedValue('warm-2');
      const res2 = await manager.prefetch('key', fetch2);
      expect(res2).toEqual({ data: 'warm-1', isLoading: false, error: null });
      expect(fetch2).not.toHaveBeenCalled();

      // 3. Expired entry is re-warmed on prefetch
      vi.advanceTimersByTime(1_001);
      const fetch3 = vi.fn().mockResolvedValue('warm-3');
      await manager.prefetch('key', fetch3);
      expect(fetch3).toHaveBeenCalledOnce();
      expect(manager.get('key')).toBe('warm-3');

      // 4. Joins an already in-flight subscribe() read and keeps it alive if subscriber leaves
      let resolveShared: (v: string) => void = () => {};
      const sharedFetcher = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveShared = resolve;
          })
      );
      const unsub = manager.subscribe('shared', sharedFetcher, () => {});
      const prefetchShared = manager.prefetch('shared', sharedFetcher);
      unsub(); // Subscriber leaves, but prefetch keeps the single-flight alive
      resolveShared('shared-value');

      await expect(prefetchShared).resolves.toEqual({
        data: 'shared-value',
        isLoading: false,
        error: null,
      });
      expect(sharedFetcher).toHaveBeenCalledOnce();
      expect(manager.get('shared')).toBe('shared-value');

      // 5. Rejections resolve with error result instead of throwing unhandled rejections
      const failedRes = await manager.prefetch('failing', () =>
        Promise.reject(new Error('boom'))
      );
      expect(failedRes).toEqual({
        data: null,
        isLoading: false,
        error: 'boom',
      });
      expect(manager.get('failing')).toBeUndefined();
    });

    it('observe() shares the unified listener set without counting as a retaining subscriber', () => {
      const manager = new AsyncReadManager<string, string>();
      const onChange = vi.fn();
      const stopObserving = manager.observe('key', onChange);

      expect(manager.getListenerCount('key')).toBe(0);

      manager.prime('key', 'v1');
      expect(onChange).toHaveBeenCalledTimes(1);

      manager.invalidate('key');
      expect(onChange).toHaveBeenCalledTimes(2);

      stopObserving();
      manager.set('key', 'v2');
      expect(onChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('AbortError handling in the fetch resolution path', () => {
    it('silently absorbs a genuine AbortError from a fetcher that rejects after our own controller aborted it (real fetch behavior)', async () => {
      const manager = new AsyncReadManager<string, string>();
      let rejectFetcher: (err: Error) => void = () => {};
      const fetcherPromise = new Promise<string>((_, reject) => {
        rejectFetcher = reject;
      });
      const fetcher = vi.fn().mockReturnValue(fetcherPromise);
      const updates: AsyncReadResult<string>[] = [];

      const unsubscribe = manager.subscribe('key', fetcher, (res) =>
        updates.push(res)
      );
      expect(manager.getInflightCount()).toBe(1);

      manager.update('key', () => 'written-value');
      expect(manager.getInflightCount()).toBe(0);

      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      rejectFetcher(abortError);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(updates).toHaveLength(2);
      expect(updates[1]).toEqual({
        data: 'written-value',
        isLoading: false,
        error: null,
      });
      expect(manager.get('key')).toBe('written-value');

      unsubscribe();
    });

    it('treats an AbortError NOT caused by our own controller as a real failure, not a routine cancellation', async () => {
      const manager = new AsyncReadManager<string, string>();
      const abortError = new Error('signal timed out');
      abortError.name = 'AbortError';
      const fetcher = vi.fn().mockRejectedValue(abortError);
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
        error: 'signal timed out',
      });

      unsubscribe();
    });

    it('safely handles synchronous abort-listener re-entrancy and mid-notification unsubscription', () => {
      const manager = new AsyncReadManager<string, string>();
      let inflightDuringAbort = -1;

      const unsubInflight = manager.subscribe(
        'inflight-key',
        (signal) => {
          signal.addEventListener('abort', () => {
            inflightDuringAbort = manager.getInflightCount();
          });
          return new Promise<string>(() => {});
        },
        () => {}
      );

      unsubInflight();
      expect(inflightDuringAbort).toBe(0);

      let secondListenerCalled = false;
      let unsubSecond: () => void = () => {};
      const unsubFirst = manager.subscribe(
        'notify-key',
        () => new Promise<string>(() => {}),
        (res) => {
          if (!res.isLoading) {
            unsubSecond();
          }
        }
      );
      unsubSecond = manager.subscribe(
        'notify-key',
        () => new Promise<string>(() => {}),
        (res) => {
          if (!res.isLoading) {
            secondListenerCalled = true;
          }
        }
      );

      manager.set('notify-key', 'settled');
      expect(secondListenerCalled).toBe(false);

      unsubFirst();
    });
  });
});
