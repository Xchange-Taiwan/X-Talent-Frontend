'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { type ResolvedIdentity } from '@/lib/auth/sessionHint';
import {
  buildDesktopGuestAuth,
  getNavAnalyticsAttributes,
  type HeaderLinkDescriptor,
} from '@/lib/navigation/headerNavigationModel';

import { AuthHintGate } from './AuthHintGate';

const DEFAULT_DESKTOP_GUEST_AUTH = buildDesktopGuestAuth();

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
  signup = DEFAULT_DESKTOP_GUEST_AUTH.signup,
  signin = DEFAULT_DESKTOP_GUEST_AUTH.signin,
}: GuestActionButtonsProps): JSX.Element | null {
  return (
    <AuthHintGate
      when={['guest']}
      identity={identity}
      display="flex"
      className="items-center gap-3"
    >
      <Button
        variant="outline"
        className="border-brand-500 text-brand-500 hover:text-brand-500"
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

      <Button className="bg-brand-500 hover:bg-brand-500" asChild>
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
