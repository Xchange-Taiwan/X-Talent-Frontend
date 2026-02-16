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

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

export type UserDropdownProps = {
  user: Session['user'];
};

export function UserDropdown({ user }: UserDropdownProps): JSX.Element {
  console.log(user);
  const router = useRouter();
  const [copied, setCopied] = React.useState(false);

  const userId = user.id;
  const isMentor = Boolean(user.isMentor);
  const name = user.name ?? '';
  const avatarSrc = user.avatar ?? '';

  // 正常情況 userId 一定有；但型別是 optional，所以做個 fallback
  const profilePath = userId ? `/profile/${userId}` : '/';

  const handleGoProfile = (): void => {
    router.push(profilePath);
  };

  const handleShareProfile = async (): Promise<void> => {
    // AC: Copy "/profile/{user_id}" (path only)
    if (!userId) return;

    const fullUrl = `${window.location.origin}${profilePath}`;
    const ok = await copyToClipboard(fullUrl);

    if (!ok) return;

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleAsMentor = (): void => {
    if (!userId) return;

    if (isMentor) {
      router.push('/reservation/mentor');
    } else {
      router.push(`/profile/${userId}/edit?onboarding=true`);
    }
  };

  const handleMyReservation = (): void => {
    router.push('/reservation/mentee');
  };

  return (
    <DropdownMenu>
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
        {/* Top profile area (Avatar action) */}
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
            {copied ? 'Copied' : 'Share Profile'}
          </Button>
        </div>

        {/* 你沒有 DropdownMenuSeparator -> 用 div 當分隔線 */}
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
            onClick={() => signOut()}
          >
            Log out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
