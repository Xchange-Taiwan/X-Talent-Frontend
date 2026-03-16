'use client';

import { Cross2Icon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { Session } from 'next-auth';
import { signOut } from 'next-auth/react';
import * as React from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { getAvatarThumbUrl } from '@/lib/avatar/getAvatarThumbUrl';

import { ShareProfileDialog } from './ShareProfileDialog';

export type MobileUserMenuProps = {
  user: Session['user'];
};

export function MobileUserMenu({ user }: MobileUserMenuProps): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false);

  const close = (): void => setOpen(false);

  const userId = user.id;
  const isMentor = Boolean(user.isMentor);
  const name = user.name ?? '';
  const avatarSrc = user.avatar
    ? `${getAvatarThumbUrl(user.avatar)}?cb=${user.avatarUpdatedAt ?? 0}`
    : '';
  const jobTitle = user.jobTitle ?? '';
  const company = user.company ?? '';
  const personalLinks = user.personalLinks ?? [];

  const profilePath = userId ? `/profile/${userId}` : '/';
  const profileUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${profilePath}`
      : profilePath;

  const subtitle =
    jobTitle && company
      ? `${jobTitle} at ${company}`
      : jobTitle || company || '';

  const handleGoProfile = (): void => {
    close();
    router.push(profilePath);
  };

  const handleShareProfile = (): void => {
    if (!userId) return;
    // Open dialog directly on top of the sheet (z-[101] > sheet z-50).
    // Closing the sheet first causes a timing issue where the sheet's close
    // animation is still running when the dialog tries to mount.
    setShareDialogOpen(true);
  };

  const handleAsMentor = (): void => {
    if (!userId) return;
    close();
    router.push(
      isMentor
        ? '/reservation/mentor'
        : `/profile/${userId}/edit?onboarding=true`
    );
  };

  const handleMyReservation = (): void => {
    close();
    router.push('/reservation/mentee');
  };

  const handleLogout = (): void => {
    close();
    signOut();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Open account menu"
            className="flex items-center"
          >
            <Image
              src={avatarSrc || DefaultAvatarImgUrl}
              alt="avatar"
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover"
              priority
            />
          </button>
        </SheetTrigger>

        <SheetContent side="right" className="h-screen w-screen">
          <div className="flex h-full flex-col">
            <SheetClose asChild className="ml-auto">
              <Cross2Icon className="text-blue-900 h-8 w-8" />
            </SheetClose>

            {/* Profile header */}
            <button
              type="button"
              onClick={handleGoProfile}
              className="flex items-center gap-4 pb-6 pt-10 text-left"
            >
              <Image
                src={avatarSrc || DefaultAvatarImgUrl}
                alt="avatar"
                width={56}
                height={56}
                className="h-14 w-14 rounded-full object-cover"
              />
              <div className="min-w-0">
                <div className="text-black truncate text-2xl font-semibold">
                  {name || 'My Profile'}
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
              Share Profile
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
                As a mentor
              </button>
              <button
                type="button"
                onClick={handleMyReservation}
                className="text-black py-4 text-left text-xl"
              >
                My reservation
              </button>
            </nav>

            <div className="mt-auto pb-12">
              <Button
                className="w-full bg-primary hover:bg-primary"
                onClick={handleLogout}
              >
                Log out
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ShareProfileDialog
        open={shareDialogOpen}
        onOpenChange={(nextOpen) => {
          setShareDialogOpen(nextOpen);
          if (!nextOpen) close();
        }}
        name={name || 'My Profile'}
        avatarSrc={avatarSrc}
        subtitle={subtitle}
        profileUrl={profileUrl}
        personalLinks={personalLinks}
      />
    </>
  );
}
