'use client';

import { Bell } from 'lucide-react';
import * as React from 'react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

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
};

export const NotificationBell = React.memo(function NotificationBell({
  unreadCount = 5,
  className,
}: NotificationBellProps): JSX.Element {
  const [hasBeenClicked, setHasBeenClicked] = React.useState(false);

  const handleOpenChange = React.useCallback((open: boolean) => {
    if (open) {
      setHasBeenClicked(true);
    }
  }, []);

  const showBadge = !hasBeenClicked && unreadCount > 0;
  const formattedCount = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="通知"
          className={cn(
            'group relative flex h-9 w-9 items-center justify-center rounded-full border border-background-border bg-transparent text-text-primary transition-all duration-200 outline-none hover:border-transparent hover:bg-background-hover data-[state=open]:border-transparent data-[state=open]:bg-background-hover',
            className
          )}
          aria-label="開啟通知選單"
        >
          <Bell
            className={cn(
              'size-5 text-text-primary transition-all group-hover:fill-current group-data-[state=open]:fill-current'
            )}
          />

          {showBadge && (
            <span
              style={{ fontSize: '9px' }}
              className="absolute -right-0.5 -bottom-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-light bg-status-error-default px-1 leading-none font-bold text-text-white select-none"
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
        className="w-80 rounded-2xl border border-background-border bg-background-white p-6 shadow-xl outline-none"
      >
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Bell className="mb-3 size-12 text-text-tertiary" />
          <p className="text-base font-medium text-text-secondary">
            尚無新通知
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
});
