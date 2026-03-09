'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { Session } from 'next-auth';
import { signOut } from 'next-auth/react';
import * as React from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
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

export function UserDropdown({ user }: UserDropdownProps): JSX.Element {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false);

  const userId = user.id;
  const isMentor = Boolean(user.isMentor);
  const name = user.name ?? '';
  const avatarSrc = user.avatar
    ? `${user.avatar}?cb=${user.avatarUpdatedAt ?? 0}`
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
    setMenuOpen(false);
    router.push(profilePath);
  };

  const handleShareProfile = (): void => {
    if (!userId) return;
    setMenuOpen(false);
    requestAnimationFrame(() => {
      setShareDialogOpen(true);
    });
  };

  const handleAsMentor = (): void => {
    if (!userId) return;

    setMenuOpen(false);

    if (isMentor) {
      router.push('/reservation/mentor');
    } else {
      router.push(`/profile/${userId}/edit?onboarding=true`);
    }
  };

  const handleMyReservation = (): void => {
    setMenuOpen(false);
    router.push('/reservation/mentee');
  };

  const handleLogout = (): void => {
    setMenuOpen(false);
    signOut();
  };

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2"
            aria-label="Open user menu"
          >
            <Image
              src={avatarSrc || DefaultAvatarImgUrl}
              alt="avatar"
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover"
            />
            <span className="text-xl leading-none">▾</span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-[360px] rounded-2xl p-0">
          <button
            type="button"
            onClick={handleGoProfile}
            className="flex w-full items-center gap-4 px-6 pb-4 pt-6 text-left"
          >
            <Image
              src={avatarSrc || DefaultAvatarImgUrl}
              alt="avatar"
              width={56}
              height={56}
              className="h-14 w-14 rounded-full object-cover"
            />

            <div className="min-w-0">
              <div className="text-black truncate text-3xl font-semibold">
                {name || 'My Profile'}
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
              Share Profile
            </Button>
          </div>

          <div className="h-px w-full bg-muted" />

          <div className="px-2 py-3">
            <DropdownMenuItem
              className="px-4 py-3 text-2xl"
              onClick={handleAsMentor}
              disabled={!userId}
            >
              As a mentor
            </DropdownMenuItem>

            <DropdownMenuItem
              className="px-4 py-3 text-2xl"
              onClick={handleMyReservation}
            >
              My reservation
            </DropdownMenuItem>

            <DropdownMenuItem
              className="px-4 py-3 text-2xl"
              onClick={handleLogout}
            >
              Log out
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <ShareProfileDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        name={name || 'My Profile'}
        avatarSrc={avatarSrc}
        subtitle={subtitle}
        profileUrl={profileUrl}
        personalLinks={personalLinks}
      />
    </>
  );
}
