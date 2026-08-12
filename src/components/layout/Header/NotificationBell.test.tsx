import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  getNotificationContent,
  getNotificationTargetUrl,
  NotificationBell,
  type NotificationItem,
} from './NotificationBell';

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

    expect(button).toHaveClass(
      '[@media(hover:hover)]:hover:bg-background-hover'
    );
    expect(button).toHaveClass(
      '[@media(hover:hover)]:hover:border-transparent'
    );
  });

  it('contains tailwind CSS classes for the open state, matching the reservation tab active style', () => {
    render(<NotificationBell unreadCount={5} />);
    const button = screen.getByRole('button', { name: '開啟通知選單' });

    expect(button).toHaveClass('data-[state=open]:bg-dark');
    expect(button).toHaveClass('data-[state=open]:border-dark');
    expect(button).toHaveClass('data-[state=open]:text-text-white');

    const bell = button.querySelector('svg');
    expect(bell).not.toBeNull();
    expect(bell).toHaveClass('group-data-[state=open]:fill-current');
    expect(bell).toHaveClass('group-data-[state=open]:text-text-white');
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

    it('triggers onRetry callback and transitions to loading when clicking retry button', () => {
      const onRetryMock = vi.fn();
      render(
        <NotificationBell
          unreadCount={5}
          initialStatus="error"
          onRetry={onRetryMock}
        />
      );
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      const retryButton = screen.getByRole('button', { name: '重新嘗試' });
      fireEvent.click(retryButton);

      // Verify that onRetry callback was called
      expect(onRetryMock).toHaveBeenCalledTimes(1);

      // Verify that UI transitions to loading state (error text disappears)
      expect(screen.queryByText('載入失敗，請重試')).not.toBeInTheDocument();
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

  describe('Notification Card Redirections', () => {
    it('verifies getNotificationTargetUrl mappings for Mentee (isMentor=false)', () => {
      const cases: { type: NotificationItem['type']; expected: string }[] = [
        {
          type: 'reservation_new',
          expected: '/reservation/mentor?tab=pending',
        },
        {
          type: 'reservation_success',
          expected: '/reservation/mentee?tab=upcoming',
        },
        { type: 'reservation_failed', expected: '/mentor-pool' },
        { type: 'reservation_canceled', expected: '/mentor-pool' },
        {
          type: 'reservation_upcoming',
          expected: '/reservation/mentee?tab=upcoming',
        },
      ];

      cases.forEach(({ type, expected }) => {
        const item: NotificationItem = {
          id: 'mock',
          type,
          createdAt: new Date().toISOString(),
        };
        expect(getNotificationTargetUrl(item, false)).toBe(expected);
      });
    });

    it('verifies getNotificationTargetUrl mappings for Mentor (isMentor=true)', () => {
      const cases: { type: NotificationItem['type']; expected: string }[] = [
        {
          type: 'reservation_new',
          expected: '/reservation/mentor?tab=pending',
        },
        {
          type: 'reservation_success',
          expected: '/reservation/mentee?tab=upcoming',
        },
        { type: 'reservation_failed', expected: '/mentor-pool' },
        {
          type: 'reservation_canceled',
          expected: '/reservation/mentor?tab=history',
        },
        {
          type: 'reservation_upcoming',
          expected: '/reservation/mentor?tab=upcoming',
        },
      ];

      cases.forEach(({ type, expected }) => {
        const item: NotificationItem = {
          id: 'mock',
          type,
          createdAt: new Date().toISOString(),
        };
        expect(getNotificationTargetUrl(item, true)).toBe(expected);
      });
    });

    it('closes popover when a notification item is clicked', () => {
      render(<NotificationBell unreadCount={5} initialStatus="success" />);
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      // Check that the popover is open
      expect(screen.getByText('您有新的預約')).toBeInTheDocument();

      // Click on a notification item link
      const linkItem = screen.getByText('您有新的預約').closest('a');
      expect(linkItem).not.toBeNull();
      fireEvent.click(linkItem!);

      // Since isOpen is controlled and set to false, popover content should be hidden
      expect(screen.queryByText('您有新的預約')).not.toBeInTheDocument();
    });

    it('correctly resolves role context for dual-role users based on item fields', () => {
      // Mentee cancelled notification (the other party is a mentor, so mentorName is present)
      // Even if user's global profile state isMentor=true, they should still go to Mentee's mentor-pool
      const itemAsMentee: NotificationItem = {
        id: '1',
        type: 'reservation_canceled',
        mentorName: '林導師',
        createdAt: new Date().toISOString(),
      };
      expect(getNotificationTargetUrl(itemAsMentee, true)).toBe('/mentor-pool');

      // Mentor cancelled notification (the other party is a mentee, so menteeName is present)
      // Even if user's global profile state isMentor=false, they should still go to Mentor's history
      const itemAsMentor: NotificationItem = {
        id: '2',
        type: 'reservation_canceled',
        menteeName: '小明',
        createdAt: new Date().toISOString(),
      };
      expect(getNotificationTargetUrl(itemAsMentor, false)).toBe(
        '/reservation/mentor?tab=history'
      );
    });

    it('shows the red badge again when unreadCount increases (resets hasBeenClicked)', () => {
      const { rerender } = render(<NotificationBell unreadCount={1} />);
      const button = screen.getByRole('button', { name: '開啟通知選單' });

      // Badge is visible with '1'
      expect(screen.getByText('1')).toBeInTheDocument();

      // Click to hide badge (opens popover)
      fireEvent.click(button);
      expect(screen.queryByText('1')).not.toBeInTheDocument();

      // Rerender with larger unreadCount
      rerender(<NotificationBell unreadCount={2} />);

      // Badge should show up again with '2'
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });
});
