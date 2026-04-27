'use client';

import { Cross2Icon, HamburgerMenuIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
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
        <Button variant="ghost" aria-label="開啟導航選單">
          <HamburgerMenuIcon className="h-6 w-6" aria-hidden="true" />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="h-dvh w-screen">
        <SheetTitle className="sr-only">導航選單</SheetTitle>
        <div className="flex h-full flex-col">
          <SheetClose asChild>
            <button type="button" aria-label="關閉導航選單" className="ml-auto">
              <Cross2Icon
                className="text-blue-900 h-8 w-8"
                aria-hidden="true"
              />
            </button>
          </SheetClose>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 text-2xl">
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
          </div>

          {!isLoggedIn && (
            <div className="mt-auto flex flex-col items-center gap-6 pb-6">
              {isLoading ? (
                <>
                  <Skeleton className="h-10 w-40 rounded-md" />
                  <Skeleton className="h-10 w-40 rounded-md" />
                </>
              ) : (
                <>
                  <Link href="/auth/signin" onClick={close}>
                    <Button className="w-40 bg-primary hover:bg-primary">
                      登入
                    </Button>
                  </Link>
                  <Link href="/auth/signup" onClick={close}>
                    <Button
                      variant="outline"
                      className="w-40 border-primary text-primary hover:text-primary"
                    >
                      註冊
                    </Button>
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
