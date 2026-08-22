import { describe, expect, it, vi } from 'vitest';

import type { components } from '@/types/api';

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
    expect(res).toStrictEqual(mockRes);
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

  it('should return unread_count as 0 if fetchUnreadCount returns nullish values', async () => {
    vi.mocked(fetchUnreadCount).mockResolvedValue(undefined);
    let res = await httpNotificationSource.getUnreadCount('user-123');
    expect(res).toStrictEqual({ unread_count: 0 });

    vi.mocked(fetchUnreadCount).mockResolvedValue(
      {} as unknown as components['schemas']['UnreadNotificationCountVO']
    );
    res = await httpNotificationSource.getUnreadCount('user-123');
    expect(res).toStrictEqual({ unread_count: 0 });

    vi.mocked(fetchUnreadCount).mockResolvedValue(
      null as unknown as components['schemas']['UnreadNotificationCountVO']
    );
    res = await httpNotificationSource.getUnreadCount('user-123');
    expect(res).toStrictEqual({ unread_count: 0 });
  });

  it('should propagate errors from listNotifications', async () => {
    const error = new Error('Network error');
    vi.mocked(listNotifications).mockRejectedValue(error);

    await expect(
      httpNotificationSource.listNotifications('user-123', null, 20)
    ).rejects.toThrow('Network error');
  });

  it('should propagate errors from markOneRead', async () => {
    const error = new Error('Auth error');
    vi.mocked(markOneRead).mockRejectedValue(error);

    await expect(
      httpNotificationSource.markOneRead('user-123', 'notif-111')
    ).rejects.toThrow('Auth error');
  });
});
