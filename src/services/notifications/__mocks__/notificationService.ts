import { vi } from 'vitest';

import * as mockNotificationService from '@/mocks/mockNotificationService';

/**
 * Auto-mock for `@/services/notifications/notificationService`, picked up by
 * `vi.mock('@/services/notifications/notificationService')` (no factory).
 * Delegates to `@/mocks/mockNotificationService` so `vi.spyOn` against that
 * module still intercepts calls made through this adapter.
 */
export const fetchUnreadCount = vi.fn((_userId?: string | number) => {
  return mockNotificationService.fetchUnreadCount();
});

export const listNotifications = vi.fn(
  (_userId?: string | number, cursor?: string | null, limit?: number) => {
    return mockNotificationService.listNotifications(cursor, limit);
  }
);

export const markOneRead = vi.fn(
  (_userId?: string | number, notificationId?: string | number) => {
    return mockNotificationService.markOneRead(notificationId ?? '');
  }
);

export const markAllRead = vi.fn((_userId?: string | number) => {
  return mockNotificationService.markAllRead();
});
