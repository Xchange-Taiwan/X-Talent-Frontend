process.env.TZ = 'UTC';

import fs from 'node:fs';
import path from 'node:path';

import { RRule } from 'rrule';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createMentorScheduleSession,
  type MentorScheduleSessionPorts,
} from '@/lib/mentor-schedule/mentorScheduleSession';
import {
  type ScheduleReadKey,
  scheduleReadModel,
} from '@/lib/mentor-schedule/scheduleReadModel';
import {
  endOfMonthUnix,
  type RawMentorTimeslot,
} from '@/lib/profile/scheduleHelpers';
import {
  MENTOR_SCHEDULE_RESERVATIONS_TTL_MS,
  reservationReadModel,
} from '@/lib/reservation/reservationReadModel';
import type { ReservationState } from '@/services/reservations';
import type { Reservation } from '@/types/reservation';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makePorts(
  overrides: Partial<MentorScheduleSessionPorts> & { nowMsValue?: number } = {}
) {
  let currentNowMs =
    overrides.nowMsValue ?? new Date('2026-07-01T00:00:00Z').getTime();
  const loadMonthSchedule =
    overrides.loadMonthSchedule ??
    vi.fn<NonNullable<MentorScheduleSessionPorts['loadMonthSchedule']>>(
      async () => []
    );
  const prefetchMonthSchedule =
    overrides.prefetchMonthSchedule ??
    vi.fn<NonNullable<MentorScheduleSessionPorts['prefetchMonthSchedule']>>(
      () => {}
    );
  const syncMonths =
    overrides.syncMonths ??
    vi.fn<NonNullable<MentorScheduleSessionPorts['syncMonths']>>(async (reqs) =>
      reqs.map((r) => ({
        monthKey: `${r.ref.year}-${String(r.ref.month).padStart(2, '0')}`,
        outcome: { ok: true as const, raws: [] },
      }))
    );
  const fetchAllReservationsForState =
    overrides.fetchAllReservationsForState ??
    vi.fn<
      NonNullable<MentorScheduleSessionPorts['fetchAllReservationsForState']>
    >(async () => []);
  const captureFlowFailure =
    overrides.captureFlowFailure ??
    vi.fn<NonNullable<MentorScheduleSessionPorts['captureFlowFailure']>>(
      async () => {}
    );

  const ports: MentorScheduleSessionPorts = {
    scheduleReadModel: overrides.scheduleReadModel ?? scheduleReadModel,
    reservationReadModel:
      overrides.reservationReadModel ?? reservationReadModel,
    loadMonthSchedule,
    prefetchMonthSchedule,
    syncMonths,
    fetchAllReservationsForState,
    captureFlowFailure,
    nowMs: overrides.nowMs ?? (() => currentNowMs),
  };

  return {
    ports,
    setNowMs: (ms: number) => {
      currentNowMs = ms;
    },
    spies: {
      loadMonthSchedule: vi.mocked(loadMonthSchedule),
      prefetchMonthSchedule: vi.mocked(prefetchMonthSchedule),
      syncMonths: vi.mocked(syncMonths),
      fetchAllReservationsForState: vi.mocked(fetchAllReservationsForState),
      captureFlowFailure: vi.mocked(captureFlowFailure),
    },
  };
}

const julyAllowSlot: RawMentorTimeslot = {
  id: 101,
  type: 'ALLOW',
  dtstart: Math.floor(new Date('2026-07-26T10:00:00Z').getTime() / 1000),
  dtend: Math.floor(new Date('2026-07-26T10:30:00Z').getTime() / 1000),
  rrule: undefined,
  exdate: [],
};

const augustAllowSlot: RawMentorTimeslot = {
  id: 202,
  type: 'ALLOW',
  dtstart: Math.floor(new Date('2026-08-12T14:00:00Z').getTime() / 1000),
  dtend: Math.floor(new Date('2026-08-12T14:30:00Z').getTime() / 1000),
  rrule: undefined,
  exdate: [],
};

describe('MentorScheduleSession', () => {
  beforeEach(() => {
    scheduleReadModel.clear();
    reservationReadModel.clear();
  });

  describe('synchronous read-model mirroring, earliest-date auto-selection & snapshot stability', () => {
    it('synchronously mirrors cached scheduleReadModel rows into MonthDraftStore, auto-selects earliest date on initial load, omits isMonthSynced, and keeps getSnapshot() referentially stable', () => {
      const key: ScheduleReadKey = { userId: '123', year: 2026, month: 7 };
      scheduleReadModel.set(key, [julyAllowSlot]);

      const { ports, spies } = makePorts();
      const session = createMentorScheduleSession(
        {
          backend: { userId: '123', year: 2026, month: 7 },
          loginUserId: 'mentee-9',
        },
        ports
      );

      const snap1 = session.getSnapshot();
      const snap2 = session.getSnapshot();
      expect(snap1).toBe(snap2);

      // No network fetch needed on cache hit, and mentee gets editor === null
      expect(spies.loadMonthSchedule).not.toHaveBeenCalled();
      expect(spies.fetchAllReservationsForState).not.toHaveBeenCalled();
      expect(snap1.loaded).toBe(true);
      expect(snap1.editor).toBeNull();
      expect(snap1.reader.slotsSnapshot.monthLoaded).toBe(true);
      expect(snap1.reader.slotsSnapshot.reservationsLoaded).toBe(true);
      expect('isMonthSynced' in snap1.reader).toBe(false);

      // Earliest available date and its slots are already ready in the very first snapshot
      expect(snap1.reader.earliestSelectableDate).toBe('2026-07-26');
      expect(snap1.reader.selectedDate).toBe('2026-07-26');
      expect(snap1.reader.allowedDates).toEqual(['2026-07-26']);
      expect(snap1.reader.slotsSnapshot.slots).toHaveLength(1);

      // No-op configure preserves exact snapshot reference
      const listener = vi.fn();
      const unsub = session.subscribe(listener);
      session.configure({
        backend: { userId: '123', year: 2026, month: 7 },
        loginUserId: 'mentee-9',
      });
      expect(listener).not.toHaveBeenCalled();
      expect(session.getSnapshot()).toBe(snap1);

      unsub();
      session.dispose();
    });

    it('emits a single atomic transition (monthLoaded + mirrored draft + auto-selected earliest date) when an async schedule fetch resolves', async () => {
      const monthFetch = deferred<RawMentorTimeslot[]>();
      const { ports } = makePorts({
        loadMonthSchedule: vi.fn(() => monthFetch.promise),
      });

      const session = createMentorScheduleSession(
        {
          backend: { userId: '123', year: 2026, month: 7 },
          loginUserId: 'mentee-1',
        },
        ports
      );

      const observedSnapshots: Array<{
        loaded: boolean;
        monthLoaded: boolean;
        selectedDate: string | null;
        allowedDates: string[];
        slotCount: number;
      }> = [];

      const unsub = session.subscribe(() => {
        const s = session.getSnapshot();
        observedSnapshots.push({
          loaded: s.loaded,
          monthLoaded: s.reader.slotsSnapshot.monthLoaded,
          selectedDate: s.reader.selectedDate,
          allowedDates: s.reader.allowedDates,
          slotCount: s.reader.slotsSnapshot.slots.length,
        });
      });

      expect(session.getSnapshot().loaded).toBe(false);
      expect(session.getSnapshot().reader.slotsSnapshot.monthLoaded).toBe(
        false
      );

      monthFetch.resolve([julyAllowSlot]);
      await monthFetch.promise;

      // Exactly 1 notification: no intermediate frame where monthLoaded=true with empty allowedDates or pre-jump selectedDate
      expect(observedSnapshots).toEqual([
        {
          loaded: true,
          monthLoaded: true,
          selectedDate: '2026-07-26',
          allowedDates: ['2026-07-26'],
          slotCount: 1,
        },
      ]);

      unsub();
      session.dispose();
    });
  });

  describe('month switching & cross-month draft retention', () => {
    it('retains unsaved draft edits across month switches, clamps past-month selection to today, and commits multi-month dirty drafts', async () => {
      const { ports, spies } = makePorts({
        nowMsValue: new Date('2026-07-20T09:00:00Z').getTime(),
        loadMonthSchedule: vi.fn(async (ref) =>
          ref.month === 7 ? [julyAllowSlot] : [augustAllowSlot]
        ),
      });

      const session = createMentorScheduleSession(
        {
          backend: { userId: '123' },
          loginUserId: '123',
        },
        ports
      );

      await Promise.resolve();
      await Promise.resolve();

      expect(session.getSnapshot().loaded).toBe(true);
      expect(session.getSnapshot().reader.year).toBe(2026);
      expect(session.getSnapshot().reader.month).toBe(7);
      expect(session.getSnapshot().reader.selectedDate).toBe('2026-07-26');

      // Add a draft slot in July
      const addRes = session.getSnapshot().editor!.addSlotForSelectedDate({
        startTime: '15:00',
        durationMinutes: 30,
      });
      expect(addRes).toEqual({ success: true, added: 1 });
      expect(session.getSnapshot().editor!.draftForSelectedDate).toHaveLength(
        2
      );

      // Navigate forward to August
      session.getSnapshot().reader.onMonthChange!(
        new Date('2026-08-01T00:00:00Z')
      );
      expect(session.getSnapshot().reader.year).toBe(2026);
      expect(session.getSnapshot().reader.month).toBe(8);
      expect(session.getSnapshot().reader.selectedDate).toBe('2026-08-01');

      await Promise.resolve();
      await Promise.resolve();

      // Both July's unsaved draft (2 occurrences) and August's loaded slot (1 occurrence) coexist
      expect(session.getSnapshot().editor!.draftOccurrences).toHaveLength(3);

      // Navigate to a past month (June 2026) -> selectedDate clamps to today (2026-07-20)
      session.getSnapshot().reader.onMonthChange!(
        new Date('2026-06-01T00:00:00Z')
      );
      expect(session.getSnapshot().reader.year).toBe(2026);
      expect(session.getSnapshot().reader.month).toBe(6);
      expect(session.getSnapshot().reader.selectedDate).toBe('2026-07-20');

      // Navigate back to July -> cache hit, no duplicate July fetch, and July's unsaved draft is intact
      session.getSnapshot().reader.onMonthChange!(
        new Date('2026-07-01T00:00:00Z')
      );
      expect(
        spies.loadMonthSchedule.mock.calls.filter(([ref]) => ref.month === 7)
      ).toHaveLength(1);
      session.getSnapshot().reader.setSelectedDate('2026-07-26');
      expect(session.getSnapshot().editor!.draftForSelectedDate).toHaveLength(
        2
      );

      // Commit dirty July draft
      spies.syncMonths.mockResolvedValueOnce([
        {
          monthKey: '2026-07',
          outcome: { ok: true, raws: [julyAllowSlot] },
        },
      ]);
      const syncResult = await session.getSnapshot().editor!.confirmChanges();
      expect(syncResult).toEqual({
        ok: true,
        committedMonthKeys: ['2026-07'],
      });
      expect(spies.syncMonths).toHaveBeenCalledTimes(1);

      session.dispose();
    });

    it('resetChanges discards dirty edits across months with zero network calls and preserves draftOccurrences reference when clean', () => {
      scheduleReadModel.set({ userId: '123', year: 2026, month: 7 }, [
        julyAllowSlot,
      ]);

      const { ports, spies } = makePorts();
      const session = createMentorScheduleSession(
        {
          backend: { userId: '123', year: 2026, month: 7 },
          loginUserId: '123',
        },
        ports
      );

      const cleanOccurrences = session.getSnapshot().editor!.draftOccurrences;
      session.getSnapshot().editor!.resetChanges();
      expect(session.getSnapshot().editor!.draftOccurrences).toBe(
        cleanOccurrences
      );

      session.getSnapshot().editor!.addSlotForSelectedDate({
        startTime: '16:00',
        durationMinutes: 30,
      });
      expect(session.getSnapshot().editor!.draftOccurrences).toHaveLength(2);

      session.getSnapshot().editor!.resetChanges();
      expect(session.getSnapshot().editor!.draftOccurrences).toHaveLength(1);
      expect(spies.loadMonthSchedule).not.toHaveBeenCalled();

      session.dispose();
    });
  });

  describe('passive initialConfig & framework-free boundary', () => {
    it('seeds initial snapshot passively without starting fetches or timers until configure() runs, and supports dispose -> configure re-activation', async () => {
      const { ports, spies } = makePorts({
        loadMonthSchedule: vi.fn(async () => [julyAllowSlot]),
      });

      const session = createMentorScheduleSession(undefined, ports, {
        initialConfig: {
          backend: { userId: '123', year: 2026, month: 7 },
          loginUserId: '123',
        },
      });

      // Passive render/SSR phase: zero network calls, loading state reflected cleanly
      expect(spies.loadMonthSchedule).not.toHaveBeenCalled();
      expect(spies.fetchAllReservationsForState).not.toHaveBeenCalled();
      expect(session.getSnapshot().loaded).toBe(false);
      expect(session.getSnapshot().reader.isFetching).toBe(true);
      expect(session.getSnapshot().reader.slotsSnapshot.monthLoaded).toBe(
        false
      );

      // Client mount configure -> starts subscriptions; simulated StrictMode dispose -> configure re-activates cleanly
      session.configure({
        backend: { userId: '123', year: 2026, month: 7 },
        loginUserId: '123',
      });
      session.dispose();
      session.configure({
        backend: { userId: '123', year: 2026, month: 7 },
        loginUserId: '123',
      });

      await Promise.resolve();
      await Promise.resolve();

      expect(session.getSnapshot().loaded).toBe(true);
      expect(session.getSnapshot().reader.selectedDate).toBe('2026-07-26');

      session.dispose();
    });

    it('keeps mentorScheduleSession.ts completely free of React, Next.js, and hooks imports', () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, './mentorScheduleSession.ts'),
        'utf8'
      );
      expect(source).not.toMatch(/from\s+['"]react['"]/);
      expect(source).not.toMatch(/from\s+['"]next\//);
      expect(source).not.toMatch(/from\s+['"]@\/hooks\//);
    });
  });

  describe('account/mentor switch cancellation & dispose safety', () => {
    it('aborts in-flight month/reservation reads, clears caches and drafts, resets loaded/autoSelect/nowSec, and blocks stale save/reload from landing after account switch', async () => {
      const userAJuly = deferred<RawMentorTimeslot[]>();
      const userBSync =
        deferred<
          Awaited<
            ReturnType<NonNullable<MentorScheduleSessionPorts['syncMonths']>>
          >
        >();
      let observedAbortSignal: AbortSignal | undefined;

      const { ports, setNowMs, spies } = makePorts({
        nowMsValue: new Date('2026-07-01T00:00:00Z').getTime(),
        loadMonthSchedule: vi.fn((ref, signal) => {
          if (ref.userId === 'user-a') {
            observedAbortSignal = signal;
            return userAJuly.promise;
          }
          return Promise.resolve([augustAllowSlot]);
        }),
        syncMonths: vi.fn(() => userBSync.promise),
      });

      const session = createMentorScheduleSession(
        {
          backend: { userId: 'user-a', year: 2026, month: 7 },
          loginUserId: 'user-a',
        },
        ports
      );

      expect(observedAbortSignal?.aborted).toBe(false);

      // Advance clock and switch to user-b while user-a's month fetch is still in flight
      setNowMs(new Date('2026-08-10T00:00:00Z').getTime());
      session.configure({
        backend: { userId: 'user-b', year: 2026, month: 8 },
        loginUserId: 'user-b',
      });

      expect(observedAbortSignal?.aborted).toBe(true);
      expect(session.getSnapshot().loaded).toBe(false);

      // Resolve old user-a's fetch late -> must not land in cache or session
      userAJuly.resolve([julyAllowSlot]);
      await Promise.resolve();
      await Promise.resolve();

      expect(
        scheduleReadModel.get({ userId: 'user-a', year: 2026, month: 7 })
      ).toBeUndefined();
      expect(session.getSnapshot().loaded).toBe(true);
      expect(session.getSnapshot().reader.selectedDate).toBe('2026-08-12');

      // Start a save on user-b, then switch to user-c mid-save
      session.getSnapshot().editor!.addSlotForSelectedDate({
        startTime: '16:00',
        durationMinutes: 30,
      });
      const savePromise = session.getSnapshot().editor!.confirmChanges();

      session.configure({
        backend: { userId: 'user-c', year: 2026, month: 8 },
        loginUserId: 'user-c',
      });

      userBSync.resolve([
        { monthKey: '2026-08', outcome: { ok: true, raws: [julyAllowSlot] } },
      ]);
      await savePromise;

      // user-b's late commit did not leak julyAllowSlot into user-c's buffer
      expect(
        session
          .getSnapshot()
          .editor!.draftOccurrences?.some((d) => d.id === julyAllowSlot.id)
      ).toBe(false);

      // Disposing mid-reload suppresses late state updates and captureFlowFailure
      const slowReload = deferred<RawMentorTimeslot[]>();
      spies.loadMonthSchedule.mockImplementationOnce(() => slowReload.promise);
      const reloadPromise = session.getSnapshot().reader.reload!();
      session.dispose();
      slowReload.reject(new Error('late network error after dispose'));
      await reloadPromise;

      expect(spies.captureFlowFailure).not.toHaveBeenCalled();
    });
  });

  describe('frozen nowSec contract & reset rules', () => {
    it('freezes nowSec across clock advancement and date selection without re-expanding RRules, and refreshes nowSec only on reload or account switch', async () => {
      const boundaryStart = Math.floor(
        new Date('2026-07-01T00:05:00Z').getTime() / 1000
      );
      const recurringSlot: RawMentorTimeslot = {
        id: 501,
        type: 'ALLOW',
        dtstart: boundaryStart,
        dtend: boundaryStart + 1800,
        rrule: 'FREQ=WEEKLY;COUNT=2',
        exdate: [],
      };
      scheduleReadModel.set({ userId: '123', year: 2026, month: 7 }, [
        recurringSlot,
      ]);

      let nowCalls = 0;
      let currentNowMs = new Date('2026-07-01T00:00:00Z').getTime();
      const lateSlotStart = Math.floor(
        new Date('2026-07-08T00:05:00Z').getTime() / 1000
      );
      const rruleAllSpy = vi.spyOn(RRule.prototype, 'all');

      const { ports } = makePorts({
        nowMs: () => {
          nowCalls += 1;
          return currentNowMs;
        },
        loadMonthSchedule: vi.fn(async (ref): Promise<RawMentorTimeslot[]> =>
          ref.userId === '123'
            ? [recurringSlot]
            : [
                {
                  id: 502,
                  type: 'ALLOW',
                  dtstart: lateSlotStart,
                  dtend: lateSlotStart + 1800,
                  rrule: undefined,
                  exdate: [],
                },
              ]
        ),
      });

      const session = createMentorScheduleSession(
        {
          backend: { userId: '123', year: 2026, month: 7 },
          loginUserId: '123',
        },
        ports
      );

      expect(session.getSnapshot().reader.allowedDates).toEqual([
        '2026-07-01',
        '2026-07-08',
      ]);
      expect(rruleAllSpy).toHaveBeenCalledTimes(1);

      rruleAllSpy.mockClear();
      nowCalls = 0;

      // Advance clock 15 minutes past the 2026-07-01T00:05:00Z slot
      currentNowMs = new Date('2026-07-01T00:20:00Z').getTime();

      session.getSnapshot().reader.setSelectedDate('2026-07-08');
      session.getSnapshot().reader.setSelectedDate('2026-07-01');

      // Frozen instant preserved: no clock reads, no RRule re-expansion, 2026-07-01 still bookable
      expect(nowCalls).toBe(0);
      expect(rruleAllSpy).not.toHaveBeenCalled();
      expect(session.getSnapshot().reader.allowedDates).toEqual([
        '2026-07-01',
        '2026-07-08',
      ]);
      expect(session.getSnapshot().reader.slotsSnapshot.slots).toHaveLength(1);

      // Explicit reload refreshes nowSec so 2026-07-01 becomes past
      await session.getSnapshot().reader.reload!();
      expect(session.getSnapshot().reader.allowedDates).toEqual(['2026-07-08']);
      expect(session.getSnapshot().reader.slotsSnapshot.slots).toHaveLength(0);

      // Account switch on the same session also refreshes nowSec from the injected clock
      currentNowMs = new Date('2026-07-08T00:10:00Z').getTime();
      session.configure({
        backend: { userId: '456', year: 2026, month: 7 },
        loginUserId: '456',
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(session.getSnapshot().reader.allowedDates).toEqual([]);

      session.dispose();
      rruleAllSpy.mockRestore();
    });
  });

  describe('month-scoped 30s TTL reservations & non-duplicate captureFlowFailure', () => {
    it('subscribes MENTOR_UPCOMING and MENTOR_PENDING with 30s month-boundary TTL and does not call captureFlowFailure a second time when fetchAllReservationsForState fails', async () => {
      const sampleReservation: Reservation = {
        id: 'res-1',
        name: 'Mentee One',
        roleLine: 'Engineer',
        date: '2026-07-26',
        time: '10:00 - 10:30',
        messages: [],
        scheduleId: 101,
        dtstart: julyAllowSlot.dtstart,
        dtend: julyAllowSlot.dtend,
        senderUserId: 'mentee-1',
        participantUserId: '123',
        version: 1,
      };

      const { ports, spies } = makePorts({
        loadMonthSchedule: vi.fn(async (): Promise<RawMentorTimeslot[]> => [
          { ...julyAllowSlot, type: 'BOOKED' },
          julyAllowSlot,
        ]),
        fetchAllReservationsForState: vi.fn(
          async (_userId: string, state: ReservationState) => {
            if (state === 'MENTOR_PENDING') {
              // Simulate fetchAllReservationsForState having already reported its own failure before throwing
              throw new Error('upstream 503');
            }
            return [sampleReservation];
          }
        ),
      });

      const session = createMentorScheduleSession(
        {
          backend: { userId: '123', year: 2026, month: 7 },
          loginUserId: '123',
          includeBookedDates: true,
        },
        ports
      );

      await Promise.resolve();
      await Promise.resolve();

      // Session did NOT emit a duplicate captureFlowFailure on top of fetchAllReservationsForState
      expect(spies.captureFlowFailure).not.toHaveBeenCalled();
      // Failed MENTOR_PENDING keeps reservationsLoaded === false
      expect(
        session.getSnapshot().reader.slotsSnapshot.reservationsLoaded
      ).toBe(false);

      // MENTOR_UPCOMING succeeded and was cached with MENTOR_SCHEDULE_RESERVATIONS_TTL_MS (30s)
      const eom = endOfMonthUnix(2026, 7);
      const upcomingKey = {
        userId: '123',
        state: 'MENTOR_UPCOMING' as const,
        endOfMonthUnix: eom,
      };
      expect(reservationReadModel.get(upcomingKey)?.items).toEqual([
        sampleReservation,
      ]);

      const baseNow = Date.now();
      const dateNowSpy = vi
        .spyOn(Date, 'now')
        .mockReturnValue(baseNow + MENTOR_SCHEDULE_RESERVATIONS_TTL_MS);
      expect(reservationReadModel.get(upcomingKey)).toBeUndefined();
      dateNowSpy.mockRestore();

      // Reload failure on reservations also does NOT double-report captureFlowFailure,
      // whereas a non-superseded schedule reload failure DOES report mentor_schedule_reload_schedule once
      spies.loadMonthSchedule.mockRejectedValueOnce(
        new Error('schedule reload 500')
      );
      await session.getSnapshot().reader.reload!();

      expect(spies.captureFlowFailure).toHaveBeenCalledTimes(1);
      expect(spies.captureFlowFailure).toHaveBeenCalledWith({
        flow: 'mentor_schedule_reload_schedule',
        step: 'reload_month_schedule_fresh',
        message: 'schedule reload 500',
        level: 'warning',
      });

      session.dispose();
    });
  });
});
