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
};

export type UseNotificationBellProps = {
  unreadCount: number;
  initialStatus: 'loading' | 'error' | 'empty' | 'success';
  initialNotifications?: NotificationItem[];
  defaultNotifications?: NotificationItem[];
};

export function useNotificationBell({
  unreadCount,
  initialStatus,
  initialNotifications,
  defaultNotifications = [],
}: UseNotificationBellProps) {
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
  const [localUnreadCount, setLocalUnreadCount] = React.useState(unreadCount);

  if (unreadCount !== prevUnreadCount) {
    setPrevUnreadCount(unreadCount);
    setLocalUnreadCount(unreadCount);
    if (unreadCount > prevUnreadCount) {
      setHasBeenClicked(false);
    }
  }

  const handleOpenChange = React.useCallback((open: boolean) => {
    if (open) {
      setHasBeenClicked(true);
      setLocalUnreadCount(0);
      setNotifications((prev) => {
        const hasUnread = prev.some((item) => item.unread);
        return hasUnread
          ? prev.map((item) => ({ ...item, unread: false }))
          : prev;
      });
    }
  }, []);

  const handleRetry = React.useCallback(() => {
    setStatus('loading');
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // Simulating a clean reload back to initial or default success list
    timerRef.current = setTimeout(() => {
      setNotifications(initialNotifications ?? defaultNotifications);
      setStatus('success');
    }, 1000);
  }, [initialNotifications, defaultNotifications]);

  const showBadge = !hasBeenClicked && localUnreadCount > 0;
  const formattedCount =
    localUnreadCount > 99 ? '99+' : String(localUnreadCount);

  return {
    status,
    notifications,
    localUnreadCount,
    showBadge,
    formattedCount,
    handleOpenChange,
    handleRetry,
  };
}
