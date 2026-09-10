'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { Session } from 'next-auth';
import * as React from 'react';

import { DeleteAccountDialog } from '@/components/auth/DeleteAccountDialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAccountMenu } from '@/hooks/layout/useAccountMenu';
import { ResolvedIdentity } from '@/lib/auth/sessionHint';
import { GROUP_FOCUS_RING_CLASSES } from '@/lib/ui/focusRing';

import { ShareProfileDialog } from './ShareProfileDialog';
import { UserAvatar } from './UserAvatar';

export type UserDropdownProps = {
  identity: ResolvedIdentity;
  user?: Session['user'];
};

export const UserDropdown = React.memo(function UserDropdown({
  identity,
  user,
}: UserDropdownProps): JSX.Element {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const closeMenu = React.useCallback(() => setMenuOpen(false), []);
  const {
    userId,
    isMentor,
    canDeleteAccount,
    name,
    avatarSrc,
    subtitle,
    personalLinks,
    profilePath,
    shareDialogOpen,
    setShareDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    handleGoProfile,
    handleShareProfile,
    handleAsMentor,
    handleMyReservation,
    handleDeleteAccount,
    handleLogout,
  } = useAccountMenu({ identity, user, closeMenu });

  const isOnProfile = Boolean(userId) && pathname === profilePath;
  const isOnMentorReservation =
    pathname?.startsWith('/reservation/mentor') ?? false;
  const isOnMenteeReservation =
    pathname?.startsWith('/reservation/mentee') ?? false;

  // The share dialog mounts on top of the closing dropdown, so open it a
  // frame after the close starts to avoid the two animations racing.
  const handleShareProfileClick = React.useCallback((): void => {
    closeMenu();
    requestAnimationFrame(handleShareProfile);
  }, [closeMenu, handleShareProfile]);

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group flex items-center gap-2 focus-visible:outline-none"
            aria-label="開啟用戶選單"
          >
            <UserAvatar
              src={avatarSrc}
              name={name}
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
          <button
            type="button"
            onClick={handleGoProfile}
            aria-current={isOnProfile ? 'page' : undefined}
            data-testid="profile-header-button"
            className="group flex w-full items-center gap-4 px-6 pt-6 pb-4 text-left focus-visible:outline-none"
          >
            <UserAvatar
              src={avatarSrc}
              name={name}
              size={56}
              className={`size-14 transition-opacity hover:opacity-80 ${GROUP_FOCUS_RING_CLASSES}`}
            />

            <div className="min-w-0">
              <div className="text-text-primary truncate text-3xl font-semibold">
                {name || '我的個人頁面'}
              </div>
              {subtitle ? (
                <div className="text-text-tertiary mt-1 truncate text-sm">
                  {subtitle}
                </div>
              ) : null}
            </div>
          </button>

          <div className="px-6 pb-5">
            <Button
              variant="outline"
              className="h-14 w-full rounded-2xl text-2xl font-semibold"
              onClick={handleShareProfileClick}
              disabled={!userId}
            >
              分享個人頁面
            </Button>
          </div>

          <div className="bg-background-bottom h-px w-full" />

          <div className="px-2 py-3">
            <DropdownMenuItem
              className="px-4 py-3 text-2xl"
              onClick={handleAsMentor}
              disabled={!userId}
              aria-current={
                isMentor && isOnMentorReservation ? 'page' : undefined
              }
            >
              {isMentor ? '導師預約管理' : '成為導師'}
            </DropdownMenuItem>

            <DropdownMenuItem
              className="px-4 py-3 text-2xl"
              onClick={handleMyReservation}
              aria-current={isOnMenteeReservation ? 'page' : undefined}
            >
              我的預約
            </DropdownMenuItem>

            <DropdownMenuItem
              className="px-4 py-3 text-2xl"
              onClick={handleLogout}
            >
              登出
            </DropdownMenuItem>

            {canDeleteAccount && (
              <DropdownMenuItem
                className="text-status-error-default focus:text-status-error-default px-4 py-3 text-2xl"
                onClick={handleDeleteAccount}
              >
                刪除帳號
              </DropdownMenuItem>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteAccountDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />

      <ShareProfileDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        name={name || '我的個人頁面'}
        avatarSrc={avatarSrc}
        subtitle={subtitle}
        profilePath={profilePath}
        personalLinks={personalLinks}
      />
    </>
  );
});
