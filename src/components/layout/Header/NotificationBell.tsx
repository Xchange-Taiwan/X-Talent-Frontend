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

import {
  getNotificationContent,
  getNotificationHref,
} from './notificationUtils';

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
  olderUnreadCount?: number;
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
  olderUnreadCount,
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
      <div className="divide-background-border flex flex-col divide-y">
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
              className="[@media(hover:hover)]:hover:bg-background-hover flex items-start gap-2.5 px-5 py-3 transition-colors hover:no-underline"
            >
              <span className="mt-1.5 flex size-4 shrink-0 items-center justify-center">
                {item.unread && (
                  <span
                    className="bg-brand-500 size-2 rounded-full"
                    aria-hidden="true"
                  />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'mb-1 text-sm leading-tight break-words',
                    item.unread
                      ? 'text-text-primary font-bold'
                      : 'text-text-secondary font-normal'
                  )}
                >
                  {title}
                </p>
                <p className="text-text-secondary mb-1.5 text-xs leading-normal break-words">
                  {body}
                </p>
                <span className="text-11 text-text-tertiary leading-none">
                  {formatRelativeTime(item.createdAt)}
                </span>
              </div>
            </Link>
          );
        })}

        {!!olderUnreadCount && olderUnreadCount > 0 && (
          <div className="flex items-center justify-center py-2.5 text-center">
            <span className="text-11 text-text-tertiary leading-none">
              還有 {olderUnreadCount > 99 ? '99+' : olderUnreadCount}{' '}
              則較舊的未讀通知
            </span>
          </div>
        )}

        {hasLoadMoreError ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-4 text-center">
            <span className="text-text-secondary text-xs">載入失敗</span>
            <button
              type="button"
              onClick={() => onLoadMore && onLoadMore(true)}
              className="text-brand-500 hover:text-brand-600 text-xs font-semibold transition-colors outline-none hover:underline"
            >
              點擊重試
            </button>
          </div>
        ) : (
          isLoadingMore && (
            <div className="flex items-center justify-center py-4">
              <span className="border-brand-500 size-4 animate-spin rounded-full border-2 border-t-transparent" />
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
    olderUnreadCount,
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
            'group/bell border-background-border text-text-primary data-[state=open]:border-dark data-[state=open]:bg-dark data-[state=open]:text-text-white [@media(hover:hover)]:hover:border-dark [@media(hover:hover)]:hover:bg-dark [@media(hover:hover)]:hover:text-text-white relative flex size-[30px] items-center justify-center rounded-full border bg-transparent transition-all duration-200 outline-none',
            className
          )}
          aria-label="開啟通知選單"
        >
          <Bell className="text-text-primary group-data-[state=open]/bell:text-text-white [@media(hover:hover)]:group-hover/bell:text-text-white size-5 transition-all group-data-[state=open]/bell:fill-current [@media(hover:hover)]:group-hover/bell:fill-current" />

          {showBadge && (
            <span
              className="border-background-white bg-status-error-default text-11 text-text-white absolute -right-0.5 -bottom-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border px-1 leading-none font-bold select-none"
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
        className="border-background-border bg-background-white w-[360px] max-w-[min(300px,calc(100vw-32px))] rounded-2xl border p-0 shadow-xl outline-none lg:max-w-[calc(100vw-32px)]"
      >
        <div className="overflow-hidden rounded-2xl py-5">
          <div ref={scrollThumbHandlers.trackRefCallback} className="relative">
            <div className="flex items-center justify-between px-5 pb-3">
              <span className="text-text-primary text-lg font-bold">通知</span>
            </div>

            {status === 'loading' && (
              <div className="divide-background-border flex flex-col divide-y px-5">
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
                <AlertCircle className="text-status-error-default mb-2 size-8" />
                <p className="text-text-secondary mb-3 text-sm font-medium">
                  載入失敗，請重試
                </p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="border-background-border text-text-primary hover:bg-background-hover inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium transition-all"
                >
                  重新嘗試
                </button>
              </div>
            )}

            {(status === 'empty' ||
              (status === 'success' && notifications.length === 0)) && (
              <div className="flex flex-col items-center justify-center px-5 py-8 text-center">
                <Bell className="text-text-tertiary mb-3 size-10" />
                <p className="text-text-secondary text-sm font-medium">
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
                olderUnreadCount={olderUnreadCount}
              />
            )}

            {scrollThumb.visible && (
              <div
                aria-hidden="true"
                className={cn(
                  'bg-background-border pointer-events-none absolute right-0.5 w-1.5 rounded-full transition-opacity duration-200',
                  scrollThumb.active ? 'opacity-100' : 'opacity-0'
                )}
                style={{ top: scrollThumb.top, height: scrollThumb.height }}
              />
            )}
          </div>

          {status === 'success' && notifications.length > 0 && (
            <div className="border-background-border mt-3 flex items-center justify-start border-t px-5 pt-3">
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={!hasUnread}
                className="text-brand-500 hover:text-brand-600 text-xs font-semibold transition-colors hover:underline focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:no-underline"
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
