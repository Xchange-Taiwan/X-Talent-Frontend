import { beforeEach, describe, expect, it } from 'vitest';

import type { NotificationSource } from '@/services/notifications/notificationSource';

import { notificationStoreManager } from './notificationStore';

function fakeSource(): NotificationSource {
  return {
    listNotifications: async () => ({ notifications: [], next_cursor: null }),
    getUnreadCount: async () => ({ unread_count: 0 }),
    markOneRead: async () => {},
    markAllRead: async () => {},
  };
}

describe('notificationStoreManager source ownership', () => {
  beforeEach(() => {
    notificationStoreManager.clear();
  });

  it('returns undefined for a store key with no source set yet', () => {
    expect(notificationStoreManager.getSource('user-1')).toBeUndefined();
  });

  it('returns the source previously handed off via setSource', () => {
    const source = fakeSource();
    notificationStoreManager.setSource('user-1', source);

    expect(notificationStoreManager.getSource('user-1')).toBe(source);
  });

  it('keeps sources isolated per store key', () => {
    const sourceA = fakeSource();
    const sourceB = fakeSource();
    notificationStoreManager.setSource('user-1', sourceA);
    notificationStoreManager.setSource('user-2', sourceB);

    expect(notificationStoreManager.getSource('user-1')).toBe(sourceA);
    expect(notificationStoreManager.getSource('user-2')).toBe(sourceB);
  });

  it('overwrites a store key source when setSource is called again', () => {
    const first = fakeSource();
    const second = fakeSource();
    notificationStoreManager.setSource('user-1', first);
    notificationStoreManager.setSource('user-1', second);

    expect(notificationStoreManager.getSource('user-1')).toBe(second);
  });

  it('clears all sources on reset()', () => {
    notificationStoreManager.setSource('user-1', fakeSource());
    notificationStoreManager.setSource('user-2', fakeSource());

    notificationStoreManager.clear();

    expect(notificationStoreManager.getSource('user-1')).toBeUndefined();
    expect(notificationStoreManager.getSource('user-2')).toBeUndefined();
  });
});
