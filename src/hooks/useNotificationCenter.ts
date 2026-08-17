import * as React from 'react';

import { useToast } from '@/components/ui/use-toast';
import { captureFlowFailure } from '@/lib/monitoring';
import { safeSetStorage } from '@/lib/storage';
/**
 * --------------------------------------------------------------------------------
 * SEAM & isolated module boundary:
 * The imports below represent the mock notification service endpoints.
 * When the real backend APIs are shipped, replace the mockNotificationService imports
 * below with real apiClient / real services calls.
 * --------------------------------------------------------------------------------
 */
import {
  fetchUnreadCount,
  listNotifications,
  markAllRead as mockMarkAllRead,
  markOneRead,
} from '@/mocks/mockNotificationService';
import {
  createInitialState,
  getStorageKey,
  getStoredSeenCount,
  getStoreKey,
  type NotificationItem,
  type NotificationStatus,
  notificationStoreManager,
} from '@/stores/notificationStore';

const MARK_ALL_READ_BATCH_SIZE = 5;

function reportMarkAsReadFailure(step: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[useNotificationCenter] ${step} failed:`, message);
  void captureFlowFailure({
    flow: 'notification_mark_all_read',
    step,
    message,
  });
}

/**
 * Marks IDs as read in fixed-size batches (instead of one unbounded
 * Promise.allSettled) to avoid exhausting the browser's per-origin
 * connection pool or tripping backend rate limits when there are many
 * unread notifications.
 */
async function markReadInBatches(
  ids: string[],
  onMarkRead: (id: string) => void | Promise<void>,
  batchSize: number = MARK_ALL_READ_BATCH_SIZE
): Promise<string[]> {
  const failedIds: string[] = [];

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (id) => {
        try {
          await onMarkRead(id);
        } catch (error) {
          reportMarkAsReadFailure(`mark_read_fallback:${id}`, error);
          throw error; // Let Promise.allSettled see this as rejected
        }
      })
    );

    results.forEach((res, index) => {
      if (res.status === 'rejected') {
        failedIds.push(batch[index]);
      }
    });
  }

  return failedIds;
}

export type { NotificationItem, NotificationStatus };
export {
  getStorageKey,
  getStoreKey,
  resetNotificationStore,
} from '@/stores/notificationStore';

export function mapApiNotificationToFrontend(apiItem: any): NotificationItem {
  const isUnread = !apiItem.read_at;
  const { role, mentee_name, mentor_name } = apiItem.metadata;

  const item: NotificationItem = {
    id: apiItem.id,
    type: apiItem.type,
    createdAt: apiItem.created_at,
    unread: isUnread,
    role: role,
    menteeName: mentee_name,
    mentorName: mentor_name,
  };

  if (
    apiItem.type === 'reservation_canceled' ||
    apiItem.type === 'reservation_upcoming'
  ) {
    if (role === 'mentor') {
      item.mentorName = undefined;
    } else if (role === 'mentee') {
      item.menteeName = undefined;
    }
  }

  return item;
}

export type UseNotificationCenterProps = {
  userId?: string;
  initialStatus?: NotificationStatus;
  initialNotifications?: NotificationItem[];
  defaultNotifications?: NotificationItem[];
  onMarkRead?: (id: string) => void | Promise<void>;
  onMarkAllRead?: (ids: string[]) => void | Promise<void>;
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

export function useNotificationCenter({
  userId,
  initialStatus = 'success',
  initialNotifications,
  defaultNotifications = [],
  onMarkRead,
  onMarkAllRead,
}: UseNotificationCenterProps = {}) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);

  const isUsingProps = initialNotifications !== undefined;
  const storeKey = getStoreKey(userId);

  // Cache the Server Snapshot locally inside hook state for stable referential equality
  const [serverSnapshot] = React.useState(() =>
    createInitialState(userId, initialNotifications, initialStatus)
  );

  // Retrieve current state from store and subscribe to changes using standard React 18+ useSyncExternalStore
  const storeState = React.useSyncExternalStore(
    React.useCallback(
      (callback) => notificationStoreManager.subscribe(storeKey, callback),
      [storeKey]
    ),
    React.useCallback(
      () =>
        notificationStoreManager.getOrCreateState(
          userId,
          initialNotifications,
          initialStatus
        ),
      [userId, initialNotifications, initialStatus]
    ),
    React.useCallback(() => serverSnapshot, [serverSnapshot])
  );

  // Sync initialStatus/initialNotifications prop changes structurally into the shared store
  React.useEffect(() => {
    if (initialNotifications) {
      const state = notificationStoreManager.getOrCreateState(userId);
      if (
        areNotificationsChanged(initialNotifications, state.notifications) ||
        initialStatus !== state.status
      ) {
        notificationStoreManager.updateState(storeKey, {
          notifications: initialNotifications,
          status: initialStatus,
        });
      }
    }
  }, [initialNotifications, initialStatus, userId, storeKey]);

  // Mount-time sync seenUnreadCount from localStorage conditionally (avoiding redundant broadcasts)
  React.useEffect(() => {
    const storageKey = getStorageKey(userId);
    const currentStoredCount = getStoredSeenCount(storageKey);
    const currentState = notificationStoreManager.getOrCreateState(userId);
    if (currentState.seenUnreadCount !== currentStoredCount) {
      notificationStoreManager.updateState(storeKey, {
        seenUnreadCount: currentStoredCount,
      });
    }
  }, [storeKey, userId]);

  const [isMounted, setIsMounted] = React.useState(false);

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const markingReadIdsRef = React.useRef(new Set<string>());
  const isMarkingAllRef = React.useRef(false);

  // Derive unread count from the actual notifications state list (for fallback/props usage)
  const unreadCount = React.useMemo(() => {
    return storeState.notifications.filter((item) => item.unread).length;
  }, [storeState.notifications]);

  const badgeCount = isUsingProps ? unreadCount : storeState.unreadCountState;

  // Set isMounted on client
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Helper to write to localStorage and notify shared store instances
  const writeSeenCount = React.useCallback(
    (val: number) => {
      const storageKey = getStorageKey(userId);
      safeSetStorage(storageKey, String(val));
      notificationStoreManager.updateState(storeKey, { seenUnreadCount: val });
    },
    [userId, storeKey]
  );

  // Infinite Scroll / Fetch more
  const loadMore = React.useCallback(
    async (isRetry = false) => {
      if (isUsingProps) return;
      const state = notificationStoreManager.getOrCreateState(userId);

      if (state.isLoadingMore || !state.nextCursor) return;
      if (state.hasLoadMoreError && !isRetry) return;
      if (state.isFetching) return;

      notificationStoreManager.updateState(storeKey, {
        isLoadingMore: true,
        hasLoadMoreError: false,
      });

      try {
        const { items, next_created_at } = await listNotifications(
          state.nextCursor,
          20
        );
        const mapped = items.map(mapApiNotificationToFrontend);

        notificationStoreManager.appendNotifications(
          userId,
          mapped,
          next_created_at
        );
      } catch (error) {
        console.error('[useNotificationCenter] loadMore failed:', error);
        notificationStoreManager.updateState(storeKey, {
          hasLoadMoreError: true,
        });
        toast({
          variant: 'destructive',
          title: '載入失敗',
          description: '無法載入更多通知，請點擊重試',
        });
      } finally {
        notificationStoreManager.updateState(storeKey, {
          isLoadingMore: false,
        });
      }
    },
    [userId, storeKey, isUsingProps, toast]
  );

  // Load initial notifications and unread count from service
  const loadInitialData = React.useCallback(
    async (showLoading = true) => {
      if (isUsingProps) return;
      const state = notificationStoreManager.getOrCreateState(userId);

      if (state.isFetching) {
        if (state.fetchPromise) {
          await state.fetchPromise;
        }
        return;
      }

      const fetchPromise = (async () => {
        try {
          const [unreadRes, notificationsRes] = await Promise.all([
            fetchUnreadCount(),
            listNotifications(undefined, 20),
          ]);
          const mapped = notificationsRes.items.map(
            mapApiNotificationToFrontend
          );

          notificationStoreManager.setInitialData(
            userId,
            unreadRes.count,
            mapped,
            notificationsRes.next_created_at
          );
        } catch (error) {
          const currentNotifications =
            notificationStoreManager.getOrCreateState(userId).notifications;
          if (!showLoading || currentNotifications.length > 0) {
            toast({
              variant: 'destructive',
              title: '更新失敗',
              description: '無法更新最新通知，請稍後再試',
            });
          } else {
            notificationStoreManager.updateState(storeKey, { status: 'error' });
          }
        } finally {
          notificationStoreManager.updateState(storeKey, {
            isFetching: false,
            fetchPromise: null,
          });
        }
      })();

      // Group isFetching, status and fetchPromise to single updateState
      notificationStoreManager.updateState(storeKey, {
        isFetching: true,
        ...(showLoading ? { status: 'loading' } : {}),
        fetchPromise,
      });

      await fetchPromise;
    },
    [userId, storeKey, isUsingProps, toast]
  );

  React.useEffect(() => {
    loadInitialData(!isUsingProps);
  }, [loadInitialData, isUsingProps]);

  // Keep seenUnreadCount clamped to badgeCount to prevent stale values,
  // but only when we are not in a loading status and there is no active write/mutation in progress
  // to avoid accidental seen count cache destruction during optimistic loading states.
  React.useEffect(() => {
    if (
      storeState.status !== 'loading' &&
      !storeState.isPending &&
      storeState.seenUnreadCount > badgeCount
    ) {
      writeSeenCount(badgeCount);
    }
  }, [
    badgeCount,
    storeState.seenUnreadCount,
    writeSeenCount,
    storeState.status,
    storeState.isPending,
  ]);

  // Synchronize seenUnreadCount when the dropdown is open and badgeCount increases (e.g. from loadInitialData)
  // to prevent unread badge from reappearing incorrectly upon close.
  React.useEffect(() => {
    if (!isUsingProps && open && badgeCount > storeState.seenUnreadCount) {
      writeSeenCount(badgeCount);
    }
  }, [
    open,
    badgeCount,
    storeState.seenUnreadCount,
    writeSeenCount,
    isUsingProps,
  ]);

  // Synchronize state across different browser tabs via storage event
  React.useEffect(() => {
    const storageKey = getStorageKey(userId);

    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === storageKey) {
        const val = e.newValue !== null ? Number(e.newValue) : 0;
        const parsedVal = Number.isNaN(val) ? 0 : val;
        notificationStoreManager.updateState(storeKey, {
          seenUnreadCount: parsedVal,
        });
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageSync as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(
          'storage',
          handleStorageSync as EventListener
        );
      }
    };
  }, [userId, storeKey]);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const openCenter = React.useCallback(() => {
    setOpen(true);
    writeSeenCount(badgeCount);
    // Fetch fresh details when dropdown is opened
    if (!isUsingProps) {
      loadInitialData(false);
    }
  }, [badgeCount, writeSeenCount, isUsingProps, loadInitialData]);

  const closeCenter = React.useCallback(() => {
    setOpen(false);
  }, []);

  const onOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) {
        writeSeenCount(badgeCount);
        if (!isUsingProps) {
          loadInitialData(false);
        }
      }
    },
    [badgeCount, writeSeenCount, isUsingProps, loadInitialData]
  );

  const markRead = React.useCallback(
    async (id: string) => {
      const state = notificationStoreManager.getOrCreateState(userId);

      if (markingReadIdsRef.current.has(id)) return;

      const targetItem = state.notifications.find((n) => n.id === id);
      if (!targetItem || !targetItem.unread) return;

      markingReadIdsRef.current.add(id);

      // Perform optimistic single mark read on the store
      const { previousState } = notificationStoreManager.markReadOptimistic(
        userId,
        id,
        isUsingProps
      );

      const action = onMarkRead || (!isUsingProps ? markOneRead : null);
      if (!action) {
        markingReadIdsRef.current.delete(id);
        return;
      }

      notificationStoreManager.updateState(storeKey, { isPending: true });
      try {
        await action(id);
      } catch (error) {
        reportMarkAsReadFailure(`mark_read_click:${id}`, error);

        // Rollback state dynamically via store method
        notificationStoreManager.rollbackState(userId, previousState);
        toast({
          variant: 'destructive',
          title: '操作失敗',
          description: '無法將通知標示為已讀，請稍後再試',
        });
      } finally {
        notificationStoreManager.updateState(storeKey, { isPending: false });
        markingReadIdsRef.current.delete(id);
      }
    },
    [userId, storeKey, onMarkRead, isUsingProps, toast]
  );

  const markAllRead = React.useCallback(async () => {
    if (isMarkingAllRef.current) return;

    const state = notificationStoreManager.getOrCreateState(userId);

    const unreadIds = state.notifications
      .filter((item) => item.unread)
      .map((item) => item.id);
    if (unreadIds.length === 0 && isUsingProps) return;

    isMarkingAllRef.current = true;

    // Perform optimistic mark all read on the store
    const {
      previousNotifications,
      previousCount,
      unreadIds: optimUnreadIds,
    } = notificationStoreManager.markAllReadOptimistic(userId, isUsingProps);

    notificationStoreManager.updateState(storeKey, { isPending: true });
    try {
      if (onMarkAllRead) {
        await onMarkAllRead(optimUnreadIds);
      } else if (onMarkRead) {
        // Fallback: mark individually in bounded batches
        const failedIds = await markReadInBatches(optimUnreadIds, onMarkRead);

        if (failedIds.length > 0) {
          notificationStoreManager.rollbackNotifications(userId, failedIds);
          if (!isUsingProps) {
            const currentCount =
              notificationStoreManager.getOrCreateState(
                userId
              ).unreadCountState;
            notificationStoreManager.updateState(storeKey, {
              unreadCountState: currentCount + failedIds.length,
            });
          }
          toast({
            variant: 'destructive',
            title: '操作失敗',
            description:
              failedIds.length === optimUnreadIds.length
                ? '無法將通知標示為已讀，請稍後再試'
                : '部分通知標示為已讀失敗，請稍後再試',
          });
        }
      } else if (!isUsingProps) {
        await mockMarkAllRead();
      }
    } catch (error) {
      reportMarkAsReadFailure('mark_all_read', error);

      // Rollback completely on error
      notificationStoreManager.updateState(storeKey, {
        notifications: previousNotifications,
        ...(!isUsingProps ? { unreadCountState: previousCount } : {}),
      });
      toast({
        variant: 'destructive',
        title: '操作失敗',
        description: '無法將全部通知標示為已讀，請稍後再試',
      });
    } finally {
      notificationStoreManager.updateState(storeKey, { isPending: false });
      isMarkingAllRef.current = false;
    }
  }, [userId, storeKey, onMarkRead, onMarkAllRead, isUsingProps, toast]);

  const handleRetry = React.useCallback(() => {
    notificationStoreManager.updateState(storeKey, { status: 'loading' });
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (isUsingProps) {
      timerRef.current = setTimeout(() => {
        const loaded = initialNotifications ?? defaultNotifications;
        notificationStoreManager.updateState(storeKey, {
          notifications: loaded,
          status: 'success',
        });
      }, 1000);
    } else {
      loadInitialData(true);
    }
  }, [
    storeKey,
    initialNotifications,
    defaultNotifications,
    isUsingProps,
    loadInitialData,
  ]);

  const showBadge = isMounted && badgeCount > storeState.seenUnreadCount;
  const formattedCount = badgeCount > 99 ? '99+' : String(badgeCount);
  const hasUnread = isUsingProps
    ? storeState.notifications.some((item) => item.unread)
    : badgeCount > 0;

  return {
    open,
    status: storeState.status,
    items: storeState.notifications,
    badgeCount,
    showBadge,
    formattedCount,
    hasUnread,
    openCenter,
    closeCenter,
    onOpenChange,
    markRead,
    markAllRead,
    handleRetry,
    isLoadingMore: storeState.isLoadingMore,
    hasMore: storeState.nextCursor !== null,
    loadMore,
    hasLoadMoreError: storeState.hasLoadMoreError,
  };
}
