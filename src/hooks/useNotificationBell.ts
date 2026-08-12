import * as React from 'react';

import { captureApiFailure } from '@/lib/monitoring';

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

    // Capture original state for rollback on error
    const originalNotifications = [...notifications];

    // Optimistic state updates
    setHasBeenClicked(true);
    setNotifications((prev) =>
      prev.map((item) => (item.unread ? { ...item, unread: false } : item))
    );

    if (onMarkAllRead) {
      try {
        await onMarkAllRead(unreadIds);
      } catch (error) {
        console.error('Failed to mark all notifications as read:', error);
        captureApiFailure({
          endpoint: '/api/notifications/read-all',
          method: 'POST',
          status: 0,
          message: error instanceof Error ? error.message : String(error),
        });
        // Rollback on batch API failure
        setNotifications(originalNotifications);
        setHasBeenClicked(false);
      }
    } else if (onMarkRead) {
      // Fallback with sequential processing to prevent concurrent API flooding
      // and perform granular error recovery per item!
      try {
        for (const id of unreadIds) {
          try {
            await onMarkRead(id);
          } catch (error) {
            console.error(`Failed to mark notification ${id} as read:`, error);
            captureApiFailure({
              endpoint: `/api/notifications/${id}/read`,
              method: 'POST',
              status: 0,
              message: error instanceof Error ? error.message : String(error),
            });
            // Granular recovery: rollback ONLY this failed notification to unread
            setNotifications((prev) =>
              prev.map((item) =>
                item.id === id ? { ...item, unread: true } : item
              )
            );
            setHasBeenClicked(false); // Restore unread badge
          }
        }
      } catch (error) {
        console.error(
          'Unexpected error in fallback mark-all-read loop:',
          error
        );
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
