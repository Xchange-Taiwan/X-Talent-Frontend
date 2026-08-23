import {
  fetchUnreadCount,
  listNotifications,
  markAllRead,
  markOneRead,
} from './notificationService';
import type { NotificationItem } from './types';

/**
 * How long the fixture source pretends a manual retry takes, so Storybook's
 * error state visibly transitions through the loading skeleton.
 */
const FIXTURE_RETRY_DELAY_MS = 1000;

export interface NotificationSource {
  /**
   * Whether this source's calls are only meaningful for an authenticated
   * user. Callers suppress reads and writes while they have no user id.
   */
  requiresAuth?: boolean;
  /**
   * Whether this source is seeded up-front instead of fetched. A preloaded
   * source already holds the whole list, so callers must not drive
   * refresh/pagination loads into it, and must not persist a "seen" badge
   * count on its behalf.
   */
  isPreloaded?: boolean;
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
  /**
   * Source-specific handling for a manual retry, resolving with the list to
   * show. Sources that omit it are retried by re-running the normal initial
   * load.
   */
  retry?(userId: string): Promise<NotificationItem[]>;
}

export const httpNotificationSource: NotificationSource = {
  requiresAuth: true,
  isPreloaded: false,
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
    isPreloaded: true,
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
    async retry(_userId: string) {
      await new Promise((resolve) =>
        setTimeout(resolve, FIXTURE_RETRY_DELAY_MS)
      );
      return list;
    },
  };
}
