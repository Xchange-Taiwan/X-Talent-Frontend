'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { memo, useMemo } from 'react';

import LogoImgUrl from '@/assets/logo.svg';
import { Skeleton } from '@/components/ui/skeleton';
import { useIdentity } from '@/hooks/user/auth/useIdentity';
import { useCurrentAvatar } from '@/hooks/user/profile/useCurrentAvatar';
import { trackEvent } from '@/lib/analytics';

import { FEEDBACK_FORM_URL, FIND_MENTOR_HREF } from './constants';
import { DisabledAwareLink } from './DisabledAwareLink';
import { GuestActionButtons } from './GuestActionButtons';
import { HamburgerMenu } from './HamburgerMenu';
import { MobileUserMenu } from './MobileUserMenu';
import { getBecomeMentorHref, getProfileHref } from './navHrefs';
import { NotificationBell } from './NotificationBell';
import { UserDropdown } from './UserDropdown';

function HeaderComponent(): JSX.Element {
  const { data: session } = useSession();
  const currentAvatar = useCurrentAvatar();
  const identity = useIdentity(null);

  const virtualUser = useMemo(() => {
    if (session?.user) {
      return {
        ...session.user,
        avatar: currentAvatar ?? undefined,
      };
    }
    return {
      id: identity.userId,
      isMentor: identity.isMentor,
      avatar: currentAvatar ?? undefined,
      name: '',
      email: '',
    };
  }, [session?.user, identity.userId, identity.isMentor, currentAvatar]);

  // `userId` only ever comes from the real session, never the hint — while
  // the state is hint-only these hrefs are unused (the link is disabled).
  const leftSecondNav = identity.isMentor
    ? { label: '我的導師頁面', href: getProfileHref(identity.userId) }
    : { label: '成為導師', href: getBecomeMentorHref(identity.userId) };

  return (
    <header className="fixed inset-x-0 top-[var(--banner-height,0px)] z-50 bg-light px-5">
      <div className="flex h-[70px] items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" aria-label="Go to homepage">
            <Image src={LogoImgUrl} alt="logo" />
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            <Link
              href={FIND_MENTOR_HREF}
              className="font-['Open_Sans'] text-base text-text-primary"
            >
              尋找導師
            </Link>

            {identity.state === 'unknown' ? (
              <>
                <Skeleton className="h-6 w-24 group-data-[auth-state=guest]/auth-state:hidden group-data-[auth-state=mentee]/auth-state:hidden group-data-[auth-state=mentor]/auth-state:hidden" />
                <DisabledAwareLink
                  href={getProfileHref(identity.userId)}
                  disabled={false}
                  className="hidden font-['Open_Sans'] text-base text-text-primary group-data-[auth-state=mentor]/auth-state:block"
                >
                  我的導師頁面
                </DisabledAwareLink>
                <DisabledAwareLink
                  href={getBecomeMentorHref(identity.userId)}
                  disabled={false}
                  className="hidden font-['Open_Sans'] text-base text-text-primary group-data-[auth-state=guest]/auth-state:block group-data-[auth-state=mentee]/auth-state:block"
                >
                  成為導師
                </DisabledAwareLink>
              </>
            ) : (
              <DisabledAwareLink
                href={leftSecondNav.href}
                disabled={identity.state === 'hint-only'}
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
          <div
            className="hidden items-center gap-3 lg:flex"
            data-testid="desktop-header-right"
          >
            {identity.state === 'unknown' ? (
              <>
                <div className="group-data-[auth-state=guest]/auth-state:hidden group-data-[auth-state=mentee]/auth-state:hidden group-data-[auth-state=mentor]/auth-state:hidden">
                  <Skeleton className="size-9 rounded-full" />
                </div>
                <div className="hidden size-8 rounded-full bg-[image:var(--auth-avatar)] bg-cover bg-center group-data-[auth-state=mentee]/auth-state:block group-data-[auth-state=mentor]/auth-state:block" />
                <GuestActionButtons identity={identity} />
              </>
            ) : identity.state === 'confirmed-guest' ? (
              <GuestActionButtons identity={identity} />
            ) : (
              <>
                <NotificationBell
                  className="hidden lg:flex"
                  userId={identity.userId}
                  key={identity.userId ?? 'guest'}
                />
                <UserDropdown identity={identity} user={virtualUser} />
              </>
            )}
          </div>

          <div
            className="flex items-center gap-3 lg:hidden"
            data-testid="mobile-header-right"
          >
            {identity.state === 'unknown' ? (
              <>
                <Skeleton className="hidden size-9 rounded-full group-data-[auth-state=mentee]/auth-state:block group-data-[auth-state=mentor]/auth-state:block" />
                <div className="hidden size-8 rounded-full bg-[image:var(--auth-avatar)] bg-cover bg-center group-data-[auth-state=mentee]/auth-state:block group-data-[auth-state=mentor]/auth-state:block" />
              </>
            ) : identity.state === 'confirmed-guest' ? null : (
              <>
                <NotificationBell
                  userId={identity.userId}
                  key={identity.userId ?? 'guest'}
                />
                <MobileUserMenu identity={identity} user={virtualUser} />
              </>
            )}
            <HamburgerMenu identity={identity} />
          </div>
        </div>
      </div>
    </header>
  );
}

export const Header = memo(HeaderComponent);
