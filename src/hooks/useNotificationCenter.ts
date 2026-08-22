import * as React from 'react';

import { useToast } from '@/components/ui/use-toast';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { captureFlowFailure } from '@/lib/monitoring';
/**
 * --------------------------------------------------------------------------------
 * SEAM & isolated module boundary:
 * The imports below represent the real notification service endpoints.
 * --------------------------------------------------------------------------------
 */
import {
  createFixtureNotificationSource,
  httpNotificationSource,
  type NotificationSource,
} from '@/services/notifications/notificationSource';
import type { NotificationItem } from '@/services/notifications/types';
import {
  createInitialState,
  type NotificationStatus,
  notificationStoreManager,
} from '@/stores/notificationStore';

const MARK_ALL_READ_BATCH_SIZE = 5;

function reportFailure(flow: string, step: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[useNotificationCenter] ${step} failed:`, message);
  void captureFlowFailure({ flow, step, message });
}

function reportMarkAsReadFailure(step: string, error: unknown): void {
  reportFailure('notification_mark_all_read', step, error);
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

export type UseNotificationCenterProps = {
  userId?: string;
  initialStatus?: NotificationStatus;
  initialNotifications?: NotificationItem[];
  defaultNotifications?: NotificationItem[];
  onMarkRead?: (id: string) => void | Promise<void>;
  onMarkAllRead?: (ids: string[]) => void | Promise<void>;
  notificationSource?: NotificationSource;
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
  defaultNotifications: _defaultNotifications = [],
  onMarkRead,
  onMarkAllRead,
  notificationSource = httpNotificationSource,
}: UseNotificationCenterProps = {}) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);

  const actualSource = React.useMemo(() => {
    if (notificationSource !== httpNotificationSource) {
      return notificationSource;
    }
    if (initialNotifications !== undefined) {
      return createFixtureNotificationSource(initialNotifications);
    }
    return httpNotificationSource;
  }, [notificationSource, initialNotifications]);

  const sourceRef = React.useRef(actualSource);
  useIsomorphicLayoutEffect(() => {
    sourceRef.current = actualSource;
  }, [actualSource]);

  // Semantic variables to avoid duplication and clarify intents
  const effectiveUserId = userId || 'generic';
  const shouldSkipFetch =
    initialNotifications !== undefined ||
    (!userId && actualSource.requiresAuth);
  const canMutate = userId !== undefined || !actualSource.requiresAuth;

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
          unreadCountState: initialNotifications.filter((n) => n.unread).length,
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

  const badgeCount = storeState.unreadCountState;

  const hasMore = storeState.nextCursor !== null;

  // Notifications that exist (per the unread badge total) but haven't been
  // scrolled into view yet. Gated on hasMore so a stale/out-of-sync badge
  // count never implies "older" unread items once the list is fully loaded.
  const olderUnreadCount = hasMore ? Math.max(badgeCount - unreadCount, 0) : 0;

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
      if (shouldSkipFetch) return;
      const state = notificationStoreManager.getOrCreateState(userId);

      if (state.isLoadingMore || !state.nextCursor) return;
      if (state.hasLoadMoreError && !isRetry) return;
      if (state.isFetching) return;

      notificationStoreManager.updateState(userId, {
        isLoadingMore: true,
        hasLoadMoreError: false,
      });

      try {
        const res = await sourceRef.current.listNotifications(
          effectiveUserId,
          state.nextCursor,
          20
        );

        notificationStoreManager.appendNotifications(
          userId,
          (res && res.notifications) || [],
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
    [userId, effectiveUserId, shouldSkipFetch, toast]
  );

  // Load just the unread badge count - cheap, and safe to fire on every
  // page mount (via NotificationBell in the Header) since the badge must
  // be visible before the user ever opens the dropdown. The full
  // notification list is fetched separately, lazily, only when the
  // dropdown is actually opened (see openCenter/onOpenChange below) -
  // most page visits never open it, so there's no reason to pay for it
  // upfront.
  const loadUnreadCount = React.useCallback(async () => {
    if (shouldSkipFetch) return;

    // Deduplication across sibling hook instances and staleness guarding
    // against loadInitialData both live in the store - see
    // fetchUnreadCountWithDeduplication.
    await notificationStoreManager.fetchUnreadCountWithDeduplication(
      userId,
      async () => {
        try {
          const res = await sourceRef.current.getUnreadCount(effectiveUserId);
          return res.unread_count;
        } catch (error) {
          reportFailure(
            'notification_load_unread_count',
            'fetch_unread_count',
            error
          );
          return undefined;
        }
      }
    );
  }, [userId, effectiveUserId, shouldSkipFetch]);

  // Load initial notifications and unread count from service
  const loadInitialData = React.useCallback(
    async (showLoading = true) => {
      if (shouldSkipFetch) return;
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
            sourceRef.current.getUnreadCount(effectiveUserId),
            sourceRef.current.listNotifications(effectiveUserId, undefined, 20),
          ]);

          notificationStoreManager.setInitialData(
            userId,
            unreadRes.unread_count,
            (notificationsRes && notificationsRes.notifications) || [],
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
    [userId, effectiveUserId, shouldSkipFetch, toast]
  );

  React.useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

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
    if (
      initialNotifications === undefined &&
      open &&
      badgeCount > storeState.seenUnreadCount
    ) {
      writeSeenCount(badgeCount);
    }
  }, [
    open,
    badgeCount,
    storeState.seenUnreadCount,
    writeSeenCount,
    initialNotifications,
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

  // Since mount only fetches the unread count (see loadUnreadCount above),
  // the list can now genuinely be loading for the *first* time on open, not
  // just refreshing already-cached data. Show the loading skeleton / error
  // + retry state (showLoading: true) for that first load; once cached
  // data exists, re-opening only refreshes silently in the background
  // (showLoading: false), matching the original "fetch fresh details when
  // opened" behavior.
  const isFirstLoad =
    storeState.status === 'loading' ||
    (storeState.status === 'error' && storeState.notifications.length === 0);

  const openCenter = React.useCallback(() => {
    setOpen(true);
    writeSeenCount(badgeCount);
    loadInitialData(isFirstLoad);
  }, [badgeCount, writeSeenCount, loadInitialData, isFirstLoad]);

  const closeCenter = React.useCallback(() => {
    setOpen(false);
  }, []);

  const onOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        openCenter();
      } else {
        setOpen(false);
      }
    },
    [openCenter]
  );

  const markRead = React.useCallback(
    async (id: string) => {
      if (!canMutate) return;
      const state = notificationStoreManager.getOrCreateState(userId);

      if (state.markingReadIds.has(id)) return;

      const targetItem = state.notifications.find((n) => n.id === id);
      if (!targetItem || !targetItem.unread) return;

      // Perform optimistic single mark read on the store
      notificationStoreManager.markReadOptimistic(userId, id);

      const action =
        onMarkRead ||
        (canMutate
          ? (notifId: string) =>
              sourceRef.current.markOneRead(effectiveUserId, notifId)
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

        // Roll back only this notification
        const currentCount =
          notificationStoreManager.getOrCreateState(userId).unreadCountState;
        notificationStoreManager.rollbackNotifications(
          userId,
          [id],
          currentCount + 1
        );
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
    [userId, effectiveUserId, canMutate, onMarkRead, toast]
  );

  const markAllReadAction = React.useCallback(async () => {
    if (!canMutate) return;
    const state = notificationStoreManager.getOrCreateState(userId);
    if (state.isMarkingAll) return;

    const unreadIds = state.notifications
      .filter((item) => item.unread)
      .map((item) => item.id);
    if (unreadIds.length === 0 && state.unreadCountState === 0) return;

    // Perform optimistic mark all read on the store
    const {
      previousNotifications,
      previousCount,
      unreadIds: optimUnreadIds,
      previousIsMarkingAll,
    } = notificationStoreManager.markAllReadOptimistic(userId);

    notificationStoreManager.updateState(userId, { isPending: true });
    try {
      if (onMarkAllRead) {
        await onMarkAllRead(optimUnreadIds);
      } else if (onMarkRead) {
        // Fallback: mark individually in bounded batches
        const failedIds = await markReadInBatches(optimUnreadIds, onMarkRead);

        if (failedIds.length > 0) {
          notificationStoreManager.rollbackNotifications(userId, failedIds);
          const currentCount =
            notificationStoreManager.getOrCreateState(userId).unreadCountState;
          notificationStoreManager.updateState(userId, {
            unreadCountState: currentCount + failedIds.length,
          });
          toast({
            variant: 'destructive',
            title: '操作失敗',
            description:
              failedIds.length === optimUnreadIds.length
                ? '無法將通知標示為已讀，請稍後再試'
                : '部分通知標示為已讀失敗，請稍後再試',
          });
        }
      } else if (canMutate) {
        await sourceRef.current.markAllRead(effectiveUserId);
      }
    } catch (error) {
      reportMarkAsReadFailure('mark_all_read', error);

      // Rollback completely on error
      notificationStoreManager.updateState(userId, {
        notifications: previousNotifications,
        unreadCountState: previousCount,
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
  }, [userId, effectiveUserId, canMutate, onMarkRead, onMarkAllRead, toast]);

  const handleRetry = React.useCallback(() => {
    notificationStoreManager.updateState(userId, { status: 'loading' });
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (initialNotifications !== undefined) {
      timerRef.current = setTimeout(() => {
        notificationStoreManager.updateState(userId, {
          notifications: initialNotifications,
          status: 'success',
        });
      }, 1000);
    } else {
      loadInitialData(true);
    }
  }, [userId, initialNotifications, loadInitialData]);

  const showBadge = isMounted && badgeCount > storeState.seenUnreadCount;
  const formattedCount = badgeCount > 99 ? '99+' : String(badgeCount);
  const hasUnread = badgeCount > 0;

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
    hasMore,
    loadMore,
    hasLoadMoreError: storeState.hasLoadMoreError,
    olderUnreadCount,
  };
}
