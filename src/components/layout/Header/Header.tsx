'use client';

import Image from 'next/image';
import Link from 'next/link';

import LogoImgUrl from '@/assets/logo.svg';
import { DeleteAccountDialog } from '@/components/auth/DeleteAccountDialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getNavAnalyticsAttributes,
  useHeaderNavigation,
} from '@/hooks/layout/useHeaderNavigation';
import { useResolvedIdentity } from '@/hooks/user/auth/useResolvedIdentity';
import { FOCUS_RING_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

import { AuthHintGate, AuthHintProvider } from './AuthHintGate';
import { DisabledAwareLink } from './DisabledAwareLink';
import { GuestActionButtons } from './GuestActionButtons';
import { HamburgerMenu } from './HamburgerMenu';
import { MobileUserMenu } from './MobileUserMenu';
import { NotificationBell } from './NotificationBell';
import { ShareProfileDialog } from './ShareProfileDialog';
import { UserDropdown } from './UserDropdown';

const DESKTOP_NAV_LINK_BASE = `relative rounded-sm py-1 text-base font-medium after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:transition-transform after:duration-200 ${FOCUS_RING_CLASSES}`;
const DESKTOP_NAV_LINK_HOVER = 'after:bg-brand-500 hover:after:scale-x-100';
const DESKTOP_NAV_LINK = `${DESKTOP_NAV_LINK_BASE} ${DESKTOP_NAV_LINK_HOVER}`;

export function Header(): JSX.Element {
  const identity = useResolvedIdentity();
  const navigation = useHeaderNavigation({ identity });
  const { desktopNav, desktopGuestAuth, profileHeader } = navigation;
  const isMemberState =
    identity.state === 'confirmed-member' || identity.state === 'hint-only';
  const isConfirmedMember = identity.state === 'confirmed-member';

  return (
    <AuthHintProvider identity={identity}>
      <header className="bg-light fixed inset-x-0 top-[var(--banner-height,0px)] z-50 px-5">
        <div className="mx-auto flex h-[70px] max-w-7xl items-center justify-between">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-8">
            <Link
              href="/"
              aria-label="Go to homepage"
              data-analytics-click="header_logo"
              data-analytics-location="header"
              data-analytics-feature="navigation"
              className={`rounded-sm ${FOCUS_RING_CLASSES}`}
            >
              <Image
                src={LogoImgUrl}
                alt="X-Talent Logo"
                width={158}
                height={33}
                style={{ width: 'auto' }}
                priority
              />
            </Link>

            <nav className="hidden items-center gap-8 lg:flex">
              <Link
                href={desktopNav.findMentor.href}
                aria-current={
                  desktopNav.findMentor.isCurrent ? 'page' : undefined
                }
                {...getNavAnalyticsAttributes(desktopNav.findMentor.analytics)}
                className={DESKTOP_NAV_LINK}
              >
                {desktopNav.findMentor.label}
              </Link>

              {identity.state === 'unknown' ? (
                <>
                  <AuthHintGate asChild when="unhinted">
                    <Skeleton className="h-6 w-24" />
                  </AuthHintGate>
                  <AuthHintGate asChild when={['mentor']}>
                    <DisabledAwareLink
                      href={desktopNav.mentorRoleCandidate.href}
                      disabled={desktopNav.mentorRoleCandidate.disabled}
                      aria-current={
                        desktopNav.mentorRoleCandidate.isCurrent
                          ? 'page'
                          : undefined
                      }
                      {...getNavAnalyticsAttributes(
                        desktopNav.mentorRoleCandidate.analytics
                      )}
                      className={DESKTOP_NAV_LINK}
                    >
                      {desktopNav.mentorRoleCandidate.label}
                    </DisabledAwareLink>
                  </AuthHintGate>
                  <AuthHintGate asChild when={['guest', 'mentee']}>
                    <DisabledAwareLink
                      href={desktopNav.nonMentorRoleCandidate.href}
                      disabled={desktopNav.nonMentorRoleCandidate.disabled}
                      aria-current={
                        desktopNav.nonMentorRoleCandidate.isCurrent
                          ? 'page'
                          : undefined
                      }
                      {...getNavAnalyticsAttributes(
                        desktopNav.nonMentorRoleCandidate.analytics
                      )}
                      className={DESKTOP_NAV_LINK}
                    >
                      {desktopNav.nonMentorRoleCandidate.label}
                    </DisabledAwareLink>
                  </AuthHintGate>
                </>
              ) : (
                <DisabledAwareLink
                  href={desktopNav.resolvedRoleItem.href}
                  disabled={desktopNav.resolvedRoleItem.disabled}
                  aria-current={
                    desktopNav.resolvedRoleItem.isCurrent ? 'page' : undefined
                  }
                  {...getNavAnalyticsAttributes(
                    desktopNav.resolvedRoleItem.analytics
                  )}
                  className={cn(
                    DESKTOP_NAV_LINK_BASE,
                    !desktopNav.resolvedRoleItem.disabled &&
                      DESKTOP_NAV_LINK_HOVER
                  )}
                >
                  {desktopNav.resolvedRoleItem.label}
                </DisabledAwareLink>
              )}

              <Link
                href={desktopNav.about.href}
                aria-current={desktopNav.about.isCurrent ? 'page' : undefined}
                {...getNavAnalyticsAttributes(desktopNav.about.analytics)}
                className={DESKTOP_NAV_LINK}
              >
                {desktopNav.about.label}
              </Link>

              <a
                href={desktopNav.feedback.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={desktopNav.feedback.ariaLabel}
                onClick={desktopNav.feedback.onClick}
                className={DESKTOP_NAV_LINK}
              >
                {desktopNav.feedback.label}
              </a>
            </nav>
          </div>

          {/* Right: Auth buttons / User menu / Mobile menus */}
          <div className="flex items-center">
            {/* Desktop */}
            <div
              className="hidden items-center gap-5 lg:flex"
              data-testid="desktop-header-right"
            >
              <AuthHintGate when="unhinted">
                <Skeleton className="size-9 rounded-full" />
              </AuthHintGate>
              <AuthHintGate
                asChild
                when={['mentee', 'mentor']}
                onlyWhileUnknown
              >
                <div className="size-8 rounded-full bg-[image:var(--auth-avatar)] bg-cover bg-center" />
              </AuthHintGate>

              <GuestActionButtons
                signup={desktopGuestAuth.signup}
                signin={desktopGuestAuth.signin}
              />

              {isMemberState && (
                <>
                  <NotificationBell
                    className="hidden lg:flex"
                    userId={identity.userId}
                    key={identity.userId ?? 'guest'}
                  />
                  <UserDropdown navigation={navigation} />
                </>
              )}
            </div>

            {/* Mobile + Tablet */}
            <div
              className="flex items-center gap-3 lg:hidden"
              data-testid="mobile-header-right"
            >
              <AuthHintGate
                asChild
                when={['mentee', 'mentor']}
                onlyWhileUnknown
              >
                <Skeleton className="size-9 rounded-full" />
              </AuthHintGate>
              <AuthHintGate
                asChild
                when={['mentee', 'mentor']}
                onlyWhileUnknown
              >
                <div className="size-8 rounded-full bg-[image:var(--auth-avatar)] bg-cover bg-center" />
              </AuthHintGate>

              {isMemberState && (
                <>
                  <NotificationBell
                    userId={identity.userId}
                    key={identity.userId ?? 'guest'}
                  />
                  <MobileUserMenu navigation={navigation} />
                </>
              )}
              <HamburgerMenu navigation={navigation} />
            </div>
          </div>
        </div>
      </header>

      {isConfirmedMember && navigation.canDeleteAccount && (
        <DeleteAccountDialog
          key={identity.userId}
          open={navigation.activeDialog === 'delete-account'}
          onOpenChange={(open) =>
            navigation.setActiveDialog(open ? 'delete-account' : null)
          }
        />
      )}

      {isConfirmedMember && (
        <ShareProfileDialog
          key={identity.userId}
          open={navigation.activeDialog === 'share-profile'}
          onOpenChange={(open) =>
            navigation.setActiveDialog(open ? 'share-profile' : null)
          }
          name={profileHeader.displayName}
          avatarSrc={profileHeader.avatarSrc}
          subtitle={profileHeader.subtitle}
          profilePath={profileHeader.href}
          personalLinks={profileHeader.personalLinks}
        />
      )}
    </AuthHintProvider>
  );
}
