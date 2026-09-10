import { fromPartial } from '@total-typescript/shoehorn';
import dayjs from 'dayjs';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { ApiError } from '@/lib/apiClient';
import { scheduleReadModel } from '@/lib/mentor-schedule/scheduleReadModel';
import type { RawMentorTimeslot } from '@/lib/profile/scheduleHelpers';

import {
  deleteMentorSchedule,
  fetchMentorSchedule,
  saveMentorSchedule,
  type ScheduleData,
  type TimeSlotDTO,
} from './schedule';
import {
  loadMonthSchedule,
  loadMonthScheduleFresh,
  prefetchMonthSchedule,
  type ScheduleMonthRef,
  syncMonths,
  syncMonthSchedule,
} from './sync';

vi.mock('./schedule', () => ({
  fetchMentorSchedule: vi.fn(),
  saveMentorSchedule: vi.fn(),
  deleteMentorSchedule: vi.fn(),
}));

const ref: ScheduleMonthRef = {
  userId: 'mentor_1',
  year: 2026,
  month: 5,
};

// dtstart inside May 2026 and inside June 2026 respectively - loadMonthSchedule
// keeps only the rows whose local month matches the requested one.
const MAY_2026 = Date.UTC(2026, 4, 12, 9, 0, 0) / 1000;
const JUNE_2026 = Date.UTC(2026, 5, 12, 9, 0, 0) / 1000;

function segment(dtstart: number, id: number): ScheduleData['segments'] {
  return [
    {
      id,
      user_id: 1,
      dt_type: 'ALLOW',
      dt_year: 2026,
      dt_month: 5,
      dtstart,
      dtend: dtstart + 1800,
      timezone: 'UTC',
    },
  ];
}

/**
 * The single upsert payload shape reused by nearly every syncMonthSchedule
 * test below - a factory keeps each test focused on what it's actually
 * asserting instead of restating this boilerplate.
 */
function createMockUpsertPayload(dtstart: number = MAY_2026): TimeSlotDTO[] {
  return [
    fromPartial<TimeSlotDTO>({
      dt_type: 'ALLOW',
      dtstart,
      dtend: dtstart + 1800,
    }),
  ];
}

describe('mentor-schedule sync', () => {
  // Fixed via vi.stubEnv (auto-restored by Vitest) rather than a raw
  // process.env assignment, which would leak into other test files sharing
  // this worker thread. dayjs('2026-05-01') below depends on the machine's
  // local timezone otherwise, causing CI/local end-of-month unix mismatches.
  beforeAll(() => {
    vi.stubEnv('TZ', 'UTC');
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    scheduleReadModel.clear();
    vi.clearAllMocks();
  });

  describe('loadMonthSchedule', () => {
    it('keeps only the rows whose dtstart falls in the requested month', async () => {
      vi.mocked(fetchMentorSchedule).mockResolvedValue({
        segments: [...segment(MAY_2026, 1)!, ...segment(JUNE_2026, 2)!],
      });

      const raws = await loadMonthSchedule(ref);

      expect(raws.map((r) => r.id)).toEqual([1]);
    });

    it('forwards the caller AbortSignal so the read model can cancel it', async () => {
      vi.mocked(fetchMentorSchedule).mockResolvedValue({ segments: [] });
      const controller = new AbortController();

      await loadMonthSchedule(ref, controller.signal);

      expect(fetchMentorSchedule).toHaveBeenCalledWith(ref, controller.signal);
    });

    it('does not touch the read model - caching is not this function’s job', async () => {
      vi.mocked(fetchMentorSchedule).mockResolvedValue({
        segments: segment(MAY_2026, 1),
      });

      await loadMonthSchedule(ref);

      expect(scheduleReadModel.get(ref)).toBeUndefined();
    });
  });

  describe('loadMonthScheduleFresh', () => {
    it('publishes the freshly fetched rows into the read model', async () => {
      vi.mocked(fetchMentorSchedule).mockResolvedValue({
        segments: segment(MAY_2026, 1),
      });

      const raws = await loadMonthScheduleFresh(ref);

      expect(scheduleReadModel.get(ref)).toEqual(raws);
      expect(raws.map((r) => r.id)).toEqual([1]);
    });

    it('bypasses a cache hit and overwrites it', async () => {
      scheduleReadModel.set(ref, []);
      vi.mocked(fetchMentorSchedule).mockResolvedValue({
        segments: segment(MAY_2026, 1),
      });

      await loadMonthScheduleFresh(ref);

      expect(fetchMentorSchedule).toHaveBeenCalledOnce();
      expect(scheduleReadModel.get(ref)?.map((r) => r.id)).toEqual([1]);
    });

    it('notifies a live reader of the month it just rewrote', async () => {
      const seen: (number[] | null)[] = [];
      const leave = scheduleReadModel.subscribe(
        ref,
        () => Promise.resolve([]),
        (result) => seen.push(result.data?.map((r) => r.id) ?? null)
      );
      await vi.waitFor(() => expect(scheduleReadModel.get(ref)).toBeDefined());
      seen.length = 0;

      vi.mocked(fetchMentorSchedule).mockResolvedValue({
        segments: segment(MAY_2026, 1),
      });
      await loadMonthScheduleFresh(ref);

      expect(seen).toEqual([[1]]);

      leave();
    });

    it('is not overwritten by a slower, already in-flight fetch for the same month', async () => {
      let resolveStaleFetch!: (raws: RawMentorTimeslot[]) => void;
      const staleFetch = new Promise<RawMentorTimeslot[]>((resolve) => {
        resolveStaleFetch = resolve;
      });

      // A component is already subscribed with a slow fetch in flight for
      // this month (e.g. the calendar's own background load) when the sync
      // below force-writes fresher rows.
      const leave = scheduleReadModel.subscribe(
        ref,
        () => staleFetch,
        () => {}
      );

      vi.mocked(fetchMentorSchedule).mockResolvedValue({
        segments: segment(MAY_2026, 99),
      });
      await loadMonthScheduleFresh(ref);

      expect(scheduleReadModel.get(ref)?.map((r) => r.id)).toEqual([99]);

      // The stale fetch finally resolves with older rows - it must not
      // clobber what the sync already published.
      resolveStaleFetch([fromPartial<RawMentorTimeslot>({ id: 1 })]);
      await Promise.resolve();
      await Promise.resolve();

      expect(scheduleReadModel.get(ref)?.map((r) => r.id)).toEqual([99]);

      leave();
    });
  });

  describe('prefetchMonthSchedule', () => {
    it('warms the read model for a month nothing is mounted on', async () => {
      vi.mocked(fetchMentorSchedule).mockResolvedValue({
        segments: segment(MAY_2026, 1),
      });

      prefetchMonthSchedule(ref);

      await vi.waitFor(() =>
        expect(scheduleReadModel.get(ref)?.map((r) => r.id)).toEqual([1])
      );
    });

    it('does not re-request a month that is already cached', async () => {
      scheduleReadModel.set(ref, []);

      prefetchMonthSchedule(ref);
      await Promise.resolve();

      expect(fetchMentorSchedule).not.toHaveBeenCalled();
    });

    it('silences failures rather than surfacing them to the user', async () => {
      vi.mocked(fetchMentorSchedule).mockRejectedValue(new Error('offline'));

      expect(() => prefetchMonthSchedule(ref)).not.toThrow();

      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(scheduleReadModel.get(ref)).toBeUndefined();
    });
  });

  describe('syncMonthSchedule', () => {
    it('should successfully sync month schedule with upserts and deletes, then reload', async () => {
      vi.mocked(saveMentorSchedule).mockResolvedValue(undefined);
      vi.mocked(deleteMentorSchedule).mockResolvedValue(undefined);
      vi.mocked(fetchMentorSchedule).mockResolvedValue({
        segments: segment(MAY_2026, 10),
      });

      const upsertPayload = createMockUpsertPayload();
      const deleteIds = [1, 2];

      const outcome = await syncMonthSchedule({
        ref,
        upsertPayload,
        deleteIds,
      });

      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.raws.map((r) => r.id)).toEqual([10]);
      }

      // Check the end of month unix derivation (2026-05-31T23:59:59.000Z)
      const expectedUntil = dayjs('2026-05-01')
        .endOf('month')
        .hour(23)
        .minute(59)
        .second(59)
        .millisecond(0)
        .unix();
      expect(saveMentorSchedule).toHaveBeenCalledWith({
        userId: ref.userId,
        until: expectedUntil,
        timeslots: upsertPayload,
      });

      expect(deleteMentorSchedule).toHaveBeenCalledTimes(2);
      expect(deleteMentorSchedule).toHaveBeenNthCalledWith(1, {
        userId: ref.userId,
        scheduleId: 1,
      });
      expect(deleteMentorSchedule).toHaveBeenNthCalledWith(2, {
        userId: ref.userId,
        scheduleId: 2,
      });

      expect(fetchMentorSchedule).toHaveBeenCalledWith(ref, undefined);
    });

    it('should skip save and delete when payload and delete IDs are empty, and still reload', async () => {
      vi.mocked(fetchMentorSchedule).mockResolvedValue({ segments: [] });

      const outcome = await syncMonthSchedule({
        ref,
        upsertPayload: [],
        deleteIds: [],
      });

      expect(outcome.ok).toBe(true);
      expect(saveMentorSchedule).not.toHaveBeenCalled();
      expect(deleteMentorSchedule).not.toHaveBeenCalled();
      expect(fetchMentorSchedule).toHaveBeenCalled();
    });

    it('should send additions/modifications before deletions and abort on save failure', async () => {
      const apiError = new ApiError(400, 'Conflict in schedule', 'CONFLICT');
      vi.mocked(saveMentorSchedule).mockRejectedValueOnce(apiError);

      const upsertPayload = createMockUpsertPayload();
      const deleteIds = [1];

      const outcome = await syncMonthSchedule({
        ref,
        upsertPayload,
        deleteIds,
      });

      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.reason).toBe('conflict');
        expect(outcome.message).toBe('Conflict in schedule');
      }

      expect(saveMentorSchedule).toHaveBeenCalled();
      expect(deleteMentorSchedule).not.toHaveBeenCalled();
    });

    it('should return a failed outcome and skip reload when delete fails after a successful save', async () => {
      vi.mocked(saveMentorSchedule).mockResolvedValue(undefined);
      const apiError = new ApiError(400, 'Conflict in schedule', 'CONFLICT');
      vi.mocked(deleteMentorSchedule).mockRejectedValueOnce(apiError);

      const upsertPayload = createMockUpsertPayload();
      const deleteIds = [1];

      const outcome = await syncMonthSchedule({
        ref,
        upsertPayload,
        deleteIds,
      });

      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.reason).toBe('conflict');
        expect(outcome.message).toBe('Conflict in schedule');
      }

      expect(saveMentorSchedule).toHaveBeenCalled();
      expect(deleteMentorSchedule).toHaveBeenCalled();
      expect(fetchMentorSchedule).not.toHaveBeenCalled();
    });

    it('should return unknown reason for general ApiError or other errors', async () => {
      const apiError = new ApiError(500, 'Internal Server Error', 'UNKNOWN');
      vi.mocked(saveMentorSchedule).mockRejectedValueOnce(apiError);

      const outcome = await syncMonthSchedule({
        ref,
        upsertPayload: createMockUpsertPayload(),
        deleteIds: [],
      });

      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.reason).toBe('unknown');
        expect(outcome.message).toBe('Internal Server Error');
      }
    });

    it('should handle non-ApiError instances correctly', async () => {
      vi.mocked(saveMentorSchedule).mockRejectedValueOnce(
        new Error('Network offline')
      );

      const outcome = await syncMonthSchedule({
        ref,
        upsertPayload: createMockUpsertPayload(),
        deleteIds: [],
      });

      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.reason).toBe('unknown');
        expect(outcome.message).toBe('Network offline');
      }
    });

    it('should handle completely raw string/unknown exceptions correctly', async () => {
      vi.mocked(saveMentorSchedule).mockRejectedValueOnce(
        'Some raw string exception'
      );

      const outcome = await syncMonthSchedule({
        ref,
        upsertPayload: createMockUpsertPayload(),
        deleteIds: [],
      });

      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.reason).toBe('unknown');
        expect(outcome.message).toBe('Sync failed');
      }
    });
  });

  describe('syncMonths', () => {
    it('should sequentially commit multiple months, returning individual outcomes for each month', async () => {
      vi.mocked(saveMentorSchedule).mockResolvedValue(undefined);
      vi.mocked(fetchMentorSchedule)
        .mockResolvedValueOnce({ segments: segment(MAY_2026, 1) })
        .mockResolvedValueOnce({ segments: segment(JUNE_2026, 2) });

      const requests = [
        {
          ref: { userId: 'mentor_1', year: 2026, month: 5 },
          upsertPayload: createMockUpsertPayload(MAY_2026),
          deleteIds: [],
        },
        {
          ref: { userId: 'mentor_1', year: 2026, month: 6 },
          upsertPayload: createMockUpsertPayload(JUNE_2026),
          deleteIds: [],
        },
      ];

      const results = await syncMonths(requests);

      expect(results).toHaveLength(2);
      expect(results[0].monthKey).toBe('2026-05');
      expect(results[0].outcome.ok).toBe(true);
      if (results[0].outcome.ok) {
        expect(results[0].outcome.raws.map((r) => r.id)).toEqual([1]);
      }

      expect(results[1].monthKey).toBe('2026-06');
      expect(results[1].outcome.ok).toBe(true);
      if (results[1].outcome.ok) {
        expect(results[1].outcome.raws.map((r) => r.id)).toEqual([2]);
      }
    });

    it('should ensure earlier successes are NOT rolled back or aborted if a later month fails', async () => {
      vi.mocked(saveMentorSchedule)
        .mockResolvedValueOnce(undefined) // Success for first month
        .mockRejectedValueOnce(new ApiError(400, 'Conflict found', 'CONFLICT')); // Fail for second month

      vi.mocked(fetchMentorSchedule).mockResolvedValueOnce({
        segments: segment(MAY_2026, 1),
      });

      const requests = [
        {
          ref: { userId: 'mentor_1', year: 2026, month: 5 },
          upsertPayload: createMockUpsertPayload(MAY_2026),
          deleteIds: [],
        },
        {
          ref: { userId: 'mentor_1', year: 2026, month: 6 },
          upsertPayload: createMockUpsertPayload(JUNE_2026),
          deleteIds: [],
        },
      ];

      const results = await syncMonths(requests);

      expect(results).toHaveLength(2);
      expect(results[0].monthKey).toBe('2026-05');
      expect(results[0].outcome.ok).toBe(true); // First month succeeded!

      expect(results[1].monthKey).toBe('2026-06');
      expect(results[1].outcome.ok).toBe(false); // Second month failed!
      if (!results[1].outcome.ok) {
        expect(results[1].outcome.reason).toBe('conflict');
        expect(results[1].outcome.message).toBe('Conflict found');
      }
    });
  });
});
