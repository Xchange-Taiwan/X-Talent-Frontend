import { safeGetStorage, safeSetStorage } from '@/lib/storage';
import {
  httpNotificationSource,
  type NotificationSource,
} from '@/services/notifications/notificationSource';
import type { NotificationItem } from '@/services/notifications/types';

export type { NotificationItem } from '@/services/notifications/types';

export type NotificationStatus = 'loading' | 'error' | 'empty' | 'success';

// Pure helper functions for key generation
const getStoreKey = (userId?: string): string => userId || 'generic';

const SEEN_COUNT_STORAGE_PREFIX = 'notif_seen_unread_count_';

const getStorageKey = (userId?: string): string =>
  `${SEEN_COUNT_STORAGE_PREFIX}${getStoreKey(userId)}`;

export interface SharedNotificationState {
  status: NotificationStatus;
  notifications: NotificationItem[];
  seenUnreadCount: number;
  nextCursor: string | null;
  unreadCountState: number;
  isLoadingMore: boolean;
  isPending: boolean;
  hasLoadMoreError: boolean;
  isFetching: boolean;
  isFetchingUnreadCount: boolean;
  markingReadIds: Set<string>;
  isMarkingAll: boolean;
}

/**
 * Outcome of a single `markRead(id)` call, reported back to the caller
 * instead of the caller having to inspect store state after the fact.
 * `skipped` covers every reason the model declined to act (already
 * marking, item missing/already read, or mutation not permitted for this
 * source/userId combination) - none of these are failures worth a toast.
 */
type MarkReadOutcome =
  | { status: 'skipped' }
  | { status: 'success' }
  | { status: 'failed'; error: unknown };

/**
 * A caller-supplied bulk mark-all-read action. Resolving with an array of
 * ids reports exactly which ones failed (empty/void means "all succeeded"),
 * letting `markAllRead` distinguish a total failure from a partial one
 * without the source having to throw a bespoke error type. Throwing is
 * still how a total, no-detail failure (e.g. the plain HTTP endpoint, or a
 * caller's own `onMarkAllRead` rejecting) is reported.
 */
type MarkAllReadBulkAction = (ids: string[]) => Promise<string[] | void>;

type MarkAllReadOutcome =
  | { status: 'skipped' }
  | { status: 'success' }
  | { status: 'partial-failed'; failedCount: number; totalCount: number }
  | { status: 'failed'; error: unknown };

type LoadMoreOutcome =
  | { status: 'skipped' }
  | { status: 'success' }
  | { status: 'failed'; error: unknown };

type RetryOutcome =
  /** No `source.retry` installed - caller should fall back to a normal reload. */
  | { status: 'unsupported' }
  /** Resolved/rejected after being superseded (a newer retry, or every subscriber for this key unsubscribed) - already discarded, nothing for the caller to do. */
  | { status: 'stale' }
  | { status: 'success' }
  | { status: 'failed'; error: unknown };

const getStoredSeenCount = (key: string): number => {
  if (typeof window === 'undefined') return 0;
  const stored = safeGetStorage(key);
  const parsed = stored !== null ? Number(stored) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const createInitialState = (
  userId?: string,
  initialNotifications?: NotificationItem[],
  initialStatus: NotificationStatus = 'success'
): SharedNotificationState => {
  const hasInitial = initialNotifications !== undefined;
  const storageKey = getStorageKey(userId);

  return {
    status: hasInitial ? initialStatus : 'loading',
    notifications: initialNotifications ?? [],
    seenUnreadCount: getStoredSeenCount(storageKey),
    nextCursor: null,
    unreadCountState: initialNotifications
      ? initialNotifications.filter((n) => n.unread).length
      : 0,
    isLoadingMore: false,
    isPending: false,
    hasLoadMoreError: false,
    isFetching: false,
    isFetchingUnreadCount: false,
    markingReadIds: new Set<string>(),
    isMarkingAll: false,
  };
};

// Safe structural comparison helper for the render-phase sync
function areNotificationsChanged(
  a: NotificationItem[] | undefined,
  b: NotificationItem[] | undefined
): boolean {
  if (a === b) return false;
  if (!a || !b) return true;
  if (a.length !== b.length) return true;
  return a.some(
    (item, index) =>
      item.id !== b[index].id ||
      item.unread !== b[index].unread ||
      item.type !== b[index].type
  );
}

class NotificationStoreManager {
  private states = new Map<string, SharedNotificationState>();
  private listeners = new Map<string, Set<() => void>>();
  private fetchPromises = new Map<string, Promise<void> | null>();
  private unreadCountFetchPromises = new Map<string, Promise<void> | null>();
  private unreadCountVersions = new Map<string, number>();
  // The NotificationSource is a per-store-key concern (which adapter a given
  // user's state talks to), not part of the rendered SharedNotificationState
  // - callers hand it off once (mount + on change) via setSource, instead of
  // threading it through every domain-action call.
  private sources = new Map<string, NotificationSource>();
  // Bumped whenever an in-flight `retry()` for a key must be discarded (a
  // newer retry superseded it, or every subscriber for the key unsubscribed
  // - see `subscribe` below), so a late resolution can't write a stale list
  // into the shared store.
  private retryEpochs = new Map<string, number>();

  constructor() {
    // Single, store-owned listener for cross-tab sync (instead of one per Hook instance).
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageEvent);
    }
  }

  private handleStorageEvent = (e: StorageEvent) => {
    if (!e.key || !e.key.startsWith(SEEN_COUNT_STORAGE_PREFIX)) return;
    const key = e.key.slice(SEEN_COUNT_STORAGE_PREFIX.length);
    const val = e.newValue !== null ? Number(e.newValue) : 0;
    const parsedVal = Number.isNaN(val) ? 0 : val;
    this.updateState(key, { seenUnreadCount: parsedVal });
  };

  /**
   * Domain Action: Persist the seen-unread-count to localStorage and the shared state.
   */
  setSeenCount(userId: string | undefined, val: number) {
    safeSetStorage(getStorageKey(userId), String(val));
    this.updateState(userId, { seenUnreadCount: val });
  }

  /**
   * Domain Action: Reconcile seenUnreadCount with whatever is currently in localStorage
   * (e.g. on Hook mount, when another tab may have written a newer value).
   */
  syncSeenCountFromStorage(userId: string | undefined) {
    const storedCount = getStoredSeenCount(getStorageKey(userId));
    const state = this.getOrCreateState(userId);
    if (state.seenUnreadCount !== storedCount) {
      this.updateState(userId, { seenUnreadCount: storedCount });
    }
  }

  getOrCreateState(
    userId?: string,
    initialNotifications?: NotificationItem[],
    initialStatus?: NotificationStatus
  ): SharedNotificationState {
    const key = getStoreKey(userId);

    // Prevent SSR memory leaks & cross-request state pollution in Next.js Server Side pre-rendering
    if (typeof window === 'undefined') {
      return createInitialState(userId, initialNotifications, initialStatus);
    }

    if (!this.states.has(key)) {
      this.states.set(
        key,
        createInitialState(userId, initialNotifications, initialStatus)
      );
      this.unreadCountVersions.set(key, 0);
    }
    return this.states.get(key)!;
  }

  private updateState(
    userId: string | undefined,
    updates: Partial<SharedNotificationState>
  ) {
    const key = getStoreKey(userId);
    const currentState = this.states.get(key);
    if (!currentState) return;

    this.states.set(key, {
      ...currentState,
      ...updates,
    });

    this.notify(key);
  }

  subscribe(userId: string | undefined, listener: () => void): () => void {
    const key = getStoreKey(userId);
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);

    return () => {
      const set = this.listeners.get(key);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(key);
          // Nobody is watching this key anymore - discard any retry still
          // in flight for it rather than let a late resolution write into
          // an unobserved store entry (see `retry` below).
          this.retryEpochs.set(key, (this.retryEpochs.get(key) ?? 0) + 1);
        }
      }
    };
  }

  private notify(key: string) {
    const set = this.listeners.get(key);
    if (set) {
      set.forEach((listener) => {
        try {
          listener();
        } catch (e) {
          console.error('[NotificationStoreManager] listener error:', e);
        }
      });
    }
  }

  clear() {
    this.states.clear();
    this.listeners.clear();
    this.fetchPromises.clear();
    this.unreadCountFetchPromises.clear();
    this.unreadCountVersions.clear();
    this.sources.clear();
    this.retryEpochs.clear();
  }

  /**
   * Domain Action: Record which NotificationSource a store key's operations
   * should be routed through. Callers (the hook) hand the source off here
   * once on mount and again whenever it changes, rather than passing it into
   * every operation.
   */
  setSource(userId: string | undefined, source: NotificationSource): void {
    const key = getStoreKey(userId);
    this.sources.set(key, source);
  }

  /**
   * Domain Action: Retrieve the NotificationSource previously handed off via
   * setSource for this store key, if any.
   */
  getSource(userId: string | undefined): NotificationSource | undefined {
    const key = getStoreKey(userId);
    return this.sources.get(key);
  }

  /**
   * Domain Action: Start marking a single notification as read optimistically.
   * Sets isPending to true, adds the ID to markingReadIds, and marks the notification as read.
   */
  private startMarkRead(userId: string | undefined, id: string): void {
    const state = this.getOrCreateState(userId);

    const markingReadIdsCopy = new Set(state.markingReadIds);
    markingReadIdsCopy.add(id);

    this.updateState(userId, {
      isPending: true,
      markingReadIds: markingReadIdsCopy,
      notifications: state.notifications.map((item) =>
        item.id === id ? { ...item, unread: false } : item
      ),
      unreadCountState: Math.max(0, state.unreadCountState - 1),
    });
  }

  /**
   * Domain Action: Successfully complete a single mark read operation.
   * Removes the ID from markingReadIds and sets isPending to false.
   */
  private completeMarkRead(userId: string | undefined, id: string): void {
    const state = this.getOrCreateState(userId);
    const markingReadIdsCopy = new Set(state.markingReadIds);
    markingReadIdsCopy.delete(id);

    this.updateState(userId, {
      isPending: false,
      markingReadIds: markingReadIdsCopy,
    });
  }

  /**
   * Domain Action: Roll back a single mark read operation on failure.
   * Only restores the unread state of the notification and increments the unread count
   * if the notification is currently marked as read (unread === false).
   * Also removes the ID from markingReadIds and sets isPending to false.
   */
  private failMarkRead(userId: string | undefined, id: string): void {
    const state = this.getOrCreateState(userId);
    const markingReadIdsCopy = new Set(state.markingReadIds);
    markingReadIdsCopy.delete(id);

    let countDiff = 0;
    const notifications = state.notifications.map((item) => {
      if (item.id === id && !item.unread) {
        countDiff += 1;
        return { ...item, unread: true };
      }
      return item;
    });

    this.updateState(userId, {
      isPending: false,
      markingReadIds: markingReadIdsCopy,
      ...(countDiff > 0
        ? {
            notifications,
            unreadCountState: state.unreadCountState + countDiff,
          }
        : {}),
    });
  }

  /**
   * Intent-level operation: mark a single notification as read.
   *
   * Owns the whole lifecycle end to end - reentry guard (skips if this id is
   * already being marked, missing, or already read), the optimistic update,
   * calling `action` (or, if omitted, this store key's installed
   * NotificationSource via `getSource`), and rollback on failure. The
   * caller never touches the start/complete/fail sequence directly, so
   * there is no way to forget the failure branch and leave a notification
   * stuck "marking" forever.
   *
   * `action` mirrors the hook's optional `onMarkRead` prop: when provided,
   * it replaces the installed source's `markOneRead` for this one call
   * (used by tests/Storybook DI), otherwise the source is used.
   */
  async markRead(
    userId: string | undefined,
    id: string,
    action?: (id: string) => void | Promise<void>
  ): Promise<MarkReadOutcome> {
    const source = this.getSource(userId) ?? httpNotificationSource;
    const canMutate = userId !== undefined || !source.requiresAuth;
    if (!canMutate) return { status: 'skipped' };

    const state = this.getOrCreateState(userId);
    if (state.markingReadIds.has(id)) return { status: 'skipped' };

    const targetItem = state.notifications.find((n) => n.id === id);
    if (!targetItem || !targetItem.unread) return { status: 'skipped' };

    this.startMarkRead(userId, id);

    const effectiveUserId = userId || 'generic';
    const doMark =
      action ??
      ((markId: string) => source.markOneRead(effectiveUserId, markId));

    try {
      await doMark(id);
      this.completeMarkRead(userId, id);
      return { status: 'success' };
    } catch (error) {
      this.failMarkRead(userId, id);
      return { status: 'failed', error };
    }
  }

  /**
   * Domain Action: Start marking all notifications as read optimistically.
   * Sets isPending and isMarkingAll to true, and marks all notifications as read.
   * Returns unread IDs and a self-contained rollback function, fully encapsulating rollback details.
   * The rollback closure dynamically updates the current notifications list rather than overwriting with an old snapshot,
   * protecting against loss of concurrent notifications added during the API request.
   */
  private startMarkAllRead(userId: string | undefined): {
    unreadIds: string[];
    rollback: () => void;
  } {
    const key = getStoreKey(userId);
    const state = this.getOrCreateState(userId);
    const previousCount = state.unreadCountState;
    const previousIsMarkingAll = state.isMarkingAll;
    const prevVersion = this.unreadCountVersions.get(key) ?? 0;

    const unreadIds = state.notifications
      .filter((item) => item.unread)
      .map((item) => item.id);

    const unreadIdSet = new Set(unreadIds);
    this.updateState(userId, {
      isPending: true,
      notifications: state.notifications.map((item) =>
        unreadIdSet.has(item.id) ? { ...item, unread: false } : item
      ),
      unreadCountState: 0,
      isMarkingAll: true,
    });

    const rollback = () => {
      const currentState = this.getOrCreateState(userId);
      const currentVersion = this.unreadCountVersions.get(key) ?? 0;

      const notifications = currentState.notifications.map((item) => {
        if (unreadIdSet.has(item.id) && !item.unread) {
          return { ...item, unread: true };
        }
        return item;
      });

      this.updateState(userId, {
        notifications,
        isMarkingAll: previousIsMarkingAll,
        unreadCountState:
          currentVersion === prevVersion
            ? previousCount
            : currentState.unreadCountState,
      });
    };

    return {
      unreadIds,
      rollback,
    };
  }

  /**
   * Domain Action: Complete mark all read operation.
   * Clears isPending and isMarkingAll.
   */
  private completeMarkAllRead(userId: string | undefined) {
    this.updateState(userId, {
      isPending: false,
      isMarkingAll: false,
    });
  }

  /**
   * Domain Action: Rollback specific notifications to unread (e.g. on
   * mark-read/mark-all-read failure), restoring the unread badge count for
   * each one rolled back. Callers just name which ids failed - the count
   * math lives here instead of being re-derived at each call site.
   */
  private rollbackNotifications(userId: string | undefined, ids: string[]) {
    const state = this.getOrCreateState(userId);
    const idSet = new Set(ids);

    this.updateState(userId, {
      notifications: state.notifications.map((item) =>
        idSet.has(item.id) ? { ...item, unread: true } : item
      ),
      unreadCountState: state.unreadCountState + ids.length,
    });
  }

  /**
   * Intent-level operation: mark every unread notification as read.
   *
   * Owns reentry guard (`isMarkingAll`), the optimistic clear, and rollback
   * on failure end to end. Without `bulkAction`, it calls this store key's
   * installed NotificationSource's `markAllRead` once and rolls back
   * everything on failure. With `bulkAction` (mirrors the hook's optional
   * `onMarkAllRead`/`onMarkRead` props), the caller can instead resolve
   * with the subset of ids that failed - `markAllRead` rolls back only
   * those, and reports whether it was a total or partial failure so the
   * caller can choose the right toast copy.
   */
  async markAllRead(
    userId: string | undefined,
    bulkAction?: MarkAllReadBulkAction
  ): Promise<MarkAllReadOutcome> {
    const source = this.getSource(userId) ?? httpNotificationSource;
    const canMutate = userId !== undefined || !source.requiresAuth;
    if (!canMutate) return { status: 'skipped' };

    const state = this.getOrCreateState(userId);
    if (state.isMarkingAll) return { status: 'skipped' };

    const unreadIds = state.notifications
      .filter((item) => item.unread)
      .map((item) => item.id);
    if (unreadIds.length === 0 && state.unreadCountState === 0) {
      return { status: 'skipped' };
    }

    const { unreadIds: optimUnreadIds, rollback } =
      this.startMarkAllRead(userId);
    const effectiveUserId = userId || 'generic';

    try {
      if (bulkAction) {
        const failedIds = (await bulkAction(optimUnreadIds)) ?? [];
        if (failedIds.length > 0) {
          this.rollbackNotifications(userId, failedIds);
          this.completeMarkAllRead(userId);
          return {
            status: 'partial-failed',
            failedCount: failedIds.length,
            totalCount: optimUnreadIds.length,
          };
        }
      } else {
        await source.markAllRead(effectiveUserId);
      }
      this.completeMarkAllRead(userId);
      return { status: 'success' };
    } catch (error) {
      rollback();
      this.completeMarkAllRead(userId);
      return { status: 'failed', error };
    }
  }

  /**
   * Domain Action: Prepare state for loading more notifications
   */
  private startLoadMore(userId: string | undefined) {
    this.updateState(userId, {
      isLoadingMore: true,
      hasLoadMoreError: false,
    });
  }

  /**
   * Domain Action: Record an error during loading more notifications
   */
  private failLoadMore(userId: string | undefined) {
    this.updateState(userId, {
      hasLoadMoreError: true,
    });
  }

  /**
   * Domain Action: Complete the load more operation (clear loading flag)
   */
  private completeLoadMore(userId: string | undefined) {
    this.updateState(userId, {
      isLoadingMore: false,
    });
  }

  /**
   * Domain Action: Append a newly loaded page of notifications
   */
  private appendNotifications(
    userId: string | undefined,
    items: NotificationItem[],
    nextCursor: string | null
  ) {
    const state = this.getOrCreateState(userId);
    this.updateState(userId, {
      notifications: [...state.notifications, ...items],
      nextCursor,
    });
  }

  /**
   * Intent-level operation: load the next page of notifications.
   *
   * Owns the in-flight/error-gate reentry guard (`isLoadingMore`,
   * `nextCursor`, `hasLoadMoreError`, `isFetching`) and the installed
   * source's own preloaded/requires-auth skip conditions, so the caller
   * just calls `loadMore(userId)` (optionally `isRetry: true` to bypass a
   * previous load-more error) without re-deriving any of those guards
   * itself.
   */
  async loadMore(
    userId: string | undefined,
    isRetry = false
  ): Promise<LoadMoreOutcome> {
    const source = this.getSource(userId) ?? httpNotificationSource;
    const shouldSkip = Boolean(
      source.isPreloaded || (!userId && source.requiresAuth)
    );
    if (shouldSkip) return { status: 'skipped' };

    const state = this.getOrCreateState(userId);
    if (state.isLoadingMore || !state.nextCursor) return { status: 'skipped' };
    if (state.hasLoadMoreError && !isRetry) return { status: 'skipped' };
    if (state.isFetching) return { status: 'skipped' };

    this.startLoadMore(userId);
    const effectiveUserId = userId || 'generic';

    try {
      const res = await source.listNotifications(
        effectiveUserId,
        state.nextCursor,
        20
      );
      this.appendNotifications(
        userId,
        (res && res.notifications) || [],
        (res && res.next_cursor) || null
      );
      return { status: 'success' };
    } catch (error) {
      this.failLoadMore(userId);
      return { status: 'failed', error };
    } finally {
      this.completeLoadMore(userId);
    }
  }

  /**
   * Domain Action: Start connection retry.
   * Sets status to 'loading'.
   */
  private startRetry(userId: string | undefined) {
    this.updateState(userId, {
      status: 'loading',
    });
  }

  /**
   * Domain Action: Fail connection retry.
   * Sets status to 'error'.
   */
  private failRetry(userId: string | undefined) {
    this.updateState(userId, {
      status: 'error',
    });
  }

  /**
   * Intent-level operation: retry loading after an error, delegating to the
   * installed source's own `retry` handling when it has one.
   *
   * Owns the in-flight dedup/staleness guard itself (a per-key epoch,
   * bumped by a newer `retry()` call or by the last subscriber for this key
   * unsubscribing - see `subscribe`), so a resolution that arrives after
   * either can't clobber fresher state. Returns `{ status: 'unsupported' }`
   * when the source has no `retry` - the caller is expected to fall back to
   * its normal initial-load path in that case, since that path isn't part
   * of this ticket's scope.
   */
  async retry(userId: string | undefined): Promise<RetryOutcome> {
    this.startRetry(userId);

    const source = this.getSource(userId) ?? httpNotificationSource;
    if (!source.retry) {
      return { status: 'unsupported' };
    }

    const key = getStoreKey(userId);
    const epoch = (this.retryEpochs.get(key) ?? 0) + 1;
    this.retryEpochs.set(key, epoch);
    const effectiveUserId = userId || 'generic';

    try {
      const notifications = await source.retry(effectiveUserId);
      if (this.retryEpochs.get(key) !== epoch) return { status: 'stale' };
      // Reuse the same domain action the normal load path writes through,
      // so a concurrent unread-count fetch can't clobber this with a stale
      // value - see its unreadCountVersion guard.
      this.setInitialData(
        userId,
        notifications.filter((n) => n.unread).length,
        notifications,
        null
      );
      return { status: 'success' };
    } catch (error) {
      if (this.retryEpochs.get(key) !== epoch) return { status: 'stale' };
      this.failRetry(userId);
      return { status: 'failed', error };
    }
  }

  /**
   * Domain Action: Update just the unread badge count, without touching the
   * notification list/status. Used for the passive mount-time fetch - the
   * badge must be visible before the user ever opens the dropdown, but the
   * list itself is fetched lazily on open (see loadInitialData below).
   *
   * When `expectedVersion` is given, the write is skipped if
   * `unreadCountVersion` has already moved on (e.g. a concurrent
   * setInitialData landed first) - guards against this slower write
   * clobbering fresher data with a stale unread count.
   */
  setUnreadCount(
    userId: string | undefined,
    unreadCount: number,
    expectedVersion?: number
  ) {
    const key = getStoreKey(userId);
    const currentVersion = this.unreadCountVersions.get(key) ?? 0;
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      return;
    }
    this.unreadCountVersions.set(key, currentVersion + 1);
    this.updateState(userId, {
      unreadCountState: unreadCount,
    });
  }

  /**
   * Domain Action: Fetch a fresh unread count via `fetcher`, deduplicating
   * concurrent calls across sibling hook instances (e.g. Header + MobileMenu
   * mounting at once) and discarding the result if a fresher count already
   * landed (via setInitialData/setUnreadCount) while `fetcher` was in
   * flight. Callers own error handling: `fetcher` must resolve to a count,
   * or `undefined` to skip the write (e.g. after reporting a failure).
   */
  async fetchUnreadCountWithDeduplication(
    userId: string | undefined,
    fetcher: () => Promise<number | undefined>
  ): Promise<void> {
    const key = getStoreKey(userId);
    const state = this.getOrCreateState(userId);

    if (state.isFetchingUnreadCount) {
      const existingPromise = this.unreadCountFetchPromises.get(key);
      if (existingPromise) {
        await existingPromise;
      }
      return;
    }

    const versionAtStart = this.unreadCountVersions.get(key) ?? 0;

    const fetchPromise = (async () => {
      try {
        const unreadCount = await fetcher();
        if (unreadCount !== undefined) {
          this.setUnreadCount(userId, unreadCount, versionAtStart);
        }
      } finally {
        this.unreadCountFetchPromises.delete(key);
        this.updateState(userId, {
          isFetchingUnreadCount: false,
        });
      }
    })();

    this.unreadCountFetchPromises.set(key, fetchPromise);
    this.updateState(userId, {
      isFetchingUnreadCount: true,
    });

    await fetchPromise;
  }

  /**
   * Domain Action: Set initially loaded notifications and counts
   */
  setInitialData(
    userId: string | undefined,
    unreadCount: number,
    items: NotificationItem[],
    nextCursor: string | null
  ) {
    const key = getStoreKey(userId);
    const currentVersion = this.unreadCountVersions.get(key) ?? 0;
    this.unreadCountVersions.set(key, currentVersion + 1);

    this.updateState(userId, {
      unreadCountState: unreadCount,
      notifications: items,
      nextCursor,
      status: items.length === 0 ? 'empty' : 'success',
      hasLoadMoreError: false,
    });
  }

  /**
   * Domain Action: Fetch initial notifications and unread count structurally with deduplication.
   * Correctly resets the status to 'success' or 'error' on error, avoiding the loading spinner hanging forever.
   */
  async fetchInitialDataWithDeduplication(
    userId: string | undefined,
    showLoading: boolean,
    fetcher: () => Promise<{
      unreadCount: number;
      notifications: NotificationItem[];
      nextCursor: string | null;
    }>,
    onFailure?: (error: unknown, hasExistingNotifications: boolean) => void
  ): Promise<void> {
    const key = getStoreKey(userId);
    const state = this.getOrCreateState(userId);

    if (state.isFetching) {
      const existingPromise = this.fetchPromises.get(key);
      if (existingPromise) {
        await existingPromise;
      }
      return;
    }

    const fetchPromise = (async () => {
      try {
        const res = await fetcher();
        this.setInitialData(
          userId,
          res.unreadCount,
          res.notifications,
          res.nextCursor
        );
      } catch (error) {
        const currentState = this.getOrCreateState(userId);
        const hasExisting = currentState.notifications.length > 0;
        if (onFailure) {
          onFailure(error, hasExisting);
        }
        this.updateState(userId, {
          status: hasExisting ? 'success' : 'error',
        });
      } finally {
        this.fetchPromises.delete(key);
        this.updateState(userId, {
          isFetching: false,
        });
      }
    })();

    this.fetchPromises.set(key, fetchPromise);
    this.updateState(userId, {
      isFetching: true,
      ...(showLoading ? { status: 'loading' } : {}),
    });

    await fetchPromise;
  }

  /**
   * Domain Action: Sync initial notifications and status prop changes structurally into the shared store.
   * Correctly advances the unreadCountVersions version number on changes to guard against slow background fetch races.
   */
  syncInitialNotifications(
    userId: string | undefined,
    initialNotifications: NotificationItem[],
    initialStatus: NotificationStatus
  ) {
    const state = this.getOrCreateState(userId);
    if (
      areNotificationsChanged(initialNotifications, state.notifications) ||
      initialStatus !== state.status
    ) {
      const key = getStoreKey(userId);
      const currentVersion = this.unreadCountVersions.get(key) ?? 0;
      this.unreadCountVersions.set(key, currentVersion + 1);

      this.updateState(userId, {
        notifications: initialNotifications,
        status: initialStatus,
        unreadCountState: initialNotifications.filter((n) => n.unread).length,
      });
    }
  }
}

export const notificationStoreManager = new NotificationStoreManager();

export function resetNotificationStore(): void {
  notificationStoreManager.clear();
}
