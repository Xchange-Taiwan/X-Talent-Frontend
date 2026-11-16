import { isFeedbackEnabled } from '@/lib/featureFlags';
import { captureFlowFailure } from '@/lib/monitoring';
import { isEligibleForPendingFeedbackQueue } from '@/lib/reservation/reservationLifecyclePolicy';
import {
  buildReservationHistoryRedirectHref,
  extractDeepLinkReservationId,
  isFeedbackQueueQueryRequested,
  type ReservationRouteRole,
} from '@/lib/reservation/reservationRoutes';
import { normalizeReservationViewerRole } from '@/lib/reservation/resolveCounterparty';
import { MENTOR_ONBOARDING_KEY, OPEN_SCHEDULE_DIALOG_KEY } from '@/lib/routes';
import type { Reservation } from '@/types/reservation';

export const PENDING_FEEDBACK_SESSION_PREFIX = 'xtalent:pending-feedback:';
export const DEFAULT_LOOKUP_SEED_TTL_MS = 60_000;

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

export type ConsumedLookupSeed =
  { hit: false } | { hit: true; result: SeededReservationLookup | null };

export interface ResolvedHistoryRedirect {
  redirectHref: string;
  resolvedRole: ReservationRouteRole;
  seeded: SeededReservationLookup | null;
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

/**
 * Sorts pending feedback meetings chronologically by end time (`dtend`) from
 * oldest to newest (`由舊到新`), breaking ties by `dtstart` and `id` (#760 §6).
 */
export function sortPendingFeedbackOldestFirst(
  items: readonly Reservation[]
): Reservation[] {
  return [...items].sort((a, b) => {
    const aEnd = typeof a.dtend === 'number' ? a.dtend : 0;
    const bEnd = typeof b.dtend === 'number' ? b.dtend : 0;
    if (aEnd !== bEnd) {
      return aEnd - bEnd;
    }
    const aStart = typeof a.dtstart === 'number' ? a.dtstart : 0;
    const bStart = typeof b.dtstart === 'number' ? b.dtstart : 0;
    if (aStart !== bStart) {
      return aStart - bStart;
    }
    return String(a.id).localeCompare(String(b.id), undefined, {
      numeric: true,
    });
  });
}

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

interface StoredLookupSeedEntry {
  userId: string;
  reservationId: string;
  result: SeededReservationLookup | null;
  seededAt: number;
}

export function createFeedbackSessionCoordinator(
  options: CreateFeedbackSessionCoordinatorOptions = {}
) {
  const storage = options.storage ?? createBrowserFeedbackSessionStoragePort();
  const defaultLookup = options.lookup;
  const now = options.now ?? (() => Date.now());
  const seedTtlMs = options.seedTtlMs ?? DEFAULT_LOOKUP_SEED_TTL_MS;
  const reportError =
    options.onError ??
    ((
      error: unknown,
      context: { step: 'load_login_queue'; userId: string }
    ) => {
      void captureFlowFailure({
        flow: 'pending_feedback_queue',
        step: context.step,
        message: error instanceof Error ? error.message : String(error),
        level: 'warning',
      });
    });

  const stateListeners = new Set<() => void>();
  const submittedListeners = new Set<
    (userId: string, reservationId: string) => void
  >();

  const runtimeSubmittedByUser = new Map<string, Set<string>>();
  const seededLookups = new Map<string, StoredLookupSeedEntry>();

  const loginRuntime = {
    trackedUserId: null as string | null,
    fetchedUserId: null as string | null,
    isPresenting: false,
    presentedItems: null as Reservation[] | null,
    activeIds: [] as string[],
  };

  function notifyStateChange(): void {
    Array.from(stateListeners).forEach((listener) => {
      listener();
    });
  }

  function notifyReservationSubmitted(
    userId: string,
    reservationId: string
  ): void {
    Array.from(submittedListeners).forEach((listener) => {
      listener(userId, reservationId);
    });
    notifyStateChange();
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
    notifyReservationSubmitted(userId, reservationId);
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
    notifyStateChange();
  }

  function resetRuntimeLoginSession(): void {
    loginRuntime.fetchedUserId = null;
    loginRuntime.isPresenting = false;
    loginRuntime.presentedItems = null;
    loginRuntime.activeIds = [];
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
      loginRuntime.isPresenting = false;
      return null;
    }
    loginRuntime.trackedUserId = opts.userId;
    loginRuntime.isPresenting = opts.canPresent;
    if (!opts.canPresent) {
      const changed = pruneLoginQueueForUser(opts.userId, true);
      if (changed) {
        notifyStateChange();
      }
      return null;
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

  async function loadLoginQueue(opts: {
    userId: string;
    isMentor: boolean;
    signal?: AbortSignal;
    fetchPending?: FeedbackSessionLookupPort['fetchPendingFeedbackReservations'];
  }): Promise<Reservation[] | null> {
    const { userId, isMentor, signal } = opts;
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
        loginRuntime.trackedUserId = userId;
        loginRuntime.fetchedUserId = userId;
        loginRuntime.activeIds = [];
        loginRuntime.presentedItems = null;
        notifyStateChange();
        reportError(error, { step: 'load_login_queue', userId });
      }
      return null;
    }
  }

  function dismissLoginQueue(userId: string): void {
    if (userId) {
      const persisted = getSessionState(userId);
      const hasSkippedOrRemaining =
        loginRuntime.activeIds.length > 0 || persisted.skippedIds.length > 0;

      if (hasSkippedOrRemaining) {
        markDismissed(userId, loginRuntime.activeIds);
      } else {
        markChecked(userId, false);
      }
    }
    loginRuntime.activeIds = [];
    loginRuntime.presentedItems = null;
    notifyStateChange();
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

  function clearSeededLookup(opts: {
    userId?: string;
    reservationId: string;
  }): void {
    const cleanReservationId = opts.reservationId.trim();
    if (!cleanReservationId) return;
    const cleanUserId = opts.userId?.trim() ?? '';

    if (cleanUserId) {
      seededLookups.delete(getLookupSeedKey(cleanUserId, cleanReservationId));
      return;
    }

    Array.from(seededLookups.entries()).forEach(([key, entry]) => {
      if (entry.reservationId === cleanReservationId) {
        seededLookups.delete(key);
      }
    });
  }

  async function resolveHistoryRedirect(opts: {
    userId: string;
    fallbackRole: ReservationRouteRole;
    rawSearch: string;
    feedbackEnabled?: boolean;
    signal?: AbortSignal;
    lookupSingleFeedback?: FeedbackSessionLookupPort['fetchSingleReservationFeedback'];
  }): Promise<ResolvedHistoryRedirect> {
    const { fallbackRole, rawSearch, signal } = opts;
    const feedbackEnabled = opts.feedbackEnabled ?? isFeedbackEnabled();
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

  function subscribeReservationSubmitted(
    listener: (userId: string, reservationId: string) => void
  ): () => void {
    submittedListeners.add(listener);
    return () => {
      submittedListeners.delete(listener);
    };
  }

  return {
    getSessionState,
    markChecked,
    markDismissed,
    markReservationSubmitted,
    markReservationSkipped,
    clearAllSessionState,
    resetRuntimeLoginSession,
    syncAuthSession,
    syncLoginQueuePresentation,
    getPresentedLoginQueue,
    shouldFetchLoginQueue,
    loadLoginQueue,
    dismissLoginQueue,
    resolveExplicitQueueItems,
    seedLookupResult,
    consumeSeededLookup,
    clearSeededLookup,
    resolveHistoryRedirect,
    subscribe,
    subscribeReservationSubmitted,
  };
}

export type FeedbackSessionCoordinator = ReturnType<
  typeof createFeedbackSessionCoordinator
>;

export const feedbackSessionCoordinator = createFeedbackSessionCoordinator();
