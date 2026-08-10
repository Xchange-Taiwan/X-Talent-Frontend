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

import { FEEDBACK_FORM_URL } from './constants';

export function HamburgerMenu(): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const close = (): void => setOpen(false);

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
              href="/mentor-pool"
              onClick={close}
              className="text-text-primary"
            >
              尋找導師
            </Link>

            <Link
              href="/auth/signup"
              onClick={close}
              className="text-text-primary"
            >
              成為導師
            </Link>

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

          <div className="mt-auto flex flex-col items-center gap-6 pb-6">
            <Link href="/auth/signin" onClick={close}>
              <Button className="w-40 bg-brand-500 hover:bg-brand-500">
                登入
              </Button>
            </Link>
            <Link href="/auth/signup" onClick={close}>
              <Button
                variant="outline"
                className="w-40 border-brand-500 text-brand-500 hover:text-brand-500"
              >
                註冊
              </Button>
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
