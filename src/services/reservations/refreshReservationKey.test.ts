import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/monitoring', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/monitoring')>();
  return {
    ...actual,
    captureFlowFailure: vi.fn(),
  };
});

vi.mock('@/services/mentor-schedule/sync', () => ({
  loadMonthSchedule: vi.fn(),
}));

import { scheduleReadModel } from '@/lib/mentor-schedule/scheduleReadModel';
import { captureFlowFailure } from '@/lib/monitoring';
import type { RawMentorTimeslot } from '@/lib/profile/scheduleHelpers';
import { loadMonthSchedule } from '@/services/mentor-schedule/sync';

import {
  isAbortSignalTriggered,
  refreshMentorScheduleForReservation,
} from './refreshReservationKey';

const mockLoadMonthSchedule = vi.mocked(loadMonthSchedule);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);

function makeSlot(dtstart: number, id = 1): RawMentorTimeslot {
  return {
    id,
    type: 'PENDING',
    dtstart,
    dtend: dtstart + 1800,
    rrule: undefined,
    exdate: [],
  };
}

describe('refreshReservationKey helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scheduleReadModel.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    scheduleReadModel.clear();
  });

  describe('isAbortSignalTriggered', () => {
    it('detects an aborted signal or an AbortError instance', () => {
      const controller = new AbortController();
      expect(
        isAbortSignalTriggered(new Error('network'), controller.signal)
      ).toBe(false);

      controller.abort();
      expect(
        isAbortSignalTriggered(new Error('network'), controller.signal)
      ).toBe(true);

      const abortErr = new Error('aborted');
      abortErr.name = 'AbortError';
      expect(isAbortSignalTriggered(abortErr)).toBe(true);
    });
  });

  describe('refreshMentorScheduleForReservation', () => {
    it('no-ops when mentorId or dtstart is missing or invalid', async () => {
      const spy = vi.spyOn(scheduleReadModel, 'invalidateOrRefresh');

      await refreshMentorScheduleForReservation(undefined, 1785540600);
      await refreshMentorScheduleForReservation('   ', 1785540600);
      await refreshMentorScheduleForReservation('10', undefined);
      await refreshMentorScheduleForReservation('10', 0);
      await refreshMentorScheduleForReservation('10', -100);
      await refreshMentorScheduleForReservation('10', Number.NaN);

      expect(spy).not.toHaveBeenCalled();
      expect(mockLoadMonthSchedule).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('deduplicates by `${year}-${month}` when UTC and local timezone fall in the same month', async () => {
      vi.stubEnv('TZ', 'Asia/Taipei');
      const spy = vi.spyOn(scheduleReadModel, 'invalidateOrRefresh');

      // 2026-07-15T10:00:00Z === 2026-07-15T18:00:00+08:00 (both 2026-7)
      const midMonthUnix = Math.floor(Date.UTC(2026, 6, 15, 10, 0, 0) / 1000);
      const julyKey = { userId: '10', year: 2026, month: 7 };
      scheduleReadModel.set(julyKey, [makeSlot(midMonthUnix)]);

      await refreshMentorScheduleForReservation(10, midMonthUnix);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(julyKey, expect.any(Function));
      expect(scheduleReadModel.get(julyKey)).toBeUndefined();
      expect(mockLoadMonthSchedule).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('invalidates both UTC and Asia/Taipei month slices with zero network calls when unsubscribed across a month boundary', async () => {
      vi.stubEnv('TZ', 'Asia/Taipei');

      // 2026-07-31T23:30:00Z === 2026-08-01T07:30:00+08:00
      // UTC -> 2026-7, Asia/Taipei -> 2026-8
      const boundaryUnix = Math.floor(Date.UTC(2026, 6, 31, 23, 30, 0) / 1000);
      const utcMonthKey = { userId: '10', year: 2026, month: 7 };
      const taipeiMonthKey = { userId: '10', year: 2026, month: 8 };
      const unrelatedMonthKey = { userId: '10', year: 2026, month: 9 };

      scheduleReadModel.set(utcMonthKey, [makeSlot(boundaryUnix, 1)]);
      scheduleReadModel.set(taipeiMonthKey, [makeSlot(boundaryUnix, 2)]);
      scheduleReadModel.set(unrelatedMonthKey, [makeSlot(boundaryUnix, 3)]);

      await refreshMentorScheduleForReservation('10', boundaryUnix);

      expect(scheduleReadModel.get(utcMonthKey)).toBeUndefined();
      expect(scheduleReadModel.get(taipeiMonthKey)).toBeUndefined();
      expect(scheduleReadModel.get(unrelatedMonthKey)).toHaveLength(1);
      expect(mockLoadMonthSchedule).not.toHaveBeenCalled();
    });

    it('refreshes both subscribed month slices across month and year boundaries (UTC+8 and UTC-7)', async () => {
      vi.stubEnv('TZ', 'Asia/Taipei');

      // 2026-12-31T23:30:00Z === 2027-01-01T07:30:00+08:00
      // UTC -> 2026-12, Asia/Taipei -> 2027-1
      const yearBoundaryUnix = Math.floor(
        Date.UTC(2026, 11, 31, 23, 30, 0) / 1000
      );
      const decKey = { userId: '42', year: 2026, month: 12 };
      const janKey = { userId: '42', year: 2027, month: 1 };

      scheduleReadModel.set(decKey, []);
      scheduleReadModel.set(janKey, []);
      const unsubDec = scheduleReadModel.subscribe(
        decKey,
        () => new Promise(() => {}),
        () => {}
      );
      const unsubJan = scheduleReadModel.subscribe(
        janKey,
        () => new Promise(() => {}),
        () => {}
      );

      mockLoadMonthSchedule.mockImplementation(async (ref) => [
        makeSlot(yearBoundaryUnix, ref.month),
      ]);

      try {
        await refreshMentorScheduleForReservation(42, yearBoundaryUnix);

        expect(mockLoadMonthSchedule).toHaveBeenCalledTimes(2);
        expect(mockLoadMonthSchedule).toHaveBeenCalledWith(
          decKey,
          expect.any(AbortSignal)
        );
        expect(mockLoadMonthSchedule).toHaveBeenCalledWith(
          janKey,
          expect.any(AbortSignal)
        );
        expect(scheduleReadModel.get(decKey)?.[0]?.id).toBe(12);
        expect(scheduleReadModel.get(janKey)?.[0]?.id).toBe(1);
      } finally {
        unsubDec();
        unsubJan();
      }

      // Also verify negative UTC offset (America/Los_Angeles, PDT UTC-7):
      // 2026-08-01T01:00:00Z === 2026-07-31T18:00:00-07:00
      vi.stubEnv('TZ', 'America/Los_Angeles');
      const westBoundaryUnix = Math.floor(Date.UTC(2026, 7, 1, 1, 0, 0) / 1000);
      const augUtcKey = { userId: '42', year: 2026, month: 8 };
      const julyLocalKey = { userId: '42', year: 2026, month: 7 };
      scheduleReadModel.set(augUtcKey, [makeSlot(westBoundaryUnix, 8)]);
      scheduleReadModel.set(julyLocalKey, [makeSlot(westBoundaryUnix, 7)]);

      await refreshMentorScheduleForReservation('42', westBoundaryUnix);

      expect(scheduleReadModel.get(augUtcKey)).toBeUndefined();
      expect(scheduleReadModel.get(julyLocalKey)).toBeUndefined();
    });

    it('captures non-abort refresh errors and skips reporting when aborted', async () => {
      const targetKey = { userId: '10', year: 2026, month: 7 };
      const unix = Math.floor(Date.UTC(2026, 6, 15, 10, 0, 0) / 1000);

      scheduleReadModel.set(targetKey, []);
      const unsub = scheduleReadModel.subscribe(
        targetKey,
        () => new Promise(() => {}),
        () => {}
      );

      try {
        mockLoadMonthSchedule.mockRejectedValueOnce(new Error('schedule down'));
        await refreshMentorScheduleForReservation('10', unix);

        expect(mockCaptureFlowFailure).toHaveBeenCalledTimes(1);
        expect(mockCaptureFlowFailure).toHaveBeenCalledWith({
          flow: 'reservation_mutation_invalidate',
          step: 'refresh_mentor_schedule',
          message: 'schedule down',
          level: 'warning',
        });

        mockCaptureFlowFailure.mockClear();
        let rejectInflight!: (err: Error) => void;
        mockLoadMonthSchedule.mockImplementationOnce(
          () =>
            new Promise<RawMentorTimeslot[]>((_resolve, reject) => {
              rejectInflight = reject;
            })
        );

        const refreshPromise = refreshMentorScheduleForReservation('10', unix);
        scheduleReadModel.clear();
        rejectInflight(new Error('late network error after clear'));
        await refreshPromise;

        expect(mockCaptureFlowFailure).not.toHaveBeenCalled();
      } finally {
        unsub();
      }
    });
  });
});
