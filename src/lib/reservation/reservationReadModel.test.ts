import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AsyncReadResult } from '@/lib/asyncReadManager';

import {
  type FetchReservationsResult,
  MENTOR_SCHEDULE_RESERVATIONS_TTL_MS,
  reservationReadModel,
} from './reservationReadModel';

const page = (id: string, next_dtend = 0): FetchReservationsResult => ({
  items: [
    {
      id,
      name: 'Test User',
      roleLine: 'Engineer',
      date: 'Mon, Jan 01, 2024',
      time: '10:00 am – 11:00 am',
      messages: [],
      scheduleId: 1,
      dtstart: 1700000000,
      dtend: 1700003600,
      senderUserId: 'sender-1',
      participantUserId: 'participant-1',
      version: 0,
    },
  ],
  next_dtend,
});

describe('ReservationReadModel', () => {
  it('get() returns undefined for a key that has never been read', () => {
    reservationReadModel.clear();
    expect(
      reservationReadModel.get({ userId: 'u1', state: 'MENTEE_UPCOMING' })
    ).toBeUndefined();
  });

  it('subscribe() fetches through the model and caches the result at (userId, state)', async () => {
    reservationReadModel.clear();
    const key = { userId: 'u1', state: 'MENTEE_UPCOMING' } as const;
    const fetcher = vi.fn().mockResolvedValue(page('a'));
    const updates: AsyncReadResult<FetchReservationsResult>[] = [];

    const unsubscribe = reservationReadModel.subscribe(key, fetcher, (res) =>
      updates.push(res)
    );

    expect(updates[0]).toEqual({ data: null, isLoading: true, error: null });

    await vi.waitFor(() => {
      expect(updates.length).toBe(2);
    });

    expect(updates[1].data).toEqual(page('a'));
    expect(reservationReadModel.get(key)).toEqual(page('a'));
    expect(fetcher).toHaveBeenCalledOnce();

    unsubscribe();
  });

  it('isolates cache entries by userId - same state, different user does not share a cache slot', async () => {
    reservationReadModel.clear();
    const keyA = { userId: 'u1', state: 'MENTEE_UPCOMING' } as const;
    const keyB = { userId: 'u2', state: 'MENTEE_UPCOMING' } as const;

    reservationReadModel.set(keyA, page('a'));

    expect(reservationReadModel.get(keyA)).toEqual(page('a'));
    expect(reservationReadModel.get(keyB)).toBeUndefined();
  });

  it('isolates cache entries by state - same user, different state does not share a cache slot', async () => {
    reservationReadModel.clear();
    const upcoming = { userId: 'u1', state: 'MENTEE_UPCOMING' } as const;
    const pending = { userId: 'u1', state: 'MENTEE_PENDING' } as const;

    reservationReadModel.set(upcoming, page('upcoming'));

    expect(reservationReadModel.get(upcoming)).toEqual(page('upcoming'));
    expect(reservationReadModel.get(pending)).toBeUndefined();
  });

  it('update() derives the next value from the current cached value (optimistic removal)', () => {
    reservationReadModel.clear();
    const key = { userId: 'u1', state: 'MENTEE_PENDING' } as const;
    reservationReadModel.set(key, page('to-remove'));

    reservationReadModel.update(key, (current) =>
      current
        ? {
            ...current,
            items: current.items.filter((it) => it.id !== 'to-remove'),
          }
        : undefined
    );

    expect(reservationReadModel.get(key)?.items).toHaveLength(0);
  });

  it('invalidate() drops the cached value and cancels the in-flight fetch for that key', () => {
    reservationReadModel.clear();
    const key = { userId: 'u1', state: 'MENTEE_HISTORY' } as const;
    reservationReadModel.set(key, page('stale'));
    let aborted = false;
    const fetcher = (signal: AbortSignal) => {
      signal.addEventListener('abort', () => {
        aborted = true;
      });
      return new Promise<FetchReservationsResult>(() => {});
    };

    const unsubscribe = reservationReadModel.subscribe(key, fetcher, () => {}, {
      force: true,
    });

    reservationReadModel.invalidate(key);

    expect(reservationReadModel.get(key)).toBeUndefined();
    expect(aborted).toBe(true);

    unsubscribe();
  });

  describe('hasSubscribers()', () => {
    it('is false when nothing has ever subscribed to the key', () => {
      reservationReadModel.clear();
      expect(
        reservationReadModel.hasSubscribers({
          userId: 'u1',
          state: 'MENTEE_UPCOMING',
        })
      ).toBe(false);
    });

    it('is true while a subscriber is actively mounted for the key', async () => {
      reservationReadModel.clear();
      const key = { userId: 'u1', state: 'MENTEE_UPCOMING' } as const;
      const fetcher = vi.fn().mockResolvedValue(page('a'));

      const unsubscribe = reservationReadModel.subscribe(
        key,
        fetcher,
        () => {}
      );

      expect(reservationReadModel.hasSubscribers(key)).toBe(true);

      unsubscribe();

      expect(reservationReadModel.hasSubscribers(key)).toBe(false);
    });

    it('is isolated per key - subscribing to one state does not flag another', async () => {
      reservationReadModel.clear();
      const upcoming = { userId: 'u1', state: 'MENTEE_UPCOMING' } as const;
      const pending = { userId: 'u1', state: 'MENTEE_PENDING' } as const;
      const fetcher = vi.fn().mockResolvedValue(page('a'));

      const unsubscribe = reservationReadModel.subscribe(
        upcoming,
        fetcher,
        () => {}
      );

      expect(reservationReadModel.hasSubscribers(upcoming)).toBe(true);
      expect(reservationReadModel.hasSubscribers(pending)).toBe(false);

      unsubscribe();
    });
  });

  it('clear() resets every cached entry', () => {
    const key = { userId: 'u1', state: 'MENTOR_UPCOMING' } as const;
    reservationReadModel.set(key, page('a'));
    expect(reservationReadModel.get(key)).toBeDefined();

    reservationReadModel.clear();

    expect(reservationReadModel.get(key)).toBeUndefined();
  });

  describe('endOfMonthUnix-scoped keys (mentor-schedule calendar)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      reservationReadModel.clear();
      vi.useRealTimers();
    });

    it('isolates cache slots by endOfMonthUnix - same user and state, different month', () => {
      const monthA = {
        userId: 'mentor-1',
        state: 'MENTOR_UPCOMING',
        endOfMonthUnix: 1000,
      } as const;
      const monthB = {
        userId: 'mentor-1',
        state: 'MENTOR_UPCOMING',
        endOfMonthUnix: 2000,
      } as const;

      reservationReadModel.set(monthA, page('a'));
      reservationReadModel.set(monthB, page('b'));

      expect(reservationReadModel.get(monthA)).toEqual(page('a'));
      expect(reservationReadModel.get(monthB)).toEqual(page('b'));
    });

    it('does not collide with the default unscoped slot for the same user and state', () => {
      const unscoped = {
        userId: 'mentor-1',
        state: 'MENTOR_UPCOMING',
      } as const;
      const scoped = {
        userId: 'mentor-1',
        state: 'MENTOR_UPCOMING',
        endOfMonthUnix: 1000,
      } as const;

      reservationReadModel.set(unscoped, page('unscoped'));
      reservationReadModel.set(scoped, page('scoped'));

      expect(reservationReadModel.get(unscoped)).toEqual(page('unscoped'));
      expect(reservationReadModel.get(scoped)).toEqual(page('scoped'));
    });

    it('a value written with ttlMs is served as a hit before the TTL elapses', () => {
      const key = {
        userId: 'mentor-1',
        state: 'MENTOR_PENDING',
        endOfMonthUnix: 1000,
      } as const;
      reservationReadModel.set(
        key,
        page('a'),
        MENTOR_SCHEDULE_RESERVATIONS_TTL_MS
      );

      vi.advanceTimersByTime(MENTOR_SCHEDULE_RESERVATIONS_TTL_MS - 1);

      expect(reservationReadModel.get(key)).toEqual(page('a'));
    });

    it('a value written with ttlMs expires at the TTL, unlike the default permanent slot', () => {
      const key = {
        userId: 'mentor-1',
        state: 'MENTOR_PENDING',
        endOfMonthUnix: 1000,
      } as const;
      reservationReadModel.set(
        key,
        page('a'),
        MENTOR_SCHEDULE_RESERVATIONS_TTL_MS
      );

      vi.advanceTimersByTime(MENTOR_SCHEDULE_RESERVATIONS_TTL_MS);

      expect(reservationReadModel.get(key)).toBeUndefined();
    });

    it('omitting ttlMs on a scoped key still yields a permanent slot', () => {
      const key = {
        userId: 'mentor-1',
        state: 'MENTOR_PENDING',
        endOfMonthUnix: 1000,
      } as const;
      reservationReadModel.set(key, page('a'));

      vi.advanceTimersByTime(MENTOR_SCHEDULE_RESERVATIONS_TTL_MS * 10);

      expect(reservationReadModel.get(key)).toEqual(page('a'));
    });
  });
});
