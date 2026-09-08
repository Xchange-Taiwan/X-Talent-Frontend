import { afterEach, describe, expect, it, vi } from 'vitest';

import { scheduleReadModel } from '@/lib/mentor-schedule/scheduleReadModel';

import { fetchMentorSchedule, type ScheduleData } from './schedule';
import {
  loadMonthSchedule,
  loadMonthScheduleFresh,
  prefetchMonthSchedule,
  type ScheduleMonthRef,
} from './sync';

vi.mock('./schedule', () => ({
  fetchMentorSchedule: vi.fn(),
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

describe('mentor-schedule sync', () => {
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
});
