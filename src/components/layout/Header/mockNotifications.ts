import { type NotificationItem } from '@/hooks/useNotificationCenter';

export const defaultMockNotifications: NotificationItem[] = [
  {
    id: '1',
    type: 'reservation_requested',
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
