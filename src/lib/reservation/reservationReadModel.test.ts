import { fromPartial } from '@total-typescript/shoehorn';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AsyncReadResult } from '@/lib/asyncReadManager';
import type { Reservation } from '@/types/reservation';

import {
  type FetchReservationsResult,
  MENTOR_SCHEDULE_RESERVATIONS_TTL_MS,
  type ReservationReadKey,
  reservationReadModel,
} from './reservationReadModel';

const upcoming: ReservationReadKey = {
  userId: 'user-1',
  state: 'MENTEE_UPCOMING',
};
const pending: ReservationReadKey = {
  userId: 'user-1',
  state: 'MENTEE_PENDING',
};
const upcomingOtherUser: ReservationReadKey = {
  userId: 'user-2',
  state: 'MENTEE_UPCOMING',
};

function makeReservation(
  id: string,
  overrides: Partial<Reservation> = {}
): Reservation {
  return fromPartial<Reservation>({
    id,
    name: `User ${id}`,
    date: '2026-07-15',
    time: '14:00 - 14:30',
    messages: [],
    scheduleId: 1,
    dtstart: 1784124000,
    dtend: 1784125800,
    ...overrides,
  });
}

function page(nextDtend: number, ids: string[] = []): FetchReservationsResult {
  return {
    items: ids.map((id) => makeReservation(id)),
    next_dtend: nextDtend,
  };
}

describe('ReservationReadModel', () => {
  afterEach(() => {
    reservationReadModel.clear();
    vi.useRealTimers();
  });

  it('does not expose shallow leak methods (hasSubscribers / getMatchingKeys) on its public interface', () => {
    expect('hasSubscribers' in reservationReadModel).toBe(false);
    expect('getMatchingKeys' in reservationReadModel).toBe(false);
  });

  it('get() returns undefined before any read or write', () => {
    expect(reservationReadModel.get(upcoming)).toBeUndefined();
  });

  it('subscribe() fetches through the model and caches at (userId, state)', async () => {
    const fetcher = vi.fn().mockResolvedValue(page(42));
    const updates: AsyncReadResult<FetchReservationsResult>[] = [];

    const unsubscribe = reservationReadModel.subscribe(
      upcoming,
      fetcher,
      (res) => updates.push(res)
    );

    expect(updates[0]).toEqual({ data: null, isLoading: true, error: null });

    await vi.waitFor(() => expect(updates).toHaveLength(2));

    expect(updates[1]).toEqual({
      data: page(42),
      isLoading: false,
      error: null,
    });
    expect(reservationReadModel.get(upcoming)).toEqual(page(42));
    expect(fetcher).toHaveBeenCalledOnce();

    unsubscribe();
  });

  it('isolates states and users into distinct cache slots', () => {
    reservationReadModel.set(upcoming, page(1));

    expect(reservationReadModel.get(upcoming)).toEqual(page(1));
    expect(reservationReadModel.get(pending)).toBeUndefined();
    expect(reservationReadModel.get(upcomingOtherUser)).toBeUndefined();
  });

  it('isolates month-scoped keys from the unscoped slot and from other months', () => {
    const julyScoped: ReservationReadKey = {
      userId: 'mentor-1',
      state: 'MENTOR_UPCOMING',
      endOfMonthUnix: 1785542400,
    };
    const augustScoped: ReservationReadKey = {
      userId: 'mentor-1',
      state: 'MENTOR_UPCOMING',
      endOfMonthUnix: 1788220800,
    };
    const unscoped: ReservationReadKey = {
      userId: 'mentor-1',
      state: 'MENTOR_UPCOMING',
    };

    reservationReadModel.set(julyScoped, page(7));
    reservationReadModel.set(unscoped, page(99));

    expect(reservationReadModel.get(julyScoped)).toEqual(page(7));
    expect(reservationReadModel.get(unscoped)).toEqual(page(99));
    expect(reservationReadModel.get(augustScoped)).toBeUndefined();
  });

  it('clear() resets every cached entry', () => {
    reservationReadModel.set(upcoming, page(1));
    reservationReadModel.set(pending, page(2));

    reservationReadModel.clear();

    expect(reservationReadModel.get(upcoming)).toBeUndefined();
    expect(reservationReadModel.get(pending)).toBeUndefined();
  });

  describe('patchItem', () => {
    it('patches matching reservation in place across unscoped and month-scoped slices without dropping Pages 2..N or next_dtend', () => {
      const unscopedHistory: ReservationReadKey = {
        userId: 'user-1',
        state: 'MENTEE_HISTORY',
      };
      const monthHistory: ReservationReadKey = {
        userId: 'user-1',
        state: 'MENTEE_HISTORY',
        endOfMonthUnix: 1785542400,
      };
      const untouchedPending: ReservationReadKey = {
        userId: 'user-1',
        state: 'MENTEE_PENDING',
      };

      // Simulate 2 loaded pages (12 items total) with a non-zero next_dtend cursor
      const page1Ids = Array.from({ length: 10 }, (_, i) => `p1-${i + 1}`);
      const page2Ids = ['p2-11', 'p2-target-12'];
      reservationReadModel.set(unscopedHistory, {
        items: [...page1Ids, ...page2Ids].map((id) =>
          makeReservation(id, {
            feedback: {
              meetingHappened: true,
              rating: {
                rating: 7,
                content: 'old',
                createdAt: 1000,
                updatedAt: 1000,
                authorName: 'A',
                isPublic: true,
              },
              nextStep: null,
            },
          })
        ),
        next_dtend: 1700000500,
      });
      reservationReadModel.set(
        monthHistory,
        {
          items: [makeReservation('p2-target-12')],
          next_dtend: 0,
        },
        MENTOR_SCHEDULE_RESERVATIONS_TTL_MS
      );
      reservationReadModel.set(untouchedPending, page(0, ['pending-1']));

      reservationReadModel.patchItem(
        unscopedHistory,
        'p2-target-12',
        (item) => ({
          ...item,
          feedback: {
            meetingHappened: true,
            rating: {
              rating: 10,
              content: 'updated on page 2',
              createdAt: 1000,
              updatedAt: 2000,
              authorName: 'A',
              isPublic: true,
            },
            nextStep: null,
          },
        })
      );

      const updatedUnscoped = reservationReadModel.get(unscopedHistory);
      expect(updatedUnscoped?.items).toHaveLength(12);
      expect(updatedUnscoped?.next_dtend).toBe(1700000500);
      expect(updatedUnscoped?.items[11]?.feedback?.rating?.content).toBe(
        'updated on page 2'
      );
      expect(updatedUnscoped?.items[0]?.id).toBe('p1-1');

      const updatedMonth = reservationReadModel.get(monthHistory);
      expect(updatedMonth?.items[0]?.feedback?.rating?.content).toBe(
        'updated on page 2'
      );
      expect(reservationReadModel.get(untouchedPending)?.items[0]?.id).toBe(
        'pending-1'
      );
    });
  });

  describe('loadNextPage', () => {
    it('appends the next cursor page, deduplicates concurrent calls, and updates next_dtend', async () => {
      const historyKey: ReservationReadKey = {
        userId: 'user-1',
        state: 'MENTEE_HISTORY',
      };
      reservationReadModel.set(historyKey, page(500, ['res-1', 'res-2']));

      let resolvePage!: (res: FetchReservationsResult) => void;
      const fetchPage = vi.fn(
        () =>
          new Promise<FetchReservationsResult>((resolve) => {
            resolvePage = resolve;
          })
      );

      const p1 = reservationReadModel.loadNextPage(historyKey, fetchPage);
      const p2 = reservationReadModel.loadNextPage(historyKey, fetchPage);

      expect(fetchPage).toHaveBeenCalledTimes(1);
      expect(fetchPage).toHaveBeenCalledWith(500, expect.any(AbortSignal));

      resolvePage(page(0, ['res-2', 'res-3']));
      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1?.items.map((it) => it.id)).toEqual(['res-1', 'res-2', 'res-3']);
      expect(r1?.next_dtend).toBe(0);
      expect(r2).toEqual(r1);
      expect(
        reservationReadModel.get(historyKey)?.items.map((it) => it.id)
      ).toEqual(['res-1', 'res-2', 'res-3']);
    });

    it('returns null without fetching when uncached or next_dtend is 0', async () => {
      const fetchPage = vi.fn();
      expect(
        await reservationReadModel.loadNextPage(upcoming, fetchPage)
      ).toBeNull();

      reservationReadModel.set(upcoming, page(0, ['res-1']));
      expect(
        await reservationReadModel.loadNextPage(upcoming, fetchPage)
      ).toBeNull();
      expect(fetchPage).not.toHaveBeenCalled();
    });

    it('aborts in-flight loadNextPage on clear() and never writes stale items into cache', async () => {
      reservationReadModel.set(upcoming, page(888, ['res-1']));

      let capturedSignal: AbortSignal | undefined;
      let resolvePage!: (res: FetchReservationsResult) => void;
      const fetchPage = vi.fn((_cursor: number, signal: AbortSignal) => {
        capturedSignal = signal;
        return new Promise<FetchReservationsResult>((resolve) => {
          resolvePage = resolve;
        });
      });

      const pendingPage = reservationReadModel.loadNextPage(
        upcoming,
        fetchPage
      );
      expect(capturedSignal?.aborted).toBe(false);

      reservationReadModel.clear();
      expect(capturedSignal?.aborted).toBe(true);

      // Resolves immediately to null on abort without waiting for the
      // underlying transport promise to settle.
      const outcome = await pendingPage;
      expect(outcome).toBeNull();

      // Even if the underlying transport ignores signal and resolves late,
      // cleared cache must remain empty.
      resolvePage(page(0, ['leaked-after-clear']));
      await Promise.resolve();
      expect(reservationReadModel.get(upcoming)).toBeUndefined();
    });

    it('absorbs late post-abort rejections and propagates non-aborted errors', async () => {
      reservationReadModel.set(upcoming, page(888, ['res-1']));

      let rejectAborted!: (err: Error) => void;
      const abortedPage = reservationReadModel.loadNextPage(
        upcoming,
        () =>
          new Promise<FetchReservationsResult>((_resolve, reject) => {
            rejectAborted = reject;
          })
      );

      reservationReadModel.clear();
      await expect(abortedPage).resolves.toBeNull();

      const abortErr = new Error('The operation was aborted.');
      abortErr.name = 'AbortError';
      rejectAborted(abortErr);
      await Promise.resolve();

      reservationReadModel.set(upcoming, page(999, ['res-1']));
      await expect(
        reservationReadModel.loadNextPage(upcoming, () =>
          Promise.reject(new Error('network boom'))
        )
      ).rejects.toThrow('network boom');
    });
  });

  describe('invalidateOrRefresh', () => {
    it('drops unsubscribed slices with zero network calls and refreshes subscribed unscoped + month-scoped slices in place', async () => {
      const unscoped: ReservationReadKey = {
        userId: 'mentor-1',
        state: 'MENTOR_PENDING',
      };
      const subscribedMonth: ReservationReadKey = {
        userId: 'mentor-1',
        state: 'MENTOR_PENDING',
        endOfMonthUnix: 1785542400,
      };
      const unsubscribedMonth: ReservationReadKey = {
        userId: 'mentor-1',
        state: 'MENTOR_PENDING',
        endOfMonthUnix: 1788220800,
      };

      reservationReadModel.set(unscoped, page(0, ['stale-unscoped']));
      reservationReadModel.set(
        subscribedMonth,
        page(0, ['stale-month']),
        MENTOR_SCHEDULE_RESERVATIONS_TTL_MS
      );
      reservationReadModel.set(
        unsubscribedMonth,
        page(0, ['stale-aug']),
        MENTOR_SCHEDULE_RESERVATIONS_TTL_MS
      );

      const unsub = reservationReadModel.subscribe(
        subscribedMonth,
        () => new Promise(() => {}),
        () => {},
        { ttlMs: MENTOR_SCHEDULE_RESERVATIONS_TTL_MS }
      );

      const refreshFetcher = vi.fn().mockResolvedValue(page(0, ['fresh-july']));

      await reservationReadModel.invalidateOrRefresh(unscoped, refreshFetcher);

      // Unsubscribed slices were dropped with 0 fetches for them
      expect(reservationReadModel.get(unscoped)).toBeUndefined();
      expect(reservationReadModel.get(unsubscribedMonth)).toBeUndefined();

      // Subscribed month slice was refreshed in place once with an AbortSignal
      expect(refreshFetcher).toHaveBeenCalledTimes(1);
      expect(refreshFetcher).toHaveBeenCalledWith(
        subscribedMonth,
        expect.any(AbortSignal)
      );
      expect(
        reservationReadModel.get(subscribedMonth)?.items.map((it) => it.id)
      ).toEqual(['fresh-july']);

      unsub();
    });

    it('aborts in-flight refreshes on account-switch clear() and prevents late writes', async () => {
      const unsub = reservationReadModel.subscribe(
        upcoming,
        vi.fn().mockResolvedValue(page(0, ['initial'])),
        () => {}
      );
      await vi.waitFor(() =>
        expect(reservationReadModel.get(upcoming)).toBeDefined()
      );

      let capturedSignal: AbortSignal | undefined;
      let resolveRefresh!: (val: FetchReservationsResult) => void;
      const refreshFetcher = vi.fn(
        (_targetKey: ReservationReadKey, signal: AbortSignal) => {
          capturedSignal = signal;
          return new Promise<FetchReservationsResult>((resolve) => {
            resolveRefresh = resolve;
          });
        }
      );

      const refreshPromise = reservationReadModel.invalidateOrRefresh(
        upcoming,
        refreshFetcher
      );
      expect(capturedSignal?.aborted).toBe(false);

      // Simulate account switch
      reservationReadModel.clear();
      expect(capturedSignal?.aborted).toBe(true);

      resolveRefresh(page(0, ['stale-old-account']));
      await refreshPromise;

      expect(reservationReadModel.get(upcoming)).toBeUndefined();
      unsub();
    });
  });

  describe('per-key TTL for month-scoped calendar reads', () => {
    const monthKey: ReservationReadKey = {
      userId: 'mentor-1',
      state: 'MENTOR_UPCOMING',
      endOfMonthUnix: 1785542400,
    };

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-10T00:00:00Z'));
    });

    it('serves a fresh month-scoped entry before TTL elapses, then expires it after MENTOR_SCHEDULE_RESERVATIONS_TTL_MS', async () => {
      const first = vi.fn().mockResolvedValue(page(1));
      const unsub1 = reservationReadModel.subscribe(monthKey, first, () => {}, {
        ttlMs: MENTOR_SCHEDULE_RESERVATIONS_TTL_MS,
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(reservationReadModel.get(monthKey)).toEqual(page(1));
      unsub1();

      vi.advanceTimersByTime(MENTOR_SCHEDULE_RESERVATIONS_TTL_MS - 1);
      expect(reservationReadModel.get(monthKey)).toEqual(page(1));

      vi.advanceTimersByTime(2);
      expect(reservationReadModel.get(monthKey)).toBeUndefined();
    });

    it('leaves unscoped dashboard entries permanent across the same elapsed time', () => {
      reservationReadModel.set(upcoming, page(10));

      vi.advanceTimersByTime(MENTOR_SCHEDULE_RESERVATIONS_TTL_MS * 10);

      expect(reservationReadModel.get(upcoming)).toEqual(page(10));
    });
  });

  describe('evictItem & invalidate across unscoped + month-scoped slices', () => {
    const unscoped: ReservationReadKey = {
      userId: 'mentor-1',
      state: 'MENTOR_PENDING',
    };
    const monthA: ReservationReadKey = {
      userId: 'mentor-1',
      state: 'MENTOR_PENDING',
      endOfMonthUnix: 1785542400,
    };
    const monthB: ReservationReadKey = {
      userId: 'mentor-1',
      state: 'MENTOR_PENDING',
      endOfMonthUnix: 1788220800,
    };
    const otherState: ReservationReadKey = {
      userId: 'mentor-1',
      state: 'MENTOR_UPCOMING',
      endOfMonthUnix: 1785542400,
    };

    it('evictItem() removes the target reservation from both unscoped and month-scoped slices for the same (userId, state)', () => {
      reservationReadModel.set(unscoped, {
        items: [makeReservation('r1'), makeReservation('r2')],
        next_dtend: 0,
      });
      reservationReadModel.set(
        monthA,
        {
          items: [makeReservation('r1'), makeReservation('r3')],
          next_dtend: 0,
        },
        MENTOR_SCHEDULE_RESERVATIONS_TTL_MS
      );
      reservationReadModel.set(
        otherState,
        { items: [makeReservation('r1')], next_dtend: 0 },
        MENTOR_SCHEDULE_RESERVATIONS_TTL_MS
      );

      reservationReadModel.evictItem(unscoped, 'r1');

      expect(
        reservationReadModel.get(unscoped)?.items.map((i) => i.id)
      ).toEqual(['r2']);
      expect(reservationReadModel.get(monthA)?.items.map((i) => i.id)).toEqual([
        'r3',
      ]);
      expect(
        reservationReadModel.get(otherState)?.items.map((i) => i.id)
      ).toEqual(['r1']);
    });

    it('invalidate() with an unscoped key invalidates both unscoped and indexed month-scoped slices', () => {
      reservationReadModel.set(unscoped, page(1));
      reservationReadModel.set(
        monthA,
        page(2),
        MENTOR_SCHEDULE_RESERVATIONS_TTL_MS
      );
      reservationReadModel.set(
        monthB,
        page(3),
        MENTOR_SCHEDULE_RESERVATIONS_TTL_MS
      );

      reservationReadModel.invalidate(unscoped);

      expect(reservationReadModel.get(unscoped)).toBeUndefined();
      expect(reservationReadModel.get(monthA)).toBeUndefined();
      expect(reservationReadModel.get(monthB)).toBeUndefined();
    });
  });
});
