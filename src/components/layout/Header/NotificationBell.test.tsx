import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { formatRelativeTime } from '@/lib/dateUtils';

import {
  getNotificationContent,
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

    // Badge is hidden once clicked/opened
    expect(screen.queryByText('5')).not.toBeInTheDocument();
  });

  it('contains tailwind CSS classes for the hover state to avoid JS state overhead', () => {
    render(<NotificationBell unreadCount={5} />);
    const button = screen.getByRole('button', { name: '開啟通知選單' });

    expect(button).toHaveClass('hover:bg-background-hover');
    expect(button).toHaveClass('hover:border-transparent');
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

  describe('Time formatting logic', () => {
    it('correctly calculates relative time', () => {
      const now = new Date();

      // 0 minutes ago (just happened)
      expect(formatRelativeTime(now)).toBe('1 小時');

      // 30 minutes ago (less than 1 hour)
      const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000);
      expect(formatRelativeTime(thirtyMinsAgo)).toBe('1 小時');

      // 1 hour ago
      const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
      expect(formatRelativeTime(oneHourAgo)).toBe('1 小時');

      // 23 hours ago
      const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);
      expect(formatRelativeTime(twentyThreeHoursAgo)).toBe('23 小時');

      // 24 hours ago (exactly 1 day)
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(oneDayAgo)).toBe('1 天');

      // 30 days ago
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(thirtyDaysAgo)).toBe('30 天');

      // Invalid date
      expect(formatRelativeTime('invalid-date-string')).toBe('');
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
});
