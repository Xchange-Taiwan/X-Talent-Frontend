import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useNotificationCenter } from '@/hooks/useNotificationCenter';
import * as mockService from '@/mocks/mockNotificationService';
import { type ApiNotificationItem } from '@/mocks/mockNotificationService';
import { resetNotificationStore } from '@/stores/notificationStore';

const mockToastFn = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToastFn }),
}));

// Uses src/services/notifications/__mocks__/notificationService.ts
vi.mock('@/services/notifications/notificationService');

const mockApiNotifications: ApiNotificationItem[] = Array.from(
  { length: 25 },
  (_, i) => ({
    id: i + 1,
    type: i % 2 === 0 ? 'reservation_canceled' : 'reservation_upcoming',
    metadata: {
      role: i % 2 === 0 ? 'mentor' : 'mentee',
      counterparty_name: i % 2 === 0 ? `Mentee_${i}` : `Mentor_${i}`,
    },
    created_at: Math.floor((Date.now() - i * 60 * 1000) / 1000),
    read_at: i < 5 ? null : Math.floor(Date.now() / 1000), // 5 unread items
  })
);

describe('useNotificationCenter pagination and service integration', () => {
  beforeEach(() => {
    localStorage.clear();
    mockToastFn.mockClear();
    resetNotificationStore();
    // Initialize mock database with predictable 25 items
    mockService.resetMockNotificationDatabase(mockApiNotifications);
  });

  it('fetches initial data (unread count and first batch of 20 items) from service on mount', async () => {
    const { result } = renderHook(() =>
      useNotificationCenter({ userId: 'user-123' })
    );

    // Initially loading
    expect(result.current.status).toBe('loading');
    expect(result.current.items).toHaveLength(0);

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    expect(result.current.items).toHaveLength(20);
    // unreadCountState drives badgeCount (which is 5 in total)
    expect(result.current.badgeCount).toBe(5);
    expect(result.current.hasUnread).toBe(true);
    expect(result.current.hasMore).toBe(true); // 25 total items, first batch has 20, so 5 more exist
  });

  it('sets status to error (not a silent empty success) when the initial load fails with no existing notifications', async () => {
    const listSpy = vi
      .spyOn(mockService, 'listNotifications')
      .mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() =>
      useNotificationCenter({ userId: 'user-123' })
    );

    expect(result.current.status).toBe('loading');

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    expect(result.current.items).toHaveLength(0);

    listSpy.mockRestore();
  });

  it('loads the next batch and appends them when loadMore is called', async () => {
    const { result } = renderHook(() =>
      useNotificationCenter({ userId: 'user-123' })
    );

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    expect(result.current.items).toHaveLength(20);
    expect(result.current.hasMore).toBe(true);

    // Trigger load more
    await act(async () => {
      await result.current.loadMore();
    });

    // Should load the remaining 5 items, total 25
    expect(result.current.items).toHaveLength(25);
    expect(result.current.hasMore).toBe(false); // No more items left
  });

  it('correctly maps metadata mentor_name and mentee_name based on role', async () => {
    const { result } = renderHook(() =>
      useNotificationCenter({ userId: 'user-123' })
    );

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    // Item 0 (even index): type reservation_canceled, role mentor, mentee_name Mentee_0
    const firstItem = result.current.items[0];
    expect(firstItem.role).toBe('mentor');
    expect(firstItem.menteeName).toBe('Mentee_0');
    expect(firstItem.mentorName).toBeUndefined();

    // Item 1 (odd index): type reservation_upcoming, role mentee, mentor_name Mentor_1
    const secondItem = result.current.items[1];
    expect(secondItem.role).toBe('mentee');
    expect(secondItem.mentorName).toBe('Mentor_1');
    expect(secondItem.menteeName).toBeUndefined();
  });

  it('refreshes initial data when openCenter or onOpenChange(true) is called', async () => {
    const { result } = renderHook(() =>
      useNotificationCenter({ userId: 'user-123' })
    );

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    // Spy on service functions
    const listSpy = vi.spyOn(mockService, 'listNotifications');
    const countSpy = vi.spyOn(mockService, 'fetchUnreadCount');

    // Open center
    act(() => {
      result.current.openCenter();
    });

    expect(listSpy).toHaveBeenCalled();
    expect(countSpy).toHaveBeenCalled();

    listSpy.mockRestore();
    countSpy.mockRestore();
  });

  it('prevents duplicate parallel requests when calling loadMore concurrently', async () => {
    const { result } = renderHook(() =>
      useNotificationCenter({ userId: 'user-123' })
    );

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    const listSpy = vi.spyOn(mockService, 'listNotifications');

    // Call loadMore twice concurrently
    await act(async () => {
      await Promise.all([result.current.loadMore(), result.current.loadMore()]);
    });

    // listNotifications should only be called once because of the isFetchingRef.current lock!
    expect(listSpy).toHaveBeenCalledTimes(1);
    listSpy.mockRestore();
  });

  it('optimistically decrements badgeCount on markRead and rolls back if service fails', async () => {
    const { result } = renderHook(() =>
      useNotificationCenter({ userId: 'user-123' })
    );

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    // Make markOneRead reject/fail
    const markOneReadSpy = vi
      .spyOn(mockService, 'markOneRead')
      .mockRejectedValue(new Error('Network Error'));

    expect(result.current.badgeCount).toBe(5);

    // Get an unread item
    const unreadItem = result.current.items.find((i) => i.unread);
    expect(unreadItem).toBeDefined();

    await act(async () => {
      await result.current.markRead(unreadItem!.id);
    });

    // badgeCount should be optimistically decremented to 4, then rolled back to 5!
    expect(result.current.badgeCount).toBe(5);
    expect(
      result.current.items.find((i) => i.id === unreadItem!.id)?.unread
    ).toBe(true);
    // Toast feedback must fire on real API failure too, not just props-driven usage
    expect(mockToastFn).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '操作失敗',
      })
    );

    markOneReadSpy.mockRestore();
  });

  it('optimistically clears badgeCount on markAllRead and rolls back if service fails', async () => {
    const { result } = renderHook(() =>
      useNotificationCenter({ userId: 'user-123' })
    );

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    // Make markAllRead reject/fail
    const markAllReadSpy = vi
      .spyOn(mockService, 'markAllRead')
      .mockRejectedValue(new Error('Network Error'));

    expect(result.current.badgeCount).toBe(5);

    await act(async () => {
      await result.current.markAllRead();
    });

    // badgeCount should be optimistically cleared to 0, then rolled back to 5!
    expect(result.current.badgeCount).toBe(5);
    // Toast feedback must fire on real API failure too, not just props-driven usage
    expect(mockToastFn).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '操作失敗',
      })
    );

    markAllReadSpy.mockRestore();
  });

  it('sets hasLoadMoreError to true and allows retry when loadMore fails', async () => {
    const { result } = renderHook(() =>
      useNotificationCenter({ userId: 'user-123' })
    );

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    // Make listNotifications reject/fail
    const listSpy = vi
      .spyOn(mockService, 'listNotifications')
      .mockRejectedValue(new Error('Network Error'));

    expect(result.current.hasLoadMoreError).toBe(false);

    // Trigger load more which fails
    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.hasLoadMoreError).toBe(true);
    expect(mockToastFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '載入失敗',
      })
    );

    // Restore spy and mock success for retry
    listSpy.mockRestore();
    const successSpy = vi.spyOn(mockService, 'listNotifications');

    // Trigger loadMore retry (pass true to bypass error gate)
    await act(async () => {
      await result.current.loadMore(true);
    });

    expect(result.current.hasLoadMoreError).toBe(false);
    expect(successSpy).toHaveBeenCalled();
    successSpy.mockRestore();
  });

  it('prevents duplicate parallel requests when calling markRead concurrently for the same ID', async () => {
    const { result } = renderHook(() =>
      useNotificationCenter({ userId: 'user-123' })
    );

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    const markOneReadSpy = vi
      .spyOn(mockService, 'markOneRead')
      .mockResolvedValue(undefined);

    // Get an unread item
    const unreadItem = result.current.items.find((i) => i.unread);
    expect(unreadItem).toBeDefined();

    // Trigger markRead twice concurrently for the same ID
    await act(async () => {
      await Promise.all([
        result.current.markRead(unreadItem!.id),
        result.current.markRead(unreadItem!.id),
      ]);
    });

    // markOneRead should only be called once because of markingReadIdsRef locking!
    expect(markOneReadSpy).toHaveBeenCalledTimes(1);
    markOneReadSpy.mockRestore();
  });

  it('prevents duplicate initial load requests when multiple hook instances are initialized concurrently', async () => {
    const listSpy = vi.spyOn(mockService, 'listNotifications');
    const fetchUnreadSpy = vi.spyOn(mockService, 'fetchUnreadCount');

    // Simultaneously render two separate hook instances
    const { result: hook1 } = renderHook(() =>
      useNotificationCenter({ userId: 'user-concurrent-init' })
    );
    const { result: hook2 } = renderHook(() =>
      useNotificationCenter({ userId: 'user-concurrent-init' })
    );

    // Both should start in loading state
    expect(hook1.current.status).toBe('loading');
    expect(hook2.current.status).toBe('loading');

    // Wait for the asynchronous initial data loading to settle on both
    await waitFor(() => {
      expect(hook1.current.status).toBe('success');
      expect(hook2.current.status).toBe('success');
    });

    // Verify that the actual mock service functions were only called ONCE in total!
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(fetchUnreadSpy).toHaveBeenCalledTimes(1);

    // Verify that both instances received the same correct fetched data
    expect(hook1.current.items).toHaveLength(20);
    expect(hook2.current.items).toHaveLength(20);
    expect(hook1.current.badgeCount).toBe(5);
    expect(hook2.current.badgeCount).toBe(5);

    listSpy.mockRestore();
    fetchUnreadSpy.mockRestore();
  });

  it('reports olderUnreadCount for unread items not yet loaded, and clears it once loadMore catches up', async () => {
    // 25 items total, first page loads 20. 5 unread within the first page
    // (indices 0-4), 3 more unread beyond it (indices 21-23) -- the badge
    // total (8) should outpace the loaded-list unread count (5) by exactly
    // the not-yet-loaded unread items.
    const customNotifications: ApiNotificationItem[] = Array.from(
      { length: 25 },
      (_, i) => ({
        id: i + 1,
        type: 'reservation_canceled',
        metadata: { role: 'mentor', counterparty_name: `Mentee_${i}` },
        created_at: Math.floor((Date.now() - i * 60 * 1000) / 1000),
        read_at:
          i < 5 || (i >= 21 && i < 24) ? null : Math.floor(Date.now() / 1000),
      })
    );
    mockService.resetMockNotificationDatabase(customNotifications);

    const { result } = renderHook(() =>
      useNotificationCenter({ userId: 'user-123' })
    );

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    expect(result.current.items).toHaveLength(20);
    expect(result.current.badgeCount).toBe(8);
    expect(result.current.hasMore).toBe(true);
    // 5 unread already loaded, 3 more unread still beyond the loaded page
    expect(result.current.olderUnreadCount).toBe(3);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.items).toHaveLength(25);
    expect(result.current.hasMore).toBe(false);
    // Fully loaded: no unread items remain "older" than what's on screen
    expect(result.current.olderUnreadCount).toBe(0);
  });

  it('never calls the notification service when userId is undefined (e.g. before auth resolves)', async () => {
    const listSpy = vi.spyOn(mockService, 'listNotifications');
    const fetchUnreadSpy = vi.spyOn(mockService, 'fetchUnreadCount');
    const markOneReadSpy = vi.spyOn(mockService, 'markOneRead');
    const markAllReadSpy = vi.spyOn(mockService, 'markAllRead');

    const { result } = renderHook(() => useNotificationCenter({}));

    // No userId and no initialNotifications props: nothing to fetch, so it
    // should settle without ever touching the API.
    await act(async () => {
      await result.current.loadMore();
    });
    await act(async () => {
      await result.current.markRead('some-id');
    });
    await act(async () => {
      await result.current.markAllRead();
    });

    expect(listSpy).not.toHaveBeenCalled();
    expect(fetchUnreadSpy).not.toHaveBeenCalled();
    expect(markOneReadSpy).not.toHaveBeenCalled();
    expect(markAllReadSpy).not.toHaveBeenCalled();

    listSpy.mockRestore();
    fetchUnreadSpy.mockRestore();
    markOneReadSpy.mockRestore();
    markAllReadSpy.mockRestore();
  });
});
