import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useNotificationCenter } from '@/hooks/useNotificationCenter';
import { mapNotificationVOToItem } from '@/services/notifications/notificationMapper';
import {
  createInMemoryNotificationSource,
  type NotificationSource,
} from '@/services/notifications/notificationSource';
import type { NotificationItem } from '@/services/notifications/types';
import { resetNotificationStore } from '@/stores/notificationStore';
import type { components } from '@/types/api';

const mockToastFn = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToastFn }),
}));

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
}));

type NotificationVO = components['schemas']['NotificationVO'];

function buildSeedItems(
  total = 25,
  isUnread: (index: number) => boolean = (i) => i < 5
): NotificationItem[] {
  const nowSec = Math.floor(Date.now() / 1000);
  return Array.from({ length: total }, (_, i) => {
    const vo: NotificationVO = {
      id: i + 1,
      type: i % 2 === 0 ? 'reservation_canceled' : 'reservation_upcoming',
      metadata: {
        role: i % 2 === 0 ? 'mentor' : 'mentee',
        counterparty_name: i % 2 === 0 ? `Mentee_${i}` : `Mentor_${i}`,
      },
      created_at: nowSec - i * 60,
      read_at: isUnread(i) ? null : nowSec,
    };
    return mapNotificationVOToItem(vo);
  });
}

async function renderAndOpen(source: NotificationSource, userId = 'user-123') {
  const rendered = renderHook(() =>
    useNotificationCenter({ userId, notificationSource: source })
  );

  await waitFor(() => {
    expect(rendered.result.current.badgeCount).toBeGreaterThanOrEqual(0);
  });

  act(() => {
    rendered.result.current.openCenter();
  });

  await waitFor(() => {
    expect(rendered.result.current.status).toBe('success');
  });

  return rendered;
}

describe('useNotificationCenter pagination and NotificationSource integration', () => {
  let defaultSource: NotificationSource;

  beforeEach(() => {
    localStorage.clear();
    mockToastFn.mockClear();
    resetNotificationStore();
    defaultSource = createInMemoryNotificationSource(buildSeedItems());
  });

  it('on mount, fetches only the unread count - the list stays unloaded until the dropdown opens', async () => {
    const listSpy = vi.spyOn(defaultSource, 'listNotifications');

    const { result } = renderHook(() =>
      useNotificationCenter({
        userId: 'user-123',
        notificationSource: defaultSource,
      })
    );

    expect(result.current.status).toBe('loading');
    expect(result.current.items).toHaveLength(0);

    await waitFor(() => {
      expect(result.current.badgeCount).toBe(5);
    });
    expect(result.current.hasUnread).toBe(true);

    expect(result.current.status).toBe('loading');
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('fetches the first batch of 20 items once the dropdown is opened', async () => {
    const { result } = renderHook(() =>
      useNotificationCenter({
        userId: 'user-123',
        notificationSource: defaultSource,
      })
    );

    await waitFor(() => {
      expect(result.current.badgeCount).toBe(5);
    });

    act(() => {
      result.current.openCenter();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    expect(result.current.items).toHaveLength(20);
    expect(result.current.hasMore).toBe(true);
  });

  it('sets status to error (not a silent empty success) when the first-ever list load fails', async () => {
    vi.spyOn(defaultSource, 'listNotifications').mockRejectedValue(
      new Error('Network Error')
    );

    const { result } = renderHook(() =>
      useNotificationCenter({
        userId: 'user-123',
        notificationSource: defaultSource,
      })
    );

    act(() => {
      result.current.openCenter();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    expect(result.current.items).toHaveLength(0);
  });

  it('loads the next batch and appends them when loadMore is called', async () => {
    const { result } = await renderAndOpen(defaultSource);

    expect(result.current.items).toHaveLength(20);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.items).toHaveLength(25);
    expect(result.current.hasMore).toBe(false);
  });

  it('correctly maps metadata mentor_name and mentee_name based on role', async () => {
    const { result } = await renderAndOpen(defaultSource);

    const firstItem = result.current.items[0];
    expect(firstItem.role).toBe('mentor');
    expect(firstItem.menteeName).toBe('Mentee_0');
    expect(firstItem.mentorName).toBeUndefined();

    const secondItem = result.current.items[1];
    expect(secondItem.role).toBe('mentee');
    expect(secondItem.mentorName).toBe('Mentor_1');
    expect(secondItem.menteeName).toBeUndefined();
  });

  it('silently refreshes both count and list on a subsequent openCenter/onOpenChange(true), without resetting to a loading state', async () => {
    const { result } = await renderAndOpen(defaultSource);

    const listSpy = vi.spyOn(defaultSource, 'listNotifications');
    const countSpy = vi.spyOn(defaultSource, 'getUnreadCount');

    act(() => {
      result.current.openCenter();
    });

    expect(listSpy).toHaveBeenCalled();
    expect(countSpy).toHaveBeenCalled();
    expect(result.current.status).toBe('success');

    await waitFor(() => {
      expect(result.current.items).toHaveLength(20);
    });
  });

  it('prevents duplicate parallel requests when calling loadMore concurrently', async () => {
    const { result } = await renderAndOpen(defaultSource);

    const listSpy = vi.spyOn(defaultSource, 'listNotifications');

    await act(async () => {
      await Promise.all([result.current.loadMore(), result.current.loadMore()]);
    });

    expect(listSpy).toHaveBeenCalledTimes(1);
  });

  it('optimistically decrements badgeCount on markRead and rolls back if source fails', async () => {
    const { result } = await renderAndOpen(defaultSource);

    vi.spyOn(defaultSource, 'markOneRead').mockRejectedValue(
      new Error('Network Error')
    );

    expect(result.current.badgeCount).toBe(5);

    const unreadItem = result.current.items.find((i) => i.unread);
    expect(unreadItem).toBeDefined();

    await act(async () => {
      await result.current.markRead(unreadItem!.id);
    });

    expect(result.current.badgeCount).toBe(5);
    expect(
      result.current.items.find((i) => i.id === unreadItem!.id)?.unread
    ).toBe(true);
    expect(mockToastFn).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '操作失敗',
      })
    );
  });

  it('optimistically clears badgeCount on markAllRead and rolls back if source fails', async () => {
    const { result } = await renderAndOpen(defaultSource);

    vi.spyOn(defaultSource, 'markAllRead').mockRejectedValue(
      new Error('Network Error')
    );

    expect(result.current.badgeCount).toBe(5);

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(result.current.badgeCount).toBe(5);
    expect(mockToastFn).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '操作失敗',
      })
    );
  });

  it('sets hasLoadMoreError to true and allows retry when loadMore fails', async () => {
    const { result } = await renderAndOpen(defaultSource);

    const listSpy = vi
      .spyOn(defaultSource, 'listNotifications')
      .mockRejectedValueOnce(new Error('Network Error'));

    expect(result.current.hasLoadMoreError).toBe(false);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.hasLoadMoreError).toBe(true);
    expect(mockToastFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '載入失敗',
      })
    );

    await act(async () => {
      await result.current.loadMore(true);
    });

    expect(result.current.hasLoadMoreError).toBe(false);
    expect(listSpy).toHaveBeenCalledTimes(2);
    expect(result.current.items).toHaveLength(25);
  });

  it('prevents duplicate parallel requests when calling markRead concurrently for the same ID', async () => {
    const { result } = await renderAndOpen(defaultSource);

    const markOneReadSpy = vi.spyOn(defaultSource, 'markOneRead');

    const unreadItem = result.current.items.find((i) => i.unread);
    expect(unreadItem).toBeDefined();

    await act(async () => {
      await Promise.all([
        result.current.markRead(unreadItem!.id),
        result.current.markRead(unreadItem!.id),
      ]);
    });

    expect(markOneReadSpy).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate list-load requests when both hook instances open concurrently', async () => {
    const countSpy = vi.spyOn(defaultSource, 'getUnreadCount');
    const listSpy = vi.spyOn(defaultSource, 'listNotifications');

    const { result: hook1 } = renderHook(() =>
      useNotificationCenter({
        userId: 'user-concurrent-init',
        notificationSource: defaultSource,
      })
    );
    const { result: hook2 } = renderHook(() =>
      useNotificationCenter({
        userId: 'user-concurrent-init',
        notificationSource: defaultSource,
      })
    );

    await waitFor(() => {
      expect(hook1.current.badgeCount).toBe(5);
      expect(hook2.current.badgeCount).toBe(5);
    });
    expect(countSpy).toHaveBeenCalledTimes(1);

    countSpy.mockClear();

    act(() => {
      hook1.current.openCenter();
      hook2.current.openCenter();
    });

    await waitFor(() => {
      expect(hook1.current.status).toBe('success');
      expect(hook2.current.status).toBe('success');
    });

    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(countSpy).toHaveBeenCalledTimes(1);
    expect(hook1.current.items).toHaveLength(20);
    expect(hook2.current.items).toHaveLength(20);
  });

  it('reports olderUnreadCount for unread items not yet loaded, and clears it once loadMore catches up', async () => {
    const customSource = createInMemoryNotificationSource(
      buildSeedItems(25, (i) => i < 5 || (i >= 21 && i < 24))
    );

    const { result } = await renderAndOpen(customSource);

    expect(result.current.items).toHaveLength(20);
    expect(result.current.badgeCount).toBe(8);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.olderUnreadCount).toBe(3);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.items).toHaveLength(25);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.olderUnreadCount).toBe(0);
  });

  it('never calls an auth-requiring NotificationSource when userId is undefined', async () => {
    const listSpy = vi.spyOn(defaultSource, 'listNotifications');
    const fetchUnreadSpy = vi.spyOn(defaultSource, 'getUnreadCount');
    const markOneReadSpy = vi.spyOn(defaultSource, 'markOneRead');
    const markAllReadSpy = vi.spyOn(defaultSource, 'markAllRead');

    const { result } = renderHook(() =>
      useNotificationCenter({ notificationSource: defaultSource })
    );

    act(() => {
      result.current.openCenter();
    });
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
  });
});
