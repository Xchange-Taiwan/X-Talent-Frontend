process.env.TZ = 'UTC';

import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
});
