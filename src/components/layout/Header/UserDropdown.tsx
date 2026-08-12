'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Session } from 'next-auth';
import * as React from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
import { DeleteAccountDialog } from '@/components/auth/DeleteAccountDialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAccountMenu } from '@/hooks/layout/useAccountMenu';
import { trackEvent } from '@/lib/analytics';

import { FEEDBACK_FORM_URL, FIND_MENTOR_HREF } from './constants';
import { ShareProfileDialog } from './ShareProfileDialog';

export type UserDropdownProps = {
  user: Session['user'];
};

export const UserDropdown = React.memo(function UserDropdown({
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
  } = useAccountMenu({ user, closeMenu });

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
            className="flex size-9 items-center justify-center overflow-hidden rounded-full"
            aria-label="開啟用戶選單"
          >
            <Image
              src={avatarSrc || DefaultAvatarImgUrl}
              alt={name ? `${name} 的頭像` : '我的頭像'}
              width={36}
              height={36}
              sizes="36px"
              className="size-9 rounded-full object-cover"
              priority
            />
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
            className="flex w-full items-center gap-4 px-6 pt-6 pb-4 text-left"
          >
            <Image
              src={avatarSrc || DefaultAvatarImgUrl}
              alt={name ? `${name} 的頭像` : '我的頭像'}
              width={56}
              height={56}
              sizes="56px"
              className="size-14 rounded-full object-cover"
            />

            <div className="min-w-0">
              <div className="truncate text-3xl font-semibold text-text-primary">
                {name || '我的個人頁面'}
              </div>
              {subtitle ? (
                <div className="mt-1 truncate text-sm text-text-tertiary">
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

          <div className="h-px w-full bg-background-bottom" />

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
              asChild
              className="cursor-pointer px-4 py-3 text-2xl"
            >
              <Link href={FIND_MENTOR_HREF}>尋找導師</Link>
            </DropdownMenuItem>

            <DropdownMenuItem
              asChild
              className="cursor-pointer px-4 py-3 text-2xl"
            >
              <Link href="/about">關於 X-Talent</Link>
            </DropdownMenuItem>

            <DropdownMenuItem
              asChild
              className="cursor-pointer px-4 py-3 text-2xl"
            >
              <a
                href={FEEDBACK_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent({ name: 'feedback_open' })}
              >
                提供回饋
              </a>
            </DropdownMenuItem>

            <DropdownMenuItem
              className="px-4 py-3 text-2xl"
              onClick={handleLogout}
            >
              登出
            </DropdownMenuItem>

            {canDeleteAccount && (
              <DropdownMenuItem
                className="px-4 py-3 text-2xl text-status-error-default focus:text-status-error-default"
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
