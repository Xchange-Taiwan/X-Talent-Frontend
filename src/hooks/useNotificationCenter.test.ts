import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type NotificationItem,
  useNotificationCenter,
} from '@/hooks/useNotificationCenter';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  createInMemoryNotificationSource,
  type NotificationSource,
} from '@/services/notifications/notificationSource';
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
    expect(result.current.badgeCount).toBe(2);
    expect(result.current.showBadge).toBe(true);
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

    act(() => {
      result.current.openCenter();
    });

    expect(result.current.open).toBe(true);
    expect(result.current.showBadge).toBe(false);
    expect(localStorage.getItem('notif_seen_unread_count_user-123')).toBe('2');

    act(() => {
      result.current.closeCenter();
    });

    expect(result.current.open).toBe(false);
    expect(result.current.showBadge).toBe(false);

    act(() => {
      result.current.onOpenChange(true);
    });
    expect(result.current.open).toBe(true);
  });

  it('marks single notification read via NotificationSource and rolls back on failure', async () => {
    const source = createInMemoryNotificationSource([mockNotifications[0]], {
      requiresAuth: false,
    });
    const markOneReadSpy = vi
      .spyOn(source, 'markOneRead')
      .mockRejectedValue(new Error('API failure'));

    const { result } = renderHook(() =>
      useNotificationCenter({
        userId: 'mark-one-fail-user',
        notificationSource: source,
      })
    );

    act(() => {
      result.current.openCenter();
    });

    await waitFor(() => {
      expect(result.current.items[0]?.unread).toBe(true);
    });

    await act(async () => {
      await result.current.markRead('n1');
    });

    expect(markOneReadSpy).toHaveBeenCalledWith('mark-one-fail-user', 'n1');
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

  it('marks all notifications read successfully via NotificationSource', async () => {
    const source = createInMemoryNotificationSource(mockNotifications);
    const markAllSpy = vi.spyOn(source, 'markAllRead');

    const { result } = renderHook(() =>
      useNotificationCenter({
        userId: 'mark-all-ok-user',
        notificationSource: source,
      })
    );

    act(() => {
      result.current.openCenter();
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(3);
      expect(result.current.badgeCount).toBe(2);
    });

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(result.current.badgeCount).toBe(0);
    expect(result.current.items.every((n) => !n.unread)).toBe(true);
    expect(markAllSpy).toHaveBeenCalledWith('mark-all-ok-user');
  });

  it('rolls back all read optimistic updates on markAllRead failure', async () => {
    const source = createInMemoryNotificationSource(mockNotifications);
    vi.spyOn(source, 'markAllRead').mockRejectedValue(
      new Error('Network error')
    );

    const { result } = renderHook(() =>
      useNotificationCenter({
        userId: 'mark-all-fail-user',
        notificationSource: source,
      })
    );

    act(() => {
      result.current.openCenter();
    });

    await waitFor(() => {
      expect(result.current.badgeCount).toBe(2);
    });

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

    await act(async () => {
      await hook1.current.markAllRead();
    });

    expect(hook1.current.badgeCount).toBe(0);
    expect(hook2.current.badgeCount).toBe(0);

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

  it('clamps seenUnreadCount to current unreadCount once in the store without duplicate passive effects across desktop and mobile instances', () => {
    localStorage.setItem('notif_seen_unread_count_user-123', '5');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    try {
      renderHook(() =>
        useNotificationCenter({
          userId: 'user-123',
          initialNotifications: mockNotifications, // 2 unread
        })
      );
      renderHook(() =>
        useNotificationCenter({
          userId: 'user-123',
          initialNotifications: mockNotifications, // 2 unread
        })
      );

      expect(localStorage.getItem('notif_seen_unread_count_user-123')).toBe(
        '2'
      );
      expect(
        setItemSpy.mock.calls.filter(
          ([key]) => key === 'notif_seen_unread_count_user-123'
        )
      ).toHaveLength(1);
    } finally {
      setItemSpy.mockRestore();
    }
  });

  it('unsubscribes from the store manager on unmount to prevent memory leaks', () => {
    const unsubscribeSpy = vi.fn();
    const originalSubscribe = notificationStoreManager.subscribe.bind(
      notificationStoreManager
    );
    const subSpy = vi
      .spyOn(notificationStoreManager, 'subscribe')
      .mockImplementation((key, listener) => {
        const unsub = originalSubscribe(key, listener);
        return () => {
          unsubscribeSpy();
          unsub();
        };
      });

    try {
      const { unmount } = renderHook(() =>
        useNotificationCenter({
          userId: 'user-cleanup-test',
          initialNotifications: mockNotifications,
        })
      );

      unmount();
      expect(unsubscribeSpy).toHaveBeenCalled();
    } finally {
      subSpy.mockRestore();
    }
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

    act(() => {
      userAHook.current.openCenter();
    });

    expect(userAHook.current.showBadge).toBe(false);
    expect(userBHook.current.showBadge).toBe(true);
  });

  it('synchronizes single markRead optimistic update failures and rollbacks across both instances on the same page', async () => {
    const sharedSource = createInMemoryNotificationSource(mockNotifications);
    vi.spyOn(sharedSource, 'markOneRead').mockRejectedValue(
      new Error('API failure')
    );

    const { result: hook1 } = renderHook(() =>
      useNotificationCenter({
        userId: 'user-rollback-single-test',
        notificationSource: sharedSource,
      })
    );

    const { result: hook2 } = renderHook(() =>
      useNotificationCenter({
        userId: 'user-rollback-single-test',
        notificationSource: sharedSource,
      })
    );

    act(() => {
      hook1.current.openCenter();
    });

    await waitFor(() => {
      expect(hook1.current.items).toHaveLength(3);
      expect(hook1.current.badgeCount).toBe(2);
      expect(hook2.current.badgeCount).toBe(2);
    });

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
    const sharedSource = createInMemoryNotificationSource(mockNotifications);
    vi.spyOn(sharedSource, 'markAllRead').mockRejectedValue(
      new Error('API failure')
    );

    const { result: hook1 } = renderHook(() =>
      useNotificationCenter({
        userId: 'user-rollback-all-test',
        notificationSource: sharedSource,
      })
    );

    const { result: hook2 } = renderHook(() =>
      useNotificationCenter({
        userId: 'user-rollback-all-test',
        notificationSource: sharedSource,
      })
    );

    act(() => {
      hook1.current.openCenter();
    });

    await waitFor(() => {
      expect(hook1.current.items).toHaveLength(3);
      expect(hook1.current.badgeCount).toBe(2);
      expect(hook2.current.badgeCount).toBe(2);
    });

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
      const mockSource: NotificationSource = {
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

      await waitFor(() => {
        expect(mockSource.getUnreadCount).toHaveBeenCalledWith('di-user');
        expect(result.current.badgeCount).toBe(7);
      });

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

      await act(async () => {
        await result.current.markRead('n1');
      });

      expect(mockSource.markOneRead).toHaveBeenCalledWith('di-user', 'n1');

      await act(async () => {
        await result.current.markAllRead();
      });

      expect(mockSource.markAllRead).toHaveBeenCalledWith('di-user');
    });

    it('should dynamically update to use the latest notificationSource reference when prop updates on rerender', async () => {
      const mockSource1: NotificationSource = {
        getUnreadCount: vi.fn().mockResolvedValue({ unread_count: 5 }),
        listNotifications: vi
          .fn()
          .mockResolvedValue({ notifications: [], next_cursor: null }),
        markOneRead: vi.fn().mockResolvedValue(undefined),
        markAllRead: vi.fn().mockResolvedValue(undefined),
      };

      const mockSource2: NotificationSource = {
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

      await waitFor(() => {
        expect(mockSource1.getUnreadCount).toHaveBeenCalledWith(
          'di-dynamic-user'
        );
        expect(result.current.badgeCount).toBe(5);
      });

      rerender({ source: mockSource2 });

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

      await act(async () => {
        await result.current.markRead('n1');
      });

      expect(mockSource2.markOneRead).toHaveBeenCalledWith(
        'di-dynamic-user',
        'n1'
      );
      expect(mockSource1.markOneRead).not.toHaveBeenCalled();
    });

    it('should correctly propagate errors and trigger rollback when a custom notificationSource operation fails', async () => {
      const mockSource: NotificationSource = {
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

      await waitFor(() => {
        expect(result.current.badgeCount).toBe(5);
      });

      act(() => {
        result.current.openCenter();
      });

      await waitFor(() => {
        expect(result.current.items).toEqual(mockNotifications);
      });

      expect(result.current.items[0].unread).toBe(true);

      await act(async () => {
        await result.current.markRead('n1');
      });

      expect(result.current.items[0].unread).toBe(true);
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
      const mockSource: NotificationSource = {
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
    it('should not call auth-requiring source operations and return early if userId is missing', () => {
      const authSource = createInMemoryNotificationSource(mockNotifications, {
        requiresAuth: true,
      });
      const countSpy = vi.spyOn(authSource, 'getUnreadCount');
      const listSpy = vi.spyOn(authSource, 'listNotifications');

      const { result } = renderHook(() =>
        useNotificationCenter({
          userId: undefined,
          notificationSource: authSource,
        })
      );

      expect(countSpy).not.toHaveBeenCalled();
      expect(result.current.badgeCount).toBe(0);

      act(() => {
        result.current.openCenter();
      });
      expect(listSpy).not.toHaveBeenCalled();
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

      act(() => {
        result.current.openCenter();
      });
      expect(result.current.open).toBe(true);

      await act(async () => {
        await result.current.markRead('n1');
      });
      expect(result.current.badgeCount).toBe(1);
    });
  });

  describe('lazy list loading (fetched NotificationSource path)', () => {
    it('on mount, fetches only the unread badge count - not the notification list', async () => {
      const source = createInMemoryNotificationSource(mockNotifications, {
        unreadCountOverride: 3,
      });
      const countSpy = vi.spyOn(source, 'getUnreadCount');
      const listSpy = vi.spyOn(source, 'listNotifications');

      const { result } = renderHook(() =>
        useNotificationCenter({
          userId: 'user-lazy',
          notificationSource: source,
        })
      );

      await waitFor(() => {
        expect(result.current.badgeCount).toBe(3);
      });

      expect(countSpy).toHaveBeenCalledWith('user-lazy');
      expect(listSpy).not.toHaveBeenCalled();
      expect(result.current.items).toEqual([]);
    });

    it('fetches the full notification list only once the dropdown is actually opened', async () => {
      const source = createInMemoryNotificationSource(mockNotifications);
      const listSpy = vi.spyOn(source, 'listNotifications');

      const { result } = renderHook(() =>
        useNotificationCenter({
          userId: 'user-lazy-open',
          notificationSource: source,
        })
      );

      await waitFor(() => {
        expect(result.current.badgeCount).toBe(2);
      });
      expect(listSpy).not.toHaveBeenCalled();

      act(() => {
        result.current.openCenter();
      });

      await waitFor(() => {
        expect(result.current.items).toEqual(mockNotifications);
      });
      expect(listSpy).toHaveBeenCalledWith('user-lazy-open', undefined, 20);
    });

    it('dedupes concurrent bootstrap calls across sibling hook instances mounting for the same user', async () => {
      const source = createInMemoryNotificationSource(mockNotifications, {
        unreadCountOverride: 5,
      });
      const countSpy = vi.spyOn(source, 'getUnreadCount');

      const { result: result1 } = renderHook(() =>
        useNotificationCenter({
          userId: 'user-lazy-dedup',
          notificationSource: source,
        })
      );
      const { result: result2 } = renderHook(() =>
        useNotificationCenter({
          userId: 'user-lazy-dedup',
          notificationSource: source,
        })
      );

      await waitFor(() => {
        expect(result1.current.badgeCount).toBe(5);
        expect(result2.current.badgeCount).toBe(5);
      });

      expect(countSpy).toHaveBeenCalledTimes(1);
    });

    it('discards a stale mount-time unread count that resolves after a fresher openCenter load', async () => {
      const deferredMountFetch = createDeferred<{ unread_count: number }>();
      let unreadCallCount = 0;

      const source: NotificationSource = {
        requiresAuth: true,
        isPreloaded: false,
        getUnreadCount: vi.fn().mockImplementation(() => {
          unreadCallCount += 1;
          if (unreadCallCount === 1) {
            return deferredMountFetch.promise;
          }
          return Promise.resolve({ unread_count: 9 });
        }),
        listNotifications: vi.fn().mockResolvedValue({
          notifications: mockNotifications,
          next_cursor: null,
        }),
        markOneRead: vi.fn().mockResolvedValue(undefined),
        markAllRead: vi.fn().mockResolvedValue(undefined),
      };

      const { result } = renderHook(() =>
        useNotificationCenter({
          userId: 'user-lazy-race',
          notificationSource: source,
        })
      );

      await waitFor(() => {
        expect(source.getUnreadCount).toHaveBeenCalledTimes(1);
      });

      act(() => {
        result.current.openCenter();
      });
      await waitFor(() => {
        expect(result.current.items).toEqual(mockNotifications);
      });
      expect(result.current.badgeCount).toBe(9);

      await act(async () => {
        deferredMountFetch.resolve({ unread_count: 2 });
        await deferredMountFetch.promise;
      });

      expect(result.current.badgeCount).toBe(9);
    });

    it('reports and gracefully degrades when loadUnreadCount fails', async () => {
      const source = createInMemoryNotificationSource(mockNotifications);
      vi.spyOn(source, 'getUnreadCount').mockRejectedValue(
        new Error('network down')
      );

      const { result } = renderHook(() =>
        useNotificationCenter({
          userId: 'user-lazy-fail',
          notificationSource: source,
        })
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

  describe('unified retry (owned by NotificationStoreManager)', () => {
    it('recovers directly through getUnreadCount + listNotifications when source omits retry()', async () => {
      const source = createInMemoryNotificationSource(mockNotifications, {
        unreadCountOverride: 2,
      });
      const listSpy = vi.spyOn(source, 'listNotifications');

      const { result } = renderHook(() =>
        useNotificationCenter({
          userId: 'retry-standard-user',
          notificationSource: source,
        })
      );

      await waitFor(() => {
        expect(result.current.badgeCount).toBe(2);
      });
      listSpy.mockClear();

      act(() => {
        result.current.handleRetry();
      });

      await waitFor(() => {
        expect(listSpy).toHaveBeenCalledWith(
          'retry-standard-user',
          undefined,
          20
        );
        expect(result.current.status).toBe('success');
        expect(result.current.items).toEqual(mockNotifications);
      });
    });

    it('routes retry through a custom source that provides retry() and recomputes badge count', async () => {
      const deferredRetry = createDeferred<NotificationItem[]>();
      const mockSource: NotificationSource = {
        getUnreadCount: vi.fn().mockResolvedValue({ unread_count: 0 }),
        listNotifications: vi
          .fn()
          .mockResolvedValue({ notifications: [], next_cursor: null }),
        markOneRead: vi.fn().mockResolvedValue(undefined),
        markAllRead: vi.fn().mockResolvedValue(undefined),
        retry: vi.fn(() => deferredRetry.promise),
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
      expect(result.current.status).toBe('loading');
      expect(mockSource.retry).toHaveBeenCalledWith('retry-di-user');

      await act(async () => {
        deferredRetry.resolve(mockNotifications);
        await deferredRetry.promise;
      });

      expect(result.current.status).toBe('success');
      expect(result.current.items).toEqual(mockNotifications);
      expect(mockSource.listNotifications).not.toHaveBeenCalled();

      const expectedUnread = mockNotifications.filter((n) => n.unread).length;
      expect(result.current.badgeCount).toBe(expectedUnread);
    });

    it('surfaces the error state when a source retry rejects', async () => {
      const mockSource: NotificationSource = {
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
      const mockSource: NotificationSource = {
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
        await deferredRetry.promise;
      });

      const state =
        notificationStoreManager.getOrCreateState('retry-unmount-user');
      expect(state.status).toBe('loading');
      expect(state.notifications).toEqual([]);
    });
  });

  describe('preloaded sources (fixture data injected via a custom source)', () => {
    it('never drives fetches into a source that declares itself preloaded', async () => {
      const preloadedSource: NotificationSource = {
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

  describe('NotificationStoreManager direct model operations', () => {
    beforeEach(() => {
      resetNotificationStore();
    });

    function installSource(
      userId: string | undefined,
      overrides: Partial<NotificationSource> = {}
    ): NotificationSource {
      const source: NotificationSource = {
        requiresAuth: false,
        isPreloaded: false,
        getUnreadCount: vi.fn().mockResolvedValue({ unread_count: 0 }),
        listNotifications: vi
          .fn()
          .mockResolvedValue({ notifications: [], next_cursor: null }),
        markOneRead: vi.fn().mockResolvedValue(undefined),
        markAllRead: vi.fn().mockResolvedValue(undefined),
        ...overrides,
      };
      notificationStoreManager.setSource(userId, source);
      return source;
    }

    it('deduplicates concurrent loadInitialData calls and cleans up in-flight promise on completion or failure', async () => {
      const userId = 'dedup-initial-user';
      const deferred = createDeferred<{
        notifications: NotificationItem[];
        next_cursor: string | null;
      }>();

      const source = installSource(userId, {
        getUnreadCount: vi.fn().mockResolvedValue({ unread_count: 5 }),
        listNotifications: vi.fn().mockImplementation(() => deferred.promise),
      });

      const p1 = notificationStoreManager.loadInitialData(userId, true);
      const p2 = notificationStoreManager.loadInitialData(userId, true);

      expect(source.listNotifications).toHaveBeenCalledTimes(1);

      deferred.resolve({ notifications: [], next_cursor: null });
      await Promise.all([p1, p2]);

      const deferredFail = createDeferred<{
        notifications: NotificationItem[];
        next_cursor: string | null;
      }>();
      vi.mocked(source.listNotifications).mockImplementation(
        () => deferredFail.promise
      );

      const p3 = notificationStoreManager.loadInitialData(userId, true);
      expect(source.listNotifications).toHaveBeenCalledTimes(2);
      deferredFail.reject(new Error('Fetch failed'));
      const failOutcome = await p3;
      expect(failOutcome.status).toBe('failed');
    });

    it('deduplicates concurrent loadUnreadCount calls, cleans up on failure, and discards stale counts when version advances', async () => {
      const userId = 'unread-dedup-user';
      const deferred = createDeferred<{ unread_count: number }>();

      const source = installSource(userId, {
        getUnreadCount: vi.fn().mockImplementation(() => deferred.promise),
      });

      const p1 = notificationStoreManager.loadUnreadCount(userId);
      const p2 = notificationStoreManager.loadUnreadCount(userId);
      expect(source.getUnreadCount).toHaveBeenCalledTimes(1);

      // Advance version with fresher initial data before p1 settles
      notificationStoreManager.setInitialData(userId, 10, [], null);
      expect(
        notificationStoreManager.getOrCreateState(userId).unreadCountState
      ).toBe(10);

      deferred.resolve({ unread_count: 3 });
      await Promise.all([p1, p2]);

      // Stale count (3) must not overwrite fresher count (10)
      expect(
        notificationStoreManager.getOrCreateState(userId).unreadCountState
      ).toBe(10);
    });

    it('preserves a fresher concurrently-updated unread count when markAllRead rolls back', async () => {
      const userId = 'concurrent-rollback-user';
      const initialItems: NotificationItem[] = [
        {
          id: 'n1',
          type: 'reservation_requested',
          createdAt: 'date',
          unread: true,
        },
      ];

      notificationStoreManager.syncInitialNotifications(
        userId,
        initialItems,
        'success'
      );

      const deferred = createDeferred<void>();
      installSource(userId, {
        markAllRead: vi.fn().mockImplementation(() => deferred.promise),
      });

      const markAllReadPromise = notificationStoreManager.markAllRead(userId);

      const stateAfterStart = notificationStoreManager.getOrCreateState(userId);
      expect(stateAfterStart.unreadCountState).toBe(0);
      expect(stateAfterStart.notifications[0].unread).toBe(false);

      notificationStoreManager.setInitialData(userId, 8, initialItems, null);
      expect(
        notificationStoreManager.getOrCreateState(userId).unreadCountState
      ).toBe(8);

      deferred.reject(new Error('boom'));
      const result = await markAllReadPromise;

      expect(result.status).toBe('failed');
      const stateAfterRollback =
        notificationStoreManager.getOrCreateState(userId);
      expect(stateAfterRollback.unreadCountState).toBe(8);
      expect(stateAfterRollback.notifications[0].unread).toBe(true);
    });

    it('guards markRead and markAllRead against reentry and no-op conditions', async () => {
      const userId = 'model-reentry-user';
      notificationStoreManager.syncInitialNotifications(
        userId,
        [
          {
            id: 'n1',
            type: 'reservation_requested',
            createdAt: 'date',
            unread: true,
          },
        ],
        'success'
      );

      const deferredOne = createDeferred<void>();
      const source = installSource(userId, {
        markOneRead: vi.fn().mockImplementation(() => deferredOne.promise),
      });

      const firstOne = notificationStoreManager.markRead(userId, 'n1');
      const secondOne = await notificationStoreManager.markRead(userId, 'n1');
      expect(secondOne).toEqual({ status: 'skipped' });
      expect(source.markOneRead).toHaveBeenCalledTimes(1);

      deferredOne.resolve();
      expect(await firstOne).toEqual({ status: 'success' });

      // Already read -> skipped
      expect(await notificationStoreManager.markRead(userId, 'n1')).toEqual({
        status: 'skipped',
      });
      // Nothing unread left -> markAllRead skipped
      expect(await notificationStoreManager.markAllRead(userId)).toEqual({
        status: 'skipped',
      });
    });

    it('appends pages in loadMore, sets hasLoadMoreError on failure, and skips when there is no next page', async () => {
      const userId = 'model-load-more-user';
      notificationStoreManager.getOrCreateState(userId);
      notificationStoreManager.setInitialData(
        userId,
        0,
        [
          {
            id: 'n1',
            type: 'reservation_requested',
            createdAt: 'date',
            unread: false,
          },
        ],
        'cursor-1'
      );

      const source = installSource(userId, {
        listNotifications: vi
          .fn()
          .mockRejectedValueOnce(new Error('network'))
          .mockResolvedValueOnce({
            notifications: [
              {
                id: 'n2',
                type: 'reservation_requested',
                createdAt: 'date',
                unread: false,
              },
            ],
            next_cursor: null,
          }),
      });

      const failed = await notificationStoreManager.loadMore(userId);
      expect(failed.status).toBe('failed');
      expect(
        notificationStoreManager.getOrCreateState(userId).hasLoadMoreError
      ).toBe(true);

      // Non-retry while error is gated -> skipped
      expect(await notificationStoreManager.loadMore(userId, false)).toEqual({
        status: 'skipped',
      });

      // Explicit retry -> succeeds and clears nextCursor
      expect(await notificationStoreManager.loadMore(userId, true)).toEqual({
        status: 'success',
      });
      expect(source.listNotifications).toHaveBeenCalledTimes(2);
      const state = notificationStoreManager.getOrCreateState(userId);
      expect(state.notifications.map((n) => n.id)).toEqual(['n1', 'n2']);
      expect(state.nextCursor).toBeNull();

      // No next page -> skipped
      expect(await notificationStoreManager.loadMore(userId)).toEqual({
        status: 'skipped',
      });
    });

    it('discards a retry resolution that arrives after every subscriber for the key has unsubscribed', async () => {
      const userId = 'model-retry-stale-user';
      const deferred = createDeferred<NotificationItem[]>();
      installSource(userId, {
        retry: vi.fn().mockImplementation(() => deferred.promise),
      });

      const unsubscribe = notificationStoreManager.subscribe(userId, () => {});
      const retryPromise = notificationStoreManager.retry(userId);
      unsubscribe();

      deferred.resolve([
        {
          id: 'n1',
          type: 'reservation_requested',
          createdAt: 'date',
          unread: true,
        },
      ]);
      const result = await retryPromise;

      expect(result).toEqual({ status: 'stale' });
      const state = notificationStoreManager.getOrCreateState(userId);
      expect(state.notifications).toEqual([]);
    });
  });
});
