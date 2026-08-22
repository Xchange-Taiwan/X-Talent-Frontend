import { describe, expect, it } from 'vitest';

import { createFixtureNotificationSource } from './notificationSource';

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
