import type { NotificationItem } from '@/hooks/useNotificationCenter';

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
