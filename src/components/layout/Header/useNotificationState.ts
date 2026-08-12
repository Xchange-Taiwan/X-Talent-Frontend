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
  onMarkAllRead?: () => void;
};

export function useNotificationState({
  unreadCount,
  initialStatus,
  initialNotifications,
  onRetry,
  onMarkAllRead,
}: UseNotificationStateProps) {
  const [hasBeenClicked, setHasBeenClicked] = React.useState(false);
  const [status, setStatus] = React.useState(initialStatus);

  // The default mock notifications embed Date.now()-derived timestamps, so
  // computing them in a useState lazy initializer would still run once
  // during SSR and again during client hydration at two different instants
  // - a real (if currently dormant, since this component is gated behind a
  // client-only auth check) hydration-mismatch risk. Start from a
  // deterministic empty array instead and populate the non-deterministic
  // mock data only after mount, client-side.
  const [notifications, setNotifications] = React.useState<NotificationItem[]>(
    () => initialNotifications ?? []
  );

  React.useEffect(() => {
    if (!initialNotifications) {
      setNotifications(getDefaultMockNotifications());
    }
    // Only ever needs to run once, to seed the mock data after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleMarkAllRead = React.useCallback(() => {
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, unread: false }))
    );
    onMarkAllRead?.();
  }, [onMarkAllRead]);

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
    handleMarkAllRead,
  };
}
