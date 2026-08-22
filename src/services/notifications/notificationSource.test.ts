import { describe, expect, it, vi } from 'vitest';

import {
  fetchUnreadCount,
  listNotifications,
  markAllRead,
  markOneRead,
} from './notificationService';
import { httpNotificationSource } from './notificationSource';

vi.mock('./notificationService', () => ({
  fetchUnreadCount: vi.fn(),
  listNotifications: vi.fn(),
  markAllRead: vi.fn(),
  markOneRead: vi.fn(),
}));

describe('httpNotificationSource', () => {
  it('should delegate getUnreadCount to fetchUnreadCount', async () => {
    const mockRes = { unread_count: 5 };
    vi.mocked(fetchUnreadCount).mockResolvedValue(mockRes);

    const res = await httpNotificationSource.getUnreadCount('user-123');

    expect(fetchUnreadCount).toHaveBeenCalledWith('user-123');
    expect(res).toStrictEqual(mockRes);
  });

  it('should delegate listNotifications to listNotifications service', async () => {
    const mockRes = { notifications: [], next_cursor: null };
    vi.mocked(listNotifications).mockResolvedValue(mockRes);

    const res = await httpNotificationSource.listNotifications(
      'user-123',
      'cursor-111',
      20
    );

    expect(listNotifications).toHaveBeenCalledWith(
      'user-123',
      'cursor-111',
      20
    );
    expect(res).toBe(mockRes);
  });

  it('should delegate markOneRead to markOneRead service', async () => {
    vi.mocked(markOneRead).mockResolvedValue(undefined);

    await httpNotificationSource.markOneRead('user-123', 'notif-111');

    expect(markOneRead).toHaveBeenCalledWith('user-123', 'notif-111');
  });

  it('should delegate markAllRead to markAllRead service', async () => {
    vi.mocked(markAllRead).mockResolvedValue(undefined);

    await httpNotificationSource.markAllRead('user-123');

    expect(markAllRead).toHaveBeenCalledWith('user-123');
  });
});
