import dayjs from 'dayjs';

import type { AsyncReadOptions, AsyncReadResult } from '@/lib/asyncReadManager';
import {
  type MentorScheduleReadModel,
  type ScheduleReadKey,
  scheduleReadModel as defaultScheduleReadModel,
} from '@/lib/mentor-schedule/scheduleReadModel';
import { captureFlowFailure as defaultCaptureFlowFailure } from '@/lib/monitoring';
import {
  type BookingAvailabilityModel,
  type BookingCalendarReader,
  type BookingSlot,
  computeBookingAvailability,
  type MentorScheduleEditor,
  type SlotsSnapshot,
} from '@/lib/profile/bookingAvailability';
import type {
  MonthSyncRequest,
  MonthSyncResult,
  ScheduleMonthRef,
  SyncResult,
} from '@/lib/profile/bookingAvailability/types';
import { MonthDraftStore } from '@/lib/profile/MonthDraftStore';
import { toDateKey } from '@/lib/profile/scheduleFormatters';
import {
  endOfMonthUnix,
  monthKeyFromYearMonth,
  type RawMentorTimeslot,
} from '@/lib/profile/scheduleHelpers';
import {
  type FetchReservationsResult,
  MENTOR_SCHEDULE_RESERVATIONS_TTL_MS,
  type ReservationReadKey,
  type ReservationReadModel,
  reservationReadModel as defaultReservationReadModel,
} from '@/lib/reservation/reservationReadModel';
import {
  loadMonthSchedule as defaultLoadMonthSchedule,
  prefetchMonthSchedule as defaultPrefetchMonthSchedule,
  syncMonths as defaultSyncMonths,
} from '@/services/mentor-schedule/sync';
import {
  fetchAllReservationsForState as defaultFetchAllReservationsForState,
  type ReservationState,
} from '@/services/reservations';
import type { Reservation } from '@/types/reservation';

const RESERVATIONS_READ_OPTIONS: AsyncReadOptions<FetchReservationsResult> = {
  ttlMs: MENTOR_SCHEDULE_RESERVATIONS_TTL_MS,
};

const IDLE_SCHEDULE_READ: AsyncReadResult<RawMentorTimeslot[]> = {
  data: null,
  isLoading: false,
  error: null,
};

const IDLE_RESERVATION_READ: AsyncReadResult<FetchReservationsResult> = {
  data: null,
  isLoading: false,
  error: null,
};

const EMPTY_RESERVATIONS: Reservation[] = [];

export interface MentorScheduleSessionConfig {
  backend: {
    userId: string;
    year?: number;
    /** 1-12 */
    month?: number;
  };
  loginUserId?: string;
  /**
   * Include dates whose only occurrences are already BOOKED in `allowedDates`,
   * so the mentor viewing their own profile can still select a fully-booked
   * date to view/manage the reservation. Mentee/visitor callers must leave
   * this false.
   */
  includeBookedDates?: boolean;
}

export interface MentorScheduleSessionSnapshot {
  /** Sticky: true once any month has resolved. Resets on account switch. */
  loaded: boolean;
  /** Read-only view used by mentees, visitors, and mentors. Always present. */
  reader: BookingCalendarReader;
  /**
   * Draft-mutation view for a mentor managing their own schedule. Non-null
   * only when `loginUserId` matches `backend.userId`.
   */
  editor: MentorScheduleEditor | null;
}

export interface MentorScheduleSessionPorts {
  scheduleReadModel?: MentorScheduleReadModel;
  reservationReadModel?: Pick<
    ReservationReadModel,
    'getSnapshot' | 'set' | 'subscribe' | 'clear'
  >;
  loadMonthSchedule?: (
    ref: ScheduleMonthRef,
    signal?: AbortSignal
  ) => Promise<RawMentorTimeslot[]>;
  prefetchMonthSchedule?: (ref: ScheduleMonthRef) => void;
  syncMonths?: (requests: MonthSyncRequest[]) => Promise<MonthSyncResult[]>;
  fetchAllReservationsForState?: (
    userId: string,
    state: ReservationState,
    endOfMonthUnix: number,
    signal?: AbortSignal
  ) => Promise<Reservation[]>;
  captureFlowFailure?: typeof defaultCaptureFlowFailure;
  /** Wall-clock source in milliseconds (defaults to `() => Date.now()`). */
  nowMs?: () => number;
}

export interface CreateMentorScheduleSessionOptions {
  /**
   * Passive initial configuration used to derive a synchronous initial
   * snapshot (e.g. during React render / SSR) without starting subscriptions,
   * timers, or cache writes until `configure()` runs.
   */
  initialConfig?: MentorScheduleSessionConfig;
}

export interface MentorScheduleSession {
  configure(config: MentorScheduleSessionConfig): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): MentorScheduleSessionSnapshot;
  dispose(): void;
}

interface ResolvedPorts {
  scheduleReadModel: MentorScheduleReadModel;
  reservationReadModel: Pick<
    ReservationReadModel,
    'getSnapshot' | 'set' | 'subscribe' | 'clear'
  >;
  loadMonthSchedule: (
    ref: ScheduleMonthRef,
    signal?: AbortSignal
  ) => Promise<RawMentorTimeslot[]>;
  prefetchMonthSchedule: (ref: ScheduleMonthRef) => void;
  syncMonths: (requests: MonthSyncRequest[]) => Promise<MonthSyncResult[]>;
  fetchAllReservationsForState: (
    userId: string,
    state: ReservationState,
    endOfMonthUnix: number,
    signal?: AbortSignal
  ) => Promise<Reservation[]>;
  captureFlowFailure: typeof defaultCaptureFlowFailure;
  nowMs: () => number;
}

function defaultSelectedDateForMonth(
  nowMs: number,
  year: number,
  month: number
): string {
  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(year, month - 1, 1);
  const anchor = monthStart < today ? today : monthStart;
  return toDateKey(anchor);
}

function isSameScheduleKey(
  a: ScheduleReadKey | null,
  b: ScheduleReadKey | null
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.userId === b.userId && a.year === b.year && a.month === b.month;
}

function isSameReservationKey(
  a: ReservationReadKey | null,
  b: ReservationReadKey | null
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.userId === b.userId &&
    a.state === b.state &&
    a.endOfMonthUnix === b.endOfMonthUnix
  );
}

class MentorScheduleSessionImpl implements MentorScheduleSession {
  private readonly ports: ResolvedPorts;
  private readonly store: MonthDraftStore;
  private readonly listeners = new Set<() => void>();

  private config: MentorScheduleSessionConfig;
  private cursorYear: number;
  private cursorMonth: number;
  private prevBackendYear: number | undefined;
  private prevBackendMonth: number | undefined;
  private prevUserId: string | null = null;

  private loaded = false;
  private nowSec: number;
  private selectedDate: string | null;
  private selectedSlot: BookingSlot | null = null;
  private hasAutoSelected = false;
  private activeReloadCount = 0;
  private activeSaveCount = 0;

  private isConfigured = false;
  private isDisposed = false;
  private batchDepth = 0;
  private suppressStoreListener = false;
  private accountSwitchGen = 0;
  private lifecycleGen = 0;

  private currentScheduleKey: ScheduleReadKey | null = null;
  private unsubSchedule: (() => void) | null = null;
  private scheduleReadState: AsyncReadResult<RawMentorTimeslot[]> =
    IDLE_SCHEDULE_READ;

  private currentUpcomingKey: ReservationReadKey | null = null;
  private unsubUpcoming: (() => void) | null = null;
  private upcomingReadState: AsyncReadResult<FetchReservationsResult> =
    IDLE_RESERVATION_READ;

  private currentPendingKey: ReservationReadKey | null = null;
  private unsubPending: (() => void) | null = null;
  private pendingReadState: AsyncReadResult<FetchReservationsResult> =
    IDLE_RESERVATION_READ;

  private lastPrefetchKey: string | null = null;
  private prefetchTimer: ReturnType<typeof setTimeout> | null = null;

  // Memoized derived sub-structures for referential stability in useSyncExternalStore
  private memoDraftRows: RawMentorTimeslot[] | null = null;
  private memoNowSec: number | null = null;
  private memoIncludeBookedDates: boolean | null = null;
  private memoAvailabilityModel: BookingAvailabilityModel | null = null;

  private memoUpcomingItems: Reservation[] | null = null;
  private memoPendingItems: Reservation[] | null = null;
  private memoReservations: Reservation[] = EMPTY_RESERVATIONS;

  private memoSlotsModel: BookingAvailabilityModel | null = null;
  private memoSlotsDate: string | null | undefined = undefined;
  private memoSlotsReservations: Reservation[] | null = null;
  private memoSlotsMonthLoaded: boolean | null = null;
  private memoSlotsReservationsLoaded: boolean | null = null;
  private memoSlotsSnapshot: SlotsSnapshot | null = null;

  private memoReaderYear: number | null = null;
  private memoReaderMonth: number | null = null;
  private memoReaderSelectedDate: string | null | undefined = undefined;
  private memoReaderSelectedSlot: BookingSlot | null | undefined = undefined;
  private memoReaderModel: BookingAvailabilityModel | null = null;
  private memoReaderSlotsSnapshot: SlotsSnapshot | null = null;
  private memoReaderIsFetching: boolean | null = null;
  private memoReaderHasError: boolean | null = null;
  private memoReader: BookingCalendarReader | null = null;

  private memoEditorModel: BookingAvailabilityModel | null = null;
  private memoEditorSelectedDate: string | null | undefined = undefined;
  private memoEditorReservations: Reservation[] | null = null;
  private memoEditorIsSaving: boolean | null = null;
  private memoEditor: MentorScheduleEditor | null = null;

  private currentSnapshot!: MentorScheduleSessionSnapshot;

  constructor(
    activeConfig?: MentorScheduleSessionConfig,
    ports?: MentorScheduleSessionPorts,
    options?: CreateMentorScheduleSessionOptions
  ) {
    this.ports = {
      scheduleReadModel: ports?.scheduleReadModel ?? defaultScheduleReadModel,
      reservationReadModel:
        ports?.reservationReadModel ?? defaultReservationReadModel,
      loadMonthSchedule: ports?.loadMonthSchedule ?? defaultLoadMonthSchedule,
      prefetchMonthSchedule:
        ports?.prefetchMonthSchedule ?? defaultPrefetchMonthSchedule,
      syncMonths: ports?.syncMonths ?? defaultSyncMonths,
      fetchAllReservationsForState:
        ports?.fetchAllReservationsForState ??
        defaultFetchAllReservationsForState,
      captureFlowFailure:
        ports?.captureFlowFailure ?? defaultCaptureFlowFailure,
      nowMs: ports?.nowMs ?? (() => Date.now()),
    };

    this.store = new MonthDraftStore(undefined, {
      getCachedMonthSchedule: (ref) => this.ports.scheduleReadModel.get(ref),
    });

    this.store.subscribe(() => {
      if (this.suppressStoreListener || this.isDisposed) return;
      this.commitStateChange();
    });

    const seedConfig = activeConfig ??
      options?.initialConfig ?? {
        backend: { userId: '' },
      };

    const initNowMs = this.ports.nowMs();
    const initDate = new Date(initNowMs);

    this.config = {
      backend: {
        userId: seedConfig.backend.userId,
        year: seedConfig.backend.year,
        month: seedConfig.backend.month,
      },
      loginUserId: seedConfig.loginUserId,
      includeBookedDates: seedConfig.includeBookedDates ?? false,
    };

    this.cursorYear = seedConfig.backend.year ?? initDate.getFullYear();
    this.cursorMonth = seedConfig.backend.month ?? initDate.getMonth() + 1;
    this.prevBackendYear = seedConfig.backend.year;
    this.prevBackendMonth = seedConfig.backend.month;
    this.nowSec = Math.floor(initNowMs / 1000);
    this.selectedDate = dayjs(initNowMs).format('YYYY-MM-DD');

    if (activeConfig) {
      this.configure(activeConfig);
    } else if (options?.initialConfig) {
      this.seedPassiveInitialState(options.initialConfig);
      this.currentSnapshot = this.computeNextSnapshot();
    } else {
      this.currentSnapshot = this.computeNextSnapshot();
    }
  }

  private getActiveYear(): number {
    return this.config.backend.year ?? this.cursorYear;
  }

  private getActiveMonth(): number {
    return this.config.backend.month ?? this.cursorMonth;
  }

  private getIsOwner(): boolean {
    return (
      Boolean(this.config.loginUserId) &&
      this.config.loginUserId === this.config.backend.userId
    );
  }

  private mirrorMonthIntoStore(
    monthKey: string,
    raws: RawMentorTimeslot[]
  ): void {
    if (this.store.snapshot().savedByMonth.get(monthKey) === raws) {
      return;
    }
    this.suppressStoreListener = true;
    try {
      this.store.reloadMonth(monthKey, raws);
    } finally {
      this.suppressStoreListener = false;
    }
  }

  /**
   * Read-only cache inspection for passive render/SSR initialization.
   * Never starts network requests, timers, or writes to shared singletons.
   */
  private seedPassiveInitialState(config: MentorScheduleSessionConfig): void {
    this.prevUserId = config.backend.userId;
    const initialYear = this.getActiveYear();
    const initialMonth = this.getActiveMonth();

    if (config.backend.userId && initialYear && initialMonth) {
      const scheduleKey: ScheduleReadKey = {
        userId: config.backend.userId,
        year: initialYear,
        month: initialMonth,
      };
      this.currentScheduleKey = scheduleKey;
      const cachedRaws = this.ports.scheduleReadModel.get(scheduleKey);
      if (cachedRaws !== undefined) {
        this.scheduleReadState = {
          data: cachedRaws,
          isLoading: false,
          error: null,
        };
        this.mirrorMonthIntoStore(
          monthKeyFromYearMonth(initialYear, initialMonth),
          cachedRaws
        );
        this.loaded = true;
        this.maybeAutoSelectEarliestDate();

        const jumpedYear = this.getActiveYear();
        const jumpedMonth = this.getActiveMonth();
        if (
          jumpedYear &&
          jumpedMonth &&
          (jumpedYear !== initialYear || jumpedMonth !== initialMonth)
        ) {
          const jumpedScheduleKey: ScheduleReadKey = {
            userId: config.backend.userId,
            year: jumpedYear,
            month: jumpedMonth,
          };
          this.currentScheduleKey = jumpedScheduleKey;
          const jumpedCachedRaws =
            this.ports.scheduleReadModel.get(jumpedScheduleKey);
          if (jumpedCachedRaws !== undefined) {
            this.scheduleReadState = {
              data: jumpedCachedRaws,
              isLoading: false,
              error: null,
            };
            this.mirrorMonthIntoStore(
              monthKeyFromYearMonth(jumpedYear, jumpedMonth),
              jumpedCachedRaws
            );
          } else {
            this.scheduleReadState = {
              data: null,
              isLoading: true,
              error: null,
            };
          }
        }
      } else {
        this.scheduleReadState = {
          data: null,
          isLoading: true,
          error: null,
        };
      }
    }

    const activeYear = this.getActiveYear();
    const activeMonth = this.getActiveMonth();
    if (this.getIsOwner() && config.loginUserId && activeYear && activeMonth) {
      const monthEnd = endOfMonthUnix(activeYear, activeMonth);
      const upcomingKey: ReservationReadKey = {
        userId: config.loginUserId,
        state: 'MENTOR_UPCOMING',
        endOfMonthUnix: monthEnd,
      };
      const pendingKey: ReservationReadKey = {
        userId: config.loginUserId,
        state: 'MENTOR_PENDING',
        endOfMonthUnix: monthEnd,
      };
      this.currentUpcomingKey = upcomingKey;
      this.currentPendingKey = pendingKey;

      const cachedUpcoming =
        this.ports.reservationReadModel.getSnapshot(upcomingKey);
      this.upcomingReadState =
        cachedUpcoming !== undefined
          ? { data: cachedUpcoming.value, isLoading: false, error: null }
          : { data: null, isLoading: true, error: null };

      const cachedPending =
        this.ports.reservationReadModel.getSnapshot(pendingKey);
      this.pendingReadState =
        cachedPending !== undefined
          ? { data: cachedPending.value, isLoading: false, error: null }
          : { data: null, isLoading: true, error: null };
    }
  }

  public configure(nextConfig: MentorScheduleSessionConfig): void {
    const wasDisposed = this.isDisposed;
    this.isDisposed = false;
    this.isConfigured = true;

    this.runInBatch(() => {
      const nextUserId = nextConfig.backend.userId;

      if (this.prevUserId !== null && this.prevUserId !== nextUserId) {
        this.teardownSubscriptions();
        this.clearPrefetchTimer();
        this.accountSwitchGen += 1;
        this.ports.scheduleReadModel.clear();
        this.ports.reservationReadModel.clear();
        this.suppressStoreListener = true;
        try {
          this.store.clearAll();
        } finally {
          this.suppressStoreListener = false;
        }
        const switchNowMs = this.ports.nowMs();
        const switchDate = new Date(switchNowMs);
        this.loaded = false;
        this.activeReloadCount = 0;
        this.activeSaveCount = 0;
        this.nowSec = Math.floor(switchNowMs / 1000);
        this.cursorYear = nextConfig.backend.year ?? switchDate.getFullYear();
        this.cursorMonth =
          nextConfig.backend.month ?? switchDate.getMonth() + 1;
        this.selectedDate = defaultSelectedDateForMonth(
          switchNowMs,
          this.cursorYear,
          this.cursorMonth
        );
        this.selectedSlot = null;
        this.hasAutoSelected = false;
        this.scheduleReadState = IDLE_SCHEDULE_READ;
        this.upcomingReadState = IDLE_RESERVATION_READ;
        this.pendingReadState = IDLE_RESERVATION_READ;
      }
      this.prevUserId = nextUserId;

      if (
        nextConfig.backend.year !== undefined &&
        nextConfig.backend.year !== this.prevBackendYear
      ) {
        this.cursorYear = nextConfig.backend.year;
        this.selectedSlot = null;
      }
      if (
        nextConfig.backend.month !== undefined &&
        nextConfig.backend.month !== this.prevBackendMonth
      ) {
        this.cursorMonth = nextConfig.backend.month;
        this.selectedSlot = null;
      }
      this.prevBackendYear = nextConfig.backend.year;
      this.prevBackendMonth = nextConfig.backend.month;

      this.config = {
        backend: {
          userId: nextConfig.backend.userId,
          year: nextConfig.backend.year,
          month: nextConfig.backend.month,
        },
        loginUserId: nextConfig.loginUserId,
        includeBookedDates: nextConfig.includeBookedDates ?? false,
      };

      this.syncSubscriptions(wasDisposed);
      this.maybeAutoSelectEarliestDate();
      this.syncNextMonthPrefetch();
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): MentorScheduleSessionSnapshot {
    return this.currentSnapshot;
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.lifecycleGen += 1;
    this.activeReloadCount = 0;
    this.teardownSubscriptions();
    this.clearPrefetchTimer();
  }

  private runInBatch(fn: () => void): void {
    this.batchDepth += 1;
    try {
      fn();
    } finally {
      this.batchDepth -= 1;
      if (this.batchDepth === 0 && !this.isDisposed) {
        this.commitStateChange();
      }
    }
  }

  private teardownSubscriptions(): void {
    if (this.unsubSchedule) {
      const unsub = this.unsubSchedule;
      this.unsubSchedule = null;
      unsub();
    }
    this.currentScheduleKey = null;

    if (this.unsubUpcoming) {
      const unsub = this.unsubUpcoming;
      this.unsubUpcoming = null;
      unsub();
    }
    this.currentUpcomingKey = null;

    if (this.unsubPending) {
      const unsub = this.unsubPending;
      this.unsubPending = null;
      unsub();
    }
    this.currentPendingKey = null;
  }

  private clearPrefetchTimer(): void {
    if (this.prefetchTimer !== null) {
      clearTimeout(this.prefetchTimer);
      this.prefetchTimer = null;
    }
    this.lastPrefetchKey = null;
  }

  private syncNextMonthPrefetch(): void {
    const userId = this.config.backend.userId;
    const activeYear = this.getActiveYear();
    const activeMonth = this.getActiveMonth();

    if (
      this.isDisposed ||
      !this.isConfigured ||
      !this.loaded ||
      !userId ||
      !activeYear ||
      !activeMonth
    ) {
      this.clearPrefetchTimer();
      return;
    }

    const prefetchKey = `${userId}_${activeYear}_${activeMonth}`;
    if (prefetchKey === this.lastPrefetchKey) {
      return;
    }

    if (this.prefetchTimer !== null) {
      clearTimeout(this.prefetchTimer);
      this.prefetchTimer = null;
    }
    this.lastPrefetchKey = prefetchKey;

    const next = dayjs(new Date(activeYear, activeMonth - 1, 1)).add(
      1,
      'month'
    );
    const nextRef: ScheduleMonthRef = {
      userId,
      year: next.year(),
      month: next.month() + 1,
    };

    this.prefetchTimer = setTimeout(() => {
      this.prefetchTimer = null;
      if (this.isDisposed) return;
      this.ports.prefetchMonthSchedule(nextRef);
    }, 0);
  }

  private syncSubscriptions(forceResubscribe = false): void {
    if (this.isDisposed || !this.isConfigured) return;

    const userId = this.config.backend.userId;
    const activeYear = this.getActiveYear();
    const activeMonth = this.getActiveMonth();

    // 1. Schedule subscription
    const nextScheduleKey: ScheduleReadKey | null =
      userId && activeYear && activeMonth
        ? { userId, year: activeYear, month: activeMonth }
        : null;

    const needsScheduleSub =
      forceResubscribe ||
      !isSameScheduleKey(this.currentScheduleKey, nextScheduleKey) ||
      (nextScheduleKey !== null && this.unsubSchedule === null);

    if (needsScheduleSub) {
      if (this.unsubSchedule) {
        const unsub = this.unsubSchedule;
        this.unsubSchedule = null;
        unsub();
      }
      this.currentScheduleKey = nextScheduleKey;

      if (nextScheduleKey === null) {
        this.scheduleReadState = IDLE_SCHEDULE_READ;
      } else {
        const subscribedKey = nextScheduleKey;
        const monthKey = monthKeyFromYearMonth(
          subscribedKey.year,
          subscribedKey.month
        );
        this.unsubSchedule = this.ports.scheduleReadModel.subscribe(
          subscribedKey,
          (signal) => this.ports.loadMonthSchedule(subscribedKey, signal),
          (result) => {
            if (
              this.isDisposed ||
              !isSameScheduleKey(this.currentScheduleKey, subscribedKey)
            ) {
              return;
            }
            this.runInBatch(() => {
              this.scheduleReadState = result;
              if (result.data !== null) {
                this.mirrorMonthIntoStore(monthKey, result.data);
              }
              if (result.data !== null || result.error !== null) {
                this.loaded = true;
              }
              this.maybeAutoSelectEarliestDate();
              this.syncNextMonthPrefetch();
            });
          }
        );
      }
    }

    // 2. Month-scoped MENTOR_UPCOMING + MENTOR_PENDING subscriptions (30s TTL)
    const activeYearAfterSchedule = this.getActiveYear();
    const activeMonthAfterSchedule = this.getActiveMonth();
    const reservationsActive =
      this.getIsOwner() &&
      Boolean(this.config.loginUserId) &&
      Boolean(activeYearAfterSchedule) &&
      Boolean(activeMonthAfterSchedule);

    const monthEndUnix = reservationsActive
      ? endOfMonthUnix(activeYearAfterSchedule, activeMonthAfterSchedule)
      : 0;

    const nextUpcomingKey: ReservationReadKey | null =
      reservationsActive && this.config.loginUserId
        ? {
            userId: this.config.loginUserId,
            state: 'MENTOR_UPCOMING',
            endOfMonthUnix: monthEndUnix,
          }
        : null;

    const nextPendingKey: ReservationReadKey | null =
      reservationsActive && this.config.loginUserId
        ? {
            userId: this.config.loginUserId,
            state: 'MENTOR_PENDING',
            endOfMonthUnix: monthEndUnix,
          }
        : null;

    const needsUpcomingSub =
      forceResubscribe ||
      !isSameReservationKey(this.currentUpcomingKey, nextUpcomingKey) ||
      (nextUpcomingKey !== null && this.unsubUpcoming === null);

    if (needsUpcomingSub) {
      if (this.unsubUpcoming) {
        const unsub = this.unsubUpcoming;
        this.unsubUpcoming = null;
        unsub();
      }
      this.currentUpcomingKey = nextUpcomingKey;

      if (nextUpcomingKey === null) {
        this.upcomingReadState = IDLE_RESERVATION_READ;
      } else {
        const subscribedKey = nextUpcomingKey;
        this.unsubUpcoming = this.ports.reservationReadModel.subscribe(
          subscribedKey,
          async (signal) => {
            const items = await this.ports.fetchAllReservationsForState(
              subscribedKey.userId,
              'MENTOR_UPCOMING',
              subscribedKey.endOfMonthUnix!,
              signal
            );
            return { items, next_dtend: 0 };
          },
          (result) => {
            if (
              this.isDisposed ||
              !isSameReservationKey(this.currentUpcomingKey, subscribedKey)
            ) {
              return;
            }
            this.runInBatch(() => {
              this.upcomingReadState = result;
            });
          },
          RESERVATIONS_READ_OPTIONS
        );
      }
    }

    const needsPendingSub =
      forceResubscribe ||
      !isSameReservationKey(this.currentPendingKey, nextPendingKey) ||
      (nextPendingKey !== null && this.unsubPending === null);

    if (needsPendingSub) {
      if (this.unsubPending) {
        const unsub = this.unsubPending;
        this.unsubPending = null;
        unsub();
      }
      this.currentPendingKey = nextPendingKey;

      if (nextPendingKey === null) {
        this.pendingReadState = IDLE_RESERVATION_READ;
      } else {
        const subscribedKey = nextPendingKey;
        this.unsubPending = this.ports.reservationReadModel.subscribe(
          subscribedKey,
          async (signal) => {
            const items = await this.ports.fetchAllReservationsForState(
              subscribedKey.userId,
              'MENTOR_PENDING',
              subscribedKey.endOfMonthUnix!,
              signal
            );
            return { items, next_dtend: 0 };
          },
          (result) => {
            if (
              this.isDisposed ||
              !isSameReservationKey(this.currentPendingKey, subscribedKey)
            ) {
              return;
            }
            this.runInBatch(() => {
              this.pendingReadState = result;
            });
          },
          RESERVATIONS_READ_OPTIONS
        );
      }
    }
  }

  private getAvailabilityModel(): BookingAvailabilityModel {
    const draftRows = this.store.snapshot().allDraftSlots;
    const includeBookedDates = Boolean(this.config.includeBookedDates);

    if (
      this.memoAvailabilityModel !== null &&
      this.memoDraftRows === draftRows &&
      this.memoNowSec === this.nowSec &&
      this.memoIncludeBookedDates === includeBookedDates
    ) {
      return this.memoAvailabilityModel;
    }

    const model = computeBookingAvailability({
      draftRows,
      nowSec: this.nowSec,
      includeBookedDates,
    });
    this.memoDraftRows = draftRows;
    this.memoNowSec = this.nowSec;
    this.memoIncludeBookedDates = includeBookedDates;
    this.memoAvailabilityModel = model;
    return model;
  }

  private maybeAutoSelectEarliestDate(): void {
    if (!this.loaded || this.hasAutoSelected) return;

    const availabilityModel = this.getAvailabilityModel();
    const firstAllow =
      availabilityModel.earliestSelectableDate ??
      availabilityModel.parsedOccurrences.find((s) => s.type === 'ALLOW')
        ?.dateKey ??
      null;

    if (!firstAllow) return;

    this.hasAutoSelected = true;
    this.selectedDate = firstAllow;
    this.selectedSlot = null;

    const [y, m] = firstAllow.split('-').map(Number);
    if (y && m) {
      const prevActiveYear = this.getActiveYear();
      const prevActiveMonth = this.getActiveMonth();
      this.cursorYear = y;
      this.cursorMonth = m;
      if (
        this.isConfigured &&
        !this.isDisposed &&
        (this.getActiveYear() !== prevActiveYear ||
          this.getActiveMonth() !== prevActiveMonth)
      ) {
        this.syncSubscriptions();
      }
    }
  }

  // --------------------------------------------------------------------
  // Bound reader & editor callbacks
  // --------------------------------------------------------------------

  private readonly setSelectedDate = (nextDate: string | null): void => {
    if (this.isDisposed) return;
    if (this.selectedDate === nextDate && this.selectedSlot === null) return;
    this.selectedDate = nextDate;
    this.selectedSlot = null;
    this.commitStateChange();
  };

  private readonly setSelectedSlot = (nextSlot: BookingSlot | null): void => {
    if (this.isDisposed) return;
    if (this.selectedSlot === nextSlot) return;
    this.selectedSlot = nextSlot;
    this.commitStateChange();
  };

  private readonly handleMonthChange: NonNullable<
    BookingCalendarReader['onMonthChange']
  > = (date, options) => {
    if (this.isDisposed) return;
    this.runInBatch(() => {
      const prevYear = this.getActiveYear();
      const prevMonth = this.getActiveMonth();
      const newYear = date.getFullYear();
      const newMonth = date.getMonth() + 1;
      this.cursorYear = newYear;
      this.cursorMonth = newMonth;

      if (!options?.preserveSelectedDate) {
        this.selectedDate = defaultSelectedDateForMonth(
          this.ports.nowMs(),
          newYear,
          newMonth
        );
        this.selectedSlot = null;
      } else if (newYear !== prevYear || newMonth !== prevMonth) {
        this.selectedSlot = null;
      }

      this.syncSubscriptions();
      this.syncNextMonthPrefetch();
    });
  };

  private readonly clampSelectedDateToToday = (): void => {
    if (this.isDisposed || !this.selectedDate) return;
    const sel = new Date(this.selectedDate + 'T00:00:00');
    const today = new Date(this.ports.nowMs());
    today.setHours(0, 0, 0, 0);
    if (sel < today) {
      this.runInBatch(() => {
        this.selectedDate = toDateKey(today);
        this.selectedSlot = null;
        const todayYear = today.getFullYear();
        const todayMonth = today.getMonth() + 1;
        if (
          todayYear !== this.getActiveYear() ||
          todayMonth !== this.getActiveMonth()
        ) {
          this.cursorYear = todayYear;
          this.cursorMonth = todayMonth;
          this.syncSubscriptions();
          this.syncNextMonthPrefetch();
        }
      });
    }
  };

  private readonly getDayBookingStatus: BookingCalendarReader['getDayBookingStatus'] =
    (dateKey) => {
      return (
        this.getAvailabilityModel().bookingStatusByDate.get(dateKey) ?? null
      );
    };

  private readonly addSlotForSelectedDate: MentorScheduleEditor['addSlotForSelectedDate'] =
    ({ startTime, durationMinutes, weeklyWithinMonth }) => {
      if (!this.selectedDate) {
        return { success: false, reason: 'NO_DATE_SELECTED' };
      }
      return this.store.add({
        startTime,
        durationMinutes,
        weeklyWithinMonth,
        selectedDate: this.selectedDate,
      });
    };

  private readonly updateDraftSlot: MentorScheduleEditor['updateDraftSlot'] = (
    id,
    occurrenceUnix,
    patch
  ) => {
    return this.store.edit(
      id,
      occurrenceUnix,
      patch,
      this.config.backend.userId
    );
  };

  private readonly deleteDraftSlot: MentorScheduleEditor['deleteDraftSlot'] = (
    id,
    occurrenceUnix
  ) => {
    this.store.delete(id, occurrenceUnix);
  };

  private readonly confirmChanges: MentorScheduleEditor['confirmChanges'] =
    async (): Promise<SyncResult> => {
      const userId = this.config.backend.userId;
      if (!userId || this.store.snapshot().dirtyMonths.size === 0) {
        return { ok: true, committedMonthKeys: [] };
      }

      const accountGenAtStart = this.accountSwitchGen;
      const refByMonthKey = new Map<string, ScheduleMonthRef>();
      let capturedResults: MonthSyncResult[] = [];

      this.activeSaveCount += 1;
      this.commitStateChange();

      try {
        return await this.store.commitChanges(userId, async (requests) => {
          for (const req of requests) {
            refByMonthKey.set(
              monthKeyFromYearMonth(req.ref.year, req.ref.month),
              req.ref
            );
          }
          const results = await this.ports.syncMonths(requests);
          capturedResults = results;
          return results;
        });
      } finally {
        if (this.accountSwitchGen === accountGenAtStart) {
          this.runInBatch(() => {
            for (const res of capturedResults) {
              if (!res.outcome.ok) continue;
              const ref = refByMonthKey.get(res.monthKey);
              if (!ref) continue;
              if (this.ports.scheduleReadModel.get(ref) !== res.outcome.raws) {
                this.ports.scheduleReadModel.set(ref, res.outcome.raws);
              }
              if (
                this.store.snapshot().savedByMonth.get(res.monthKey) !==
                res.outcome.raws
              ) {
                this.mirrorMonthIntoStore(res.monthKey, res.outcome.raws);
              }
            }
            this.activeSaveCount = Math.max(0, this.activeSaveCount - 1);
          });
        }
      }
    };

  private readonly resetChanges: MentorScheduleEditor['resetChanges'] = () => {
    if (this.activeSaveCount > 0) {
      return;
    }
    this.store.discardChanges();
  };

  private async reloadReservations(): Promise<void> {
    const upcomingKey = this.currentUpcomingKey;
    const pendingKey = this.currentPendingKey;
    const loginUserId = this.config.loginUserId;
    if (
      !upcomingKey ||
      !pendingKey ||
      !loginUserId ||
      upcomingKey.endOfMonthUnix === undefined
    ) {
      return;
    }

    const monthEndUnix = upcomingKey.endOfMonthUnix;
    const accountGenAtStart = this.accountSwitchGen;
    const lifecycleGenAtStart = this.lifecycleGen;

    try {
      const [upcoming, pending] = await Promise.all([
        this.ports.fetchAllReservationsForState(
          loginUserId,
          'MENTOR_UPCOMING',
          monthEndUnix
        ),
        this.ports.fetchAllReservationsForState(
          loginUserId,
          'MENTOR_PENDING',
          monthEndUnix
        ),
      ]);
      if (
        this.isDisposed ||
        this.accountSwitchGen !== accountGenAtStart ||
        this.lifecycleGen !== lifecycleGenAtStart
      ) {
        return;
      }
      this.ports.reservationReadModel.set(
        upcomingKey,
        { items: upcoming, next_dtend: 0 },
        MENTOR_SCHEDULE_RESERVATIONS_TTL_MS
      );
      this.ports.reservationReadModel.set(
        pendingKey,
        { items: pending, next_dtend: 0 },
        MENTOR_SCHEDULE_RESERVATIONS_TTL_MS
      );
    } catch {
      // Swallowed intentionally: fetchAllReservationsForState already reports
      // non-abort failures via captureFlowFailure, and a failed reload leaves
      // whatever was previously cached untouched rather than rejecting reload().
    }
  }

  private async reloadSchedule(scheduleKey: ScheduleReadKey): Promise<void> {
    const accountGenAtStart = this.accountSwitchGen;
    const lifecycleGenAtStart = this.lifecycleGen;

    this.activeReloadCount += 1;
    this.commitStateChange();

    try {
      const published = await this.ports.scheduleReadModel.refresh(
        scheduleKey,
        (signal) => this.ports.loadMonthSchedule(scheduleKey, signal)
      );
      if (
        this.isDisposed ||
        this.accountSwitchGen !== accountGenAtStart ||
        this.lifecycleGen !== lifecycleGenAtStart
      ) {
        return;
      }
      if (published !== null) {
        this.nowSec = Math.floor(this.ports.nowMs() / 1000);
      }
      if (published?.error) {
        void this.ports.captureFlowFailure({
          flow: 'mentor_schedule_reload_schedule',
          step: 'reload_month_schedule_fresh',
          message: published.error,
          level: 'warning',
        });
      }
    } finally {
      if (
        !this.isDisposed &&
        this.accountSwitchGen === accountGenAtStart &&
        this.lifecycleGen === lifecycleGenAtStart
      ) {
        this.activeReloadCount = Math.max(0, this.activeReloadCount - 1);
        this.commitStateChange();
      }
    }
  }

  private readonly reload = async (): Promise<void> => {
    const scheduleKey = this.currentScheduleKey;
    if (!scheduleKey || this.isDisposed) return;
    await Promise.all([
      this.reloadReservations(),
      this.reloadSchedule(scheduleKey),
    ]);
  };

  // --------------------------------------------------------------------
  // Snapshot derivation & notification
  // --------------------------------------------------------------------

  private getReservations(): Reservation[] {
    const upcomingItems = this.upcomingReadState.data?.items ?? null;
    const pendingItems = this.pendingReadState.data?.items ?? null;

    if (
      this.memoUpcomingItems === upcomingItems &&
      this.memoPendingItems === pendingItems
    ) {
      return this.memoReservations;
    }

    this.memoUpcomingItems = upcomingItems;
    this.memoPendingItems = pendingItems;
    this.memoReservations =
      upcomingItems === null && pendingItems === null
        ? EMPTY_RESERVATIONS
        : [...(upcomingItems ?? []), ...(pendingItems ?? [])];
    return this.memoReservations;
  }

  private computeNextSnapshot(): MentorScheduleSessionSnapshot {
    this.maybeAutoSelectEarliestDate();

    const activeYear = this.getActiveYear();
    const activeMonth = this.getActiveMonth();
    const isOwner = this.getIsOwner();

    const isReloadingSchedule = this.activeReloadCount > 0;
    const monthLoaded =
      this.currentScheduleKey !== null &&
      !this.scheduleReadState.isLoading &&
      !isReloadingSchedule;
    const isFetching = this.scheduleReadState.isLoading || isReloadingSchedule;
    const hasError =
      !isReloadingSchedule && this.scheduleReadState.error !== null;

    const reservationsLoaded =
      this.currentUpcomingKey === null || this.currentPendingKey === null
        ? true
        : this.upcomingReadState.data !== null &&
          this.pendingReadState.data !== null;

    const availabilityModel = this.getAvailabilityModel();
    const reservations = this.getReservations();

    let slotsSnapshot = this.memoSlotsSnapshot;
    if (
      slotsSnapshot === null ||
      this.memoSlotsModel !== availabilityModel ||
      this.memoSlotsDate !== this.selectedDate ||
      this.memoSlotsReservations !== reservations ||
      this.memoSlotsMonthLoaded !== monthLoaded ||
      this.memoSlotsReservationsLoaded !== reservationsLoaded
    ) {
      slotsSnapshot = {
        slots: this.selectedDate
          ? availabilityModel.generateBookingSlots(
              this.selectedDate,
              reservations
            )
          : [],
        monthLoaded,
        reservationsLoaded,
      };
      this.memoSlotsModel = availabilityModel;
      this.memoSlotsDate = this.selectedDate;
      this.memoSlotsReservations = reservations;
      this.memoSlotsMonthLoaded = monthLoaded;
      this.memoSlotsReservationsLoaded = reservationsLoaded;
      this.memoSlotsSnapshot = slotsSnapshot;
    }

    if (this.selectedSlot !== null) {
      if (!this.selectedDate) {
        this.selectedSlot = null;
      } else if (monthLoaded) {
        const selStart = this.selectedSlot.start.getTime();
        const selEnd = this.selectedSlot.end.getTime();
        const matchingSlot = slotsSnapshot.slots.find(
          (s) =>
            s.start.getTime() === selStart &&
            s.end.getTime() === selEnd &&
            !s.isBooked &&
            s.status === null
        );
        this.selectedSlot = matchingSlot ?? null;
      }
    }

    let reader = this.memoReader;
    if (
      reader === null ||
      this.memoReaderYear !== activeYear ||
      this.memoReaderMonth !== activeMonth ||
      this.memoReaderSelectedDate !== this.selectedDate ||
      this.memoReaderSelectedSlot !== this.selectedSlot ||
      this.memoReaderModel !== availabilityModel ||
      this.memoReaderSlotsSnapshot !== slotsSnapshot ||
      this.memoReaderIsFetching !== isFetching ||
      this.memoReaderHasError !== hasError
    ) {
      reader = {
        year: activeYear,
        month: activeMonth,
        selectedDate: this.selectedDate,
        setSelectedDate: this.setSelectedDate,
        selectedSlot: this.selectedSlot,
        setSelectedSlot: this.setSelectedSlot,
        onMonthChange: this.handleMonthChange,
        clampSelectedDateToToday: this.clampSelectedDateToToday,
        allowedDates: availabilityModel.allowedDates,
        availableDates: availabilityModel.availableDates,
        bookedDates: availabilityModel.bookedDates,
        earliestSelectableDate: availabilityModel.earliestSelectableDate,
        slotsSnapshot,
        getDayBookingStatus: this.getDayBookingStatus,
        isFetching,
        reload: this.reload,
        hasError,
      };
      this.memoReaderYear = activeYear;
      this.memoReaderMonth = activeMonth;
      this.memoReaderSelectedDate = this.selectedDate;
      this.memoReaderSelectedSlot = this.selectedSlot;
      this.memoReaderModel = availabilityModel;
      this.memoReaderSlotsSnapshot = slotsSnapshot;
      this.memoReaderIsFetching = isFetching;
      this.memoReaderHasError = hasError;
      this.memoReader = reader;
    }

    const isSaving = this.activeSaveCount > 0;
    let editor: MentorScheduleEditor | null = null;
    if (isOwner) {
      if (
        this.memoEditor !== null &&
        this.memoEditorModel === availabilityModel &&
        this.memoEditorSelectedDate === this.selectedDate &&
        this.memoEditorReservations === reservations &&
        this.memoEditorIsSaving === isSaving
      ) {
        editor = this.memoEditor;
      } else {
        const draftForSelectedDate = this.selectedDate
          ? availabilityModel.getOccurrencesForDate(this.selectedDate)
          : availabilityModel.parsedOccurrences;
        const { slotsWithMeta, futureSlots } =
          availabilityModel.projectEditorSlots(this.selectedDate, reservations);
        editor = {
          draftForSelectedDate,
          draftOccurrences: availabilityModel.parsedOccurrences,
          slotsWithMeta,
          futureSlots,
          isSaving,
          addSlotForSelectedDate: this.addSlotForSelectedDate,
          updateDraftSlot: this.updateDraftSlot,
          deleteDraftSlot: this.deleteDraftSlot,
          confirmChanges: this.confirmChanges,
          resetChanges: this.resetChanges,
          reservations,
        };
        this.memoEditorModel = availabilityModel;
        this.memoEditorSelectedDate = this.selectedDate;
        this.memoEditorReservations = reservations;
        this.memoEditorIsSaving = isSaving;
        this.memoEditor = editor;
      }
    }

    if (
      this.currentSnapshot &&
      this.currentSnapshot.loaded === this.loaded &&
      this.currentSnapshot.reader === reader &&
      this.currentSnapshot.editor === editor
    ) {
      return this.currentSnapshot;
    }

    return {
      loaded: this.loaded,
      reader,
      editor,
    };
  }

  private commitStateChange(): void {
    if (this.isDisposed) return;
    const nextSnapshot = this.computeNextSnapshot();
    if (nextSnapshot === this.currentSnapshot) {
      return;
    }
    this.currentSnapshot = nextSnapshot;
    Array.from(this.listeners).forEach((listener) => {
      if (this.listeners.has(listener) && !this.isDisposed) {
        listener();
      }
    });
  }
}

export function createMentorScheduleSession(
  config?: MentorScheduleSessionConfig,
  ports?: MentorScheduleSessionPorts,
  options?: CreateMentorScheduleSessionOptions
): MentorScheduleSession {
  return new MentorScheduleSessionImpl(config, ports, options);
}
