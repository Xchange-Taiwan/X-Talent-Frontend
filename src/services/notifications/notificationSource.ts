import {
  fetchUnreadCount,
  listNotifications,
  markAllRead,
  markOneRead,
} from './notificationService';
import type { NotificationItem } from './types';

export interface NotificationSource {
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
