import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NotificationBell } from './NotificationBell';
import {
  getNotificationContent,
  type NotificationItem,
} from './notificationUtils';

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

  it('resets clicked state and shows unread badge again when unreadCount increases', () => {
    const { rerender } = render(
      <NotificationBell unreadCount={5} initialStatus="empty" />
    );
    const button = screen.getByRole('button', { name: '開啟通知選單' });

    // Click the bell button to open the popover and hide the badge
    fireEvent.click(button);
    expect(screen.queryByText('5')).not.toBeInTheDocument();

    // Rerender with an increased unreadCount (e.g., 6)
    rerender(<NotificationBell unreadCount={6} initialStatus="empty" />);

    // Assert that the badge correctly reappears with the new count
    const badge = screen.getByText('6');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-label', '有 6 則未讀通知');
  });

  it('keeps unread badge hidden when unreadCount decreases', () => {
    const { rerender } = render(
      <NotificationBell unreadCount={5} initialStatus="empty" />
    );
    const button = screen.getByRole('button', { name: '開啟通知選單' });

    // Click the bell button to open the popover and hide the badge
    fireEvent.click(button);
    expect(screen.queryByText('5')).not.toBeInTheDocument();

    // Rerender with a decreased unreadCount (e.g., 4)
    rerender(<NotificationBell unreadCount={4} initialStatus="empty" />);

    // Assert that the badge stays hidden
    expect(screen.queryByText('4')).not.toBeInTheDocument();
  });

  it('contains tailwind CSS classes for the hover state to avoid JS state overhead', () => {
    render(<NotificationBell unreadCount={5} />);
    const button = screen.getByRole('button', { name: '開啟通知選單' });

    expect(button).toHaveClass('[@media(hover:hover)]:hover:bg-dark');
    expect(button).toHaveClass('[@media(hover:hover)]:hover:border-dark');
    expect(button).toHaveClass('[@media(hover:hover)]:hover:text-text-white');
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

  it('scopes the icon hover/open color change to its own trigger via a named group, not the page-wide auth-state group on <html>', () => {
    render(<NotificationBell unreadCount={5} />);
    const button = screen.getByRole('button', { name: '開啟通知選單' });

    // `<html>` carries an unnamed `group` class for auth-state visibility
    // toggles; the trigger must use a *named* group (`group/bell`) so the
    // icon's hover/open color only reacts to this button being hovered or
    // open, not to the mouse being anywhere else on the page.
    expect(button).toHaveClass('group/bell');
    expect(button).not.toHaveClass('group');

    const bell = button.querySelector('svg');
    expect(bell).toHaveClass(
      '[@media(hover:hover)]:group-hover/bell:fill-current'
    );
    expect(bell).toHaveClass(
      '[@media(hover:hover)]:group-hover/bell:text-text-white'
    );
  });

  describe('Notification Dropdown Rendering states', () => {
    const renderAndOpenBell = (
      props?: Partial<React.ComponentProps<typeof NotificationBell>>
    ) => {
      const result = render(<NotificationBell unreadCount={5} {...props} />);
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);
      return result;
    };

    it('renders all 5 types of notification card contents under success state', () => {
      renderAndOpenBell({ initialStatus: 'success' });

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

      // Relative time strings, per each mock notification's createdAt
      // offset (getDefaultMockNotifications): under-24h renders in hours,
      // 24h-or-more renders in days.
      expect(screen.getByText('1 小時')).toBeInTheDocument();
      expect(screen.getByText('23 小時')).toBeInTheDocument();
      expect(screen.getByText('1 天')).toBeInTheDocument();
      expect(screen.getByText('5 天')).toBeInTheDocument();
      expect(screen.getByText('30 天')).toBeInTheDocument();
    });

    it('renders a sub-1-hour notification clamped to "1 小時", end-to-end through the component', () => {
      renderAndOpenBell({
        initialStatus: 'success',
        initialNotifications: [
          {
            id: 'recent-1',
            type: 'reservation_success',
            mentorName: '林導師',
            createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            unread: true,
          },
        ],
      });

      expect(screen.getByText('1 小時')).toBeInTheDocument();
    });

    it('renders empty state under success status with zero notifications', () => {
      renderAndOpenBell({
        initialStatus: 'success',
        initialNotifications: [],
      });

      expect(screen.getByText('尚無新通知')).toBeInTheDocument();
    });

    it('renders skeletons when in loading state', () => {
      renderAndOpenBell({ initialStatus: 'loading' });

      // Ensure the text '尚無新通知' or mock notifications are NOT shown
      expect(screen.queryByText('尚無新通知')).not.toBeInTheDocument();
      expect(screen.queryByText('您有新的預約')).not.toBeInTheDocument();
    });

    it('renders error state and a retry button', () => {
      renderAndOpenBell({ initialStatus: 'error' });

      expect(screen.getByText('載入失敗，請重試')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: '重新嘗試' })
      ).toBeInTheDocument();
    });

    it('triggers onRetry callback and transitions to loading when clicking retry button', () => {
      const onRetryMock = vi.fn();
      renderAndOpenBell({
        initialStatus: 'error',
        onRetry: onRetryMock,
      });

      const retryButton = screen.getByRole('button', { name: '重新嘗試' });
      fireEvent.click(retryButton);

      // Verify that onRetry callback was called
      expect(onRetryMock).toHaveBeenCalledTimes(1);

      // Verify that UI transitions to loading state (error text disappears)
      expect(screen.queryByText('載入失敗，請重試')).not.toBeInTheDocument();
    });

    it('transitions back to success state when async onRetry resolves successfully', async () => {
      let resolveRetry: () => void = () => {};
      const onRetryMock = vi.fn().mockImplementation(() => {
        return new Promise<void>((resolve) => {
          resolveRetry = resolve;
        });
      });

      renderAndOpenBell({
        initialStatus: 'error',
        onRetry: onRetryMock,
      });

      const retryButton = screen.getByRole('button', { name: '重新嘗試' });
      fireEvent.click(retryButton);

      // Verify that UI transitions to loading state
      expect(screen.queryByText('載入失敗，請重試')).not.toBeInTheDocument();

      // Resolve the Promise
      await act(async () => {
        resolveRetry();
      });

      // Verify that UI transitions back to success state (mock notifications rendered)
      expect(screen.getByText('您有新的預約')).toBeInTheDocument();
    });

    it('transitions back to error state when async onRetry rejects', async () => {
      let rejectRetry: (reason?: unknown) => void = () => {};
      const onRetryMock = vi.fn().mockImplementation(() => {
        return new Promise<void>((_, reject) => {
          rejectRetry = reject;
        });
      });

      renderAndOpenBell({
        initialStatus: 'error',
        onRetry: onRetryMock,
      });

      const retryButton = screen.getByRole('button', { name: '重新嘗試' });
      fireEvent.click(retryButton);

      // Verify that UI transitions to loading state
      expect(screen.queryByText('載入失敗，請重試')).not.toBeInTheDocument();

      // Reject the Promise
      await act(async () => {
        rejectRetry(new Error('fail'));
      });

      // Verify that UI transitions back to error state
      expect(screen.getByText('載入失敗，請重試')).toBeInTheDocument();
    });

    it('uses default setTimeout fallback to transition to success after 1000ms when onRetry is omitted', async () => {
      vi.useFakeTimers();
      renderAndOpenBell({ initialStatus: 'error' });

      const retryButton = screen.getByRole('button', { name: '重新嘗試' });

      // Click retry
      fireEvent.click(retryButton);

      // Verify that UI is in loading state
      expect(screen.queryByText('載入失敗，請重試')).not.toBeInTheDocument();

      // Fast-forward 1000ms
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Verify that UI is back in success state showing notifications
      expect(screen.getByText('您有新的預約')).toBeInTheDocument();

      vi.useRealTimers();
    });

    it('marks all notifications as read when clicking "全部標為已讀", hiding the button and unread dots', () => {
      renderAndOpenBell({ initialStatus: 'success' });

      // Popover content renders into a portal appended to document.body, so
      // the unread dots must be queried from `document`, not RTL's `container`.
      // The default mock data has 2 unread notifications, each showing an
      // unread dot indicator next to its title.
      expect(
        screen.getByRole('button', { name: '全部標為已讀' })
      ).toBeInTheDocument();
      expect(document.querySelectorAll('.bg-brand-500')).toHaveLength(2);

      fireEvent.click(screen.getByRole('button', { name: '全部標為已讀' }));

      // Once nothing is unread, the button and every dot disappear.
      expect(
        screen.queryByRole('button', { name: '全部標為已讀' })
      ).not.toBeInTheDocument();
      expect(document.querySelectorAll('.bg-brand-500')).toHaveLength(0);
    });

    it('calls onMarkAllRead so a caller-supplied unread count can stay in sync', () => {
      const onMarkAllReadMock = vi.fn();
      renderAndOpenBell({
        initialStatus: 'success',
        onMarkAllRead: onMarkAllReadMock,
      });

      fireEvent.click(screen.getByRole('button', { name: '全部標為已讀' }));

      expect(onMarkAllReadMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Notification Content mappings', () => {
    it('returns template content for unknown notification types as fallback', () => {
      const result = getNotificationContent({
        id: '99',
        type: 'unknown_type' as unknown as NotificationItem['type'],
        createdAt: new Date().toISOString(),
      });
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

      // Verify unread count dot exists
      expect(document.querySelectorAll('.bg-brand-500')).toHaveLength(2);

      // Click the first notification (which is unread)
      const link = screen.getByText('您有新的預約').closest('a');
      expect(link).toBeInTheDocument();

      fireEvent.click(link!);

      // Verify persistence callback was called
      expect(onMarkReadMock).toHaveBeenCalledWith('1');

      // Popover should be closed
      expect(screen.queryByText('通知')).not.toBeInTheDocument();

      // Open popover again to verify the unread dot is gone!
      fireEvent.click(button);
      expect(screen.getByText('通知')).toBeInTheDocument();
      // The first item is now read, so only 1 unread dot remains!
      expect(document.querySelectorAll('.bg-brand-500')).toHaveLength(1);
    });
  });
});
