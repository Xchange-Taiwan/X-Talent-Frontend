'use client';

import { Cross2Icon, HamburgerMenuIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { FC, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';

export const HamburgerMenu: FC = () => {
  const [open, setOpen] = useState(false);

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost">
          <HamburgerMenuIcon className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="h-screen w-screen">
        <div className="flex h-full flex-col justify-between">
          <SheetClose asChild className="ml-auto">
            <Cross2Icon className="text-blue-900 h-8 w-8" />
          </SheetClose>

          <div className="flex flex-col items-center gap-12 text-2xl">
            <Link
              href="/"
              className="text-black font-['Open_Sans']"
              onClick={handleClose}
            >
              首頁
            </Link>
            <Link
              href="/about"
              className="text-black font-['Open_Sans']"
              onClick={handleClose}
            >
              關於 X-Talent
            </Link>
          </div>

          <div className="mb-12 flex flex-col items-center gap-12">
            <Link href="/auth/signin">
              <Button className="bg-sky-600 hover:bg-sky-700 w-40">登入</Button>
            </Link>
            <Link href="/auth/signup">
              <Button
                variant="outline"
                className="border-sky-600 text-sky-600 hover:text-sky-700	w-40"
              >
                註冊
              </Button>
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
