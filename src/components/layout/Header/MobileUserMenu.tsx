'use client';

import { Cross2Icon } from '@radix-ui/react-icons';
import Link from 'next/link';
import type { Session } from 'next-auth';
import * as React from 'react';

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
import { trackEvent } from '@/lib/analytics';
import { ResolvedIdentity } from '@/lib/auth/sessionHint';

import { FEEDBACK_FORM_URL, FIND_MENTOR_HREF } from './constants';
import { ShareProfileDialog } from './ShareProfileDialog';
import { UserAvatar } from './UserAvatar';

export type MobileUserMenuProps = {
  identity: ResolvedIdentity;
  user?: Session['user'];
};

export function MobileUserMenu({
  identity,
  user,
}: MobileUserMenuProps): JSX.Element {
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
  } = useAccountMenu({ identity, user, closeMenu });

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="開啟用戶選單"
            className="flex items-center"
          >
            <UserAvatar
              src={avatarSrc}
              name={name}
              size={30}
              className="size-[30px]"
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
                  className="size-8 text-brand-900"
                  aria-hidden="true"
                />
              </button>
            </SheetClose>

            {/* Profile header */}
            <button
              type="button"
              onClick={handleGoProfile}
              className="flex items-center gap-4 pt-4 pb-6 text-left"
            >
              <UserAvatar
                src={avatarSrc}
                name={name}
                size={56}
                className="size-14"
              />
              <div className="min-w-0">
                <div className="truncate text-2xl font-semibold text-text-primary">
                  {name || '我的個人頁面'}
                </div>
                {subtitle ? (
                  <div className="mt-1 truncate text-sm text-text-tertiary">
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

            <div className="h-px w-full bg-background-bottom" />

            {/* Account actions */}
            <nav className="flex flex-col py-2">
              <button
                type="button"
                onClick={handleAsMentor}
                disabled={!userId}
                className="py-4 text-left text-xl text-text-primary disabled:opacity-50"
              >
                {isMentor ? '導師預約管理' : '成為導師'}
              </button>
              <button
                type="button"
                onClick={handleMyReservation}
                className="py-4 text-left text-xl text-text-primary"
              >
                我的預約
              </button>

              <Link
                href={FIND_MENTOR_HREF}
                onClick={closeMenu}
                className="py-4 text-left text-xl text-text-primary"
              >
                尋找導師
              </Link>
              <Link
                href="/about"
                onClick={closeMenu}
                className="py-4 text-left text-xl text-text-primary"
              >
                關於 X-Talent
              </Link>
              <a
                href={FEEDBACK_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  trackEvent({ name: 'feedback_open' });
                  closeMenu();
                }}
                className="py-4 text-left text-xl text-text-primary"
              >
                提供回饋
              </a>
            </nav>

            <div className="flex flex-col pb-6">
              <button
                type="button"
                className="py-4 text-left text-xl text-text-primary"
                onClick={handleLogout}
              >
                登出
              </button>
              {canDeleteAccount && (
                <button
                  type="button"
                  className="py-4 text-left text-xl text-status-error-default"
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
