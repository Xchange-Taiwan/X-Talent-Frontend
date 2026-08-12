'use client';

import {
  AlertCircle,
  Bell,
  CalendarCheck,
  CalendarOff,
  CalendarPlus,
  CalendarX,
  Clock,
} from 'lucide-react';
import * as React from 'react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

import {
  getNotificationContent,
  type NotificationItem,
} from './notificationUtils';
import { useNotificationState } from './useNotificationState';

export type NotificationBellProps = {
  /**
   * The mock count of unread notifications.
   * @default 5
   */
  unreadCount?: number;
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
   * Optional callback when the retry button is clicked. Supports async promises.
   */
  onRetry?: () => void | Promise<void>;
};

function renderIcon(iconType: string) {
  switch (iconType) {
    case 'calendar-plus':
      return <CalendarPlus className="size-5" />;
    case 'calendar-check':
      return <CalendarCheck className="size-5" />;
    case 'calendar-x':
      return <CalendarX className="size-5" />;
    case 'calendar-off':
      return <CalendarOff className="size-5" />;
    case 'clock':
      return <Clock className="size-5" />;
    default:
      return <Bell className="size-5" />;
  }
}

export const NotificationBell = React.memo(function NotificationBell({
  unreadCount = 5,
  className,
  initialStatus = 'success',
  initialNotifications,
  onRetry,
}: NotificationBellProps): JSX.Element {
  const {
    status,
    notifications,
    showBadge,
    formattedCount,
    handleOpenChange,
    handleRetry,
  } = useNotificationState({
    unreadCount,
    initialStatus,
    initialNotifications,
    onRetry,
  });

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="通知"
          className={cn(
            'group relative flex h-9 w-9 items-center justify-center rounded-full border border-background-border bg-transparent text-text-primary transition-all duration-200 outline-none data-[state=open]:border-dark data-[state=open]:bg-dark data-[state=open]:text-text-white [@media(hover:hover)]:hover:border-transparent [@media(hover:hover)]:hover:bg-background-hover',
            className
          )}
          aria-label="開啟通知選單"
        >
          <Bell className="size-5 text-text-primary transition-all group-data-[state=open]:fill-current group-data-[state=open]:text-text-white" />

          {showBadge && (
            <span
              className="absolute -right-0.5 -bottom-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-background-white bg-status-error-default px-1 text-11 leading-none font-bold text-text-white select-none"
              aria-label={`有 ${unreadCount} 則未讀通知`}
            >
              {formattedCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] max-w-[calc(100vw-32px)] rounded-2xl border border-background-border bg-background-white p-5 shadow-xl outline-none"
      >
        <div className="mb-3 flex items-center justify-between border-b border-background-border pb-3">
          <span className="text-lg font-bold text-text-primary">通知</span>
        </div>

        {status === 'loading' && (
          <div className="flex flex-col gap-3 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 py-2">
                <Skeleton className="size-10 shrink-0 rounded-full" />
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
          <div className="flex flex-col items-center justify-center py-6 text-center">
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
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bell className="mb-3 size-10 text-text-tertiary" />
            <p className="text-sm font-medium text-text-secondary">
              尚無新通知
            </p>
          </div>
        )}

        {status === 'success' && notifications.length > 0 && (
          <div className="flex max-h-[360px] flex-col gap-1 overflow-y-auto pr-1">
            {notifications.map((item) => {
              const { title, body, iconBgClass, iconType } =
                getNotificationContent(item);
              return (
                <div
                  key={item.id}
                  className="group/item relative flex items-start gap-3 rounded-xl p-3 transition-all duration-200 hover:bg-background-hover"
                >
                  <div
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-full',
                      iconBgClass
                    )}
                  >
                    {renderIcon(iconType)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-sm leading-tight font-semibold break-words text-text-primary">
                      {title}
                    </p>
                    <p className="mb-1.5 text-xs leading-normal break-words text-text-secondary">
                      {body}
                    </p>
                    <span className="text-11 leading-none text-text-tertiary">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                  {item.unread && (
                    <span className="absolute top-4 right-3 size-2 rounded-full bg-status-error-default" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
});
