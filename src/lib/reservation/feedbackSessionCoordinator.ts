import { isFeedbackEnabled } from '@/lib/featureFlags';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  canEditReservationFeedback,
  canSubmitReservationFeedback,
  hasExpandableMentorFeedback,
  isEligibleForPendingFeedbackQueue,
  isMenteeSessionMarkedNotHappened,
  isReservationCancelled,
} from '@/lib/reservation/reservationLifecyclePolicy';
import {
  normalizeReservationViewerRole,
  sortPendingFeedbackOldestFirst,
} from '@/lib/reservation/reservationProjection';
import {
  buildCleanedDeepLinkHref,
  buildCleanedFeedbackQueueHref,
  buildReservationHistoryRedirectHref,
  buildReservationHistorySignInCallbackHref,
  buildReservationTabHref,
  extractDeepLinkReservationId,
  isFeedbackQueueQueryRequested,
  type ReservationRouteRole,
} from '@/lib/reservation/reservationRoutes';
import { MENTOR_ONBOARDING_KEY, OPEN_SCHEDULE_DIALOG_KEY } from '@/lib/routes';
import type { Reservation } from '@/types/reservation';

export const PENDING_FEEDBACK_SESSION_PREFIX = 'xtalent:pending-feedback:';
export const DEFAULT_LOOKUP_SEED_TTL_MS = 60_000;
export const MAX_DEEP_LINK_LOAD_MORE_PAGES = 3;

export interface SearchParamReadable {
  get(name: string): string | null;
}

export interface PendingFeedbackRouteContext {
  pathname: string | null;
  searchParams?: SearchParamReadable | null;
}

export interface SessionPendingFeedbackState {
  checked: boolean;
  dismissed: boolean;
  queueEmpty: boolean;
  submittedIds: string[];
  skippedIds: string[];
}

export interface FeedbackSessionStoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

export interface SeededReservationLookup {
  viewerRole: ReservationRouteRole;
  reservation: Reservation;
}

export interface FeedbackSessionLookupPort {
  fetchPendingFeedbackReservations?: (opts: {
    userId: string;
    fallbackViewerRole: 'MENTOR' | 'MENTEE';
    signal?: AbortSignal;
  }) => Promise<Reservation[]>;
  fetchSingleReservationFeedback?: (opts: {
    userId: string;
    reservationId: string;
    fallbackRole: ReservationRouteRole;
    signal?: AbortSignal;
  }) => Promise<SeededReservationLookup | null>;
}

export interface InMemoryFeedbackSessionLookupCalls {
  fetchPendingFeedbackReservations: Array<{
    userId: string;
    fallbackViewerRole: 'MENTOR' | 'MENTEE';
    signal?: AbortSignal;
  }>;
  fetchSingleReservationFeedback: Array<{
    userId: string;
    reservationId: string;
    fallbackRole: ReservationRouteRole;
    signal?: AbortSignal;
  }>;
}

export interface InMemoryFeedbackSessionLookupOptions {
  pendingReservations?:
    | readonly Reservation[]
    | ((opts: {
        userId: string;
        fallbackViewerRole: 'MENTOR' | 'MENTEE';
        signal?: AbortSignal;
      }) => Promise<Reservation[]> | Reservation[]);
  singleReservations?:
    | Record<string, SeededReservationLookup | null>
    | ((opts: {
        userId: string;
        reservationId: string;
        fallbackRole: ReservationRouteRole;
        signal?: AbortSignal;
      }) =>
        | Promise<SeededReservationLookup | null>
        | SeededReservationLookup
        | null);
}

export interface InMemoryFeedbackSessionLookupPort extends FeedbackSessionLookupPort {
  readonly calls: InMemoryFeedbackSessionLookupCalls;
}

export type FeedbackAuthStatus =
  'loading' | 'authenticated' | 'unauthenticated';

export interface ReconcileLoginSessionOptions {
  authStatus: FeedbackAuthStatus;
  userId?: string | null;
  isMentor?: boolean | null;
  isOnboardingComplete?: boolean | null;
  hasSessionError?: boolean;
  route: PendingFeedbackRouteContext;
  feedbackEnabled?: boolean;
  signal?: AbortSignal;
  fetchPending?: FeedbackSessionLookupPort['fetchPendingFeedbackReservations'];
}

export interface ReconcileLoginSessionResult {
  queueItems: Reservation[] | null;
  canPresent: boolean;
  isSuppressed: boolean;
  promptShownCount: number | null;
}

export interface CreateFeedbackSessionCoordinatorOptions {
  storage?: FeedbackSessionStoragePort;
  lookup?: FeedbackSessionLookupPort;
  now?: () => number;
  seedTtlMs?: number;
  onError?: (
    error: unknown,
    context: { step: 'load_login_queue'; userId: string }
  ) => void;
}

type ConsumedLookupSeed =
  { hit: false } | { hit: true; result: SeededReservationLookup | null };

export interface ResolvedHistoryRedirect {
  redirectHref: string;
  resolvedRole: ReservationRouteRole;
  seeded: SeededReservationLookup | null;
}

export type FeedbackDeepLinkResolution =
  | { kind: 'not-found' }
  | { kind: 'mentee-open-dialog'; reservation: Reservation }
  | { kind: 'mentor-open-dialog'; reservation: Reservation }
  | { kind: 'mentee-already-rated'; reservation: Reservation }
  | {
      kind: 'mentee-already-resolved';
      reservation: Reservation;
      reason: 'cancelled' | 'not-happened' | 'completed';
    }
  | {
      kind: 'mentor-locate-card';
      reservation: Reservation;
      shouldExpandFeedback: boolean;
    };

export type HistoryRouteToastKind =
  'already-rated' | 'cancelled' | 'already-resolved' | 'not-found';

export interface HistoryRouteToastCommand {
  kind: HistoryRouteToastKind;
  title: string;
  description: string;
}

export interface HistoryRouteCommands {
  replaceHref: string | null;
  toast: HistoryRouteToastCommand | null;
  shouldLoadMoreHistory: boolean;
}

export interface HistoryRouteState {
  readonly hasDeepLinkTarget: boolean;
  readonly isFeedbackQueueRequested: boolean;
  readonly deepLinkDialogReservation: Reservation | null;
  readonly feedbackQueueItems: Reservation[] | null;
  readonly highlightedReservationId: string | null;
  readonly autoExpandedReservationId: string | null;
  readonly deepLinkTriggerSeq: number;
  readonly isLookingUpSingleReservation: boolean;
}

export interface ReconcileHistoryRouteOptions {
  role: ReservationRouteRole;
  userId?: string | null;
  pathname: string;
  rawSearch?: string;
  searchParams?: SearchParamReadable | null;
  history: readonly Reservation[];
  isHistoryLoaded: boolean;
  isLoadingHistory: boolean;
  isLoadingMoreHistory?: boolean;
  hasMoreHistory?: boolean;
  canLoadMoreHistory?: boolean;
  isLoadingUpcoming?: boolean;
  isLoadingPending?: boolean;
  mode?: 'all' | 'deep-link' | 'queue';
  feedbackEnabled?: boolean;
  signal?: AbortSignal;
  lookupSingleFeedback?: FeedbackSessionLookupPort['fetchSingleReservationFeedback'];
}

export interface ReconcileHistoryRouteStep {
  state: HistoryRouteState;
  commands: HistoryRouteCommands;
  aborted?: boolean;
}

export interface ReconcileHistoryRouteResult extends ReconcileHistoryRouteStep {
  pendingLookup: Promise<ReconcileHistoryRouteStep> | null;
}

export type FeedbackOutcomeSource =
  'login-queue' | 'explicit-queue' | 'deep-link' | 'card';

export type RecordFeedbackOutcomeInput =
  | {
      action: 'submit';
      userId: string;
      reservationId: string;
      source?: FeedbackOutcomeSource;
      isQueueNowEmpty?: boolean;
      feedbackEnabled?: boolean;
    }
  | {
      action: 'skip';
      userId: string;
      reservationId: string;
      source?: 'login-queue' | 'explicit-queue';
      feedbackEnabled?: boolean;
    }
  | {
      action: 'dismiss' | 'defer' | 'close';
      source: 'login-queue' | 'explicit-queue' | 'deep-link';
      userId?: string;
      pathname?: string;
      rawSearch?: string;
      feedbackEnabled?: boolean;
    }
  | {
      action: 'clear-focus';
      feedbackEnabled?: boolean;
    };

export interface RecordFeedbackOutcomeResult {
  dismissedSkippedCount: number;
  replaceHref: string | null;
}

const DISABLED_HISTORY_ROUTE_STATE: HistoryRouteState = Object.freeze({
  hasDeepLinkTarget: false,
  isFeedbackQueueRequested: false,
  deepLinkDialogReservation: null,
  feedbackQueueItems: null,
  highlightedReservationId: null,
  autoExpandedReservationId: null,
  deepLinkTriggerSeq: 0,
  isLookingUpSingleReservation: false,
});

const EMPTY_HISTORY_ROUTE_COMMANDS: HistoryRouteCommands = Object.freeze({
  replaceHref: null,
  toast: null,
  shouldLoadMoreHistory: false,
});

export function resolveDeepLinkOutcome(opts: {
  role: ReservationRouteRole;
  targetReservationId: string;
  history: readonly Reservation[];
}): FeedbackDeepLinkResolution {
  const { role, targetReservationId, history } = opts;
  const target = history.find((item) => item.id === targetReservationId);

  if (!target) {
    return { kind: 'not-found' };
  }

  if (role === 'mentor') {
    if (canSubmitReservationFeedback(target, 'mentor')) {
      return {
        kind: 'mentor-open-dialog',
        reservation: target,
      };
    }

    return {
      kind: 'mentor-locate-card',
      reservation: target,
      shouldExpandFeedback: hasExpandableMentorFeedback(target),
    };
  }

  if (isReservationCancelled(target)) {
    return {
      kind: 'mentee-already-resolved',
      reservation: target,
      reason: 'cancelled',
    };
  }

  if (canSubmitReservationFeedback(target, 'mentee')) {
    return {
      kind: 'mentee-open-dialog',
      reservation: target,
    };
  }

  if (canEditReservationFeedback(target, 'mentee')) {
    return {
      kind: 'mentee-already-rated',
      reservation: target,
    };
  }

  if (isMenteeSessionMarkedNotHappened(target)) {
    return {
      kind: 'mentee-already-resolved',
      reservation: target,
      reason: 'not-happened',
    };
  }

  return {
    kind: 'mentee-already-resolved',
    reservation: target,
    reason: 'completed',
  };
}

const DEFAULT_SESSION_STATE: SessionPendingFeedbackState = {
  checked: false,
  dismissed: false,
  queueEmpty: false,
  submittedIds: [],
  skippedIds: [],
};

function getStorageKey(userId: string): string {
  return `${PENDING_FEEDBACK_SESSION_PREFIX}${userId}`;
}

function getLookupSeedKey(userId: string, reservationId: string): string {
  return `${userId}:${reservationId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStringIdArray(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
}

export function isAuthResetRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === '/auth' || pathname.startsWith('/auth/');
}

export function shouldSuppressPendingFeedbackPopup({
  pathname,
  searchParams,
}: PendingFeedbackRouteContext): boolean {
  if (!pathname) {
    return true;
  }

  if (
    pathname === '/auth' ||
    pathname.startsWith('/auth/') ||
    pathname === '/onboarding' ||
    pathname.startsWith('/onboarding/') ||
    pathname === '/reservation' ||
    pathname.startsWith('/reservation/') ||
    pathname === '/booking' ||
    pathname.startsWith('/booking/') ||
    pathname === '/maintenance'
  ) {
    return true;
  }

  const isProfileEditRoute = /^\/profile\/[^/]+\/edit$/.test(pathname);
  if (
    isProfileEditRoute &&
    (searchParams?.get(MENTOR_ONBOARDING_KEY) === 'true' ||
      searchParams?.get('onboarding') === 'true')
  ) {
    return true;
  }

  if (searchParams?.get(OPEN_SCHEDULE_DIALOG_KEY) === 'true') {
    return true;
  }

  if (
    searchParams &&
    (extractDeepLinkReservationId(searchParams) !== null ||
      isFeedbackQueueQueryRequested(searchParams))
  ) {
    return true;
  }

  return false;
}

export { sortPendingFeedbackOldestFirst };

export function createBrowserFeedbackSessionStoragePort(): FeedbackSessionStoragePort {
  return {
    getItem(key: string): string | null {
      if (typeof window === 'undefined') return null;
      try {
        return window.sessionStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): void {
      if (typeof window === 'undefined') return;
      try {
        window.sessionStorage.setItem(key, value);
      } catch {
        // Ignore storage quota / private-mode errors gracefully.
      }
    },
    removeItem(key: string): void {
      if (typeof window === 'undefined') return;
      try {
        window.sessionStorage.removeItem(key);
      } catch {
        // Ignore storage access errors gracefully.
      }
    },
    keys(): string[] {
      if (typeof window === 'undefined') return [];
      try {
        const collected: string[] = [];
        for (let i = 0; i < window.sessionStorage.length; i += 1) {
          const key = window.sessionStorage.key(i);
          if (key) {
            collected.push(key);
          }
        }
        return collected;
      } catch {
        return [];
      }
    },
  };
}

export function createInMemoryFeedbackSessionStoragePort(
  initialEntries: Record<string, string> = {}
): FeedbackSessionStoragePort {
  const store = new Map<string, string>(Object.entries(initialEntries));
  return {
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    keys(): string[] {
      return Array.from(store.keys());
    },
  };
}

export function createInMemoryFeedbackSessionLookupPort(
  options: InMemoryFeedbackSessionLookupOptions = {}
): InMemoryFeedbackSessionLookupPort {
  const calls: InMemoryFeedbackSessionLookupCalls = {
    fetchPendingFeedbackReservations: [],
    fetchSingleReservationFeedback: [],
  };

  return {
    calls,
    async fetchPendingFeedbackReservations(opts) {
      calls.fetchPendingFeedbackReservations.push(opts);
      if (opts.signal?.aborted) {
        return [];
      }
      if (typeof options.pendingReservations === 'function') {
        return options.pendingReservations(opts);
      }
      return options.pendingReservations
        ? [...options.pendingReservations]
        : [];
    },
    async fetchSingleReservationFeedback(opts) {
      calls.fetchSingleReservationFeedback.push(opts);
      if (opts.signal?.aborted) {
        return null;
      }
      if (typeof options.singleReservations === 'function') {
        return options.singleReservations(opts);
      }
      return options.singleReservations?.[opts.reservationId] ?? null;
    },
  };
}

export const defaultFeedbackSessionLookupPort: FeedbackSessionLookupPort = {
  async fetchPendingFeedbackReservations(opts) {
    const { fetchPendingFeedbackReservations } =
      await import('@/services/reservations');
    return fetchPendingFeedbackReservations(opts);
  },
  async fetchSingleReservationFeedback(opts) {
    const { fetchSingleReservationFeedback } =
      await import('@/services/reservations');
    return fetchSingleReservationFeedback(opts);
  },
};

interface StoredLookupSeedEntry {
  userId: string;
  reservationId: string;
  result: SeededReservationLookup | null;
  seededAt: number;
}

interface InFlightLoginFetch {
  key: string;
  controller: AbortController;
  subscribers: Set<symbol>;
  failed: boolean;
  errorReported: boolean;
  promise: Promise<Reservation[] | null>;
}

interface InFlightHistoryLookup {
  targetKey: string;
  controller: AbortController;
  subscribers: Set<symbol>;
  unscopedPromise: Promise<ReconcileHistoryRouteStep> | null;
  scopedPromises: WeakMap<AbortSignal, Promise<ReconcileHistoryRouteStep>>;
  promise: Promise<ReconcileHistoryRouteStep>;
}

export function createFeedbackSessionCoordinator(
  options: CreateFeedbackSessionCoordinatorOptions = {}
) {
  const storage = options.storage ?? createBrowserFeedbackSessionStoragePort();
  const defaultLookup = options.lookup;
  const now = options.now ?? (() => Date.now());
  const seedTtlMs = options.seedTtlMs ?? DEFAULT_LOOKUP_SEED_TTL_MS;

  const captureCoordinatorFlowFailure = (
    error: unknown,
    step: 'load_login_queue'
  ): void => {
    try {
      void Promise.resolve(
        captureFlowFailure({
          flow: 'pending_feedback_queue',
          step,
          message: error instanceof Error ? error.message : String(error),
          level: 'warning',
        })
      ).catch(() => {
        // Prevent telemetry dispatch failures from surfacing as unhandled rejections.
      });
    } catch {
      // Never allow error reporting to throw synchronously.
    }
  };

  const reportError = (
    error: unknown,
    context: { step: 'load_login_queue'; userId: string }
  ): void => {
    if (options.onError) {
      try {
        const maybePromise: unknown = options.onError(error, context);
        if (
          typeof maybePromise === 'object' &&
          maybePromise !== null &&
          'catch' in maybePromise &&
          typeof (maybePromise as { catch?: unknown }).catch === 'function'
        ) {
          void (maybePromise as Promise<unknown>).catch(() => {
            captureCoordinatorFlowFailure(error, context.step);
          });
        }
      } catch {
        captureCoordinatorFlowFailure(error, context.step);
      }
      return;
    }
    captureCoordinatorFlowFailure(error, context.step);
  };

  const stateListeners = new Set<() => void>();

  const runtimeSubmittedByUser = new Map<string, Set<string>>();
  const seededLookups = new Map<string, StoredLookupSeedEntry>();

  const loginRuntime = {
    trackedUserId: null as string | null,
    fetchedUserId: null as string | null,
    isPresenting: false,
    presentedItems: null as Reservation[] | null,
    activeIds: [] as string[],
    shownTelemetryUserId: null as string | null,
    dismissedTelemetryUserId: null as string | null,
    inFlightFetch: null as InFlightLoginFetch | null,
  };

  function cancelInFlightLoginFetch(): void {
    if (!loginRuntime.inFlightFetch) {
      return;
    }
    const activeFetch = loginRuntime.inFlightFetch;
    loginRuntime.inFlightFetch = null;
    activeFetch.subscribers.clear();
    activeFetch.controller.abort();
  }

  const historyRuntime = {
    trackedRole: null as ReservationRouteRole | null,
    trackedQueueKey: null as string | null,
    hasDeepLinkTarget: false,
    isFeedbackQueueRequested: false,
    activeTargetKey: null as string | null,
    handledKey: null as string | null,
    inFlightLookup: null as InFlightHistoryLookup | null,
    autoLoadCount: 0,
    lastAutoLoadHistoryLength: -1,
    deepLinkDialogReservation: null as Reservation | null,
    highlightedReservationId: null as string | null,
    autoExpandedReservationId: null as string | null,
    deepLinkTriggerSeq: 0,
    latchedQueue: null as Reservation[] | null,
    queueDismissed: false,
    cachedSnapshot: DISABLED_HISTORY_ROUTE_STATE as HistoryRouteState,
  };

  function cancelHistoryLookup(): void {
    if (!historyRuntime.inFlightLookup) {
      return;
    }
    const activeLookup = historyRuntime.inFlightLookup;
    historyRuntime.inFlightLookup = null;
    activeLookup.subscribers.clear();
    activeLookup.controller.abort();
  }

  function buildHistoryRouteSnapshot(
    feedbackEnabled = true
  ): HistoryRouteState {
    if (!feedbackEnabled) {
      return DISABLED_HISTORY_ROUTE_STATE;
    }

    const isQueueSuppressedByDeepLink =
      historyRuntime.hasDeepLinkTarget ||
      historyRuntime.deepLinkDialogReservation !== null;
    const feedbackQueueItems =
      !isQueueSuppressedByDeepLink &&
      historyRuntime.isFeedbackQueueRequested &&
      !historyRuntime.queueDismissed &&
      historyRuntime.latchedQueue &&
      historyRuntime.latchedQueue.length > 0
        ? historyRuntime.latchedQueue
        : null;
    const isLookingUpSingleReservation =
      historyRuntime.inFlightLookup !== null &&
      !historyRuntime.inFlightLookup.controller.signal.aborted;

    const prev = historyRuntime.cachedSnapshot;
    if (
      prev.hasDeepLinkTarget === historyRuntime.hasDeepLinkTarget &&
      prev.isFeedbackQueueRequested ===
        historyRuntime.isFeedbackQueueRequested &&
      prev.deepLinkDialogReservation ===
        historyRuntime.deepLinkDialogReservation &&
      prev.feedbackQueueItems === feedbackQueueItems &&
      prev.highlightedReservationId ===
        historyRuntime.highlightedReservationId &&
      prev.autoExpandedReservationId ===
        historyRuntime.autoExpandedReservationId &&
      prev.deepLinkTriggerSeq === historyRuntime.deepLinkTriggerSeq &&
      prev.isLookingUpSingleReservation === isLookingUpSingleReservation
    ) {
      return prev;
    }

    const nextSnapshot: HistoryRouteState = Object.freeze({
      hasDeepLinkTarget: historyRuntime.hasDeepLinkTarget,
      isFeedbackQueueRequested: historyRuntime.isFeedbackQueueRequested,
      deepLinkDialogReservation: historyRuntime.deepLinkDialogReservation,
      feedbackQueueItems,
      highlightedReservationId: historyRuntime.highlightedReservationId,
      autoExpandedReservationId: historyRuntime.autoExpandedReservationId,
      deepLinkTriggerSeq: historyRuntime.deepLinkTriggerSeq,
      isLookingUpSingleReservation,
    });
    historyRuntime.cachedSnapshot = nextSnapshot;
    return nextSnapshot;
  }

  function getHistoryRouteState(opts?: {
    feedbackEnabled?: boolean;
  }): HistoryRouteState {
    const feedbackEnabled = opts?.feedbackEnabled ?? isFeedbackEnabled();
    return buildHistoryRouteSnapshot(feedbackEnabled);
  }

  function resetHistoryRouteFields(): void {
    cancelHistoryLookup();
    historyRuntime.trackedRole = null;
    historyRuntime.trackedQueueKey = null;
    historyRuntime.hasDeepLinkTarget = false;
    historyRuntime.isFeedbackQueueRequested = false;
    historyRuntime.activeTargetKey = null;
    historyRuntime.handledKey = null;
    historyRuntime.autoLoadCount = 0;
    historyRuntime.lastAutoLoadHistoryLength = -1;
    historyRuntime.deepLinkDialogReservation = null;
    historyRuntime.highlightedReservationId = null;
    historyRuntime.autoExpandedReservationId = null;
    historyRuntime.deepLinkTriggerSeq = 0;
    historyRuntime.latchedQueue = null;
    historyRuntime.queueDismissed = false;
  }

  function resetHistoryRouteSession(): void {
    const prev = historyRuntime.cachedSnapshot;
    resetHistoryRouteFields();
    const next = buildHistoryRouteSnapshot(true);
    if (next !== prev) {
      notifyStateChange();
    }
  }

  function notifyStateChange(): void {
    Array.from(stateListeners).forEach((listener) => {
      listener();
    });
  }

  function getRuntimeSubmittedSet(userId: string): Set<string> {
    const existing = runtimeSubmittedByUser.get(userId);
    if (existing) {
      return existing;
    }
    const created = new Set<string>();
    runtimeSubmittedByUser.set(userId, created);
    return created;
  }

  function getSessionState(userId: string): SessionPendingFeedbackState {
    if (!userId) {
      return DEFAULT_SESSION_STATE;
    }
    const raw = storage.getItem(getStorageKey(userId));
    if (!raw) {
      return DEFAULT_SESSION_STATE;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) {
        return DEFAULT_SESSION_STATE;
      }
      return {
        checked: Boolean(parsed.checked),
        dismissed: Boolean(parsed.dismissed),
        queueEmpty: Boolean(parsed.queueEmpty),
        submittedIds: parseStringIdArray(parsed.submittedIds),
        skippedIds: parseStringIdArray(parsed.skippedIds),
      };
    } catch {
      return DEFAULT_SESSION_STATE;
    }
  }

  function writeSessionState(
    userId: string,
    next: SessionPendingFeedbackState
  ): void {
    if (!userId) {
      return;
    }
    storage.setItem(getStorageKey(userId), JSON.stringify(next));
  }

  function getExcludedIds(userId: string): Set<string> {
    const persisted = getSessionState(userId);
    const runtimeSubmitted = runtimeSubmittedByUser.get(userId);
    return new Set([
      ...persisted.skippedIds,
      ...persisted.submittedIds,
      ...(runtimeSubmitted ? Array.from(runtimeSubmitted) : []),
    ]);
  }

  function markChecked(userId: string, hasRemainingItems = false): void {
    if (!userId) return;
    const prev = getSessionState(userId);
    writeSessionState(userId, {
      ...prev,
      checked: true,
      queueEmpty: !hasRemainingItems,
    });
  }

  function markDismissed(
    userId: string,
    remainingReservationIds: readonly string[] = []
  ): void {
    if (!userId) return;
    const prev = getSessionState(userId);
    const mergedSkipped = Array.from(
      new Set([...prev.skippedIds, ...remainingReservationIds.filter(Boolean)])
    );
    writeSessionState(userId, {
      ...prev,
      checked: true,
      dismissed: true,
      skippedIds: mergedSkipped,
    });
  }

  function syncStorageAfterLoginPrune(userId: string): void {
    if (loginRuntime.activeIds.length > 0) {
      return;
    }
    const persisted = getSessionState(userId);
    const runtimeSubmittedSize = runtimeSubmittedByUser.get(userId)?.size ?? 0;
    if (persisted.skippedIds.length > 0) {
      markDismissed(userId, []);
    } else if (
      persisted.checked ||
      persisted.submittedIds.length > 0 ||
      runtimeSubmittedSize > 0
    ) {
      markChecked(userId, false);
    }
  }

  function pruneLoginQueueForUser(
    userId: string,
    shouldUpdatePresentedItems: boolean
  ): boolean {
    if (!userId) {
      return false;
    }
    const excludedIds = getExcludedIds(userId);
    const hadActiveIds = loginRuntime.activeIds.length > 0;
    loginRuntime.activeIds = loginRuntime.activeIds.filter(
      (id) => !excludedIds.has(id)
    );
    if (hadActiveIds && loginRuntime.activeIds.length === 0) {
      syncStorageAfterLoginPrune(userId);
    }

    if (
      !shouldUpdatePresentedItems ||
      !loginRuntime.presentedItems ||
      loginRuntime.presentedItems.length === 0
    ) {
      return false;
    }

    const remaining = loginRuntime.presentedItems.filter(
      (item) => !excludedIds.has(item.id)
    );
    if (remaining.length === loginRuntime.presentedItems.length) {
      return false;
    }
    loginRuntime.presentedItems = remaining.length > 0 ? remaining : null;
    return true;
  }

  function markReservationSubmitted(
    userId: string,
    reservationId: string,
    isQueueNowEmpty = false
  ): void {
    if (!userId || !reservationId) return;
    const prev = getSessionState(userId);
    const nextSubmitted = prev.submittedIds.includes(reservationId)
      ? prev.submittedIds
      : [...prev.submittedIds, reservationId];
    writeSessionState(userId, {
      ...prev,
      checked: prev.checked || isQueueNowEmpty,
      queueEmpty: prev.queueEmpty || isQueueNowEmpty,
      submittedIds: nextSubmitted,
    });
    getRuntimeSubmittedSet(userId).add(reservationId);
    if (loginRuntime.trackedUserId === userId) {
      pruneLoginQueueForUser(userId, !loginRuntime.isPresenting);
    }
    notifyStateChange();
  }

  function markReservationSkipped(userId: string, reservationId: string): void {
    if (!reservationId) return;
    const prev = getSessionState(userId);
    const nextSkipped = prev.skippedIds.includes(reservationId)
      ? prev.skippedIds
      : [...prev.skippedIds, reservationId];
    writeSessionState(userId, {
      ...prev,
      checked: true,
      skippedIds: nextSkipped,
    });
    if (userId && loginRuntime.trackedUserId === userId) {
      pruneLoginQueueForUser(userId, !loginRuntime.isPresenting);
    }
    notifyStateChange();
  }

  function clearAllSessionState(): void {
    cancelInFlightLoginFetch();
    resetHistoryRouteFields();
    buildHistoryRouteSnapshot(true);
    const keysToRemove = storage
      .keys()
      .filter((key) => key.startsWith(PENDING_FEEDBACK_SESSION_PREFIX));
    for (let i = 0; i < keysToRemove.length; i += 1) {
      storage.removeItem(keysToRemove[i]);
    }
    runtimeSubmittedByUser.clear();
    seededLookups.clear();
    loginRuntime.trackedUserId = null;
    loginRuntime.fetchedUserId = null;
    loginRuntime.isPresenting = false;
    loginRuntime.presentedItems = null;
    loginRuntime.activeIds = [];
    loginRuntime.shownTelemetryUserId = null;
    loginRuntime.dismissedTelemetryUserId = null;
    notifyStateChange();
  }

  function resetRuntimeLoginSession(): void {
    cancelInFlightLoginFetch();
    loginRuntime.fetchedUserId = null;
    loginRuntime.isPresenting = false;
    loginRuntime.presentedItems = null;
    loginRuntime.activeIds = [];
    loginRuntime.shownTelemetryUserId = null;
    loginRuntime.dismissedTelemetryUserId = null;
  }

  function syncAuthSession(opts: {
    isResetRouteOrUnauthenticated: boolean;
    userId: string;
  }): void {
    if (opts.isResetRouteOrUnauthenticated) {
      clearAllSessionState();
      return;
    }

    if (
      opts.userId &&
      loginRuntime.trackedUserId !== null &&
      loginRuntime.trackedUserId !== opts.userId
    ) {
      clearAllSessionState();
    }

    if (opts.userId) {
      loginRuntime.trackedUserId = opts.userId;
    }
  }

  function syncLoginQueuePresentation(opts: {
    userId: string;
    canPresent: boolean;
  }): Reservation[] | null {
    if (!opts.userId) {
      cancelInFlightLoginFetch();
      loginRuntime.isPresenting = false;
      return null;
    }
    loginRuntime.trackedUserId = opts.userId;
    const wasPresenting = loginRuntime.isPresenting;
    loginRuntime.isPresenting = opts.canPresent;
    if (!opts.canPresent) {
      cancelInFlightLoginFetch();
      const changed = pruneLoginQueueForUser(opts.userId, true);
      if (changed || wasPresenting) {
        notifyStateChange();
      }
      return null;
    }
    if (!wasPresenting && loginRuntime.presentedItems) {
      notifyStateChange();
    }
    return loginRuntime.presentedItems;
  }

  function getPresentedLoginQueue(opts: {
    userId: string;
    canPresent: boolean;
  }): Reservation[] | null {
    if (
      !opts.canPresent ||
      !opts.userId ||
      loginRuntime.trackedUserId !== opts.userId
    ) {
      return null;
    }
    return loginRuntime.presentedItems;
  }

  function shouldFetchLoginQueue(userId: string): boolean {
    if (!userId) return false;
    const sessionState = getSessionState(userId);
    if (sessionState.dismissed) {
      return false;
    }
    if (
      loginRuntime.fetchedUserId === userId ||
      (sessionState.checked && sessionState.queueEmpty)
    ) {
      return false;
    }
    return true;
  }

  async function loadLoginQueueInternal(opts: {
    userId: string;
    isMentor: boolean;
    signal?: AbortSignal;
    fetchPending?: FeedbackSessionLookupPort['fetchPendingFeedbackReservations'];
    onNonAbortError?: () => void;
  }): Promise<Reservation[] | null> {
    const { userId, isMentor, signal, onNonAbortError } = opts;
    if (!shouldFetchLoginQueue(userId)) {
      return loginRuntime.presentedItems;
    }

    const fetchFn =
      opts.fetchPending ?? defaultLookup?.fetchPendingFeedbackReservations;
    if (!fetchFn) {
      return null;
    }

    try {
      const items = await fetchFn({
        userId,
        fallbackViewerRole: isMentor ? 'MENTOR' : 'MENTEE',
        signal,
      });

      if (signal?.aborted) {
        return null;
      }

      const excludedIds = getExcludedIds(userId);
      const remaining = sortPendingFeedbackOldestFirst(
        items
          .filter((item) => !excludedIds.has(item.id))
          .map((item) => normalizeReservationViewerRole(item, isMentor))
      );

      loginRuntime.trackedUserId = userId;
      loginRuntime.fetchedUserId = userId;
      markChecked(userId, remaining.length > 0);

      if (remaining.length > 0) {
        loginRuntime.activeIds = remaining.map((item) => item.id);
        loginRuntime.presentedItems = remaining;
      } else {
        loginRuntime.activeIds = [];
        loginRuntime.presentedItems = null;
      }

      notifyStateChange();
      return loginRuntime.presentedItems;
    } catch (error) {
      if (!signal?.aborted) {
        onNonAbortError?.();
        loginRuntime.trackedUserId = userId;
        loginRuntime.fetchedUserId = userId;
        loginRuntime.activeIds = [];
        loginRuntime.presentedItems = null;
        try {
          notifyStateChange();
        } catch {
          // Ensure listener errors during error recovery never block error reporting.
        }
        reportError(error, { step: 'load_login_queue', userId });
      }
      return null;
    }
  }

  async function reconcileLoginSession(
    opts: ReconcileLoginSessionOptions
  ): Promise<ReconcileLoginSessionResult> {
    const feedbackEnabled = opts.feedbackEnabled ?? isFeedbackEnabled();
    if (!feedbackEnabled) {
      return {
        queueItems: null,
        canPresent: false,
        isSuppressed: true,
        promptShownCount: null,
      };
    }

    const isSuppressed = shouldSuppressPendingFeedbackPopup(opts.route);
    const isResetRoute = isAuthResetRoute(opts.route.pathname);

    if (opts.authStatus === 'loading' && !isResetRoute) {
      return {
        queueItems: null,
        canPresent: false,
        isSuppressed,
        promptShownCount: null,
      };
    }

    const cleanUserId = opts.userId?.trim() ?? '';
    const isResetOrUnauth =
      opts.authStatus === 'unauthenticated' || isResetRoute;

    syncAuthSession({
      isResetRouteOrUnauthenticated: isResetOrUnauth,
      userId: opts.authStatus === 'authenticated' ? cleanUserId : '',
    });

    if (
      isResetOrUnauth ||
      opts.authStatus !== 'authenticated' ||
      !cleanUserId
    ) {
      return {
        queueItems: null,
        canPresent: false,
        isSuppressed,
        promptShownCount: null,
      };
    }

    const isRoleResolved = typeof opts.isMentor === 'boolean';
    const isMentorSession = opts.isMentor === true;
    const canPresent =
      opts.isOnboardingComplete === true &&
      isRoleResolved &&
      !opts.hasSessionError &&
      !isSuppressed;

    syncLoginQueuePresentation({
      userId: cleanUserId,
      canPresent,
    });

    if (!canPresent) {
      return {
        queueItems: null,
        canPresent: false,
        isSuppressed,
        promptShownCount: null,
      };
    }

    if (opts.signal?.aborted) {
      return {
        queueItems: null,
        canPresent: false,
        isSuppressed,
        promptShownCount: null,
      };
    }

    if (shouldFetchLoginQueue(cleanUserId)) {
      const fetchKey = `${cleanUserId}:${isMentorSession ? 'MENTOR' : 'MENTEE'}`;
      let activeFetch = loginRuntime.inFlightFetch;

      if (
        !activeFetch ||
        activeFetch.key !== fetchKey ||
        activeFetch.controller.signal.aborted
      ) {
        cancelInFlightLoginFetch();
        const controller = new AbortController();
        const subscribers = new Set<symbol>();
        const createdFetch: InFlightLoginFetch = {
          key: fetchKey,
          controller,
          subscribers,
          failed: false,
          errorReported: false,
          promise: Promise.resolve<Reservation[] | null>(null),
        };

        createdFetch.promise = loadLoginQueueInternal({
          userId: cleanUserId,
          isMentor: isMentorSession,
          signal: controller.signal,
          fetchPending: opts.fetchPending,
          onNonAbortError: () => {
            createdFetch.failed = true;
            createdFetch.errorReported = true;
          },
        }).finally(() => {
          if (loginRuntime.inFlightFetch === createdFetch) {
            loginRuntime.inFlightFetch = null;
          }
        });

        activeFetch = createdFetch;
        loginRuntime.inFlightFetch = createdFetch;
      }

      const targetFetch = activeFetch;
      const subscriberToken = Symbol('login-fetch-subscriber');
      targetFetch.subscribers.add(subscriberToken);

      const callerSignal = opts.signal;
      const onCallerAbort = () => {
        targetFetch.subscribers.delete(subscriberToken);
        if (targetFetch.subscribers.size === 0) {
          if (loginRuntime.inFlightFetch === targetFetch) {
            loginRuntime.inFlightFetch = null;
          }
          targetFetch.controller.abort();
        }
      };

      if (callerSignal?.aborted) {
        onCallerAbort();
      } else {
        callerSignal?.addEventListener('abort', onCallerAbort, { once: true });
      }

      try {
        await targetFetch.promise;
      } catch (error) {
        targetFetch.failed = true;
        if (
          !targetFetch.errorReported &&
          !callerSignal?.aborted &&
          !targetFetch.controller.signal.aborted
        ) {
          targetFetch.errorReported = true;
          reportError(error, { step: 'load_login_queue', userId: cleanUserId });
        }
        return {
          queueItems: null,
          canPresent: false,
          isSuppressed: !loginRuntime.isPresenting,
          promptShownCount: null,
        };
      } finally {
        callerSignal?.removeEventListener('abort', onCallerAbort);
        targetFetch.subscribers.delete(subscriberToken);
      }

      if (
        targetFetch.failed ||
        targetFetch.controller.signal.aborted ||
        callerSignal?.aborted ||
        loginRuntime.trackedUserId !== cleanUserId ||
        !loginRuntime.isPresenting
      ) {
        return {
          queueItems: null,
          canPresent: false,
          isSuppressed: !loginRuntime.isPresenting,
          promptShownCount: null,
        };
      }
    }

    const queueItems = getPresentedLoginQueue({
      userId: cleanUserId,
      canPresent: loginRuntime.isPresenting,
    });
    const promptShownCount = consumeLoginPromptShown({
      userId: cleanUserId,
      canPresent: loginRuntime.isPresenting,
    });

    return {
      queueItems,
      canPresent: loginRuntime.isPresenting,
      isSuppressed: false,
      promptShownCount,
    };
  }

  function consumeLoginPromptShown(opts: {
    userId: string;
    canPresent: boolean;
  }): number | null {
    if (
      !opts.canPresent ||
      !opts.userId ||
      loginRuntime.trackedUserId !== opts.userId ||
      !loginRuntime.presentedItems ||
      loginRuntime.presentedItems.length === 0 ||
      loginRuntime.shownTelemetryUserId === opts.userId
    ) {
      return null;
    }
    loginRuntime.shownTelemetryUserId = opts.userId;
    loginRuntime.dismissedTelemetryUserId = null;
    return loginRuntime.presentedItems.length;
  }

  function dismissLoginQueue(userId: string): {
    dismissedSkippedCount: number;
  } {
    let dismissedSkippedCount = 0;
    if (userId) {
      const persisted = getSessionState(userId);
      const skippedIdSet = new Set<string>([
        ...persisted.skippedIds,
        ...loginRuntime.activeIds,
      ]);

      if (skippedIdSet.size > 0) {
        markDismissed(userId, loginRuntime.activeIds);
        if (loginRuntime.dismissedTelemetryUserId !== userId) {
          loginRuntime.dismissedTelemetryUserId = userId;
          dismissedSkippedCount = skippedIdSet.size;
        }
      } else {
        markChecked(userId, false);
      }
    }
    loginRuntime.activeIds = [];
    loginRuntime.presentedItems = null;
    notifyStateChange();
    return { dismissedSkippedCount };
  }

  function resolveExplicitQueueItems(opts: {
    userId?: string;
    role: ReservationRouteRole;
    history: readonly Reservation[];
  }): Reservation[] {
    const cleanUserId = opts.userId?.trim() ?? '';
    const excludedIds = cleanUserId ? getExcludedIds(cleanUserId) : null;
    const eligible = opts.history.filter(
      (item) =>
        isEligibleForPendingFeedbackQueue(item) &&
        (!excludedIds || !excludedIds.has(item.id))
    );
    return sortPendingFeedbackOldestFirst(eligible);
  }

  function seedLookupResult(opts: {
    userId: string;
    reservationId: string;
    result: SeededReservationLookup | null;
  }): void {
    const cleanUserId = opts.userId.trim();
    const cleanReservationId = opts.reservationId.trim();
    if (!cleanUserId || !cleanReservationId) return;

    seededLookups.set(getLookupSeedKey(cleanUserId, cleanReservationId), {
      userId: cleanUserId,
      reservationId: cleanReservationId,
      result: opts.result,
      seededAt: now(),
    });
  }

  function consumeSeededLookup(opts: {
    userId: string;
    reservationId: string;
  }): ConsumedLookupSeed {
    const cleanUserId = opts.userId.trim();
    const cleanReservationId = opts.reservationId.trim();
    if (!cleanUserId || !cleanReservationId) {
      return { hit: false };
    }

    const key = getLookupSeedKey(cleanUserId, cleanReservationId);
    const entry = seededLookups.get(key);
    if (!entry) {
      return { hit: false };
    }

    seededLookups.delete(key);
    if (now() - entry.seededAt > seedTtlMs) {
      return { hit: false };
    }

    return {
      hit: true,
      result: entry.result,
    };
  }

  function applyResolvedDeepLinkToRuntime(
    targetKey: string,
    outcome: Exclude<FeedbackDeepLinkResolution, { kind: 'not-found' }>,
    pathname: string,
    normalizedRawSearch: string
  ): HistoryRouteCommands {
    historyRuntime.handledKey = targetKey;
    historyRuntime.highlightedReservationId = outcome.reservation.id;
    historyRuntime.deepLinkTriggerSeq += 1;

    if (
      outcome.kind === 'mentee-open-dialog' ||
      outcome.kind === 'mentor-open-dialog'
    ) {
      historyRuntime.autoExpandedReservationId = null;
      historyRuntime.deepLinkDialogReservation = outcome.reservation;
      return {
        replaceHref: null,
        toast: null,
        shouldLoadMoreHistory: false,
      };
    }

    historyRuntime.deepLinkDialogReservation = null;

    if (outcome.kind === 'mentee-already-rated') {
      historyRuntime.autoExpandedReservationId = outcome.reservation.id;
      return {
        replaceHref: buildCleanedDeepLinkHref(pathname, normalizedRawSearch),
        toast: {
          kind: 'already-rated',
          title: '您已填寫過此場會談回饋',
          description: '已為您展開先前的回饋紀錄。',
        },
        shouldLoadMoreHistory: false,
      };
    }

    if (outcome.kind === 'mentee-already-resolved') {
      historyRuntime.autoExpandedReservationId = null;
      const toast: HistoryRouteToastCommand =
        outcome.reason === 'cancelled'
          ? {
              kind: 'cancelled',
              title: '此預約已取消',
              description: '已取消的預約無須填寫會談回饋。',
            }
          : {
              kind: 'already-resolved',
              title: '您已完成此場會談紀錄',
              description: '此場會談無須重複填寫回饋。',
            };
      return {
        replaceHref: buildCleanedDeepLinkHref(pathname, normalizedRawSearch),
        toast,
        shouldLoadMoreHistory: false,
      };
    }

    historyRuntime.autoExpandedReservationId = outcome.shouldExpandFeedback
      ? outcome.reservation.id
      : null;
    return {
      replaceHref: buildCleanedDeepLinkHref(pathname, normalizedRawSearch),
      toast: null,
      shouldLoadMoreHistory: false,
    };
  }

  function applyNotFoundDeepLinkToRuntime(
    targetKey: string,
    pathname: string,
    normalizedRawSearch: string
  ): HistoryRouteCommands {
    historyRuntime.handledKey = targetKey;
    historyRuntime.deepLinkDialogReservation = null;
    historyRuntime.highlightedReservationId = null;
    historyRuntime.autoExpandedReservationId = null;
    return {
      replaceHref: buildCleanedDeepLinkHref(pathname, normalizedRawSearch),
      toast: {
        kind: 'not-found',
        title: '找不到指定的會談紀錄',
        description: '請確認您登入的帳號是否正確，或於歷史紀錄列表查看。',
      },
      shouldLoadMoreHistory: false,
    };
  }

  function applyCrossRoleSeedTransfer(opts: {
    targetKey: string;
    userId: string;
    reservationId: string;
    lookupResult: SeededReservationLookup;
  }): HistoryRouteCommands {
    historyRuntime.handledKey = opts.targetKey;
    historyRuntime.deepLinkDialogReservation = null;
    seedLookupResult({
      userId: opts.userId,
      reservationId: opts.reservationId,
      result: opts.lookupResult,
    });
    return {
      replaceHref: buildReservationTabHref(
        opts.lookupResult.viewerRole,
        'history',
        {
          reservationId: opts.reservationId,
          reservationIdParam: 'reservation_id',
        }
      ),
      toast: null,
      shouldLoadMoreHistory: false,
    };
  }

  function applySingleLookupResultToRuntime(opts: {
    targetKey: string;
    role: ReservationRouteRole;
    userId: string;
    targetReservationId: string;
    pathname: string;
    normalizedRawSearch: string;
    result: SeededReservationLookup | null;
  }): HistoryRouteCommands {
    const {
      targetKey,
      role,
      userId,
      targetReservationId,
      pathname,
      normalizedRawSearch,
      result,
    } = opts;

    if (!result) {
      return applyNotFoundDeepLinkToRuntime(
        targetKey,
        pathname,
        normalizedRawSearch
      );
    }

    if (result.viewerRole !== role) {
      return applyCrossRoleSeedTransfer({
        targetKey,
        userId,
        reservationId: targetReservationId,
        lookupResult: result,
      });
    }

    const singleOutcome = resolveDeepLinkOutcome({
      role,
      targetReservationId,
      history: [result.reservation],
    });

    return singleOutcome.kind === 'not-found'
      ? applyNotFoundDeepLinkToRuntime(targetKey, pathname, normalizedRawSearch)
      : applyResolvedDeepLinkToRuntime(
          targetKey,
          singleOutcome,
          pathname,
          normalizedRawSearch
        );
  }

  function createSharedHistoryLookup(opts: {
    targetKey: string;
    role: ReservationRouteRole;
    userId: string;
    targetReservationId: string;
    pathname: string;
    normalizedRawSearch: string;
    lookupFn: NonNullable<
      FeedbackSessionLookupPort['fetchSingleReservationFeedback']
    >;
  }): InFlightHistoryLookup {
    const {
      targetKey,
      role,
      userId,
      targetReservationId,
      pathname,
      normalizedRawSearch,
      lookupFn,
    } = opts;

    const controller = new AbortController();
    const subscribers = new Set<symbol>();
    const createdLookup: InFlightHistoryLookup = {
      targetKey,
      controller,
      subscribers,
      unscopedPromise: null,
      scopedPromises: new WeakMap(),
      promise: Promise.resolve({
        state: DISABLED_HISTORY_ROUTE_STATE,
        commands: EMPTY_HISTORY_ROUTE_COMMANDS,
        aborted: true,
      }),
    };

    createdLookup.promise = (async (): Promise<ReconcileHistoryRouteStep> => {
      let lookupResult: SeededReservationLookup | null = null;
      try {
        lookupResult = await lookupFn({
          userId,
          reservationId: targetReservationId,
          fallbackRole: role,
          signal: controller.signal,
        });
      } catch {
        lookupResult = null;
      } finally {
        if (historyRuntime.inFlightLookup === createdLookup) {
          historyRuntime.inFlightLookup = null;
        }
      }

      if (
        controller.signal.aborted ||
        historyRuntime.activeTargetKey !== targetKey ||
        historyRuntime.handledKey === targetKey
      ) {
        const prevSnap = historyRuntime.cachedSnapshot;
        const abortedState = buildHistoryRouteSnapshot(true);
        if (abortedState !== prevSnap) {
          notifyStateChange();
        }
        return {
          state: abortedState,
          commands: EMPTY_HISTORY_ROUTE_COMMANDS,
          aborted: true,
        };
      }

      const asyncCommands = applySingleLookupResultToRuntime({
        targetKey,
        role,
        userId,
        targetReservationId,
        pathname,
        normalizedRawSearch,
        result: lookupResult,
      });
      const settledState = buildHistoryRouteSnapshot(true);
      notifyStateChange();
      return {
        state: settledState,
        commands: asyncCommands,
      };
    })();

    historyRuntime.inFlightLookup = createdLookup;
    return createdLookup;
  }

  function subscribeCallerToHistoryLookup(
    targetLookup: InFlightHistoryLookup,
    signal?: AbortSignal
  ): Promise<ReconcileHistoryRouteStep> {
    if (!signal) {
      if (targetLookup.unscopedPromise) {
        return targetLookup.unscopedPromise;
      }
      const unscopedToken = Symbol('history-lookup-unscoped');
      targetLookup.subscribers.add(unscopedToken);
      const unscopedPromise = targetLookup.promise.finally(() => {
        targetLookup.subscribers.delete(unscopedToken);
      });
      targetLookup.unscopedPromise = unscopedPromise;
      return unscopedPromise;
    }

    const existingScoped = targetLookup.scopedPromises.get(signal);
    if (existingScoped) {
      return existingScoped;
    }

    const subscriberToken = Symbol('history-lookup-subscriber');
    targetLookup.subscribers.add(subscriberToken);

    const onCallerAbort = () => {
      targetLookup.subscribers.delete(subscriberToken);
      if (targetLookup.subscribers.size === 0) {
        if (historyRuntime.inFlightLookup === targetLookup) {
          historyRuntime.inFlightLookup = null;
        }
        targetLookup.controller.abort();
        const prevSnap = historyRuntime.cachedSnapshot;
        const abortedSnap = buildHistoryRouteSnapshot(true);
        if (abortedSnap !== prevSnap) {
          notifyStateChange();
        }
      }
    };

    signal.addEventListener('abort', onCallerAbort, { once: true });

    const scopedPromise = targetLookup.promise
      .then((settled): ReconcileHistoryRouteStep => {
        if (signal.aborted) {
          return {
            state: buildHistoryRouteSnapshot(true),
            commands: EMPTY_HISTORY_ROUTE_COMMANDS,
            aborted: true,
          };
        }
        return settled;
      })
      .finally(() => {
        signal.removeEventListener('abort', onCallerAbort);
        targetLookup.subscribers.delete(subscriberToken);
      });

    targetLookup.scopedPromises.set(signal, scopedPromise);
    return scopedPromise;
  }

  function resolveMissingHistoryDeepLink(opts: {
    targetKey: string;
    role: ReservationRouteRole;
    cleanUserId: string;
    targetReservationId: string;
    pathname: string;
    normalizedRawSearch: string;
    historyLength: number;
    hasMoreHistory?: boolean;
    canLoadMoreHistory?: boolean;
    signal?: AbortSignal;
    lookupSingleFeedback?: FeedbackSessionLookupPort['fetchSingleReservationFeedback'];
  }): {
    commands: HistoryRouteCommands;
    pendingLookup: Promise<ReconcileHistoryRouteStep> | null;
  } {
    const {
      targetKey,
      role,
      cleanUserId,
      targetReservationId,
      pathname,
      normalizedRawSearch,
      historyLength,
      hasMoreHistory,
      canLoadMoreHistory,
      signal,
      lookupSingleFeedback,
    } = opts;

    if (cleanUserId) {
      const seeded = consumeSeededLookup({
        userId: cleanUserId,
        reservationId: targetReservationId,
      });
      if (seeded.hit) {
        cancelHistoryLookup();
        return {
          commands: applySingleLookupResultToRuntime({
            targetKey,
            role,
            userId: cleanUserId,
            targetReservationId,
            pathname,
            normalizedRawSearch,
            result: seeded.result,
          }),
          pendingLookup: null,
        };
      }
    }

    const canLoadMore = canLoadMoreHistory ?? Boolean(hasMoreHistory);
    const canTryNextPage =
      Boolean(hasMoreHistory) &&
      canLoadMore &&
      historyRuntime.autoLoadCount < MAX_DEEP_LINK_LOAD_MORE_PAGES &&
      historyRuntime.lastAutoLoadHistoryLength !== historyLength;

    if (canTryNextPage) {
      historyRuntime.autoLoadCount += 1;
      historyRuntime.lastAutoLoadHistoryLength = historyLength;
      return {
        commands: {
          replaceHref: null,
          toast: null,
          shouldLoadMoreHistory: true,
        },
        pendingLookup: null,
      };
    }

    if (!cleanUserId) {
      return {
        commands: applyNotFoundDeepLinkToRuntime(
          targetKey,
          pathname,
          normalizedRawSearch
        ),
        pendingLookup: null,
      };
    }

    const lookupFn =
      lookupSingleFeedback ?? defaultLookup?.fetchSingleReservationFeedback;

    if (!lookupFn) {
      return {
        commands: applyNotFoundDeepLinkToRuntime(
          targetKey,
          pathname,
          normalizedRawSearch
        ),
        pendingLookup: null,
      };
    }

    if (signal?.aborted) {
      return {
        commands: EMPTY_HISTORY_ROUTE_COMMANDS,
        pendingLookup: Promise.resolve({
          state: buildHistoryRouteSnapshot(true),
          commands: EMPTY_HISTORY_ROUTE_COMMANDS,
          aborted: true,
        }),
      };
    }

    let activeLookup = historyRuntime.inFlightLookup;
    if (
      !activeLookup ||
      activeLookup.targetKey !== targetKey ||
      activeLookup.controller.signal.aborted
    ) {
      cancelHistoryLookup();
      activeLookup = createSharedHistoryLookup({
        targetKey,
        role,
        userId: cleanUserId,
        targetReservationId,
        pathname,
        normalizedRawSearch,
        lookupFn,
      });
    }

    return {
      commands: EMPTY_HISTORY_ROUTE_COMMANDS,
      pendingLookup: subscribeCallerToHistoryLookup(activeLookup, signal),
    };
  }

  function normalizeRawSearchString(
    rawSearch?: string,
    searchParams?: SearchParamReadable | null
  ): string {
    if (typeof rawSearch === 'string') {
      return rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch;
    }
    if (searchParams && typeof searchParams.toString === 'function') {
      const serialized = searchParams.toString();
      if (serialized !== '[object Object]') {
        return serialized.startsWith('?') ? serialized.slice(1) : serialized;
      }
    }
    return '';
  }

  function reconcileHistoryRoute(
    opts: ReconcileHistoryRouteOptions
  ): ReconcileHistoryRouteResult {
    const feedbackEnabled = opts.feedbackEnabled ?? isFeedbackEnabled();
    const prevSnapshot = historyRuntime.cachedSnapshot;

    if (!feedbackEnabled) {
      resetHistoryRouteFields();
      const disabledState = buildHistoryRouteSnapshot(false);
      if (disabledState !== prevSnapshot) {
        notifyStateChange();
      }
      return {
        state: disabledState,
        commands: EMPTY_HISTORY_ROUTE_COMMANDS,
        pendingLookup: null,
      };
    }

    const normalizedRawSearch = normalizeRawSearchString(
      opts.rawSearch,
      opts.searchParams
    );
    const searchReader: SearchParamReadable =
      opts.searchParams ?? new URLSearchParams(normalizedRawSearch);
    const mode = opts.mode ?? 'all';
    const runDeepLink = mode === 'all' || mode === 'deep-link';
    const runQueue = mode === 'all' || mode === 'queue';
    const cleanUserId = opts.userId?.trim() ?? '';

    const targetReservationId = extractDeepLinkReservationId(searchReader);
    const isQueueRequested = isFeedbackQueueQueryRequested(searchReader);

    if (
      historyRuntime.trackedRole !== null &&
      historyRuntime.trackedRole !== opts.role
    ) {
      cancelHistoryLookup();
      historyRuntime.activeTargetKey = null;
      historyRuntime.handledKey = null;
      historyRuntime.autoLoadCount = 0;
      historyRuntime.lastAutoLoadHistoryLength = -1;
      historyRuntime.deepLinkDialogReservation = null;
      historyRuntime.highlightedReservationId = null;
      historyRuntime.autoExpandedReservationId = null;
      historyRuntime.latchedQueue = null;
      historyRuntime.queueDismissed = false;
    }
    historyRuntime.trackedRole = opts.role;
    historyRuntime.hasDeepLinkTarget = targetReservationId !== null;
    historyRuntime.isFeedbackQueueRequested = isQueueRequested;

    let commands: HistoryRouteCommands = {
      replaceHref: null,
      toast: null,
      shouldLoadMoreHistory: false,
    };
    let pendingLookup: Promise<ReconcileHistoryRouteStep> | null = null;

    if (runDeepLink) {
      if (!targetReservationId) {
        cancelHistoryLookup();
        historyRuntime.activeTargetKey = null;
        historyRuntime.handledKey = null;
        historyRuntime.autoLoadCount = 0;
        historyRuntime.lastAutoLoadHistoryLength = -1;
        historyRuntime.deepLinkDialogReservation = null;
      } else {
        const targetKey = `${opts.role}:${targetReservationId}`;
        if (historyRuntime.activeTargetKey !== targetKey) {
          cancelHistoryLookup();
          historyRuntime.activeTargetKey = targetKey;
          historyRuntime.autoLoadCount = 0;
          historyRuntime.lastAutoLoadHistoryLength = -1;
          historyRuntime.deepLinkDialogReservation = null;
        }

        if (historyRuntime.handledKey === targetKey) {
          pendingLookup = null;
        } else if (
          opts.isHistoryLoaded &&
          !opts.isLoadingHistory &&
          !opts.isLoadingMoreHistory
        ) {
          const outcome = resolveDeepLinkOutcome({
            role: opts.role,
            targetReservationId,
            history: opts.history,
          });

          if (outcome.kind !== 'not-found') {
            cancelHistoryLookup();
            commands = applyResolvedDeepLinkToRuntime(
              targetKey,
              outcome,
              opts.pathname,
              normalizedRawSearch
            );
          } else {
            const fallbackOutcome = resolveMissingHistoryDeepLink({
              targetKey,
              role: opts.role,
              cleanUserId,
              targetReservationId,
              pathname: opts.pathname,
              normalizedRawSearch,
              historyLength: opts.history.length,
              hasMoreHistory: opts.hasMoreHistory,
              canLoadMoreHistory: opts.canLoadMoreHistory,
              signal: opts.signal,
              lookupSingleFeedback: opts.lookupSingleFeedback,
            });
            commands = fallbackOutcome.commands;
            pendingLookup = fallbackOutcome.pendingLookup;
          }
        }
      }
    }

    if (runQueue) {
      const queueKey = `${opts.role}:${cleanUserId}`;
      if (!isQueueRequested) {
        historyRuntime.latchedQueue = null;
        historyRuntime.queueDismissed = false;
        historyRuntime.trackedQueueKey = queueKey;
      } else {
        if (
          historyRuntime.trackedQueueKey !== null &&
          historyRuntime.trackedQueueKey !== queueKey
        ) {
          historyRuntime.latchedQueue = null;
          historyRuntime.queueDismissed = false;
        }
        historyRuntime.trackedQueueKey = queueKey;

        const isSuppressedByDeepLink =
          targetReservationId !== null ||
          historyRuntime.deepLinkDialogReservation !== null;

        if (!isSuppressedByDeepLink) {
          const pendingItems = resolveExplicitQueueItems({
            userId: cleanUserId,
            role: opts.role,
            history: opts.history,
          });

          if (
            !historyRuntime.queueDismissed &&
            historyRuntime.latchedQueue === null &&
            pendingItems.length > 0
          ) {
            historyRuntime.latchedQueue = pendingItems;
          } else if (
            pendingItems.length === 0 &&
            historyRuntime.latchedQueue === null &&
            !historyRuntime.queueDismissed
          ) {
            const isHistoryReadyForQueueCheck =
              opts.isHistoryLoaded &&
              !opts.isLoadingHistory &&
              !(
                Boolean(opts.isLoadingUpcoming) &&
                Boolean(opts.isLoadingPending)
              );
            if (isHistoryReadyForQueueCheck) {
              historyRuntime.queueDismissed = true;
              commands = {
                ...commands,
                replaceHref:
                  commands.replaceHref ??
                  buildCleanedFeedbackQueueHref(
                    opts.pathname,
                    normalizedRawSearch
                  ),
              };
            }
          }
        }
      }
    }

    const nextState = buildHistoryRouteSnapshot(true);
    if (nextState !== prevSnapshot) {
      notifyStateChange();
    }

    return {
      state: nextState,
      commands,
      pendingLookup,
    };
  }

  function recordFeedbackOutcome(
    input: RecordFeedbackOutcomeInput
  ): RecordFeedbackOutcomeResult {
    const feedbackEnabled = input.feedbackEnabled ?? isFeedbackEnabled();
    if (!feedbackEnabled) {
      return {
        dismissedSkippedCount: 0,
        replaceHref: null,
      };
    }

    if (input.action === 'submit') {
      markReservationSubmitted(
        input.userId.trim(),
        input.reservationId.trim(),
        input.isQueueNowEmpty ?? false
      );
      return {
        dismissedSkippedCount: 0,
        replaceHref: null,
      };
    }

    if (input.action === 'skip') {
      markReservationSkipped(input.userId.trim(), input.reservationId.trim());
      return {
        dismissedSkippedCount: 0,
        replaceHref: null,
      };
    }

    if (input.action === 'clear-focus') {
      const prev = historyRuntime.cachedSnapshot;
      historyRuntime.deepLinkDialogReservation = null;
      historyRuntime.highlightedReservationId = null;
      historyRuntime.autoExpandedReservationId = null;
      const next = buildHistoryRouteSnapshot(true);
      if (next !== prev) {
        notifyStateChange();
      }
      return {
        dismissedSkippedCount: 0,
        replaceHref: null,
      };
    }

    // action === 'dismiss' | 'defer' | 'close'
    if (input.source === 'login-queue') {
      const { dismissedSkippedCount } = dismissLoginQueue(
        input.userId?.trim() ?? ''
      );
      return {
        dismissedSkippedCount,
        replaceHref: null,
      };
    }

    const normalizedSearch = normalizeRawSearchString(input.rawSearch);
    if (input.source === 'explicit-queue') {
      const prev = historyRuntime.cachedSnapshot;
      historyRuntime.queueDismissed = true;
      historyRuntime.latchedQueue = null;
      const next = buildHistoryRouteSnapshot(true);
      if (next !== prev) {
        notifyStateChange();
      }
      return {
        dismissedSkippedCount: 0,
        replaceHref: input.pathname
          ? buildCleanedFeedbackQueueHref(input.pathname, normalizedSearch)
          : null,
      };
    }

    // source === 'deep-link'
    const prev = historyRuntime.cachedSnapshot;
    historyRuntime.deepLinkDialogReservation = null;
    const next = buildHistoryRouteSnapshot(true);
    if (next !== prev) {
      notifyStateChange();
    }
    return {
      dismissedSkippedCount: 0,
      replaceHref: input.pathname
        ? buildCleanedDeepLinkHref(input.pathname, normalizedSearch)
        : null,
    };
  }

  async function resolveHistoryRedirect(opts: {
    authStatus?: 'authenticated' | 'unauthenticated';
    userId: string;
    fallbackRole: ReservationRouteRole;
    rawSearch: string;
    feedbackEnabled?: boolean;
    signal?: AbortSignal;
    lookupSingleFeedback?: FeedbackSessionLookupPort['fetchSingleReservationFeedback'];
  }): Promise<ResolvedHistoryRedirect> {
    const {
      authStatus = 'authenticated',
      fallbackRole,
      rawSearch,
      signal,
    } = opts;
    const feedbackEnabled = opts.feedbackEnabled ?? isFeedbackEnabled();

    if (authStatus === 'unauthenticated') {
      return {
        redirectHref: buildReservationHistorySignInCallbackHref(rawSearch, {
          feedbackEnabled,
        }),
        resolvedRole: fallbackRole,
        seeded: null,
      };
    }

    if (!feedbackEnabled) {
      return {
        redirectHref: buildReservationHistoryRedirectHref(
          fallbackRole,
          rawSearch,
          { feedbackEnabled: false }
        ),
        resolvedRole: fallbackRole,
        seeded: null,
      };
    }

    const cleanUserId = opts.userId.trim();
    const targetReservationId = extractDeepLinkReservationId(
      new URLSearchParams(rawSearch)
    );

    if (!targetReservationId || !cleanUserId) {
      return {
        redirectHref: buildReservationHistoryRedirectHref(
          fallbackRole,
          rawSearch,
          { feedbackEnabled: true }
        ),
        resolvedRole: fallbackRole,
        seeded: null,
      };
    }

    const lookupFn =
      opts.lookupSingleFeedback ??
      defaultLookup?.fetchSingleReservationFeedback;
    if (!lookupFn) {
      return {
        redirectHref: buildReservationHistoryRedirectHref(
          fallbackRole,
          rawSearch,
          { feedbackEnabled: true }
        ),
        resolvedRole: fallbackRole,
        seeded: null,
      };
    }

    try {
      const lookup = await lookupFn({
        userId: cleanUserId,
        reservationId: targetReservationId,
        fallbackRole,
        signal,
      });

      if (!signal?.aborted) {
        seedLookupResult({
          userId: cleanUserId,
          reservationId: targetReservationId,
          result: lookup,
        });
      }

      const resolvedRole = lookup?.viewerRole ?? fallbackRole;
      return {
        redirectHref: buildReservationHistoryRedirectHref(
          resolvedRole,
          rawSearch,
          { feedbackEnabled: true }
        ),
        resolvedRole,
        seeded: lookup,
      };
    } catch {
      return {
        redirectHref: buildReservationHistoryRedirectHref(
          fallbackRole,
          rawSearch,
          { feedbackEnabled: true }
        ),
        resolvedRole: fallbackRole,
        seeded: null,
      };
    }
  }

  function subscribe(listener: () => void): () => void {
    stateListeners.add(listener);
    return () => {
      stateListeners.delete(listener);
    };
  }

  return {
    getSessionState,
    getPresentedLoginQueue,
    getHistoryRouteState,
    clearAllSessionState,
    resetRuntimeLoginSession,
    resetHistoryRouteSession,
    reconcileLoginSession,
    reconcileHistoryRoute,
    recordFeedbackOutcome,
    resolveHistoryRedirect,
    subscribe,
  };
}

export type FeedbackSessionCoordinator = ReturnType<
  typeof createFeedbackSessionCoordinator
>;

export const feedbackSessionCoordinator = createFeedbackSessionCoordinator({
  lookup: defaultFeedbackSessionLookupPort,
});
