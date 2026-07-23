'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { memo } from 'react';

import LogoImgUrl from '@/assets/logo.svg';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSessionHint } from '@/hooks/user/auth/useSessionHint';
import { trackEvent } from '@/lib/analytics';

import { FEEDBACK_FORM_URL } from './constants';
import { HamburgerMenu } from './HamburgerMenu';
import { MobileUserMenu } from './MobileUserMenu';
import { UserDropdown } from './UserDropdown';

function HeaderComponent(): JSX.Element {
  const { data: session } = useSession();
  const hint = useSessionHint();

  // `session` (from useSession) is the only source ever used for hrefs that
  // need a real user id — the hint cookie intentionally carries no id, so a
  // hint-only "logged in" state must never build a `/profile/${userId}` URL.
  const userId = session?.user?.id;
  const hasFullUser = Boolean(userId);

  // Before the full session lands, fall back to the hint cookie (written by
  // middleware from a fast local JWT check) so the header doesn't sit blank
  // for the length of the /api/auth/session round trip — which can itself be
  // blocked on a backend token-refresh call. Once the real session resolves
  // it always wins over a possibly-stale hint.
  const authKnown = hasFullUser || hint.status !== 'unknown';
  const isLoggedIn = hasFullUser ? true : hint.status === 'authenticated';
  const isMentor = hasFullUser
    ? Boolean(session?.user?.isMentor)
    : hint.status === 'authenticated' && hint.isMentor;

  const findMentorHref = '/mentor-pool';

  const becomeMentorHref = userId
    ? `/profile/${userId}/edit?onboarding=true`
    : '/auth/signup';

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

            <Link
              href={leftSecondNav.href}
              className="text-black font-['Open_Sans'] text-base"
            >
              {leftSecondNav.label}
            </Link>

            <Link
              href="/about"
              className="text-black font-['Open_Sans'] text-base"
            >
              關於 X-Talent
            </Link>

            <a
              href={FEEDBACK_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="提供回饋（另開新分頁）"
              onClick={() => trackEvent({ name: 'feedback_open' })}
              className="text-black font-['Open_Sans'] text-base"
            >
              提供回饋
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-3 md:mr-20">
          <div className="hidden items-center gap-3 md:flex">
            {!authKnown ? (
              <Skeleton className="h-9 w-9 rounded-full" />
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
            ) : hasFullUser ? (
              <UserDropdown user={session!.user} />
            ) : (
              <Skeleton className="h-9 w-9 rounded-full" />
            )}
          </div>

          <div className="flex items-center gap-3 md:hidden">
            {hasFullUser ? <MobileUserMenu user={session!.user} /> : null}
            <HamburgerMenu
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
