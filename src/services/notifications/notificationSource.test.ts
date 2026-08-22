import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchUnreadCount,
  listNotifications,
  markAllRead,
  markOneRead,
} from './notificationService';
import {
  createFixtureNotificationSource,
  httpNotificationSource,
} from './notificationSource';

// Mock the underlying services
vi.mock('./notificationService', () => ({
  fetchUnreadCount: vi.fn(),
  listNotifications: vi.fn(),
  markOneRead: vi.fn(),
  markAllRead: vi.fn(),
}));

describe('httpNotificationSource', () => {
  beforeEach(() => {
    vi.mocked(fetchUnreadCount).mockReset();
    vi.mocked(listNotifications).mockReset();
    vi.mocked(markOneRead).mockReset();
    vi.mocked(markAllRead).mockReset();
  });

  it('should correctly delegate getUnreadCount and listNotifications to the service endpoints', async () => {
    vi.mocked(fetchUnreadCount).mockResolvedValue({ unread_count: 5 });
    vi.mocked(listNotifications).mockResolvedValue({
      notifications: [],
      next_cursor: 'next-123',
    });

    const unreadRes = await httpNotificationSource.getUnreadCount('user-123');
    expect(fetchUnreadCount).toHaveBeenCalledWith('user-123');
    expect(unreadRes.unread_count).toBe(5);

    const listRes = await httpNotificationSource.listNotifications(
      'user-123',
      'cursor-123',
      20
    );
    expect(listNotifications).toHaveBeenCalledWith(
      'user-123',
      'cursor-123',
      20
    );
    expect(listRes.notifications).toEqual([]);
    expect(listRes.next_cursor).toBe('next-123');
  });

  it('should correctly delegate write/mutation requests to the service endpoints', async () => {
    vi.mocked(markOneRead).mockResolvedValue(undefined);
    vi.mocked(markAllRead).mockResolvedValue(undefined);

    await httpNotificationSource.markOneRead('user-123', 'notif-111');
    expect(markOneRead).toHaveBeenCalledWith('user-123', 'notif-111');

    await httpNotificationSource.markAllRead('user-123');
    expect(markAllRead).toHaveBeenCalledWith('user-123');
  });

  it('should propagate service errors outwards', async () => {
    vi.mocked(fetchUnreadCount).mockRejectedValue(new Error('Network Failure'));

    await expect(
      httpNotificationSource.getUnreadCount('user-123')
    ).rejects.toThrow('Network Failure');
  });
});

describe('createFixtureNotificationSource', () => {
  it('should initialize with provided notifications and correctly return unread count', async () => {
    const mockNotifications = [
      {
        id: '1',
        type: 'reservation_requested' as const,
        createdAt: new Date().toISOString(),
        unread: true,
      },
      {
        id: '2',
        type: 'reservation_success' as const,
        createdAt: new Date().toISOString(),
        unread: false,
      },
    ];
    const source = createFixtureNotificationSource(mockNotifications);

    const countRes = await source.getUnreadCount('any-user');
    expect(countRes.unread_count).toBe(1);

    const listRes = await source.listNotifications('any-user');
    expect(listRes.notifications).toHaveLength(2);
    expect(listRes.next_cursor).toBeNull();
  });

  it('should support pagination via cursor and limit', async () => {
    const mockNotifications = Array.from({ length: 5 }, (_, i) => ({
      id: String(i + 1),
      type: 'reservation_requested' as const,
      createdAt: new Date().toISOString(),
      unread: true,
    }));
    const source = createFixtureNotificationSource(mockNotifications);

    // Load first page of 2 items
    const page1 = await source.listNotifications('any-user', null, 2);
    expect(page1.notifications).toHaveLength(2);
    expect(page1.notifications[0].id).toBe('1');
    expect(page1.notifications[1].id).toBe('2');
    expect(page1.next_cursor).toBe('2');

    // Load second page of 2 items
    const page2 = await source.listNotifications('any-user', '2', 2);
    expect(page2.notifications).toHaveLength(2);
    expect(page2.notifications[0].id).toBe('3');
    expect(page2.notifications[1].id).toBe('4');
    expect(page2.next_cursor).toBe('4');

    // Load third page (final item)
    const page3 = await source.listNotifications('any-user', '4', 2);
    expect(page3.notifications).toHaveLength(1);
    expect(page3.notifications[0].id).toBe('5');
    expect(page3.next_cursor).toBeNull();
  });

  it('should mark a single notification as read', async () => {
    const mockNotifications = [
      {
        id: '1',
        type: 'reservation_requested' as const,
        createdAt: new Date().toISOString(),
        unread: true,
      },
    ];
    const source = createFixtureNotificationSource(mockNotifications);

    await source.markOneRead('any-user', '1');

    const countRes = await source.getUnreadCount('any-user');
    expect(countRes.unread_count).toBe(0);

    const listRes = await source.listNotifications('any-user');
    expect(listRes.notifications[0].unread).toBe(false);
  });

  it('should mark all notifications as read', async () => {
    const mockNotifications = [
      {
        id: '1',
        type: 'reservation_requested' as const,
        createdAt: new Date().toISOString(),
        unread: true,
      },
      {
        id: '2',
        type: 'reservation_success' as const,
        createdAt: new Date().toISOString(),
        unread: true,
      },
    ];
    const source = createFixtureNotificationSource(mockNotifications);

    await source.markAllRead('any-user');

    const countRes = await source.getUnreadCount('any-user');
    expect(countRes.unread_count).toBe(0);

    const listRes = await source.listNotifications('any-user');
    expect(listRes.notifications.every((n) => !n.unread)).toBe(true);
  });
});
