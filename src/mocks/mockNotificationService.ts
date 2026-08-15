export interface ApiNotificationItem {
  id: string;
  type:
    | 'reservation_new'
    | 'reservation_success'
    | 'reservation_failed'
    | 'reservation_canceled'
    | 'reservation_upcoming';
  metadata: {
    role?: 'mentor' | 'mentee';
    mentee_name?: string;
    mentor_name?: string;
  };
  created_at: string;
  read_at: string | null;
}

// Simulated database of mock notifications (in-memory stateful copy)
let dbNotifications: ApiNotificationItem[] = [
  {
    id: 'n1',
    type: 'reservation_new',
    metadata: {
      role: 'mentor',
      mentee_name: '林小明',
    },
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago
    read_at: null,
  },
  {
    id: 'n2',
    type: 'reservation_success',
    metadata: {
      role: 'mentee',
      mentor_name: '張導師',
    },
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
    read_at: null,
  },
  {
    id: 'n3',
    type: 'reservation_canceled',
    metadata: {
      role: 'mentor',
      mentee_name: '陳小華',
    },
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    read_at: null,
  },
  {
    id: 'n4',
    type: 'reservation_upcoming',
    metadata: {
      role: 'mentee',
      mentor_name: '劉導師',
    },
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    read_at: null,
  },
  {
    id: 'n5',
    type: 'reservation_failed',
    metadata: {
      role: 'mentee',
      mentor_name: '周導師',
    },
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
    read_at: null,
  },
  {
    id: 'n6',
    type: 'reservation_new',
    metadata: {
      role: 'mentor',
      mentee_name: '王小美',
    },
    created_at: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(), // 23 hours ago
    read_at: null,
  },
  {
    id: 'n7',
    type: 'reservation_success',
    metadata: {
      role: 'mentee',
      mentor_name: '黃導師',
    },
    created_at: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString(), // 1.5 days ago
    read_at: '2026-08-14T12:00:00Z',
  },
  {
    id: 'n8',
    type: 'reservation_canceled',
    metadata: {
      role: 'mentee',
      mentor_name: '許導師',
    },
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    read_at: '2026-08-14T11:00:00Z',
  },
  {
    id: 'n9',
    type: 'reservation_upcoming',
    metadata: {
      role: 'mentor',
      mentee_name: '朱小智',
    },
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    read_at: '2026-08-13T10:00:00Z',
  },
  {
    id: 'n10',
    type: 'reservation_new',
    metadata: {
      role: 'mentor',
      mentee_name: '徐大勇',
    },
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
    read_at: null,
  },
  {
    id: 'n11',
    type: 'reservation_success',
    metadata: {
      role: 'mentee',
      mentor_name: '蔡導師',
    },
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    read_at: '2026-08-11T09:00:00Z',
  },
  {
    id: 'n12',
    type: 'reservation_failed',
    metadata: {
      role: 'mentee',
      mentor_name: '林導師',
    },
    created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days ago
    read_at: '2026-08-10T08:00:00Z',
  },
  {
    id: 'n13',
    type: 'reservation_upcoming',
    metadata: {
      role: 'mentee',
      mentor_name: '葉導師',
    },
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    read_at: '2026-08-09T07:00:00Z',
  },
  {
    id: 'n14',
    type: 'reservation_canceled',
    metadata: {
      role: 'mentor',
      mentee_name: '施曉同',
    },
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago
    read_at: '2026-08-08T06:00:00Z',
  },
  {
    id: 'n15',
    type: 'reservation_new',
    metadata: {
      role: 'mentor',
      mentee_name: '呂俊傑',
    },
    created_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(), // 9 days ago
    read_at: null,
  },
  {
    id: 'n16',
    type: 'reservation_success',
    metadata: {
      role: 'mentee',
      mentor_name: '趙導師',
    },
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    read_at: '2026-08-06T05:00:00Z',
  },
  {
    id: 'n17',
    type: 'reservation_upcoming',
    metadata: {
      role: 'mentor',
      mentee_name: '何雨凡',
    },
    created_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(), // 12 days ago
    read_at: '2026-08-04T04:00:00Z',
  },
  {
    id: 'n18',
    type: 'reservation_canceled',
    metadata: {
      role: 'mentee',
      mentor_name: '高導師',
    },
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
    read_at: '2026-08-02T03:00:00Z',
  },
  {
    id: 'n19',
    type: 'reservation_failed',
    metadata: {
      role: 'mentee',
      mentor_name: '郭導師',
    },
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
    read_at: '2026-08-01T02:00:00Z',
  },
  {
    id: 'n20',
    type: 'reservation_new',
    metadata: {
      role: 'mentor',
      mentee_name: '潘建國',
    },
    created_at: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(), // 16 days ago
    read_at: null,
  },
  {
    id: 'n21',
    type: 'reservation_success',
    metadata: {
      role: 'mentee',
      mentor_name: '董導師',
    },
    created_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(), // 18 days ago
    read_at: '2026-07-29T01:00:00Z',
  },
  {
    id: 'n22',
    type: 'reservation_canceled',
    metadata: {
      role: 'mentor',
      mentee_name: '程家樂',
    },
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 days ago
    read_at: '2026-07-27T00:00:00Z',
  },
  {
    id: 'n23',
    type: 'reservation_upcoming',
    metadata: {
      role: 'mentee',
      mentor_name: '謝導師',
    },
    created_at: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(), // 22 days ago
    read_at: '2026-07-25T00:00:00Z',
  },
  {
    id: 'n24',
    type: 'reservation_new',
    metadata: {
      role: 'mentor',
      mentee_name: '傅小晴',
    },
    created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), // 25 days ago
    read_at: null,
  },
  {
    id: 'n25',
    type: 'reservation_success',
    metadata: {
      role: 'mentee',
      mentor_name: '曾導師',
    },
    created_at: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000).toISOString(), // 26 days ago
    read_at: '2026-07-21T00:00:00Z',
  },
  {
    id: 'n26',
    type: 'reservation_failed',
    metadata: {
      role: 'mentee',
      mentor_name: '彭導師',
    },
    created_at: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString(), // 27 days ago
    read_at: '2026-07-20T00:00:00Z',
  },
  {
    id: 'n27',
    type: 'reservation_canceled',
    metadata: {
      role: 'mentee',
      mentor_name: '蔣導師',
    },
    created_at: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(), // 28 days ago
    read_at: '2026-07-19T00:00:00Z',
  },
  {
    id: 'n28',
    type: 'reservation_upcoming',
    metadata: {
      role: 'mentor',
      mentee_name: '唐子軒',
    },
    created_at: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString(), // 29 days ago
    read_at: '2026-07-18T00:00:00Z',
  },
  {
    id: 'n29',
    type: 'reservation_new',
    metadata: {
      role: 'mentor',
      mentee_name: '薛大宇',
    },
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    read_at: null,
  },
  {
    id: 'n30',
    type: 'reservation_success',
    metadata: {
      role: 'mentee',
      mentor_name: '魏導師',
    },
    created_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(), // 31 days ago
    read_at: '2026-07-16T00:00:00Z',
  },
];

const LATENCY = 300; // Simulated latency in ms

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * --------------------------------------------------------------------------------
 * MODULE BOUNDARY & SEAM
 * The functions below represent the mock notification service endpoints.
 * When the real backend APIs are shipped, replace the contents of these functions
 * with actual apiClient calls (e.g. using apiClient.get / apiClient.post).
 * --------------------------------------------------------------------------------
 */

/**
 * Cursor-paginated notification listing.
 * Filters items older than the `cursor` (which is `next_created_at` from the previous response).
 */
export async function listNotifications(
  cursor?: string,
  limit: number = 20
): Promise<{
  items: ApiNotificationItem[];
  next_created_at: string | null;
}> {
  await delay(LATENCY);

  // Sort by created_at descending (newest first)
  const sorted = [...dbNotifications].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  let startIndex = 0;
  if (cursor) {
    // Find the first index of an item that is strictly older than the cursor timestamp
    const cursorTime = new Date(cursor).getTime();
    startIndex = sorted.findIndex(
      (item) => new Date(item.created_at).getTime() < cursorTime
    );
    if (startIndex === -1) {
      return { items: [], next_created_at: null };
    }
  }

  const slice = sorted.slice(startIndex, startIndex + limit);
  const lastItemInSlice = slice[slice.length - 1];
  const nextCreatedAt =
    lastItemInSlice && startIndex + limit < sorted.length
      ? lastItemInSlice.created_at
      : null;

  return {
    items: JSON.parse(JSON.stringify(slice)), // Deep copy to prevent side effects
    next_created_at: nextCreatedAt,
  };
}

/**
 * Fetches total unread count from the mock database.
 */
export async function fetchUnreadCount(): Promise<{ count: number }> {
  await delay(LATENCY);
  const count = dbNotifications.filter((item) => !item.read_at).length;
  return { count };
}

/**
 * Marks a single notification as read by updating `read_at`.
 */
export async function markOneRead(id: string): Promise<void> {
  await delay(LATENCY);
  const item = dbNotifications.find((n) => n.id === id);
  if (item) {
    item.read_at = new Date().toISOString();
  }
}

/**
 * Marks all notifications as read.
 */
export async function markAllRead(): Promise<void> {
  await delay(LATENCY);
  const now = new Date().toISOString();
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
