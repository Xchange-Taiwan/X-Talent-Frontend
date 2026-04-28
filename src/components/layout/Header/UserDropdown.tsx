'use client';

import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import type { Session } from 'next-auth';
import { signOut } from 'next-auth/react';
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

import { ShareProfileDialog } from './ShareProfileDialog';

export type UserDropdownProps = {
  user: Session['user'];
};

export const UserDropdown = React.memo(function UserDropdown({
  user,
}: UserDropdownProps): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  const userId = user.id;
  const isMentor = Boolean(user.isMentor);
  const canDeleteAccount = [
    'testing_visitor@xchange.com.tw',
    'testing_mentee@xchange.com.tw',
    'testing_mentor@xchange.com.tw',
  ].includes(user.email ?? '');
  const name = user.name ?? '';
  // Use the original avatar URL with ?v= so header / dropdown / share dialog
  // share the same Image Optimizer + browser cache entry as the profile view
  // and edit pages, and the layout preload is reused.
  const avatarSrc = user.avatar
    ? `${user.avatar}?v=${user.avatarUpdatedAt ?? 0}`
    : '';
  const jobTitle = user.jobTitle ?? '';
  const company = user.company ?? '';

  const personalLinks = user.personalLinks ?? [];

  const profilePath = userId ? `/profile/${userId}` : '/';
  const isOnProfile = Boolean(userId) && pathname === profilePath;
  const isOnMentorReservation =
    pathname?.startsWith('/reservation/mentor') ?? false;
  const isOnMenteeReservation =
    pathname?.startsWith('/reservation/mentee') ?? false;
  const profileUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${profilePath}`
      : profilePath;

  const subtitle =
    jobTitle && company
      ? `${jobTitle} at ${company}`
      : jobTitle || company || '';

  const handleGoProfile = React.useCallback((): void => {
    setMenuOpen(false);
    router.push(profilePath);
  }, [router, profilePath]);

  const handleShareProfile = React.useCallback((): void => {
    if (!userId) return;
    setMenuOpen(false);
    requestAnimationFrame(() => {
      setShareDialogOpen(true);
    });
  }, [userId]);

  const handleAsMentor = React.useCallback((): void => {
    if (!userId) return;
    setMenuOpen(false);
    if (isMentor) {
      router.push('/reservation/mentor');
    } else {
      router.push(`/profile/${userId}/edit?onboarding=true`);
    }
  }, [router, userId, isMentor]);

  const handleMyReservation = React.useCallback((): void => {
    setMenuOpen(false);
    router.push('/reservation/mentee');
  }, [router]);

  const handleDeleteAccount = React.useCallback((): void => {
    setMenuOpen(false);
    requestAnimationFrame(() => {
      setDeleteDialogOpen(true);
    });
  }, []);

  const handleLogout = React.useCallback((): void => {
    setMenuOpen(false);
    signOut();
  }, []);

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2"
            aria-label="開啟用戶選單"
          >
            <Image
              src={avatarSrc || DefaultAvatarImgUrl}
              alt={name ? `${name} 的頭像` : '我的頭像'}
              width={32}
              height={32}
              sizes="32px"
              className="h-8 w-8 rounded-full object-cover"
              priority
            />
            <span className="text-xl leading-none" aria-hidden="true">
              ▾
            </span>
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
            className="flex w-full items-center gap-4 px-6 pb-4 pt-6 text-left"
          >
            <Image
              src={avatarSrc || DefaultAvatarImgUrl}
              alt={name ? `${name} 的頭像` : '我的頭像'}
              width={56}
              height={56}
              sizes="56px"
              className="h-14 w-14 rounded-full object-cover"
            />

            <div className="min-w-0">
              <div className="text-black truncate text-3xl font-semibold">
                {name || '我的個人頁面'}
              </div>
            </div>
          </button>

          <div className="px-6 pb-5">
            <Button
              variant="outline"
              className="h-14 w-full rounded-2xl text-2xl font-semibold"
              onClick={handleShareProfile}
              disabled={!userId}
            >
              分享個人頁面
            </Button>
          </div>

          <div className="h-px w-full bg-muted" />

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
                className="px-4 py-3 text-2xl text-destructive focus:text-destructive"
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
        profileUrl={profileUrl}
        personalLinks={personalLinks}
      />
    </>
  );
});
