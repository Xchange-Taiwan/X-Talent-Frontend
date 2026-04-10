'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { memo, useRef } from 'react';

import LogoImgUrl from '@/assets/logo.svg';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { HamburgerMenu } from './HamburgerMenu';
import { MobileUserMenu } from './MobileUserMenu';
import { UserDropdown } from './UserDropdown';

function HeaderComponent(): JSX.Element {
  const { data: session, status } = useSession();
  const wasAuthenticated = useRef(false);
  if (status === 'authenticated') wasAuthenticated.current = true;
  const isLoading = status === 'loading' && !wasAuthenticated.current;

  const isLoggedIn = Boolean(session?.user?.id);
  const isMentor = Boolean(session?.user?.isMentor);
  const userId = session?.user?.id;

  const findMentorHref = '/mentor-pool';

  const becomeMentorHref = !isLoggedIn
    ? '/auth/signup'
    : `/profile/${userId}/edit?onboarding=true`;

  const profileHref = userId ? `/profile/${userId}` : '/';

  const leftSecondNav = isMentor
    ? { label: '我的導師頁面', href: profileHref }
    : { label: '成為導師', href: becomeMentorHref };

  return (
    <header className="fixed inset-x-0 z-50 bg-light px-5">
      <div className="flex h-[70px] items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" aria-label="Go to homepage">
            <Image src={LogoImgUrl} alt="logo" />
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            <Link
              href={findMentorHref}
              className="text-black font-['Open_Sans'] text-base"
            >
              尋找導師
            </Link>

            {isLoading ? (
              <Skeleton className="h-4 w-20" />
            ) : (
              <Link
                href={leftSecondNav.href}
                className="text-black font-['Open_Sans'] text-base"
              >
                {leftSecondNav.label}
              </Link>
            )}

            <Link
              href="/about"
              className="text-black font-['Open_Sans'] text-base"
            >
              關於 X-Talent
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3 md:mr-20">
          <div className="hidden items-center gap-3 md:flex">
            {isLoading ? (
              <Skeleton className="h-8 w-20 rounded-full" />
            ) : !isLoggedIn ? (
              <>
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
              </>
            ) : (
              <UserDropdown user={session!.user} />
            )}
          </div>

          <div className="flex items-center gap-3 md:hidden">
            {isLoading ? (
              <Skeleton className="h-8 w-8 rounded-full" />
            ) : isLoggedIn ? (
              <MobileUserMenu user={session!.user} />
            ) : null}
            <HamburgerMenu
              isLoading={isLoading}
              isLoggedIn={isLoggedIn}
              isMentor={isMentor}
              userId={userId}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

export const Header = memo(HeaderComponent);
