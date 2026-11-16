'use client';

import { usePathname } from 'next/navigation';
import type { Session } from 'next-auth';
import { signOut } from 'next-auth/react';
import * as React from 'react';

import { FEEDBACK_FORM_URL } from '@/constant/externalLinks';
import { trackEvent } from '@/lib/analytics';
import { type ResolvedIdentity } from '@/lib/auth/sessionHint';
import { terminateClientSession } from '@/lib/auth/sessionLifecycle';
import { isFavoritesEnabled } from '@/lib/featureFlags';
import {
  ABOUT_HREF,
  FAVORITES_HREF,
  FIND_MENTOR_HREF,
  getBecomeMentorHref,
  getMentorOnboardingUrl,
  getProfileHref,
  RESERVATION_MENTEE_HREF,
  RESERVATION_MENTOR_HREF,
  SIGNIN_HREF,
  SIGNUP_HREF,
} from '@/lib/routes';
import type { PersonalLink } from '@/types/types';

export const EXTERNAL_FEEDBACK_ARIA_LABEL = '提供回饋（另開新分頁）';

export type NavAnalyticsFeature =
  'navigation' | 'onboarding' | 'profile' | 'reservation' | 'auth';

export type NavAnalyticsLocation =
  'header' | 'mobile_menu' | 'user_dropdown' | 'mobile_user_menu';

export interface NavAnalyticsMetadata {
  click: string;
  location: NavAnalyticsLocation;
  feature: NavAnalyticsFeature;
  omitDestination?: boolean;
}

export interface HeaderLinkDescriptor {
  id: string;
  kind: 'link';
  label: string;
  href: string;
  isCurrent: boolean;
  disabled: boolean;
  analytics: NavAnalyticsMetadata;
}

export interface HeaderExternalLinkDescriptor {
  id: string;
  kind: 'external-link';
  label: string;
  href: string;
  ariaLabel: string;
  isCurrent: false;
  disabled: false;
  onClick: () => void;
}

export type HeaderNavItemDescriptor =
  HeaderLinkDescriptor | HeaderExternalLinkDescriptor;

export type HeaderDialogType = 'share-profile' | 'delete-account';

export interface HeaderActionDescriptor {
  id: 'share-profile' | 'logout' | 'delete-account';
  kind: 'action';
  label: string;
  tone: 'default' | 'destructive';
  disabled: boolean;
  analytics?: NavAnalyticsMetadata;
  onSelect: (closeMenu?: () => void) => void | Promise<void>;
}

export interface ProfileHeaderDescriptor {
  userId: string | undefined;
  name: string;
  displayName: string;
  avatarSrc: string;
  subtitle: string;
  personalLinks: PersonalLink[];
  href: string;
  isCurrent: boolean;
  disabled: boolean;
  analytics: {
    desktop: NavAnalyticsMetadata;
    mobile: NavAnalyticsMetadata;
  };
}

export interface UseHeaderNavigationOptions {
  identity: ResolvedIdentity;
  user?: Session['user'];
  showFavorites?: boolean;
}

export interface DesktopNavModel {
  findMentor: HeaderLinkDescriptor;
  mentorRoleCandidate: HeaderLinkDescriptor;
  menteeRoleCandidate: HeaderLinkDescriptor;
  guestRoleCandidate: HeaderLinkDescriptor;
  resolvedRoleItem: HeaderLinkDescriptor;
  about: HeaderLinkDescriptor;
  feedback: HeaderExternalLinkDescriptor;
}

export interface DesktopGuestAuthModel {
  signup: HeaderLinkDescriptor;
  signin: HeaderLinkDescriptor;
}

export interface MobileGuestMenuModel {
  navItems: HeaderNavItemDescriptor[];
  signin: HeaderLinkDescriptor;
  signup: HeaderLinkDescriptor;
}

export interface DesktopAccountMenuModel {
  shareProfile: HeaderActionDescriptor;
  navItems: HeaderLinkDescriptor[];
  accountActions: HeaderActionDescriptor[];
}

export interface MobileAccountMenuModel {
  shareProfile: HeaderActionDescriptor;
  navItems: HeaderNavItemDescriptor[];
  accountActions: HeaderActionDescriptor[];
}

export interface HeaderNavigationModel {
  identity: ResolvedIdentity;
  isMentor: boolean;
  canDeleteAccount: boolean;
  profileHeader: ProfileHeaderDescriptor;
  desktopNav: DesktopNavModel;
  desktopGuestAuth: DesktopGuestAuthModel;
  mobileGuestMenu: MobileGuestMenuModel;
  desktopAccountMenu: DesktopAccountMenuModel;
  mobileAccountMenu: MobileAccountMenuModel;
  activeDialog: HeaderDialogType | null;
  setActiveDialog: React.Dispatch<
    React.SetStateAction<HeaderDialogType | null>
  >;
}

export function getNavAnalyticsAttributes(
  analytics?: NavAnalyticsMetadata
): Record<string, string> {
  if (!analytics) return {};
  return {
    'data-analytics-click': analytics.click,
    'data-analytics-location': analytics.location,
    'data-analytics-feature': analytics.feature,
    ...(analytics.omitDestination
      ? { 'data-analytics-omit-destination': 'true' }
      : {}),
  };
}

export function buildDesktopGuestAuth(
  pathname: string | null = null
): DesktopGuestAuthModel {
  return {
    signup: {
      id: 'signup',
      kind: 'link',
      label: '註冊',
      href: SIGNUP_HREF,
      isCurrent: pathname === SIGNUP_HREF,
      disabled: false,
      analytics: {
        click: 'header_signup',
        location: 'header',
        feature: 'auth',
      },
    },
    signin: {
      id: 'signin',
      kind: 'link',
      label: '登入',
      href: SIGNIN_HREF,
      isCurrent: pathname === SIGNIN_HREF,
      disabled: false,
      analytics: {
        click: 'header_signin',
        location: 'header',
        feature: 'auth',
      },
    },
  };
}

function isPrefixCurrent(pathname: string | null, prefix: string): boolean {
  if (!pathname) return false;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function useHeaderNavigation({
  identity,
  user,
  showFavorites,
}: UseHeaderNavigationOptions): HeaderNavigationModel {
  const pathname = usePathname();
  const [activeDialog, setActiveDialog] =
    React.useState<HeaderDialogType | null>(null);
  const dialogRafRef = React.useRef<number | null>(null);

  const userId = identity.userId;
  const isMentor = Boolean(identity.isMentor);
  const isHintOnly = identity.state === 'hint-only';
  const isUserUnresolved = isHintOnly || !userId;
  const isDesktopRoleNavDisabled =
    isHintOnly || (identity.state === 'confirmed-member' && !userId);

  const canDeleteAccount =
    process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT === 'true';

  const cancelPendingDialogRaf = React.useCallback((): void => {
    if (
      dialogRafRef.current !== null &&
      typeof cancelAnimationFrame === 'function'
    ) {
      cancelAnimationFrame(dialogRafRef.current);
      dialogRafRef.current = null;
    }
  }, []);

  const scheduleDialogOpen = React.useCallback(
    (dialog: HeaderDialogType): void => {
      cancelPendingDialogRaf();
      if (typeof requestAnimationFrame !== 'function') {
        setActiveDialog(dialog);
        return;
      }
      dialogRafRef.current = requestAnimationFrame(() => {
        dialogRafRef.current = null;
        setActiveDialog(dialog);
      });
    },
    [cancelPendingDialogRaf]
  );

  React.useEffect(() => {
    return () => {
      cancelPendingDialogRaf();
    };
  }, [cancelPendingDialogRaf]);

  React.useEffect(() => {
    cancelPendingDialogRaf();
    setActiveDialog(null);
  }, [cancelPendingDialogRaf, isUserUnresolved, userId]);

  const name = identity.name ?? user?.name ?? '';
  const displayName = name || '我的個人頁面';
  const avatarSrc = identity.avatar ?? user?.avatar ?? '';
  const jobTitle = identity.jobTitle ?? user?.jobTitle ?? '';
  const company = identity.company ?? user?.company ?? '';
  const personalLinks = React.useMemo(
    () => identity.personalLinks ?? user?.personalLinks ?? [],
    [identity.personalLinks, user?.personalLinks]
  );

  const subtitle =
    jobTitle && company
      ? `${jobTitle} at ${company}`
      : jobTitle || company || '';

  const profileHref = getProfileHref(userId);
  const isOnOwnProfile = !isUserUnresolved && pathname === profileHref;
  const isOnFindMentor = isPrefixCurrent(pathname, FIND_MENTOR_HREF);
  const isOnAbout = isPrefixCurrent(pathname, ABOUT_HREF);
  const isOnMentorReservation = isPrefixCurrent(
    pathname,
    RESERVATION_MENTOR_HREF
  );
  const isOnMenteeReservation = isPrefixCurrent(
    pathname,
    RESERVATION_MENTEE_HREF
  );
  const isOnFavorites = isPrefixCurrent(pathname, FAVORITES_HREF);
  const isOnSignup = pathname === SIGNUP_HREF;
  const isOnSignin = pathname === SIGNIN_HREF;

  const handleFeedbackClick = React.useCallback((): void => {
    trackEvent({ name: 'feedback_open' });
  }, []);

  const handleShareProfile = React.useCallback(
    (closeMenu?: () => void): void => {
      if (isUserUnresolved) return;
      closeMenu?.();
      scheduleDialogOpen('share-profile');
    },
    [isUserUnresolved, scheduleDialogOpen]
  );

  const handleDeleteAccount = React.useCallback(
    (closeMenu?: () => void): void => {
      if (isUserUnresolved || !canDeleteAccount) return;
      closeMenu?.();
      scheduleDialogOpen('delete-account');
    },
    [canDeleteAccount, isUserUnresolved, scheduleDialogOpen]
  );

  const handleLogout = React.useCallback(
    async (closeMenu?: () => void): Promise<void> => {
      closeMenu?.();
      cancelPendingDialogRaf();
      setActiveDialog(null);
      await terminateClientSession('logout', { signOut });
    },
    [cancelPendingDialogRaf]
  );

  const feedbackItem = React.useMemo<HeaderExternalLinkDescriptor>(
    () => ({
      id: 'feedback',
      kind: 'external-link',
      label: '提供回饋',
      href: FEEDBACK_FORM_URL,
      ariaLabel: EXTERNAL_FEEDBACK_ARIA_LABEL,
      isCurrent: false,
      disabled: false,
      onClick: handleFeedbackClick,
    }),
    [handleFeedbackClick]
  );

  const profileHeader = React.useMemo<ProfileHeaderDescriptor>(
    () => ({
      userId,
      name,
      displayName,
      avatarSrc,
      subtitle,
      personalLinks,
      href: profileHref,
      isCurrent: isOnOwnProfile,
      disabled: isUserUnresolved,
      analytics: {
        desktop: {
          click: 'user_menu_profile',
          location: 'user_dropdown',
          feature: 'navigation',
          omitDestination: true,
        },
        mobile: {
          click: 'mobile_user_menu_profile',
          location: 'mobile_user_menu',
          feature: 'navigation',
          omitDestination: true,
        },
      },
    }),
    [
      avatarSrc,
      displayName,
      isOnOwnProfile,
      isUserUnresolved,
      name,
      personalLinks,
      profileHref,
      subtitle,
      userId,
    ]
  );

  const desktopNav = React.useMemo<DesktopNavModel>(() => {
    const desktopMentorRoleItem: HeaderLinkDescriptor = {
      id: 'my-mentor-page',
      kind: 'link',
      label: '我的導師頁面',
      href: profileHref,
      isCurrent: isOnOwnProfile,
      disabled: isUserUnresolved,
      analytics: {
        click: 'header_nav_my_mentor_page',
        location: 'header',
        feature: 'navigation',
      },
    };

    const becomeMentorHref = getBecomeMentorHref(userId);
    const desktopBecomeMentorItem: HeaderLinkDescriptor = {
      id: 'become-mentor',
      kind: 'link',
      label: '成為導師',
      href: becomeMentorHref,
      isCurrent: !isDesktopRoleNavDisabled && !userId && isOnSignup,
      disabled: isDesktopRoleNavDisabled,
      analytics: {
        click: 'header_nav_become_mentor',
        location: 'header',
        feature: 'onboarding',
      },
    };

    return {
      findMentor: {
        id: 'find-mentor',
        kind: 'link',
        label: '尋找導師',
        href: FIND_MENTOR_HREF,
        isCurrent: isOnFindMentor,
        disabled: false,
        analytics: {
          click: 'header_nav_mentor_pool',
          location: 'header',
          feature: 'navigation',
        },
      },
      mentorRoleCandidate: {
        ...desktopMentorRoleItem,
        isCurrent: !isUserUnresolved && isOnOwnProfile,
        disabled: isUserUnresolved,
      },
      menteeRoleCandidate: {
        ...desktopBecomeMentorItem,
        isCurrent: false,
        disabled: isUserUnresolved,
      },
      guestRoleCandidate: {
        ...desktopBecomeMentorItem,
        href: getBecomeMentorHref(undefined),
        isCurrent: isOnSignup,
        disabled: false,
      },
      resolvedRoleItem: isMentor
        ? desktopMentorRoleItem
        : desktopBecomeMentorItem,
      about: {
        id: 'about',
        kind: 'link',
        label: '關於 X-Talent',
        href: ABOUT_HREF,
        isCurrent: isOnAbout,
        disabled: false,
        analytics: {
          click: 'header_nav_about',
          location: 'header',
          feature: 'navigation',
        },
      },
      feedback: feedbackItem,
    };
  }, [
    feedbackItem,
    isDesktopRoleNavDisabled,
    isMentor,
    isOnAbout,
    isOnFindMentor,
    isOnOwnProfile,
    isOnSignup,
    isUserUnresolved,
    profileHref,
    userId,
  ]);

  const desktopGuestAuth = React.useMemo<DesktopGuestAuthModel>(() => {
    if (isOnSignup) {
      return buildDesktopGuestAuth(SIGNUP_HREF);
    }
    if (isOnSignin) {
      return buildDesktopGuestAuth(SIGNIN_HREF);
    }
    return buildDesktopGuestAuth(null);
  }, [isOnSignin, isOnSignup]);

  const mobileGuestMenu = React.useMemo<MobileGuestMenuModel>(
    () => ({
      navItems: [
        {
          id: 'find-mentor',
          kind: 'link',
          label: '尋找導師',
          href: FIND_MENTOR_HREF,
          isCurrent: isOnFindMentor,
          disabled: false,
          analytics: {
            click: 'mobile_nav_mentor_pool',
            location: 'mobile_menu',
            feature: 'navigation',
          },
        },
        {
          id: 'become-mentor',
          kind: 'link',
          label: '成為導師',
          href: getBecomeMentorHref(undefined),
          isCurrent: isOnSignup,
          disabled: false,
          analytics: {
            click: 'mobile_nav_become_mentor',
            location: 'mobile_menu',
            feature: 'onboarding',
          },
        },
        {
          id: 'about',
          kind: 'link',
          label: '關於 X-Talent',
          href: ABOUT_HREF,
          isCurrent: isOnAbout,
          disabled: false,
          analytics: {
            click: 'mobile_nav_about',
            location: 'mobile_menu',
            feature: 'navigation',
          },
        },
        feedbackItem,
      ],
      signin: {
        id: 'signin',
        kind: 'link',
        label: '登入',
        href: SIGNIN_HREF,
        isCurrent: isOnSignin,
        disabled: false,
        analytics: {
          click: 'mobile_signin',
          location: 'mobile_menu',
          feature: 'auth',
        },
      },
      signup: {
        id: 'signup',
        kind: 'link',
        label: '註冊',
        href: SIGNUP_HREF,
        isCurrent: isOnSignup,
        disabled: false,
        analytics: {
          click: 'mobile_signup',
          location: 'mobile_menu',
          feature: 'auth',
        },
      },
    }),
    [feedbackItem, isOnAbout, isOnFindMentor, isOnSignin, isOnSignup]
  );

  const favoritesEnabled = showFavorites ?? isFavoritesEnabled();

  const buildAccountCommonLinks = React.useCallback(
    (
      location: 'user_dropdown' | 'mobile_user_menu',
      prefix: 'user_menu' | 'mobile_user_menu'
    ): HeaderLinkDescriptor[] => {
      const roleLink: HeaderLinkDescriptor = isMentor
        ? {
            id: 'mentor-reservations',
            kind: 'link',
            label: '導師預約管理',
            href: RESERVATION_MENTOR_HREF,
            isCurrent: isOnMentorReservation,
            disabled: isUserUnresolved,
            analytics: {
              click: `${prefix}_mentor_reservations`,
              location,
              feature: 'reservation',
            },
          }
        : {
            id: 'become-mentor',
            kind: 'link',
            label: '成為導師',
            href: userId ? getMentorOnboardingUrl(userId) : SIGNUP_HREF,
            isCurrent: false,
            disabled: isUserUnresolved,
            analytics: {
              click: `${prefix}_become_mentor`,
              location,
              feature: 'onboarding',
            },
          };

      const links: HeaderLinkDescriptor[] = [
        roleLink,
        {
          id: 'my-reservations',
          kind: 'link',
          label: '我的預約',
          href: RESERVATION_MENTEE_HREF,
          isCurrent: isOnMenteeReservation,
          disabled: false,
          analytics: {
            click: `${prefix}_my_reservations`,
            location,
            feature: 'reservation',
          },
        },
      ];

      if (favoritesEnabled) {
        links.push({
          id: 'my-favorites',
          kind: 'link',
          label: '我的收藏',
          href: FAVORITES_HREF,
          isCurrent: isOnFavorites,
          disabled: false,
          analytics: {
            click: `${prefix}_my_favorites`,
            location,
            feature: 'navigation',
          },
        });
      }

      return links;
    },
    [
      favoritesEnabled,
      isMentor,
      isOnFavorites,
      isOnMenteeReservation,
      isOnMentorReservation,
      isUserUnresolved,
      userId,
    ]
  );

  const buildAccountActions = React.useCallback(
    (
      location: 'user_dropdown' | 'mobile_user_menu',
      prefix: 'user_menu' | 'mobile_user_menu'
    ): HeaderActionDescriptor[] => {
      const actions: HeaderActionDescriptor[] = [
        {
          id: 'logout',
          kind: 'action',
          label: '登出',
          tone: 'default',
          disabled: false,
          analytics: {
            click: `${prefix}_logout`,
            location,
            feature: 'auth',
          },
          onSelect: handleLogout,
        },
      ];
      if (canDeleteAccount) {
        actions.push({
          id: 'delete-account',
          kind: 'action',
          label: '刪除帳號',
          tone: 'destructive',
          disabled: isUserUnresolved,
          onSelect: handleDeleteAccount,
        });
      }
      return actions;
    },
    [canDeleteAccount, handleDeleteAccount, handleLogout, isUserUnresolved]
  );

  const desktopAccountMenu = React.useMemo<DesktopAccountMenuModel>(
    () => ({
      shareProfile: {
        id: 'share-profile',
        kind: 'action',
        label: '分享個人頁面',
        tone: 'default',
        disabled: isUserUnresolved,
        analytics: {
          click: 'user_menu_share_profile',
          location: 'user_dropdown',
          feature: 'profile',
        },
        onSelect: handleShareProfile,
      },
      navItems: buildAccountCommonLinks('user_dropdown', 'user_menu'),
      accountActions: buildAccountActions('user_dropdown', 'user_menu'),
    }),
    [
      buildAccountActions,
      buildAccountCommonLinks,
      handleShareProfile,
      isUserUnresolved,
    ]
  );

  const mobileAccountMenu = React.useMemo<MobileAccountMenuModel>(
    () => ({
      shareProfile: {
        id: 'share-profile',
        kind: 'action',
        label: '分享個人頁面',
        tone: 'default',
        disabled: isUserUnresolved,
        analytics: {
          click: 'mobile_user_menu_share_profile',
          location: 'mobile_user_menu',
          feature: 'profile',
        },
        onSelect: handleShareProfile,
      },
      navItems: [
        ...buildAccountCommonLinks('mobile_user_menu', 'mobile_user_menu'),
        {
          id: 'find-mentor',
          kind: 'link',
          label: '尋找導師',
          href: FIND_MENTOR_HREF,
          isCurrent: isOnFindMentor,
          disabled: false,
          analytics: {
            click: 'mobile_nav_mentor_pool',
            location: 'mobile_user_menu',
            feature: 'navigation',
          },
        },
        {
          id: 'about',
          kind: 'link',
          label: '關於 X-Talent',
          href: ABOUT_HREF,
          isCurrent: isOnAbout,
          disabled: false,
          analytics: {
            click: 'mobile_nav_about',
            location: 'mobile_user_menu',
            feature: 'navigation',
          },
        },
        feedbackItem,
      ],
      accountActions: buildAccountActions(
        'mobile_user_menu',
        'mobile_user_menu'
      ),
    }),
    [
      buildAccountActions,
      buildAccountCommonLinks,
      feedbackItem,
      handleShareProfile,
      isOnAbout,
      isOnFindMentor,
      isUserUnresolved,
    ]
  );

  return React.useMemo<HeaderNavigationModel>(
    () => ({
      identity,
      isMentor,
      canDeleteAccount,
      profileHeader,
      desktopNav,
      desktopGuestAuth,
      mobileGuestMenu,
      desktopAccountMenu,
      mobileAccountMenu,
      activeDialog,
      setActiveDialog,
    }),
    [
      activeDialog,
      canDeleteAccount,
      desktopAccountMenu,
      desktopGuestAuth,
      desktopNav,
      identity,
      isMentor,
      mobileAccountMenu,
      mobileGuestMenu,
      profileHeader,
    ]
  );
}
