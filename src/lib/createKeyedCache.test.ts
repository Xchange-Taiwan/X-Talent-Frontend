import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createKeyedCache } from './createKeyedCache';

describe('createKeyedCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('handles basic get, set, has, delete and clear operations', () => {
    const cache = createKeyedCache<string, number>();

    expect(cache.has('key1')).toBe(false);
    expect(cache.get('key1')).toBeUndefined();

    cache.set('key1', 100);
    expect(cache.has('key1')).toBe(true);
    expect(cache.get('key1')).toBe(100);

    cache.delete('key1');
    expect(cache.has('key1')).toBe(false);
    expect(cache.get('key1')).toBeUndefined();

    cache.set('key1', 200);
    cache.set('key2', 300);
    cache.clear();
    expect(cache.has('key1')).toBe(false);
    expect(cache.has('key2')).toBe(false);
  });

  it('respects global TTL option and handles expiration on get/has', () => {
    const cache = createKeyedCache<string, number>({ ttlMs: 1000 });

    cache.set('key1', 42);
    expect(cache.has('key1')).toBe(true);
    expect(cache.get('key1')).toBe(42);

    // Fast forward halfway
    vi.advanceTimersByTime(500);
    expect(cache.has('key1')).toBe(true);
    expect(cache.get('key1')).toBe(42);

    // Fast forward past TTL
    vi.advanceTimersByTime(500);
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.has('key1')).toBe(false);
  });

  it('allows custom TTL override on set call', () => {
    const cache = createKeyedCache<string, number>({ ttlMs: 1000 });

    cache.set('key1', 42, 5000); // Override to 5 seconds
    vi.advanceTimersByTime(2000);
    expect(cache.get('key1')).toBe(42);

    vi.advanceTimersByTime(3000);
    expect(cache.get('key1')).toBeUndefined();
  });

  it('supports Stale-While-Revalidate pattern using getWithStatus', () => {
    const cache = createKeyedCache<string, number>({ ttlMs: 1000 });

    cache.set('key1', 100);
    expect(cache.getWithStatus('key1')).toEqual({ value: 100, isStale: false });

    // Advance past expiration
    vi.advanceTimersByTime(1001);

    // get() returns undefined, but getWithStatus returns stale value with isStale: true
    expect(cache.get('key1')).toBeUndefined(); // This deletes it from cache as it is expired
    // Wait, calling get() deleted it, so getWithStatus will now be undefined.
    // Let's reset and verify getWithStatus doesn't delete it initially.
    cache.set('key1', 100);
    vi.advanceTimersByTime(1001);
    expect(cache.getWithStatus('key1')).toEqual({ value: 100, isStale: true });
    // Calling getWithStatus again should still return it as stale
    expect(cache.getWithStatus('key1')).toEqual({ value: 100, isStale: true });
  });

  it('handles priming with force or ifEmpty option', () => {
    const cache = createKeyedCache<string, number>({ ttlMs: 1000 });

    cache.prime('key1', 100);
    expect(cache.get('key1')).toBe(100);

    // prime with ifEmpty when already populated should do nothing
    cache.prime('key1', 200, { ifEmpty: true });
    expect(cache.get('key1')).toBe(100);

    // prime without ifEmpty should force overwrite
    cache.prime('key1', 200);
    expect(cache.get('key1')).toBe(200);

    // prime with ifEmpty on an expired entry should overwrite
    vi.advanceTimersByTime(1001);
    cache.prime('key1', 300, { ifEmpty: true });
    expect(cache.get('key1')).toBe(300);
  });

  it('coalesces concurrent asynchronous fetches with the same key', async () => {
    const cache = createKeyedCache<string, number>();
    let callCount = 0;

    const fetcher = vi.fn(async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 100));
      return callCount;
    });

    const p1 = cache.fetch('key1', fetcher);
    const p2 = cache.fetch('key1', fetcher);
    const p3 = cache.fetch('key1', fetcher);

    expect(p2).toBe(p1);
    expect(p3).toBe(p1);

    vi.advanceTimersByTime(100);

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(r1).toBe(1);
    expect(r2).toBe(1);
    expect(r3).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('clears inflight cache upon resolution', async () => {
    const cache = createKeyedCache<string, number>();
    let callCount = 0;

    const fetcher = vi.fn(async () => {
      callCount++;
      return callCount;
    });

    const r1 = await cache.fetch('key1', fetcher);
    expect(r1).toBe(1);
    expect(cache.getInflight('key1')).toBeUndefined();

    // Second fetch should use the cached value directly without calling fetcher again
    const r2 = await cache.fetch('key1', fetcher);
    expect(r2).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('clears inflight cache upon rejection to allow subsequent fetches', async () => {
    const cache = createKeyedCache<string, number>();
    let attempts = 0;

    const fetcher = vi.fn(async () => {
      attempts++;
      if (attempts === 1) {
        throw new Error('Fetch failed');
      }
      return attempts;
    });

    await expect(cache.fetch('key1', fetcher)).rejects.toThrow('Fetch failed');
    expect(cache.getInflight('key1')).toBeUndefined();

    // Second fetch should trigger the fetcher again
    const r2 = await cache.fetch('key1', fetcher);
    expect(r2).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('supports custom shouldCache filter option in fetch', async () => {
    const cache = createKeyedCache<string, number | null>();

    const fetcherNull = vi.fn(async () => null);
    const fetcherValue = vi.fn(async () => 42);

    const r1 = await cache.fetch('key1', fetcherNull, {
      shouldCache: (val) => val !== null,
    });
    expect(r1).toBeNull();
    expect(cache.get('key1')).toBeUndefined(); // Should NOT be in cache

    const r2 = await cache.fetch('key1', fetcherValue, {
      shouldCache: (val) => val !== null,
    });
    expect(r2).toBe(42);
    expect(cache.get('key1')).toBe(42); // Should be in cache
  });

  it('prevents in-flight fetch from overwriting a newer primed/set value (Race Condition protection)', async () => {
    const cache = createKeyedCache<string, number>();

    let resolveFetcher: (val: number) => void = () => {};
    const fetcherPromise = new Promise<number>((resolve) => {
      resolveFetcher = resolve;
    });

    const fetcher = vi.fn(() => fetcherPromise);

    // Start a fetch (in-flight)
    const p1 = cache.fetch('key1', fetcher);

    // While fetch is in-flight, we prime the cache with a newer/fresh value
    cache.prime('key1', 999);

    // Resolve the original fetcher with old data
    resolveFetcher(100);

    const result = await p1;
    expect(result).toBe(100);

    // The cache should still contain the newer primed value (999), NOT the old resolved value (100)
    expect(cache.get('key1')).toBe(999);
  });

  it('prevents in-flight fetch from overwriting cache after clear()', async () => {
    const cache = createKeyedCache<string, number>();

    let resolveFetcher: (val: number) => void = () => {};
    const fetcherPromise = new Promise<number>((resolve) => {
      resolveFetcher = resolve;
    });

    const fetcher = vi.fn(() => fetcherPromise);

    const p1 = cache.fetch('key1', fetcher);

    cache.clear();

    resolveFetcher(100);
    await p1;

    expect(cache.get('key1')).toBeUndefined();
  });

  it('does not prematurely delete expired cache during background fetch (SWR preservation)', async () => {
    const cache = createKeyedCache<string, number>({ ttlMs: 1000 });

    cache.set('key1', 42);
    vi.advanceTimersByTime(1001); // Expiry passed

    // Initiating fetch() on expired key
    let resolveFetcher: (val: number) => void = () => {};
    const fetcherPromise = new Promise<number>((resolve) => {
      resolveFetcher = resolve;
    });
    const fetcher = vi.fn(() => fetcherPromise);

    const p1 = cache.fetch('key1', fetcher);

    // During in-flight request, calling getWithStatus() should still return the stale value, not undefined!
    const status = cache.getWithStatus('key1');
    expect(status).toEqual({ value: 42, isStale: true });

    // Resolve the revalidation request with 100
    resolveFetcher(100);
    await p1;

    // After resolving, getWithStatus() returns the fresh value with isStale: false
    expect(cache.getWithStatus('key1')).toEqual({ value: 100, isStale: false });
  });

  it('prevents in-flight fetch from overwriting a newer set value (Race Condition protection)', async () => {
    const cache = createKeyedCache<string, number>();

    let resolveFetcher: (val: number) => void = () => {};
    const fetcherPromise = new Promise<number>((resolve) => {
      resolveFetcher = resolve;
    });

    const fetcher = vi.fn(() => fetcherPromise);

    // Start a fetch (in-flight)
    const p1 = cache.fetch('key1', fetcher);

    // While fetch is in-flight, we set a new value
    cache.set('key1', 777);

    // Resolve original fetch with old data (100)
    resolveFetcher(100);
    await p1;

    // Cache should remain 777, not overwritten by 100
    expect(cache.get('key1')).toBe(777);
  });
});
