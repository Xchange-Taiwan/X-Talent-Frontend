'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { memo } from 'react';

import LogoImgUrl from '@/assets/logo.svg';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStatus } from '@/hooks/user/auth/useAuthStatus';
import { trackEvent } from '@/lib/analytics';

import { FEEDBACK_FORM_URL } from './constants';
import { DisabledAwareLink } from './DisabledAwareLink';
import { HamburgerMenu } from './HamburgerMenu';
import { MobileUserMenu } from './MobileUserMenu';
import { getBecomeMentorHref, getProfileHref } from './navHrefs';
import { UserDropdown } from './UserDropdown';

function HeaderComponent(): JSX.Element {
  const { data: session } = useSession();
  const {
    authKnown,
    isLoggedIn,
    isMentor,
    userId,
    hasFullUser,
    isResolvingUser,
  } = useAuthStatus();

  const findMentorHref = '/mentor-pool';

  // `userId` only ever comes from the real session, never the hint — while
  // isResolvingUser is true these hrefs are unused (the link is disabled).
  const leftSecondNav = isMentor
    ? { label: '我的導師頁面', href: getProfileHref(userId) }
    : { label: '成為導師', href: getBecomeMentorHref(userId) };

  return (
    <header className="fixed inset-x-0 top-[var(--banner-height,0px)] z-50 bg-light px-5">
      <div className="flex h-[70px] items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" aria-label="Go to homepage">
            <Image src={LogoImgUrl} alt="logo" />
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            <Link
              href={findMentorHref}
              className="font-['Open_Sans'] text-base text-text-primary"
            >
              尋找導師
            </Link>

            {!authKnown ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <DisabledAwareLink
                href={leftSecondNav.href}
                disabled={isResolvingUser}
                className="font-['Open_Sans'] text-base text-text-primary"
              >
                {leftSecondNav.label}
              </DisabledAwareLink>
            )}

            <Link
              href="/about"
              className="font-['Open_Sans'] text-base text-text-primary"
            >
              關於 X-Talent
            </Link>

            <a
              href={FEEDBACK_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="提供回饋（另開新分頁）"
              onClick={() => trackEvent({ name: 'feedback_open' })}
              className="font-['Open_Sans'] text-base text-text-primary"
            >
              提供回饋
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-3 lg:mr-20">
          <div className="hidden items-center gap-3 lg:flex">
            {!authKnown ? (
              <Skeleton className="size-9 rounded-full" />
            ) : !isLoggedIn ? (
              <>
                <Link href="/auth/signup">
                  <Button
                    variant="outline"
                    className="border-brand-500 text-brand-500 hover:text-brand-500"
                  >
                    註冊
                  </Button>
                </Link>

                <Link href="/auth/signin">
                  <Button className="bg-brand-500 hover:bg-brand-500">
                    登入
                  </Button>
                </Link>
              </>
            ) : hasFullUser ? (
              <UserDropdown user={session!.user} />
            ) : (
              <Skeleton className="size-9 rounded-full" />
            )}
          </div>

          <div className="flex items-center gap-3 lg:hidden">
            {hasFullUser ? <MobileUserMenu user={session!.user} /> : null}
            <HamburgerMenu
              isLoggedIn={isLoggedIn}
              isMentor={isMentor}
              userId={userId}
              isResolvingUser={isResolvingUser}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

export const Header = memo(HeaderComponent);
