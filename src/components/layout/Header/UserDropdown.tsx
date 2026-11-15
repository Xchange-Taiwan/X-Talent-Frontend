'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemSlot,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  getNavAnalyticsAttributes,
  type HeaderNavigationModel,
} from '@/hooks/layout/useHeaderNavigation';
import { GROUP_FOCUS_RING_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

import { DisabledAwareLink } from './DisabledAwareLink';
import { UserAvatar } from './UserAvatar';

export type UserDropdownProps = {
  navigation: HeaderNavigationModel;
};

export const UserDropdown = React.memo(function UserDropdown({
  navigation,
}: UserDropdownProps): JSX.Element {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const closeMenu = React.useCallback(() => setMenuOpen(false), []);

  const { profileHeader, desktopAccountMenu } = navigation;
  const { shareProfile, navItems, accountActions } = desktopAccountMenu;

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group flex items-center gap-2 focus-visible:outline-none"
          aria-label="開啟用戶選單"
        >
          <UserAvatar
            src={profileHeader.avatarSrc}
            name={profileHeader.name}
            size={30}
            className={`size-[30px] transition-opacity group-hover:opacity-80 ${GROUP_FOCUS_RING_CLASSES}`}
            priority
          />
          {menuOpen ? (
            <ChevronUp className="size-5" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-5" aria-hidden="true" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        collisionPadding={8}
        className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-[360px] overflow-y-auto rounded-2xl p-0"
      >
        <DropdownMenuItemSlot asChild disabled={profileHeader.disabled}>
          <DisabledAwareLink
            href={profileHeader.href}
            disabled={profileHeader.disabled}
            aria-current={profileHeader.isCurrent ? 'page' : undefined}
            data-testid="profile-header-button"
            {...getNavAnalyticsAttributes(profileHeader.analytics.desktop)}
            className="group flex w-full items-center gap-4 px-6 pt-6 pb-4 text-left focus-visible:outline-none"
          >
            <UserAvatar
              src={profileHeader.avatarSrc}
              name={profileHeader.name}
              size={56}
              className={`size-14 transition-opacity hover:opacity-80 ${GROUP_FOCUS_RING_CLASSES}`}
            />

            <div className="min-w-0">
              <div className="text-text-primary truncate text-3xl font-semibold">
                {profileHeader.displayName}
              </div>
              {profileHeader.subtitle ? (
                <div className="text-text-tertiary mt-1 truncate text-sm">
                  {profileHeader.subtitle}
                </div>
              ) : null}
            </div>
          </DisabledAwareLink>
        </DropdownMenuItemSlot>

        <div className="px-6 pb-5">
          <DropdownMenuItemSlot asChild disabled={shareProfile.disabled}>
            <Button
              variant="outline"
              className="h-14 w-full rounded-2xl text-2xl font-semibold"
              onClick={() => shareProfile.onSelect(closeMenu)}
              disabled={shareProfile.disabled}
              {...getNavAnalyticsAttributes(shareProfile.analytics)}
            >
              {shareProfile.label}
            </Button>
          </DropdownMenuItemSlot>
        </div>

        <div className="bg-background-bottom h-px w-full" />

        <div className="px-2 py-3">
          {navItems.map((item) => (
            <DropdownMenuItem
              key={item.id}
              asChild
              disabled={item.disabled}
              className="cursor-pointer px-4 py-3 text-2xl"
            >
              <DisabledAwareLink
                href={item.href}
                disabled={item.disabled}
                aria-current={item.isCurrent ? 'page' : undefined}
                {...getNavAnalyticsAttributes(item.analytics)}
              >
                {item.label}
              </DisabledAwareLink>
            </DropdownMenuItem>
          ))}

          {accountActions.map((action) => (
            <DropdownMenuItem
              key={action.id}
              disabled={action.disabled}
              className={cn(
                'px-4 py-3 text-2xl',
                action.tone === 'destructive' &&
                  'text-status-error-default focus:text-status-error-default'
              )}
              onClick={() => {
                void action.onSelect(closeMenu);
              }}
              {...getNavAnalyticsAttributes(action.analytics)}
            >
              {action.label}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
