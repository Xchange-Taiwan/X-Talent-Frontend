'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  getNavAnalyticsAttributes,
  type HeaderLinkDescriptor,
} from '@/hooks/layout/useHeaderNavigation';
import { type ResolvedIdentity } from '@/lib/auth/sessionHint';
import { SIGNIN_HREF, SIGNUP_HREF } from '@/lib/routes';

import { AuthHintGate } from './AuthHintGate';

const DEFAULT_SIGNUP_DESCRIPTOR: HeaderLinkDescriptor = {
  id: 'signup',
  kind: 'link',
  label: '註冊',
  href: SIGNUP_HREF,
  isCurrent: false,
  disabled: false,
  analytics: {
    click: 'header_signup',
    location: 'header',
    feature: 'auth',
  },
};

const DEFAULT_SIGNIN_DESCRIPTOR: HeaderLinkDescriptor = {
  id: 'signin',
  kind: 'link',
  label: '登入',
  href: SIGNIN_HREF,
  isCurrent: false,
  disabled: false,
  analytics: {
    click: 'header_signin',
    location: 'header',
    feature: 'auth',
  },
};

export type GuestActionButtonsProps = {
  identity?: ResolvedIdentity;
  signup?: HeaderLinkDescriptor;
  signin?: HeaderLinkDescriptor;
};

/**
 * The "註冊" and "登入" button pair shown in the desktop header for guests.
 *
 * Pre-hydration (`unknown`), `<AuthHintGate>` wraps them in ADR-0001 CSS
 * selectors so they appear flash-free when `data-auth-state="guest"`. Once
 * resolved to `confirmed-guest`, they render directly; for logged-in states,
 * `<AuthHintGate>` unmounts them.
 */
export function GuestActionButtons({
  identity,
  signup = DEFAULT_SIGNUP_DESCRIPTOR,
  signin = DEFAULT_SIGNIN_DESCRIPTOR,
}: GuestActionButtonsProps): JSX.Element | null {
  return (
    <AuthHintGate
      when={['guest']}
      identity={identity}
      display="flex"
      className="items-center gap-3"
    >
      <Button
        variant="default"
        className="h-10 rounded-full px-6 py-2.5 text-base font-medium"
        asChild
      >
        <Link
          href={signup.href}
          aria-current={signup.isCurrent ? 'page' : undefined}
          {...getNavAnalyticsAttributes(signup.analytics)}
        >
          {signup.label}
        </Link>
      </Button>

      <Button
        variant="outline"
        className="h-10 rounded-full px-6 py-2.5 text-base font-medium"
        asChild
      >
        <Link
          href={signin.href}
          aria-current={signin.isCurrent ? 'page' : undefined}
          {...getNavAnalyticsAttributes(signin.analytics)}
        >
          {signin.label}
        </Link>
      </Button>
    </AuthHintGate>
  );
}
