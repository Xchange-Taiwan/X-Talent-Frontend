process.env.TZ = 'UTC';

import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/mentor-schedule/sync', () => ({
  loadMonthScheduleCached: vi.fn(),
  loadMonthScheduleFresh: vi.fn(),
  prefetchMonthSchedule: vi.fn(),
  syncMonths: vi.fn(),
}));

import { MonthDraftStore } from './MonthDraftStore';
import { RawMentorTimeslot } from './scheduleHelpers';

describe('MonthDraftStore Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const defaultMockRaws: RawMentorTimeslot[] = [
    {
      id: 101,
      type: 'ALLOW' as const,
      dtstart: 1785070000, // July 26, 2026 12:46:40 PM local
      dtend: 1785071800,
      rrule: undefined,
      exdate: [],
    },
  ];

  it('can be instantiated and read via snapshot', () => {
    const store = new MonthDraftStore();
    const snap = store.snapshot();
    expect(snap.savedByMonth.size).toBe(0);
    expect(snap.draftByMonth.size).toBe(0);
    expect(snap.pendingDeleteByMonth.size).toBe(0);
    expect(snap.dirtyMonths.size).toBe(0);
  });

  it('can have initial data set via constructor', () => {
    const draftMap = new Map<string, RawMentorTimeslot[]>([
      ['2026-07', defaultMockRaws],
    ]);
    const store = new MonthDraftStore({
      draftByMonth: draftMap,
    });
    const snap = store.snapshot();
    expect(snap.draftByMonth.get('2026-07')).toEqual(defaultMockRaws);
  });

  it('triggers listeners upon state change (subscribe)', () => {
    const store = new MonthDraftStore();
    let triggerCount = 0;
    const unsubscribe = store.subscribe(() => {
      triggerCount++;
    });

    store.ensureMonthLoaded('2026-07', defaultMockRaws);
    expect(triggerCount).toBe(1);

    unsubscribe();
    store.ensureMonthLoaded('2026-08', defaultMockRaws);
    expect(triggerCount).toBe(1); // unsubscribed, should not increment
  });

  it('correctly implements slot adding via edit with id=0', () => {
    const store = new MonthDraftStore();
    const dateStr = '2026-07-26';
    const res = store.edit(
      0,
      0,
      {
        startTime: '13:00',
        durationMinutes: 45,
        selectedDate: dateStr,
      },
      '123'
    );

    expect(res.success).toBe(true);
    expect(res.added).toBe(1);
    expect(res.skipped).toBe(0);

    const snap = store.snapshot();
    const draft = snap.draftByMonth.get('2026-07') ?? [];
    expect(draft).toHaveLength(1);
    expect(draft[0].id).toBe(-1); // negative temporary id
    expect(draft[0].dtend - draft[0].dtstart).toBe(45 * 60);
    expect(snap.dirtyMonths.has('2026-07')).toBe(true);
  });

  it('prevents overlap conflict when adding a new slot', () => {
    const draftMap = new Map<string, RawMentorTimeslot[]>([
      ['2026-07', defaultMockRaws],
    ]);
    const store = new MonthDraftStore({
      draftByMonth: draftMap,
    });

    // July 26, 2026 12:46:40 PM UTC = unix 1785070000.
    // Let's add an overlapping slot.
    const startHM = dayjs(1785070000 * 1000).format('HH:mm'); // e.g. '12:46'
    const res = store.edit(
      0,
      0,
      {
        startTime: startHM,
        durationMinutes: 30,
        selectedDate: '2026-07-26',
      },
      '123'
    );

    expect(res.success).toBe(false);
    expect(res.reason).toBe('OVERLAP');
    expect(res.skipped).toBe(1);
  });

  it('correctly detaches a single occurrence of a recurring slot on update', () => {
    const mockRaws: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW' as const,
        dtstart: 1785070000, // occurrence 1 (July 26, 2026)
        dtend: 1785071800,
        rrule: 'FREQ=WEEKLY;COUNT=2', // next is August 2, 2026
        exdate: [],
      },
    ];
    const draftMap = new Map<string, RawMentorTimeslot[]>([
      ['2026-07', mockRaws],
    ]);
    const store = new MonthDraftStore({
      draftByMonth: draftMap,
    });

    const res = store.edit(
      101,
      1785070000,
      {
        startTime: '13:00',
        durationMinutes: 45,
      },
      '123'
    );

    expect(res.success).toBe(true);

    const snap = store.snapshot();
    const draft07 = snap.draftByMonth.get('2026-07') ?? [];
    // The parent slot 101 should have exdate appended with 1785070000
    const parent = draft07.find((r) => r.id === 101);
    expect(parent?.exdate).toContain(1785070000);

    // There should be a detached row with a negative temporary ID
    const detached = draft07.find((r) => r.id < 0);
    expect(detached).toBeDefined();
    expect(detached!.dtend - detached!.dtstart).toBe(45 * 60);
  });

  it('correctly handles deletion of a non-recurring slot', () => {
    const draftMap = new Map<string, RawMentorTimeslot[]>([
      ['2026-07', defaultMockRaws],
    ]);
    const store = new MonthDraftStore({
      draftByMonth: draftMap,
    });

    store.delete(101, 1785070000);

    const snap = store.snapshot();
    const draft = snap.draftByMonth.get('2026-07') ?? [];
    expect(draft).toHaveLength(0);
    expect(snap.pendingDeleteByMonth.get('2026-07')).toContain(101);
  });

  it('correctly detaches occurrence on delete of a recurring slot', () => {
    const mockRaws: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW' as const,
        dtstart: 1785070000, // occurrence 1 (July 26, 2026)
        dtend: 1785071800,
        rrule: 'FREQ=WEEKLY;COUNT=2', // next is August 2, 2026
        exdate: [],
      },
    ];
    const draftMap = new Map<string, RawMentorTimeslot[]>([
      ['2026-07', mockRaws],
    ]);
    const store = new MonthDraftStore({
      draftByMonth: draftMap,
    });

    store.delete(101, 1785070000);

    const snap = store.snapshot();
    const draft = snap.draftByMonth.get('2026-07') ?? [];
    const parent = draft.find((r) => r.id === 101);
    expect(parent).toBeDefined();
    expect(parent?.exdate).toContain(1785070000);
    // Not fully removed, so pendingDeleteByMonth should NOT have 101
    expect(snap.pendingDeleteByMonth.get('2026-07')).toBeUndefined();
  });

  it('recursively updates recurring slot exdate across all loaded month buffers', () => {
    const mockRaws: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW' as const,
        dtstart: 1785070000, // occurrence 1 (July 26)
        dtend: 1785071800,
        rrule: 'FREQ=WEEKLY;COUNT=2', // next is August 2 (which is in August)
        exdate: [],
      },
    ];
    // Both July and August have the same row loaded
    const draftMap = new Map<string, RawMentorTimeslot[]>([
      ['2026-07', mockRaws],
      ['2026-08', mockRaws],
    ]);
    const store = new MonthDraftStore({
      draftByMonth: draftMap,
    });

    store.delete(101, 1785070000);

    const snap = store.snapshot();
    // July and August draft buffers should BOTH have the exdate synchronized!
    const julRow = snap.draftByMonth.get('2026-07')?.find((r) => r.id === 101);
    const augRow = snap.draftByMonth.get('2026-08')?.find((r) => r.id === 101);

    expect(julRow?.exdate).toContain(1785070000);
    expect(augRow?.exdate).toContain(1785070000);
  });

  it('supports commit and reset operations', () => {
    const store = new MonthDraftStore();
    store.ensureMonthLoaded('2026-07', defaultMockRaws);

    // Edit to trigger dirty
    store.edit(101, 1785070000, { startTime: '13:00' }, '123');
    expect(store.snapshot().dirtyMonths.has('2026-07')).toBe(true);

    // Commit success
    store.commit([
      {
        monthKey: '2026-07',
        outcome: { ok: true, raws: defaultMockRaws },
      },
    ]);
    expect(store.snapshot().dirtyMonths.has('2026-07')).toBe(false);

    // Reset with reloaded values
    const reloadedRaws: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW',
        dtstart: 1785075000,
        dtend: 1785076800,
        rrule: undefined,
        exdate: [],
      },
    ];
    store.reset([['2026-07', reloadedRaws]]);
    expect(store.snapshot().draftByMonth.get('2026-07')).toEqual(reloadedRaws);
  });

  it('correctly handles partial failure during commit', () => {
    const store = new MonthDraftStore();
    store.ensureMonthLoaded('2026-07', defaultMockRaws);
    store.ensureMonthLoaded('2026-08', defaultMockRaws);

    // Make both dirty
    store.edit(101, 1785070000, { startTime: '13:00' }, '123');
    // For august
    const augRaws: RawMentorTimeslot[] = [
      {
        id: 102,
        type: 'ALLOW',
        dtstart: 1787664000,
        dtend: 1787667600,
        rrule: undefined,
        exdate: [],
      },
    ];
    store.ensureMonthLoaded('2026-08', augRaws);
    store.edit(102, 1787664000, { startTime: '15:00' }, '123');

    expect(store.snapshot().dirtyMonths.has('2026-07')).toBe(true);
    expect(store.snapshot().dirtyMonths.has('2026-08')).toBe(true);

    // Commit with July successful and August failed
    store.commit([
      {
        monthKey: '2026-07',
        outcome: { ok: true, raws: defaultMockRaws },
      },
      {
        monthKey: '2026-08',
        outcome: { ok: false, reason: 'unknown', message: 'Failed' },
      },
    ]);

    const snap = store.snapshot();
    expect(snap.dirtyMonths.has('2026-07')).toBe(false); // Success, cleared dirty
    expect(snap.dirtyMonths.has('2026-08')).toBe(true); // Failed, remains dirty!
  });

  it('ensureMonthLoaded bails out and does not overwrite if month is dirty', () => {
    const store = new MonthDraftStore();
    store.ensureMonthLoaded('2026-07', defaultMockRaws);

    // Make dirty
    store.edit(101, 1785070000, { startTime: '13:00' }, '123');
    expect(store.snapshot().dirtyMonths.has('2026-07')).toBe(true);

    const editedDraft = store.snapshot().draftByMonth.get('2026-07');

    // Call ensureMonthLoaded with old/original raws
    store.ensureMonthLoaded('2026-07', defaultMockRaws);

    // Draft should remain edited/dirty and not overwritten
    expect(store.snapshot().draftByMonth.get('2026-07')).toEqual(editedDraft);
  });

  it('correctly implements atomic overlap check for weeklyWithinMonth', () => {
    const mockRaws: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW' as const,
        dtstart: 1785070000, // July 26, 2026 12:46:40 PM UTC (Sunday)
        dtend: 1785071800,
        rrule: undefined,
        exdate: [],
      },
    ];
    const draftMap = new Map<string, RawMentorTimeslot[]>([
      ['2026-07', mockRaws],
    ]);
    const store = new MonthDraftStore({
      draftByMonth: draftMap,
    });

    const startHM = dayjs(1785070000 * 1000).format('HH:mm');
    const res = store.edit(
      0,
      0,
      {
        startTime: startHM,
        durationMinutes: 30,
        weeklyWithinMonth: true,
        selectedDate: '2026-07-05', // July 5, Sunday
      },
      '123'
    );

    expect(res.success).toBe(false);
    expect(res.reason).toBe('OVERLAP');
    expect(res.skipped).toBe(4); // 4 Sundays in July 2026
  });

  it('correctly handles editing and moving a slot to a different day/month', () => {
    const mockRaws: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW' as const,
        dtstart: 1785070000, // July 26, 2026
        dtend: 1785071800,
        rrule: undefined,
        exdate: [],
      },
    ];
    const draftMap = new Map<string, RawMentorTimeslot[]>([
      ['2026-07', mockRaws],
    ]);

    const store = new MonthDraftStore({
      draftByMonth: draftMap,
    });

    // 1. Delete from July
    store.delete(101, 1785070000);

    // 2. Add to August
    const res = store.edit(
      0,
      0,
      {
        startTime: '12:00',
        durationMinutes: 30,
        selectedDate: '2026-08-02',
      },
      '123'
    );

    expect(res.success).toBe(true);

    const snap = store.snapshot();
    // July month should no longer have slot 101
    expect(snap.draftByMonth.get('2026-07')).toHaveLength(0);
    // August month should have the new slot
    const augDraft = snap.draftByMonth.get('2026-08') ?? [];
    expect(augDraft).toHaveLength(1);
  });
});
