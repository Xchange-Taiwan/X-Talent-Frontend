import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { fromAny } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as useNotificationCenterModule from '@/hooks/useNotificationCenter';
import { type NotificationItem } from '@/hooks/useNotificationCenter';
import { captureFlowFailure } from '@/lib/monitoring';
import { resetNotificationStore } from '@/stores/notificationStore';
import { mockToast } from '@/test/mocks/useToast';

import { getNotificationContent, NotificationBell } from './NotificationBell';
import { getNotificationHref } from './notificationUtils';

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
}));

// Uses src/services/notifications/__mocks__/notificationService.ts
vi.mock('@/services/notifications/notificationService');

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
    mentorName: `林導師`,
    createdAt: new Date().toISOString(),
    unread: true,
  }));
}

function renderBell(
  props: Partial<React.ComponentProps<typeof NotificationBell>> & {
    unreadCount?: number;
  } = {}
) {
  const { unreadCount = 5, initialNotifications, ...rest } = props;
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
    global.IntersectionObserver = class IntersectionObserver {
      readonly root: Element | null = null;
      readonly rootMargin: string = '';
      readonly thresholds: ReadonlyArray<number> = [];
      disconnect() {}
      observe() {}
      takeRecords() {
        return [];
      }
      unobserve() {}
    } as unknown as typeof IntersectionObserver;
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

    // Click the bell button to open the popover
    fireEvent.click(button);

    // Popover content should be visible
    expect(screen.getByText('尚無新通知')).toBeInTheDocument();

    const popoverContent = screen
      .getByText('尚無新通知')
      .closest('[class*="max-w-"]');
    expect(popoverContent).toBeInTheDocument();
    expect(popoverContent).toHaveClass('max-w-[min(300px,calc(100vw-32px))]');
    expect(popoverContent).toHaveClass('lg:max-w-[calc(100vw-32px)]');
  });

  it('contains tailwind CSS classes for the hover state to avoid JS state overhead', () => {
    renderBell({ unreadCount: 5 });
    const button = screen.getByRole('button', { name: '開啟通知選單' });

    expect(button).toHaveClass('[@media(hover:hover)]:hover:bg-dark');
    expect(button).toHaveClass('[@media(hover:hover)]:hover:border-dark');
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

      // Check header
      expect(screen.getByText('通知')).toBeInTheDocument();

      // a. 預約通知
      expect(screen.getByText('您有新的預約')).toBeInTheDocument();
      expect(
        screen.getByText('小明 與您提出預約需求，請前往接受預約')
      ).toBeInTheDocument();

      // b. 預約成功通知
      expect(screen.getByText('林導師 已接受您的預約')).toBeInTheDocument();
      expect(screen.getByText('前往查看您的預約詳情')).toBeInTheDocument();

      // c. 預約失敗通知
      expect(
        screen.getByText('您與 王導師 的預約已被拒絕')
      ).toBeInTheDocument();
      expect(
        screen.getByText('您的預約已被拒絕，歡迎重新預約')
      ).toBeInTheDocument();

      // d. 預約取消通知
      expect(
        screen.getByText('您與 陳導師 的預約已被取消')
      ).toBeInTheDocument();

      // e. 預約即將到來通知
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

      // Falls back to the generic template content rather than crashing on undefined.
      // '通知' also matches the popover header, so assert on the fallback body text,
      // which is unique to the default-case content.
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
        .mockReturnValue({
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
        } as unknown as ReturnType<
          typeof useNotificationCenterModule.useNotificationCenter
        >);

      renderBell({ initialStatus: 'success' });

      // Check an unread notification
      const unreadTitle = screen.getByText('您有新的預約');
      expect(unreadTitle).toHaveClass('font-bold');
      expect(unreadTitle).toHaveClass('text-text-primary');

      // Check a read notification
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
      expect(
        screen.getByRole('button', { name: '重新嘗試' })
      ).toBeInTheDocument();
    });

    it('transitions to loading and then success when clicking retry button', () => {
      vi.useFakeTimers();
      try {
        renderBell({ unreadCount: 5, initialStatus: 'error' });
        const button = screen.getByRole('button', { name: '開啟通知選單' });
        fireEvent.click(button);

        const retryButton = screen.getByRole('button', { name: '重新嘗試' });
        fireEvent.click(retryButton);

        expect(screen.queryByText('載入失敗，請重試')).not.toBeInTheDocument();

        act(() => {
          vi.advanceTimersByTime(1000);
        });

        expect(screen.getByText('您有新的預約')).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('clears active timeouts on unmount during retry loading', () => {
      vi.useFakeTimers();
      try {
        const { unmount } = renderBell({
          unreadCount: 5,
          initialStatus: 'error',
        });
        const button = screen.getByRole('button', { name: '開啟通知選單' });
        fireEvent.click(button);

        const retryButton = screen.getByRole('button', { name: '重新嘗試' });
        fireEvent.click(retryButton);

        expect(screen.queryByText('載入失敗，請重試')).not.toBeInTheDocument();

        unmount();

        act(() => {
          vi.advanceTimersByTime(1000);
        });
      } finally {
        vi.useRealTimers();
      }
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

      // Check reservation_requested href (Mentor page)
      const newReservationLink = screen.getByText('您有新的預約').closest('a');
      expect(newReservationLink).toHaveAttribute(
        'href',
        '/reservation/mentor?tab=pending'
      );

      // Check reservation_success href
      const successLink = screen
        .getByText('林導師 已接受您的預約')
        .closest('a');
      expect(successLink).toHaveAttribute(
        'href',
        '/reservation/mentee?tab=upcoming'
      );

      // Check reservation_failed href
      const failedLink = screen
        .getByText('您與 王導師 的預約已被拒絕')
        .closest('a');
      expect(failedLink).toHaveAttribute('href', '/mentor-pool');

      // Check reservation_canceled href for Mentee
      const canceledLink = screen
        .getByText('您與 陳導師 的預約已被取消')
        .closest('a');
      expect(canceledLink).toHaveAttribute('href', '/mentor-pool');

      // Check reservation_upcoming href for Mentee
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

      // Check reservation_canceled href for Mentor context
      const canceledLink = screen
        .getByText('您與 小明 的預約已被取消')
        .closest('a');
      expect(canceledLink).toHaveAttribute(
        'href',
        '/reservation/mentor?tab=history'
      );

      // Check reservation_upcoming href for Mentor context
      const upcomingLink = screen
        .getByText('您與 小華 的預約即將到來')
        .closest('a');
      expect(upcomingLink).toHaveAttribute(
        'href',
        '/reservation/mentor?tab=upcoming'
      );
    });

    it('marks clicked notification as read, triggers onMarkRead, and closes popover on click', async () => {
      const onMarkReadMock = vi.fn().mockResolvedValue(undefined);

      renderBell({
        initialStatus: 'success',
        onMarkRead: onMarkReadMock,
      });
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      // Click the first notification (which is unread)
      const link = screen.getByText('您有新的預約').closest('a');
      expect(link).toBeInTheDocument();

      fireEvent.click(link!);

      await waitFor(() => {
        expect(onMarkReadMock).toHaveBeenCalledWith('1');
      });

      expect(screen.queryByText('通知')).not.toBeInTheDocument();
    });

    it('rolls back an individually clicked notification to unread and shows an error toast when onMarkRead fails', async () => {
      const onMarkReadErrorMock = vi
        .fn()
        .mockRejectedValue(new Error('Network error'));
      const mixedNotifications: NotificationItem[] = [
        {
          id: 'unread-1',
          type: 'reservation_requested',
          menteeName: '小明',
          createdAt: new Date().toISOString(),
          unread: true,
        },
      ];

      renderBell({
        initialStatus: 'success',
        initialNotifications: mixedNotifications,
        onMarkRead: onMarkReadErrorMock,
      });
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      const link = screen.getByText('您有新的預約').closest('a');
      fireEvent.click(link!);

      await waitFor(() => {
        expect(onMarkReadErrorMock).toHaveBeenCalledWith('unread-1');
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

    it('marks all notifications as read when "Mark all as read" is clicked and calls onMarkAllRead exactly for unread items', async () => {
      const onMarkAllReadMock = vi.fn();
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

      renderBell({
        initialStatus: 'success',
        initialNotifications: mixedNotifications,
        onMarkAllRead: onMarkAllReadMock,
      });
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      const unreadTitle = screen.getByText('您有新的預約');
      expect(unreadTitle).toHaveClass('font-bold');

      const readTitle = screen.getByText('林導師 已接受您的預約');
      expect(readTitle).toHaveClass('font-normal');

      const markAllBtn = screen.getByRole('button', {
        name: 'Mark all as read',
      });
      expect(markAllBtn).toBeInTheDocument();

      fireEvent.click(markAllBtn);

      await waitFor(() => {
        expect(unreadTitle).toHaveClass('font-normal');
        expect(unreadTitle).not.toHaveClass('font-bold');
      });

      expect(onMarkAllReadMock).toHaveBeenCalledTimes(1);
      expect(onMarkAllReadMock).toHaveBeenCalledWith(['unread-1']);
    });

    it('successfully falls back to calling onMarkRead individually for unread notifications when onMarkAllRead is not provided', async () => {
      const onMarkReadMock = vi.fn();
      const mixedNotifications: NotificationItem[] = [
        {
          id: 'unread-1',
          type: 'reservation_requested',
          menteeName: '小明',
          createdAt: new Date().toISOString(),
          unread: true,
        },
        {
          id: 'unread-2',
          type: 'reservation_upcoming',
          mentorName: '王導師',
          createdAt: new Date().toISOString(),
          unread: true,
        },
        {
          id: 'read-3',
          type: 'reservation_success',
          mentorName: '林導師',
          createdAt: new Date().toISOString(),
          unread: false,
        },
      ];

      renderBell({
        initialStatus: 'success',
        initialNotifications: mixedNotifications,
        onMarkRead: onMarkReadMock,
      });
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      const markAllBtn = screen.getByRole('button', {
        name: 'Mark all as read',
      });
      fireEvent.click(markAllBtn);

      await waitFor(() => {
        expect(onMarkReadMock).toHaveBeenCalledTimes(2);
      });
      expect(onMarkReadMock).toHaveBeenCalledWith('unread-1');
      expect(onMarkReadMock).toHaveBeenCalledWith('unread-2');
    });

    it('rolls back state to original unread notifications and restores the unread badge when onMarkAllRead API call fails', async () => {
      const onMarkAllReadErrorMock = vi
        .fn()
        .mockRejectedValue(new Error('Network error'));
      const mixedNotifications: NotificationItem[] = [
        {
          id: 'unread-1',
          type: 'reservation_requested',
          menteeName: '小明',
          createdAt: new Date().toISOString(),
          unread: true,
        },
      ];

      renderBell({
        initialStatus: 'success',
        initialNotifications: mixedNotifications,
        onMarkAllRead: onMarkAllReadErrorMock,
      });
      const button = screen.getByRole('button', { name: '開啟通知選單' });

      expect(screen.getByText('1')).toBeInTheDocument();

      fireEvent.click(button);

      const unreadTitle = screen.getByText('您有新的預約');
      expect(unreadTitle).toHaveClass('font-bold');

      const markAllBtn = screen.getByRole('button', {
        name: 'Mark all as read',
      });
      fireEvent.click(markAllBtn);

      expect(unreadTitle).toHaveClass('font-normal');

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

    it('rolls back ONLY the failed notification state while successfully updating others during sequential onMarkRead fallback failure', async () => {
      const onMarkReadMixedMock = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Individual error'));

      const mixedNotifications: NotificationItem[] = [
        {
          id: 'unread-1',
          type: 'reservation_requested',
          menteeName: '小明',
          createdAt: new Date().toISOString(),
          unread: true,
        },
        {
          id: 'unread-2',
          type: 'reservation_upcoming',
          mentorName: '王導師',
          createdAt: new Date().toISOString(),
          unread: true,
        },
      ];

      renderBell({
        initialStatus: 'success',
        initialNotifications: mixedNotifications,
        onMarkRead: onMarkReadMixedMock,
      });
      const button = screen.getByRole('button', { name: '開啟通知選單' });

      expect(screen.getByText('2')).toBeInTheDocument();

      fireEvent.click(button);

      const title1 = screen.getByText('您有新的預約');
      const title2 = screen.getByText('您與 王導師 的預約即將到來');
      expect(title1).toHaveClass('font-bold');
      expect(title2).toHaveClass('font-bold');

      const markAllBtn = screen.getByRole('button', {
        name: 'Mark all as read',
      });
      fireEvent.click(markAllBtn);

      expect(title1).toHaveClass('font-normal');
      expect(title2).toHaveClass('font-normal');

      await waitFor(() => {
        expect(title1).toHaveClass('font-normal');
        expect(title1).not.toHaveClass('font-bold');
        expect(title2).toHaveClass('font-bold');
        expect(title2).not.toHaveClass('font-normal');
        expect(screen.queryByText('2')).not.toBeInTheDocument();
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          description: '部分通知標示為已讀失敗，請稍後再試',
        })
      );

      expect(captureFlowFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          flow: 'notification_mark_all_read',
          step: 'mark_read_fallback:unread-2',
          message: 'Individual error',
        })
      );
    });

    it('processes onMarkRead fallback calls in batches of 5 when there are more unread notifications than the batch size', async () => {
      const onMarkReadMock = vi.fn().mockResolvedValue(undefined);
      const manyUnreadNotifications: NotificationItem[] = Array.from(
        { length: 6 },
        (_, i) => ({
          id: `unread-${i}`,
          type: 'reservation_requested',
          menteeName: '小明',
          createdAt: new Date().toISOString(),
          unread: true,
        })
      );

      renderBell({
        initialStatus: 'success',
        initialNotifications: manyUnreadNotifications,
        onMarkRead: onMarkReadMock,
      });
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      const markAllBtn = screen.getByRole('button', {
        name: 'Mark all as read',
      });
      fireEvent.click(markAllBtn);

      await waitFor(() => {
        expect(onMarkReadMock).toHaveBeenCalledTimes(6);
      });
      manyUnreadNotifications.forEach((item) => {
        expect(onMarkReadMock).toHaveBeenCalledWith(item.id);
      });

      expect(mockToast).not.toHaveBeenCalled();
    });

    it('disables "Mark all as read" button when there are no unread notifications', () => {
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
        name: 'Mark all as read',
      });
      expect(markAllBtn).toBeInTheDocument();
      expect(markAllBtn).toBeDisabled();
    });

    it('resets hasBeenClicked and displays the unread badge again when unreadCount increases', () => {
      const { rerender } = renderBell({ unreadCount: 5 });
      const button = screen.getByRole('button', { name: '開啟通知選單' });

      expect(screen.getByText('5')).toBeInTheDocument();

      fireEvent.click(button);
      expect(screen.queryByText('5')).not.toBeInTheDocument();

      const notifications6 = getMockNotifications(6);
      rerender(<NotificationBell initialNotifications={notifications6} />);

      expect(screen.getByText('6')).toBeInTheDocument();
    });

    it('does not reset hasBeenClicked and keeps the badge hidden when unreadCount decreases', () => {
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

    it('does NOT reset seenUnreadCount to 0 and keeps localStorage intact when rollback occurs on mark all as read failure', async () => {
      const onMarkAllReadErrorMock = vi
        .fn()
        .mockRejectedValue(new Error('Network error'));
      renderBell({
        unreadCount: 1,
        userId: 'user-123',
        initialStatus: 'success',
        onMarkAllRead: onMarkAllReadErrorMock,
      });
      fireEvent.click(screen.getByRole('button', { name: '開啟通知選單' }));
      expect(localStorage.getItem('notif_seen_unread_count_user-123')).toBe(
        '1'
      );

      const markAllBtn = screen.getByRole('button', {
        name: 'Mark all as read',
      });
      fireEvent.click(markAllBtn);

      await waitFor(() => {
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

    it('synchronizes seen states across multiple rendered instances on the same page', async () => {
      const { container: container1 } = renderBell({
        unreadCount: 5,
        userId: 'user-123',
      });
      const { container: container2 } = renderBell({
        unreadCount: 5,
        userId: 'user-123',
      });

      expect(screen.queryAllByText('5').length).toBe(2);

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

      // The 'storage' listener is store-owned (a single, shared listener),
      // not registered per Hook instance, so unmounting one instance must
      // not break sync for the instance that remains mounted.
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

    it('does NOT trigger clamping and overwrite localStorage when in loading status', async () => {
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

      global.IntersectionObserver = class IntersectionObserver {
        readonly root = null;
        readonly rootMargin = '';
        readonly thresholds = [];
        observe = observeSpy;
        unobserve = unobserveSpy;
        disconnect = disconnectSpy;
        takeRecords() {
          return [];
        }
      } as unknown as typeof IntersectionObserver;

      const { unmount } = render(<NotificationBell userId="user-123" />);

      // Click to open popover so NotificationList is mounted and observer is created
      fireEvent.click(screen.getByRole('button', { name: '開啟通知選單' }));

      // Wait for service items to load and render in success state
      await screen.findAllByText('您有新的預約');

      expect(observeSpy).toHaveBeenCalled();

      // Unmount the component to trigger cleanup
      unmount();

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('triggers onLoadMore when IntersectionObserver intersects (isIntersecting)', async () => {
      let observerCallback:
        ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;

      global.IntersectionObserver = class IntersectionObserver {
        readonly root = null;
        readonly rootMargin = '';
        readonly thresholds = [];
        constructor(
          callback: (entries: Array<{ isIntersecting: boolean }>) => void
        ) {
          observerCallback = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      } as unknown as typeof IntersectionObserver;

      const mockService = await import('@/mocks/mockNotificationService');
      const listSpy = vi.spyOn(mockService, 'listNotifications');

      render(<NotificationBell userId="user-123" />);

      // Click to open popover so NotificationList is mounted and observer is created
      fireEvent.click(screen.getByRole('button', { name: '開啟通知選單' }));

      // Wait for service items to load in success state
      await screen.findAllByText('您有新的預約');

      expect(observerCallback).toBeDefined();
      expect(listSpy).toHaveBeenCalledTimes(1);

      // Trigger the intersection observer callback manually
      await act(async () => {
        if (observerCallback) {
          observerCallback([{ isIntersecting: true }]);
        }
      });

      // It should trigger loadMore, resulting in listNotifications being called again!
      expect(listSpy).toHaveBeenCalledTimes(2);

      listSpy.mockRestore();
    });
  });
});
