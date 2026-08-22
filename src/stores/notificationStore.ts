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
  fetchPromise: Promise<void> | null;
  isFetchingUnreadCount: boolean;
  unreadCountFetchPromise: Promise<void> | null;
  unreadCountVersion: number;
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
  const isUsingProps = initialNotifications !== undefined;
  const storageKey = getStorageKey(userId);

  return {
    status: isUsingProps ? initialStatus : 'loading',
    notifications: initialNotifications ?? [],
    seenUnreadCount: getStoredSeenCount(storageKey),
    nextCursor: null,
    unreadCountState: 0,
    isLoadingMore: false,
    isPending: false,
    hasLoadMoreError: false,
    isFetching: false,
    fetchPromise: null,
    isFetchingUnreadCount: false,
    unreadCountFetchPromise: null,
    unreadCountVersion: 0,
    markingReadIds: new Set<string>(),
    isMarkingAll: false,
  };
};

class NotificationStoreManager {
  private states = new Map<string, SharedNotificationState>();
  private listeners = new Map<string, Set<() => void>>();

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
    }
    return this.states.get(key)!;
  }

  updateState(
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

  /**
   * Domain Action: Remove a single id from markingReadIds (e.g. on completion or cleanup),
   * optionally merging additional state updates into the same write.
   */
  removeMarkingReadId(
    userId: string | undefined,
    id: string,
    extraUpdates?: Partial<SharedNotificationState>
  ) {
    const state = this.getOrCreateState(userId);
    const markingReadIdsCopy = new Set(state.markingReadIds);
    markingReadIdsCopy.delete(id);
    this.updateState(userId, {
      markingReadIds: markingReadIdsCopy,
      ...extraUpdates,
    });
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
  }

  /**
   * Domain Action: Optimistically mark a single notification as read
   */
  markReadOptimistic(
    userId: string | undefined,
    id: string,
    isUsingProps: boolean
  ): void {
    const state = this.getOrCreateState(userId);

    const markingReadIdsCopy = new Set(state.markingReadIds);
    markingReadIdsCopy.add(id);

    this.updateState(userId, {
      notifications: state.notifications.map((item) =>
        item.id === id ? { ...item, unread: false } : item
      ),
      unreadCountState: isUsingProps
        ? state.unreadCountState
        : Math.max(0, state.unreadCountState - 1),
      markingReadIds: markingReadIdsCopy,
    });
  }

  /**
   * Domain Action: Optimistically mark all notifications as read
   */
  markAllReadOptimistic(
    userId: string | undefined,
    isUsingProps: boolean
  ): {
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
      notifications: state.notifications.map((item) =>
        unreadIdSet.has(item.id) ? { ...item, unread: false } : item
      ),
      ...(!isUsingProps ? { unreadCountState: 0 } : {}),
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
   * Domain Action: Rollback only specific notifications (e.g. on batch failure)
   */
  rollbackNotifications(
    userId: string | undefined,
    ids: string[],
    unreadCountState?: number
  ) {
    const state = this.getOrCreateState(userId);
    const idSet = new Set(ids);

    this.updateState(userId, {
      notifications: state.notifications.map((item) =>
        idSet.has(item.id) ? { ...item, unread: true } : item
      ),
      ...(unreadCountState !== undefined ? { unreadCountState } : {}),
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
    const state = this.getOrCreateState(userId);
    if (
      expectedVersion !== undefined &&
      expectedVersion !== state.unreadCountVersion
    ) {
      return;
    }
    this.updateState(userId, {
      unreadCountState: unreadCount,
      unreadCountVersion: state.unreadCountVersion + 1,
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
    const state = this.getOrCreateState(userId);

    if (state.isFetchingUnreadCount) {
      if (state.unreadCountFetchPromise) {
        await state.unreadCountFetchPromise;
      }
      return;
    }

    const versionAtStart = state.unreadCountVersion;

    const fetchPromise = (async () => {
      try {
        const unreadCount = await fetcher();
        if (unreadCount !== undefined) {
          this.setUnreadCount(userId, unreadCount, versionAtStart);
        }
      } finally {
        this.updateState(userId, {
          isFetchingUnreadCount: false,
          unreadCountFetchPromise: null,
        });
      }
    })();

    this.updateState(userId, {
      isFetchingUnreadCount: true,
      unreadCountFetchPromise: fetchPromise,
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
    const state = this.getOrCreateState(userId);
    this.updateState(userId, {
      unreadCountState: unreadCount,
      unreadCountVersion: state.unreadCountVersion + 1,
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
}

export const notificationStoreManager = new NotificationStoreManager();

export function resetNotificationStore(): void {
  notificationStoreManager.reset();
}
