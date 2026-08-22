import {
  fetchUnreadCount,
  listNotifications,
  markAllRead,
  markOneRead,
} from './notificationService';
import type { NotificationItem } from './types';

export interface NotificationSource {
  requiresAuth?: boolean;
  getUnreadCount(userId: string): Promise<{ unread_count: number }>;
  listNotifications(
    userId: string,
    cursor?: string | null,
    limit?: number
  ): Promise<{
    notifications: NotificationItem[];
    next_cursor: string | null;
  }>;
  markOneRead(userId: string, notificationId: string): Promise<unknown>;
  markAllRead(userId: string): Promise<unknown>;
}

export const httpNotificationSource: NotificationSource = {
  requiresAuth: true,
  async getUnreadCount(userId: string) {
    const res = await fetchUnreadCount(userId);
    return { unread_count: (res && res.unread_count) ?? 0 };
  },
  async listNotifications(
    userId: string,
    cursor?: string | null,
    limit?: number
  ) {
    const res = await listNotifications(userId, cursor, limit);
    return {
      notifications: res?.notifications ?? [],
      next_cursor: res?.next_cursor ?? null,
    };
  },
  markOneRead(userId: string, notificationId: string) {
    return markOneRead(userId, notificationId);
  },
  markAllRead(userId: string) {
    return markAllRead(userId);
  },
};

export function createFixtureNotificationSource(
  initialNotifications: NotificationItem[] = []
): NotificationSource {
  let list = [...initialNotifications];

  return {
    requiresAuth: false,
    async getUnreadCount(_userId: string) {
      const count = list.filter((n) => n.unread).length;
      return { unread_count: count };
    },
    async listNotifications(
      _userId: string,
      cursor?: string | null,
      limit?: number
    ) {
      const startIdx = cursor ? parseInt(cursor, 10) : 0;
      if (Number.isNaN(startIdx)) {
        return { notifications: list, next_cursor: null };
      }
      const pageSize = limit ?? 20;
      const paginated = list.slice(startIdx, startIdx + pageSize);
      const nextCursor =
        startIdx + pageSize < list.length ? String(startIdx + pageSize) : null;
      return {
        notifications: paginated,
        next_cursor: nextCursor,
      };
    },
    async markOneRead(_userId: string, notificationId: string) {
      list = list.map((item) =>
        item.id === notificationId ? { ...item, unread: false } : item
      );
      return { success: true };
    },
    async markAllRead(_userId: string) {
      list = list.map((item) => ({ ...item, unread: false }));
      return { success: true };
    },
  };
}
