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
import { trackEvent } from '@/lib/analytics';

import { FEEDBACK_FORM_URL, FIND_MENTOR_HREF } from './constants';
import { DisabledAwareLink } from './DisabledAwareLink';
import { getBecomeMentorHref, getProfileHref } from './navHrefs';

export type HamburgerMenuProps = {
  isLoggedIn: boolean;
  isMentor: boolean;
  userId?: string;
  /**
   * Logged in per the fast session hint, but `userId` hasn't landed yet —
   * owned by Header's `useIdentity()`, passed down rather than re-derived
   * here so the two never drift out of sync.
   */
  isResolvingUser: boolean;
};

export function HamburgerMenu({
  isLoggedIn,
  isMentor,
  userId,
  isResolvingUser,
}: HamburgerMenuProps): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const close = (): void => setOpen(false);

  const profilePath = getProfileHref(userId);
  const becomeMentorPath = getBecomeMentorHref(userId);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" aria-label="開啟導航選單">
          <HamburgerMenuIcon className="size-6" aria-hidden="true" />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="h-dvh w-screen">
        <SheetTitle className="sr-only">導航選單</SheetTitle>
        <div className="flex h-full flex-col">
          <SheetClose asChild>
            <button type="button" aria-label="關閉導航選單" className="ml-auto">
              <Cross2Icon
                className="size-8 text-brand-900"
                aria-hidden="true"
              />
            </button>
          </SheetClose>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 text-2xl">
            <Link
              href={FIND_MENTOR_HREF}
              onClick={close}
              className="text-text-primary"
            >
              尋找導師
            </Link>

            {isMentor ? (
              <DisabledAwareLink
                href={profilePath}
                onClick={close}
                disabled={isResolvingUser}
                className="text-text-primary"
              >
                我的導師頁面
              </DisabledAwareLink>
            ) : (
              <DisabledAwareLink
                href={becomeMentorPath}
                onClick={close}
                disabled={isResolvingUser}
                className="text-text-primary"
              >
                成為導師
              </DisabledAwareLink>
            )}

            <Link href="/about" onClick={close} className="text-text-primary">
              關於 X-Talent
            </Link>

            <a
              href={FEEDBACK_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="提供回饋（另開新分頁）"
              onClick={() => {
                trackEvent({ name: 'feedback_open' });
                close();
              }}
              className="text-text-primary"
            >
              提供回饋
            </a>
          </div>

          {!isLoggedIn && (
            <div className="mt-auto flex flex-col items-center gap-6 pb-6">
              <Button asChild className="w-40 bg-brand-500 hover:bg-brand-500">
                <Link href="/auth/signin" onClick={close}>
                  登入
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-40 border-brand-500 text-brand-500 hover:text-brand-500"
              >
                <Link href="/auth/signup" onClick={close}>
                  註冊
                </Link>
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
