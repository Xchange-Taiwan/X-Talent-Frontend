import {
  Bell,
  CalendarCheck,
  CalendarOff,
  CalendarPlus,
  CalendarX,
  Clock,
} from 'lucide-react';
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

/**
 * Returns content templates (title, body, styles, and icon) for notification items.
 */
export function getNotificationContent(item: NotificationItem) {
  switch (item.type) {
    case 'reservation_new':
      return {
        title: '您有新的預約',
        body: `${item.menteeName || 'Mentee'} 與您提出預約需求，請前往接受預約`,
        iconBgClass: 'bg-brand-50 text-brand-600',
        icon: <CalendarPlus className="size-5" />,
      };
    case 'reservation_success':
      return {
        title: `${item.mentorName || 'Mentor'} 已接受您的預約`,
        body: '前往查看您的預約詳情',
        iconBgClass: 'bg-status-success-default/10 text-status-success-default',
        icon: <CalendarCheck className="size-5" />,
      };
    case 'reservation_failed':
      return {
        title: `您與 ${item.mentorName || 'Mentor'} 的預約已被拒絕`,
        body: '您的預約已被拒絕，歡迎重新預約',
        iconBgClass: 'bg-status-error-default/10 text-status-error-default',
        icon: <CalendarX className="size-5" />,
      };
    case 'reservation_canceled': {
      const name = item.mentorName || item.menteeName || '導師';
      return {
        title: `您與 ${name} 的預約已被取消`,
        body: '您的預約已被取消，歡迎重新預約',
        iconBgClass: 'bg-background-hover text-text-secondary',
        icon: <CalendarOff className="size-5" />,
      };
    }
    case 'reservation_upcoming': {
      const name = item.mentorName || item.menteeName || '導師';
      return {
        title: `您與 ${name} 的預約即將到來`,
        body: `您 24 小時後有與 ${name} 的會議，請準時上線`,
        iconBgClass: 'bg-status-warning-default/10 text-status-warning-default',
        icon: <Clock className="size-5" />,
      };
    }
    default:
      return {
        title: '通知',
        body: '您有一則新通知',
        iconBgClass: 'bg-background-bottom text-text-primary',
        icon: <Bell className="size-5" />,
      };
  }
}
