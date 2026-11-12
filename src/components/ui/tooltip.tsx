'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

export type TooltipSide = 'top' | 'bottom';
export type TooltipAlign = 'start' | 'center' | 'end';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
  side?: TooltipSide;
  align?: TooltipAlign;
  /**
   * When true, clicking the trigger pins the tooltip open so mouseLeave will
   * not immediately hide it; clicking again, clicking outside, or pressing
   * Escape unpins and closes it.
   */
  pinOnClick?: boolean;
  /**
   * Incrementing counter from parent (e.g. Dialog onEscapeKeyDown) to force
   * dismiss any open or pinned state without closing the parent dialog.
   */
  dismissSignal?: number;
  onOpenChange?: (open: boolean) => void;
  testId?: string;
  contentClassName?: string;
  wrapperClassName?: string;
}

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  pinOnClick = false,
  dismissSignal = 0,
  onOpenChange,
  testId,
  contentClassName,
  wrapperClassName,
}: TooltipProps) {
  const tooltipId = React.useId();
  const wrapperRef = React.useRef<HTMLSpanElement | null>(null);
  const tooltipRef = React.useRef<HTMLDivElement | null>(null);

  const [isHovered, setIsHovered] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const [isPinned, setIsPinned] = React.useState(false);

  const isOpen = isHovered || isFocused || isPinned;

  const closeAll = React.useCallback(() => {
    setIsHovered(false);
    setIsFocused(false);
    setIsPinned(false);
  }, []);

  const prevDismissSignalRef = React.useRef(dismissSignal);
  React.useEffect(() => {
    if (prevDismissSignalRef.current !== dismissSignal) {
      prevDismissSignalRef.current = dismissSignal;
      closeAll();
    }
  }, [dismissSignal, closeAll]);

  React.useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  React.useEffect(() => {
    if (!isPinned) return;

    const handleOutsidePointerDown = (event: PointerEvent | MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        wrapperRef.current?.contains(target) ||
        tooltipRef.current?.contains(target)
      ) {
        return;
      }
      setIsPinned(false);
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown);
    };
  }, [isPinned]);

  const childProps = children.props;

  const triggerElement = React.cloneElement(children, {
    'aria-describedby': isOpen
      ? [childProps['aria-describedby'], tooltipId].filter(Boolean).join(' ')
      : childProps['aria-describedby'],
    ...(pinOnClick ? { 'aria-expanded': isOpen } : {}),
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      setIsHovered(true);
      childProps.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      setIsHovered(false);
      childProps.onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      setIsFocused(true);
      childProps.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      setIsFocused(false);
      childProps.onBlur?.(e);
    },
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      if (pinOnClick) {
        if (isPinned) {
          closeAll();
        } else {
          setIsPinned(true);
        }
      }
      childProps.onClick?.(e);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        e.stopPropagation();
        closeAll();
      }
      childProps.onKeyDown?.(e);
    },
  });

  const placementClasses = cn(
    side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
    align === 'start' && 'left-0',
    align === 'center' && 'left-1/2 -translate-x-1/2',
    align === 'end' && 'right-0'
  );

  return (
    <span
      ref={wrapperRef}
      className={cn('relative inline-flex items-center', wrapperClassName)}
    >
      {triggerElement}
      {isOpen ? (
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          data-testid={testId}
          className={cn(
            'bg-text-primary text-text-white pointer-events-none absolute z-30 rounded-md px-3 py-2 text-xs leading-relaxed shadow-md',
            placementClasses,
            contentClassName
          )}
        >
          {content}
        </div>
      ) : null}
    </span>
  );
}
