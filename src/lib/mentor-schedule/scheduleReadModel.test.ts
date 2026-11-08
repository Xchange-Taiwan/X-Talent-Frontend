import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AsyncReadResult } from '@/lib/asyncReadManager';
import type { RawMentorTimeslot } from '@/lib/profile/scheduleHelpers';

import { type ScheduleReadKey, scheduleReadModel } from './scheduleReadModel';

const july: ScheduleReadKey = { userId: 'mentor-1', year: 2026, month: 7 };
const august: ScheduleReadKey = { userId: 'mentor-1', year: 2026, month: 8 };
const julyForOtherMentor: ScheduleReadKey = {
  userId: 'mentor-2',
  year: 2026,
  month: 7,
};

function rows(id: number): RawMentorTimeslot[] {
  return [
    {
      id,
      type: 'ALLOW',
      dtstart: 1785070000,
      dtend: 1785071800,
      rrule: undefined,
      exdate: [],
    },
  ];
}

/** A fetcher whose promise the test resolves/rejects by hand. */
function deferredFetcher(): {
  fetcher: (signal: AbortSignal) => Promise<RawMentorTimeslot[]>;
  resolve: (value: RawMentorTimeslot[]) => void;
  reject: (err: Error) => void;
  wasAborted: () => boolean;
} {
  let resolve: (value: RawMentorTimeslot[]) => void = () => {};
  let reject: (err: Error) => void = () => {};
  let aborted = false;
  const promise = new Promise<RawMentorTimeslot[]>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    fetcher: (signal: AbortSignal) => {
      signal.addEventListener('abort', () => {
        aborted = true;
      });
      return promise;
    },
    resolve: (value) => resolve(value),
    reject: (err) => reject(err),
    wasAborted: () => aborted,
  };
}

describe('MentorScheduleReadModel', () => {
  afterEach(() => {
    scheduleReadModel.clear();
  });

  it('get() returns undefined for a month that has never been read', () => {
    expect(scheduleReadModel.get(july)).toBeUndefined();
  });

  it('subscribe() fetches through the model and caches the rows at (userId, year, month)', async () => {
    const fetcher = vi.fn().mockResolvedValue(rows(101));
    const updates: AsyncReadResult<RawMentorTimeslot[]>[] = [];

    const unsubscribe = scheduleReadModel.subscribe(july, fetcher, (res) =>
      updates.push(res)
    );

    expect(updates[0]).toEqual({ data: null, isLoading: true, error: null });

    await vi.waitFor(() => expect(updates).toHaveLength(2));

    expect(updates[1]).toEqual({
      data: rows(101),
      isLoading: false,
      error: null,
    });
    expect(scheduleReadModel.get(july)).toEqual(rows(101));
    expect(fetcher).toHaveBeenCalledOnce();

    unsubscribe();
  });

  it('isolates months - reading July does not populate August', async () => {
    scheduleReadModel.set(july, rows(101));

    expect(scheduleReadModel.get(july)).toEqual(rows(101));
    expect(scheduleReadModel.get(august)).toBeUndefined();
  });

  it('isolates mentors - the same month for a different userId is a different slot', () => {
    scheduleReadModel.set(july, rows(101));

    expect(scheduleReadModel.get(julyForOtherMentor)).toBeUndefined();
  });

  describe('cache hits', () => {
    it('serves an already-read month synchronously and issues no second request', async () => {
      const first = vi.fn().mockResolvedValue(rows(101));
      const leave = scheduleReadModel.subscribe(july, first, () => {});
      await vi.waitFor(() => expect(scheduleReadModel.get(july)).toBeDefined());
      leave();

      // Swiping back to a month already read (July -> August -> July).
      const second = vi.fn().mockResolvedValue(rows(999));
      const updates: AsyncReadResult<RawMentorTimeslot[]>[] = [];
      const leaveAgain = scheduleReadModel.subscribe(july, second, (res) =>
        updates.push(res)
      );

      expect(updates).toEqual([
        { data: rows(101), isLoading: false, error: null },
      ]);
      expect(second).not.toHaveBeenCalled();

      leaveAgain();
    });

    it('de-duplicates concurrent reads of the same month into one request', async () => {
      const fetcher = vi.fn().mockResolvedValue(rows(101));

      const leaveA = scheduleReadModel.subscribe(july, fetcher, () => {});
      const leaveB = scheduleReadModel.subscribe(july, fetcher, () => {});

      await vi.waitFor(() => expect(scheduleReadModel.get(july)).toBeDefined());
      expect(fetcher).toHaveBeenCalledOnce();

      leaveA();
      leaveB();
    });
  });

  describe('races the hook used to guard by hand', () => {
    it('cancels a month request as soon as its last reader leaves (month swipe / unmount)', () => {
      const july7 = deferredFetcher();

      const leave = scheduleReadModel.subscribe(july, july7.fetcher, () => {});
      expect(july7.wasAborted()).toBe(false);

      leave();

      expect(july7.wasAborted()).toBe(true);
    });

    it('a month abandoned mid-flight never publishes into the month the user switched to', async () => {
      const julyFetch = deferredFetcher();
      const leaveJuly = scheduleReadModel.subscribe(
        july,
        julyFetch.fetcher,
        () => {}
      );

      // The user swipes July -> August before July's request comes back.
      leaveJuly();
      const augustUpdates: AsyncReadResult<RawMentorTimeslot[]>[] = [];
      const leaveAugust = scheduleReadModel.subscribe(
        august,
        () => Promise.resolve(rows(202)),
        (res) => augustUpdates.push(res)
      );

      // July's response finally arrives, for a month nobody is looking at.
      julyFetch.resolve(rows(101));

      await vi.waitFor(() => expect(augustUpdates).toHaveLength(2));

      expect(augustUpdates[1].data).toEqual(rows(202));
      expect(scheduleReadModel.get(august)).toEqual(rows(202));
      // The abandoned response is not cached either: it was cancelled, so it
      // can't resurface as a "cache hit" the next time July is viewed.
      expect(scheduleReadModel.get(july)).toBeUndefined();

      leaveAugust();
    });

    it('a reader that leaves mid-fetch receives no further notifications, and a rejection after it leaves goes nowhere', async () => {
      const inFlight = deferredFetcher();
      const updates: AsyncReadResult<RawMentorTimeslot[]>[] = [];

      const leave = scheduleReadModel.subscribe(july, inFlight.fetcher, (res) =>
        updates.push(res)
      );
      expect(updates).toHaveLength(1);

      leave();
      inFlight.reject(new Error('component already unmounted'));

      await Promise.resolve();
      await Promise.resolve();

      expect(updates).toHaveLength(1);
      expect(scheduleReadModel.get(july)).toBeUndefined();
    });

    it('clear() (account switch) discards the outgoing account read so it never reaches the incoming one', async () => {
      const outgoing = deferredFetcher();
      const leaveOutgoing = scheduleReadModel.subscribe(
        july,
        outgoing.fetcher,
        () => {}
      );

      // The hook switches accounts: everything cached, listening, or in
      // flight for the previous user is dropped.
      scheduleReadModel.clear();
      expect(outgoing.wasAborted()).toBe(true);

      const incomingUpdates: AsyncReadResult<RawMentorTimeslot[]>[] = [];
      const leaveIncoming = scheduleReadModel.subscribe(
        julyForOtherMentor,
        () => Promise.resolve(rows(303)),
        (res) => incomingUpdates.push(res)
      );

      outgoing.resolve(rows(101));
      await vi.waitFor(() => expect(incomingUpdates).toHaveLength(2));

      expect(incomingUpdates[1].data).toEqual(rows(303));
      expect(scheduleReadModel.get(julyForOtherMentor)).toEqual(rows(303));
      expect(scheduleReadModel.get(july)).toBeUndefined();

      leaveOutgoing();
      leaveIncoming();
    });

    it('set() wins over a slower request already in flight for the same month', async () => {
      const slow = deferredFetcher();
      const updates: AsyncReadResult<RawMentorTimeslot[]>[] = [];
      const leave = scheduleReadModel.subscribe(july, slow.fetcher, (res) =>
        updates.push(res)
      );

      // A save/discard resolved first and wrote the month it just fetched.
      scheduleReadModel.set(july, rows(555));
      expect(updates[1]).toEqual({
        data: rows(555),
        isLoading: false,
        error: null,
      });

      slow.resolve(rows(101));
      await Promise.resolve();
      await Promise.resolve();

      expect(scheduleReadModel.get(july)).toEqual(rows(555));
      expect(updates).toHaveLength(2);

      leave();
    });
  });

  describe('refresh()', () => {
    it('re-fetches even on a cache hit and publishes the fresh rows to live readers', async () => {
      scheduleReadModel.set(july, rows(101));
      const updates: AsyncReadResult<RawMentorTimeslot[]>[] = [];
      const leave = scheduleReadModel.subscribe(
        july,
        () => Promise.resolve(rows(101)),
        (res) => updates.push(res)
      );
      updates.length = 0;

      const published = await scheduleReadModel.refresh(july, () =>
        Promise.resolve(rows(777))
      );

      expect(published).toEqual({
        data: rows(777),
        isLoading: false,
        error: null,
      });
      expect(scheduleReadModel.get(july)).toEqual(rows(777));
      // The already-mounted reader is handed the fresh rows too, without
      // having asked for the refresh itself.
      expect(updates).toEqual([
        { data: rows(777), isLoading: false, error: null },
      ]);

      leave();
    });

    it('resolves with the failure (leaving the previous rows in place) when the refetch fails', async () => {
      scheduleReadModel.set(july, rows(101));

      const published = await scheduleReadModel.refresh(july, () =>
        Promise.reject(new Error('network down'))
      );

      expect(published?.error).toBe('network down');
      expect(published?.data).toEqual(rows(101));
      expect(scheduleReadModel.get(july)).toEqual(rows(101));
    });

    it('tells an already-mounted reader about a failed refresh', async () => {
      scheduleReadModel.set(july, rows(101));
      const updates: AsyncReadResult<RawMentorTimeslot[]>[] = [];
      const leave = scheduleReadModel.subscribe(
        july,
        () => Promise.resolve(rows(101)),
        (res) => updates.push(res)
      );
      updates.length = 0;

      await scheduleReadModel.refresh(july, () =>
        Promise.reject(new Error('network down'))
      );

      expect(updates).toEqual([
        { data: rows(101), isLoading: false, error: 'network down' },
      ]);

      leave();
    });

    it('resolves with null - not a failure to report - when an account switch supersedes it mid-flight', async () => {
      const inFlight = deferredFetcher();

      const pending = scheduleReadModel.refresh(july, inFlight.fetcher);
      scheduleReadModel.clear();
      inFlight.reject(new Error('old account fetch failed'));

      await expect(pending).resolves.toBeNull();
      expect(scheduleReadModel.get(july)).toBeUndefined();
    });

    it('keeps its own request alive with no component mounted on the month', async () => {
      const published = await scheduleReadModel.refresh(july, () =>
        Promise.resolve(rows(888))
      );

      expect(published?.data).toEqual(rows(888));
      expect(scheduleReadModel.get(july)).toEqual(rows(888));
    });
  });

  describe('prefetch()', () => {
    it('warms a month with no component mounted on it', async () => {
      scheduleReadModel.prefetch(august, () => Promise.resolve(rows(202)));

      await vi.waitFor(() =>
        expect(scheduleReadModel.get(august)).toEqual(rows(202))
      );
    });

    it('is a no-op for a month already read', async () => {
      scheduleReadModel.set(august, rows(202));
      const fetcher = vi.fn().mockResolvedValue(rows(999));

      scheduleReadModel.prefetch(august, fetcher);
      await Promise.resolve();

      expect(fetcher).not.toHaveBeenCalled();
      expect(scheduleReadModel.get(august)).toEqual(rows(202));
    });

    it('joins an in-flight read instead of issuing a second request', async () => {
      const fetcher = vi.fn().mockResolvedValue(rows(202));
      const leave = scheduleReadModel.subscribe(august, fetcher, () => {});

      scheduleReadModel.prefetch(august, fetcher);

      await vi.waitFor(() =>
        expect(scheduleReadModel.get(august)).toBeDefined()
      );
      expect(fetcher).toHaveBeenCalledOnce();

      leave();
    });

    it('swallows failures - a prefetch never surfaces to the user', async () => {
      scheduleReadModel.prefetch(august, () =>
        Promise.reject(new Error('prefetch failed'))
      );

      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(scheduleReadModel.get(august)).toBeUndefined();
    });
  });

  it('clear() resets every cached month', () => {
    scheduleReadModel.set(july, rows(101));
    scheduleReadModel.set(august, rows(202));

    scheduleReadModel.clear();

    expect(scheduleReadModel.get(july)).toBeUndefined();
    expect(scheduleReadModel.get(august)).toBeUndefined();
  });
});
