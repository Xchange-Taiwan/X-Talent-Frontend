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
import { type ResolvedIdentity } from '@/lib/auth/sessionHint';
import {
  getNavAnalyticsAttributes,
  type MobileGuestMenuModel,
} from '@/lib/navigation/headerNavigationModel';
import { FOCUS_RING_CLASSES } from '@/lib/ui/focusRing';

import { AuthHintGate } from './AuthHintGate';
import { DisabledAwareLink } from './DisabledAwareLink';

export type HamburgerMenuProps = {
  menu: MobileGuestMenuModel;
  identity?: ResolvedIdentity;
};

export const HamburgerMenu = React.memo(function HamburgerMenu({
  menu,
  identity,
}: HamburgerMenuProps): JSX.Element | null {
  const [open, setOpen] = React.useState(false);
  const closeMenu = React.useCallback(() => setOpen(false), []);

  return (
    <AuthHintGate when={['guest']} identity={identity} defaultVisible>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="開啟導航選單"
            data-analytics-click="mobile_menu_open"
            data-analytics-location="mobile_menu"
            data-analytics-feature="navigation"
          >
            <HamburgerMenuIcon className="size-6" aria-hidden="true" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="h-dvh w-screen p-0">
          <SheetTitle className="sr-only">導航選單</SheetTitle>
          <div className="flex h-full flex-col overflow-y-auto p-6">
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
            <nav className="flex flex-1 flex-col items-center justify-center gap-8 py-6 text-2xl">
              {menu.navItems.map((item) => {
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

            <div className="mt-auto flex flex-col items-center gap-5 pb-2">
              <Button variant="default" className="w-40" asChild>
                <Link
                  href={menu.signin.href}
                  aria-current={menu.signin.isCurrent ? 'page' : undefined}
                  onClick={closeMenu}
                  {...getNavAnalyticsAttributes(menu.signin.analytics)}
                >
                  {menu.signin.label}
                </Link>
              </Button>
              <Button
                variant="outline"
                className="border-brand-500 text-brand-500 hover:text-brand-500 w-40"
                asChild
              >
                <Link
                  href={menu.signup.href}
                  aria-current={menu.signup.isCurrent ? 'page' : undefined}
                  onClick={closeMenu}
                  {...getNavAnalyticsAttributes(menu.signup.analytics)}
                >
                  {menu.signup.label}
                </Link>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </AuthHintGate>
  );
});
