import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useNotificationCenter } from '@/hooks/useNotificationCenter';
import * as mockService from '@/services/mockNotificationService';
import { type ApiNotificationItem } from '@/services/mockNotificationService';

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const mockApiNotifications: ApiNotificationItem[] = Array.from(
  { length: 25 },
  (_, i) => ({
    id: `mock-n${i + 1}`,
    type: i % 2 === 0 ? 'reservation_canceled' : 'reservation_upcoming',
    metadata: {
      role: i % 2 === 0 ? 'mentor' : 'mentee',
      mentee_name: `Mentee_${i}`,
      mentor_name: `Mentor_${i}`,
    },
    created_at: new Date(Date.now() - i * 60 * 1000).toISOString(),
    read_at: i < 5 ? null : new Date().toISOString(), // 5 unread items
  })
);

describe('useNotificationCenter pagination and service integration', () => {
  beforeEach(() => {
    localStorage.clear();
    // Initialize mock database with predictable 25 items
    mockService.resetMockNotificationDatabase(mockApiNotifications);
  });

  it('fetches initial data (unread count and first batch of 20 items) from service on mount', async () => {
    const { result } = renderHook(() => useNotificationCenter());

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

  it('loads the next batch and appends them when loadMore is called', async () => {
    const { result } = renderHook(() => useNotificationCenter());

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
    const { result } = renderHook(() => useNotificationCenter());

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
    const { result } = renderHook(() => useNotificationCenter());

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
    const { result } = renderHook(() => useNotificationCenter());

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
    const { result } = renderHook(() => useNotificationCenter());

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

    markOneReadSpy.mockRestore();
  });

  it('optimistically clears badgeCount on markAllRead and rolls back if service fails', async () => {
    const { result } = renderHook(() => useNotificationCenter());

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

    markAllReadSpy.mockRestore();
  });
});
