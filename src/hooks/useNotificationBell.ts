import * as React from 'react';

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
      }
    } else if (onMarkRead) {
      // Fallback with parallel execution using Promise.allSettled to prevent sequential waterfall,
      // while preserving granular error rollback per failed item!
      const results = await Promise.allSettled(
        unreadIds.map(async (id) => {
          try {
            await onMarkRead(id);
            return id;
          } catch (error) {
            console.error(
              `Failed to mark notification ${id} as read:`,
              error instanceof Error ? error.message : String(error)
            );
            throw error; // Let Promise.allSettled see this as rejected
          }
        })
      );

      // Scan results for any rejected promises and perform granular rollback for failed IDs
      const failedIds: string[] = [];
      results.forEach((res, index) => {
        if (res.status === 'rejected') {
          failedIds.push(unreadIds[index]);
        }
      });

      if (failedIds.length > 0) {
        setNotifications((prev) =>
          prev.map((item) =>
            failedIds.includes(item.id) ? { ...item, unread: true } : item
          )
        );
        setHasBeenClicked(false); // Restore unread badge if at least one failed
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
