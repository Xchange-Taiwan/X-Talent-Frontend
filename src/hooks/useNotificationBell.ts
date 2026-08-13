import * as React from 'react';

import { useToast } from '@/components/ui/use-toast';
import { usePersistedSeenCount } from '@/hooks/usePersistedSeenCount';
import { captureFlowFailure } from '@/lib/monitoring';

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
  const [status, setStatus] = React.useState(initialStatus);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>(
    () => initialNotifications ?? defaultNotifications
  );

  const storageKey = userId
    ? `notif_seen_unread_count_${userId}`
    : 'notif_seen_unread_count_generic';

  // Delegate persistent seen counts, synchronization, and localStorage lifecycle to usePersistedSeenCount
  const { seenUnreadCount, setSeenUnreadCount, isMounted, writeAndNotifySeen } =
    usePersistedSeenCount(storageKey, unreadCount, status);

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Sync initialStatus prop changes into internal status state
  React.useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) {
        setSeenUnreadCount(unreadCount);
        writeAndNotifySeen(unreadCount);
      }
    },
    [unreadCount, setSeenUnreadCount, writeAndNotifySeen]
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

    // Rolls back only the affected items via functional state update (to prevent data loss).
    // Note: We do NOT reset seenUnreadCount to 0, because the user has already opened the dropdown
    // and seen these notifications (seen status is decoupled from backend unread state).
    const rollbackNotifications = (ids: string[]) => {
      const idSet = new Set(ids);
      setNotifications((prev) =>
        prev.map((item) =>
          idSet.has(item.id) ? { ...item, unread: true } : item
        )
      );
    };

    // Optimistic state updates. Only flip the exact IDs being sent to the
    // API — not every currently-unread item — so a notification that
    // arrives between the snapshot above and this update (e.g. via a
    // real-time push) doesn't get marked read in the UI without ever
    // being sent to the server.
    const unreadIdSet = new Set(unreadIds);
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
  }, [notifications, onMarkRead, onMarkAllRead, toast]);

  const handleRetry = React.useCallback(() => {
    setStatus('loading');
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // Simulating a clean reload back to initial or default success list.
    // Unread status of notifications is preserved, adhering to specifications.
    timerRef.current = setTimeout(() => {
      const loaded = initialNotifications ?? defaultNotifications;
      setNotifications(loaded);
      setStatus('success');
    }, 1000);
  }, [initialNotifications, defaultNotifications]);

  const showBadge = isMounted && unreadCount > seenUnreadCount;
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
