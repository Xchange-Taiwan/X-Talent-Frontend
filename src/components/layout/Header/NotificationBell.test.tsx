import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { fromAny, fromPartial } from '@total-typescript/shoehorn';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as useNotificationCenterModule from '@/hooks/useNotificationCenter';
import { type NotificationItem } from '@/hooks/useNotificationCenter';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  createInMemoryNotificationSource,
  type NotificationSource,
} from '@/services/notifications/notificationSource';
import { resetNotificationStore } from '@/stores/notificationStore';
import { mockToast } from '@/test/mocks/useToast';

import { NotificationBell } from './NotificationBell';
import {
  getNotificationContent,
  getNotificationHref,
} from './notificationUtils';

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

class NoopIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
  disconnect() {}
  observe() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  unobserve() {}
}

const MOCK_MIXED_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    type: 'reservation_requested',
    menteeName: '小明',
    createdAt: new Date().toISOString(),
    unread: true,
  },
  {
    id: '2',
    type: 'reservation_success',
    mentorName: '林導師',
    createdAt: new Date().toISOString(),
    unread: true,
  },
  {
    id: '3',
    type: 'reservation_failed',
    mentorName: '王導師',
    createdAt: new Date().toISOString(),
    unread: true,
  },
  {
    id: '4',
    type: 'reservation_canceled',
    mentorName: '陳導師',
    createdAt: new Date().toISOString(),
    unread: true,
  },
  {
    id: '5',
    type: 'reservation_upcoming',
    mentorName: '張導師',
    createdAt: new Date().toISOString(),
    unread: true,
  },
];

const MOCK_MENTOR_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'canceled-mentor-explicit',
    type: 'reservation_canceled',
    menteeName: '小明',
    role: 'mentor',
    createdAt: new Date().toISOString(),
    unread: true,
  },
  {
    id: 'upcoming-mentor-inferred',
    type: 'reservation_upcoming',
    menteeName: '小華',
    createdAt: new Date().toISOString(),
    unread: true,
  },
];

function getMockNotifications(count: number): NotificationItem[] {
  const types: Array<
    | 'reservation_requested'
    | 'reservation_success'
    | 'reservation_failed'
    | 'reservation_canceled'
    | 'reservation_upcoming'
  > = [
    'reservation_requested',
    'reservation_success',
    'reservation_failed',
    'reservation_canceled',
    'reservation_upcoming',
  ];
  return Array.from({ length: count }, (_, i) => ({
    id: `${i + 1}`,
    type: types[i % types.length],
    menteeName: i === 0 ? '小明' : `Mentee ${i}`,
    mentorName: '林導師',
    createdAt: new Date().toISOString(),
    unread: true,
  }));
}

function renderBell(
  props: Partial<React.ComponentProps<typeof NotificationBell>> & {
    unreadCount?: number;
  } = {}
) {
  const {
    unreadCount = 5,
    initialNotifications,
    notificationSource,
    ...rest
  } = props;
  if (notificationSource !== undefined) {
    return render(
      <NotificationBell
        notificationSource={notificationSource}
        initialNotifications={initialNotifications}
        {...rest}
      />
    );
  }
  const notifications =
    initialNotifications !== undefined
      ? initialNotifications
      : getMockNotifications(unreadCount);
  return render(
    <NotificationBell initialNotifications={notifications} {...rest} />
  );
}

describe('NotificationBell', () => {
  beforeEach(() => {
    mockToast.mockClear();
    vi.mocked(captureFlowFailure).mockClear();
    localStorage.clear();
    resetNotificationStore();
    global.IntersectionObserver = NoopIntersectionObserver;
  });

  it('renders the bell icon button with title and aria-label', () => {
    renderBell({ unreadCount: 5 });
    const button = screen.getByRole('button', { name: '開啟通知選單' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('title', '通知');
  });

  it('renders the unread count badge with correct count', () => {
    renderBell({ unreadCount: 5 });
    const badge = screen.getByText('5');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-label', '有 5 則未讀通知');
  });

  it('shows "99+" for unread count over 99', () => {
    renderBell({ unreadCount: 120 });
    const badge = screen.getByText('99+');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-label', '有 120 則未讀通知');
  });

  it('hides the unread count badge and opens the empty popover container on click', () => {
    renderBell({
      unreadCount: 5,
      initialNotifications: [],
      initialStatus: 'empty',
    });
    const button = screen.getByRole('button', { name: '開啟通知選單' });

    fireEvent.click(button);

    expect(screen.getByText('尚無新通知')).toBeInTheDocument();

    const popoverContent = screen
      .getByText('尚無新通知')
      .closest('[class*="max-w-"]');
    expect(popoverContent).toBeInTheDocument();
    expect(popoverContent).toHaveClass('w-[calc(100vw-32px)]');
    expect(popoverContent).toHaveClass('max-w-[360px]');
  });

  it('contains tailwind CSS classes for the hover state to avoid JS state overhead', () => {
    renderBell({ unreadCount: 5 });
    const button = screen.getByRole('button', { name: '開啟通知選單' });

    expect(button).toHaveClass('[@media(hover:hover)]:hover:bg-dark');
    expect(button).toHaveClass('[@media(hover:hover)]:hover:border-dark');
  });

  it('contains tailwind CSS classes for a visible keyboard focus ring', () => {
    renderBell({ unreadCount: 5 });
    const button = screen.getByRole('button', { name: '開啟通知選單' });

    expect(button).toHaveClass('focus-visible:ring-2');
    expect(button).toHaveClass('focus-visible:ring-ring');
    expect(button).toHaveClass('focus-visible:outline-none');
  });

  it('contains tailwind CSS classes for the open state, matching the reservation tab active style', () => {
    renderBell({ unreadCount: 5 });
    const button = screen.getByRole('button', { name: '開啟通知選單' });

    expect(button).toHaveClass('data-[state=open]:bg-dark');
    expect(button).toHaveClass('data-[state=open]:border-dark');
    expect(button).toHaveClass('data-[state=open]:text-text-white');

    const bell = button.querySelector('svg');
    expect(bell).not.toBeNull();
    expect(bell).toHaveClass('group-data-[state=open]/bell:fill-current');
    expect(bell).toHaveClass('group-data-[state=open]/bell:text-text-white');
  });

  describe('Notification Dropdown Rendering states', () => {
    it('renders all 5 types of notification card contents under success state', () => {
      renderBell({
        initialNotifications: MOCK_MIXED_NOTIFICATIONS,
        initialStatus: 'success',
      });
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      expect(screen.getByText('通知')).toBeInTheDocument();

      expect(screen.getByText('您有新的預約')).toBeInTheDocument();
      expect(
        screen.getByText('小明 與您提出預約需求，請前往接受預約')
      ).toBeInTheDocument();

      expect(screen.getByText('林導師 已接受您的預約')).toBeInTheDocument();
      expect(screen.getByText('前往查看您的預約詳情')).toBeInTheDocument();

      expect(
        screen.getByText('您與 王導師 的預約已被拒絕')
      ).toBeInTheDocument();
      expect(
        screen.getByText('您的預約已被拒絕，歡迎重新預約')
      ).toBeInTheDocument();

      expect(
        screen.getByText('您與 陳導師 的預約已被取消')
      ).toBeInTheDocument();

      expect(
        screen.getByText('您與 張導師 的預約即將到來')
      ).toBeInTheDocument();
      expect(
        screen.getByText('您 24 小時後有與 張導師 的會議，請準時上線')
      ).toBeInTheDocument();
    });

    it('renders an unknown notification type with fallback content instead of crashing', () => {
      const notificationsWithUnknownType: NotificationItem[] = [
        ...MOCK_MIXED_NOTIFICATIONS,
        fromAny({
          id: 'unknown-1',
          type: 'unknown_type',
          createdAt: new Date().toISOString(),
          unread: true,
        }),
      ];

      expect(() =>
        renderBell({
          initialNotifications: notificationsWithUnknownType,
          initialStatus: 'success',
        })
      ).not.toThrow();

      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      expect(screen.getByText('您有一則新通知')).toBeInTheDocument();
    });

    it('renders empty state under success status with zero notifications', () => {
      renderBell({
        initialNotifications: [],
        initialStatus: 'success',
      });
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      expect(screen.getByText('尚無新通知')).toBeInTheDocument();
    });

    it('applies unread and read classes appropriately to notification titles based on unread status', () => {
      const spy = vi
        .spyOn(useNotificationCenterModule, 'useNotificationCenter')
        .mockReturnValue(
          fromPartial({
            open: true,
            status: 'success',
            items: [
              {
                id: '1',
                type: 'reservation_requested',
                createdAt: new Date().toISOString(),
                unread: true,
              },
              {
                id: '2',
                type: 'reservation_success',
                createdAt: new Date().toISOString(),
                unread: false,
              },
            ],
            badgeCount: 1,
            showBadge: false,
            formattedCount: '1',
            hasUnread: true,
            onOpenChange: vi.fn(),
            closeCenter: vi.fn(),
            markRead: vi.fn(),
            markAllRead: vi.fn(),
            handleRetry: vi.fn(),
          })
        );

      renderBell({ initialStatus: 'success' });

      const unreadTitle = screen.getByText('您有新的預約');
      expect(unreadTitle).toHaveClass('font-bold');
      expect(unreadTitle).toHaveClass('text-text-primary');

      const readTitle = screen.getByText('Mentor 已接受您的預約');
      expect(readTitle).toHaveClass('font-normal');
      expect(readTitle).toHaveClass('text-text-secondary');

      spy.mockRestore();
    });

    it('renders skeletons when in loading state', () => {
      renderBell({ unreadCount: 5, initialStatus: 'loading' });
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      expect(screen.queryByText('尚無新通知')).not.toBeInTheDocument();
      expect(screen.queryByText('您有新的預約')).not.toBeInTheDocument();
    });

    it('renders error state and a retry button', () => {
      renderBell({ unreadCount: 5, initialStatus: 'error' });
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      expect(screen.getByText('載入失敗，請重試')).toBeInTheDocument();
      const retryButton = screen.getByRole('button', { name: '重新嘗試' });
      expect(retryButton).toBeInTheDocument();
      expect(retryButton).toHaveClass('focus-visible:ring-2');
      expect(retryButton).toHaveClass('focus-visible:ring-ring');
    });

    it('transitions to loading and then success when clicking retry button via NotificationSource', async () => {
      const deferredRetry = createDeferred<{
        notifications: NotificationItem[];
        next_cursor: string | null;
      }>();
      let listCallCount = 0;

      const source: NotificationSource = {
        requiresAuth: false,
        isPreloaded: false,
        getUnreadCount: vi.fn().mockResolvedValue({ unread_count: 5 }),
        listNotifications: vi.fn().mockImplementation(() => {
          listCallCount += 1;
          if (listCallCount === 1) {
            return Promise.reject(new Error('Initial network error'));
          }
          return deferredRetry.promise;
        }),
        markOneRead: vi.fn().mockResolvedValue(undefined),
        markAllRead: vi.fn().mockResolvedValue(undefined),
      };

      renderBell({ userId: 'user-retry-ui', notificationSource: source });
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      expect(await screen.findByText('載入失敗，請重試')).toBeInTheDocument();

      const retryButton = screen.getByRole('button', { name: '重新嘗試' });
      fireEvent.click(retryButton);

      expect(screen.queryByText('載入失敗，請重試')).not.toBeInTheDocument();

      await act(async () => {
        deferredRetry.resolve({
          notifications: MOCK_MIXED_NOTIFICATIONS,
          next_cursor: null,
        });
        await deferredRetry.promise;
      });

      expect(screen.getByText('您有新的預約')).toBeInTheDocument();
    });

    it('shows the "older unread" hint above the load-more area when olderUnreadCount is positive', () => {
      const spy = vi
        .spyOn(useNotificationCenterModule, 'useNotificationCenter')
        .mockReturnValue(
          fromPartial({
            open: true,
            status: 'success',
            items: MOCK_MIXED_NOTIFICATIONS,
            badgeCount: 8,
            showBadge: false,
            formattedCount: '8',
            hasUnread: true,
            onOpenChange: vi.fn(),
            closeCenter: vi.fn(),
            markRead: vi.fn(),
            markAllRead: vi.fn(),
            handleRetry: vi.fn(),
            hasMore: true,
            isLoadingMore: false,
            hasLoadMoreError: false,
            loadMore: vi.fn(),
            olderUnreadCount: 3,
          })
        );

      renderBell({ initialStatus: 'success' });

      expect(screen.getByText('還有 3 則較舊的未讀通知')).toBeInTheDocument();

      spy.mockRestore();
    });

    it('caps the "older unread" hint at "99+" when olderUnreadCount exceeds 99', () => {
      const spy = vi
        .spyOn(useNotificationCenterModule, 'useNotificationCenter')
        .mockReturnValue(
          fromPartial({
            open: true,
            status: 'success',
            items: MOCK_MIXED_NOTIFICATIONS,
            badgeCount: 150,
            showBadge: false,
            formattedCount: '99+',
            hasUnread: true,
            onOpenChange: vi.fn(),
            closeCenter: vi.fn(),
            markRead: vi.fn(),
            markAllRead: vi.fn(),
            handleRetry: vi.fn(),
            hasMore: true,
            isLoadingMore: false,
            hasLoadMoreError: true,
            loadMore: vi.fn(),
            olderUnreadCount: 120,
          })
        );

      renderBell({ initialStatus: 'success' });

      expect(screen.getByText('還有 99+ 則較舊的未讀通知')).toBeInTheDocument();

      spy.mockRestore();
    });

    it('gives the load-more "點擊重試" button a visible keyboard focus ring', () => {
      const spy = vi
        .spyOn(useNotificationCenterModule, 'useNotificationCenter')
        .mockReturnValue(
          fromPartial({
            open: true,
            status: 'success',
            items: MOCK_MIXED_NOTIFICATIONS,
            badgeCount: 8,
            showBadge: false,
            formattedCount: '8',
            hasUnread: true,
            onOpenChange: vi.fn(),
            closeCenter: vi.fn(),
            markRead: vi.fn(),
            markAllRead: vi.fn(),
            handleRetry: vi.fn(),
            hasMore: true,
            isLoadingMore: false,
            hasLoadMoreError: true,
            loadMore: vi.fn(),
            olderUnreadCount: 0,
          })
        );

      renderBell({ initialStatus: 'success' });

      const retryMoreButton = screen.getByRole('button', {
        name: '點擊重試',
      });
      expect(retryMoreButton).toHaveClass('focus-visible:ring-2');
      expect(retryMoreButton).toHaveClass('focus-visible:ring-ring');

      spy.mockRestore();
    });

    it('does not show the "older unread" hint when olderUnreadCount is zero', () => {
      renderBell({
        initialNotifications: MOCK_MIXED_NOTIFICATIONS,
        initialStatus: 'success',
      });
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      expect(screen.queryByText(/則較舊的未讀通知/)).not.toBeInTheDocument();
    });

    it('safely discards late retry resolution after unmount without crashing', async () => {
      const deferredRetry = createDeferred<NotificationItem[]>();
      const source: NotificationSource = {
        requiresAuth: false,
        isPreloaded: false,
        getUnreadCount: vi.fn().mockResolvedValue({ unread_count: 1 }),
        listNotifications: vi
          .fn()
          .mockRejectedValue(new Error('Initial failure')),
        markOneRead: vi.fn().mockResolvedValue(undefined),
        markAllRead: vi.fn().mockResolvedValue(undefined),
        retry: vi.fn(() => deferredRetry.promise),
      };

      const { unmount } = renderBell({
        userId: 'user-retry-unmount',
        notificationSource: source,
      });
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      const retryButton = await screen.findByRole('button', {
        name: '重新嘗試',
      });
      fireEvent.click(retryButton);

      expect(screen.queryByText('載入失敗，請重試')).not.toBeInTheDocument();

      unmount();

      await act(async () => {
        deferredRetry.resolve(MOCK_MIXED_NOTIFICATIONS);
        await deferredRetry.promise;
      });
    });
  });

  describe('Notification Content mappings', () => {
    it('returns template content for unknown notification types as fallback', () => {
      const result = getNotificationContent(
        fromAny({
          id: '99',
          type: 'unknown_type',
          createdAt: new Date().toISOString(),
        })
      );
      expect(result.title).toBe('通知');
      expect(result.body).toBe('您有一則新通知');
    });

    it('returns a safe fallback href for unknown notification types', () => {
      const href = getNotificationHref(
        fromAny({
          id: '99',
          type: 'unknown_type',
          createdAt: new Date().toISOString(),
        })
      );
      expect(href).toBe('/');
    });
  });

  describe('Notification card click and navigation', () => {
    it('renders notification items as links with correct href based on contextual roles', () => {
      renderBell({
        initialNotifications: MOCK_MIXED_NOTIFICATIONS,
        initialStatus: 'success',
      });
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      const newReservationLink = screen.getByText('您有新的預約').closest('a');
      expect(newReservationLink).toHaveAttribute(
        'href',
        '/reservation/mentor?tab=pending'
      );

      const successLink = screen
        .getByText('林導師 已接受您的預約')
        .closest('a');
      expect(successLink).toHaveAttribute(
        'href',
        '/reservation/mentee?tab=upcoming'
      );

      const failedLink = screen
        .getByText('您與 王導師 的預約已被拒絕')
        .closest('a');
      expect(failedLink).toHaveAttribute('href', '/mentor-pool');

      const canceledLink = screen
        .getByText('您與 陳導師 的預約已被取消')
        .closest('a');
      expect(canceledLink).toHaveAttribute('href', '/mentor-pool');

      const upcomingLink = screen
        .getByText('您與 張導師 的預約即將到來')
        .closest('a');
      expect(upcomingLink).toHaveAttribute(
        'href',
        '/reservation/mentee?tab=upcoming'
      );
    });

    it('renders canceled and upcoming notification hrefs correctly for Mentor context', () => {
      renderBell({
        initialStatus: 'success',
        initialNotifications: MOCK_MENTOR_NOTIFICATIONS,
      });
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      const canceledLink = screen
        .getByText('您與 小明 的預約已被取消')
        .closest('a');
      expect(canceledLink).toHaveAttribute(
        'href',
        '/reservation/mentor?tab=history'
      );
      expect(
        screen.getByText('學員已取消此次預約，點擊查看預約紀錄')
      ).toBeInTheDocument();
      expect(
        screen.queryByText('您的預約已被取消，歡迎重新預約')
      ).not.toBeInTheDocument();

      const upcomingLink = screen
        .getByText('您與 小華 的預約即將到來')
        .closest('a');
      expect(upcomingLink).toHaveAttribute(
        'href',
        '/reservation/mentor?tab=upcoming'
      );
    });

    it('renders feedback_received notification with full Mentee name and Mentor history deep-link href (#734)', () => {
      renderBell({
        initialStatus: 'success',
        initialNotifications: [
          {
            id: 'feedback-received-201',
            type: 'feedback_received',
            role: 'mentor',
            menteeName: '王小明',
            reservationId: '201',
            createdAt: new Date().toISOString(),
            unread: true,
          },
        ],
      });
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      const feedbackReceivedLink = screen
        .getByText('您收到新的回饋')
        .closest('a');
      expect(feedbackReceivedLink).toHaveAttribute(
        'href',
        '/reservation/mentor?tab=history&reservationId=201'
      );
      expect(
        screen.getByText('王小明 為您留下了一則會談回饋，前往查看。')
      ).toBeInTheDocument();
    });

    it('marks clicked notification as read via NotificationSource and closes popover on click', async () => {
      const source = createInMemoryNotificationSource(MOCK_MIXED_NOTIFICATIONS);
      const markOneSpy = vi.spyOn(source, 'markOneRead');

      renderBell({
        userId: 'user-click-read',
        notificationSource: source,
      });
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      const title = await screen.findByText('您有新的預約');
      const link = title.closest('a');
      expect(link).toBeInTheDocument();

      fireEvent.click(link!);

      await waitFor(() => {
        expect(markOneSpy).toHaveBeenCalledWith('user-click-read', '1');
      });

      expect(screen.queryByText('通知')).not.toBeInTheDocument();
    });

    it('rolls back an individually clicked notification to unread and shows an error toast when NotificationSource.markOneRead fails', async () => {
      const mixedNotifications: NotificationItem[] = [
        {
          id: 'unread-1',
          type: 'reservation_requested',
          menteeName: '小明',
          createdAt: new Date().toISOString(),
          unread: true,
        },
      ];
      const source = createInMemoryNotificationSource(mixedNotifications);
      const markOneSpy = vi
        .spyOn(source, 'markOneRead')
        .mockRejectedValue(new Error('Network error'));

      renderBell({
        userId: 'user-click-fail',
        notificationSource: source,
      });
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      const title = await screen.findByText('您有新的預約');
      const link = title.closest('a');
      fireEvent.click(link!);

      await waitFor(() => {
        expect(markOneSpy).toHaveBeenCalledWith('user-click-fail', 'unread-1');
      });

      fireEvent.click(button);

      await waitFor(() => {
        const rolledBackTitle = screen.getByText('您有新的預約');
        expect(rolledBackTitle).toHaveClass('font-bold');
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          description: '無法將通知標示為已讀，請稍後再試',
        })
      );

      expect(captureFlowFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          flow: 'notification_mark_all_read',
          step: 'mark_read_click:unread-1',
          message: 'Network error',
        })
      );
    });
  });

  describe('Notification Read Syncing behavior', () => {
    it('clears unread badge when the dropdown opens, while keeping notifications unread', () => {
      renderBell({ unreadCount: 5, initialStatus: 'success' });
      const button = screen.getByRole('button', { name: '開啟通知選單' });

      expect(screen.getByText('5')).toBeInTheDocument();

      fireEvent.click(button);

      expect(screen.queryByText('5')).not.toBeInTheDocument();

      const unreadTitle = screen.getByText('您有新的預約');
      expect(unreadTitle).toHaveClass('font-bold');
    });

    it('marks all notifications as read when "全部標示為已讀" is clicked via NotificationSource.markAllRead', async () => {
      const mixedNotifications: NotificationItem[] = [
        {
          id: 'unread-1',
          type: 'reservation_requested',
          menteeName: '小明',
          createdAt: new Date().toISOString(),
          unread: true,
        },
        {
          id: 'read-2',
          type: 'reservation_success',
          mentorName: '林導師',
          createdAt: new Date().toISOString(),
          unread: false,
        },
      ];
      const source = createInMemoryNotificationSource(mixedNotifications);
      const markAllSpy = vi.spyOn(source, 'markAllRead');

      renderBell({
        userId: 'user-mark-all',
        notificationSource: source,
      });
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      const unreadTitle = await screen.findByText('您有新的預約');
      expect(unreadTitle).toHaveClass('font-bold');

      const readTitle = screen.getByText('林導師 已接受您的預約');
      expect(readTitle).toHaveClass('font-normal');

      const markAllBtn = screen.getByRole('button', {
        name: '全部標示為已讀',
      });
      fireEvent.click(markAllBtn);

      await waitFor(() => {
        expect(unreadTitle).toHaveClass('font-normal');
        expect(unreadTitle).not.toHaveClass('font-bold');
      });

      expect(markAllSpy).toHaveBeenCalledTimes(1);
      expect(markAllSpy).toHaveBeenCalledWith('user-mark-all');
    });

    it('rolls back state to original unread notifications when NotificationSource.markAllRead fails', async () => {
      const mixedNotifications: NotificationItem[] = [
        {
          id: 'unread-1',
          type: 'reservation_requested',
          menteeName: '小明',
          createdAt: new Date().toISOString(),
          unread: true,
        },
      ];
      const deferredMarkAll = createDeferred<void>();
      const source = createInMemoryNotificationSource(mixedNotifications);
      vi.spyOn(source, 'markAllRead').mockImplementation(
        () => deferredMarkAll.promise
      );

      renderBell({
        userId: 'user-mark-all-fail',
        notificationSource: source,
      });

      expect(await screen.findByText('1')).toBeInTheDocument();

      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      const unreadTitle = await screen.findByText('您有新的預約');
      expect(unreadTitle).toHaveClass('font-bold');

      const markAllBtn = screen.getByRole('button', {
        name: '全部標示為已讀',
      });
      fireEvent.click(markAllBtn);

      expect(unreadTitle).toHaveClass('font-normal');

      await act(async () => {
        deferredMarkAll.reject(new Error('Network error'));
        await deferredMarkAll.promise.catch(() => {});
      });

      await waitFor(() => {
        expect(unreadTitle).toHaveClass('font-bold');
        expect(screen.queryByText('1')).not.toBeInTheDocument();
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          description: '無法將全部通知標示為已讀，請稍後再試',
        })
      );

      expect(captureFlowFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          flow: 'notification_mark_all_read',
          step: 'mark_all_read',
          message: 'Network error',
        })
      );
    });

    it('disables "全部標示為已讀" button when there are no unread notifications', () => {
      const readNotifications: NotificationItem[] = [
        {
          id: 'read-1',
          type: 'reservation_requested',
          createdAt: new Date().toISOString(),
          unread: false,
        },
      ];
      renderBell({
        initialStatus: 'success',
        initialNotifications: readNotifications,
      });
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      const markAllBtn = screen.getByRole('button', {
        name: '全部標示為已讀',
      });
      expect(markAllBtn).toBeInTheDocument();
      expect(markAllBtn).toBeDisabled();
    });

    it('displays the unread badge again when unreadCount increases', () => {
      const { rerender } = renderBell({ unreadCount: 5 });
      const button = screen.getByRole('button', { name: '開啟通知選單' });

      expect(screen.getByText('5')).toBeInTheDocument();

      fireEvent.click(button);
      expect(screen.queryByText('5')).not.toBeInTheDocument();

      const notifications6 = getMockNotifications(6);
      rerender(<NotificationBell initialNotifications={notifications6} />);

      expect(screen.getByText('6')).toBeInTheDocument();
    });

    it('keeps the badge hidden when unreadCount decreases', () => {
      const { rerender } = renderBell({ unreadCount: 5 });
      const button = screen.getByRole('button', { name: '開啟通知選單' });

      expect(screen.getByText('5')).toBeInTheDocument();

      fireEvent.click(button);
      expect(screen.queryByText('5')).not.toBeInTheDocument();

      const notifications3 = getMockNotifications(3);
      rerender(<NotificationBell initialNotifications={notifications3} />);

      expect(screen.queryByText('3')).not.toBeInTheDocument();
      expect(screen.queryByText('5')).not.toBeInTheDocument();
    });

    it('persists unreadCount to localStorage and keeps the badge hidden on subsequent mount with the same unreadCount', () => {
      const { unmount } = renderBell({ unreadCount: 5, userId: 'user-123' });
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);
      expect(screen.queryByText('5')).not.toBeInTheDocument();
      expect(localStorage.getItem('notif_seen_unread_count_user-123')).toBe(
        '5'
      );

      unmount();

      renderBell({ unreadCount: 5, userId: 'user-123' });
      expect(screen.queryByText('5')).not.toBeInTheDocument();
    });

    it('displays the badge on subsequent mount if unreadCount increases past the persisted localStorage count', () => {
      const { unmount } = renderBell({ unreadCount: 5, userId: 'user-123' });
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);
      unmount();

      renderBell({ unreadCount: 6, userId: 'user-123' });
      expect(screen.getByText('6')).toBeInTheDocument();
    });

    it('isolates persisted seen counts between different users', () => {
      const { unmount: unmount1 } = renderBell({
        unreadCount: 5,
        userId: 'user-1',
      });
      fireEvent.click(screen.getByRole('button', { name: '開啟通知選單' }));
      unmount1();

      renderBell({ unreadCount: 5, userId: 'user-2' });
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('does NOT reset seenUnreadCount to 0 and keeps localStorage intact when rollback occurs on 全部標示為已讀 failure', async () => {
      const source = createInMemoryNotificationSource(getMockNotifications(1));
      vi.spyOn(source, 'markAllRead').mockRejectedValue(
        new Error('Network error')
      );

      renderBell({
        userId: 'user-123',
        notificationSource: source,
      });

      await screen.findByText('1');
      fireEvent.click(screen.getByRole('button', { name: '開啟通知選單' }));

      await screen.findByText('您有新的預約');
      expect(localStorage.getItem('notif_seen_unread_count_user-123')).toBe(
        '1'
      );

      const markAllBtn = screen.getByRole('button', {
        name: '全部標示為已讀',
      });
      fireEvent.click(markAllBtn);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
        expect(localStorage.getItem('notif_seen_unread_count_user-123')).toBe(
          '1'
        );
      });
    });

    it('handles localStorage blocking / exceptions gracefully without crashing the component', () => {
      const getItemSpy = vi
        .spyOn(Storage.prototype, 'getItem')
        .mockImplementation(() => {
          throw new Error('localStorage is blocked');
        });
      const setItemSpy = vi
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation(() => {
          throw new Error('localStorage is blocked');
        });

      try {
        renderBell({ unreadCount: 5, userId: 'user-123' });

        const badge = screen.getByText('5');
        expect(badge).toBeInTheDocument();

        const button = screen.getByRole('button', { name: '開啟通知選單' });
        fireEvent.click(button);
        expect(screen.queryByText('5')).not.toBeInTheDocument();
      } finally {
        getItemSpy.mockRestore();
        setItemSpy.mockRestore();
      }
    });

    it('handles invalid non-numeric (NaN) data in localStorage gracefully and falls back to 0', () => {
      localStorage.setItem(
        'notif_seen_unread_count_user-123',
        'invalid-non-numeric-value'
      );

      renderBell({ unreadCount: 5, userId: 'user-123' });

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('correctly clamps seenUnreadCount and localStorage when unreadCount decreases', async () => {
      const { rerender } = renderBell({ unreadCount: 5, userId: 'user-123' });
      fireEvent.click(screen.getByRole('button', { name: '開啟通知選單' }));
      expect(localStorage.getItem('notif_seen_unread_count_user-123')).toBe(
        '5'
      );

      const notifications3 = getMockNotifications(3);
      rerender(
        <NotificationBell
          initialNotifications={notifications3}
          userId="user-123"
        />
      );

      await waitFor(() => {
        expect(localStorage.getItem('notif_seen_unread_count_user-123')).toBe(
          '3'
        );
      });
    });

    it('synchronizes seen states across multiple rendered instances on the same page without duplicate bootstrap fetches', async () => {
      const sharedSource = createInMemoryNotificationSource(
        getMockNotifications(5)
      );
      const countSpy = vi.spyOn(sharedSource, 'getUnreadCount');

      const { container: container1 } = renderBell({
        userId: 'user-123',
        notificationSource: sharedSource,
      });
      const { container: container2 } = renderBell({
        userId: 'user-123',
        notificationSource: sharedSource,
      });

      await waitFor(() => {
        expect(screen.queryAllByText('5').length).toBe(2);
      });
      expect(countSpy).toHaveBeenCalledTimes(1);

      const button1 = container1.querySelector(
        'button[aria-label="開啟通知選單"]'
      );
      expect(button1).toBeInTheDocument();
      fireEvent.click(button1!);

      expect(
        container1.querySelector('span[aria-label*="未讀通知"]')
      ).not.toBeInTheDocument();

      await waitFor(() => {
        expect(
          container2.querySelector('span[aria-label*="未讀通知"]')
        ).not.toBeInTheDocument();
      });
    });

    it('keeps cross-tab storage sync working for a surviving instance after another instance unmounts', async () => {
      const { unmount } = renderBell({
        unreadCount: 5,
        userId: 'user-shared-listener',
      });
      renderBell({ unreadCount: 5, userId: 'user-shared-listener' });

      expect(screen.queryAllByText('5').length).toBe(2);

      unmount();

      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'notif_seen_unread_count_user-shared-listener',
            newValue: '5',
          })
        );
      });

      await waitFor(() => {
        expect(screen.queryByText('5')).not.toBeInTheDocument();
      });
    });

    it('synchronizes seen states across different browser tabs via StorageEvent', async () => {
      renderBell({ unreadCount: 5, userId: 'user-123' });

      expect(screen.getByText('5')).toBeInTheDocument();

      fireEvent(
        window,
        new StorageEvent('storage', {
          key: 'notif_seen_unread_count_user-123',
          newValue: '5',
        })
      );

      await waitFor(() => {
        expect(screen.queryByText('5')).not.toBeInTheDocument();
      });
    });

    it('does NOT trigger clamping and overwrite localStorage when in loading status', () => {
      localStorage.setItem('notif_seen_unread_count_user-123', '5');

      renderBell({
        unreadCount: 0,
        initialNotifications: [],
        userId: 'user-123',
        initialStatus: 'loading',
      });

      expect(localStorage.getItem('notif_seen_unread_count_user-123')).toBe(
        '5'
      );
    });
  });

  describe('IntersectionObserver Infinite Scroll Integration', () => {
    it('observes the sentinel on render and disconnects on unmount', async () => {
      const observeSpy = vi.fn();
      const unobserveSpy = vi.fn();
      const disconnectSpy = vi.fn();

      class SpyIntersectionObserver implements IntersectionObserver {
        readonly root: Element | Document | null = null;
        readonly rootMargin = '';
        readonly thresholds: ReadonlyArray<number> = [];
        observe = observeSpy;
        unobserve = unobserveSpy;
        disconnect = disconnectSpy;
        takeRecords(): IntersectionObserverEntry[] {
          return [];
        }
      }
      global.IntersectionObserver = SpyIntersectionObserver;

      const source = createInMemoryNotificationSource(getMockNotifications(25));

      const { unmount } = render(
        <NotificationBell userId="user-123" notificationSource={source} />
      );

      fireEvent.click(screen.getByRole('button', { name: '開啟通知選單' }));

      await screen.findAllByText('您有新的預約');

      expect(observeSpy).toHaveBeenCalled();

      unmount();

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('triggers onLoadMore when IntersectionObserver intersects (isIntersecting)', async () => {
      let observerCallback: IntersectionObserverCallback | null = null;

      class CallbackIntersectionObserver implements IntersectionObserver {
        readonly root: Element | Document | null = null;
        readonly rootMargin = '';
        readonly thresholds: ReadonlyArray<number> = [];
        constructor(callback: IntersectionObserverCallback) {
          observerCallback = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords(): IntersectionObserverEntry[] {
          return [];
        }
      }
      global.IntersectionObserver = CallbackIntersectionObserver;

      const source = createInMemoryNotificationSource(getMockNotifications(25));
      const listSpy = vi.spyOn(source, 'listNotifications');

      render(
        <NotificationBell userId="user-123" notificationSource={source} />
      );

      fireEvent.click(screen.getByRole('button', { name: '開啟通知選單' }));

      await screen.findAllByText('您有新的預約');

      expect(observerCallback).not.toBeNull();
      expect(listSpy).toHaveBeenCalledTimes(1);

      await act(async () => {
        observerCallback?.(
          [fromPartial<IntersectionObserverEntry>({ isIntersecting: true })],
          new CallbackIntersectionObserver(() => {})
        );
      });

      expect(listSpy).toHaveBeenCalledTimes(2);
    });
  });
});
