import Image from 'next/image';
import Link from 'next/link';
import { FC } from 'react';

import LogoImgUrl from '@/assets/logo.svg';
import { Button } from '@/components/ui/button';

import { HamburgerMenu } from './HamburgerMenu';

export const Header: FC = () => {
  return (
    <header className="fixed inset-x-0 z-50 bg-white px-5 text-2xl">
      <div className="flex h-[70px] items-center justify-between">
        <Link href="/">
          <Image src={LogoImgUrl} alt="logo" />
        </Link>

        <div className="hidden gap-7 md:flex md:items-center">
          <Link href="/" className="font-['Open_Sans'] text-base text-black">
            首頁
          </Link>
          <Link
            href="/about"
            className="font-['Open_Sans'] text-base text-black"
          >
            關於 X-Talent
          </Link>
          <Link href="/auth/signup">
            <Button
              variant="outline"
              className="border-sky-600 text-sky-600 hover:text-sky-700	"
            >
              註冊
            </Button>
          </Link>
          <Link href="/auth/signin">
            <Button className="bg-sky-600 hover:bg-sky-700">登入</Button>
          </Link>
        </div>

        <div className="md:hidden">
          <HamburgerMenu />
        </div>
      </div>
    </header>
  );
};
