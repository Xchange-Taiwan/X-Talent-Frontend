import * as React from 'react';

import { useToast } from '@/components/ui/use-toast';
import { captureFlowFailure } from '@/lib/monitoring';
/**
 * --------------------------------------------------------------------------------
 * SEAM & isolated module boundary:
 * The imports below represent the real notification service endpoints.
 * --------------------------------------------------------------------------------
 */
import {
  fetchUnreadCount,
  listNotifications,
  markAllRead,
  markOneRead,
} from '@/services/notifications/notificationService';
import {
  createInitialState,
  type NotificationItem,
  type NotificationStatus,
  notificationStoreManager,
} from '@/stores/notificationStore';
import { components } from '@/types/api';

const MARK_ALL_READ_BATCH_SIZE = 5;

// Below this, created_at is a seconds-precision Unix timestamp; at/above it,
// it's already in milliseconds (a seconds-precision timestamp only reaches
// this many digits in the year 2286).
const SECONDS_TIMESTAMP_MAX = 9999999999;

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

export function mapApiNotificationToFrontend(
  apiItem: components['schemas']['NotificationVO']
): NotificationItem {
  const isUnread = !apiItem.read_at;
  const metadata = (apiItem.metadata || {}) as {
    role?: 'mentor' | 'mentee';
    counterparty_name?: string;
  };
  const { role, counterparty_name } = metadata;

  // Map role and counterparty_name to menteeName/mentorName for frontend compatibility
  const menteeName = role === 'mentor' ? counterparty_name : undefined;
  const mentorName = role === 'mentee' ? counterparty_name : undefined;

  // Safe parsed createdAt - handle both seconds and milliseconds timestamps
  const ms =
    apiItem.created_at < SECONDS_TIMESTAMP_MAX
      ? apiItem.created_at * 1000
      : apiItem.created_at;
  const createdAt = new Date(ms).toISOString();

  const item: NotificationItem = {
    id: String(apiItem.id),
    type: apiItem.type as NotificationItem['type'],
    createdAt,
    unread: isUnread,
    role: role,
    menteeName,
    mentorName,
  };

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

  // Cache the Server Snapshot locally inside hook state for stable referential equality
  const [serverSnapshot] = React.useState(() =>
    createInitialState(userId, initialNotifications, initialStatus)
  );

  // Retrieve current state from store and subscribe to changes using standard React 18+ useSyncExternalStore
  const storeState = React.useSyncExternalStore(
    React.useCallback(
      (callback) => notificationStoreManager.subscribe(userId, callback),
      [userId]
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
        notificationStoreManager.updateState(userId, {
          notifications: initialNotifications,
          status: initialStatus,
        });
      }
    }
  }, [initialNotifications, initialStatus, userId]);

  // Mount-time sync seenUnreadCount from localStorage conditionally (avoiding redundant broadcasts)
  React.useEffect(() => {
    notificationStoreManager.syncSeenCountFromStorage(userId);
  }, [userId]);

  const [isMounted, setIsMounted] = React.useState(false);

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

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
      notificationStoreManager.setSeenCount(userId, val);
    },
    [userId]
  );

  // Infinite Scroll / Fetch more
  const loadMore = React.useCallback(
    async (isRetry = false) => {
      if (isUsingProps) return;
      if (!userId) return;
      const state = notificationStoreManager.getOrCreateState(userId);

      if (state.isLoadingMore || !state.nextCursor) return;
      if (state.hasLoadMoreError && !isRetry) return;
      if (state.isFetching) return;

      notificationStoreManager.updateState(userId, {
        isLoadingMore: true,
        hasLoadMoreError: false,
      });

      try {
        const res = await listNotifications(userId, state.nextCursor, 20);
        const mapped = ((res && res.notifications) || []).map(
          mapApiNotificationToFrontend
        );

        notificationStoreManager.appendNotifications(
          userId,
          mapped,
          (res && res.next_cursor) || null
        );
      } catch (error) {
        console.error('[useNotificationCenter] loadMore failed:', error);
        notificationStoreManager.updateState(userId, {
          hasLoadMoreError: true,
        });
        toast({
          variant: 'destructive',
          title: '載入失敗',
          description: '無法載入更多通知，請點擊重試',
        });
      } finally {
        notificationStoreManager.updateState(userId, {
          isLoadingMore: false,
        });
      }
    },
    [userId, isUsingProps, toast]
  );

  // Load initial notifications and unread count from service
  const loadInitialData = React.useCallback(
    async (showLoading = true) => {
      if (isUsingProps) return;
      if (!userId) return;
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
            fetchUnreadCount(userId),
            listNotifications(userId, undefined, 20),
          ]);
          const mapped = (
            (notificationsRes && notificationsRes.notifications) ||
            []
          ).map(mapApiNotificationToFrontend);

          notificationStoreManager.setInitialData(
            userId,
            (unreadRes && unreadRes.unread_count) || 0,
            mapped,
            (notificationsRes && notificationsRes.next_cursor) || null
          );
        } catch (error) {
          console.error(
            '[useNotificationCenter] loadInitialData failed:',
            error
          );
          const currentNotifications =
            notificationStoreManager.getOrCreateState(userId).notifications;
          if (!showLoading || currentNotifications.length > 0) {
            toast({
              variant: 'destructive',
              title: '更新失敗',
              description: '無法更新最新通知，請稍後再試',
            });
          } else {
            notificationStoreManager.updateState(userId, { status: 'error' });
          }
        } finally {
          notificationStoreManager.updateState(userId, {
            isFetching: false,
            fetchPromise: null,
          });
        }
      })();

      // Group isFetching, status and fetchPromise to single updateState
      notificationStoreManager.updateState(userId, {
        isFetching: true,
        ...(showLoading ? { status: 'loading' } : {}),
        fetchPromise,
      });

      await fetchPromise;
    },
    [userId, isUsingProps, toast]
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

  // Cross-tab synchronization of seenUnreadCount is handled centrally by
  // notificationStoreManager's own single 'storage' listener.

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

      if (state.markingReadIds.has(id)) return;

      const targetItem = state.notifications.find((n) => n.id === id);
      if (!targetItem || !targetItem.unread) return;

      // Perform optimistic single mark read on the store
      notificationStoreManager.markReadOptimistic(userId, id, isUsingProps);

      const action =
        onMarkRead ||
        (!isUsingProps && userId
          ? (notifId: string) => markOneRead(userId, notifId)
          : null);
      if (!action) {
        notificationStoreManager.removeMarkingReadId(userId, id);
        return;
      }

      notificationStoreManager.updateState(userId, { isPending: true });
      try {
        await action(id);
      } catch (error) {
        reportMarkAsReadFailure(`mark_read_click:${id}`, error);

        // Roll back only this notification (not a full-state snapshot) so
        // concurrent state changes made while the request was in flight
        // aren't clobbered.
        if (isUsingProps) {
          notificationStoreManager.rollbackNotifications(userId, [id]);
        } else {
          const currentCount =
            notificationStoreManager.getOrCreateState(userId).unreadCountState;
          notificationStoreManager.rollbackNotifications(
            userId,
            [id],
            currentCount + 1
          );
        }
        toast({
          variant: 'destructive',
          title: '操作失敗',
          description: '無法將通知標示為已讀，請稍後再試',
        });
      } finally {
        notificationStoreManager.removeMarkingReadId(userId, id, {
          isPending: false,
        });
      }
    },
    [userId, onMarkRead, isUsingProps, toast]
  );

  const markAllReadAction = React.useCallback(async () => {
    const state = notificationStoreManager.getOrCreateState(userId);
    if (state.isMarkingAll) return;

    const unreadIds = state.notifications
      .filter((item) => item.unread)
      .map((item) => item.id);
    if (unreadIds.length === 0 && isUsingProps) return;

    // Perform optimistic mark all read on the store
    const {
      previousNotifications,
      previousCount,
      unreadIds: optimUnreadIds,
      previousIsMarkingAll,
    } = notificationStoreManager.markAllReadOptimistic(userId, isUsingProps);

    notificationStoreManager.updateState(userId, { isPending: true });
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
            notificationStoreManager.updateState(userId, {
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
      } else if (!isUsingProps && userId) {
        await markAllRead(userId);
      }
    } catch (error) {
      reportMarkAsReadFailure('mark_all_read', error);

      // Rollback completely on error
      notificationStoreManager.updateState(userId, {
        notifications: previousNotifications,
        unreadCountState: isUsingProps ? state.unreadCountState : previousCount,
        isMarkingAll: previousIsMarkingAll,
      });
      toast({
        variant: 'destructive',
        title: '操作失敗',
        description: '無法將全部通知標示為已讀，請稍後再試',
      });
    } finally {
      notificationStoreManager.updateState(userId, {
        isPending: false,
        isMarkingAll: false,
      });
    }
  }, [userId, onMarkRead, onMarkAllRead, isUsingProps, toast]);

  const handleRetry = React.useCallback(() => {
    notificationStoreManager.updateState(userId, { status: 'loading' });
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (isUsingProps) {
      timerRef.current = setTimeout(() => {
        const loaded = initialNotifications ?? defaultNotifications;
        notificationStoreManager.updateState(userId, {
          notifications: loaded,
          status: 'success',
        });
      }, 1000);
    } else {
      loadInitialData(true);
    }
  }, [
    userId,
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
    markAllRead: markAllReadAction,
    handleRetry,
    isLoadingMore: storeState.isLoadingMore,
    hasMore: storeState.nextCursor !== null,
    loadMore,
    hasLoadMoreError: storeState.hasLoadMoreError,
  };
}
