process.env.TZ = 'UTC';

import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MonthDraftStore, SlotDurationMinutes } from './MonthDraftStore';
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

  it('correctly implements slot adding via add', () => {
    const store = new MonthDraftStore();
    const dateStr = '2026-07-26';
    const res = store.add({
      startTime: '13:00',
      durationMinutes: 45,
      selectedDate: dateStr,
    });

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
    const res = store.add({
      startTime: startHM,
      durationMinutes: 30,
      selectedDate: '2026-07-26',
    });

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

  it('edit() refuses a read-only BOOKED/PENDING placeholder row (id < 0)', () => {
    const virtualRaws: RawMentorTimeslot[] = [
      {
        id: -101,
        type: 'BOOKED' as const,
        dtstart: 1785070000,
        dtend: 1785071800,
        rrule: undefined,
        exdate: [],
      },
    ];
    const draftMap = new Map<string, RawMentorTimeslot[]>([
      ['2026-07', virtualRaws],
    ]);
    const store = new MonthDraftStore({
      draftByMonth: draftMap,
    });

    const res = store.edit(-101, 1785070000, { startTime: '13:00' }, '123');

    expect(res).toEqual({ success: false, reason: 'READ_ONLY' });
    // Row is untouched.
    expect(store.snapshot().draftByMonth.get('2026-07')).toEqual(virtualRaws);
    expect(store.snapshot().dirtyMonths.size).toBe(0);
  });

  it('delete() no-ops on a read-only BOOKED/PENDING placeholder row (id < 0)', () => {
    const virtualRaws: RawMentorTimeslot[] = [
      {
        id: -101,
        type: 'PENDING' as const,
        dtstart: 1785070000,
        dtend: 1785071800,
        rrule: undefined,
        exdate: [],
      },
    ];
    const draftMap = new Map<string, RawMentorTimeslot[]>([
      ['2026-07', virtualRaws],
    ]);
    const store = new MonthDraftStore({
      draftByMonth: draftMap,
    });

    store.delete(-101, 1785070000);

    const snap = store.snapshot();
    expect(snap.draftByMonth.get('2026-07')).toEqual(virtualRaws);
    expect(snap.pendingDeleteByMonth.get('2026-07') ?? []).not.toContain(-101);
    expect(snap.dirtyMonths.size).toBe(0);
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

  it('reset only touches the given months, leaving other loaded months and their dirty state untouched', () => {
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
    const store = new MonthDraftStore();
    store.ensureMonthLoaded('2026-07', defaultMockRaws);
    store.ensureMonthLoaded('2026-08', augRaws);

    // Dirty both months independently.
    store.edit(101, 1785070000, { startTime: '13:00' }, '123');
    store.edit(102, 1787664000, { startTime: '15:00' }, '123');
    expect(store.snapshot().dirtyMonths.has('2026-07')).toBe(true);
    expect(store.snapshot().dirtyMonths.has('2026-08')).toBe(true);

    // Discard only July's changes.
    store.reset([['2026-07', defaultMockRaws]]);

    const snap = store.snapshot();
    expect(snap.dirtyMonths.has('2026-07')).toBe(false);
    expect(snap.draftByMonth.get('2026-07')).toEqual(defaultMockRaws);
    // August was never passed to reset, so its edit and dirty state survive.
    expect(snap.dirtyMonths.has('2026-08')).toBe(true);
    expect(snap.draftByMonth.get('2026-08')?.[0].dtstart).not.toBe(1787664000);
  });

  it('clearAll wipes every buffered month, unlike the partial reset() merge', () => {
    const store = new MonthDraftStore();
    store.ensureMonthLoaded('2026-07', defaultMockRaws);
    store.ensureMonthLoaded('2026-08', defaultMockRaws);
    store.edit(101, 1785070000, { startTime: '13:00' }, '123');
    expect(store.snapshot().dirtyMonths.size).toBeGreaterThan(0);

    store.clearAll();

    const snap = store.snapshot();
    expect(snap.savedByMonth.size).toBe(0);
    expect(snap.draftByMonth.size).toBe(0);
    expect(snap.pendingDeleteByMonth.size).toBe(0);
    expect(snap.dirtyMonths.size).toBe(0);
  });

  it('reloadMonth updates savedByMonth, and updates draftByMonth if not dirty, but preserves and rebases draftByMonth if dirty', () => {
    const store = new MonthDraftStore();
    store.ensureMonthLoaded('2026-07', defaultMockRaws);

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

    // Case 1: Clean month
    store.reloadMonth('2026-07', reloadedRaws);
    expect(store.snapshot().savedByMonth.get('2026-07')).toEqual(reloadedRaws);
    expect(store.snapshot().draftByMonth.get('2026-07')).toEqual(reloadedRaws);

    // Case 2: Dirty month
    // Trigger dirty by editing slot 101
    store.edit(101, 1785075000, { startTime: '13:00' }, '123');
    expect(store.snapshot().dirtyMonths.has('2026-07')).toBe(true);

    // Trigger an addition (add a new slot)
    store.add({
      startTime: '15:00',
      durationMinutes: 30,
      selectedDate: '2026-07-26',
    });

    const updatedRaws: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW',
        dtstart: 1785079000,
        dtend: 1785081000,
        rrule: undefined,
        exdate: [],
      },
      {
        id: 104,
        type: 'BOOKED',
        dtstart: 1785080000,
        dtend: 1785081800,
        rrule: undefined,
        exdate: [],
      },
    ];

    store.reloadMonth('2026-07', updatedRaws);

    expect(store.snapshot().savedByMonth.get('2026-07')).toEqual(updatedRaws);
    const finalDraft = store.snapshot().draftByMonth.get('2026-07') ?? [];

    // The rebased draft should contain:
    // - The user's edited version of slot 101 (at 13:00 local, NOT 12:46:40 or the reloaded 1785079000)
    // - The new BOOKED slot 104 from backend (reloaded raws)
    // - The user's added slot (id < 0)
    expect(finalDraft).toHaveLength(3);

    const slot101 = finalDraft.find((r) => r.id === 101);
    expect(slot101?.dtstart).not.toBe(1785079000); // kept user's edited dtstart (13:00)

    const slot104 = finalDraft.find((r) => r.id === 104);
    expect(slot104).toBeDefined(); // successfully merged reloaded BOOKED slot!

    const addedSlot = finalDraft.find((r) => r.id < 0);
    expect(addedSlot).toBeDefined(); // successfully preserved added slot!
    expect(store.snapshot().dirtyMonths.has('2026-07')).toBe(true);
  });

  it('reloadMonth correctly filters out deleted slots during draft rebase if the month is dirty', () => {
    const store = new MonthDraftStore();

    const mockRaws: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW',
        dtstart: 1785070000,
        dtend: 1785071800,
        rrule: undefined,
        exdate: [],
      },
      {
        id: 102,
        type: 'ALLOW',
        dtstart: 1785080000,
        dtend: 1785081800,
        rrule: undefined,
        exdate: [],
      },
    ];
    store.ensureMonthLoaded('2026-07', mockRaws);

    // Trigger dirty by editing slot 101 and deleting slot 102
    store.edit(101, 1785070000, { startTime: '13:00' }, '123');
    store.delete(102, 1785080000);
    expect(store.snapshot().dirtyMonths.has('2026-07')).toBe(true);

    const reloadedRaws: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW',
        dtstart: 1785070000,
        dtend: 1785071800,
        rrule: undefined,
        exdate: [],
      },
      {
        id: 102,
        type: 'ALLOW',
        dtstart: 1785080000,
        dtend: 1785081800,
        rrule: undefined,
        exdate: [],
      },
      {
        id: 103,
        type: 'BOOKED',
        dtstart: 1785090000,
        dtend: 1785091800,
        rrule: undefined,
        exdate: [],
      },
    ];

    store.reloadMonth('2026-07', reloadedRaws);

    const finalDraft = store.snapshot().draftByMonth.get('2026-07') ?? [];

    // The final draft should contain:
    // - Slot 101 (clean ALLOW slot)
    // - Slot 103 (new BOOKED slot from backend)
    // - But must NOT contain slot 102 (since it was deleted locally!)
    expect(finalDraft).toHaveLength(2);
    expect(finalDraft.find((r) => r.id === 101)).toBeDefined();
    expect(finalDraft.find((r) => r.id === 103)).toBeDefined();
    expect(finalDraft.find((r) => r.id === 102)).toBeUndefined();
    expect(store.snapshot().dirtyMonths.has('2026-07')).toBe(true);
  });

  it('reloadMonth discards local draft edits if the backend timeslot type changes (e.g., ALLOW -> BOOKED)', () => {
    const store = new MonthDraftStore();
    store.ensureMonthLoaded('2026-07', defaultMockRaws);

    // Trigger dirty by editing slot 101 to 13:00 local
    store.edit(101, 1785070000, { startTime: '13:00' }, '123');
    expect(store.snapshot().dirtyMonths.has('2026-07')).toBe(true);

    // Now reload with a new raw list from backend where slot 101 is now BOOKED (e.g. some student booked it)
    const newRaws: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'BOOKED',
        dtstart: 1785070000,
        dtend: 1785071800,
        rrule: undefined,
        exdate: [],
      },
    ];

    store.reloadMonth('2026-07', newRaws);

    const snapshot = store.snapshot();
    const finalDraft = snapshot.draftByMonth.get('2026-07') ?? [];

    // The rebased draft should contain:
    // - Slot 101 with type BOOKED from the backend (discarding the local edits to ALLOW slot!)
    expect(finalDraft).toHaveLength(1);
    const slot101 = finalDraft.find((r) => r.id === 101);
    expect(slot101?.type).toBe('BOOKED');
    expect(slot101?.dtstart).toBe(1785070000); // discarded user's edit (which would have changed start time to 13:00)
    expect(store.snapshot().dirtyMonths.has('2026-07')).toBe(true);
  });

  it('reloadMonth discards local draft deletion if the backend timeslot type changes (e.g., ALLOW -> BOOKED)', () => {
    const store = new MonthDraftStore();
    const mockRaws: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW',
        dtstart: 1785070000,
        dtend: 1785071800,
        rrule: undefined,
        exdate: [],
      },
      {
        id: 102,
        type: 'ALLOW',
        dtstart: 1785080000,
        dtend: 1785081800,
        rrule: undefined,
        exdate: [],
      },
    ];
    store.ensureMonthLoaded('2026-07', mockRaws);

    // Trigger dirty by editing slot 101 and deleting slot 102
    store.edit(101, 1785070000, { startTime: '13:00' }, '123');
    store.delete(102, 1785080000);
    expect(store.snapshot().dirtyMonths.has('2026-07')).toBe(true);

    // Now reload with a new raw list from backend where slot 102 is now BOOKED (e.g. some student booked it)
    const newRaws: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW',
        dtstart: 1785070000,
        dtend: 1785071800,
        rrule: undefined,
        exdate: [],
      },
      {
        id: 102,
        type: 'BOOKED',
        dtstart: 1785080000,
        dtend: 1785081800,
        rrule: undefined,
        exdate: [],
      },
    ];

    store.reloadMonth('2026-07', newRaws);

    const snapshot = store.snapshot();
    const finalDraft = snapshot.draftByMonth.get('2026-07') ?? [];

    // The rebased draft should contain:
    // - Slot 101 with edited values (at 13:00)
    // - Slot 102 with type BOOKED from the backend (discarding the local deletion of ALLOW slot!)
    expect(finalDraft).toHaveLength(2);
    const slot102 = finalDraft.find((r) => r.id === 102);
    expect(slot102?.type).toBe('BOOKED');
    expect(store.snapshot().dirtyMonths.has('2026-07')).toBe(true);
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
    const res = store.add({
      startTime: startHM,
      durationMinutes: 30,
      weeklyWithinMonth: true,
      selectedDate: '2026-07-05', // July 5, Sunday
    });

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
    const res = store.add({
      startTime: '12:00',
      durationMinutes: 30,
      selectedDate: '2026-08-02',
    });

    expect(res.success).toBe(true);

    const snap = store.snapshot();
    // July month should no longer have slot 101
    expect(snap.draftByMonth.get('2026-07')).toHaveLength(0);
    // August month should have the new slot
    const augDraft = snap.draftByMonth.get('2026-08') ?? [];
    expect(augDraft).toHaveLength(1);
  });

  it('syncs a recurring parent exdate across every loaded month buffer when editing an occurrence in a later month', () => {
    const mockRaws: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW' as const,
        dtstart: 1785070000, // occurrence 1: July 26, 2026
        dtend: 1785071800,
        rrule: 'FREQ=WEEKLY;COUNT=2', // occurrence 2: August 2, 2026
        exdate: [],
      },
    ];
    // The recurring row is loaded into BOTH month buffers, with July
    // inserted first so findMonthForSlotId resolves the parent to July even
    // though the edited occurrence itself falls in August.
    const draftMap = new Map<string, RawMentorTimeslot[]>([
      ['2026-07', mockRaws],
      ['2026-08', mockRaws],
    ]);
    const store = new MonthDraftStore({
      draftByMonth: draftMap,
    });

    const augustOccurrenceUnix = 1785070000 + 7 * 24 * 60 * 60; // August 2, 2026
    const res = store.edit(
      101,
      augustOccurrenceUnix,
      { startTime: '15:00' },
      '123'
    );

    expect(res.success).toBe(true);

    const snap = store.snapshot();
    const julDraft = snap.draftByMonth.get('2026-07') ?? [];
    const augDraft = snap.draftByMonth.get('2026-08') ?? [];

    // Both buffers hold the same parent row (id 101); the exdate must be
    // synced onto both, not just the buffer the detached row lands in.
    const julParent = julDraft.find((r) => r.id === 101);
    const augParent = augDraft.find((r) => r.id === 101);
    expect(julParent?.exdate).toContain(augustOccurrenceUnix);
    expect(augParent?.exdate).toContain(augustOccurrenceUnix);

    // The edited occurrence detaches into a new row that belongs in August
    // (where it actually falls), not July (where the parent was found).
    expect(julDraft.some((r) => r.id < 0)).toBe(false);
    const detached = augDraft.find((r) => r.id < 0);
    expect(detached).toBeDefined();
    expect(detached!.dtend - detached!.dtstart).toBe(30 * 60);

    expect(snap.dirtyMonths.has('2026-07')).toBe(true);
    expect(snap.dirtyMonths.has('2026-08')).toBe(true);
  });

  describe('getAllDraftSlots', () => {
    it('flattens draft slots across every buffered month', () => {
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
      const store = new MonthDraftStore();
      store.ensureMonthLoaded('2026-07', defaultMockRaws);
      store.ensureMonthLoaded('2026-08', augRaws);

      const all = store.getAllDraftSlots();
      expect(all.map((r) => r.id).sort()).toEqual([101, 102]);
    });

    it('dedupes a row that appears in more than one loaded month buffer', () => {
      // A recurring row spanning two months is stored in both buffers (see
      // the cross-month edit tests above); getAllDraftSlots must not double
      // count it.
      const mockRaws: RawMentorTimeslot[] = [
        {
          id: 101,
          type: 'ALLOW',
          dtstart: 1785070000,
          dtend: 1785071800,
          rrule: 'FREQ=WEEKLY;COUNT=2',
          exdate: [],
        },
      ];
      const draftMap = new Map<string, RawMentorTimeslot[]>([
        ['2026-07', mockRaws],
        ['2026-08', mockRaws],
      ]);
      const store = new MonthDraftStore({ draftByMonth: draftMap });

      const all = store.getAllDraftSlots();
      expect(all.filter((r) => r.id === 101)).toHaveLength(1);
    });
  });

  describe('getSyncRequests', () => {
    it('returns no requests when nothing is dirty', () => {
      const store = new MonthDraftStore();
      store.ensureMonthLoaded('2026-07', defaultMockRaws);
      expect(store.getSyncRequests('user-123')).toEqual([]);
    });

    it('builds one request per dirty month, carrying pending deletes and only ALLOW upserts', () => {
      const store = new MonthDraftStore();
      store.ensureMonthLoaded('2026-07', defaultMockRaws);
      store.add({
        startTime: '13:00',
        durationMinutes: 30,
        selectedDate: '2026-07-27',
      });
      store.delete(101, 1785070000);

      const requests = store.getSyncRequests('user-123');
      expect(requests).toHaveLength(1);
      const [req] = requests;
      expect(req.ref).toEqual({ userId: 'user-123', year: 2026, month: 7 });
      // The deleted persisted slot must be queued for deletion, not upsert.
      expect(req.deleteIds).toContain(101);
      // Only the newly-added ALLOW row (negative temp id) should be upserted.
      expect(req.upsertPayload).toHaveLength(1);
      expect(req.upsertPayload[0].id).toBeUndefined();
    });

    it('marks a persisted slot id on the upsert payload only once it has been saved', () => {
      const store = new MonthDraftStore();
      store.ensureMonthLoaded('2026-07', defaultMockRaws);
      store.edit(101, 1785070000, { startTime: '13:00' }, '123');

      const [req] = store.getSyncRequests('user-123');
      expect(req.upsertPayload).toHaveLength(1);
      expect(req.upsertPayload[0].id).toBe(101);
    });

    it('marks a slot with a positive id as a fresh create when that id was never actually persisted', () => {
      // A draft row can carry a positive id without ever having been saved
      // (e.g. left over after a partial `reset()`). Only ids present in
      // savedByMonth should be forwarded on the sync payload.
      const neverPersistedRow: RawMentorTimeslot = {
        ...defaultMockRaws[0],
        id: 999,
      };
      const store = new MonthDraftStore({
        savedByMonth: new Map(),
        draftByMonth: new Map([['2026-07', [neverPersistedRow]]]),
        dirtyMonths: new Set(['2026-07']),
      });

      const [req] = store.getSyncRequests('user-123');
      expect(req.upsertPayload).toHaveLength(1);
      expect(req.upsertPayload[0].id).toBeUndefined();
    });

    it('dedupes upserts with identical (dtstart, dtend) and routes the persisted duplicate into deleteIds', () => {
      const duplicateRow: RawMentorTimeslot = {
        id: 103,
        type: 'ALLOW',
        dtstart: defaultMockRaws[0].dtstart,
        dtend: defaultMockRaws[0].dtend,
        rrule: undefined,
        exdate: [],
      };
      const store = new MonthDraftStore({
        savedByMonth: new Map([
          ['2026-07', [defaultMockRaws[0], duplicateRow]],
        ]),
        draftByMonth: new Map([
          ['2026-07', [defaultMockRaws[0], duplicateRow]],
        ]),
        dirtyMonths: new Set(['2026-07']),
      });

      const [req] = store.getSyncRequests('user-123');
      expect(req.upsertPayload).toHaveLength(1);
      expect(req.deleteIds).toContain(103);
    });
  });

  describe('edit() no-op vs. real change detection', () => {
    // buildDateTime always zeroes seconds/ms when reconstructing from an
    // HH:mm string, so a round-trip no-op is only possible when dtstart is
    // already minute-aligned (unlike defaultMockRaws' :40s dtstart).
    const minuteAlignedRow: RawMentorTimeslot = {
      id: 101,
      type: 'ALLOW' as const,
      dtstart: 1785069960, // July 26, 2026 12:46:00 PM UTC (whole minute)
      dtend: 1785071760,
      rrule: undefined,
      exdate: [],
    };

    it('is a no-op and does not mark the month dirty when the occurrence value is unchanged', () => {
      const draftMap = new Map<string, RawMentorTimeslot[]>([
        ['2026-07', [minuteAlignedRow]],
      ]);
      const store = new MonthDraftStore({ draftByMonth: draftMap });

      const startHM = dayjs(minuteAlignedRow.dtstart * 1000).format('HH:mm');
      const res = store.edit(
        101,
        minuteAlignedRow.dtstart,
        { startTime: startHM, durationMinutes: 30 },
        '123'
      );

      expect(res).toEqual({ success: true });
      const snap = store.snapshot();
      expect(snap.dirtyMonths.has('2026-07')).toBe(false);
      expect(snap.draftByMonth.get('2026-07')).toEqual([minuteAlignedRow]);
    });

    it('treats a duration-only change (same start time) as a real change requiring sync', () => {
      const draftMap = new Map<string, RawMentorTimeslot[]>([
        ['2026-07', [minuteAlignedRow]],
      ]);
      const store = new MonthDraftStore({ draftByMonth: draftMap });

      const startHM = dayjs(minuteAlignedRow.dtstart * 1000).format('HH:mm');
      const res = store.edit(
        101,
        minuteAlignedRow.dtstart,
        { startTime: startHM, durationMinutes: 45 },
        '123'
      );

      expect(res.success).toBe(true);
      const snap = store.snapshot();
      expect(snap.dirtyMonths.has('2026-07')).toBe(true);
      const updated = snap.draftByMonth
        .get('2026-07')
        ?.find((r) => r.id === 101);
      expect(updated!.dtend - updated!.dtstart).toBe(45 * 60);
    });

    it('defaults the start time to the occurrence itself when only duration is patched', () => {
      const draftMap = new Map<string, RawMentorTimeslot[]>([
        ['2026-07', [minuteAlignedRow]],
      ]);
      const store = new MonthDraftStore({ draftByMonth: draftMap });

      const res = store.edit(
        101,
        minuteAlignedRow.dtstart,
        { durationMinutes: 45 },
        '123'
      );

      expect(res.success).toBe(true);
      const updated = store
        .snapshot()
        .draftByMonth.get('2026-07')
        ?.find((r) => r.id === 101);
      // Start time is unchanged (no startTime patch was given); only the
      // duration grew.
      expect(updated!.dtstart).toBe(minuteAlignedRow.dtstart);
      expect(updated!.dtend - updated!.dtstart).toBe(45 * 60);
    });
  });

  describe('edit() cross-month move when the target month is not yet loaded', () => {
    const recurringRow: RawMentorTimeslot = {
      id: 101,
      type: 'ALLOW' as const,
      dtstart: 1785070000, // occurrence 1: July 26, 2026
      dtend: 1785071800,
      rrule: 'FREQ=WEEKLY;COUNT=2', // occurrence 2: August 2, 2026
      exdate: [],
    };
    const augustOccurrenceUnix = 1785070000 + 7 * 24 * 60 * 60;

    it('fails with TARGET_MONTH_NOT_LOADED when no cache lookup function was injected', () => {
      const store = new MonthDraftStore({
        draftByMonth: new Map([['2026-07', [recurringRow]]]),
      });

      const res = store.edit(
        101,
        augustOccurrenceUnix,
        { startTime: '15:00' },
        '123'
      );

      expect(res).toEqual({
        success: false,
        reason: 'TARGET_MONTH_NOT_LOADED',
      });
      const snap = store.snapshot();
      expect(snap.dirtyMonths.size).toBe(0);
      expect(snap.draftByMonth.get('2026-07')).toEqual([recurringRow]);
    });

    it('fails with TARGET_MONTH_NOT_LOADED when the cache lookup misses (month never fetched)', () => {
      const getCachedMonthSchedule = vi.fn().mockReturnValue(undefined);
      const store = new MonthDraftStore(
        { draftByMonth: new Map([['2026-07', [recurringRow]]]) },
        { getCachedMonthSchedule }
      );

      const res = store.edit(
        101,
        augustOccurrenceUnix,
        { startTime: '15:00' },
        '123'
      );

      expect(res).toEqual({
        success: false,
        reason: 'TARGET_MONTH_NOT_LOADED',
      });
      expect(getCachedMonthSchedule).toHaveBeenCalledWith({
        userId: '123',
        year: 2026,
        month: 8,
      });
      expect(store.snapshot().dirtyMonths.size).toBe(0);
    });

    it('loads the target month from cache and keeps both source and target drafts consistent on success', () => {
      const getCachedMonthSchedule = vi.fn().mockReturnValue([]);
      const store = new MonthDraftStore(
        { draftByMonth: new Map([['2026-07', [recurringRow]]]) },
        { getCachedMonthSchedule }
      );

      const res = store.edit(
        101,
        augustOccurrenceUnix,
        { startTime: '15:00' },
        '123'
      );

      expect(res).toEqual({ success: true });
      const snap = store.snapshot();

      // Source month: parent row stays, with the moved occurrence exdated.
      const julDraft = snap.draftByMonth.get('2026-07') ?? [];
      const julParent = julDraft.find((r) => r.id === 101);
      expect(julParent?.exdate).toContain(augustOccurrenceUnix);

      // Target month: newly loaded (from cache) into both saved and draft,
      // with the detached occurrence appended.
      expect(snap.savedByMonth.get('2026-08')).toEqual([]);
      const augDraft = snap.draftByMonth.get('2026-08') ?? [];
      const detached = augDraft.find((r) => r.id < 0);
      expect(detached).toBeDefined();
      expect(detached!.dtstart).not.toBe(augustOccurrenceUnix); // moved to 15:00

      expect(snap.dirtyMonths.has('2026-07')).toBe(true);
      expect(snap.dirtyMonths.has('2026-08')).toBe(true);
    });

    it('rejects the move with OVERLAP when the cached target month already has a colliding slot', () => {
      // Colliding slot sits exactly where the moved occurrence would land:
      // Aug 2, 2026 at 15:00 (same day as augustOccurrenceUnix, new time).
      const augDateStr = dayjs(augustOccurrenceUnix * 1000).format(
        'YYYY-MM-DD'
      );
      const collideStart = dayjs(`${augDateStr}T15:00:00Z`).unix();
      const collidingRow: RawMentorTimeslot = {
        id: 202,
        type: 'ALLOW',
        dtstart: collideStart,
        dtend: collideStart + 30 * 60,
        rrule: undefined,
        exdate: [],
      };

      const getCachedMonthSchedule = vi.fn().mockReturnValue([collidingRow]);
      const store = new MonthDraftStore(
        { draftByMonth: new Map([['2026-07', [recurringRow]]]) },
        { getCachedMonthSchedule }
      );

      const res = store.edit(
        101,
        augustOccurrenceUnix,
        { startTime: '15:00' },
        '123'
      );

      expect(res).toEqual({ success: false, reason: 'OVERLAP' });
      // Nothing was mutated on failure.
      expect(store.snapshot().dirtyMonths.size).toBe(0);
      expect(store.snapshot().draftByMonth.has('2026-08')).toBe(false);
    });
  });

  describe('reloadMonth diff detection preserves local edits field-by-field', () => {
    const savedRow: RawMentorTimeslot = {
      id: 101,
      type: 'ALLOW',
      dtstart: 1785070000,
      dtend: 1785071800,
      rrule: undefined,
      exdate: [],
    };

    it('preserves a local edit when only dtend (duration) differs from saved', () => {
      const draftRow: RawMentorTimeslot = { ...savedRow, dtend: 1785073600 };
      const store = new MonthDraftStore({
        savedByMonth: new Map([['2026-07', [savedRow]]]),
        draftByMonth: new Map([['2026-07', [draftRow]]]),
        dirtyMonths: new Set(['2026-07']),
      });

      store.reloadMonth('2026-07', [savedRow]);

      const finalDraft = store.snapshot().draftByMonth.get('2026-07') ?? [];
      expect(finalDraft.find((r) => r.id === 101)?.dtend).toBe(1785073600);
    });

    it('preserves a local edit when only rrule differs from saved', () => {
      const draftRow: RawMentorTimeslot = {
        ...savedRow,
        rrule: 'FREQ=WEEKLY;COUNT=2',
      };
      const store = new MonthDraftStore({
        savedByMonth: new Map([['2026-07', [savedRow]]]),
        draftByMonth: new Map([['2026-07', [draftRow]]]),
        dirtyMonths: new Set(['2026-07']),
      });

      store.reloadMonth('2026-07', [savedRow]);

      const finalDraft = store.snapshot().draftByMonth.get('2026-07') ?? [];
      expect(finalDraft.find((r) => r.id === 101)?.rrule).toBe(
        'FREQ=WEEKLY;COUNT=2'
      );
    });

    it('preserves a local edit when only exdate differs from saved', () => {
      const draftRow: RawMentorTimeslot = {
        ...savedRow,
        exdate: [1785070000],
      };
      const store = new MonthDraftStore({
        savedByMonth: new Map([['2026-07', [savedRow]]]),
        draftByMonth: new Map([['2026-07', [draftRow]]]),
        dirtyMonths: new Set(['2026-07']),
      });

      store.reloadMonth('2026-07', [savedRow]);

      const finalDraft = store.snapshot().draftByMonth.get('2026-07') ?? [];
      expect(finalDraft.find((r) => r.id === 101)?.exdate).toEqual([
        1785070000,
      ]);
    });
  });

  describe('delete() removing the last occurrence across every loaded month buffer', () => {
    it('removes the row entirely from all buffers once its last occurrence is exdated, not just the one being deleted', () => {
      // Single-occurrence "recurring" row (COUNT=1) loaded into two months;
      // deleting its only occurrence should drop it from both buffers
      // entirely, rather than merely appending to exdate.
      const mockRaws: RawMentorTimeslot[] = [
        {
          id: 101,
          type: 'ALLOW' as const,
          dtstart: 1785070000,
          dtend: 1785071800,
          rrule: 'FREQ=WEEKLY;COUNT=1',
          exdate: [],
        },
      ];
      const draftMap = new Map<string, RawMentorTimeslot[]>([
        ['2026-07', mockRaws],
        ['2026-08', mockRaws],
      ]);
      const store = new MonthDraftStore({ draftByMonth: draftMap });

      store.delete(101, 1785070000);

      const snap = store.snapshot();
      expect(snap.draftByMonth.get('2026-07')).toHaveLength(0);
      expect(snap.draftByMonth.get('2026-08')).toHaveLength(0);
      expect(snap.pendingDeleteByMonth.get('2026-07')).toContain(101);
      expect(snap.dirtyMonths.has('2026-07')).toBe(true);
      expect(snap.dirtyMonths.has('2026-08')).toBe(true);
    });

    it('is idempotent when deleting an occurrence that was already exdated', () => {
      const mockRaws: RawMentorTimeslot[] = [
        {
          id: 101,
          type: 'ALLOW' as const,
          dtstart: 1785070000,
          dtend: 1785071800,
          rrule: 'FREQ=WEEKLY;COUNT=3',
          exdate: [1785070000], // occurrence 1 already deleted
        },
      ];
      const draftMap = new Map<string, RawMentorTimeslot[]>([
        ['2026-07', mockRaws],
      ]);
      const store = new MonthDraftStore({ draftByMonth: draftMap });

      // Deleting the same, already-exdated occurrence again should not
      // duplicate it in the exdate array or otherwise change the row.
      store.delete(101, 1785070000);

      const draft = store.snapshot().draftByMonth.get('2026-07') ?? [];
      const row = draft.find((r) => r.id === 101);
      expect(row?.exdate).toEqual([1785070000]);
    });
  });

  describe('add() restores a previously exdated occurrence instead of duplicating it', () => {
    it('undoes the exdate on the existing recurring row rather than creating a second row', () => {
      // buildDateTime always zeroes seconds when reconstructing from HH:mm,
      // so a minute-aligned dtstart is required for the reconstructed
      // candidate occurrence to exactly match the stored exdate value.
      const julyDtstart = 1785069960; // July 26, 2026 12:46:00 PM UTC
      const augustOccurrenceUnix = julyDtstart + 7 * 24 * 60 * 60; // Aug 2, 2026
      const recurringRow: RawMentorTimeslot = {
        id: 101,
        type: 'ALLOW' as const,
        dtstart: julyDtstart,
        dtend: julyDtstart + 1800, // 30-minute slot
        rrule: 'FREQ=WEEKLY;COUNT=2', // occurrences: July 26, Aug 2
        exdate: [augustOccurrenceUnix], // Aug 2 was previously deleted
      };
      // Loaded under August, since add() looks up drafts by the target month.
      const draftMap = new Map<string, RawMentorTimeslot[]>([
        ['2026-08', [recurringRow]],
      ]);
      const store = new MonthDraftStore({ draftByMonth: draftMap });

      const dateStr = dayjs(augustOccurrenceUnix * 1000).format('YYYY-MM-DD');
      const startHM = dayjs(augustOccurrenceUnix * 1000).format('HH:mm');
      const res = store.add({
        startTime: startHM,
        durationMinutes: 30,
        selectedDate: dateStr,
      });

      expect(res.success).toBe(true);
      expect(res.added).toBe(1);

      const snap = store.snapshot();
      const augDraft = snap.draftByMonth.get('2026-08') ?? [];
      // No second row was created; the same parent row had its exdate undone.
      expect(augDraft).toHaveLength(1);
      const restored = augDraft.find((r) => r.id === 101);
      expect(restored?.exdate).not.toContain(augustOccurrenceUnix);
      expect(snap.dirtyMonths.has('2026-08')).toBe(true);
    });
  });

  describe('add() rejects invalid candidate-occurrence inputs', () => {
    it('fails when selectedDate is missing', () => {
      const store = new MonthDraftStore();
      const res = store.add({
        startTime: '13:00',
        durationMinutes: 30,
        selectedDate: '',
      });
      expect(res).toEqual({ success: false, added: 0, skipped: 0 });
    });

    it('fails when startTime is missing', () => {
      const store = new MonthDraftStore();
      const res = store.add({
        startTime: '',
        durationMinutes: 30,
        selectedDate: '2026-07-26',
      });
      expect(res).toEqual({ success: false, added: 0, skipped: 0 });
    });

    it('fails when durationMinutes is missing', () => {
      const store = new MonthDraftStore();
      const res = store.add({
        startTime: '13:00',
        durationMinutes: 0 as unknown as SlotDurationMinutes,
        selectedDate: '2026-07-26',
      });
      expect(res).toEqual({ success: false, added: 0, skipped: 0 });
    });

    it('fails when selectedDate is not a parseable date', () => {
      const store = new MonthDraftStore();
      const res = store.add({
        startTime: '13:00',
        durationMinutes: 30,
        selectedDate: 'not-a-real-date',
      });
      expect(res).toEqual({ success: false, added: 0, skipped: 0 });
    });
  });
});
