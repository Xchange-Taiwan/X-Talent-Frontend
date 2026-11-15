'use client';

import { usePathname } from 'next/navigation';
import type { Session } from 'next-auth';
import { signOut } from 'next-auth/react';
import * as React from 'react';

import { FEEDBACK_FORM_URL } from '@/constant/externalLinks';
import { trackEvent } from '@/lib/analytics';
import { type ResolvedIdentity } from '@/lib/auth/sessionHint';
import { terminateClientSession } from '@/lib/auth/sessionLifecycle';
import {
  ABOUT_HREF,
  FIND_MENTOR_HREF,
  getBecomeMentorHref,
  getMentorOnboardingUrl,
  HOME_HREF,
  RESERVATION_MENTEE_HREF,
  RESERVATION_MENTOR_HREF,
  SIGNIN_HREF,
  SIGNUP_HREF,
} from '@/lib/routes';
import type { PersonalLink } from '@/types/types';

export { FEEDBACK_FORM_URL, FIND_MENTOR_HREF, getBecomeMentorHref };

export const FAVORITES_HREF = '/favorites';
export const EXTERNAL_FEEDBACK_ARIA_LABEL = '提供回饋（另開新分頁）';

export function getProfileHref(userId: string | undefined): string {
  return userId ? `/profile/${userId}` : HOME_HREF;
}

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
}

export interface HeaderNavigationModel {
  identity: ResolvedIdentity;
  isMentor: boolean;
  canDeleteAccount: boolean;
  profileHeader: ProfileHeaderDescriptor;
  desktopNav: {
    findMentor: HeaderLinkDescriptor;
    mentorRoleCandidate: HeaderLinkDescriptor;
    nonMentorRoleCandidate: HeaderLinkDescriptor;
    resolvedRoleItem: HeaderLinkDescriptor;
    about: HeaderLinkDescriptor;
    feedback: HeaderExternalLinkDescriptor;
  };
  desktopGuestAuth: {
    signup: HeaderLinkDescriptor;
    signin: HeaderLinkDescriptor;
  };
  mobileGuestMenu: {
    navItems: HeaderNavItemDescriptor[];
    signin: HeaderLinkDescriptor;
    signup: HeaderLinkDescriptor;
  };
  desktopAccountMenu: {
    shareProfile: HeaderActionDescriptor;
    navItems: HeaderLinkDescriptor[];
    accountActions: HeaderActionDescriptor[];
  };
  mobileAccountMenu: {
    shareProfile: HeaderActionDescriptor;
    navItems: HeaderNavItemDescriptor[];
    accountActions: HeaderActionDescriptor[];
  };
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

function isPrefixCurrent(pathname: string | null, prefix: string): boolean {
  if (!pathname) return false;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function useHeaderNavigation({
  identity,
  user,
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

  return React.useMemo<HeaderNavigationModel>(() => {
    const feedbackItem: HeaderExternalLinkDescriptor = {
      id: 'feedback',
      kind: 'external-link',
      label: '提供回饋',
      href: FEEDBACK_FORM_URL,
      ariaLabel: EXTERNAL_FEEDBACK_ARIA_LABEL,
      isCurrent: false,
      disabled: false,
      onClick: handleFeedbackClick,
    };

    const profileHeader: ProfileHeaderDescriptor = {
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
    };

    const desktopMentorRoleItem: HeaderLinkDescriptor = {
      id: 'my-mentor-page',
      kind: 'link',
      label: '我的導師頁面',
      href: profileHref,
      isCurrent: isOnOwnProfile,
      disabled: isDesktopRoleNavDisabled,
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

    const buildAccountRoleLink = (
      location: 'user_dropdown' | 'mobile_user_menu',
      prefix: 'user_menu' | 'mobile_user_menu'
    ): HeaderLinkDescriptor =>
      isMentor
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

    const buildAccountCommonLinks = (
      location: 'user_dropdown' | 'mobile_user_menu',
      prefix: 'user_menu' | 'mobile_user_menu'
    ): HeaderLinkDescriptor[] => [
      buildAccountRoleLink(location, prefix),
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
      {
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
      },
    ];

    const buildAccountActions = (
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
    };

    return {
      identity,
      isMentor,
      canDeleteAccount,
      profileHeader,
      desktopNav: {
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
          isCurrent: false,
          disabled: false,
        },
        nonMentorRoleCandidate: {
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
      },
      desktopGuestAuth: {
        signup: {
          id: 'signup',
          kind: 'link',
          label: '註冊',
          href: SIGNUP_HREF,
          isCurrent: isOnSignup,
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
          isCurrent: isOnSignin,
          disabled: false,
          analytics: {
            click: 'header_signin',
            location: 'header',
            feature: 'auth',
          },
        },
      },
      mobileGuestMenu: {
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
      },
      desktopAccountMenu: {
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
      },
      mobileAccountMenu: {
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
      },
      activeDialog,
      setActiveDialog,
    };
  }, [
    identity,
    isMentor,
    canDeleteAccount,
    userId,
    name,
    displayName,
    avatarSrc,
    subtitle,
    personalLinks,
    profileHref,
    isOnOwnProfile,
    isUserUnresolved,
    isDesktopRoleNavDisabled,
    isOnFindMentor,
    isOnAbout,
    isOnMentorReservation,
    isOnMenteeReservation,
    isOnFavorites,
    isOnSignup,
    isOnSignin,
    handleFeedbackClick,
    handleShareProfile,
    handleDeleteAccount,
    handleLogout,
    activeDialog,
  ]);
}
