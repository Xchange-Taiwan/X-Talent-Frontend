'use client';

import Link from 'next/link';
import {
  type ComponentPropsWithoutRef,
  forwardRef,
  type MouseEvent,
} from 'react';

import { cn } from '@/lib/utils';

export interface DisabledAwareLinkProps extends ComponentPropsWithoutRef<
  typeof Link
> {
  /** While true, neutralizes navigation and marks the element inert to AT. */
  disabled?: boolean;
}

/**
 * A Next.js `<Link>` that stays mounted as an `<a>` while a dependency (such as
 * `session.user.id`) is still resolving, without advertising a wrong fallback
 * URL or responding to clicks / keyboard focus in the meantime.
 */
export const DisabledAwareLink = forwardRef<
  HTMLAnchorElement,
  DisabledAwareLinkProps
>(function DisabledAwareLink(
  { disabled = false, href, onClick, className, tabIndex, ...props },
  ref
): JSX.Element {
  return (
    <Link
      {...props}
      ref={ref}
      href={disabled ? '#' : href}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : tabIndex}
      onClick={
        disabled
          ? (e: MouseEvent<HTMLAnchorElement>) => e.preventDefault()
          : onClick
      }
      className={cn(className, disabled && 'pointer-events-none opacity-50')}
    />
  );
});

DisabledAwareLink.displayName = 'DisabledAwareLink';
