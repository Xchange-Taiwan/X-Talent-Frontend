import * as mockNotificationService from '@/mocks/mockNotificationService';

/**
 * Auto-mock for `@/services/notifications/notificationService`, picked up by
 * `vi.mock('@/services/notifications/notificationService')` (no factory).
 * Delegates to `@/mocks/mockNotificationService` so `vi.spyOn` against that
 * module still intercepts calls made through this adapter.
 */
export function fetchUnreadCount(_userId: string | number) {
  return mockNotificationService.fetchUnreadCount();
}

export function listNotifications(
  _userId: string | number,
  cursor?: string | null,
  limit?: number
) {
  return mockNotificationService.listNotifications(cursor, limit);
}

export function markOneRead(
  _userId: string | number,
  notificationId: string | number
) {
  return mockNotificationService.markOneRead(notificationId);
}

export function markAllRead(_userId: string | number) {
  return mockNotificationService.markAllRead();
}
