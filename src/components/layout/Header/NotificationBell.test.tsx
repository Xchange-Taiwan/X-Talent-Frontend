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

    it('renders empty state under success status with zero notifications', () => {
      render(
        <NotificationBell
          unreadCount={5}
          initialStatus="success"
          initialNotifications={[]}
        />
      );
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

      expect(screen.getByText('尚無新通知')).toBeInTheDocument();
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

    it('transitions back to success state when async onRetry resolves successfully', async () => {
      let resolveRetry: () => void = () => {};
      const onRetryMock = vi.fn().mockImplementation(() => {
        return new Promise<void>((resolve) => {
          resolveRetry = resolve;
        });
      });

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
      let rejectRetry: (reason?: any) => void = () => {};
      const onRetryMock = vi.fn().mockImplementation(() => {
        return new Promise<void>((_, reject) => {
          rejectRetry = reject;
        });
      });

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
      render(<NotificationBell unreadCount={5} initialStatus="error" />);
      const button = screen.getByRole('button', { name: '開啟通知選單' });
      fireEvent.click(button);

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
