'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';

const VIEWPORT_PADDING = 12;

export type TooltipSide = 'top' | 'bottom';
export type TooltipAlign = 'start' | 'center' | 'end';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
  side?: TooltipSide;
  align?: TooltipAlign;
  sideOffset?: number;
  /**
   * When true, clicking the trigger pins the tooltip open so mouseLeave will
   * not immediately hide it; clicking again, clicking outside, or pressing
   * Escape unpins and closes it.
   */
  pinOnClick?: boolean;
  /**
   * Optional portal container (e.g. a DialogContentFrame with overflow-visible)
   * so the tooltip escapes internal overflow-y-auto / overflow-hidden scroll
   * containers while remaining inside the dialog's accessible DOM subtree.
   */
  portalContainer?: HTMLElement | null;
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

interface PortalCoords {
  top: number;
  left: number;
}

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  sideOffset = 8,
  pinOnClick = false,
  portalContainer,
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
  const [coords, setCoords] = React.useState<PortalCoords>({ top: 0, left: 0 });

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

  const updatePortalPosition = React.useCallback(() => {
    if (!portalContainer || !wrapperRef.current || !tooltipRef.current) {
      return;
    }

    const triggerRect = wrapperRef.current.getBoundingClientRect();
    const containerRect = portalContainer.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    const viewportWidth =
      typeof window !== 'undefined' && window.innerWidth > 0
        ? window.innerWidth
        : 0;
    const viewportHeight =
      typeof window !== 'undefined' && window.innerHeight > 0
        ? window.innerHeight
        : 0;

    let viewportLeft = triggerRect.left;
    if (align === 'center') {
      viewportLeft =
        triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    } else if (align === 'end') {
      viewportLeft = triggerRect.right - tooltipRect.width;
    }

    if (viewportWidth > 0 && tooltipRect.width > 0) {
      const minLeft = Math.max(
        VIEWPORT_PADDING,
        containerRect.left + VIEWPORT_PADDING / 2
      );
      const maxLeft = Math.min(
        viewportWidth - VIEWPORT_PADDING - tooltipRect.width,
        containerRect.right - VIEWPORT_PADDING / 2 - tooltipRect.width
      );
      if (maxLeft >= minLeft) {
        viewportLeft = Math.min(Math.max(viewportLeft, minLeft), maxLeft);
      } else {
        viewportLeft = Math.min(
          Math.max(viewportLeft, VIEWPORT_PADDING),
          Math.max(
            VIEWPORT_PADDING,
            viewportWidth - VIEWPORT_PADDING - tooltipRect.width
          )
        );
      }
    }

    let viewportTop =
      side === 'top'
        ? triggerRect.top - tooltipRect.height - sideOffset
        : triggerRect.bottom + sideOffset;

    if (viewportHeight > 0 && tooltipRect.height > 0) {
      if (side === 'top' && viewportTop < VIEWPORT_PADDING) {
        viewportTop = triggerRect.bottom + sideOffset;
      } else if (
        side === 'bottom' &&
        viewportTop + tooltipRect.height > viewportHeight - VIEWPORT_PADDING
      ) {
        viewportTop = triggerRect.top - tooltipRect.height - sideOffset;
      }
    }

    setCoords({
      top: viewportTop - containerRect.top,
      left: viewportLeft - containerRect.left,
    });
  }, [align, portalContainer, side, sideOffset]);

  React.useLayoutEffect(() => {
    if (!isOpen || !portalContainer) return;
    updatePortalPosition();

    window.addEventListener('resize', updatePortalPosition);
    window.addEventListener('scroll', updatePortalPosition, true);
    return () => {
      window.removeEventListener('resize', updatePortalPosition);
      window.removeEventListener('scroll', updatePortalPosition, true);
    };
  }, [isOpen, portalContainer, updatePortalPosition]);

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

  const inlinePlacementClasses = cn(
    side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
    align === 'start' && 'left-0',
    align === 'center' && 'left-1/2 -translate-x-1/2',
    align === 'end' && 'right-0'
  );

  const tooltipBubble = isOpen ? (
    <div
      ref={tooltipRef}
      id={tooltipId}
      role="tooltip"
      data-testid={testId}
      style={
        portalContainer
          ? {
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }
          : undefined
      }
      className={cn(
        'bg-text-primary text-text-white pointer-events-none absolute z-30 rounded-md px-3 py-2 text-xs leading-relaxed shadow-md',
        !portalContainer && inlinePlacementClasses,
        contentClassName
      )}
    >
      {content}
    </div>
  ) : null;

  return (
    <span
      ref={wrapperRef}
      className={cn('relative inline-flex items-center', wrapperClassName)}
    >
      {triggerElement}
      {tooltipBubble
        ? portalContainer
          ? createPortal(tooltipBubble, portalContainer)
          : tooltipBubble
        : null}
    </span>
  );
}
