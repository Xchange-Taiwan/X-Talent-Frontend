import * as React from 'react';

import { toast } from '@/components/ui/use-toast';

const MARK_ALL_READ_BATCH_SIZE = 5;

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
          console.error(
            `Failed to mark notification ${id} as read:`,
            error instanceof Error ? error.message : String(error)
          );
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
  initialStatus: 'loading' | 'error' | 'empty' | 'success';
  initialNotifications?: NotificationItem[];
  defaultNotifications?: NotificationItem[];
  onMarkRead?: (id: string) => void | Promise<void>;
  onMarkAllRead?: (ids: string[]) => void | Promise<void>;
};

export function useNotificationBell({
  unreadCount,
  initialStatus,
  initialNotifications,
  defaultNotifications = [],
  onMarkRead,
  onMarkAllRead,
}: UseNotificationBellProps) {
  const [open, setOpen] = React.useState(false);
  const [hasBeenClicked, setHasBeenClicked] = React.useState(false);
  const [status, setStatus] = React.useState(initialStatus);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>(
    () => initialNotifications ?? defaultNotifications
  );

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const [prevUnreadCount, setPrevUnreadCount] = React.useState(unreadCount);

  if (unreadCount !== prevUnreadCount) {
    setPrevUnreadCount(unreadCount);
    if (unreadCount > prevUnreadCount) {
      setHasBeenClicked(false);
    }
  }

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setHasBeenClicked(true);
    }
  }, []);

  const closePopover = React.useCallback(() => {
    setOpen(false);
  }, []);

  const handleNotificationClick = React.useCallback(
    (id: string) => {
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, unread: false } : item))
      );
      onMarkRead?.(id);
    },
    [onMarkRead]
  );

  const handleMarkAllAsRead = React.useCallback(async () => {
    const unreadIds = notifications
      .filter((item) => item.unread)
      .map((item) => item.id);
    if (unreadIds.length === 0) return;

    // Optimistic state updates
    setHasBeenClicked(true);
    setNotifications((prev) =>
      prev.map((item) => (item.unread ? { ...item, unread: false } : item))
    );

    if (onMarkAllRead) {
      try {
        await onMarkAllRead(unreadIds);
      } catch (error) {
        console.error(
          'Failed to mark all notifications as read:',
          error instanceof Error ? error.message : String(error)
        );
        // Rollback only the affected items via functional state update to prevent data loss
        setNotifications((prev) =>
          prev.map((item) =>
            unreadIds.includes(item.id) ? { ...item, unread: true } : item
          )
        );
        setHasBeenClicked(false);
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
        setNotifications((prev) =>
          prev.map((item) =>
            failedIds.includes(item.id) ? { ...item, unread: true } : item
          )
        );
        setHasBeenClicked(false); // Restore unread badge if at least one failed
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
  }, [notifications, onMarkRead, onMarkAllRead]);

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

  const showBadge = !hasBeenClicked && unreadCount > 0;
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
