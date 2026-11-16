'use client';

import { Cross2Icon } from '@radix-ui/react-icons';
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
  type MobileAccountMenuModel,
  type ProfileHeaderDescriptor,
} from '@/hooks/layout/useHeaderNavigation';
import {
  FOCUS_RING_CLASSES,
  GROUP_FOCUS_RING_CLASSES,
} from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

import { DisabledAwareLink } from './DisabledAwareLink';
import { UserAvatar } from './UserAvatar';

export type MobileUserMenuProps = {
  profileHeader: ProfileHeaderDescriptor;
  menu: MobileAccountMenuModel;
  showFavorites?: boolean;
};

export const MobileUserMenu = React.memo(function MobileUserMenu({
  profileHeader,
  menu,
  showFavorites,
}: MobileUserMenuProps): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const closeMenu = React.useCallback(() => setOpen(false), []);

  const { shareProfile, navItems: rawNavItems, accountActions } = menu;
  const navItems = React.useMemo(
    () =>
      showFavorites === false
        ? rawNavItems.filter((item) => item.id !== 'my-favorites')
        : rawNavItems,
    [rawNavItems, showFavorites]
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="開啟用戶選單"
          className="group flex items-center focus-visible:outline-none"
        >
          <UserAvatar
            src={profileHeader.avatarSrc}
            name={profileHeader.name}
            size={30}
            className={`size-[30px] transition-opacity group-hover:opacity-80 ${GROUP_FOCUS_RING_CLASSES}`}
            priority
          />
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="h-dvh w-screen p-0">
        <SheetTitle className="sr-only">用戶選單</SheetTitle>
        <div className="flex h-full flex-col overflow-y-auto p-6">
          <SheetClose asChild>
            <button
              type="button"
              aria-label="關閉用戶選單"
              className={cn('ml-auto rounded-md', FOCUS_RING_CLASSES)}
            >
              <Cross2Icon
                className="text-brand-900 size-8"
                aria-hidden="true"
              />
            </button>
          </SheetClose>

          <DisabledAwareLink
            href={profileHeader.href}
            disabled={profileHeader.disabled}
            aria-current={profileHeader.isCurrent ? 'page' : undefined}
            onClick={closeMenu}
            data-testid="profile-header-button"
            {...getNavAnalyticsAttributes(profileHeader.analytics.mobile)}
            className="group flex items-center gap-4 pt-4 pb-6 text-left focus-visible:outline-none"
          >
            <UserAvatar
              src={profileHeader.avatarSrc}
              name={profileHeader.name}
              size={56}
              className={`size-14 transition-opacity hover:opacity-80 ${GROUP_FOCUS_RING_CLASSES}`}
            />
            <div data-clarity-mask="true" className="min-w-0">
              <div className="text-text-primary truncate text-2xl font-semibold">
                {profileHeader.displayName}
              </div>
              {profileHeader.subtitle ? (
                <div className="text-text-tertiary mt-1 truncate text-sm">
                  {profileHeader.subtitle}
                </div>
              ) : null}
            </div>
          </DisabledAwareLink>

          <Button
            variant="outline"
            className="mb-6 h-12 w-full rounded-2xl text-base font-semibold"
            onClick={() => shareProfile.onSelect(closeMenu)}
            disabled={shareProfile.disabled}
            {...getNavAnalyticsAttributes(shareProfile.analytics)}
          >
            {shareProfile.label}
          </Button>

          <div className="bg-background-bottom h-px w-full" />

          <nav className="flex flex-col py-2">
            {navItems.map((item) => {
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
                    className={cn(
                      'text-text-primary rounded-sm py-4 text-left text-xl',
                      FOCUS_RING_CLASSES
                    )}
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
                  className={cn(
                    'text-text-primary rounded-sm py-4 text-left text-xl',
                    FOCUS_RING_CLASSES
                  )}
                >
                  {item.label}
                </DisabledAwareLink>
              );
            })}
          </nav>

          <div className="flex flex-col pb-6">
            {accountActions.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={action.disabled}
                className={cn(
                  'rounded-sm py-4 text-left text-xl',
                  action.tone === 'destructive'
                    ? 'text-status-error-default'
                    : 'text-text-primary',
                  FOCUS_RING_CLASSES
                )}
                onClick={() => {
                  void action.onSelect(closeMenu);
                }}
                {...getNavAnalyticsAttributes(action.analytics)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
});
