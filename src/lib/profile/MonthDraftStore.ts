import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
dayjs.extend(isSameOrBefore);

import {
  activeOccurrences,
  buildDateTime,
  checkCrossMonthOverlap,
  deduplicateRawSlots,
  findRestorableExdatedRow,
  hasAnyOccurrenceOverlap,
  MonthKey,
  monthKeyFromDateStr,
  monthKeyFromUnix,
  nextTempId,
  parseMonthKey,
  RawMentorTimeslot,
} from '@/lib/profile/scheduleHelpers';
import { TimeSlotDTO, utcYearMonth } from '@/services/mentor-schedule/schedule';
import {
  MonthSyncRequest,
  MonthSyncResult,
} from '@/services/mentor-schedule/sync';

export type SlotDurationMinutes = 30 | 45 | 60;

export type UpdateDraftSlotResult = {
  success: boolean;
  reason?: 'OVERLAP' | 'TARGET_MONTH_NOT_LOADED' | 'READ_ONLY';
};

export interface MonthDraftStoreSnapshot {
  savedByMonth: Map<MonthKey, RawMentorTimeslot[]>;
  draftByMonth: Map<MonthKey, RawMentorTimeslot[]>;
  pendingDeleteByMonth: Map<MonthKey, number[]>;
  dirtyMonths: Set<MonthKey>;
  /** All current draft slots, flattened across every buffered month and
   * deduplicated by id. Derived once per snapshot so consumers can depend on
   * it directly instead of re-deriving from draftByMonth themselves. */
  allDraftSlots: RawMentorTimeslot[];
}

export type StoreListener = (snapshot: MonthDraftStoreSnapshot) => void;

export type LoadMonthScheduleCachedFn = (ref: {
  userId: string;
  year: number;
  month: number;
}) => {
  cached: RawMentorTimeslot[] | undefined;
};

const appendExdate = (exdates: number[], unix: number): number[] =>
  exdates.includes(unix) ? exdates : [...exdates, unix];

export class MonthDraftStore {
  private savedByMonth = new Map<MonthKey, RawMentorTimeslot[]>();
  private draftByMonth = new Map<MonthKey, RawMentorTimeslot[]>();
  private pendingDeleteByMonth = new Map<MonthKey, number[]>();
  private dirtyMonths = new Set<MonthKey>();
  private listeners = new Set<StoreListener>();
  private loadMonthScheduleCached?: LoadMonthScheduleCachedFn;
  private currentSnapshot: MonthDraftStoreSnapshot | null = null;

  constructor(
    initialData?: Partial<MonthDraftStoreSnapshot>,
    options?: { loadMonthScheduleCached?: LoadMonthScheduleCachedFn }
  ) {
    this.loadMonthScheduleCached = options?.loadMonthScheduleCached;
    if (initialData) {
      this.savedByMonth = initialData.savedByMonth ?? new Map();
      this.draftByMonth = initialData.draftByMonth ?? new Map();
      this.pendingDeleteByMonth = initialData.pendingDeleteByMonth ?? new Map();
      this.dirtyMonths = initialData.dirtyMonths ?? new Set();
    }
  }

  public subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitChange() {
    this.currentSnapshot = {
      savedByMonth: this.savedByMonth,
      draftByMonth: this.draftByMonth,
      pendingDeleteByMonth: this.pendingDeleteByMonth,
      dirtyMonths: this.dirtyMonths,
      allDraftSlots: this.computeAllDraftSlots(),
    };
    const snap = this.currentSnapshot;
    this.listeners.forEach((l) => l(snap));
  }

  public snapshot(): MonthDraftStoreSnapshot {
    if (!this.currentSnapshot) {
      this.currentSnapshot = {
        savedByMonth: this.savedByMonth,
        draftByMonth: this.draftByMonth,
        pendingDeleteByMonth: this.pendingDeleteByMonth,
        dirtyMonths: this.dirtyMonths,
        allDraftSlots: this.computeAllDraftSlots(),
      };
    }
    return this.currentSnapshot;
  }

  private computeAllDraftSlots(): RawMentorTimeslot[] {
    const out: RawMentorTimeslot[] = [];
    this.draftByMonth.forEach((raws) => out.push(...raws));
    return deduplicateRawSlots(out);
  }

  /**
   * All current draft slots, flattened across every buffered month and
   * deduplicated by id. Callers that need cross-month derivations (e.g. the
   * calendar's allowed dates / booking slots) should use this instead of
   * reaching into `snapshot().draftByMonth`.
   */
  public getAllDraftSlots(): RawMentorTimeslot[] {
    return this.snapshot().allDraftSlots;
  }

  /**
   * The dirty months' changes, shaped as ready-to-send `MonthSyncRequest`s
   * for `syncMonths()` — one request per dirty month, in the same order the
   * months became dirty. Each request's `upsertPayload` carries only ALLOW
   * rows not already queued for deletion, deduped by (dtstart, dtend) with
   * any persisted duplicate routed into `deleteIds` instead, mirroring
   * `syncMonthSchedule`'s PUT-before-DELETE contract per month. Returns `[]`
   * when nothing is dirty.
   */
  public getSyncRequests(userId: string): MonthSyncRequest[] {
    const persistedIdSet = new Set<number>();
    this.savedByMonth.forEach((raws) => {
      for (const r of raws) if (r.id > 0) persistedIdSet.add(r.id);
    });

    const toServiceSlot = (r: RawMentorTimeslot): TimeSlotDTO => {
      const { year, month } = utcYearMonth(r.dtstart);
      const slot: TimeSlotDTO = {
        user_id: 0,
        dt_type: 'ALLOW',
        dt_year: year,
        dt_month: month,
        dtstart: r.dtstart,
        dtend: r.dtend,
        rrule: r.rrule,
        timezone: 'UTC',
        exdate: r.exdate,
      };
      if (r.id > 0 && persistedIdSet.has(r.id)) slot.id = r.id;
      return slot;
    };

    return Array.from(this.dirtyMonths).map((monthKey) => {
      const { year, month } = parseMonthKey(monthKey);
      const draftRaws = this.draftByMonth.get(monthKey) ?? [];
      const pendingDeletes = this.pendingDeleteByMonth.get(monthKey) ?? [];

      const rawUpsert = draftRaws
        .filter((r) => !pendingDeletes.includes(r.id) && r.type === 'ALLOW')
        .map(toServiceSlot);

      // Dedupe by (dtstart, dtend) within this month; queue any persisted
      // duplicate for deletion to avoid PUT conflicts.
      const seenKeys = new Map<string, number>();
      const upsertPayload: TimeSlotDTO[] = [];
      const extraDeleteIds: number[] = [];
      for (const slot of rawUpsert) {
        const key = `${slot.dtstart}_${slot.dtend}`;
        if (!seenKeys.has(key)) {
          seenKeys.set(key, upsertPayload.length);
          upsertPayload.push(slot);
        } else if (typeof slot.id === 'number' && slot.id > 0) {
          extraDeleteIds.push(slot.id);
        }
      }

      return {
        ref: { userId, year, month },
        upsertPayload,
        deleteIds: [...pendingDeletes, ...extraDeleteIds],
      };
    });
  }

  private findMonthForSlotId(id: number): MonthKey | null {
    let result: MonthKey | null = null;
    this.draftByMonth.forEach((raws, key) => {
      if (result !== null) return;
      if (raws.some((r) => r.id === id)) result = key;
    });
    return result;
  }

  private markDirty(monthKey: MonthKey) {
    if (!this.dirtyMonths.has(monthKey)) {
      this.dirtyMonths = new Set(this.dirtyMonths);
      this.dirtyMonths.add(monthKey);
    }
  }

  private ensureTargetMonthLoaded({
    targetMonthKey,
    currentDraftsMap,
    userId,
  }: {
    targetMonthKey: MonthKey;
    currentDraftsMap: Map<MonthKey, RawMentorTimeslot[]>;
    userId: string;
  }): RawMentorTimeslot[] | null {
    let targetDraft = currentDraftsMap.get(targetMonthKey);
    if (!targetDraft) {
      if (!this.loadMonthScheduleCached) {
        return null;
      }
      const { year, month } = parseMonthKey(targetMonthKey);
      const { cached } = this.loadMonthScheduleCached({
        userId,
        year,
        month,
      });
      if (!cached) {
        return null;
      }
      targetDraft = cached;
    }
    return targetDraft;
  }

  public ensureMonthLoaded(
    monthKey: MonthKey,
    raws: RawMentorTimeslot[]
  ): void {
    if (this.dirtyMonths.has(monthKey)) return;
    this.savedByMonth = new Map(this.savedByMonth);
    this.draftByMonth = new Map(this.draftByMonth);
    this.savedByMonth.set(monthKey, raws);
    this.draftByMonth.set(monthKey, raws);
    this.emitChange();
  }

  public reloadMonth(monthKey: MonthKey, raws: RawMentorTimeslot[]): void {
    const oldSaved = this.savedByMonth.get(monthKey) ?? [];
    this.savedByMonth = new Map(this.savedByMonth);
    this.savedByMonth.set(monthKey, raws);

    if (!this.dirtyMonths.has(monthKey)) {
      this.draftByMonth = new Map(this.draftByMonth);
      this.draftByMonth.set(monthKey, raws);
    } else {
      // Month is dirty: rebase local draft edits on top of the new reloaded raws
      const oldDraft = this.draftByMonth.get(monthKey) ?? [];

      // 1. Identify added slots (temporary IDs)
      const addedSlots = oldDraft.filter((r) => r.id < 0);

      // 2. Identify deleted slot IDs (persisted IDs present in oldSaved but missing in oldDraft)
      const oldDraftIds = new Set(oldDraft.map((r) => r.id));
      const deletedSlotIds = new Set(
        oldSaved
          .filter((r) => r.id > 0 && !oldDraftIds.has(r.id))
          .map((r) => r.id)
      );

      // 3. Identify edited slots (persisted IDs in oldDraft whose values differ from oldSaved)
      const oldSavedMap = new Map(oldSaved.map((r) => [r.id, r]));
      const editedSlotsMap = new Map<number, RawMentorTimeslot>();

      for (const draftSlot of oldDraft) {
        if (draftSlot.id > 0) {
          const savedSlot = oldSavedMap.get(draftSlot.id);
          if (savedSlot) {
            // Check if any property has changed
            const isDifferent =
              draftSlot.dtstart !== savedSlot.dtstart ||
              draftSlot.dtend !== savedSlot.dtend ||
              draftSlot.rrule !== savedSlot.rrule ||
              JSON.stringify(draftSlot.exdate) !==
                JSON.stringify(savedSlot.exdate);

            if (isDifferent) {
              editedSlotsMap.set(draftSlot.id, draftSlot);
            }
          }
        }
      }

      // 4. Rebase: Apply deletions and edits to the new reloaded raws, then append additions
      const rebasedDraft = raws
        .filter((r) => !deletedSlotIds.has(r.id))
        .map((r) => {
          if (r.id > 0 && editedSlotsMap.has(r.id)) {
            return editedSlotsMap.get(r.id)!;
          }
          return r;
        });

      rebasedDraft.push(...addedSlots);

      this.draftByMonth = new Map(this.draftByMonth);
      this.draftByMonth.set(monthKey, rebasedDraft);
    }
    this.emitChange();
  }

  public add(patch: {
    startTime: string;
    durationMinutes: SlotDurationMinutes;
    weeklyWithinMonth?: boolean;
    selectedDate: string;
  }): UpdateDraftSlotResult & { added: number; skipped: number } {
    const { startTime, durationMinutes, weeklyWithinMonth, selectedDate } =
      patch;
    if (!selectedDate || !startTime || !durationMinutes) {
      return { success: false, added: 0, skipped: 0 };
    }

    const startDayjs = buildDateTime(selectedDate, startTime);
    if (!startDayjs.isValid()) return { success: false, added: 0, skipped: 0 };

    const monthKey = monthKeyFromDateStr(selectedDate);
    const durationSeconds = durationMinutes * 60;

    const candidateOccurrences: number[] = [];
    if (weeklyWithinMonth) {
      const selectedDay = dayjs(selectedDate);
      let cursor = selectedDay;
      while (cursor.month() === selectedDay.month()) {
        const d = buildDateTime(cursor.format('YYYY-MM-DD'), startTime);
        if (d.isValid()) {
          candidateOccurrences.push(Math.floor(d.valueOf() / 1000));
        }
        cursor = cursor.add(7, 'day');
      }
    } else {
      candidateOccurrences.push(Math.floor(startDayjs.valueOf() / 1000));
    }

    if (candidateOccurrences.length === 0) {
      return { success: false, added: 0, skipped: 0 };
    }

    let added = 0;
    let skipped = 0;
    const prev = this.draftByMonth.get(monthKey) ?? [];

    if (
      hasAnyOccurrenceOverlap(prev, null, candidateOccurrences, durationSeconds)
    ) {
      skipped = candidateOccurrences.length;
      return { success: false, reason: 'OVERLAP', added: 0, skipped };
    }

    if (candidateOccurrences.length === 1) {
      const restoreTarget = findRestorableExdatedRow(
        prev,
        candidateOccurrences[0],
        durationSeconds
      );
      if (restoreTarget) {
        added = 1;
        const updated = prev.map((r) =>
          r.id === restoreTarget.id
            ? {
                ...r,
                exdate: r.exdate.filter((x) => x !== candidateOccurrences[0]),
              }
            : r
        );
        this.draftByMonth = new Map(this.draftByMonth);
        this.draftByMonth.set(monthKey, updated);
        this.markDirty(monthKey);
        this.emitChange();
        return { success: true, added, skipped };
      }
    }

    const dtstart = candidateOccurrences[0];
    const count = candidateOccurrences.length;
    const rrule = count > 1 ? `FREQ=WEEKLY;COUNT=${count}` : undefined;

    added = count;
    const nextId = nextTempId(Array.from(this.draftByMonth.values()).flat());
    this.draftByMonth = new Map(this.draftByMonth);
    this.draftByMonth.set(monthKey, [
      ...prev,
      {
        id: nextId,
        type: 'ALLOW' as const,
        dtstart,
        dtend: dtstart + durationSeconds,
        rrule,
        exdate: [],
      },
    ]);

    this.markDirty(monthKey);
    this.emitChange();
    return { success: true, added, skipped };
  }

  public edit(
    id: number,
    occurrenceUnix: number,
    patch: {
      startTime?: string;
      durationMinutes?: SlotDurationMinutes;
    },
    userId: string
  ): UpdateDraftSlotResult {
    const parentMonthKey = this.findMonthForSlotId(id);
    if (!parentMonthKey) return { success: false };

    const parentDraft = this.draftByMonth.get(parentMonthKey) ?? [];
    const target = parentDraft.find((r) => r.id === id);
    if (!target) return { success: false };
    // Backend-synthesized BOOKED/PENDING placeholders (and any other
    // non-ALLOW row) are read-only — the UI never wires edit actions to
    // them, but guard here too since this is a public store method.
    if (target.type !== 'ALLOW') return { success: false, reason: 'READ_ONLY' };

    const baseDate = dayjs(occurrenceUnix * 1000).format('YYYY-MM-DD');
    const fmtHM = (sec: number) => dayjs(sec * 1000).format('HH:mm');
    const startHM = patch.startTime ?? fmtHM(occurrenceUnix);

    const s = buildDateTime(baseDate, startHM);
    if (!s.isValid()) return { success: false };

    const newDtstart = Math.floor(s.valueOf() / 1000);
    const oldDurationSeconds = target.dtend - target.dtstart;
    const durationSeconds =
      (patch.durationMinutes ?? Math.round(oldDurationSeconds / 60)) * 60;

    const isRecurring = !!target.rrule;
    const noChange =
      newDtstart === occurrenceUnix && durationSeconds === oldDurationSeconds;

    if (noChange) {
      return { success: true };
    }

    const targetMonthKey = monthKeyFromUnix(newDtstart);

    const targetDraft = this.ensureTargetMonthLoaded({
      targetMonthKey,
      currentDraftsMap: this.draftByMonth,
      userId,
    });
    if (!targetDraft) {
      return { success: false, reason: 'TARGET_MONTH_NOT_LOADED' };
    }
    const isTargetLoaded = this.draftByMonth.has(targetMonthKey);

    const hasOverlap = checkCrossMonthOverlap({
      id,
      occurrenceUnix,
      newDtstart,
      durationSeconds,
      isRecurring,
      currentDraftsMap: this.draftByMonth,
      targetDraft,
    });
    if (hasOverlap) {
      return { success: false, reason: 'OVERLAP' };
    }

    this.draftByMonth = new Map(this.draftByMonth);

    if (!isTargetLoaded) {
      this.savedByMonth = new Map(this.savedByMonth);
      this.savedByMonth.set(targetMonthKey, targetDraft);
    }

    if (!this.draftByMonth.has(targetMonthKey)) {
      this.draftByMonth.set(targetMonthKey, targetDraft);
    }

    const currentParentDraft = this.draftByMonth.get(parentMonthKey) ?? [];
    const currentTargetDraft = this.draftByMonth.get(targetMonthKey) ?? [];

    const latestTarget = currentParentDraft.find((r) => r.id === id);
    if (!latestTarget) return { success: false };

    if (isRecurring) {
      const updatedParent: RawMentorTimeslot = {
        ...latestTarget,
        exdate: appendExdate(latestTarget.exdate, occurrenceUnix),
      };
      const detachedRow: RawMentorTimeslot = {
        id: nextTempId(Array.from(this.draftByMonth.values()).flat()),
        type: 'ALLOW' as const,
        dtstart: newDtstart,
        dtend: newDtstart + durationSeconds,
        rrule: undefined,
        exdate: [],
      };

      this.draftByMonth.forEach((mDraft, mKey) => {
        if (mDraft.some((r: RawMentorTimeslot) => r.id === id)) {
          this.draftByMonth.set(
            mKey,
            mDraft.map((r: RawMentorTimeslot) =>
              r.id === id ? updatedParent : r
            )
          );
        }
      });

      const updatedTargetDraft = this.draftByMonth.get(targetMonthKey) ?? [];
      this.draftByMonth.set(targetMonthKey, [
        ...updatedTargetDraft,
        detachedRow,
      ]);
    } else {
      const updatedSlot: RawMentorTimeslot = {
        ...latestTarget,
        dtstart: newDtstart,
        dtend: newDtstart + durationSeconds,
        rrule: undefined,
        exdate: [],
      };

      if (targetMonthKey === parentMonthKey) {
        this.draftByMonth.set(
          parentMonthKey,
          currentParentDraft.map((r) => (r.id === id ? updatedSlot : r))
        );
      } else {
        this.draftByMonth.set(
          parentMonthKey,
          currentParentDraft.filter((r) => r.id !== id)
        );
        this.draftByMonth.set(targetMonthKey, [
          ...currentTargetDraft,
          updatedSlot,
        ]);
      }
    }

    this.draftByMonth.forEach((mDraft, mKey) => {
      if (mDraft.some((r: RawMentorTimeslot) => r.id === id)) {
        this.markDirty(mKey);
      }
    });
    this.markDirty(targetMonthKey);

    this.emitChange();
    return { success: true };
  }

  public delete(id: number, occurrenceUnix: number): void {
    const parentMonthKey = this.findMonthForSlotId(id);
    if (!parentMonthKey) return;

    let fullyRemovedFromSomeMonth = false;

    const parentDraft = this.draftByMonth.get(parentMonthKey) ?? [];
    const target = parentDraft.find((r) => r.id === id);
    if (!target) return;
    // Backend-synthesized BOOKED/PENDING placeholders (and any other
    // non-ALLOW row) are read-only — the UI never wires delete actions to
    // them, but guard here too since this is a public store method.
    if (target.type !== 'ALLOW') return;

    this.draftByMonth = new Map(this.draftByMonth);

    if (target.rrule) {
      const updatedExdate = target.exdate.includes(occurrenceUnix)
        ? target.exdate
        : [...target.exdate, occurrenceUnix];
      const updatedParent: RawMentorTimeslot = {
        ...target,
        exdate: updatedExdate,
      };

      const isFullyEmpty = activeOccurrences(updatedParent).length === 0;

      this.draftByMonth.forEach((mDraft, mKey) => {
        if (mDraft.some((r: RawMentorTimeslot) => r.id === id)) {
          if (isFullyEmpty) {
            fullyRemovedFromSomeMonth = true;
            this.draftByMonth.set(
              mKey,
              mDraft.filter((r: RawMentorTimeslot) => r.id !== id)
            );
          } else {
            this.draftByMonth.set(
              mKey,
              mDraft.map((r: RawMentorTimeslot) =>
                r.id === id ? updatedParent : r
              )
            );
          }
        }
      });
    } else {
      fullyRemovedFromSomeMonth = true;
      this.draftByMonth.set(
        parentMonthKey,
        parentDraft.filter((r: RawMentorTimeslot) => r.id !== id)
      );
    }

    if (fullyRemovedFromSomeMonth && id > 0) {
      this.pendingDeleteByMonth = new Map(this.pendingDeleteByMonth);
      const current = this.pendingDeleteByMonth.get(parentMonthKey) ?? [];
      if (!current.includes(id)) {
        this.pendingDeleteByMonth.set(parentMonthKey, [...current, id]);
      }
    }

    this.draftByMonth.forEach((mDraft, mKey) => {
      if (mDraft.some((r: RawMentorTimeslot) => r.id === id)) {
        this.markDirty(mKey);
      }
    });

    this.emitChange();
  }

  public commit(results: MonthSyncResult[]): void {
    let changed = false;
    for (const r of results) {
      if (r.outcome.ok) {
        if (!changed) {
          this.savedByMonth = new Map(this.savedByMonth);
          this.draftByMonth = new Map(this.draftByMonth);
          this.pendingDeleteByMonth = new Map(this.pendingDeleteByMonth);
          this.dirtyMonths = new Set(this.dirtyMonths);
          changed = true;
        }
        this.savedByMonth.set(r.monthKey, r.outcome.raws);
        this.draftByMonth.set(r.monthKey, r.outcome.raws);
        this.pendingDeleteByMonth.delete(r.monthKey);
        this.dirtyMonths.delete(r.monthKey);
      }
    }
    if (changed) {
      this.emitChange();
    }
  }

  /**
   * Discard drafted edits for the given months, restoring each to `raws`
   * (either freshly refetched, or the last known-saved snapshot as a
   * fallback). Months not listed are left untouched — this is a partial
   * merge, not a wipe; use `clearAll()` to drop every month (e.g. on
   * account switch).
   */
  public reset(reloaded: (readonly [MonthKey, RawMentorTimeslot[]])[]): void {
    this.savedByMonth = new Map(this.savedByMonth);
    this.draftByMonth = new Map(this.draftByMonth);
    this.pendingDeleteByMonth = new Map(this.pendingDeleteByMonth);
    this.dirtyMonths = new Set(this.dirtyMonths);

    for (const [mk, raws] of reloaded) {
      this.savedByMonth.set(mk, raws);
      this.draftByMonth.set(mk, raws);
      this.pendingDeleteByMonth.delete(mk);
      this.dirtyMonths.delete(mk);
    }
    this.emitChange();
  }

  /** Drop every buffered month. Buffers belong to a specific user, so this
   * is for a full account switch — not for discarding a subset of edits
   * (see `reset()`). */
  public clearAll(): void {
    this.savedByMonth = new Map();
    this.draftByMonth = new Map();
    this.pendingDeleteByMonth = new Map();
    this.dirtyMonths = new Set();
    this.emitChange();
  }
}
