'use client';

import { Cross2Icon } from '@radix-ui/react-icons';
import Image from 'next/image';
import type { Session } from 'next-auth';
import * as React from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
import { DeleteAccountDialog } from '@/components/auth/DeleteAccountDialog';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useAccountMenu } from '@/hooks/layout/useAccountMenu';

import { ShareProfileDialog } from './ShareProfileDialog';

export type MobileUserMenuProps = {
  user: Session['user'];
};

export function MobileUserMenu({ user }: MobileUserMenuProps): JSX.Element {
  const [open, setOpen] = React.useState(false);

  const closeMenu = React.useCallback(() => setOpen(false), []);
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

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="開啟用戶選單"
            className="flex items-center"
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
          </button>
        </SheetTrigger>

        <SheetContent side="right" className="h-screen w-screen">
          <SheetTitle className="sr-only">用戶選單</SheetTitle>
          <div className="flex h-full flex-col overflow-y-auto">
            <SheetClose asChild>
              <button
                type="button"
                aria-label="關閉用戶選單"
                className="ml-auto"
              >
                <Cross2Icon
                  className="text-blue-900 h-8 w-8"
                  aria-hidden="true"
                />
              </button>
            </SheetClose>

            {/* Profile header */}
            <button
              type="button"
              onClick={handleGoProfile}
              className="flex items-center gap-4 pb-6 pt-4 text-left"
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
                <div className="text-black truncate text-2xl font-semibold">
                  {name || '我的個人頁面'}
                </div>
                {subtitle ? (
                  <div className="mt-1 truncate text-sm text-gray-500">
                    {subtitle}
                  </div>
                ) : null}
              </div>
            </button>

            {/* Share Profile */}
            <Button
              variant="outline"
              className="mb-6 h-12 w-full rounded-2xl text-base font-semibold"
              onClick={handleShareProfile}
              disabled={!userId}
            >
              分享個人頁面
            </Button>

            <div className="h-px w-full bg-muted" />

            {/* Account actions */}
            <nav className="flex flex-col py-2">
              <button
                type="button"
                onClick={handleAsMentor}
                disabled={!userId}
                className="text-black py-4 text-left text-xl disabled:opacity-50"
              >
                {isMentor ? '導師預約管理' : '成為導師'}
              </button>
              <button
                type="button"
                onClick={handleMyReservation}
                className="text-black py-4 text-left text-xl"
              >
                我的預約
              </button>
            </nav>

            <div className="flex flex-col pb-6">
              <button
                type="button"
                className="text-black py-4 text-left text-xl"
                onClick={handleLogout}
              >
                登出
              </button>
              {canDeleteAccount && (
                <button
                  type="button"
                  className="py-4 text-left text-xl text-destructive"
                  onClick={handleDeleteAccount}
                >
                  刪除帳號
                </button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <DeleteAccountDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />

      <ShareProfileDialog
        open={shareDialogOpen}
        onOpenChange={(nextOpen) => {
          setShareDialogOpen(nextOpen);
          if (!nextOpen) closeMenu();
        }}
        name={name || '我的個人頁面'}
        avatarSrc={avatarSrc}
        subtitle={subtitle}
        profilePath={profilePath}
        personalLinks={personalLinks}
      />
    </>
  );
}
