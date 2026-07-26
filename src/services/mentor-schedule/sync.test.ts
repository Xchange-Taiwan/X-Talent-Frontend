import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchMentorSchedule } from './schedule';
import { scheduleCache } from './scheduleCache';
import {
  loadMonthScheduleCached,
  prefetchMonthSchedule,
  type ScheduleMonthRef,
} from './sync';

vi.mock('./schedule', () => ({
  fetchMentorSchedule: vi.fn(),
}));

describe('sync schedule caching integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    scheduleCache.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const ref: ScheduleMonthRef = {
    userId: 'mentor_1',
    year: 2026,
    month: 5,
  };

  it('loadMonthScheduleCached coalesces concurrent in-flight requests', async () => {
    let resolveFetch: (val: any) => void = () => {};
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    vi.mocked(fetchMentorSchedule).mockImplementation(
      () => fetchPromise as any
    );

    // First call triggers a fetch
    const res1 = loadMonthScheduleCached(ref);
    expect(res1.cached).toBeUndefined();

    // Second call should return the exact same promise (coalesced) and no new fetch triggered
    const res2 = loadMonthScheduleCached(ref);
    expect(res2.cached).toBeUndefined();
    expect(res2.revalidate).toBe(res1.revalidate);

    expect(fetchMentorSchedule).toHaveBeenCalledTimes(1);

    // Resolve the fetch with empty segments
    resolveFetch({ segments: [] });

    const raws = await res1.revalidate;
    expect(raws).toEqual([]);

    // After resolution, inflight should be cleared
    expect(scheduleCache.getInflight(`${ref.userId}:2026-5`)).toBeUndefined();
  });

  it('loadMonthScheduleCached handles rejection and clears inflight status', async () => {
    vi.mocked(fetchMentorSchedule).mockRejectedValueOnce(
      new Error('Network error')
    );

    const res = loadMonthScheduleCached(ref);
    await expect(res.revalidate).rejects.toThrow('Network error');

    // In-flight should be cleared on rejection
    expect(scheduleCache.getInflight(`${ref.userId}:2026-5`)).toBeUndefined();
  });

  it('loadMonthScheduleCached guards against race condition when cache is primed or cleared during fetch', async () => {
    let resolveFetch: (val: any) => void = () => {};
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    vi.mocked(fetchMentorSchedule).mockImplementation(
      () => fetchPromise as any
    );

    const res = loadMonthScheduleCached(ref);

    // Synchronously prime the cache with a fresh slot
    const freshSlot = {
      id: 999,
      type: 'ALLOW' as const,
      dtstart: 123,
      dtend: 456,
      rrule: undefined,
      exdate: [],
    };
    scheduleCache.prime(`${ref.userId}:2026-5`, [freshSlot]);

    // Resolve original loadMonthSchedule request with empty segments (old stale result)
    resolveFetch({ segments: [] });

    await res.revalidate;

    // The cache should NOT be overwritten by the old empty resolved fetch result
    expect(scheduleCache.get(`${ref.userId}:2026-5`)).toEqual([freshSlot]);
  });

  it('prefetchMonthSchedule uses prefetch with fetch() and does not trigger double load', async () => {
    vi.mocked(fetchMentorSchedule).mockResolvedValue({ segments: [] });

    prefetchMonthSchedule(ref);

    // Await the async prefetch task to fully resolve and populate cache
    await vi.runAllTimersAsync();

    // Subsequent cached load should load synchronously from the prefetched cache
    const res = loadMonthScheduleCached(ref);
    expect(res.cached).toEqual([]);

    // Prefetch (1) + Subsequent SWR revalidation call (1) = 2 calls
    expect(fetchMentorSchedule).toHaveBeenCalledTimes(2);
  });
});
