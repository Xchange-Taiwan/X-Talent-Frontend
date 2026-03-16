'use client';

import { Cross2Icon, HamburgerMenuIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';

export type HamburgerMenuProps = {
  isLoading: boolean;
  isLoggedIn: boolean;
  isMentor: boolean;
  userId?: string;
};

export function HamburgerMenu({
  isLoading,
  isLoggedIn,
  isMentor,
  userId,
}: HamburgerMenuProps): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const close = (): void => setOpen(false);

  const profilePath = userId ? `/profile/${userId}` : '/';
  const becomeMentorPath = !isLoggedIn
    ? '/auth/signup'
    : `/profile/${userId}/edit?onboarding=true`;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" aria-label="Open menu">
          <HamburgerMenuIcon className="h-6 w-6" />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="h-screen w-screen">
        <div className="flex h-full flex-col justify-between">
          <SheetClose asChild className="ml-auto">
            <Cross2Icon className="text-blue-900 h-8 w-8" />
          </SheetClose>

          <div className="flex flex-col items-center gap-10 text-2xl">
            <Link href="/mentor-pool" onClick={close} className="text-black">
              尋找導師
            </Link>

            {isLoading ? (
              <Skeleton className="h-5 w-24" />
            ) : isMentor ? (
              <Link href={profilePath} onClick={close} className="text-black">
                我的導師頁面
              </Link>
            ) : (
              <Link
                href={becomeMentorPath}
                onClick={close}
                className="text-black"
              >
                成為導師
              </Link>
            )}

            <Link href="/about" onClick={close} className="text-black">
              關於 X-Talent
            </Link>

            {!isLoading && isLoggedIn && (
              <>
                <Link href={profilePath} onClick={close} className="text-black">
                  Avatar
                </Link>

                <Link
                  href={isMentor ? '/reservation/mentor' : becomeMentorPath}
                  onClick={close}
                  className="text-black"
                >
                  As a mentor
                </Link>

                <Link
                  href="/reservation/mentee"
                  onClick={close}
                  className="text-black"
                >
                  My reservation
                </Link>
              </>
            )}
          </div>

          <div className="mb-12 flex flex-col items-center gap-6">
            {isLoading ? (
              <Skeleton className="h-10 w-40 rounded-md" />
            ) : !isLoggedIn ? (
              <>
                <Link href="/auth/signin" onClick={close}>
                  <Button className="bg-sky-600 hover:bg-sky-700 w-40">
                    登入
                  </Button>
                </Link>
                <Link href="/auth/signup" onClick={close}>
                  <Button
                    variant="outline"
                    className="border-sky-600 text-sky-600 hover:text-sky-700 w-40"
                  >
                    註冊
                  </Button>
                </Link>
              </>
            ) : (
              <Button
                className="w-40 bg-primary hover:bg-primary"
                onClick={() => {
                  close();
                  signOut();
                }}
              >
                Log out
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
