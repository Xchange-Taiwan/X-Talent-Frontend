import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
dayjs.extend(isSameOrBefore);

import {
  activeOccurrences,
  buildDateTime,
  checkCrossMonthOverlap,
  findRestorableExdatedRow,
  hasAnyOccurrenceOverlap,
  MonthKey,
  monthKeyFromDateStr,
  monthKeyFromUnix,
  nextTempId,
  parseMonthKey,
  RawMentorTimeslot,
} from '@/lib/profile/scheduleHelpers';
import { MonthSyncResult } from '@/services/mentor-schedule/sync';

export type SlotDurationMinutes = 30 | 45 | 60;

export type UpdateDraftSlotResult = {
  success: boolean;
  reason?: 'OVERLAP' | 'TARGET_MONTH_NOT_LOADED';
};

export interface MonthDraftStoreSnapshot {
  savedByMonth: Map<MonthKey, RawMentorTimeslot[]>;
  draftByMonth: Map<MonthKey, RawMentorTimeslot[]>;
  pendingDeleteByMonth: Map<MonthKey, number[]>;
  dirtyMonths: Set<MonthKey>;
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
      };
    }
    return this.currentSnapshot;
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

  public edit(
    id: number,
    occurrenceUnix: number,
    patch: {
      startTime?: string;
      durationMinutes?: SlotDurationMinutes;
      weeklyWithinMonth?: boolean;
      selectedDate?: string;
    },
    userId: string
  ): UpdateDraftSlotResult & { added?: number; skipped?: number } {
    // 1. Handle adding a new slot if id is 0 (special internal routing to satisfy strict interface constraint)
    if (id === 0) {
      const { startTime, durationMinutes, weeklyWithinMonth, selectedDate } =
        patch;
      if (!selectedDate || !startTime || !durationMinutes) {
        return { success: false, added: 0, skipped: 0 };
      }

      const startDayjs = buildDateTime(selectedDate, startTime);
      if (!startDayjs.isValid())
        return { success: false, added: 0, skipped: 0 };

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
        hasAnyOccurrenceOverlap(
          prev,
          null,
          candidateOccurrences,
          durationSeconds
        )
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

    // 2. Standard Edit behavior
    const parentMonthKey = this.findMonthForSlotId(id);
    if (!parentMonthKey) return { success: false };

    const parentDraft = this.draftByMonth.get(parentMonthKey) ?? [];
    const target = parentDraft.find((r) => r.id === id);
    if (!target) return { success: false };

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

  public reset(reloaded: (readonly [MonthKey, RawMentorTimeslot[]])[]): void {
    this.savedByMonth = new Map(this.savedByMonth);
    this.draftByMonth = new Map(this.draftByMonth);
    this.pendingDeleteByMonth = new Map(this.pendingDeleteByMonth);
    this.dirtyMonths = new Set(this.dirtyMonths);

    if (reloaded.length === 0) {
      this.savedByMonth.clear();
      this.draftByMonth.clear();
      this.pendingDeleteByMonth.clear();
      this.dirtyMonths.clear();
    } else {
      for (const [mk, raws] of reloaded) {
        this.savedByMonth.set(mk, raws);
        this.draftByMonth.set(mk, raws);
        this.pendingDeleteByMonth.delete(mk);
        this.dirtyMonths.delete(mk);
      }
    }
    this.emitChange();
  }
}
