import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type NotificationItem,
  useNotificationCenter,
} from '@/hooks/useNotificationCenter';
import { captureFlowFailure } from '@/lib/monitoring';
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

  it('synchronizes seen state across different browser tabs / instances', async () => {
    const { result } = renderHook(() =>
      useNotificationCenter({
        userId: 'user-123',
        initialNotifications: mockNotifications,
      })
    );

    expect(result.current.showBadge).toBe(true);

    // Simulate custom event sync (same page / other instance)
    act(() => {
      window.dispatchEvent(
        new CustomEvent('notif_seen_updated', {
          detail: {
            storageKey: 'notif_seen_unread_count_user-123',
            seenCount: 2,
          },
        })
      );
    });

    expect(result.current.showBadge).toBe(false);

    // Simulate storage event sync (other browser tab)
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'notif_seen_unread_count_user-123',
          newValue: '0',
        })
      );
    });

    expect(result.current.showBadge).toBe(true);
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
});
