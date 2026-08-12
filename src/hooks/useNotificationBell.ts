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

export const defaultMockNotifications: NotificationItem[] = [
  {
    id: '1',
    type: 'reservation_new',
    menteeName: '小明',
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 小時前
    unread: true,
  },
  {
    id: '2',
    type: 'reservation_success',
    mentorName: '林導師',
    createdAt: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(), // 23 小時前
    unread: true,
  },
  {
    id: '3',
    type: 'reservation_failed',
    mentorName: '王導師',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 天前
    unread: false,
  },
  {
    id: '4',
    type: 'reservation_canceled',
    mentorName: '陳導師',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 天前
    unread: false,
  },
  {
    id: '5',
    type: 'reservation_upcoming',
    mentorName: '張導師',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 天前
    unread: false,
  },
];

export type UseNotificationBellProps = {
  unreadCount: number;
  initialStatus: 'loading' | 'error' | 'empty' | 'success';
  initialNotifications?: NotificationItem[];
};

export function useNotificationBell({
  unreadCount,
  initialStatus,
  initialNotifications,
}: UseNotificationBellProps) {
  const [hasBeenClicked, setHasBeenClicked] = React.useState(false);
  const [status, setStatus] = React.useState(initialStatus);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>(
    initialNotifications ?? defaultMockNotifications
  );

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
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, unread: false }))
      );
    }
  }, []);

  const handleRetry = React.useCallback(() => {
    setStatus('loading');
    // Simulating a clean reload back to initial or default success list
    setTimeout(() => {
      setNotifications(initialNotifications ?? defaultMockNotifications);
      setStatus('success');
    }, 1000);
  }, [initialNotifications]);

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
