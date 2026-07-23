'use client';

import Link from 'next/link';
import type { ComponentProps, MouseEvent } from 'react';

import { cn } from '@/lib/utils';

export interface DisabledAwareLinkProps extends ComponentProps<typeof Link> {
  /** While true, the link renders inert instead of navigating anywhere. */
  disabled?: boolean;
}

/**
 * A `next/link` that can be temporarily disabled without swapping in a
 * placeholder destination (`/auth/signup`, `/`, …). Used while auth state is
 * still resolving so a link's label can be shown correctly before it's safe
 * to know where it should actually go.
 */
export function DisabledAwareLink({
  disabled = false,
  href,
  onClick,
  className,
  tabIndex,
  ...props
}: DisabledAwareLinkProps): JSX.Element {
  return (
    <Link
      href={disabled ? '#' : href}
      aria-disabled={disabled}
      // `href` keeps the element focusable even with pointer-events-none, so
      // keyboard/screen-reader users would still tab onto an inert link
      // without this — remove it from the tab order while disabled.
      tabIndex={disabled ? -1 : tabIndex}
      onClick={
        disabled
          ? (e: MouseEvent<HTMLAnchorElement>) => e.preventDefault()
          : onClick
      }
      className={cn(className, disabled && 'pointer-events-none opacity-50')}
      {...props}
    />
  );
}
