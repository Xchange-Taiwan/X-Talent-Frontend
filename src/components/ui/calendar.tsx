'use client';

import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react';
import * as React from 'react';
import { DayButton, DayPicker, getDefaultClassNames } from 'react-day-picker';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type CalendarVariant = 'default' | 'profile';

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  buttonVariant = 'ghost',
  formatters,
  components,
  showTodayStyle = true,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>['variant'];
  showTodayStyle?: boolean;
  variant?: CalendarVariant;
}) {
  const defaultClassNames = getDefaultClassNames();

  const isProfile = variant === 'profile';

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        [
          'group/calendar',

          // Calendar width is controlled by ScheduleCalendar.
          'w-[var(--calendar-width)]',
          'max-w-full',
          'mx-auto',

          'bg-background-white',
          'p-3',

          // Fallback values.
          '[--calendar-width:100%]',
          '[--cell-size:2rem]',
          '[--calendar-day-font-size:0.875rem]',
          '[--calendar-weekday-font-size:0.8rem]',
          '[--calendar-caption-font-size:0.875rem]',
          '[--calendar-chevron-size:1rem]',

          '[[data-slot=card-content]_&]:bg-transparent',
          '[[data-slot=popover-content]_&]:bg-transparent',
        ].join(' '),
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          isProfile
            ? date.toLocaleString('default', { month: 'long' })
            : date.toLocaleString('default', { month: 'short' }),
        formatWeekdayName: (date) =>
          isProfile
            ? date.toLocaleString('default', { weekday: 'narrow' })
            : date.toLocaleString('default', { weekday: 'short' }),
        ...formatters,
      }}
      classNames={{
        root: cn(defaultClassNames.root),

        months: cn(
          'relative flex w-full flex-col gap-4 md:flex-row',
          defaultClassNames.months
        ),

        month: cn('flex w-full flex-col gap-4', defaultClassNames.month),

        nav: cn(
          isProfile
            ? 'absolute right-0 top-0 flex items-center justify-end gap-1'
            : 'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
          defaultClassNames.nav
        ),

        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          '!h-[var(--cell-size)] !w-[var(--cell-size)] select-none p-0 aria-disabled:opacity-50',
          defaultClassNames.button_previous
        ),

        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          '!h-[var(--cell-size)] !w-[var(--cell-size)] select-none p-0 aria-disabled:opacity-50',
          defaultClassNames.button_next
        ),

        month_caption: cn(
          isProfile
            ? 'flex h-[var(--cell-size)] w-full items-center justify-start'
            : 'flex h-[var(--cell-size)] w-full items-center justify-center px-[var(--cell-size)]',
          defaultClassNames.month_caption
        ),

        dropdowns: cn(
          isProfile
            ? 'flex h-[var(--cell-size)] items-center justify-start gap-1 text-[length:var(--calendar-caption-font-size)] font-medium text-text-secondary'
            : 'flex h-[var(--cell-size)] w-full items-center justify-center gap-1.5 text-[length:var(--calendar-caption-font-size)] font-medium',
          defaultClassNames.dropdowns
        ),

        dropdown_root: cn(
          isProfile
            ? 'relative inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-sm font-semibold text-text-primary hover:bg-background-bottom-secondary'
            : 'has-focus:border-ring border-background-border shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] relative rounded-md border',
          defaultClassNames.dropdown_root
        ),

        dropdown: cn(
          'bg-popover absolute inset-0 opacity-0',
          defaultClassNames.dropdown
        ),

        caption_label: cn(
          isProfile
            ? 'select-none font-medium text-text-secondary'
            : 'select-none font-medium',
          captionLayout === 'label'
            ? 'text-[length:var(--calendar-caption-font-size)]'
            : isProfile
              ? '[&>svg]:text-text-tertiary flex h-8 items-center gap-1 rounded-md text-[length:var(--calendar-caption-font-size)] [&>svg]:size-3.5'
              : '[&>svg]:text-text-tertiary flex h-8 items-center gap-1 rounded-md pl-2 pr-1 text-[length:var(--calendar-caption-font-size)] [&>svg]:size-3.5',
          defaultClassNames.caption_label
        ),

        weekdays: cn(
          'grid w-full grid-cols-7 gap-1',
          defaultClassNames.weekdays
        ),

        weekday: cn(
          isProfile
            ? 'text-black font-semibold flex h-[var(--cell-size)] select-none items-center justify-center rounded-md text-[length:var(--calendar-weekday-font-size)]'
            : 'text-text-tertiary font-normal flex h-[var(--cell-size)] select-none items-center justify-center rounded-md text-[length:var(--calendar-weekday-font-size)]',
          defaultClassNames.weekday
        ),

        week: cn('mt-2 grid w-full grid-cols-7 gap-1', defaultClassNames.week),

        week_number_header: cn(
          'w-[var(--cell-size)] select-none',
          defaultClassNames.week_number_header
        ),

        week_number: cn(
          'text-text-tertiary select-none text-[length:var(--calendar-weekday-font-size)]',
          defaultClassNames.week_number
        ),

        day: cn(
          'group/day relative flex h-[var(--cell-size)] min-w-0 select-none items-center justify-center p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-full [&:last-child[data-selected=true]_button]:rounded-r-full',
          defaultClassNames.day
        ),

        range_start: cn(
          'bg-background-bottom rounded-l-md',
          defaultClassNames.range_start
        ),

        range_middle: cn('rounded-none', defaultClassNames.range_middle),

        range_end: cn(
          'bg-background-bottom rounded-r-md',
          defaultClassNames.range_end
        ),

        today: cn(
          showTodayStyle
            ? 'rounded-full border border-brand-500 text-brand-500'
            : '',
          defaultClassNames.today
        ),

        outside: cn(
          'text-text-tertiary aria-selected:text-text-tertiary',
          defaultClassNames.outside
        ),

        disabled: cn(
          'text-text-tertiary opacity-50',
          defaultClassNames.disabled
        ),

        hidden: cn('invisible', defaultClassNames.hidden),

        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              data-variant={variant}
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          );
        },

        Chevron: ({ className, orientation, ...props }) => {
          const iconClassName = cn(
            'h-[var(--calendar-chevron-size)] w-[var(--calendar-chevron-size)]',
            className
          );

          if (orientation === 'left') {
            return <ChevronLeftIcon className={iconClassName} {...props} />;
          }

          if (orientation === 'right') {
            return <ChevronRightIcon className={iconClassName} {...props} />;
          }

          return <ChevronDownIcon className={iconClassName} {...props} />;
        },

        DayButton: CalendarDayButton,

        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex h-[var(--cell-size)] w-[var(--cell-size)] items-center justify-center text-center">
                {children}
              </div>
            </td>
          );
        },

        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();

  const ref = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (modifiers.focused) {
      ref.current?.focus();
    }
  }, [modifiers.focused]);

  const isAvailable =
    Boolean((modifiers as Record<string, boolean>).available) ||
    Boolean(className?.includes('rdp-day-available'));

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-testid={`day-${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}`}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        defaultClassNames.day,
        className,
        [
          'flex',

          // Keep the circle responsive and round.
          '!h-auto',
          '!w-full',
          'aspect-square',
          'max-w-[var(--cell-size)]',

          'shrink-0',
          'flex-col',
          'items-center',
          'justify-center',
          'gap-1',
          'rounded-full',

          // Controlled by ScheduleCalendar size.
          'text-[length:var(--calendar-day-font-size)]',

          'font-normal',
          'leading-none',

          // Range / selected states.
          'data-[range-end=true]:rounded-md',
          'data-[range-middle=true]:rounded-none',
          'data-[range-start=true]:rounded-md',
          'data-[range-end=true]:bg-brand-500',
          'data-[range-middle=true]:bg-background-bottom',
          'data-[range-start=true]:bg-brand-500',
          'data-[selected-single=true]:bg-brand-500',
          'data-[selected-single=true]:text-text-primary',
          'group-data-[variant=profile]/calendar:data-[selected-single=true]:bg-brand-100',
          'group-data-[variant=profile]/calendar:data-[selected-single=true]:text-text-primary',
          'group-data-[variant=profile]/calendar:data-[selected-single=true]:font-medium',
          'group-data-[variant=profile]/calendar:data-[selected-single=true]:border',
          'group-data-[variant=profile]/calendar:data-[selected-single=true]:border-brand-300',
          'data-[range-end=true]:text-text-primary',
          'data-[range-middle=true]:text-text-primary',
          'data-[range-start=true]:text-text-primary',

          // Focus state.
          'group-data-[focused=true]/day:relative',
          'group-data-[focused=true]/day:z-10',
          'group-data-[focused=true]/day:border-ring',
          'group-data-[focused=true]/day:ring-[3px]',
          'group-data-[focused=true]/day:ring-ring/50',

          '[&>span]:text-xs',
          '[&>span]:opacity-70',
        ].join(' '),

        isAvailable &&
          !modifiers.selected &&
          !modifiers.disabled &&
          'bg-brand-500/20 hover:bg-brand-500/30',

        !modifiers.disabled &&
          'group-data-[variant=profile]/calendar:text-black group-data-[variant=profile]/calendar:font-medium'
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
