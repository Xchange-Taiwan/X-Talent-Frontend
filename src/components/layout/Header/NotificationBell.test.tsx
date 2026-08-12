import { act, fireEvent, render, screen } from '@testing-library/react';
import { fromAny } from '@total-typescript/shoehorn';
import { describe, expect, it, vi } from 'vitest';

import * as useNotificationBellModule from '@/hooks/useNotificationBell';
import { type NotificationItem } from '@/hooks/useNotificationBell';

import { getNotificationContent, NotificationBell } from './NotificationBell';

describe('NotificationBell', () => {
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
    expect(popoverContent).toHaveClass('max-w-[calc(100vw-32px)]');

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

    it('marks all notifications as read when "Mark all as read" is clicked and calls onMarkAllRead exactly for unread items', () => {
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
      expect(unreadTitle).toHaveClass('font-normal');
      expect(unreadTitle).not.toHaveClass('font-bold');

      // Verify that onMarkAllRead was called EXACTLY once with the array of unread IDs
      expect(onMarkAllReadMock).toHaveBeenCalledTimes(1);
      expect(onMarkAllReadMock).toHaveBeenCalledWith(['unread-1']);
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
  });
});
