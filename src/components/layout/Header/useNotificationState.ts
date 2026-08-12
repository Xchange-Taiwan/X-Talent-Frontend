import * as React from 'react';

import {
  getDefaultMockNotifications,
  type NotificationItem,
} from './notificationUtils';

export type UseNotificationStateProps = {
  unreadCount: number;
  initialStatus: 'loading' | 'error' | 'empty' | 'success';
  initialNotifications?: NotificationItem[];
  onRetry?: () => void | Promise<void>;
};

export function useNotificationState({
  unreadCount,
  initialStatus,
  initialNotifications,
  onRetry,
}: UseNotificationStateProps) {
  const [hasBeenClicked, setHasBeenClicked] = React.useState(false);
  const [status, setStatus] = React.useState(initialStatus);

  // Lazy state initialization to completely avoid SSR Hydration discrepancies on Dates
  const [notifications, setNotifications] = React.useState<NotificationItem[]>(
    () => initialNotifications ?? getDefaultMockNotifications()
  );

  // Track unreadCount changes and reset hasBeenClicked if new notifications arrive (solving badge hidden bug)
  const [prevUnread, setPrevUnread] = React.useState(unreadCount);
  if (unreadCount > prevUnread) {
    setPrevUnread(unreadCount);
    setHasBeenClicked(false);
  } else if (unreadCount !== prevUnread) {
    setPrevUnread(unreadCount);
  }

  const handleOpenChange = React.useCallback((open: boolean) => {
    if (open) {
      setHasBeenClicked(true);
    }
  }, []);

  const handleRetry = React.useCallback(async () => {
    setStatus('loading');
    if (onRetry) {
      try {
        await onRetry();
        setStatus('success');
      } catch (e) {
        setStatus('error');
      }
    } else {
      // Simulating a clean reload back to mock success list
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          setNotifications(getDefaultMockNotifications());
          setStatus('success');
          resolve();
        }, 1000);
      });
    }
  }, [onRetry]);

  const showBadge = !hasBeenClicked && unreadCount > 0;
  const formattedCount = unreadCount > 99 ? '99+' : String(unreadCount);

  return {
    status,
    notifications,
    showBadge,
    formattedCount,
    handleOpenChange,
    handleRetry,
  };
}
