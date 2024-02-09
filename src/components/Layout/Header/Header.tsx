import Image from 'next/image';
import Link from 'next/link';
import { FC } from 'react';

import LogoImgUrl from '@/assets/logo.svg';
import { Button } from '@/components/ui/button';

import { HamburgerMenu } from './HamburgerMenu';

export const Header: FC = () => {
  return (
    <header className="fixed inset-x-0 z-50 bg-light px-5 text-2xl">
      <div className="flex h-[70px] items-center justify-between">
        <Link href="/">
          <Image src={LogoImgUrl} alt="logo" />
        </Link>

        <div className="hidden gap-7 md:flex md:items-center">
          <Link href="/" className="text-black font-['Open_Sans'] text-base">
            首頁
          </Link>
          <Link
            href="/about"
            className="text-black font-['Open_Sans'] text-base"
          >
            關於 X-Talent
          </Link>
          <Link href="/auth/signup">
            <Button
              variant="outline"
              className="border-primary text-primary hover:text-primary"
            >
              註冊
            </Button>
          </Link>
          <Link href="/auth/signin">
            <Button className="bg-primary hover:bg-primary">登入</Button>
          </Link>
        </div>

        <div className="md:hidden">
          <HamburgerMenu />
        </div>
      </div>
    </header>
  );
};
