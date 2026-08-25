import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Reservation } from '@/types/reservation';

import {
  cacheReservations,
  clearReservationsCache,
  getCachedReservations,
} from './reservationsCache';

function makeReservation(id: string): Reservation {
  return {
    id,
    name: 'Mentee',
    roleLine: '',
    date: '',
    time: '',
    messages: [],
    scheduleId: 1,
    dtstart: 1785070000,
    dtend: 1785071800,
    version: 0,
    senderUserId: 'mentee-1',
    participantUserId: 'mentor-1',
  };
}

describe('reservationsCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    clearReservationsCache();
    vi.useRealTimers();
  });

  it('is a miss before anything is cached', () => {
    expect(
      getCachedReservations('mentor-1', 'MENTOR_UPCOMING', 1000)
    ).toBeUndefined();
  });

  it('returns a cached value before the TTL elapses', () => {
    const items = [makeReservation('res-1')];
    cacheReservations('mentor-1', 'MENTOR_UPCOMING', 1000, items);

    expect(getCachedReservations('mentor-1', 'MENTOR_UPCOMING', 1000)).toBe(
      items
    );

    // Just under the 30s TTL - still a hit.
    vi.advanceTimersByTime(29_999);
    expect(getCachedReservations('mentor-1', 'MENTOR_UPCOMING', 1000)).toBe(
      items
    );
  });

  it('expires exactly at the 30s TTL', () => {
    const items = [makeReservation('res-1')];
    cacheReservations('mentor-1', 'MENTOR_UPCOMING', 1000, items);

    vi.advanceTimersByTime(30_000);

    expect(
      getCachedReservations('mentor-1', 'MENTOR_UPCOMING', 1000)
    ).toBeUndefined();
  });

  it('keys are scoped independently by userId, state, and endOfMonthUnix', () => {
    const a = [makeReservation('a')];
    const b = [makeReservation('b')];
    const c = [makeReservation('c')];
    const d = [makeReservation('d')];

    cacheReservations('mentor-1', 'MENTOR_UPCOMING', 1000, a);
    cacheReservations('mentor-2', 'MENTOR_UPCOMING', 1000, b);
    cacheReservations('mentor-1', 'MENTOR_PENDING', 1000, c);
    cacheReservations('mentor-1', 'MENTOR_UPCOMING', 2000, d);

    expect(getCachedReservations('mentor-1', 'MENTOR_UPCOMING', 1000)).toBe(a);
    expect(getCachedReservations('mentor-2', 'MENTOR_UPCOMING', 1000)).toBe(b);
    expect(getCachedReservations('mentor-1', 'MENTOR_PENDING', 1000)).toBe(c);
    expect(getCachedReservations('mentor-1', 'MENTOR_UPCOMING', 2000)).toBe(d);
  });

  it('clearReservationsCache wipes every key, not just one', () => {
    cacheReservations('mentor-1', 'MENTOR_UPCOMING', 1000, [
      makeReservation('a'),
    ]);
    cacheReservations('mentor-1', 'MENTOR_UPCOMING', 2000, [
      makeReservation('b'),
    ]);

    clearReservationsCache();

    expect(
      getCachedReservations('mentor-1', 'MENTOR_UPCOMING', 1000)
    ).toBeUndefined();
    expect(
      getCachedReservations('mentor-1', 'MENTOR_UPCOMING', 2000)
    ).toBeUndefined();
  });

  it('a later cacheReservations call for the same key overwrites the earlier value and resets its TTL', () => {
    cacheReservations('mentor-1', 'MENTOR_UPCOMING', 1000, [
      makeReservation('stale'),
    ]);

    vi.advanceTimersByTime(20_000);
    const fresh = [makeReservation('fresh')];
    cacheReservations('mentor-1', 'MENTOR_UPCOMING', 1000, fresh);

    // 25s after the second write (45s after the first) - within the fresh
    // write's own 30s TTL, so it must still be a hit.
    vi.advanceTimersByTime(25_000);
    expect(getCachedReservations('mentor-1', 'MENTOR_UPCOMING', 1000)).toBe(
      fresh
    );
  });
});
