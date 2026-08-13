import * as React from 'react';

import { useToast } from '@/components/ui/use-toast';
import { captureFlowFailure } from '@/lib/monitoring';
import { safeGetStorage, safeSetStorage } from '@/lib/storage';

const MARK_ALL_READ_BATCH_SIZE = 5;

function reportMarkAsReadFailure(step: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[useNotificationBell] ${step} failed:`, message);
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

export type UseNotificationBellProps = {
  unreadCount: number;
  userId?: string;
  initialStatus: 'loading' | 'error' | 'empty' | 'success';
  initialNotifications?: NotificationItem[];
  defaultNotifications?: NotificationItem[];
  onMarkRead?: (id: string) => void | Promise<void>;
  onMarkAllRead?: (ids: string[]) => void | Promise<void>;
};

export function useNotificationBell({
  unreadCount,
  userId,
  initialStatus,
  initialNotifications,
  defaultNotifications = [],
  onMarkRead,
  onMarkAllRead,
}: UseNotificationBellProps) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [hasBeenClicked, setHasBeenClicked] = React.useState(false);
  const [status, setStatus] = React.useState(initialStatus);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>(
    () => initialNotifications ?? defaultNotifications
  );

  const storageKey = userId
    ? `notif_seen_unread_count_${userId}`
    : 'notif_seen_unread_count_generic';

  // Initialize synchronously to 0 to prevent Next.js SSR Hydration Mismatch.
  // The state will be populated correctly on mount by the useEffect block below.
  const [seenUnreadCount, setSeenUnreadCount] = React.useState<number>(0);
  const [isMounted, setIsMounted] = React.useState(false);

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Helper to write to localStorage and dispatch custom update event to other instances
  const writeAndNotifySeen = React.useCallback(
    (val: number) => {
      safeSetStorage(storageKey, String(val));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('notif_seen_updated'));
      }
    },
    [storageKey]
  );

  React.useEffect(() => {
    setIsMounted(true);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Sync seenUnreadCount from localStorage when storageKey (userId) changes or on mount.
  // We use strict Number.isNaN protection to handle corrupted or invalid data gracefully.
  React.useEffect(() => {
    const stored = safeGetStorage(storageKey);
    const parsed = stored !== null ? Number(stored) : 0;
    setSeenUnreadCount(Number.isNaN(parsed) ? 0 : parsed);
  }, [storageKey]);

  // Keep seenUnreadCount clamped to unreadCount to prevent stale values,
  // but only when we are not in a loading status to avoid accidental cache overwriting during API load.
  React.useEffect(() => {
    if (status !== 'loading' && seenUnreadCount > unreadCount) {
      setSeenUnreadCount(unreadCount);
      writeAndNotifySeen(unreadCount);
    }
  }, [unreadCount, seenUnreadCount, writeAndNotifySeen, status]);

  // Synchronize state across multiple instances (e.g. desktop vs mobile notification bells in Header) and browser tabs
  React.useEffect(() => {
    const handleSync = () => {
      const stored = safeGetStorage(storageKey);
      const parsed = stored !== null ? Number(stored) : 0;
      const finalCount = Number.isNaN(parsed) ? 0 : parsed;
      setSeenUnreadCount(finalCount);

      if (finalCount >= unreadCount) {
        setHasBeenClicked(true);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleSync);
      window.addEventListener('notif_seen_updated', handleSync);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleSync);
        window.removeEventListener('notif_seen_updated', handleSync);
      }
    };
  }, [storageKey, unreadCount]);

  const [prevUnreadCount, setPrevUnreadCount] = React.useState(unreadCount);

  if (unreadCount !== prevUnreadCount) {
    setPrevUnreadCount(unreadCount);
    if (unreadCount > prevUnreadCount) {
      setHasBeenClicked(false);
    }
  }

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) {
        setHasBeenClicked(true);
        setSeenUnreadCount(unreadCount);
        writeAndNotifySeen(unreadCount);
      }
    },
    [unreadCount, writeAndNotifySeen]
  );

  const closePopover = React.useCallback(() => {
    setOpen(false);
  }, []);

  const handleNotificationClick = React.useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, unread: false } : item))
      );

      if (!onMarkRead) return;

      try {
        await onMarkRead(id);
      } catch (error) {
        reportMarkAsReadFailure(`mark_read_click:${id}`, error);
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, unread: true } : item
          )
        );
        toast({
          variant: 'destructive',
          title: '操作失敗',
          description: '無法將通知標示為已讀，請稍後再試',
        });
      }
    },
    [onMarkRead, toast]
  );

  const handleMarkAllAsRead = React.useCallback(async () => {
    const unreadIds = notifications
      .filter((item) => item.unread)
      .map((item) => item.id);
    if (unreadIds.length === 0) return;

    // Rolls back only the affected items via functional state update (to
    // prevent data loss) and restores the unread badge.
    const rollbackNotifications = (ids: string[]) => {
      const idSet = new Set(ids);
      setNotifications((prev) =>
        prev.map((item) =>
          idSet.has(item.id) ? { ...item, unread: true } : item
        )
      );
      setHasBeenClicked(false);
      setSeenUnreadCount(0);
      writeAndNotifySeen(0);
    };

    // Optimistic state updates. Only flip the exact IDs being sent to the
    // API — not every currently-unread item — so a notification that
    // arrives between the snapshot above and this update (e.g. via a
    // real-time push) doesn't get marked read in the UI without ever
    // being sent to the server.
    const unreadIdSet = new Set(unreadIds);
    setHasBeenClicked(true);
    setNotifications((prev) =>
      prev.map((item) =>
        unreadIdSet.has(item.id) ? { ...item, unread: false } : item
      )
    );

    if (onMarkAllRead) {
      try {
        await onMarkAllRead(unreadIds);
      } catch (error) {
        reportMarkAsReadFailure('mark_all_read', error);
        rollbackNotifications(unreadIds);
        toast({
          variant: 'destructive',
          title: '操作失敗',
          description: '無法將全部通知標示為已讀，請稍後再試',
        });
      }
    } else if (onMarkRead) {
      // Fallback: mark individually in bounded batches (see markReadInBatches),
      // with granular error rollback per failed item.
      const failedIds = await markReadInBatches(unreadIds, onMarkRead);

      if (failedIds.length > 0) {
        rollbackNotifications(failedIds);
        toast({
          variant: 'destructive',
          title: '操作失敗',
          description:
            failedIds.length === unreadIds.length
              ? '無法將通知標示為已讀，請稍後再試'
              : '部分通知標示為已讀失敗，請稍後再試',
        });
      }
    }
  }, [notifications, onMarkRead, onMarkAllRead, toast, writeAndNotifySeen]);

  const handleRetry = React.useCallback(() => {
    setStatus('loading');
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // Simulating a clean reload back to initial or default success list
    timerRef.current = setTimeout(() => {
      const loaded = initialNotifications ?? defaultNotifications;
      setNotifications(
        hasBeenClicked ? loaded.map((n) => ({ ...n, unread: false })) : loaded
      );
      setStatus('success');
    }, 1000);
  }, [initialNotifications, defaultNotifications, hasBeenClicked]);

  const showBadge =
    isMounted && !hasBeenClicked && unreadCount > seenUnreadCount;
  const formattedCount = unreadCount > 99 ? '99+' : String(unreadCount);
  const hasUnread = notifications.some((item) => item.unread);

  return {
    open,
    closePopover,
    status,
    notifications,
    showBadge,
    formattedCount,
    hasUnread,
    handleOpenChange,
    handleRetry,
    handleNotificationClick,
    handleMarkAllAsRead,
  };
}
