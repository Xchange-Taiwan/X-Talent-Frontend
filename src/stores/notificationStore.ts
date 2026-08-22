import { safeGetStorage, safeSetStorage } from '@/lib/storage';
import type { NotificationItem } from '@/services/notifications/types';

export type { NotificationItem } from '@/services/notifications/types';

export type NotificationStatus = 'loading' | 'error' | 'empty' | 'success';

// Pure helper functions for key generation
export const getStoreKey = (userId?: string): string => userId || 'generic';

const SEEN_COUNT_STORAGE_PREFIX = 'notif_seen_unread_count_';

export const getStorageKey = (userId?: string): string =>
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

export const getStoredSeenCount = (key: string): number => {
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

  reset() {
    this.states.clear();
    this.listeners.clear();
    this.fetchPromises.clear();
    this.unreadCountFetchPromises.clear();
    this.unreadCountVersions.clear();
  }

  /**
   * Domain Action: Start marking a single notification as read optimistically.
   * Sets isPending to true, adds the ID to markingReadIds, and marks the notification as read.
   */
  startMarkRead(userId: string | undefined, id: string): void {
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
  completeMarkRead(userId: string | undefined, id: string): void {
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
   * Restores the unread state of the notification, increments the unread count,
   * removes the ID from markingReadIds, and sets isPending to false.
   */
  failMarkRead(userId: string | undefined, id: string): void {
    const state = this.getOrCreateState(userId);
    const markingReadIdsCopy = new Set(state.markingReadIds);
    markingReadIdsCopy.delete(id);

    this.updateState(userId, {
      isPending: false,
      markingReadIds: markingReadIdsCopy,
      notifications: state.notifications.map((item) =>
        item.id === id ? { ...item, unread: true } : item
      ),
      unreadCountState: state.unreadCountState + 1,
    });
  }

  /**
   * Domain Action: Start marking all notifications as read optimistically.
   * Sets isPending and isMarkingAll to true, and marks all notifications as read.
   * Returns original values for rollback purposes.
   */
  startMarkAllRead(userId: string | undefined): {
    previousNotifications: NotificationItem[];
    previousCount: number;
    unreadIds: string[];
    previousIsMarkingAll: boolean;
  } {
    const state = this.getOrCreateState(userId);
    const previousNotifications = [...state.notifications];
    const previousCount = state.unreadCountState;
    const previousIsMarkingAll = state.isMarkingAll;

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

    return {
      previousNotifications,
      previousCount,
      unreadIds,
      previousIsMarkingAll,
    };
  }

  /**
   * Domain Action: Complete mark all read operation.
   * Clears isPending and isMarkingAll.
   */
  completeMarkAllRead(userId: string | undefined) {
    this.updateState(userId, {
      isPending: false,
      isMarkingAll: false,
    });
  }

  /**
   * Domain Action: Start connection retry.
   * Sets status to 'loading'.
   */
  startRetry(userId: string | undefined) {
    this.updateState(userId, {
      status: 'loading',
    });
  }

  /**
   * Domain Action: Fail connection retry.
   * Sets status to 'error'.
   */
  failRetry(userId: string | undefined) {
    this.updateState(userId, {
      status: 'error',
    });
  }

  /**
   * Domain Action: Rollback specific notifications to unread (e.g. on
   * mark-read/mark-all-read failure), restoring the unread badge count for
   * each one rolled back. Callers just name which ids failed - the count
   * math lives here instead of being re-derived at each call site.
   */
  rollbackNotifications(userId: string | undefined, ids: string[]) {
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
   * Domain Action: Append a newly loaded page of notifications
   */
  appendNotifications(
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
   * Domain Action: Prepare state for loading more notifications
   */
  startLoadMore(userId: string | undefined) {
    this.updateState(userId, {
      isLoadingMore: true,
      hasLoadMoreError: false,
    });
  }

  /**
   * Domain Action: Record an error during loading more notifications
   */
  failLoadMore(userId: string | undefined) {
    this.updateState(userId, {
      hasLoadMoreError: true,
    });
  }

  /**
   * Domain Action: Complete the load more operation (clear loading flag)
   */
  completeLoadMore(userId: string | undefined) {
    this.updateState(userId, {
      isLoadingMore: false,
    });
  }

  /**
   * Domain Action: Fetch initial notifications and unread count structurally with deduplication
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
        if (showLoading && !hasExisting) {
          this.updateState(userId, { status: 'error' });
        }
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
   * Domain Action: Sync initial notifications and status prop changes structurally into the shared store
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
      this.updateState(userId, {
        notifications: initialNotifications,
        status: initialStatus,
        unreadCountState: initialNotifications.filter((n) => n.unread).length,
      });
    }
  }

  /**
   * Domain Action: Rollback mark all read completely on error
   */
  rollbackMarkAllRead(
    userId: string | undefined,
    previousNotifications: NotificationItem[],
    previousCount: number,
    previousIsMarkingAll: boolean
  ) {
    this.updateState(userId, {
      notifications: previousNotifications,
      unreadCountState: previousCount,
      isMarkingAll: previousIsMarkingAll,
    });
  }
}

export const notificationStoreManager = new NotificationStoreManager();

export function resetNotificationStore(): void {
  notificationStoreManager.reset();
}
