'use client';

import Image from 'next/image';
import Link from 'next/link';

import LogoImgUrl from '@/assets/logo.svg';
import { DeleteAccountDialog } from '@/components/auth/DeleteAccountDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useHeaderNavigation } from '@/hooks/layout/useHeaderNavigation';
import { useResolvedIdentity } from '@/hooks/user/auth/useResolvedIdentity';
import { getNavAnalyticsAttributes } from '@/lib/navigation/headerNavigationModel';
import { FOCUS_RING_CLASSES } from '@/lib/ui/focusRing';
import { HOVER_NAV_UNDERLINE_CLASSES } from '@/lib/ui/hoverStyles';
import { cn } from '@/lib/utils';

import { AuthHintGate, AuthHintProvider } from './AuthHintGate';
import { DisabledAwareLink } from './DisabledAwareLink';
import { GuestActionButtons } from './GuestActionButtons';
import { HamburgerMenu } from './HamburgerMenu';
import { MobileUserMenu } from './MobileUserMenu';
import { NotificationBell } from './NotificationBell';
import { ShareProfileDialog } from './ShareProfileDialog';
import { UserDropdown } from './UserDropdown';

const DESKTOP_NAV_LINK_BASE = `text-text-primary font-open-sans rounded-sm text-base ${FOCUS_RING_CLASSES}`;
const DESKTOP_NAV_LINK = `${DESKTOP_NAV_LINK_BASE} ${HOVER_NAV_UNDERLINE_CLASSES}`;

export function Header(): JSX.Element {
  const identity = useResolvedIdentity();
  const navigation = useHeaderNavigation({ identity });
  const {
    desktopAccountMenu,
    desktopGuestAuth,
    desktopNav,
    mobileAccountMenu,
    mobileGuestMenu,
    profileHeader,
  } = navigation;
  const isMemberState =
    identity.state === 'confirmed-member' || identity.state === 'hint-only';
  const isConfirmedMember = identity.state === 'confirmed-member';

  return (
    <AuthHintProvider identity={identity}>
      <header className="bg-light fixed inset-x-0 top-[var(--banner-height,0px)] z-50 px-5">
        <div className="flex h-[70px] items-center justify-between">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-10">
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
                className="h-auto w-auto"
                priority
              />
            </Link>

            <nav className="hidden items-center gap-7 lg:flex">
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
                      className={cn(
                        DESKTOP_NAV_LINK_BASE,
                        !desktopNav.mentorRoleCandidate.disabled &&
                          HOVER_NAV_UNDERLINE_CLASSES
                      )}
                    >
                      {desktopNav.mentorRoleCandidate.label}
                    </DisabledAwareLink>
                  </AuthHintGate>
                  <AuthHintGate asChild when={['mentee']}>
                    <DisabledAwareLink
                      href={desktopNav.menteeRoleCandidate.href}
                      disabled={desktopNav.menteeRoleCandidate.disabled}
                      aria-current={
                        desktopNav.menteeRoleCandidate.isCurrent
                          ? 'page'
                          : undefined
                      }
                      {...getNavAnalyticsAttributes(
                        desktopNav.menteeRoleCandidate.analytics
                      )}
                      className={cn(
                        DESKTOP_NAV_LINK_BASE,
                        !desktopNav.menteeRoleCandidate.disabled &&
                          HOVER_NAV_UNDERLINE_CLASSES
                      )}
                    >
                      {desktopNav.menteeRoleCandidate.label}
                    </DisabledAwareLink>
                  </AuthHintGate>
                  <AuthHintGate asChild when={['guest']}>
                    <DisabledAwareLink
                      href={desktopNav.guestRoleCandidate.href}
                      disabled={desktopNav.guestRoleCandidate.disabled}
                      aria-current={
                        desktopNav.guestRoleCandidate.isCurrent
                          ? 'page'
                          : undefined
                      }
                      {...getNavAnalyticsAttributes(
                        desktopNav.guestRoleCandidate.analytics
                      )}
                      className={cn(
                        DESKTOP_NAV_LINK_BASE,
                        !desktopNav.guestRoleCandidate.disabled &&
                          HOVER_NAV_UNDERLINE_CLASSES
                      )}
                    >
                      {desktopNav.guestRoleCandidate.label}
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
                      HOVER_NAV_UNDERLINE_CLASSES
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
          <div className="flex items-center gap-3 lg:mr-20">
            {/* Desktop */}
            <div
              className="hidden items-center gap-3 lg:flex"
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
                  <UserDropdown
                    profileHeader={profileHeader}
                    menu={desktopAccountMenu}
                  />
                </>
              )}
            </div>

            {/* Mobile + Tablet */}
            <div
              className="flex items-center gap-3 lg:hidden"
              data-testid="mobile-header-right"
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

              {isMemberState && (
                <>
                  <NotificationBell
                    userId={identity.userId}
                    key={identity.userId ?? 'guest'}
                  />
                  <MobileUserMenu
                    profileHeader={profileHeader}
                    menu={mobileAccountMenu}
                  />
                </>
              )}
              <HamburgerMenu menu={mobileGuestMenu} />
            </div>
          </div>
        </div>
      </header>

      {isConfirmedMember && navigation.canDeleteAccount && (
        <DeleteAccountDialog
          key={`delete-${identity.userId}`}
          open={navigation.activeDialog === 'delete-account'}
          onOpenChange={(open) =>
            navigation.setActiveDialog(open ? 'delete-account' : null)
          }
        />
      )}

      {isConfirmedMember && (
        <ShareProfileDialog
          key={`share-${identity.userId}`}
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
