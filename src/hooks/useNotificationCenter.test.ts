import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type NotificationItem,
  useNotificationCenter,
} from '@/hooks/useNotificationCenter';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  fetchUnreadCount,
  listNotifications,
} from '@/services/notifications/notificationService';
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

// Uses src/services/notifications/__mocks__/notificationService.ts
vi.mock('@/services/notifications/notificationService');

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

const mockNotifications: NotificationItem[] = [
  {
    id: 'n1',
    type: 'reservation_requested',
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
      type: 'reservation_requested' as const,
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
            type: 'reservation_requested',
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

  describe('dependency injection (custom notificationSource)', () => {
    it('should route operations through custom notificationSource if provided', async () => {
      const mockSource = {
        getUnreadCount: vi.fn().mockResolvedValue({ unread_count: 7 }),
        listNotifications: vi.fn().mockResolvedValue({
          notifications: mockNotifications,
          next_cursor: null,
        }),
        markOneRead: vi.fn().mockResolvedValue(undefined),
        markAllRead: vi.fn().mockResolvedValue(undefined),
      };

      const { result } = renderHook(() =>
        useNotificationCenter({
          userId: 'di-user',
          notificationSource: mockSource,
        })
      );

      // On mount, should load unread count from mock source
      await waitFor(() => {
        expect(mockSource.getUnreadCount).toHaveBeenCalledWith('di-user');
        expect(result.current.badgeCount).toBe(7);
      });

      // Opening center should call listNotifications on mock source
      act(() => {
        result.current.openCenter();
      });

      await waitFor(() => {
        expect(mockSource.listNotifications).toHaveBeenCalledWith(
          'di-user',
          undefined,
          20
        );
      });

      // Mark single read should call mock source
      act(() => {
        result.current.markRead('n1');
      });

      await waitFor(() => {
        expect(mockSource.markOneRead).toHaveBeenCalledWith('di-user', 'n1');
      });

      // Mark all read should call mock source
      act(() => {
        result.current.markAllRead();
      });

      await waitFor(() => {
        expect(mockSource.markAllRead).toHaveBeenCalledWith('di-user');
      });
    });

    it('should dynamically update to use the latest notificationSource reference when prop updates on rerender', async () => {
      const mockSource1 = {
        getUnreadCount: vi.fn().mockResolvedValue({ unread_count: 5 }),
        listNotifications: vi
          .fn()
          .mockResolvedValue({ notifications: [], next_cursor: null }),
        markOneRead: vi.fn().mockResolvedValue(undefined),
        markAllRead: vi.fn().mockResolvedValue(undefined),
      };

      const mockSource2 = {
        getUnreadCount: vi.fn().mockResolvedValue({ unread_count: 10 }),
        listNotifications: vi.fn().mockResolvedValue({
          notifications: mockNotifications,
          next_cursor: null,
        }),
        markOneRead: vi.fn().mockResolvedValue(undefined),
        markAllRead: vi.fn().mockResolvedValue(undefined),
      };

      const { result, rerender } = renderHook(
        ({ source }) =>
          useNotificationCenter({
            userId: 'di-dynamic-user',
            notificationSource: source,
          }),
        { initialProps: { source: mockSource1 } }
      );

      // Initially should use source1
      await waitFor(() => {
        expect(mockSource1.getUnreadCount).toHaveBeenCalledWith(
          'di-dynamic-user'
        );
        expect(result.current.badgeCount).toBe(5);
      });

      // Rerender with source2
      rerender({ source: mockSource2 });

      // Now open the center, which should trigger listNotifications on source2
      act(() => {
        result.current.openCenter();
      });

      await waitFor(() => {
        expect(mockSource2.listNotifications).toHaveBeenCalledWith(
          'di-dynamic-user',
          undefined,
          20
        );
        expect(mockSource1.listNotifications).not.toHaveBeenCalled();
      });

      // Mark single read should trigger on source2
      act(() => {
        result.current.markRead('n1');
      });

      await waitFor(() => {
        expect(mockSource2.markOneRead).toHaveBeenCalledWith(
          'di-dynamic-user',
          'n1'
        );
        expect(mockSource1.markOneRead).not.toHaveBeenCalled();
      });
    });

    it('should correctly propagate errors and trigger rollback when a custom notificationSource operation fails', async () => {
      const mockSource = {
        getUnreadCount: vi.fn().mockResolvedValue({ unread_count: 5 }),
        listNotifications: vi.fn().mockResolvedValue({
          notifications: mockNotifications,
          next_cursor: null,
        }),
        markOneRead: vi
          .fn()
          .mockRejectedValue(new Error('Mock DI API Failure')),
        markAllRead: vi.fn().mockResolvedValue(undefined),
      };

      const { result } = renderHook(() =>
        useNotificationCenter({
          userId: 'di-error-user',
          notificationSource: mockSource,
        })
      );

      // 1. Initial Load
      await waitFor(() => {
        expect(result.current.badgeCount).toBe(5);
      });

      // 2. Open center to load items into store
      act(() => {
        result.current.openCenter();
      });

      await waitFor(() => {
        expect(result.current.items).toEqual(mockNotifications);
      });

      // Confirm item is unread initially
      expect(result.current.items[0].unread).toBe(true);

      // 3. Mark single read -> should call custom source and roll back on error
      await act(async () => {
        await result.current.markRead('n1');
      });

      expect(result.current.items[0].unread).toBe(true); // Rolled back to unread: true
      // Regression: the optimistic decrement must be restored on rollback,
      // not just the item's unread flag.
      expect(result.current.badgeCount).toBe(5);
      expect(mockSource.markOneRead).toHaveBeenCalledWith(
        'di-error-user',
        'n1'
      );
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          description: '無法將通知標示為已讀，請稍後再試',
        })
      );
    });

    it('should correctly propagate errors and trigger rollback when a custom notificationSource markAllRead operation fails', async () => {
      const mockSource = {
        getUnreadCount: vi.fn().mockResolvedValue({ unread_count: 5 }),
        listNotifications: vi.fn().mockResolvedValue({
          notifications: mockNotifications,
          next_cursor: null,
        }),
        markOneRead: vi.fn().mockResolvedValue(undefined),
        markAllRead: vi
          .fn()
          .mockRejectedValue(new Error('Mock DI markAllRead Failure')),
      };

      const { result } = renderHook(() =>
        useNotificationCenter({
          userId: 'di-all-error-user',
          notificationSource: mockSource,
        })
      );

      await waitFor(() => {
        expect(result.current.badgeCount).toBe(5);
      });

      act(() => {
        result.current.openCenter();
      });

      await waitFor(() => {
        expect(result.current.items).toEqual(mockNotifications);
      });

      // Mark all read -> should fail and roll back to unread: true and restore badge count to 5
      await act(async () => {
        await result.current.markAllRead();
      });

      expect(result.current.badgeCount).toBe(5);
      expect(result.current.items[0].unread).toBe(true);
      expect(mockSource.markAllRead).toHaveBeenCalledWith('di-all-error-user');
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          description: '無法將全部通知標示為已讀，請稍後再試',
        })
      );
    });
  });

  describe('anonymous / unauthenticated mode (missing userId)', () => {
    it('should not call HTTP source operations and return early if userId is missing', async () => {
      const { result } = renderHook(() =>
        useNotificationCenter({
          userId: undefined,
        })
      );

      // On mount, should not trigger any fetches because userId is missing and source is httpNotificationSource
      expect(fetchUnreadCount).not.toHaveBeenCalled();
      expect(result.current.badgeCount).toBe(0);

      // Opening center should also not trigger listNotifications
      act(() => {
        result.current.openCenter();
      });
      expect(listNotifications).not.toHaveBeenCalled();
    });

    it('should work correctly with initialNotifications even when userId is missing', async () => {
      const { result } = renderHook(() =>
        useNotificationCenter({
          userId: undefined,
          initialNotifications: mockNotifications,
        })
      );

      expect(result.current.badgeCount).toBe(2);
      expect(result.current.items).toEqual(mockNotifications);

      // Opening center should work
      act(() => {
        result.current.openCenter();
      });
      expect(result.current.open).toBe(true);

      // markRead should work fine
      await act(async () => {
        await result.current.markRead('n1');
      });
      expect(result.current.badgeCount).toBe(1);
    });
  });

  describe('lazy list loading (real fetch path, no initialNotifications)', () => {
    beforeEach(() => {
      vi.mocked(fetchUnreadCount).mockReset();
      vi.mocked(listNotifications).mockReset();
    });

    it('on mount, fetches only the unread badge count - not the notification list', async () => {
      vi.mocked(fetchUnreadCount).mockResolvedValue({ unread_count: 3 });
      vi.mocked(listNotifications).mockResolvedValue({
        notifications: mockNotifications,
        next_cursor: null,
      });

      const { result } = renderHook(() =>
        useNotificationCenter({ userId: 'user-lazy' })
      );

      await waitFor(() => {
        expect(result.current.badgeCount).toBe(3);
      });

      expect(fetchUnreadCount).toHaveBeenCalledWith('user-lazy');
      expect(listNotifications).not.toHaveBeenCalled();
      // The list itself hasn't loaded yet - only the count has.
      expect(result.current.items).toEqual([]);
    });

    it('fetches the full notification list only once the dropdown is actually opened', async () => {
      vi.mocked(fetchUnreadCount).mockResolvedValue({ unread_count: 2 });
      vi.mocked(listNotifications).mockResolvedValue({
        notifications: mockNotifications,
        next_cursor: null,
      });

      const { result } = renderHook(() =>
        useNotificationCenter({ userId: 'user-lazy-open' })
      );

      await waitFor(() => {
        expect(result.current.badgeCount).toBe(2);
      });
      expect(listNotifications).not.toHaveBeenCalled();

      act(() => {
        result.current.openCenter();
      });

      await waitFor(() => {
        expect(result.current.items).toEqual(mockNotifications);
      });
      expect(listNotifications).toHaveBeenCalledWith(
        'user-lazy-open',
        undefined,
        20
      );
    });

    it('dedupes concurrent loadUnreadCount calls across sibling hook instances mounting for the same user', async () => {
      vi.mocked(fetchUnreadCount).mockResolvedValue({ unread_count: 5 });

      const { result: result1 } = renderHook(() =>
        useNotificationCenter({ userId: 'user-lazy-dedup' })
      );
      const { result: result2 } = renderHook(() =>
        useNotificationCenter({ userId: 'user-lazy-dedup' })
      );

      await waitFor(() => {
        expect(result1.current.badgeCount).toBe(5);
        expect(result2.current.badgeCount).toBe(5);
      });

      expect(fetchUnreadCount).toHaveBeenCalledTimes(1);
    });

    it('discards a stale mount-time unread count that resolves after a fresher openCenter load', async () => {
      const deferredMountFetch = createDeferred<{ unread_count: number }>();

      vi.mocked(fetchUnreadCount)
        .mockReturnValueOnce(deferredMountFetch.promise) // mount-time loadUnreadCount
        .mockResolvedValue({ unread_count: 9 }); // loadInitialData's own fetchUnreadCount call, once opened
      vi.mocked(listNotifications).mockResolvedValue({
        notifications: mockNotifications,
        next_cursor: null,
      });

      const { result } = renderHook(() =>
        useNotificationCenter({ userId: 'user-lazy-race' })
      );

      await waitFor(() => {
        expect(fetchUnreadCount).toHaveBeenCalledTimes(1);
      });

      // User opens the dropdown before the mount-time fetch resolves;
      // loadInitialData's own fetch/list calls resolve first with fresher data.
      act(() => {
        result.current.openCenter();
      });
      await waitFor(() => {
        expect(result.current.items).toEqual(mockNotifications);
      });
      expect(result.current.badgeCount).toBe(9);

      // Now the slow mount-time fetch resolves with stale data - it must be
      // discarded rather than clobbering the fresher count above.
      await act(async () => {
        deferredMountFetch.resolve({ unread_count: 2 });
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.badgeCount).toBe(9);
    });

    it('reports and gracefully degrades when loadUnreadCount fails', async () => {
      vi.mocked(fetchUnreadCount).mockRejectedValue(new Error('network down'));

      const { result } = renderHook(() =>
        useNotificationCenter({ userId: 'user-lazy-fail' })
      );

      await waitFor(() => {
        expect(captureFlowFailure).toHaveBeenCalledWith(
          expect.objectContaining({
            flow: 'notification_load_unread_count',
            step: 'fetch_unread_count',
            message: 'network down',
          })
        );
      });

      expect(result.current.badgeCount).toBe(0);
    });
  });
  describe('retry (delegated to the installed notification source)', () => {
    it('restores the list from a preloaded source after its simulated delay', async () => {
      vi.useFakeTimers();
      try {
        const { result } = renderHook(() =>
          useNotificationCenter({
            userId: 'retry-fixture-user',
            initialNotifications: mockNotifications,
            initialStatus: 'error',
          })
        );

        expect(result.current.status).toBe('error');

        act(() => {
          result.current.handleRetry();
        });
        expect(result.current.status).toBe('loading');

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });

        expect(result.current.status).toBe('success');
        expect(result.current.items).toEqual(mockNotifications);
      } finally {
        vi.useRealTimers();
      }
    });

    it('recomputes the badge count from the fixture source after a retry', async () => {
      vi.useFakeTimers();
      try {
        const { result } = renderHook(() =>
          useNotificationCenter({
            userId: 'retry-badge-user',
            initialNotifications: mockNotifications,
            initialStatus: 'error',
          })
        );

        act(() => {
          result.current.handleRetry();
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });

        const expectedUnread = mockNotifications.filter((n) => n.unread).length;
        expect(result.current.badgeCount).toBe(expectedUnread);
      } finally {
        vi.useRealTimers();
      }
    });

    it('falls back to a normal reload for a source with no retry handling', async () => {
      vi.mocked(fetchUnreadCount).mockResolvedValue({ unread_count: 1 });
      vi.mocked(listNotifications).mockResolvedValue({
        notifications: mockNotifications,
        next_cursor: null,
      });

      const { result } = renderHook(() =>
        useNotificationCenter({ userId: 'retry-http-user' })
      );

      await waitFor(() => {
        expect(result.current.badgeCount).toBe(1);
      });
      vi.mocked(listNotifications).mockClear();

      act(() => {
        result.current.handleRetry();
      });

      await waitFor(() => {
        expect(listNotifications).toHaveBeenCalledWith(
          'retry-http-user',
          undefined,
          20
        );
        expect(result.current.status).toBe('success');
      });
    });

    it('routes retry through a custom source that provides one', async () => {
      const mockSource = {
        getUnreadCount: vi.fn().mockResolvedValue({ unread_count: 0 }),
        listNotifications: vi
          .fn()
          .mockResolvedValue({ notifications: [], next_cursor: null }),
        markOneRead: vi.fn().mockResolvedValue(undefined),
        markAllRead: vi.fn().mockResolvedValue(undefined),
        retry: vi.fn().mockResolvedValue(mockNotifications),
      };

      const { result } = renderHook(() =>
        useNotificationCenter({
          userId: 'retry-di-user',
          notificationSource: mockSource,
        })
      );

      act(() => {
        result.current.handleRetry();
      });

      await waitFor(() => {
        expect(mockSource.retry).toHaveBeenCalledWith('retry-di-user');
        expect(result.current.status).toBe('success');
        expect(result.current.items).toEqual(mockNotifications);
      });
      expect(mockSource.listNotifications).not.toHaveBeenCalled();

      // Regression: the badge count must be recomputed from what retry
      // resolved with, not left stale at its pre-retry value.
      const expectedUnread = mockNotifications.filter((n) => n.unread).length;
      expect(result.current.badgeCount).toBe(expectedUnread);
    });

    it('surfaces the error state when a source retry rejects', async () => {
      const mockSource = {
        getUnreadCount: vi.fn().mockResolvedValue({ unread_count: 0 }),
        listNotifications: vi
          .fn()
          .mockResolvedValue({ notifications: [], next_cursor: null }),
        markOneRead: vi.fn().mockResolvedValue(undefined),
        markAllRead: vi.fn().mockResolvedValue(undefined),
        retry: vi.fn().mockRejectedValue(new Error('Mock retry failure')),
      };

      const { result } = renderHook(() =>
        useNotificationCenter({
          userId: 'retry-di-error-user',
          notificationSource: mockSource,
        })
      );

      act(() => {
        result.current.handleRetry();
      });

      await waitFor(() => {
        expect(result.current.status).toBe('error');
      });
      expect(captureFlowFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          flow: 'notification_retry',
          step: 'source_retry',
        })
      );
    });

    it('ignores a retry that resolves after the hook unmounted', async () => {
      const deferredRetry = createDeferred<NotificationItem[]>();
      const mockSource = {
        getUnreadCount: vi.fn().mockResolvedValue({ unread_count: 0 }),
        listNotifications: vi
          .fn()
          .mockResolvedValue({ notifications: [], next_cursor: null }),
        markOneRead: vi.fn().mockResolvedValue(undefined),
        markAllRead: vi.fn().mockResolvedValue(undefined),
        retry: vi.fn(() => deferredRetry.promise),
      };

      const { result, unmount } = renderHook(() =>
        useNotificationCenter({
          userId: 'retry-unmount-user',
          notificationSource: mockSource,
        })
      );

      act(() => {
        result.current.handleRetry();
      });
      await waitFor(() => {
        expect(mockSource.retry).toHaveBeenCalled();
      });

      unmount();

      await act(async () => {
        deferredRetry.resolve(mockNotifications);
      });

      // The late resolution must not write into the shared store
      const state =
        notificationStoreManager.getOrCreateState('retry-unmount-user');
      expect(state.status).toBe('loading');
      expect(state.notifications).toEqual([]);
    });
  });

  describe('preloaded sources (fixture data injected via a custom source)', () => {
    it('never drives fetches into a source that declares itself preloaded', async () => {
      const preloadedSource = {
        isPreloaded: true,
        requiresAuth: false,
        getUnreadCount: vi.fn().mockResolvedValue({ unread_count: 3 }),
        listNotifications: vi.fn().mockResolvedValue({
          notifications: mockNotifications,
          next_cursor: '20',
        }),
        markOneRead: vi.fn().mockResolvedValue(undefined),
        markAllRead: vi.fn().mockResolvedValue(undefined),
      };

      const { result } = renderHook(() =>
        useNotificationCenter({
          userId: 'preloaded-user',
          notificationSource: preloadedSource,
        })
      );

      act(() => {
        result.current.openCenter();
      });
      await act(async () => {
        await result.current.loadMore();
      });

      expect(preloadedSource.getUnreadCount).not.toHaveBeenCalled();
      expect(preloadedSource.listNotifications).not.toHaveBeenCalled();
      expect(result.current.items).toEqual([]);
      expect(result.current.hasMore).toBe(false);
    });
  });

  describe('NotificationStoreManager Refactoring Specific Tests', () => {
    beforeEach(() => {
      resetNotificationStore();
    });

    it('should deduplicate concurrent fetchInitialDataWithDeduplication calls and clean up promise on completion', async () => {
      const userId = 'dedup-test-user';
      const deferred = createDeferred<{
        unreadCount: number;
        notifications: NotificationItem[];
        nextCursor: string | null;
      }>();

      const mockFetcher = vi.fn().mockImplementation(() => {
        return deferred.promise;
      });

      // Issue concurrent calls
      const p1 = notificationStoreManager.fetchInitialDataWithDeduplication(
        userId,
        true,
        mockFetcher
      );
      const p2 = notificationStoreManager.fetchInitialDataWithDeduplication(
        userId,
        true,
        mockFetcher
      );

      // Verify that fetcher was called only once
      expect(mockFetcher).toHaveBeenCalledTimes(1);

      // Resolve the fetcher
      deferred.resolve({
        unreadCount: 5,
        notifications: [],
        nextCursor: null,
      });

      await Promise.all([p1, p2]);

      // Call it again after completion
      const p3 = notificationStoreManager.fetchInitialDataWithDeduplication(
        userId,
        true,
        mockFetcher
      );
      expect(mockFetcher).toHaveBeenCalledTimes(2);
      await p3;
    });

    it('should clean up promise on fetchInitialDataWithDeduplication failure', async () => {
      const userId = 'fail-cleanup-user';
      const deferred = createDeferred<{
        unreadCount: number;
        notifications: NotificationItem[];
        nextCursor: string | null;
      }>();

      const mockFetcher = vi.fn().mockImplementation(() => {
        return deferred.promise;
      });

      const p1 = notificationStoreManager.fetchInitialDataWithDeduplication(
        userId,
        true,
        mockFetcher
      );

      deferred.reject(new Error('Fetch failed'));

      await expect(p1).resolves.toBeUndefined(); // Errors are handled/caught internally, resolving the promise cleanly

      // Call it again - since the previous one failed and was cleaned up, this should trigger a new fetch
      const p2 = notificationStoreManager.fetchInitialDataWithDeduplication(
        userId,
        true,
        mockFetcher
      );
      expect(mockFetcher).toHaveBeenCalledTimes(2);
      await p2;
    });

    it('should restore previous state upon calling rollback closure from startMarkAllRead', () => {
      const userId = 'rollback-user';
      const initialNotifications: NotificationItem[] = [
        {
          id: '1',
          type: 'reservation_requested',
          createdAt: 'date',
          unread: true,
        },
      ];

      // Initialize store
      notificationStoreManager.syncInitialNotifications(
        userId,
        initialNotifications,
        'success'
      );

      // Start mark all read
      const { rollback } = notificationStoreManager.startMarkAllRead(userId);

      const stateAfterStart = notificationStoreManager.getOrCreateState(userId);
      expect(stateAfterStart.unreadCountState).toBe(0);
      expect(stateAfterStart.notifications[0].unread).toBe(false);
      expect(stateAfterStart.isMarkingAll).toBe(true);

      // Perform rollback
      rollback();

      const stateAfterRollback =
        notificationStoreManager.getOrCreateState(userId);
      expect(stateAfterRollback.unreadCountState).toBe(1);
      expect(stateAfterRollback.notifications[0].unread).toBe(true);
      expect(stateAfterRollback.isMarkingAll).toBe(false);
    });

    it('should deduplicate concurrent fetchUnreadCountWithDeduplication calls and clean up promise on completion/failure', async () => {
      const userId = 'unread-dedup-user';
      const deferred = createDeferred<number>();

      const mockFetcher = vi.fn().mockImplementation(() => {
        return deferred.promise;
      });

      // Issue concurrent calls
      const p1 = notificationStoreManager.fetchUnreadCountWithDeduplication(
        userId,
        mockFetcher
      );
      const p2 = notificationStoreManager.fetchUnreadCountWithDeduplication(
        userId,
        mockFetcher
      );

      // Verify that fetcher was called only once
      expect(mockFetcher).toHaveBeenCalledTimes(1);

      // Resolve the fetcher
      deferred.resolve(8);

      await Promise.all([p1, p2]);

      // Call it again after completion
      const p3 = notificationStoreManager.fetchUnreadCountWithDeduplication(
        userId,
        mockFetcher
      );
      expect(mockFetcher).toHaveBeenCalledTimes(2);
      await p3;
    });

    it('should clean up promise on fetchUnreadCountWithDeduplication failure', async () => {
      const userId = 'unread-fail-user';
      const mockFetcher = vi.fn().mockRejectedValue(new Error('Fetch failed'));

      const p1 = notificationStoreManager.fetchUnreadCountWithDeduplication(
        userId,
        mockFetcher
      );

      // Catch the rejection on p1 to prevent it from leaking to Vitest
      await p1.catch(() => {});

      // Call it again - since the previous one failed and was cleaned up, this should trigger a new fetch
      const p2 = notificationStoreManager.fetchUnreadCountWithDeduplication(
        userId,
        mockFetcher
      );
      expect(mockFetcher).toHaveBeenCalledTimes(2);
      await p2.catch(() => {});
    });

    it('should ignore stale fetch results when unreadCountVersion has advanced (stale count protection)', async () => {
      const userId = 'stale-count-user';
      const deferred = createDeferred<number>();

      const mockFetcher = vi.fn().mockImplementation(() => {
        return deferred.promise;
      });

      // 1. Start fetching unread count
      const p1 = notificationStoreManager.fetchUnreadCountWithDeduplication(
        userId,
        mockFetcher
      );

      // 2. Before fetcher resolves, update state with newer initial data (which advances the version)
      notificationStoreManager.setInitialData(userId, 10, [], null);

      const stateAfterInitial =
        notificationStoreManager.getOrCreateState(userId);
      expect(stateAfterInitial.unreadCountState).toBe(10);

      // 3. Resolve the slow fetch with a stale unread count (e.g., 3)
      deferred.resolve(3);
      await p1;

      // 4. Verify that the stale unread count was discarded and did not overwrite the newer count of 10
      const stateAfterResolve =
        notificationStoreManager.getOrCreateState(userId);
      expect(stateAfterResolve.unreadCountState).toBe(10);
    });

    it('should restore previous state and clamp count upon failMarkRead', () => {
      const userId = 'fail-mark-user';
      const initialNotifications: NotificationItem[] = [
        {
          id: 'n1',
          type: 'reservation_requested',
          createdAt: 'date',
          unread: true,
        },
      ];

      // Initialize store
      notificationStoreManager.syncInitialNotifications(
        userId,
        initialNotifications,
        'success'
      );

      // Start mark read
      notificationStoreManager.startMarkRead(userId, 'n1');

      const stateAfterStart = notificationStoreManager.getOrCreateState(userId);
      expect(stateAfterStart.unreadCountState).toBe(0);
      expect(stateAfterStart.notifications[0].unread).toBe(false);

      // Perform failure rollback
      notificationStoreManager.failMarkRead(userId, 'n1');

      const stateAfterRollback =
        notificationStoreManager.getOrCreateState(userId);
      expect(stateAfterRollback.unreadCountState).toBe(1);
      expect(stateAfterRollback.notifications[0].unread).toBe(true);

      // Run failMarkRead again - since unread is already true, countDiff should be 0 and badge count shouldn't increase
      notificationStoreManager.failMarkRead(userId, 'n1');
      expect(stateAfterRollback.unreadCountState).toBe(1);
    });

    it('should correctly restore state and count upon startMarkAllRead rollback even when concurrent polling/sync updates the version', () => {
      const userId = 'concurrent-rollback-user';
      const initialNotifications: NotificationItem[] = [
        {
          id: 'n1',
          type: 'reservation_requested',
          createdAt: 'date',
          unread: true,
        },
      ];

      // Initialize store
      notificationStoreManager.syncInitialNotifications(
        userId,
        initialNotifications,
        'success'
      );

      // Start mark all read
      const { rollback } = notificationStoreManager.startMarkAllRead(userId);

      const stateAfterStart = notificationStoreManager.getOrCreateState(userId);
      expect(stateAfterStart.unreadCountState).toBe(0);
      expect(stateAfterStart.notifications[0].unread).toBe(false);

      // Simulate concurrent polling/sync updating unreadCountState and version
      notificationStoreManager.setInitialData(
        userId,
        8,
        initialNotifications,
        null
      );

      const stateAfterConcurrent =
        notificationStoreManager.getOrCreateState(userId);
      expect(stateAfterConcurrent.unreadCountState).toBe(8);

      // Perform rollback -> Since version has advanced, it must retain the concurrent unread count of 8 rather than overwriting with 1!
      rollback();

      const stateAfterRollback =
        notificationStoreManager.getOrCreateState(userId);
      expect(stateAfterRollback.unreadCountState).toBe(8);
      // But the notifications in the original list should still be rolled back to unread: true
      expect(stateAfterRollback.notifications[0].unread).toBe(true);
    });
  });
});
