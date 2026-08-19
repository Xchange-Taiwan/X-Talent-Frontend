import { mapNotificationVOToItem } from '@/services/notifications/notificationMapper';
import type { NotificationItem } from '@/stores/notificationStore';
import { components } from '@/types/api';

export type ApiNotificationItem = components['schemas']['NotificationVO'];

// Simulated database of mock notifications (in-memory stateful copy)
let dbNotifications: ApiNotificationItem[] = [
  {
    id: 1,
    type: 'reservation_requested',
    metadata: {
      role: 'mentor',
      counterparty_name: '林小明',
    },
    created_at: Math.floor((Date.now() - 5 * 60 * 1000) / 1000), // 5 mins ago in seconds
    read_at: null,
  },
  {
    id: 2,
    type: 'reservation_success',
    metadata: {
      role: 'mentee',
      counterparty_name: '張導師',
    },
    created_at: Math.floor((Date.now() - 30 * 60 * 1000) / 1000), // 30 mins ago in seconds
    read_at: null,
  },
  {
    id: 3,
    type: 'reservation_canceled',
    metadata: {
      role: 'mentor',
      counterparty_name: '陳小華',
    },
    created_at: Math.floor((Date.now() - 2 * 60 * 60 * 1000) / 1000), // 2 hours ago
    read_at: null,
  },
  {
    id: 4,
    type: 'reservation_upcoming',
    metadata: {
      role: 'mentee',
      counterparty_name: '劉導師',
    },
    created_at: Math.floor((Date.now() - 4 * 60 * 60 * 1000) / 1000), // 4 hours ago
    read_at: null,
  },
  {
    id: 5,
    type: 'reservation_failed',
    metadata: {
      role: 'mentee',
      counterparty_name: '周導師',
    },
    created_at: Math.floor((Date.now() - 12 * 60 * 60 * 1000) / 1000), // 12 hours ago
    read_at: null,
  },
  {
    id: 6,
    type: 'reservation_requested',
    metadata: {
      role: 'mentor',
      counterparty_name: '王小美',
    },
    created_at: Math.floor((Date.now() - 23 * 60 * 60 * 1000) / 1000), // 23 hours ago
    read_at: null,
  },
  {
    id: 7,
    type: 'reservation_success',
    metadata: {
      role: 'mentee',
      counterparty_name: '黃導師',
    },
    created_at: Math.floor((Date.now() - 1.5 * 24 * 60 * 60 * 1000) / 1000), // 1.5 days ago
    read_at: Math.floor(new Date('2026-08-14T12:00:00Z').getTime() / 1000),
  },
  {
    id: 8,
    type: 'reservation_canceled',
    metadata: {
      role: 'mentee',
      counterparty_name: '許導師',
    },
    created_at: Math.floor((Date.now() - 2 * 24 * 60 * 60 * 1000) / 1000), // 2 days ago
    read_at: Math.floor(new Date('2026-08-14T11:00:00Z').getTime() / 1000),
  },
  {
    id: 9,
    type: 'reservation_upcoming',
    metadata: {
      role: 'mentor',
      counterparty_name: '朱小智',
    },
    created_at: Math.floor((Date.now() - 3 * 24 * 60 * 60 * 1000) / 1000), // 3 days ago
    read_at: Math.floor(new Date('2026-08-13T10:00:00Z').getTime() / 1000),
  },
  {
    id: 10,
    type: 'reservation_requested',
    metadata: {
      role: 'mentor',
      counterparty_name: '徐大勇',
    },
    created_at: Math.floor((Date.now() - 4 * 24 * 60 * 60 * 1000) / 1000), // 4 days ago
    read_at: null,
  },
  {
    id: 11,
    type: 'reservation_success',
    metadata: {
      role: 'mentee',
      counterparty_name: '蔡導師',
    },
    created_at: Math.floor((Date.now() - 5 * 24 * 60 * 60 * 1000) / 1000), // 5 days ago
    read_at: Math.floor(new Date('2026-08-11T09:00:00Z').getTime() / 1000),
  },
  {
    id: 12,
    type: 'reservation_failed',
    metadata: {
      role: 'mentee',
      counterparty_name: '林導師',
    },
    created_at: Math.floor((Date.now() - 6 * 24 * 60 * 60 * 1000) / 1000), // 6 days ago
    read_at: Math.floor(new Date('2026-08-10T08:00:00Z').getTime() / 1000),
  },
  {
    id: 13,
    type: 'reservation_upcoming',
    metadata: {
      role: 'mentee',
      counterparty_name: '葉導師',
    },
    created_at: Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000), // 7 days ago
    read_at: Math.floor(new Date('2026-08-09T07:00:00Z').getTime() / 1000),
  },
  {
    id: 14,
    type: 'reservation_canceled',
    metadata: {
      role: 'mentor',
      counterparty_name: '施曉同',
    },
    created_at: Math.floor((Date.now() - 8 * 24 * 60 * 60 * 1000) / 1000), // 8 days ago
    read_at: Math.floor(new Date('2026-08-08T06:00:00Z').getTime() / 1000),
  },
  {
    id: 15,
    type: 'reservation_requested',
    metadata: {
      role: 'mentor',
      counterparty_name: '呂俊傑',
    },
    created_at: Math.floor((Date.now() - 9 * 24 * 60 * 60 * 1000) / 1000), // 9 days ago
    read_at: null,
  },
  {
    id: 16,
    type: 'reservation_success',
    metadata: {
      role: 'mentee',
      counterparty_name: '趙導師',
    },
    created_at: Math.floor((Date.now() - 10 * 24 * 60 * 60 * 1000) / 1000), // 10 days ago
    read_at: Math.floor(new Date('2026-08-06T05:00:00Z').getTime() / 1000),
  },
  {
    id: 17,
    type: 'reservation_upcoming',
    metadata: {
      role: 'mentor',
      counterparty_name: '何雨凡',
    },
    created_at: Math.floor((Date.now() - 12 * 24 * 60 * 60 * 1000) / 1000), // 12 days ago
    read_at: Math.floor(new Date('2026-08-04T04:00:00Z').getTime() / 1000),
  },
  {
    id: 18,
    type: 'reservation_canceled',
    metadata: {
      role: 'mentee',
      counterparty_name: '高導師',
    },
    created_at: Math.floor((Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000), // 14 days ago
    read_at: Math.floor(new Date('2026-08-02T03:00:00Z').getTime() / 1000),
  },
  {
    id: 19,
    type: 'reservation_failed',
    metadata: {
      role: 'mentee',
      counterparty_name: '郭導師',
    },
    created_at: Math.floor((Date.now() - 15 * 24 * 60 * 60 * 1000) / 1000), // 15 days ago
    read_at: Math.floor(new Date('2026-08-01T02:00:00Z').getTime() / 1000),
  },
  {
    id: 20,
    type: 'reservation_requested',
    metadata: {
      role: 'mentor',
      counterparty_name: '潘建國',
    },
    created_at: Math.floor((Date.now() - 16 * 24 * 60 * 60 * 1000) / 1000), // 16 days ago
    read_at: null,
  },
  {
    id: 21,
    type: 'reservation_success',
    metadata: {
      role: 'mentee',
      counterparty_name: '董導師',
    },
    created_at: Math.floor((Date.now() - 18 * 24 * 60 * 60 * 1000) / 1000), // 18 days ago
    read_at: Math.floor(new Date('2026-07-29T01:00:00Z').getTime() / 1000),
  },
  {
    id: 22,
    type: 'reservation_canceled',
    metadata: {
      role: 'mentor',
      counterparty_name: '程家樂',
    },
    created_at: Math.floor((Date.now() - 20 * 24 * 60 * 60 * 1000) / 1000), // 20 days ago
    read_at: Math.floor(new Date('2026-07-27T00:00:00Z').getTime() / 1000),
  },
  {
    id: 23,
    type: 'reservation_upcoming',
    metadata: {
      role: 'mentee',
      counterparty_name: '謝導師',
    },
    created_at: Math.floor((Date.now() - 22 * 24 * 60 * 60 * 1000) / 1000), // 22 days ago
    read_at: Math.floor(new Date('2026-07-25T00:00:00Z').getTime() / 1000),
  },
  {
    id: 24,
    type: 'reservation_requested',
    metadata: {
      role: 'mentor',
      counterparty_name: '傅小晴',
    },
    created_at: Math.floor((Date.now() - 25 * 24 * 60 * 60 * 1000) / 1000), // 25 days ago
    read_at: null,
  },
  {
    id: 25,
    type: 'reservation_success',
    metadata: {
      role: 'mentee',
      counterparty_name: '曾導師',
    },
    created_at: Math.floor((Date.now() - 26 * 24 * 60 * 60 * 1000) / 1000), // 26 days ago
    read_at: Math.floor(new Date('2026-07-21T00:00:00Z').getTime() / 1000),
  },
  {
    id: 26,
    type: 'reservation_failed',
    metadata: {
      role: 'mentee',
      counterparty_name: '彭導師',
    },
    created_at: Math.floor((Date.now() - 27 * 24 * 60 * 60 * 1000) / 1000), // 27 days ago
    read_at: Math.floor(new Date('2026-07-20T00:00:00Z').getTime() / 1000),
  },
  {
    id: 27,
    type: 'reservation_canceled',
    metadata: {
      role: 'mentee',
      counterparty_name: '蔣導師',
    },
    created_at: Math.floor((Date.now() - 28 * 24 * 60 * 60 * 1000) / 1000), // 28 days ago
    read_at: Math.floor(new Date('2026-07-19T00:00:00Z').getTime() / 1000),
  },
  {
    id: 28,
    type: 'reservation_upcoming',
    metadata: {
      role: 'mentor',
      counterparty_name: '唐子軒',
    },
    created_at: Math.floor((Date.now() - 29 * 24 * 60 * 60 * 1000) / 1000), // 29 days ago
    read_at: Math.floor(new Date('2026-07-18T00:00:00Z').getTime() / 1000),
  },
  {
    id: 29,
    type: 'reservation_requested',
    metadata: {
      role: 'mentor',
      counterparty_name: '薛大宇',
    },
    created_at: Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000), // 30 days ago
    read_at: null,
  },
  {
    id: 30,
    type: 'reservation_success',
    metadata: {
      role: 'mentee',
      counterparty_name: '魏導師',
    },
    created_at: Math.floor((Date.now() - 31 * 24 * 60 * 60 * 1000) / 1000), // 31 days ago
    read_at: Math.floor(new Date('2026-07-16T00:00:00Z').getTime() / 1000),
  },
];

const LATENCY = 100; // Simulated latency in ms

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cursor-paginated notification listing.
 * Filters items older than the `cursor` (which is `created_at` timestamp of the previous response).
 */
export async function listNotifications(
  cursor?: string | null,
  limit: number = 20
): Promise<{
  notifications: NotificationItem[];
  next_cursor: string | null;
}> {
  await delay(LATENCY);

  // Sort by created_at descending (newest first)
  const sorted = [...dbNotifications].sort(
    (a, b) => b.created_at - a.created_at
  );

  let startIndex = 0;
  if (cursor) {
    const cursorTime = Number(cursor);
    startIndex = sorted.findIndex((item) => item.created_at < cursorTime);
    if (startIndex === -1) {
      return { notifications: [], next_cursor: null };
    }
  }

  const slice = sorted.slice(startIndex, startIndex + limit);
  const lastItemInSlice = slice[slice.length - 1];
  const nextCursor =
    lastItemInSlice && startIndex + limit < sorted.length
      ? String(lastItemInSlice.created_at)
      : null;

  const rawSlice: ApiNotificationItem[] = JSON.parse(JSON.stringify(slice));

  return {
    notifications: rawSlice.map(mapNotificationVOToItem),
    next_cursor: nextCursor,
  };
}

/**
 * Fetches total unread count from the mock database.
 */
export async function fetchUnreadCount(): Promise<{ unread_count: number }> {
  await delay(LATENCY);
  const unread_count = dbNotifications.filter((item) => !item.read_at).length;
  return { unread_count };
}

/**
 * Marks a single notification as read by updating `read_at`.
 */
export async function markOneRead(id: string | number): Promise<void> {
  await delay(LATENCY);
  const numericId = Number(id);
  const item = dbNotifications.find((n) => n.id === numericId);
  if (item) {
    item.read_at = Math.floor(Date.now() / 1000);
  }
}

/**
 * Marks all notifications as read.
 */
export async function markAllRead(): Promise<void> {
  await delay(LATENCY);
  const now = Math.floor(Date.now() / 1000);
  dbNotifications.forEach((item) => {
    if (!item.read_at) {
      item.read_at = now;
    }
  });
}

/**
 * Helper to reset the stateful database (used primarily for testing).
 */
export function resetMockNotificationDatabase(
  initialItems?: ApiNotificationItem[]
): void {
  if (initialItems) {
    dbNotifications = JSON.parse(JSON.stringify(initialItems));
  } else {
    // Restore default
    dbNotifications = dbNotifications.map((item) => ({
      ...item,
      read_at: null,
    }));
  }
}
