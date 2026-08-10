'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { memo, useMemo } from 'react';

import LogoImgUrl from '@/assets/logo.svg';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStatus } from '@/hooks/user/auth/useAuthStatus';
import { useSessionHint } from '@/hooks/user/auth/useSessionHint';
import { useCurrentAvatar } from '@/hooks/user/profile/useCurrentAvatar';
import { trackEvent } from '@/lib/analytics';

import { FEEDBACK_FORM_URL } from './constants';
import { DisabledAwareLink } from './DisabledAwareLink';
import { HamburgerMenu } from './HamburgerMenu';
import { MobileUserMenu } from './MobileUserMenu';
import { getBecomeMentorHref, getProfileHref } from './navHrefs';
import { UserDropdown } from './UserDropdown';

function HeaderComponent(): JSX.Element {
  const { data: session } = useSession();
  const hint = useSessionHint();
  const currentAvatar = useCurrentAvatar();
  const { authKnown, isLoggedIn, isMentor, userId, isResolvingUser } =
    useAuthStatus();

  const resolvedIsMentor = authKnown
    ? isMentor
    : hint.status === 'authenticated'
      ? hint.isMentor
      : isMentor;

  const virtualUser = useMemo(() => {
    if (session?.user) {
      return {
        ...session.user,
        avatar: currentAvatar ?? undefined,
      };
    }
    return {
      id: userId,
      isMentor: resolvedIsMentor,
      avatar: currentAvatar ?? undefined,
      name: '',
      email: '',
    };
  }, [session?.user, userId, resolvedIsMentor, currentAvatar]);

  const findMentorHref = '/mentor-pool';

  // `userId` only ever comes from the real session, never the hint — while
  // isResolvingUser is true these hrefs are unused (the link is disabled).
  const leftSecondNav = resolvedIsMentor
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
            {!isLoggedIn && (
              <Link
                href={findMentorHref}
                className="font-['Open_Sans'] text-base text-text-primary group-data-[auth-state=mentee]:hidden group-data-[auth-state=mentor]:hidden"
              >
                尋找導師
              </Link>
            )}

            {!authKnown ? (
              <>
                <Skeleton className="h-6 w-24 group-data-[auth-state=mentee]:hidden group-data-[auth-state=mentor]:hidden" />
                <DisabledAwareLink
                  href={getProfileHref(userId)}
                  disabled={isResolvingUser}
                  className="hidden font-['Open_Sans'] text-base text-text-primary group-data-[auth-state=mentor]:block"
                >
                  我的導師頁面
                </DisabledAwareLink>
                <DisabledAwareLink
                  href={getBecomeMentorHref(userId)}
                  disabled={isResolvingUser}
                  className="hidden font-['Open_Sans'] text-base text-text-primary group-data-[auth-state=mentee]:block"
                >
                  成為導師
                </DisabledAwareLink>
              </>
            ) : (
              <DisabledAwareLink
                href={leftSecondNav.href}
                disabled={isResolvingUser}
                className="font-['Open_Sans'] text-base text-text-primary"
              >
                {leftSecondNav.label}
              </DisabledAwareLink>
            )}

            {!isLoggedIn && (
              <>
                <Link
                  href="/about"
                  className="font-['Open_Sans'] text-base text-text-primary group-data-[auth-state=mentee]:hidden group-data-[auth-state=mentor]:hidden"
                >
                  關於 X-Talent
                </Link>

                <a
                  href={FEEDBACK_FORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="提供回饋（另開新分頁）"
                  onClick={() => trackEvent({ name: 'feedback_open' })}
                  className="font-['Open_Sans'] text-base text-text-primary group-data-[auth-state=mentee]:hidden group-data-[auth-state=mentor]:hidden"
                >
                  提供回饋
                </a>
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3 lg:mr-20">
          <div className="hidden items-center gap-3 lg:flex">
            {!authKnown ? (
              <>
                <div className="group-data-[auth-state=mentee]:hidden group-data-[auth-state=mentor]:hidden">
                  <Skeleton className="size-9 rounded-full" />
                </div>
                <div className="hidden size-8 rounded-full bg-[image:var(--auth-avatar)] bg-cover bg-center group-data-[auth-state=mentee]:block group-data-[auth-state=mentor]:block" />
              </>
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
            ) : isLoggedIn ? (
              <UserDropdown
                user={virtualUser}
                findMentorHref={findMentorHref}
              />
            ) : (
              <Skeleton className="size-9 rounded-full" />
            )}
          </div>

          <div className="flex items-center gap-3 lg:hidden">
            {isLoggedIn ? (
              <MobileUserMenu
                user={virtualUser}
                findMentorHref={findMentorHref}
              />
            ) : (
              <>
                {!authKnown && (
                  <div className="hidden size-8 rounded-full bg-[image:var(--auth-avatar)] bg-cover bg-center group-data-[auth-state=mentee]:block group-data-[auth-state=mentor]:block" />
                )}
                <div className="group-data-[auth-state=mentee]:hidden group-data-[auth-state=mentor]:hidden">
                  <HamburgerMenu
                    isLoggedIn={isLoggedIn}
                    isMentor={resolvedIsMentor}
                    userId={userId}
                    isResolvingUser={isResolvingUser}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export const Header = memo(HeaderComponent);
