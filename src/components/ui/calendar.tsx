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

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  buttonVariant = 'ghost',
  formatters,
  components,
  showTodayStyle = true,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>['variant'];
  showTodayStyle?: boolean;
}) {
  const defaultClassNames = getDefaultClassNames();

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

          'bg-background',
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
          date.toLocaleString('default', { month: 'short' }),
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
          'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
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
          'flex h-[var(--cell-size)] w-full items-center justify-center px-[var(--cell-size)]',
          defaultClassNames.month_caption
        ),

        dropdowns: cn(
          'flex h-[var(--cell-size)] w-full items-center justify-center gap-1.5 text-[length:var(--calendar-caption-font-size)] font-medium',
          defaultClassNames.dropdowns
        ),

        dropdown_root: cn(
          'has-focus:border-ring border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] relative rounded-md border',
          defaultClassNames.dropdown_root
        ),

        dropdown: cn(
          'bg-popover absolute inset-0 opacity-0',
          defaultClassNames.dropdown
        ),

        caption_label: cn(
          'select-none font-medium',
          captionLayout === 'label'
            ? 'text-[length:var(--calendar-caption-font-size)]'
            : '[&>svg]:text-muted-foreground flex h-8 items-center gap-1 rounded-md pl-2 pr-1 text-[length:var(--calendar-caption-font-size)] [&>svg]:size-3.5',
          defaultClassNames.caption_label
        ),

        weekdays: cn(
          'grid w-full grid-cols-7 gap-1',
          defaultClassNames.weekdays
        ),

        weekday: cn(
          'text-muted-foreground flex h-[var(--cell-size)] select-none items-center justify-center rounded-md text-[length:var(--calendar-weekday-font-size)] font-normal',
          defaultClassNames.weekday
        ),

        week: cn('mt-2 grid w-full grid-cols-7 gap-1', defaultClassNames.week),

        week_number_header: cn(
          'w-[var(--cell-size)] select-none',
          defaultClassNames.week_number_header
        ),

        week_number: cn(
          'text-muted-foreground select-none text-[length:var(--calendar-weekday-font-size)]',
          defaultClassNames.week_number
        ),

        day: cn(
          'group/day relative flex h-[var(--cell-size)] min-w-0 select-none items-center justify-center p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-full [&:last-child[data-selected=true]_button]:rounded-r-full',
          defaultClassNames.day
        ),

        range_start: cn(
          'bg-accent rounded-l-md',
          defaultClassNames.range_start
        ),

        range_middle: cn('rounded-none', defaultClassNames.range_middle),

        range_end: cn('bg-accent rounded-r-md', defaultClassNames.range_end),

        today: cn(
          showTodayStyle
            ? 'rounded-full border border-[#2CCBCB] text-[#2CCBCB]'
            : '',
          defaultClassNames.today
        ),

        outside: cn(
          'text-muted-foreground aria-selected:text-muted-foreground',
          defaultClassNames.outside
        ),

        disabled: cn(
          'text-muted-foreground opacity-50',
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
          'data-[range-end=true]:bg-primary',
          'data-[range-middle=true]:bg-accent',
          'data-[range-start=true]:bg-primary',
          'data-[selected-single=true]:bg-primary',
          'data-[range-end=true]:text-primary-foreground',
          'data-[range-middle=true]:text-accent-foreground',
          'data-[range-start=true]:text-primary-foreground',
          'data-[selected-single=true]:text-primary-foreground',

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
          'bg-primary/20 hover:bg-primary/30'
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
