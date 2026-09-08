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
 * Builds the model's optional `markAllRead` bulk action from the hook's own
 * `onMarkAllRead`/`onMarkRead` props, mirroring the priority the hook has
 * always used: a caller-supplied `onMarkAllRead` wins outright, otherwise
 * `onMarkRead` (if given) is used as a per-id fallback in batches.
 * `undefined` means "use the installed NotificationSource's own
 * `markAllRead`", which the model does on its own.
 */
function buildMarkAllReadBulkAction(
  onMarkAllRead?: (ids: string[]) => void | Promise<void>,
  onMarkRead?: (id: string) => void | Promise<void>
): ((ids: string[]) => Promise<string[] | void>) | undefined {
  if (onMarkAllRead) {
    return async (ids: string[]) => {
      await onMarkAllRead(ids);
    };
  }
  if (onMarkRead) {
    return (ids: string[]) => markReadInBatches(ids, onMarkRead);
  }
  return undefined;
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

  // The model (notificationStoreManager) owns the NotificationSource for
  // this store key - hand it off on mount and whenever it changes, instead
  // of threading it through every operation. useIsomorphicLayoutEffect
  // (rather than a plain effect) keeps this write ordered before any
  // same-commit passive effect (e.g. loadUnreadCount below) reads it.
  useIsomorphicLayoutEffect(() => {
    notificationStoreManager.setSource(userId, actualSource);
  }, [userId, actualSource]);

  // Semantic variables to avoid duplication and clarify intents.
  // Environment-specific behavior is asked of the installed source rather
  // than re-derived from `initialNotifications` at each call site - the
  // choice of source is made once, in the `actualSource` memo above.
  const effectiveUserId = userId || 'generic';
  const isPreloadedSource = Boolean(actualSource.isPreloaded);
  const shouldSkipFetch = Boolean(
    isPreloadedSource || (!userId && actualSource.requiresAuth)
  );

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
      notificationStoreManager.syncInitialNotifications(
        userId,
        initialNotifications,
        initialStatus
      );
    }
  }, [initialNotifications, initialStatus, userId]);

  // Mount-time sync seenUnreadCount from localStorage conditionally (avoiding redundant broadcasts)
  React.useEffect(() => {
    notificationStoreManager.syncSeenCountFromStorage(userId);
  }, [userId]);

  const [isMounted, setIsMounted] = React.useState(false);

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

  // Infinite Scroll / Fetch more. All the reentry/error-gate/preloaded-source
  // guards and the fetch itself live in the model (notificationStoreManager)
  // - this is just the result -> toast conversion.
  const loadMore = React.useCallback(
    async (isRetry = false) => {
      const result = await notificationStoreManager.loadMore(userId, isRetry);
      if (result.status === 'failed') {
        console.error('[useNotificationCenter] loadMore failed:', result.error);
        toast({
          variant: 'destructive',
          title: '載入失敗',
          description: '無法載入更多通知，請點擊重試',
        });
      }
    },
    [userId, toast]
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
          const res = await actualSource.getUnreadCount(effectiveUserId);
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
  }, [userId, effectiveUserId, shouldSkipFetch, actualSource]);

  // Load initial notifications and unread count from service
  const loadInitialData = React.useCallback(
    async (showLoading = true) => {
      if (shouldSkipFetch) return;

      await notificationStoreManager.fetchInitialDataWithDeduplication(
        userId,
        showLoading,
        async () => {
          const [unreadRes, notificationsRes] = await Promise.all([
            actualSource.getUnreadCount(effectiveUserId),
            actualSource.listNotifications(effectiveUserId, undefined, 20),
          ]);
          return {
            unreadCount: unreadRes.unread_count,
            notifications:
              (notificationsRes && notificationsRes.notifications) || [],
            nextCursor:
              (notificationsRes && notificationsRes.next_cursor) || null,
          };
        },
        (error, hasExistingNotifications) => {
          console.error(
            '[useNotificationCenter] loadInitialData failed:',
            error
          );
          if (!showLoading || hasExistingNotifications) {
            toast({
              variant: 'destructive',
              title: '更新失敗',
              description: '無法更新最新通知，請稍後再試',
            });
          }
        }
      );
    },
    [userId, effectiveUserId, shouldSkipFetch, toast, actualSource]
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
    if (!isPreloadedSource && open && badgeCount > storeState.seenUnreadCount) {
      writeSeenCount(badgeCount);
    }
  }, [
    open,
    badgeCount,
    storeState.seenUnreadCount,
    writeSeenCount,
    isPreloadedSource,
  ]);

  // Cross-tab synchronization of seenUnreadCount is handled centrally by
  // notificationStoreManager's own single 'storage' listener. Discarding a
  // retry that resolves after this hook unmounts is likewise handled
  // centrally, by the model's own per-key epoch (bumped when this key's
  // last subscriber unsubscribes - see notificationStoreManager.subscribe).

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

  // Single mark-read: the model owns the reentry guard, optimistic update,
  // and rollback-on-failure end to end - this is just the result -> toast
  // conversion. `onMarkRead`, when given, replaces the installed source's
  // own markOneRead for this call (used by tests/Storybook DI).
  const markRead = React.useCallback(
    async (id: string) => {
      const result = await notificationStoreManager.markRead(
        userId,
        id,
        onMarkRead
      );
      if (result.status === 'failed') {
        reportMarkAsReadFailure(`mark_read_click:${id}`, result.error);
        toast({
          variant: 'destructive',
          title: '操作失敗',
          description: '無法將通知標示為已讀，請稍後再試',
        });
      }
    },
    [userId, onMarkRead, toast]
  );

  // Mark-all-read: same shape as markRead above, plus distinguishing a
  // total failure from a partial one (only relevant for the onMarkRead
  // batch fallback) so the right toast copy can be chosen.
  const markAllReadAction = React.useCallback(async () => {
    const bulkAction = buildMarkAllReadBulkAction(onMarkAllRead, onMarkRead);
    const result = await notificationStoreManager.markAllRead(
      userId,
      bulkAction
    );

    if (result.status === 'failed') {
      reportMarkAsReadFailure('mark_all_read', result.error);
      toast({
        variant: 'destructive',
        title: '操作失敗',
        description: '無法將全部通知標示為已讀，請稍後再試',
      });
    } else if (result.status === 'partial-failed') {
      toast({
        variant: 'destructive',
        title: '操作失敗',
        description:
          result.failedCount === result.totalCount
            ? '無法將通知標示為已讀，請稍後再試'
            : '部分通知標示為已讀失敗，請稍後再試',
      });
    }
  }, [userId, onMarkRead, onMarkAllRead, toast]);

  // Retry after an error: delegates to the installed source's own `retry`
  // when it has one (the model owns that dedup/staleness guard); falls back
  // to a normal reload otherwise, since that path stays hook-owned.
  const handleRetry = React.useCallback(() => {
    void notificationStoreManager.retry(userId).then((result) => {
      if (result.status === 'unsupported') {
        loadInitialData(true);
      } else if (result.status === 'failed') {
        reportFailure('notification_retry', 'source_retry', result.error);
      }
    });
  }, [userId, loadInitialData]);

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
