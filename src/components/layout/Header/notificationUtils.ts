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

export const getDefaultMockNotifications = (): NotificationItem[] => [
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
 * Returns content templates (title and body) for notification items.
 * Keeping the logic pure and free of React JSX elements ensures complete
 * separation of concerns and high testability.
 */
export function getNotificationContent(item: NotificationItem) {
  switch (item.type) {
    case 'reservation_new':
      return {
        title: '您有新的預約',
        body: `${item.menteeName || 'Mentee'} 與您提出預約需求，請前往接受預約`,
      };
    case 'reservation_success':
      return {
        title: `${item.mentorName || 'Mentor'} 已接受您的預約`,
        body: '前往查看您的預約詳情',
      };
    case 'reservation_failed':
      return {
        title: `您與 ${item.mentorName || 'Mentor'} 的預約已被拒絕`,
        body: '您的預約已被拒絕，歡迎重新預約',
      };
    case 'reservation_canceled': {
      const name = item.mentorName || item.menteeName || '導師';
      return {
        title: `您與 ${name} 的預約已被取消`,
        body: '您的預約已被取消，歡迎重新預約',
      };
    }
    case 'reservation_upcoming': {
      const name = item.mentorName || item.menteeName || '導師';
      return {
        title: `您與 ${name} 的預約即將到來`,
        body: `您 24 小時後有與 ${name} 的會議，請準時上線`,
      };
    }
    default:
      return {
        title: '通知',
        body: '您有一則新通知',
      };
  }
}

/**
 * Returns the destination URL for a given notification item contextually.
 */
export function getNotificationHref(item: NotificationItem): string {
  const isMentorContext =
    item.role === 'mentor' || (item.role === undefined && !!item.menteeName);

  switch (item.type) {
    case 'reservation_new':
      return '/reservation/mentor?tab=pending';
    case 'reservation_success':
      return '/reservation/mentee?tab=upcoming';
    case 'reservation_failed':
      return '/mentor-pool';
    case 'reservation_canceled':
      return isMentorContext
        ? '/reservation/mentor?tab=history'
        : '/mentor-pool';
    case 'reservation_upcoming':
      return isMentorContext
        ? '/reservation/mentor?tab=upcoming'
        : '/reservation/mentee?tab=upcoming';
    default:
      return '/';
  }
}
