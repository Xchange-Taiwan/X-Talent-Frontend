import { safeGetStorage } from '@/lib/storage';

export type NotificationItem = {
  id: string;
  type:
    | 'reservation_new'
    | 'reservation_success'
    | 'reservation_failed'
    | 'reservation_canceled'
    | 'reservation_upcoming';
  menteeName?: string;
  mentorName?: string;
  createdAt: string; // ISO string
  unread?: boolean;
  role?: 'mentor' | 'mentee';
};

export type NotificationStatus = 'loading' | 'error' | 'empty' | 'success';

// Pure helper functions for key generation
export const getStoreKey = (userId?: string): string => userId || 'generic';

export const getStorageKey = (userId?: string): string =>
  userId
    ? `notif_seen_unread_count_${userId}`
    : 'notif_seen_unread_count_generic';

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
  };
};

class NotificationStoreManager {
  private states = new Map<string, SharedNotificationState>();
  private listeners = new Map<string, Set<() => void>>();

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

  updateState(key: string, updates: Partial<SharedNotificationState>) {
    const currentState = this.states.get(key);
    if (!currentState) return;

    this.states.set(key, {
      ...currentState,
      ...updates,
    });

    this.notify(key);
  }

  subscribe(key: string, listener: () => void): () => void {
    const storeKey = getStoreKey(key);
    if (!this.listeners.has(storeKey)) {
      this.listeners.set(storeKey, new Set());
    }
    this.listeners.get(storeKey)!.add(listener);

    return () => {
      const set = this.listeners.get(storeKey);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(storeKey);
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
  }

  /**
   * Domain Action: Optimistically mark a single notification as read
   */
  markReadOptimistic(
    userId: string | undefined,
    id: string,
    isUsingProps: boolean
  ): { previousState: SharedNotificationState } {
    const key = getStoreKey(userId);
    const state = this.getOrCreateState(userId);
    const previousState = { ...state, notifications: [...state.notifications] };

    this.updateState(key, {
      notifications: state.notifications.map((item) =>
        item.id === id ? { ...item, unread: false } : item
      ),
      unreadCountState: isUsingProps
        ? state.unreadCountState
        : Math.max(0, state.unreadCountState - 1),
    });

    return { previousState };
  }

  /**
   * Domain Action: Rollback state to a previous backup state
   */
  rollbackState(
    userId: string | undefined,
    previousState: SharedNotificationState
  ) {
    const key = getStoreKey(userId);
    this.updateState(key, previousState);
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
  } {
    const key = getStoreKey(userId);
    const state = this.getOrCreateState(userId);
    const previousNotifications = [...state.notifications];
    const previousCount = state.unreadCountState;

    const unreadIds = state.notifications
      .filter((item) => item.unread)
      .map((item) => item.id);

    const unreadIdSet = new Set(unreadIds);
    this.updateState(key, {
      notifications: state.notifications.map((item) =>
        unreadIdSet.has(item.id) ? { ...item, unread: false } : item
      ),
      ...(!isUsingProps ? { unreadCountState: 0 } : {}),
    });

    return { previousNotifications, previousCount, unreadIds };
  }

  /**
   * Domain Action: Rollback only specific notifications (e.g. on batch failure)
   */
  rollbackNotifications(
    userId: string | undefined,
    ids: string[],
    unreadCountState?: number
  ) {
    const key = getStoreKey(userId);
    const state = this.getOrCreateState(userId);
    const idSet = new Set(ids);

    this.updateState(key, {
      notifications: state.notifications.map((item) =>
        idSet.has(item.id) ? { ...item, unread: true } : item
      ),
      ...(unreadCountState !== undefined ? { unreadCountState } : {}),
    });
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
    this.updateState(key, {
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
    const key = getStoreKey(userId);
    const state = this.getOrCreateState(userId);
    this.updateState(key, {
      notifications: [...state.notifications, ...items],
      nextCursor,
    });
  }
}

export const notificationStoreManager = new NotificationStoreManager();

export function resetNotificationStore(): void {
  notificationStoreManager.reset();
}
