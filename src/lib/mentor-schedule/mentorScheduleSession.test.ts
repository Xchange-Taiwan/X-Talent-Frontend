process.env.TZ = 'UTC';

import fs from 'node:fs';
import path from 'node:path';

import { RRule } from 'rrule';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AsyncReadManager } from '@/lib/asyncReadManager';
import {
  createMentorScheduleSession,
  type MentorScheduleSessionPorts,
} from '@/lib/mentor-schedule/mentorScheduleSession';
import {
  type MentorScheduleReadModel,
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

  describe('confirmChanges() sole read-model publisher, isSaving & mid-flight invariants (#975)', () => {
    it('keeps mentorScheduleSession.ts free of activeSyncBatches and isMonthActivelySyncing re-entrancy workarounds', () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, './mentorScheduleSession.ts'),
        'utf8'
      );
      expect(source).not.toMatch(/activeSyncBatches/);
      expect(source).not.toMatch(/isMonthActivelySyncing/);
    });

    it('acts as sole scheduleReadModel publisher upon commit settlement across multi-month saves without duplicate -1 + persisted frames (both partial failure and retry success)', async () => {
      const julyKey: ScheduleReadKey = { userId: '123', year: 2026, month: 7 };
      const augKey: ScheduleReadKey = { userId: '123', year: 2026, month: 8 };
      scheduleReadModel.set(julyKey, []);
      scheduleReadModel.set(augKey, []);

      const augustStep = deferred<void>();
      let failAugust = false;

      const persistedJuly999: RawMentorTimeslot = {
        id: 999,
        type: 'ALLOW',
        dtstart: Math.floor(new Date('2026-07-15T10:00:00Z').getTime() / 1000),
        dtend: Math.floor(new Date('2026-07-15T10:30:00Z').getTime() / 1000),
        rrule: undefined,
        exdate: [],
      };
      const persistedAug1000: RawMentorTimeslot = {
        id: 1000,
        type: 'ALLOW',
        dtstart: Math.floor(new Date('2026-08-20T14:00:00Z').getTime() / 1000),
        dtend: Math.floor(new Date('2026-08-20T14:30:00Z').getTime() / 1000),
        rrule: undefined,
        exdate: [],
      };

      const { ports } = makePorts({
        // Pure transport adapter: returns outcomes without mutating scheduleReadModel directly
        syncMonths: vi.fn(async (requests) => {
          const results = [];
          for (const req of requests) {
            const monthKey = `${req.ref.year}-${String(req.ref.month).padStart(2, '0')}`;
            if (req.ref.month === 7) {
              results.push({
                monthKey,
                outcome: { ok: true as const, raws: [persistedJuly999] },
              });
            } else {
              await augustStep.promise;
              if (failAugust) {
                results.push({
                  monthKey,
                  outcome: {
                    ok: false as const,
                    reason: 'conflict' as const,
                    message: 'There is 1 conflict in 2026/8',
                  },
                });
              } else {
                results.push({
                  monthKey,
                  outcome: { ok: true as const, raws: [persistedAug1000] },
                });
              }
            }
          }
          return results;
        }),
      });

      const session = createMentorScheduleSession(
        {
          backend: { userId: '123', year: 2026, month: 7 },
          loginUserId: '123',
        },
        ports
      );

      // Add a new draft slot in July (id = -1)
      session.getSnapshot().reader.setSelectedDate('2026-07-15');
      expect(
        session.getSnapshot().editor!.addSlotForSelectedDate({
          startTime: '10:00',
          durationMinutes: 30,
        })
      ).toEqual({ success: true, added: 1 });

      // Switch to August and add a new draft slot (id = -2)
      session.configure({
        backend: { userId: '123', year: 2026, month: 8 },
        loginUserId: '123',
      });
      session.getSnapshot().reader.setSelectedDate('2026-08-20');
      expect(
        session.getSnapshot().editor!.addSlotForSelectedDate({
          startTime: '14:00',
          durationMinutes: 30,
        })
      ).toEqual({ success: true, added: 1 });

      // View July so scheduleReadModel subscription for 2026-07 is actively listening
      session.configure({
        backend: { userId: '123', year: 2026, month: 7 },
        loginUserId: '123',
      });
      session.getSnapshot().reader.setSelectedDate('2026-07-15');

      const observedDuplicateFrames: string[][] = [];
      const unsub = session.subscribe(() => {
        const occs = session.getSnapshot().editor?.draftOccurrences ?? [];
        const julyOccs = occs.filter((o) => o.dateKey === '2026-07-15');
        if (julyOccs.length > 1) {
          observedDuplicateFrames.push(julyOccs.map((o) => o.occurrenceId));
        }
      });

      // 1. Start multi-month confirmChanges where Month 1 succeeds and Month 2 is still in flight
      const savePromise1 = session.getSnapshot().editor!.confirmChanges();
      expect(session.getSnapshot().editor!.isSaving).toBe(true);
      await Promise.resolve();

      // While Month 2 is still in flight, scheduleReadModel has not been prematurely written
      expect(scheduleReadModel.get(julyKey)).toEqual([]);
      const midFlightJulyOccs = session
        .getSnapshot()
        .editor!.draftOccurrences!.filter((o) => o.dateKey === '2026-07-15');
      expect(midFlightJulyOccs).toHaveLength(1);
      expect(observedDuplicateFrames).toEqual([]);

      // Let Month 2 fail first to verify partial commit consistency
      failAugust = true;
      augustStep.resolve();
      const partialResult = await savePromise1;

      expect(session.getSnapshot().editor!.isSaving).toBe(false);
      expect(partialResult).toEqual({
        ok: false,
        reason: 'conflict',
        message: 'There is 1 conflict in 2026/8',
        failedMonthKey: '2026-08',
        committedMonthKeys: ['2026-07'],
      });
      expect(observedDuplicateFrames).toEqual([]);

      // July published to scheduleReadModel and committed with id=999; August kept unsaved draft and [] in read model
      expect(scheduleReadModel.get(julyKey)).toEqual([persistedJuly999]);
      expect(scheduleReadModel.get(augKey)).toEqual([]);
      const afterPartialOccs = session.getSnapshot().editor!.draftOccurrences!;
      const julyAfterPartial = afterPartialOccs.filter(
        (o) => o.dateKey === '2026-07-15'
      );
      const augAfterPartial = afterPartialOccs.filter(
        (o) => o.dateKey === '2026-08-20'
      );
      expect(julyAfterPartial.map((o) => o.id)).toEqual([999]);
      expect(augAfterPartial).toHaveLength(1);
      expect(augAfterPartial[0]!.id).toBeLessThan(0);

      // 2. Retry confirmChanges with August succeeding
      failAugust = false;
      const retryResult = await session.getSnapshot().editor!.confirmChanges();
      expect(retryResult).toEqual({
        ok: true,
        committedMonthKeys: ['2026-08'],
      });
      expect(scheduleReadModel.get(augKey)).toEqual([persistedAug1000]);

      const finalOccs = session.getSnapshot().editor!.draftOccurrences!;
      expect(finalOccs.map((o) => o.id)).toEqual([999, 1000]);
      expect(observedDuplicateFrames).toEqual([]);

      unsub();
      session.dispose();
    });

    it('exposes referentially stable editor.isSaving, blocks resetChanges() while saving, and resets isSaving on rejection', async () => {
      const julyKey: ScheduleReadKey = { userId: '123', year: 2026, month: 7 };
      scheduleReadModel.set(julyKey, [julyAllowSlot]);

      const syncGate =
        deferred<
          Awaited<
            ReturnType<NonNullable<MentorScheduleSessionPorts['syncMonths']>>
          >
        >();
      const { ports, spies } = makePorts({
        syncMonths: vi.fn(() => syncGate.promise),
      });

      const session = createMentorScheduleSession(
        {
          backend: { userId: '123', year: 2026, month: 7 },
          loginUserId: '123',
        },
        ports
      );

      // Idle snapshot: isSaving === false and referentially stable
      const idleSnap1 = session.getSnapshot();
      const idleSnap2 = session.getSnapshot();
      expect(idleSnap1).toBe(idleSnap2);
      expect(idleSnap1.editor!.isSaving).toBe(false);

      // Make July dirty by adding a new slot
      session.getSnapshot().reader.setSelectedDate('2026-07-26');
      session.getSnapshot().editor!.addSlotForSelectedDate({
        startTime: '15:00',
        durationMinutes: 30,
      });
      expect(session.getSnapshot().editor!.draftOccurrences).toHaveLength(2);

      // Start save -> isSaving transitions to true and remains referentially stable across reads
      const savePromise = session.getSnapshot().editor!.confirmChanges();
      const savingSnap1 = session.getSnapshot();
      const savingSnap2 = session.getSnapshot();
      expect(savingSnap1).toBe(savingSnap2);
      expect(savingSnap1.editor!.isSaving).toBe(true);

      // Calling resetChanges() mid-save MUST be blocked so the un-abortable commit cannot half-discard
      session.getSnapshot().editor!.resetChanges();
      expect(session.getSnapshot().editor!.draftOccurrences).toHaveLength(2);
      expect(session.getSnapshot().editor!.isSaving).toBe(true);

      const persistedNewSlot: RawMentorTimeslot = {
        id: 888,
        type: 'ALLOW',
        dtstart: Math.floor(new Date('2026-07-26T15:00:00Z').getTime() / 1000),
        dtend: Math.floor(new Date('2026-07-26T15:30:00Z').getTime() / 1000),
        rrule: undefined,
        exdate: [],
      };
      syncGate.resolve([
        {
          monthKey: '2026-07',
          outcome: { ok: true, raws: [julyAllowSlot, persistedNewSlot] },
        },
      ]);
      const res = await savePromise;

      expect(res).toEqual({ ok: true, committedMonthKeys: ['2026-07'] });
      expect(session.getSnapshot().editor!.isSaving).toBe(false);
      expect(
        session.getSnapshot().editor!.draftOccurrences!.map((o) => o.id)
      ).toEqual([101, 888]);
      expect(scheduleReadModel.get(julyKey)).toEqual([
        julyAllowSlot,
        persistedNewSlot,
      ]);

      // Verify unexpected rejection also resets isSaving back to false
      session.getSnapshot().editor!.addSlotForSelectedDate({
        startTime: '17:00',
        durationMinutes: 30,
      });
      spies.syncMonths.mockRejectedValueOnce(new Error('network boom'));
      await expect(
        session.getSnapshot().editor!.confirmChanges()
      ).rejects.toThrow('network boom');
      expect(session.getSnapshot().editor!.isSaving).toBe(false);

      session.dispose();
    });

    it('reconciles scheduleReadModel and MonthDraftStore baseline even if dispose() runs mid-flight (when accountSwitchGen is unchanged) so remount configure() never restores stale pre-save rows', async () => {
      const julyKey: ScheduleReadKey = { userId: '123', year: 2026, month: 7 };
      scheduleReadModel.set(julyKey, [julyAllowSlot]);

      const syncGate1 =
        deferred<
          Awaited<
            ReturnType<NonNullable<MentorScheduleSessionPorts['syncMonths']>>
          >
        >();
      const syncGate2 =
        deferred<
          Awaited<
            ReturnType<NonNullable<MentorScheduleSessionPorts['syncMonths']>>
          >
        >();
      let syncCall = 0;

      const { ports } = makePorts({
        syncMonths: vi.fn(() => {
          syncCall += 1;
          return syncCall === 1 ? syncGate1.promise : syncGate2.promise;
        }),
      });

      const session = createMentorScheduleSession(
        {
          backend: { userId: '123', year: 2026, month: 7 },
          loginUserId: '123',
        },
        ports
      );

      // Case A: dispose() mid-flight -> syncMonths settles while disposed -> configure() remounts later
      session.getSnapshot().reader.setSelectedDate('2026-07-26');
      session.getSnapshot().editor!.addSlotForSelectedDate({
        startTime: '15:00',
        durationMinutes: 30,
      });
      const savePromise1 = session.getSnapshot().editor!.confirmChanges();
      expect(session.getSnapshot().editor!.isSaving).toBe(true);

      // Unmount / StrictMode cleanup while confirmChanges is in flight
      session.dispose();

      const committedJulyA: RawMentorTimeslot = {
        id: 701,
        type: 'ALLOW',
        dtstart: Math.floor(new Date('2026-07-26T15:00:00Z').getTime() / 1000),
        dtend: Math.floor(new Date('2026-07-26T15:30:00Z').getTime() / 1000),
        rrule: undefined,
        exdate: [],
      };
      syncGate1.resolve([
        {
          monthKey: '2026-07',
          outcome: { ok: true, raws: [julyAllowSlot, committedJulyA] },
        },
      ]);
      await savePromise1;

      // Read model was STILL published despite session being disposed (same accountSwitchGen)
      expect(scheduleReadModel.get(julyKey)).toEqual([
        julyAllowSlot,
        committedJulyA,
      ]);

      // Remounting via configure() sees the freshly committed rows and unwedged isSaving === false
      session.configure({
        backend: { userId: '123', year: 2026, month: 7 },
        loginUserId: '123',
      });
      expect(session.getSnapshot().editor!.isSaving).toBe(false);
      expect(
        session.getSnapshot().editor!.draftOccurrences!.map((o) => o.id)
      ).toEqual([101, 701]);

      // Case B: dispose() -> immediate configure() remount BEFORE syncMonths settles -> syncMonths settles
      session.getSnapshot().editor!.addSlotForSelectedDate({
        startTime: '16:30',
        durationMinutes: 30,
      });
      const savePromise2 = session.getSnapshot().editor!.confirmChanges();
      expect(session.getSnapshot().editor!.isSaving).toBe(true);

      session.dispose();
      session.configure({
        backend: { userId: '123', year: 2026, month: 7 },
        loginUserId: '123',
      });

      // Still saving while syncGate2 is pending, and mid-save resetChanges() remains blocked
      expect(session.getSnapshot().editor!.isSaving).toBe(true);
      session.getSnapshot().editor!.resetChanges();
      expect(session.getSnapshot().editor!.draftOccurrences).toHaveLength(3);

      const committedJulyB: RawMentorTimeslot = {
        id: 702,
        type: 'ALLOW',
        dtstart: Math.floor(new Date('2026-07-26T16:30:00Z').getTime() / 1000),
        dtend: Math.floor(new Date('2026-07-26T17:00:00Z').getTime() / 1000),
        rrule: undefined,
        exdate: [],
      };
      syncGate2.resolve([
        {
          monthKey: '2026-07',
          outcome: {
            ok: true,
            raws: [julyAllowSlot, committedJulyA, committedJulyB],
          },
        },
      ]);
      await savePromise2;

      expect(session.getSnapshot().editor!.isSaving).toBe(false);
      expect(scheduleReadModel.get(julyKey)).toEqual([
        julyAllowSlot,
        committedJulyA,
        committedJulyB,
      ]);
      expect(
        session.getSnapshot().editor!.draftOccurrences!.map((o) => o.id)
      ).toEqual([101, 701, 702]);

      session.dispose();
    });

    it('reconciles custom injected ports.scheduleReadModel on confirmChanges when custom ports.syncMonths does not write to the read model directly', async () => {
      const customManager = new AsyncReadManager<string, RawMentorTimeslot[]>();
      const toKey = (k: ScheduleReadKey) =>
        `${k.userId}_${k.year}_${String(k.month).padStart(2, '0')}`;
      const customScheduleReadModel: MentorScheduleReadModel = {
        get: (k) => customManager.get(toKey(k)),
        set: (k, v) => customManager.set(toKey(k), v),
        subscribe: (k, f, cb, opts) =>
          customManager.subscribe(toKey(k), f, cb, opts),
        refresh: (k, f) => customManager.refresh(toKey(k), f),
        invalidate: (k) => customManager.invalidate(toKey(k)),
        invalidateOrRefresh: (k, f) =>
          customManager.getListenerCount(toKey(k)) > 0
            ? customManager.refresh(toKey(k), f)
            : (customManager.invalidate(toKey(k)), Promise.resolve(null)),
        prefetch: (k, f) => void customManager.prefetch(toKey(k), f),
        clear: () => customManager.clear(),
      };

      const julyKey: ScheduleReadKey = { userId: '123', year: 2026, month: 7 };
      customScheduleReadModel.set(julyKey, []);
      customScheduleReadModel.set({ userId: '123', year: 2026, month: 8 }, []);

      const persistedJuly999: RawMentorTimeslot = {
        id: 999,
        type: 'ALLOW',
        dtstart: Math.floor(new Date('2026-07-22T09:00:00Z').getTime() / 1000),
        dtend: Math.floor(new Date('2026-07-22T09:30:00Z').getTime() / 1000),
        rrule: undefined,
        exdate: [],
      };

      const { ports } = makePorts({
        scheduleReadModel: customScheduleReadModel,
        // Custom syncMonths returns persisted raws without calling customScheduleReadModel.set
        syncMonths: vi.fn(async () => [
          {
            monthKey: '2026-07',
            outcome: { ok: true as const, raws: [persistedJuly999] },
          },
        ]),
      });

      const session = createMentorScheduleSession(
        {
          backend: { userId: '123' },
          loginUserId: '123',
        },
        ports
      );

      session.getSnapshot().reader.setSelectedDate('2026-07-22');
      session.getSnapshot().editor!.addSlotForSelectedDate({
        startTime: '09:00',
        durationMinutes: 30,
      });

      const res = await session.getSnapshot().editor!.confirmChanges();
      expect(res).toEqual({ ok: true, committedMonthKeys: ['2026-07'] });

      // Injected scheduleReadModel port must be updated to [persistedJuly999]
      expect(customScheduleReadModel.get(julyKey)).toEqual([persistedJuly999]);

      // Navigating away to August and back to July must NOT clobber July with stale []
      session.getSnapshot().reader.onMonthChange!(
        new Date('2026-08-01T00:00:00Z')
      );
      session.getSnapshot().reader.onMonthChange!(
        new Date('2026-07-01T00:00:00Z')
      );
      expect(
        session.getSnapshot().editor!.draftOccurrences!.map((o) => o.id)
      ).toEqual([999]);

      session.dispose();
    });
  });

  describe('selectedSlot & cursor reset across user switches and slot invalidation', () => {
    it('resets selectedSlot, selectedDate, and swiped cursorYear/cursorMonth when switching from Mentor A to an empty Mentor B', async () => {
      const { ports } = makePorts({
        nowMsValue: new Date('2026-07-05T00:00:00Z').getTime(),
        loadMonthSchedule: vi.fn(async (ref) => {
          if (ref.userId === 'mentor-a' && ref.month === 8) {
            return [augustAllowSlot];
          }
          return [];
        }),
      });

      const session = createMentorScheduleSession(
        {
          backend: { userId: 'mentor-a' },
          loginUserId: 'mentee-1',
        },
        ports
      );

      await Promise.resolve();
      await Promise.resolve();

      // Mentee swipes to August on Mentor A and selects a slot
      session.getSnapshot().reader.onMonthChange!(
        new Date('2026-08-01T00:00:00Z')
      );
      await Promise.resolve();
      await Promise.resolve();

      session.getSnapshot().reader.setSelectedDate('2026-08-12');
      const mentorASlot =
        session.getSnapshot().reader.slotsSnapshot.slots[0] ?? null;
      expect(mentorASlot).not.toBeNull();
      session.getSnapshot().reader.setSelectedSlot!(mentorASlot);
      expect(session.getSnapshot().reader.selectedSlot).toBe(mentorASlot);
      expect(session.getSnapshot().reader.year).toBe(2026);
      expect(session.getSnapshot().reader.month).toBe(8);

      // Switch to Mentor B who has 0 available slots (year/month omitted)
      session.configure({
        backend: { userId: 'mentor-b' },
        loginUserId: 'mentee-1',
      });

      // Immediately clean before Mentor B's fetch resolves
      expect(session.getSnapshot().reader.selectedSlot).toBeNull();
      expect(session.getSnapshot().reader.year).toBe(2026);
      expect(session.getSnapshot().reader.month).toBe(7);
      expect(session.getSnapshot().reader.selectedDate).toBe('2026-07-05');

      await Promise.resolve();
      await Promise.resolve();

      // Stays clean after Mentor B resolves with []
      expect(session.getSnapshot().loaded).toBe(true);
      expect(session.getSnapshot().reader.selectedSlot).toBeNull();
      expect(session.getSnapshot().reader.year).toBe(2026);
      expect(session.getSnapshot().reader.month).toBe(7);
      expect(session.getSnapshot().reader.selectedDate).toBe('2026-07-05');

      session.dispose();
    });

    it('clears selectedSlot when month changes or when active date slots no longer contain it as an available slot', async () => {
      let currentRaws: RawMentorTimeslot[] = [julyAllowSlot];
      const { ports } = makePorts({
        nowMsValue: new Date('2026-07-01T00:00:00Z').getTime(),
        loadMonthSchedule: vi.fn(async () => currentRaws),
      });

      const session = createMentorScheduleSession(
        {
          backend: { userId: 'mentor-a', year: 2026, month: 7 },
          loginUserId: 'mentee-1',
        },
        ports
      );

      await Promise.resolve();
      await Promise.resolve();

      const slot0 = session.getSnapshot().reader.slotsSnapshot.slots[0]!;
      session.getSnapshot().reader.setSelectedSlot!(slot0);
      expect(session.getSnapshot().reader.selectedSlot).toBe(slot0);

      // Reloading when the slot became BOOKED on backend clears selectedSlot
      currentRaws = [
        julyAllowSlot,
        { ...julyAllowSlot, id: 901, type: 'BOOKED' },
      ];
      await session.getSnapshot().reader.reload!();
      expect(session.getSnapshot().reader.selectedSlot).toBeNull();

      // Restore free slot, select it, then change controlled month -> clears selectedSlot
      currentRaws = [julyAllowSlot];
      await session.getSnapshot().reader.reload!();
      const restoredSlot = session.getSnapshot().reader.slotsSnapshot.slots[0]!;
      session.getSnapshot().reader.setSelectedSlot!(restoredSlot);
      expect(session.getSnapshot().reader.selectedSlot).toBe(restoredSlot);

      session.configure({
        backend: { userId: 'mentor-a', year: 2026, month: 8 },
        loginUserId: 'mentee-1',
      });
      expect(session.getSnapshot().reader.selectedSlot).toBeNull();

      session.dispose();
    });
  });

  describe('dispose() mid-reload recovery & passive cross-month auto-select', () => {
    it('resets isReloadingSchedule on dispose() so configure() re-activation mid-reload does not wedge monthLoaded/isFetching', async () => {
      const reloadDeferred = deferred<RawMentorTimeslot[]>();
      const uncachedReloadDeferred = deferred<RawMentorTimeslot[]>();
      let callCount = 0;

      const { ports } = makePorts({
        loadMonthSchedule: vi.fn(() => {
          callCount += 1;
          if (callCount === 1) {
            return Promise.resolve([julyAllowSlot]);
          }
          if (callCount === 2) {
            return reloadDeferred.promise;
          }
          return uncachedReloadDeferred.promise;
        }),
      });

      const session = createMentorScheduleSession(
        {
          backend: { userId: '123', year: 2026, month: 7 },
          loginUserId: '123',
        },
        ports
      );

      await Promise.resolve();
      await Promise.resolve();

      expect(session.getSnapshot().reader.slotsSnapshot.monthLoaded).toBe(true);
      expect(session.getSnapshot().reader.isFetching).toBe(false);

      // Start an explicit reload, then dispose() and re-activate via configure() mid-reload
      const reloadPromise = session.getSnapshot().reader.reload!();
      expect(session.getSnapshot().reader.isFetching).toBe(true);
      expect(session.getSnapshot().reader.slotsSnapshot.monthLoaded).toBe(
        false
      );

      session.dispose();
      session.configure({
        backend: { userId: '123', year: 2026, month: 7 },
        loginUserId: '123',
      });

      // Cached July rows are immediately ready without isReloadingSchedule wedged at true
      expect(session.getSnapshot().reader.isFetching).toBe(false);
      expect(session.getSnapshot().reader.slotsSnapshot.monthLoaded).toBe(true);

      // Completing the in-flight refresh updates cleanly and leaves flags unwedged
      reloadDeferred.resolve([julyAllowSlot]);
      await reloadPromise;

      expect(session.getSnapshot().reader.isFetching).toBe(false);
      expect(session.getSnapshot().reader.slotsSnapshot.monthLoaded).toBe(true);

      // Also verify uncached mid-reload dispose -> configure recovery
      scheduleReadModel.invalidate({ userId: '123', year: 2026, month: 7 });
      const reloadPromise2 = session.getSnapshot().reader.reload!();
      expect(session.getSnapshot().reader.isFetching).toBe(true);

      session.dispose();
      session.configure({
        backend: { userId: '123', year: 2026, month: 7 },
        loginUserId: '123',
      });
      expect(session.getSnapshot().reader.isFetching).toBe(true);

      uncachedReloadDeferred.resolve([julyAllowSlot]);
      await reloadPromise2;

      expect(session.getSnapshot().reader.isFetching).toBe(false);
      expect(session.getSnapshot().reader.slotsSnapshot.monthLoaded).toBe(true);

      session.dispose();
    });

    it('aligns currentScheduleKey and reservation keys to the jumped month when seedPassiveInitialState auto-selects across a month boundary', () => {
      const july28Start = Math.floor(
        new Date('2026-07-28T10:00:00Z').getTime() / 1000
      );
      const crossMonthWeeklySlot: RawMentorTimeslot = {
        id: 701,
        type: 'ALLOW',
        dtstart: july28Start,
        dtend: july28Start + 1800,
        rrule: 'FREQ=WEEKLY;COUNT=2', // 2026-07-28 (past) and 2026-08-04 (future)
        exdate: [],
      };

      // Cache July in scheduleReadModel, leave August uncached, and cache August's reservations
      scheduleReadModel.set({ userId: '123', year: 2026, month: 7 }, [
        crossMonthWeeklySlot,
      ]);

      const augEndUnix = endOfMonthUnix(2026, 8);
      const augReservation: Reservation = {
        id: 'res-aug-1',
        name: 'Aug Mentee',
        roleLine: 'Designer',
        date: '2026-08-04',
        time: '10:00 - 10:30',
        messages: [],
        scheduleId: 701,
        dtstart: july28Start + 7 * 86400,
        dtend: july28Start + 7 * 86400 + 1800,
        senderUserId: 'mentee-2',
        participantUserId: '123',
        version: 1,
      };
      reservationReadModel.set(
        { userId: '123', state: 'MENTOR_UPCOMING', endOfMonthUnix: augEndUnix },
        { items: [augReservation], next_dtend: 0 },
        MENTOR_SCHEDULE_RESERVATIONS_TTL_MS
      );
      reservationReadModel.set(
        { userId: '123', state: 'MENTOR_PENDING', endOfMonthUnix: augEndUnix },
        { items: [], next_dtend: 0 },
        MENTOR_SCHEDULE_RESERVATIONS_TTL_MS
      );

      const { ports } = makePorts({
        nowMsValue: new Date('2026-07-29T00:00:00Z').getTime(),
      });

      const session = createMentorScheduleSession(undefined, ports, {
        initialConfig: {
          backend: { userId: '123' },
          loginUserId: '123',
        },
      });

      const snap = session.getSnapshot();
      // Auto-selected 2026-08-04 -> cursor jumped from July to August
      expect(snap.reader.year).toBe(2026);
      expect(snap.reader.month).toBe(8);
      expect(snap.reader.selectedDate).toBe('2026-08-04');
      // August is NOT cached in scheduleReadModel yet, so monthLoaded must reflect August (false / isFetching=true), NOT July!
      expect(snap.reader.slotsSnapshot.monthLoaded).toBe(false);
      expect(snap.reader.isFetching).toBe(true);
      // Reservations were looked up using August's endOfMonthUnix, not July's!
      expect(snap.reader.slotsSnapshot.reservationsLoaded).toBe(true);
      expect(snap.editor!.reservations).toEqual([augReservation]);

      session.dispose();
    });
  });
});
