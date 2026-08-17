import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type NotificationItem,
  useNotificationCenter,
} from '@/hooks/useNotificationCenter';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  notificationStoreManager,
  resetNotificationStore,
} from '@/stores/notificationStore';
import { mockToast } from '@/test/mocks/useToast';

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
}));

const mockNotifications: NotificationItem[] = [
  {
    id: 'n1',
    type: 'reservation_new',
    createdAt: new Date().toISOString(),
    unread: true,
  },
  {
    id: 'n2',
    type: 'reservation_success',
    createdAt: new Date().toISOString(),
    unread: true,
  },
  {
    id: 'n3',
    type: 'reservation_failed',
    createdAt: new Date().toISOString(),
    unread: false,
  },
];

describe('useNotificationCenter', () => {
  beforeEach(() => {
    mockToast.mockClear();
    vi.mocked(captureFlowFailure).mockClear();
    localStorage.clear();
    resetNotificationStore();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() =>
      useNotificationCenter({
        initialNotifications: mockNotifications,
      })
    );

    expect(result.current.open).toBe(false);
    expect(result.current.status).toBe('success');
    expect(result.current.items).toEqual(mockNotifications);
    expect(result.current.badgeCount).toBe(2); // n1 and n2 are unread
    expect(result.current.showBadge).toBe(true); // isMounted is true, and unreadCount (2) > seenUnreadCount (0)
    expect(result.current.formattedCount).toBe('2');
    expect(result.current.hasUnread).toBe(true);
  });

  it('updates open state and seen count when openCenter/closeCenter or onOpenChange is called', () => {
    const { result } = renderHook(() =>
      useNotificationCenter({
        userId: 'user-123',
        initialNotifications: mockNotifications,
      })
    );

    expect(result.current.showBadge).toBe(true);

    // Open center
    act(() => {
      result.current.openCenter();
    });

    expect(result.current.open).toBe(true);
    // showBadge becomes false because seenUnreadCount is now 2, and 2 > 2 is false
    expect(result.current.showBadge).toBe(false);
    expect(localStorage.getItem('notif_seen_unread_count_user-123')).toBe('2');

    // Close center
    act(() => {
      result.current.closeCenter();
    });

    expect(result.current.open).toBe(false);
    expect(result.current.showBadge).toBe(false);

    // Call onOpenChange(false) and then onOpenChange(true)
    act(() => {
      result.current.onOpenChange(true);
    });
    expect(result.current.open).toBe(true);
  });

  it('marks single notification read and rolls back on failure', async () => {
    const onMarkReadMock = vi.fn().mockRejectedValue(new Error('API failure'));
    const { result } = renderHook(() =>
      useNotificationCenter({
        initialNotifications: [mockNotifications[0]],
        onMarkRead: onMarkReadMock,
      })
    );

    expect(result.current.items[0].unread).toBe(true);

    // Click markRead
    await act(async () => {
      await result.current.markRead('n1');
    });

    // Check rollback occurred
    expect(result.current.items[0].unread).toBe(true);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: '無法將通知標示為已讀，請稍後再試',
      })
    );
    expect(captureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'notification_mark_all_read',
        step: 'mark_read_click:n1',
        message: 'API failure',
      })
    );
  });

  it('marks all notifications read successfully', async () => {
    const onMarkAllReadMock = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useNotificationCenter({
        initialNotifications: mockNotifications,
        onMarkAllRead: onMarkAllReadMock,
      })
    );

    expect(result.current.badgeCount).toBe(2);

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(result.current.badgeCount).toBe(0);
    expect(result.current.items.every((n) => !n.unread)).toBe(true);
    expect(onMarkAllReadMock).toHaveBeenCalledWith(['n1', 'n2']);
  });

  it('rolls back all read optimistic updates on markAllRead failure', async () => {
    const onMarkAllReadMock = vi
      .fn()
      .mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() =>
      useNotificationCenter({
        initialNotifications: mockNotifications,
        onMarkAllRead: onMarkAllReadMock,
      })
    );

    expect(result.current.badgeCount).toBe(2);

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(result.current.badgeCount).toBe(2);
    expect(result.current.items[0].unread).toBe(true);
    expect(result.current.items[1].unread).toBe(true);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: '無法將全部通知標示為已讀，請稍後再試',
      })
    );
  });

  it('processes fallback sequential onMarkRead in batches of 5 on markAllRead', async () => {
    const onMarkReadMock = vi.fn().mockResolvedValue(undefined);
    const manyNotifications = Array.from({ length: 6 }, (_, i) => ({
      id: `m${i}`,
      type: 'reservation_new' as const,
      createdAt: new Date().toISOString(),
      unread: true,
    }));

    const { result } = renderHook(() =>
      useNotificationCenter({
        initialNotifications: manyNotifications,
        onMarkRead: onMarkReadMock,
      })
    );

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(result.current.badgeCount).toBe(0);
    expect(onMarkReadMock).toHaveBeenCalledTimes(6);
  });

  it('synchronizes seen count and markRead/markAllRead state across different instances on the same page via shared store and across browser tabs via storage event', async () => {
    const { result: hook1 } = renderHook(() =>
      useNotificationCenter({
        userId: 'user-123',
        initialNotifications: mockNotifications,
      })
    );

    const { result: hook2 } = renderHook(() =>
      useNotificationCenter({
        userId: 'user-123',
        initialNotifications: mockNotifications,
      })
    );

    expect(hook1.current.showBadge).toBe(true);
    expect(hook2.current.showBadge).toBe(true);
    expect(hook1.current.badgeCount).toBe(2);
    expect(hook2.current.badgeCount).toBe(2);

    // 1. Test markRead synchronization:
    // Mark first item as read on hook1 -> should update hook2's badgeCount and item unread status!
    await act(async () => {
      await hook1.current.markRead('n1');
    });

    expect(hook1.current.badgeCount).toBe(1);
    expect(hook2.current.badgeCount).toBe(1);
    expect(hook1.current.items.find((item) => item.id === 'n1')?.unread).toBe(
      false
    );
    expect(hook2.current.items.find((item) => item.id === 'n1')?.unread).toBe(
      false
    );

    // 2. Test markAllRead synchronization:
    // Mark all read on hook1 -> should clear hook2's badgeCount completely!
    await act(async () => {
      await hook1.current.markAllRead();
    });

    expect(hook1.current.badgeCount).toBe(0);
    expect(hook2.current.badgeCount).toBe(0);

    // 3. Test seen state synchronization on openCenter:
    // Re-render hooks with unread items to test seen state
    const { result: hook1Seen } = renderHook(() =>
      useNotificationCenter({
        userId: 'user-seen-sync',
        initialNotifications: mockNotifications,
      })
    );
    const { result: hook2Seen } = renderHook(() =>
      useNotificationCenter({
        userId: 'user-seen-sync',
        initialNotifications: mockNotifications,
      })
    );

    expect(hook1Seen.current.showBadge).toBe(true);
    expect(hook2Seen.current.showBadge).toBe(true);

    act(() => {
      hook1Seen.current.openCenter();
    });

    expect(hook1Seen.current.showBadge).toBe(false);
    expect(hook2Seen.current.showBadge).toBe(false);

    // 4. Test storage event cross-tab synchronization:
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'notif_seen_unread_count_user-seen-sync',
          newValue: '0',
        })
      );
    });

    expect(hook1Seen.current.showBadge).toBe(true);
    expect(hook2Seen.current.showBadge).toBe(true);
  });

  it('clamps seenUnreadCount to current unreadCount on render/sync unless loading', async () => {
    localStorage.setItem('notif_seen_unread_count_user-123', '5');

    renderHook(() =>
      useNotificationCenter({
        userId: 'user-123',
        initialNotifications: mockNotifications, // Has 2 unread
      })
    );

    // On mount, clamping should sync seen count from 5 down to 2
    await waitFor(() => {
      expect(localStorage.getItem('notif_seen_unread_count_user-123')).toBe(
        '2'
      );
    });
  });

  it('unsubscribes from the store manager on unmount to prevent memory leaks', () => {
    const unsubscribeSpy = vi.fn();
    const originalSubscribe = notificationStoreManager.subscribe.bind(
      notificationStoreManager
    );
    vi.spyOn(notificationStoreManager, 'subscribe').mockImplementation(
      (key, listener) => {
        const unsub = originalSubscribe(key, listener);
        return () => {
          unsubscribeSpy();
          unsub();
        };
      }
    );

    const { unmount } = renderHook(() =>
      useNotificationCenter({
        userId: 'user-cleanup-test',
        initialNotifications: mockNotifications,
      })
    );

    unmount();
    expect(unsubscribeSpy).toHaveBeenCalled();
  });

  it('isolates state and unread count between different users', () => {
    const { result: userAHook } = renderHook(() =>
      useNotificationCenter({
        userId: 'user-A',
        initialNotifications: mockNotifications,
      })
    );

    const { result: userBHook } = renderHook(() =>
      useNotificationCenter({
        userId: 'user-B',
        initialNotifications: [
          {
            id: 'n1-b',
            type: 'reservation_new',
            createdAt: new Date().toISOString(),
            unread: true,
          },
        ],
      })
    );

    expect(userAHook.current.badgeCount).toBe(2);
    expect(userBHook.current.badgeCount).toBe(1);

    // Open User A's bell: should update A's seen count, but NOT B's!
    act(() => {
      userAHook.current.openCenter();
    });

    expect(userAHook.current.showBadge).toBe(false);
    expect(userBHook.current.showBadge).toBe(true);
  });

  it('synchronizes single markRead optimistic update failures and rollbacks across both instances on the same page', async () => {
    const onMarkReadMock = vi.fn().mockRejectedValue(new Error('API failure'));

    const { result: hook1 } = renderHook(() =>
      useNotificationCenter({
        userId: 'user-rollback-single-test',
        initialNotifications: mockNotifications,
        onMarkRead: onMarkReadMock,
      })
    );

    const { result: hook2 } = renderHook(() =>
      useNotificationCenter({
        userId: 'user-rollback-single-test',
        initialNotifications: mockNotifications,
        onMarkRead: onMarkReadMock,
      })
    );

    expect(hook1.current.badgeCount).toBe(2);
    expect(hook2.current.badgeCount).toBe(2);

    // Trigger markRead on hook1 -> will fail and rollback on both!
    await act(async () => {
      await hook1.current.markRead('n1');
    });

    expect(hook1.current.badgeCount).toBe(2);
    expect(hook2.current.badgeCount).toBe(2);
    expect(hook1.current.items.find((item) => item.id === 'n1')?.unread).toBe(
      true
    );
    expect(hook2.current.items.find((item) => item.id === 'n1')?.unread).toBe(
      true
    );
  });

  it('synchronizes markAllRead optimistic update failures and rollbacks across both instances on the same page', async () => {
    const onMarkAllReadMock = vi
      .fn()
      .mockRejectedValue(new Error('API failure'));

    const { result: hook1 } = renderHook(() =>
      useNotificationCenter({
        userId: 'user-rollback-all-test',
        initialNotifications: mockNotifications,
        onMarkAllRead: onMarkAllReadMock,
      })
    );

    const { result: hook2 } = renderHook(() =>
      useNotificationCenter({
        userId: 'user-rollback-all-test',
        initialNotifications: mockNotifications,
        onMarkAllRead: onMarkAllReadMock,
      })
    );

    expect(hook1.current.badgeCount).toBe(2);
    expect(hook2.current.badgeCount).toBe(2);

    // Trigger markAllRead on hook1 -> will fail and rollback on both!
    await act(async () => {
      await hook1.current.markAllRead();
    });

    expect(hook1.current.badgeCount).toBe(2);
    expect(hook2.current.badgeCount).toBe(2);
    expect(
      hook1.current.items.every(
        (item) =>
          item.unread ===
          mockNotifications.find((n) => n.id === item.id)?.unread
      )
    ).toBe(true);
    expect(
      hook2.current.items.every(
        (item) =>
          item.unread ===
          mockNotifications.find((n) => n.id === item.id)?.unread
      )
    ).toBe(true);
  });

  it('creates a new clean state instance on every call without caching in SSR environments (to prevent memory leaks)', () => {
    vi.stubGlobal('window', undefined);
    try {
      const stateA = notificationStoreManager.getOrCreateState('ssr-test');
      const stateB = notificationStoreManager.getOrCreateState('ssr-test');

      expect(stateA).not.toBe(stateB);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
