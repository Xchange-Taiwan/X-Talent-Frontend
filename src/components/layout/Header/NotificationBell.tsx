'use client';

import { AlertCircle, Bell } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import {
  type NotificationItem,
  useNotificationCenter,
} from '@/hooks/useNotificationCenter';
import { useScrollThumb } from '@/hooks/useScrollThumb';
import { formatRelativeTime } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

import { getNotificationHref } from './notificationUtils';

export type NotificationBellProps = {
  /**
   * Optional user ID for per-user persistent tracking in localStorage.
   */
  userId?: string;
  /**
   * Optional custom classes for the trigger button (e.g. for responsive RWD displays).
   */
  className?: string;
  /**
   * Initial display status of the notification center dropdown.
   * @default 'success'
   */
  initialStatus?: 'loading' | 'error' | 'empty' | 'success';
  /**
   * Initial list of notifications. If omitted, will default to mock notifications.
   */
  initialNotifications?: NotificationItem[];
  /**
   * Optional callback fired when a single notification card is clicked and marked as read.
   */
  onMarkRead?: (id: string) => void | Promise<void>;
  /**
   * Optional callback fired when all notifications are marked as read at once.
   */
  onMarkAllRead?: (ids: string[]) => void | Promise<void>;
};

/**
 * Returns content templates (title, body) for notification items.
 */
export function getNotificationContent(item: NotificationItem) {
  switch (item.type) {
    case 'reservation_new':
      return {
        title: '您有新的預約',
        body: `${item.menteeName || 'Mentee'} 與您提出預約需求，請前往接受預約`,
      };
    case 'reservation_success':
      return {
        title: `${item.mentorName || 'Mentor'} 已接受您的預約`,
        body: '前往查看您的預約詳情',
      };
    case 'reservation_failed':
      return {
        title: `您與 ${item.mentorName || 'Mentor'} 的預約已被拒絕`,
        body: '您的預約已被拒絕，歡迎重新預約',
      };
    case 'reservation_canceled': {
      const name = item.mentorName || item.menteeName || '導師';
      return {
        title: `您與 ${name} 的預約已被取消`,
        body: '您的預約已被取消，歡迎重新預約',
      };
    }
    case 'reservation_upcoming': {
      const name = item.mentorName || item.menteeName || '導師';
      return {
        title: `您與 ${name} 的預約即將到來`,
        body: `您 24 小時後有與 ${name} 的會議，請準時上線`,
      };
    }
    default:
      return {
        title: '通知',
        body: '您有一則新通知',
      };
  }
}

type NotificationListProps = {
  notifications: NotificationItem[];
  scrollRefCallback: React.RefCallback<HTMLDivElement>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onItemClick: (id: string) => void;
  onNavigate: () => void;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: (isRetry?: boolean) => void | Promise<void>;
  hasLoadMoreError?: boolean;
};

/**
 * Memoized so scroll-driven thumb position updates in the parent don't
 * force this list (and its per-item `getNotificationContent` /
 * `getNotificationHref` calls) to re-render on every frame.
 * Uses custom useIntersectionObserver hook with a sentinel element for performance.
 */
const NotificationList = React.memo(function NotificationList({
  notifications,
  scrollRefCallback,
  onMouseEnter,
  onMouseLeave,
  onItemClick,
  onNavigate,
  isLoadingMore,
  hasMore,
  onLoadMore,
  hasLoadMoreError,
}: NotificationListProps) {
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  // Trigger loading next page of notifications
  const handleIntersect = React.useCallback(() => {
    if (onLoadMore) {
      void onLoadMore(false);
    }
  }, [onLoadMore]);

  // Use reusable custom IntersectionObserver hook
  useIntersectionObserver(sentinelRef, handleIntersect, {
    enabled: !!hasMore && !isLoadingMore && !hasLoadMoreError,
    threshold: 0.1,
  });

  return (
    <div
      ref={scrollRefCallback}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="flex max-h-[360px] [scrollbar-width:none] flex-col overflow-y-auto [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex flex-col divide-y divide-background-border">
        {notifications.map((item) => {
          const { title, body } = getNotificationContent(item);
          const href = getNotificationHref(item);
          return (
            <Link
              key={item.id}
              href={href}
              onClick={() => {
                onItemClick(item.id);
                onNavigate();
              }}
              className="flex items-start gap-2.5 px-5 py-3 transition-colors hover:no-underline [@media(hover:hover)]:hover:bg-background-hover"
            >
              <span className="mt-1.5 flex size-4 shrink-0 items-center justify-center">
                {item.unread && (
                  <span
                    className="size-2 rounded-full bg-brand-500"
                    aria-hidden="true"
                  />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'mb-1 text-sm leading-tight break-words',
                    item.unread
                      ? 'font-bold text-text-primary'
                      : 'font-normal text-text-secondary'
                  )}
                >
                  {title}
                </p>
                <p className="mb-1.5 text-xs leading-normal break-words text-text-secondary">
                  {body}
                </p>
                <span className="text-11 leading-none text-text-tertiary">
                  {formatRelativeTime(item.createdAt)}
                </span>
              </div>
            </Link>
          );
        })}

        {hasLoadMoreError ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-4 text-center">
            <span className="text-xs text-text-secondary">載入失敗</span>
            <button
              type="button"
              onClick={() => onLoadMore && onLoadMore(true)}
              className="text-xs font-semibold text-brand-500 transition-colors outline-none hover:text-brand-600 hover:underline"
            >
              點擊重試
            </button>
          </div>
        ) : (
          isLoadingMore && (
            <div className="flex items-center justify-center py-4">
              <span className="size-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          )
        )}

        {/* Sentinel element to trigger next page load cleanly when scrolled into view */}
        <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
      </div>
    </div>
  );
});

export const NotificationBell = React.memo(function NotificationBell({
  userId,
  className,
  initialStatus = 'success',
  initialNotifications,
  onMarkRead,
  onMarkAllRead,
}: NotificationBellProps): JSX.Element {
  const {
    open,
    status,
    items: notifications,
    badgeCount,
    showBadge,
    formattedCount,
    hasUnread,
    onOpenChange,
    closeCenter: closePopover,
    markRead: handleNotificationClick,
    markAllRead: handleMarkAllAsRead,
    handleRetry,
    isLoadingMore,
    hasMore,
    loadMore,
    hasLoadMoreError,
  } = useNotificationCenter({
    userId,
    initialStatus,
    initialNotifications,
    onMarkRead,
    onMarkAllRead,
  });

  const [scrollThumbHandlers, scrollThumb] = useScrollThumb();

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="通知"
          className={cn(
            'group/bell relative flex size-[30px] items-center justify-center rounded-full border border-background-border bg-transparent text-text-primary transition-all duration-200 outline-none data-[state=open]:border-dark data-[state=open]:bg-dark data-[state=open]:text-text-white [@media(hover:hover)]:hover:border-dark [@media(hover:hover)]:hover:bg-dark [@media(hover:hover)]:hover:text-text-white',
            className
          )}
          aria-label="開啟通知選單"
        >
          <Bell className="size-5 text-text-primary transition-all group-data-[state=open]/bell:fill-current group-data-[state=open]/bell:text-text-white [@media(hover:hover)]:group-hover/bell:fill-current [@media(hover:hover)]:group-hover/bell:text-text-white" />

          {showBadge && (
            <span
              className="absolute -right-0.5 -bottom-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-background-white bg-status-error-default px-1 text-11 leading-none font-bold text-text-white select-none"
              aria-label={`有 ${badgeCount} 則未讀通知`}
            >
              {formattedCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] max-w-[min(300px,calc(100vw-32px))] rounded-2xl border border-background-border bg-background-white p-0 shadow-xl outline-none lg:max-w-[calc(100vw-32px)]"
      >
        <div className="overflow-hidden rounded-2xl py-5">
          <div ref={scrollThumbHandlers.trackRefCallback} className="relative">
            <div className="flex items-center justify-between px-5 pb-3">
              <span className="text-lg font-bold text-text-primary">通知</span>
            </div>

            {status === 'loading' && (
              <div className="flex flex-col divide-y divide-background-border px-5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-2.5 py-3">
                    <div className="mt-1.5 size-4 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4 rounded" />
                      <Skeleton className="h-3 w-5/6 rounded" />
                      <Skeleton className="h-3 w-12 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {status === 'error' && (
              <div className="flex flex-col items-center justify-center px-5 py-6 text-center">
                <AlertCircle className="mb-2 size-8 text-status-error-default" />
                <p className="mb-3 text-sm font-medium text-text-secondary">
                  載入失敗，請重試
                </p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-background-border px-3 text-xs font-medium text-text-primary transition-all hover:bg-background-hover"
                >
                  重新嘗試
                </button>
              </div>
            )}

            {(status === 'empty' ||
              (status === 'success' && notifications.length === 0)) && (
              <div className="flex flex-col items-center justify-center px-5 py-8 text-center">
                <Bell className="mb-3 size-10 text-text-tertiary" />
                <p className="text-sm font-medium text-text-secondary">
                  尚無新通知
                </p>
              </div>
            )}

            {status === 'success' && notifications.length > 0 && (
              <NotificationList
                notifications={notifications}
                scrollRefCallback={scrollThumbHandlers.scrollRefCallback}
                onMouseEnter={scrollThumbHandlers.onMouseEnter}
                onMouseLeave={scrollThumbHandlers.onMouseLeave}
                onItemClick={handleNotificationClick}
                onNavigate={closePopover}
                isLoadingMore={isLoadingMore}
                hasMore={hasMore}
                onLoadMore={loadMore}
                hasLoadMoreError={hasLoadMoreError}
              />
            )}

            {scrollThumb.visible && (
              <div
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute right-0.5 w-1.5 rounded-full bg-background-border transition-opacity duration-200',
                  scrollThumb.active ? 'opacity-100' : 'opacity-0'
                )}
                style={{ top: scrollThumb.top, height: scrollThumb.height }}
              />
            )}
          </div>

          {status === 'success' && notifications.length > 0 && (
            <div className="mt-3 flex items-center justify-start border-t border-background-border px-5 pt-3">
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={!hasUnread}
                className="text-xs font-semibold text-brand-500 transition-colors hover:text-brand-600 hover:underline focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:no-underline"
              >
                Mark all as read
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
});
