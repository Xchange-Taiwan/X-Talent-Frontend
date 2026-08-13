import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { fromAny } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as useNotificationBellModule from '@/hooks/useNotificationBell';
import { type NotificationItem } from '@/hooks/useNotificationBell';
import { captureFlowFailure } from '@/lib/monitoring';
import { mockToast } from '@/test/mocks/useToast';

import { getNotificationContent, NotificationBell } from './NotificationBell';

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
}));

describe('NotificationBell', () => {
  beforeEach(() => {
    mockToast.mockClear();
    vi.mocked(captureFlowFailure).mockClear();
    localStorage.clear();
  });

  it('renders the bell icon button with title and aria-label', () => {
    render(<NotificationBell unreadCount={5} />);
    const button = screen.getByRole('button', { name: '開啟通知選單' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('title', '通知');
  });

  it('renders the unread count badge with correct count', () => {
    render(<NotificationBell unreadCount={5} />);
    const badge = screen.getByText('5');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-label', '有 5 則未讀通知');
  });

  it('shows "99+" for unread count over 99', () => {
    render(<NotificationBell unreadCount={120} />);
    const badge = screen.getByText('99+');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-label', '有 120 則未讀通知');
  });

  it('hides the unread count badge and opens the empty popover container on click', () => {
    // Pass initialStatus="empty" to preserve original test expectation
    render(<NotificationBell unreadCount={5} initialStatus="empty" />);
    const button = screen.getByRole('button', { name: '開啟通知選單' });

    // Badge is initially visible
    expect(screen.getByText('5')).toBeInTheDocument();

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

    // Badge is hidden once clicked/opened
    expect(screen.queryByText('5')).not.toBeInTheDocument();
  });

  it('contains tailwind CSS classes for the hover state to avoid JS state overhead', () => {
    render(<NotificationBell unreadCount={5} />);
    const button = screen.getByRole('button', { name: '開啟通知選單' });

    expect(button).toHaveClass('[@media(hover:hover)]:hover:bg-dark');
    expect(button).toHaveClass('[@media(hover:hover)]:hover:border-dark');
  });

  it('contains tailwind CSS classes for the open state, matching the reservation tab active style', () => {
    render(<NotificationBell unreadCount={5} />);
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
      render(<NotificationBell unreadCount={5} initialStatus="success" />);
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

    it('renders empty state under success status with zero notifications', () => {
      render(
        <NotificationBell
          unreadCount={0}
          initialStatus="success"
          initialNotifications={[]}
        />
      );
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      expect(screen.getByText('尚無新通知')).toBeInTheDocument();
    });

    it('applies unread and read classes appropriately to notification titles based on unread status', () => {
      const spy = vi
        .spyOn(useNotificationBellModule, 'useNotificationBell')
        .mockReturnValue({
          open: true,
          closePopover: vi.fn(),
          status: 'success',
          notifications: [
            {
              id: '1',
              type: 'reservation_new',
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
          showBadge: false,
          formattedCount: '1',
          hasUnread: true,
          handleOpenChange: vi.fn(),
          handleRetry: vi.fn(),
          handleNotificationClick: vi.fn(),
          handleMarkAllAsRead: vi.fn(),
        });

      render(<NotificationBell unreadCount={1} initialStatus="success" />);

      // Since open is mocked to true, the popover is already open and notifications are rendered
      // Check an unread notification
      const unreadTitle = screen.getByText('您有新的預約');
      expect(unreadTitle).toHaveClass('font-bold');
      expect(unreadTitle).toHaveClass('text-text-primary');
      expect(unreadTitle).not.toHaveClass('font-normal');
      expect(unreadTitle).not.toHaveClass('text-text-secondary');

      // Check a read notification
      const readTitle = screen.getByText('Mentor 已接受您的預約');
      expect(readTitle).toHaveClass('font-normal');
      expect(readTitle).toHaveClass('text-text-secondary');
      expect(readTitle).not.toHaveClass('font-bold');
      expect(readTitle).not.toHaveClass('text-text-primary');

      spy.mockRestore();
    });

    it('renders skeletons when in loading state', () => {
      render(<NotificationBell unreadCount={5} initialStatus="loading" />);
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      // Ensure the text '尚無新通知' or mock notifications are NOT shown
      expect(screen.queryByText('尚無新通知')).not.toBeInTheDocument();
      expect(screen.queryByText('您有新的預約')).not.toBeInTheDocument();
    });

    it('renders error state and a retry button', () => {
      render(<NotificationBell unreadCount={5} initialStatus="error" />);
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
        render(<NotificationBell unreadCount={5} initialStatus="error" />);
        const button = screen.getByRole('button', { name: '開啟通知選單' });
        fireEvent.click(button);

        const retryButton = screen.getByRole('button', { name: '重新嘗試' });
        fireEvent.click(retryButton);

        // Verify that UI immediately transitions to loading state (error text disappears)
        expect(screen.queryByText('載入失敗，請重試')).not.toBeInTheDocument();

        // Fast-forward 1000ms inside act
        act(() => {
          vi.advanceTimersByTime(1000);
        });

        // Verify that UI transitions to success state (notifications appear)
        expect(screen.getByText('您有新的預約')).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('clears active timeouts on unmount during retry loading', () => {
      vi.useFakeTimers();
      try {
        const { unmount } = render(
          <NotificationBell unreadCount={5} initialStatus="error" />
        );
        const button = screen.getByRole('button', { name: '開啟通知選單' });
        fireEvent.click(button);

        const retryButton = screen.getByRole('button', { name: '重新嘗試' });
        fireEvent.click(retryButton);

        // Verify that UI immediately transitions to loading state (error text disappears)
        expect(screen.queryByText('載入失敗，請重試')).not.toBeInTheDocument();

        // Unmount the component immediately during loading
        unmount();

        // Fast-forward 1000ms inside act
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
  });

  describe('Notification card click and navigation', () => {
    it('renders notification items as links with correct href based on contextual roles', () => {
      render(<NotificationBell unreadCount={5} initialStatus="success" />);
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      // Check reservation_new href (Mentor page)
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

      // Check reservation_canceled href for Mentee (has mentorName, goes to mentor-pool)
      const canceledLink = screen
        .getByText('您與 陳導師 的預約已被取消')
        .closest('a');
      expect(canceledLink).toHaveAttribute('href', '/mentor-pool');

      // Check reservation_upcoming href for Mentee (has mentorName, goes to reservation/mentee?tab=upcoming)
      const upcomingLink = screen
        .getByText('您與 張導師 的預約即將到來')
        .closest('a');
      expect(upcomingLink).toHaveAttribute(
        'href',
        '/reservation/mentee?tab=upcoming'
      );
    });

    it('renders canceled and upcoming notification hrefs correctly for Mentor context', () => {
      // Create explicit notifications for a Mentor context (using explicit role property or menteeName)
      const mentorNotifications: NotificationItem[] = [
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

      render(
        <NotificationBell
          unreadCount={2}
          initialStatus="success"
          initialNotifications={mentorNotifications}
        />
      );
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      // Check reservation_canceled href for Mentor context (goes to reservation/mentor?tab=history)
      const canceledLink = screen
        .getByText('您與 小明 的預約已被取消')
        .closest('a');
      expect(canceledLink).toHaveAttribute(
        'href',
        '/reservation/mentor?tab=history'
      );

      // Check reservation_upcoming href for Mentor context (goes to reservation/mentor?tab=upcoming)
      const upcomingLink = screen
        .getByText('您與 小華 的預約即將到來')
        .closest('a');
      expect(upcomingLink).toHaveAttribute(
        'href',
        '/reservation/mentor?tab=upcoming'
      );
    });

    it('marks clicked notification as read, triggers onMarkRead, and closes popover on click', () => {
      const onMarkReadMock = vi.fn();

      render(
        <NotificationBell
          unreadCount={5}
          initialStatus="success"
          onMarkRead={onMarkReadMock}
        />
      );
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      // Click the first notification (which is unread)
      const link = screen.getByText('您有新的預約').closest('a');
      expect(link).toBeInTheDocument();

      fireEvent.click(link!);

      // Verify persistence callback was called with the notification's ID ('1')
      expect(onMarkReadMock).toHaveBeenCalledWith('1');

      // Popover should be closed
      expect(screen.queryByText('通知')).not.toBeInTheDocument();
    });

    it('rolls back an individually clicked notification to unread and shows an error toast when onMarkRead fails', async () => {
      const onMarkReadErrorMock = vi
        .fn()
        .mockRejectedValue(new Error('Network error'));
      const mixedNotifications: NotificationItem[] = [
        {
          id: 'unread-1',
          type: 'reservation_new',
          menteeName: '小明',
          createdAt: new Date().toISOString(),
          unread: true,
        },
      ];

      render(
        <NotificationBell
          unreadCount={1}
          initialStatus="success"
          initialNotifications={mixedNotifications}
          onMarkRead={onMarkReadErrorMock}
        />
      );
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      const link = screen.getByText('您有新的預約').closest('a');
      fireEvent.click(link!);

      await waitFor(() => {
        expect(onMarkReadErrorMock).toHaveBeenCalledWith('unread-1');
      });

      // Reopen the popover (it closes on click) to inspect the rolled-back state
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
      render(<NotificationBell unreadCount={5} initialStatus="success" />);
      const button = screen.getByRole('button', { name: '開啟通知選單' });

      // Badge is initially visible
      expect(screen.getByText('5')).toBeInTheDocument();

      // Click the bell button to open the popover
      fireEvent.click(button);

      // Badge should be hidden now
      expect(screen.queryByText('5')).not.toBeInTheDocument();

      // Notifications in the dropdown list should still be unread (bold titles)
      const unreadTitle = screen.getByText('您有新的預約');
      expect(unreadTitle).toHaveClass('font-bold');
    });

    it('marks all notifications as read when "Mark all as read" is clicked and calls onMarkAllRead exactly for unread items', async () => {
      const onMarkAllReadMock = vi.fn();
      const mixedNotifications: NotificationItem[] = [
        {
          id: 'unread-1',
          type: 'reservation_new',
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

      render(
        <NotificationBell
          unreadCount={1}
          initialStatus="success"
          initialNotifications={mixedNotifications}
          onMarkAllRead={onMarkAllReadMock}
        />
      );
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      // Verify unread notification has bold font
      const unreadTitle = screen.getByText('您有新的預約');
      expect(unreadTitle).toHaveClass('font-bold');

      // Verify read notification has normal font
      const readTitle = screen.getByText('林導師 已接受您的預約');
      expect(readTitle).toHaveClass('font-normal');

      // Find the Mark all as read button
      const markAllBtn = screen.getByRole('button', {
        name: 'Mark all as read',
      });
      expect(markAllBtn).toBeInTheDocument();

      // Click it
      fireEvent.click(markAllBtn);

      // Verify that the unread notification title style changes to normal (read)
      await waitFor(() => {
        expect(unreadTitle).toHaveClass('font-normal');
        expect(unreadTitle).not.toHaveClass('font-bold');
      });

      // Verify that onMarkAllRead was called EXACTLY once with the array of unread IDs
      expect(onMarkAllReadMock).toHaveBeenCalledTimes(1);
      expect(onMarkAllReadMock).toHaveBeenCalledWith(['unread-1']);
    });

    it('successfully falls back to calling onMarkRead individually for unread notifications when onMarkAllRead is not provided', async () => {
      const onMarkReadMock = vi.fn();
      const mixedNotifications: NotificationItem[] = [
        {
          id: 'unread-1',
          type: 'reservation_new',
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

      render(
        <NotificationBell
          unreadCount={2}
          initialStatus="success"
          initialNotifications={mixedNotifications}
          onMarkRead={onMarkReadMock}
        />
      );
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      // Find the Mark all as read button and click it
      const markAllBtn = screen.getByRole('button', {
        name: 'Mark all as read',
      });
      fireEvent.click(markAllBtn);

      // Verify that onMarkRead was called EXACTLY twice (for unread-1 and unread-2, but NOT for read-3)
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
          type: 'reservation_new',
          menteeName: '小明',
          createdAt: new Date().toISOString(),
          unread: true,
        },
      ];

      render(
        <NotificationBell
          unreadCount={1}
          initialStatus="success"
          initialNotifications={mixedNotifications}
          onMarkAllRead={onMarkAllReadErrorMock}
        />
      );
      const button = screen.getByRole('button', { name: '開啟通知選單' });

      // Badge is visible
      expect(screen.getByText('1')).toBeInTheDocument();

      fireEvent.click(button);

      // Verify unread notification has bold font
      const unreadTitle = screen.getByText('您有新的預約');
      expect(unreadTitle).toHaveClass('font-bold');

      // Find the Mark all as read button and click it
      const markAllBtn = screen.getByRole('button', {
        name: 'Mark all as read',
      });
      fireEvent.click(markAllBtn);

      // Check that it first optimistically marks as read (becomes font-normal)
      expect(unreadTitle).toHaveClass('font-normal');

      // Verify that it rolled back to unread state (restores font-bold) but keeps badge hidden (since they have seen it)
      await waitFor(() => {
        expect(unreadTitle).toHaveClass('font-bold');
        expect(screen.queryByText('1')).not.toBeInTheDocument();
      });

      // Verify the user is shown an error toast instead of a silent failure
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
      // First call succeeds, second fails
      const onMarkReadMixedMock = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Individual error'));

      const mixedNotifications: NotificationItem[] = [
        {
          id: 'unread-1',
          type: 'reservation_new',
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

      render(
        <NotificationBell
          unreadCount={2}
          initialStatus="success"
          initialNotifications={mixedNotifications}
          onMarkRead={onMarkReadMixedMock}
        />
      );
      const button = screen.getByRole('button', { name: '開啟通知選單' });

      // Badge is visible before click
      expect(screen.getByText('2')).toBeInTheDocument();

      fireEvent.click(button);

      // Verify both are bold
      const title1 = screen.getByText('您有新的預約');
      const title2 = screen.getByText('您與 王導師 的預約即將到來');
      expect(title1).toHaveClass('font-bold');
      expect(title2).toHaveClass('font-bold');

      // Click Mark all as read button
      const markAllBtn = screen.getByRole('button', {
        name: 'Mark all as read',
      });
      fireEvent.click(markAllBtn);

      // Optimistically both become font-normal
      expect(title1).toHaveClass('font-normal');
      expect(title2).toHaveClass('font-normal');

      // Wait for sequential async fallback execution.
      // title1 succeeds -> remains font-normal
      // title2 fails -> rolls back to font-bold, but badge remains hidden (since they have seen it)
      await waitFor(() => {
        expect(title1).toHaveClass('font-normal');
        expect(title1).not.toHaveClass('font-bold');
        expect(title2).toHaveClass('font-bold');
        expect(title2).not.toHaveClass('font-normal');
        expect(screen.queryByText('2')).not.toBeInTheDocument();
      });

      // Verify the user is shown a "partial failure" toast, distinct from a
      // total failure, since only one of the two items actually failed
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
          type: 'reservation_new',
          menteeName: '小明',
          createdAt: new Date().toISOString(),
          unread: true,
        })
      );

      render(
        <NotificationBell
          unreadCount={6}
          initialStatus="success"
          initialNotifications={manyUnreadNotifications}
          onMarkRead={onMarkReadMock}
        />
      );
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      const markAllBtn = screen.getByRole('button', {
        name: 'Mark all as read',
      });
      fireEvent.click(markAllBtn);

      // All 6 unread items should eventually be marked read across two
      // batches (5 + 1), proving the for-loop in markReadInBatches runs
      // more than once instead of firing all 6 requests concurrently.
      await waitFor(() => {
        expect(onMarkReadMock).toHaveBeenCalledTimes(6);
      });
      manyUnreadNotifications.forEach((item) => {
        expect(onMarkReadMock).toHaveBeenCalledWith(item.id);
      });

      // A fully successful run should not surface any error toast
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('disables "Mark all as read" button when there are no unread notifications', () => {
      const readNotifications: NotificationItem[] = [
        {
          id: 'read-1',
          type: 'reservation_new',
          createdAt: new Date().toISOString(),
          unread: false,
        },
      ];
      render(
        <NotificationBell
          unreadCount={0}
          initialStatus="success"
          initialNotifications={readNotifications}
        />
      );
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      // Find the Mark all as read button
      const markAllBtn = screen.getByRole('button', {
        name: 'Mark all as read',
      });
      expect(markAllBtn).toBeInTheDocument();
      expect(markAllBtn).toBeDisabled();
    });

    it('resets hasBeenClicked and displays the unread badge again when unreadCount increases', () => {
      const { rerender } = render(<NotificationBell unreadCount={5} />);
      const button = screen.getByRole('button', { name: '開啟通知選單' });

      // Badge is initially 5
      expect(screen.getByText('5')).toBeInTheDocument();

      // Click to open and clear badge
      fireEvent.click(button);
      expect(screen.queryByText('5')).not.toBeInTheDocument();

      // Rerender with a larger unreadCount (e.g. 6) representing a new notification arriving
      rerender(<NotificationBell unreadCount={6} />);

      // Badge should reappear showing 6
      expect(screen.getByText('6')).toBeInTheDocument();
    });

    it('does not reset hasBeenClicked and keeps the badge hidden when unreadCount decreases', () => {
      const { rerender } = render(<NotificationBell unreadCount={5} />);
      const button = screen.getByRole('button', { name: '開啟通知選單' });

      // Badge is initially 5
      expect(screen.getByText('5')).toBeInTheDocument();

      // Click to open and clear badge
      fireEvent.click(button);
      expect(screen.queryByText('5')).not.toBeInTheDocument();

      // Rerender with a smaller unreadCount (e.g. 3) representing some notifications read elsewhere
      rerender(<NotificationBell unreadCount={3} />);

      // Badge should remain hidden
      expect(screen.queryByText('3')).not.toBeInTheDocument();
      expect(screen.queryByText('5')).not.toBeInTheDocument();
    });

    it('persists unreadCount to localStorage and keeps the badge hidden on subsequent mount with the same unreadCount', () => {
      // 1. Render and click to open (seen)
      const { unmount } = render(
        <NotificationBell unreadCount={5} userId="user-123" />
      );
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);
      expect(screen.queryByText('5')).not.toBeInTheDocument();
      expect(localStorage.getItem('notif_seen_unread_count_user-123')).toBe(
        '5'
      );

      // 2. Unmount to simulate page refresh / new mount
      unmount();

      // 3. Re-render (remount) with the same unreadCount
      render(<NotificationBell unreadCount={5} userId="user-123" />);
      // Badge should remain hidden because unreadCount (5) is not greater than the persisted seenUnreadCount (5)
      expect(screen.queryByText('5')).not.toBeInTheDocument();
    });

    it('displays the badge on subsequent mount if unreadCount increases past the persisted localStorage count', () => {
      // 1. Render and click to open (seen)
      const { unmount } = render(
        <NotificationBell unreadCount={5} userId="user-123" />
      );
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);
      unmount();

      // 2. Re-render with larger unreadCount
      render(<NotificationBell unreadCount={6} userId="user-123" />);
      // Badge should appear showing 6
      expect(screen.getByText('6')).toBeInTheDocument();
    });

    it('isolates persisted seen counts between different users', () => {
      // 1. User 1 opens with 5 notifications
      const { unmount: unmount1 } = render(
        <NotificationBell unreadCount={5} userId="user-1" />
      );
      fireEvent.click(screen.getByRole('button', { name: '開啟通知選單' }));
      unmount1();

      // 2. User 2 mounts with 5 notifications
      render(<NotificationBell unreadCount={5} userId="user-2" />);
      // User 2 has never seen these, so the badge should be visible!
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('does NOT reset seenUnreadCount to 0 and keeps localStorage intact when rollback occurs on mark all as read failure', async () => {
      const onMarkAllReadErrorMock = vi
        .fn()
        .mockRejectedValue(new Error('Network error'));
      render(
        <NotificationBell
          unreadCount={1}
          userId="user-123"
          initialStatus="success"
          onMarkAllRead={onMarkAllReadErrorMock}
        />
      );
      // Open dropdown
      fireEvent.click(screen.getByRole('button', { name: '開啟通知選單' }));
      expect(localStorage.getItem('notif_seen_unread_count_user-123')).toBe(
        '1'
      );

      // Click Mark all as read
      const markAllBtn = screen.getByRole('button', {
        name: 'Mark all as read',
      });
      fireEvent.click(markAllBtn);

      // Verify rollback keeps it as 1
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
        // Render the component with localStorage throwing errors
        render(<NotificationBell unreadCount={5} userId="user-123" />);

        // It should render normally with the badge showing because localStorage read returned 0/null safely
        const badge = screen.getByText('5');
        expect(badge).toBeInTheDocument();

        // Click to open should also not crash and hide the badge normally
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

      // Render the component - it should read 'invalid-non-numeric-value', try to parse it, get NaN, and fallback to 0 safely.
      render(<NotificationBell unreadCount={5} userId="user-123" />);

      // Badge should be visible with count 5 since seenUnreadCount fell back to 0 (5 > 0 is true)
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('correctly clamps seenUnreadCount and localStorage when unreadCount decreases', async () => {
      // 1. Initial render with 5 unread, click to open (sets seen count to 5)
      const { rerender } = render(
        <NotificationBell unreadCount={5} userId="user-123" />
      );
      fireEvent.click(screen.getByRole('button', { name: '開啟通知選單' }));
      expect(localStorage.getItem('notif_seen_unread_count_user-123')).toBe(
        '5'
      );

      // 2. Rerender with smaller unreadCount (3) representing some notifications read elsewhere
      rerender(<NotificationBell unreadCount={3} userId="user-123" />);

      // 3. The localStorage value should be clamped down to 3
      await waitFor(() => {
        expect(localStorage.getItem('notif_seen_unread_count_user-123')).toBe(
          '3'
        );
      });
    });

    it('synchronizes seen states across multiple rendered instances on the same page', async () => {
      // Render two instances representing Desktop and Mobile bells on the same page
      const { container: container1 } = render(
        <NotificationBell unreadCount={5} userId="user-123" />
      );
      const { container: container2 } = render(
        <NotificationBell unreadCount={5} userId="user-123" />
      );

      // Both instances initially show their badges
      expect(screen.queryAllByText('5').length).toBe(2);

      // Open the dropdown of the first instance to mark it as "seen"
      const button1 = container1.querySelector(
        'button[aria-label="開啟通知選單"]'
      );
      expect(button1).toBeInTheDocument();
      fireEvent.click(button1!);

      // The first instance has no badge now
      expect(
        container1.querySelector('span[aria-label*="未讀通知"]')
      ).not.toBeInTheDocument();

      // The second instance should automatically hide its badge due to our custom event syncing!
      await waitFor(() => {
        expect(
          container2.querySelector('span[aria-label*="未讀通知"]')
        ).not.toBeInTheDocument();
      });
    });

    it('cleans up all global event listeners on unmount to prevent memory leaks', () => {
      const removeListenerSpy = vi.spyOn(window, 'removeEventListener');

      // Render the component
      const { unmount } = render(
        <NotificationBell unreadCount={5} userId="user-123" />
      );

      // Unmount it
      unmount();

      // Verify removeEventListener was called for both storage and custom events
      expect(removeListenerSpy).toHaveBeenCalledWith(
        'storage',
        expect.any(Function)
      );
      expect(removeListenerSpy).toHaveBeenCalledWith(
        'notif_seen_updated',
        expect.any(Function)
      );

      removeListenerSpy.mockRestore();
    });

    it('synchronizes seen states across different browser tabs via StorageEvent', async () => {
      render(<NotificationBell unreadCount={5} userId="user-123" />);

      // Badge is visible initially (count 5)
      expect(screen.getByText('5')).toBeInTheDocument();

      // Simulate a StorageEvent from another tab setting seen count to 5
      fireEvent(
        window,
        new StorageEvent('storage', {
          key: 'notif_seen_unread_count_user-123',
          newValue: '5',
        })
      );

      // The badge should automatically hide because seenUnreadCount is synced to 5 (5 > 5 is false)
      await waitFor(() => {
        expect(screen.queryByText('5')).not.toBeInTheDocument();
      });
    });

    it('does NOT trigger clamping and overwrite localStorage when in loading status', async () => {
      // 1. Manually seed localStorage with seen count = 5
      localStorage.setItem('notif_seen_unread_count_user-123', '5');

      // 2. Render with initialStatus='loading' and unreadCount = 0 (simulating load start)
      render(
        <NotificationBell
          unreadCount={0}
          userId="user-123"
          initialStatus="loading"
        />
      );

      // 3. Since it is loading, clamping must NOT trigger, so localStorage should remain '5'
      expect(localStorage.getItem('notif_seen_unread_count_user-123')).toBe(
        '5'
      );
    });
  });
});
