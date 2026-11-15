'use client';

import { Cross2Icon, HamburgerMenuIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  getNavAnalyticsAttributes,
  type HeaderNavigationModel,
} from '@/hooks/layout/useHeaderNavigation';
import { FOCUS_RING_CLASSES } from '@/lib/ui/focusRing';

import { AuthHintGate } from './AuthHintGate';
import { DisabledAwareLink } from './DisabledAwareLink';

export type HamburgerMenuProps = {
  navigation: HeaderNavigationModel;
};

export function HamburgerMenu({
  navigation,
}: HamburgerMenuProps): JSX.Element | null {
  const [open, setOpen] = React.useState(false);
  const closeMenu = React.useCallback(() => setOpen(false), []);

  const { identity, mobileGuestMenu } = navigation;

  return (
    <AuthHintGate when={['guest']} identity={identity} defaultVisible>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="開啟導航選單"
            data-analytics-click="mobile_menu_open"
            data-analytics-location="mobile_menu"
            data-analytics-feature="navigation"
            className={`inline-flex items-center justify-center rounded-md ${FOCUS_RING_CLASSES}`}
          >
            <HamburgerMenuIcon className="size-8" aria-hidden="true" />
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="h-screen w-screen">
          <SheetTitle className="sr-only">導航選單</SheetTitle>
          <div className="flex h-full flex-col overflow-y-auto">
            <SheetClose asChild>
              <button
                type="button"
                aria-label="關閉導航選單"
                className={`ml-auto rounded-md ${FOCUS_RING_CLASSES}`}
              >
                <Cross2Icon
                  className="text-brand-900 size-8"
                  aria-hidden="true"
                />
              </button>
            </SheetClose>
            <nav className="flex flex-col space-y-6 pt-8 pb-6 text-xl">
              {mobileGuestMenu.navItems.map((item) => {
                if (item.kind === 'external-link') {
                  return (
                    <a
                      key={item.id}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={item.ariaLabel}
                      onClick={() => {
                        item.onClick();
                        closeMenu();
                      }}
                      className={`rounded-sm ${FOCUS_RING_CLASSES}`}
                    >
                      {item.label}
                    </a>
                  );
                }

                return (
                  <DisabledAwareLink
                    key={item.id}
                    href={item.href}
                    disabled={item.disabled}
                    aria-current={item.isCurrent ? 'page' : undefined}
                    onClick={closeMenu}
                    {...getNavAnalyticsAttributes(item.analytics)}
                    className={`rounded-sm ${FOCUS_RING_CLASSES}`}
                  >
                    {item.label}
                  </DisabledAwareLink>
                );
              })}
            </nav>

            <div className="flex flex-col space-y-6 pt-4">
              <Button
                variant="outline"
                className="h-14 rounded-full text-xl font-medium"
                asChild
              >
                <Link
                  href={mobileGuestMenu.signin.href}
                  aria-current={
                    mobileGuestMenu.signin.isCurrent ? 'page' : undefined
                  }
                  onClick={closeMenu}
                  {...getNavAnalyticsAttributes(
                    mobileGuestMenu.signin.analytics
                  )}
                >
                  {mobileGuestMenu.signin.label}
                </Link>
              </Button>
              <Button
                variant="default"
                className="h-14 rounded-full text-xl font-medium"
                asChild
              >
                <Link
                  href={mobileGuestMenu.signup.href}
                  aria-current={
                    mobileGuestMenu.signup.isCurrent ? 'page' : undefined
                  }
                  onClick={closeMenu}
                  {...getNavAnalyticsAttributes(
                    mobileGuestMenu.signup.analytics
                  )}
                >
                  {mobileGuestMenu.signup.label}
                </Link>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </AuthHintGate>
  );
}
