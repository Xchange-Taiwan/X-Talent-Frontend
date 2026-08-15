import * as React from 'react';

import {
  fetchUnreadCount,
  listNotifications,
  markAllRead as mockMarkAllRead,
  markOneRead,
} from '@/components/layout/Header/mockNotificationService';
import { useToast } from '@/components/ui/use-toast';
import { captureFlowFailure } from '@/lib/monitoring';
import { safeGetStorage, safeSetStorage } from '@/lib/storage';

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

export interface ApiNotificationItem {
  id: string;
  type:
    | 'reservation_new'
    | 'reservation_success'
    | 'reservation_failed'
    | 'reservation_canceled'
    | 'reservation_upcoming';
  metadata: {
    role?: 'mentor' | 'mentee';
    mentee_name?: string;
    mentor_name?: string;
  };
  created_at: string;
  read_at: string | null;
}

export function mapApiNotificationToFrontend(
  apiItem: ApiNotificationItem
): NotificationItem {
  const isUnread = !apiItem.read_at;
  const { role, mentee_name, mentor_name } = apiItem.metadata;

  const item: NotificationItem = {
    id: apiItem.id,
    type: apiItem.type,
    createdAt: apiItem.created_at,
    unread: isUnread,
    role: role,
  };

  if (
    apiItem.type === 'reservation_canceled' ||
    apiItem.type === 'reservation_upcoming'
  ) {
    if (role === 'mentor') {
      item.menteeName = mentee_name;
    } else if (role === 'mentee') {
      item.mentorName = mentor_name;
    } else {
      item.menteeName = mentee_name;
      item.mentorName = mentor_name;
    }
  } else {
    item.menteeName = mentee_name;
    item.mentorName = mentor_name;
  }

  return item;
}

export type NotificationStatus = 'loading' | 'error' | 'empty' | 'success';

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

  const [status, setStatus] = React.useState<NotificationStatus>(() => {
    if (isUsingProps) {
      return initialStatus;
    }
    return 'loading';
  });

  const [notifications, setNotifications] = React.useState<NotificationItem[]>(
    () => initialNotifications ?? []
  );
  const [seenUnreadCount, setSeenUnreadCount] = React.useState<number>(0);
  const [isMounted, setIsMounted] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);

  // Pagination states
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [unreadCountState, setUnreadCountState] = React.useState<number>(0);

  const storageKey = userId
    ? `notif_seen_unread_count_${userId}`
    : 'notif_seen_unread_count_generic';

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Sync initialStatus prop changes into internal status state during the Render Phase.
  const [prevInitialStatus, setPrevInitialStatus] =
    React.useState<NotificationStatus>(initialStatus);
  if (initialStatus !== prevInitialStatus) {
    setPrevInitialStatus(initialStatus);
    setStatus(initialStatus);
  }

  // Sync initialNotifications prop changes structurally into internal notifications state
  const [prevInitialNotifications, setPrevInitialNotifications] =
    React.useState<NotificationItem[] | undefined>(initialNotifications);
  if (areNotificationsChanged(initialNotifications, prevInitialNotifications)) {
    setPrevInitialNotifications(initialNotifications);
    if (initialNotifications) {
      setNotifications(initialNotifications);
    }
  }

  // Derive unread count from the actual notifications state list (for fallback/props usage)
  const unreadCount = React.useMemo(() => {
    return notifications.filter((item) => item.unread).length;
  }, [notifications]);

  const badgeCount = isUsingProps ? unreadCount : unreadCountState;

  // Set isMounted on client
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Helper to read and safely parse value from localStorage
  const getStoredSeenCount = React.useCallback((key: string): number => {
    const stored = safeGetStorage(key);
    const parsed = stored !== null ? Number(stored) : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
  }, []);

  // Helper to write to localStorage and dispatch custom update event to other instances
  const writeAndNotifySeen = React.useCallback(
    (val: number) => {
      safeSetStorage(storageKey, String(val));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('notif_seen_updated', {
            detail: { storageKey, seenCount: val },
          })
        );
      }
    },
    [storageKey]
  );

  // Load initial notifications and unread count from service
  const loadInitialData = React.useCallback(
    async (showLoading = true) => {
      if (isUsingProps) return;
      if (showLoading) {
        setStatus('loading');
      }
      try {
        const [unreadRes, notificationsRes] = await Promise.all([
          fetchUnreadCount(),
          listNotifications(undefined, 20),
        ]);
        setUnreadCountState(unreadRes.count);
        const mapped = notificationsRes.items.map(mapApiNotificationToFrontend);
        setNotifications(mapped);
        setNextCursor(notificationsRes.next_created_at);
        setStatus(mapped.length === 0 ? 'empty' : 'success');
      } catch (error) {
        setStatus('error');
      }
    },
    [isUsingProps]
  );

  React.useEffect(() => {
    loadInitialData(!isUsingProps);
  }, [loadInitialData, isUsingProps]);

  // Infinite Scroll / Fetch more
  const loadMore = React.useCallback(async () => {
    if (isUsingProps || isLoadingMore || !nextCursor) return;
    setIsLoadingMore(true);
    try {
      const { items, next_created_at } = await listNotifications(
        nextCursor,
        20
      );
      const mapped = items.map(mapApiNotificationToFrontend);
      setNotifications((prev) => [...prev, ...mapped]);
      setNextCursor(next_created_at);
    } catch (error) {
      console.error('[useNotificationCenter] loadMore failed:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isUsingProps, isLoadingMore, nextCursor]);

  // Sync seenUnreadCount from localStorage when storageKey (userId) changes or on mount.
  React.useEffect(() => {
    setSeenUnreadCount(getStoredSeenCount(storageKey));
  }, [storageKey, getStoredSeenCount]);

  // Keep seenUnreadCount clamped to badgeCount to prevent stale values,
  // but only when we are not in a loading status and there is no active write/mutation in progress
  // to avoid accidental seen count cache destruction during optimistic loading states.
  React.useEffect(() => {
    if (status !== 'loading' && !isPending && seenUnreadCount > badgeCount) {
      setSeenUnreadCount(badgeCount);
      writeAndNotifySeen(badgeCount);
    }
  }, [badgeCount, seenUnreadCount, writeAndNotifySeen, status, isPending]);

  // Synchronize state across multiple instances (e.g. desktop vs mobile notification bells in Header) and browser tabs
  React.useEffect(() => {
    const handleCustomSync = (e: Event) => {
      const customEvent = e as CustomEvent<{
        storageKey: string;
        seenCount: number;
      }>;
      if (customEvent.detail && customEvent.detail.storageKey === storageKey) {
        setSeenUnreadCount(customEvent.detail.seenCount);
      }
    };

    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === storageKey) {
        const val = e.newValue !== null ? Number(e.newValue) : 0;
        setSeenUnreadCount(Number.isNaN(val) ? 0 : val);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageSync as EventListener);
      window.addEventListener('notif_seen_updated', handleCustomSync);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(
          'storage',
          handleStorageSync as EventListener
        );
        window.removeEventListener('notif_seen_updated', handleCustomSync);
      }
    };
  }, [storageKey]);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const openCenter = React.useCallback(() => {
    setOpen(true);
    setSeenUnreadCount(badgeCount);
    writeAndNotifySeen(badgeCount);
    // Fetch fresh details when dropdown is opened
    if (!isUsingProps) {
      loadInitialData(false);
    }
  }, [badgeCount, writeAndNotifySeen, isUsingProps, loadInitialData]);

  const closeCenter = React.useCallback(() => {
    setOpen(false);
  }, []);

  const onOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) {
        setSeenUnreadCount(badgeCount);
        writeAndNotifySeen(badgeCount);
        if (!isUsingProps) {
          loadInitialData(false);
        }
      }
    },
    [badgeCount, writeAndNotifySeen, isUsingProps, loadInitialData]
  );

  const markRead = React.useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, unread: false } : item))
      );
      if (!isUsingProps) {
        setUnreadCountState((prev) => Math.max(0, prev - 1));
      }

      const action = onMarkRead || (!isUsingProps ? markOneRead : null);
      if (!action) return;

      setIsPending(true);
      try {
        await action(id);
      } catch (error) {
        reportMarkAsReadFailure(`mark_read_click:${id}`, error);
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, unread: true } : item
          )
        );
        if (!isUsingProps) {
          setUnreadCountState((prev) => prev + 1);
        }
        toast({
          variant: 'destructive',
          title: '操作失敗',
          description: '無法將通知標示為已讀，請稍後再試',
        });
      } finally {
        setIsPending(false);
      }
    },
    [onMarkRead, isUsingProps, toast]
  );

  const markAllRead = React.useCallback(async () => {
    const unreadIds = notifications
      .filter((item) => item.unread)
      .map((item) => item.id);
    if (unreadIds.length === 0 && isUsingProps) return;

    // Rolls back only the affected items via functional state update (to prevent data loss).
    const rollbackNotifications = (ids: string[]) => {
      const idSet = new Set(ids);
      setNotifications((prev) =>
        prev.map((item) =>
          idSet.has(item.id) ? { ...item, unread: true } : item
        )
      );
    };

    // Optimistic state updates
    const unreadIdSet = new Set(unreadIds);
    setNotifications((prev) =>
      prev.map((item) =>
        unreadIdSet.has(item.id) ? { ...item, unread: false } : item
      )
    );
    const prevUnreadCountState = unreadCountState;
    if (!isUsingProps) {
      setUnreadCountState(0);
    }

    setIsPending(true);
    try {
      if (onMarkAllRead) {
        await onMarkAllRead(unreadIds);
      } else if (onMarkRead) {
        // Fallback: mark individually in bounded batches
        const failedIds = await markReadInBatches(unreadIds, onMarkRead);

        if (failedIds.length > 0) {
          rollbackNotifications(failedIds);
          if (!isUsingProps) {
            setUnreadCountState((prev) => prev + failedIds.length);
          }
          toast({
            variant: 'destructive',
            title: '操作失敗',
            description:
              failedIds.length === unreadIds.length
                ? '無法將通知標示為已讀，請稍後再試'
                : '部分通知標示為已讀失敗，請稍後再試',
          });
        }
      } else if (!isUsingProps) {
        await mockMarkAllRead();
      }
    } catch (error) {
      reportMarkAsReadFailure('mark_all_read', error);
      rollbackNotifications(unreadIds);
      if (!isUsingProps) {
        setUnreadCountState(prevUnreadCountState);
      }
      toast({
        variant: 'destructive',
        title: '操作失敗',
        description: '無法將全部通知標示為已讀，請稍後再試',
      });
    } finally {
      setIsPending(false);
    }
  }, [
    notifications,
    onMarkRead,
    onMarkAllRead,
    isUsingProps,
    unreadCountState,
    toast,
  ]);

  const handleRetry = React.useCallback(() => {
    setStatus('loading');
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (isUsingProps) {
      timerRef.current = setTimeout(() => {
        const loaded = initialNotifications ?? defaultNotifications;
        setNotifications(loaded);
        setStatus('success');
      }, 1000);
    } else {
      loadInitialData(true);
    }
  }, [
    initialNotifications,
    defaultNotifications,
    isUsingProps,
    loadInitialData,
  ]);

  const showBadge = isMounted && badgeCount > seenUnreadCount;
  const formattedCount = badgeCount > 99 ? '99+' : String(badgeCount);
  const hasUnread = isUsingProps
    ? notifications.some((item) => item.unread)
    : badgeCount > 0;

  return {
    open,
    status,
    items: notifications,
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
    isLoadingMore,
    hasMore: nextCursor !== null,
    loadMore,
  };
}
