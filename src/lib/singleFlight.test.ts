import { describe, expect, it, vi } from 'vitest';

import { singleFlight } from './singleFlight';

describe('singleFlight', () => {
  it('coalesces concurrent asynchronous operations with the same key', async () => {
    const map = new Map<string, Promise<number>>();
    let count = 0;

    const fn = vi.fn(async () => {
      count += 1;
      // Delay to simulate async behavior
      await new Promise((resolve) => setTimeout(resolve, 10));
      return count;
    });

    // Fire off three calls concurrently
    const p1 = singleFlight(map, 'key1', fn);
    const p2 = singleFlight(map, 'key1', fn);
    const p3 = singleFlight(map, 'key1', fn);

    // Verify they are the exact same Promise instance
    expect(p2).toBe(p1);
    expect(p3).toBe(p1);

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    // They should all resolve to the same value
    expect(r1).toBe(1);
    expect(r2).toBe(1);
    expect(r3).toBe(1);

    // The underlying fn should only have been called once
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('runs independently for different keys', async () => {
    const map = new Map<string, Promise<number>>();
    let count = 0;

    const fn = vi.fn(async () => {
      count += 1;
      const current = count;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return current;
    });

    const p1 = singleFlight(map, 'key1', fn);
    const p2 = singleFlight(map, 'key2', fn);

    expect(p2).not.toBe(p1);

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toBe(1);
    expect(r2).toBe(2);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('removes the key from the map after resolving', async () => {
    const map = new Map<string, Promise<number>>();
    let count = 0;

    const fn = vi.fn(async () => {
      count += 1;
      return count;
    });

    // First call
    const r1 = await singleFlight(map, 'key1', fn);
    expect(r1).toBe(1);
    expect(map.has('key1')).toBe(false);

    // Second call after first has resolved
    const r2 = await singleFlight(map, 'key1', fn);
    expect(r2).toBe(2);
    expect(map.has('key1')).toBe(false);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('removes the key from the map after rejecting', async () => {
    const map = new Map<string, Promise<number>>();
    let attempts = 0;

    const fn = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('First attempt failed');
      }
      return attempts;
    });

    // First call should fail
    await expect(singleFlight(map, 'key1', fn)).rejects.toThrow(
      'First attempt failed'
    );
    expect(map.has('key1')).toBe(false);

    // Second call after first has rejected should retry and succeed
    const r2 = await singleFlight(map, 'key1', fn);
    expect(r2).toBe(2);
    expect(map.has('key1')).toBe(false);

    expect(fn).toHaveBeenCalledTimes(2);
  });
});
