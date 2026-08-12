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
};

export function useNotificationBell({
  unreadCount,
  initialStatus,
  initialNotifications,
  defaultNotifications = [],
  onMarkRead,
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

  const handleMarkAllAsRead = React.useCallback(() => {
    setNotifications((prev) => {
      const hasUnread = prev.some((item) => item.unread);
      if (!hasUnread) return prev;

      prev.forEach((item) => {
        if (item.unread) {
          onMarkRead?.(item.id);
        }
      });

      return prev.map((item) => ({ ...item, unread: false }));
    });
  }, [onMarkRead]);

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

  return {
    open,
    closePopover,
    status,
    notifications,
    showBadge,
    formattedCount,
    handleOpenChange,
    handleRetry,
    handleNotificationClick,
    handleMarkAllAsRead,
  };
}
