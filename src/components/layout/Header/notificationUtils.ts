import dayjs from 'dayjs';

import type { NotificationItem } from '@/hooks/useNotificationCenter';

type NotificationContent = {
  title: string;
  body: string;
};

type NotificationConfigEntry = {
  getContent: (item: NotificationItem) => NotificationContent;
  getHref: (item: NotificationItem, isMentorContext: boolean) => string;
};

function getMentorContext(item: NotificationItem): boolean {
  return (
    item.role === 'mentor' || (item.role === undefined && !!item.menteeName)
  );
}

/**
 * Single source of truth for how each notification `type` renders (title,
 * body) and where it links to (href). Keeping both concerns keyed by the
 * same type here avoids having to update two separate switch statements
 * (previously in NotificationBell.tsx and notificationUtils.ts) whenever a
 * type is added or changed.
 */
const NOTIFICATION_CONFIG: Record<
  NotificationItem['type'],
  NotificationConfigEntry
> = {
  reservation_requested: {
    getContent: (item) => ({
      title: '您有新的預約',
      body: `${item.menteeName || 'Mentee'} 與您提出預約需求，請前往接受預約`,
    }),
    getHref: () => '/reservation/mentor?tab=pending',
  },
  reservation_success: {
    getContent: (item) => ({
      title: `${item.mentorName || 'Mentor'} 已接受您的預約`,
      body: '前往查看您的預約詳情',
    }),
    getHref: () => '/reservation/mentee?tab=upcoming',
  },
  reservation_failed: {
    getContent: (item) => ({
      title: `您與 ${item.mentorName || 'Mentor'} 的預約已被拒絕`,
      body: '您的預約已被拒絕，歡迎重新預約',
    }),
    getHref: () => '/mentor-pool',
  },
  reservation_canceled: {
    getContent: (item) => {
      const name = item.mentorName || item.menteeName || '導師';
      if (item.actorRole === 'system') {
        const isMentor = getMentorContext(item);
        return {
          title: `您與 ${name} 的預約已自動取消`,
          body: isMentor
            ? '因您未於預約開始前 24 小時前確認，系統已自動取消此預約'
            : '因導師未於預約開始前 24 小時前確認，系統已自動取消此預約，歡迎重新預約',
        };
      }
      return {
        title: `您與 ${name} 的預約已被取消`,
        body: '您的預約已被取消，歡迎重新預約',
      };
    },
    getHref: (_item, isMentorContext) =>
      isMentorContext ? '/reservation/mentor?tab=history' : '/mentor-pool',
  },
  reservation_upcoming: {
    getContent: (item) => {
      const name = item.mentorName || item.menteeName || '導師';
      if (typeof item.dtstart === 'number' && Number.isFinite(item.dtstart)) {
        const formattedTime = dayjs
          .unix(item.dtstart)
          .format('YYYY/MM/DD HH:mm');
        return {
          title: `您與 ${name} 的預約即將到來`,
          body: `您與 ${name} 的會議即將在 ${formattedTime} 開始，請準時上線`,
        };
      }
      return {
        title: `您與 ${name} 的預約即將到來`,
        body: `您 24 小時後有與 ${name} 的會議，請準時上線`,
      };
    },
    getHref: (_item, isMentorContext) =>
      isMentorContext
        ? '/reservation/mentor?tab=upcoming'
        : '/reservation/mentee?tab=upcoming',
  },
};

const DEFAULT_CONTENT: NotificationContent = {
  title: '通知',
  body: '您有一則新通知',
};

const DEFAULT_HREF = '/';

/**
 * Returns content templates (title, body) for notification items.
 */
export function getNotificationContent(
  item: NotificationItem
): NotificationContent {
  const entry = NOTIFICATION_CONFIG[item.type];
  return entry ? entry.getContent(item) : DEFAULT_CONTENT;
}

/**
 * Returns the destination URL for a given notification item contextually.
 */
export function getNotificationHref(item: NotificationItem): string {
  const entry = NOTIFICATION_CONFIG[item.type];
  return entry ? entry.getHref(item, getMentorContext(item)) : DEFAULT_HREF;
}
