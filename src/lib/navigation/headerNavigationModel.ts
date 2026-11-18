import { FEEDBACK_FORM_URL } from '@/constant/externalLinks';
import type { ResolvedIdentity } from '@/lib/auth/sessionHint';
import {
  isAccountDeletionEnabled,
  isFavoritesEnabled,
} from '@/lib/featureFlags';
import { normalizePresetAvatarSrc } from '@/lib/profile/presetAvatar';
import {
  ABOUT_HREF,
  FAVORITES_HREF,
  FIND_MENTOR_HREF,
  getBecomeMentorHref,
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

export type HeaderActionIntent = 'share-profile' | 'logout' | 'delete-account';

export type HeaderDialogType = 'share-profile' | 'delete-account';

export interface HeaderLinkDescriptor {
  id: string;
  kind: 'link';
  label: string;
  href: string;
  isCurrent: boolean;
  disabled: boolean;
  analytics: NavAnalyticsMetadata;
}

export interface PureHeaderExternalLinkDescriptor {
  id: string;
  kind: 'external-link';
  label: string;
  href: string;
  ariaLabel: string;
  isCurrent: false;
  disabled: false;
}

export interface HeaderExternalLinkDescriptor extends PureHeaderExternalLinkDescriptor {
  onClick: () => void;
}

export type PureHeaderNavItemDescriptor =
  HeaderLinkDescriptor | PureHeaderExternalLinkDescriptor;

export type HeaderNavItemDescriptor =
  HeaderLinkDescriptor | HeaderExternalLinkDescriptor;

export interface PureHeaderActionDescriptor {
  id: HeaderActionIntent;
  intent: HeaderActionIntent;
  kind: 'action';
  label: string;
  tone: 'default' | 'destructive';
  disabled: boolean;
  analytics?: NavAnalyticsMetadata;
}

export interface HeaderActionDescriptor extends PureHeaderActionDescriptor {
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

export interface DesktopGuestAuthModel {
  signup: HeaderLinkDescriptor;
  signin: HeaderLinkDescriptor;
}

export interface PureDesktopNavModel {
  findMentor: HeaderLinkDescriptor;
  mentorRoleCandidate: HeaderLinkDescriptor;
  menteeRoleCandidate: HeaderLinkDescriptor;
  guestRoleCandidate: HeaderLinkDescriptor;
  resolvedRoleItem: HeaderLinkDescriptor;
  about: HeaderLinkDescriptor;
  feedback: PureHeaderExternalLinkDescriptor;
}

export interface DesktopNavModel extends Omit<PureDesktopNavModel, 'feedback'> {
  feedback: HeaderExternalLinkDescriptor;
}

export interface PureMobileGuestMenuModel {
  navItems: PureHeaderNavItemDescriptor[];
  signin: HeaderLinkDescriptor;
  signup: HeaderLinkDescriptor;
}

export interface MobileGuestMenuModel extends Omit<
  PureMobileGuestMenuModel,
  'navItems'
> {
  navItems: HeaderNavItemDescriptor[];
}

export interface PureDesktopAccountMenuModel {
  shareProfile: PureHeaderActionDescriptor;
  navItems: HeaderLinkDescriptor[];
  accountActions: PureHeaderActionDescriptor[];
}

export interface DesktopAccountMenuModel {
  shareProfile: HeaderActionDescriptor;
  navItems: HeaderLinkDescriptor[];
  accountActions: HeaderActionDescriptor[];
}

export interface PureMobileAccountMenuModel {
  shareProfile: PureHeaderActionDescriptor;
  navItems: PureHeaderNavItemDescriptor[];
  accountActions: PureHeaderActionDescriptor[];
}

export interface MobileAccountMenuModel {
  shareProfile: HeaderActionDescriptor;
  navItems: HeaderNavItemDescriptor[];
  accountActions: HeaderActionDescriptor[];
}

export interface HeaderNavigationUserFallback {
  name?: string | null;
  avatar?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  personalLinks?: PersonalLink[];
}

export interface BuildHeaderNavigationModelInput {
  identity: ResolvedIdentity;
  user?: HeaderNavigationUserFallback;
  pathname?: string | null;
  showFavorites?: boolean;
  canDeleteAccount?: boolean;
  env?: NodeJS.ProcessEnv;
}

export interface PureHeaderNavigationModel {
  identity: ResolvedIdentity;
  isMentor: boolean;
  isUserUnresolved: boolean;
  canDeleteAccount: boolean;
  profileHeader: ProfileHeaderDescriptor;
  desktopNav: PureDesktopNavModel;
  desktopGuestAuth: DesktopGuestAuthModel;
  mobileGuestMenu: PureMobileGuestMenuModel;
  desktopAccountMenu: PureDesktopAccountMenuModel;
  mobileAccountMenu: PureMobileAccountMenuModel;
}

export interface HeaderNavigationCallbackHandlers {
  onFeedbackClick: () => void;
  onAction: (
    intent: HeaderActionIntent,
    closeMenu?: () => void
  ) => void | Promise<void>;
}

export interface BoundHeaderNavigationMenus {
  isMentor: boolean;
  canDeleteAccount: boolean;
  profileHeader: ProfileHeaderDescriptor;
  desktopNav: DesktopNavModel;
  desktopGuestAuth: DesktopGuestAuthModel;
  mobileGuestMenu: MobileGuestMenuModel;
  desktopAccountMenu: DesktopAccountMenuModel;
  mobileAccountMenu: MobileAccountMenuModel;
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

function isPrefixCurrent(
  pathname: string | null | undefined,
  prefix: string
): boolean {
  if (!pathname) return false;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function buildAccountCommonLinks(options: {
  location: 'user_dropdown' | 'mobile_user_menu';
  prefix: 'user_menu' | 'mobile_user_menu';
  userId: string | undefined;
  isMentor: boolean;
  isUserUnresolved: boolean;
  isOnMentorReservation: boolean;
  isOnMenteeReservation: boolean;
  isOnFavorites: boolean;
  favoritesEnabled: boolean;
}): HeaderLinkDescriptor[] {
  const {
    location,
    prefix,
    userId,
    isMentor,
    isUserUnresolved,
    isOnMentorReservation,
    isOnMenteeReservation,
    isOnFavorites,
    favoritesEnabled,
  } = options;

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
        href: getBecomeMentorHref(userId),
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
}

function buildAccountActions(options: {
  location: 'user_dropdown' | 'mobile_user_menu';
  prefix: 'user_menu' | 'mobile_user_menu';
  canDeleteAccount: boolean;
  isUserUnresolved: boolean;
}): PureHeaderActionDescriptor[] {
  const { location, prefix, canDeleteAccount, isUserUnresolved } = options;
  const actions: PureHeaderActionDescriptor[] = [
    {
      id: 'logout',
      intent: 'logout',
      kind: 'action',
      label: '登出',
      tone: 'default',
      disabled: false,
      analytics: {
        click: `${prefix}_logout`,
        location,
        feature: 'auth',
      },
    },
  ];

  if (canDeleteAccount) {
    actions.push({
      id: 'delete-account',
      intent: 'delete-account',
      kind: 'action',
      label: '刪除帳號',
      tone: 'destructive',
      disabled: isUserUnresolved,
    });
  }

  return actions;
}

export function toResolvedIdentitySnapshot(
  state: ResolvedIdentity['state'],
  userId: string | undefined,
  isMentor: boolean,
  avatar: string | undefined,
  name: string | undefined,
  jobTitle: string | undefined,
  company: string | undefined,
  personalLinks: PersonalLink[] | undefined
): ResolvedIdentity {
  const fields = { name, jobTitle, company, personalLinks };
  if (state === 'confirmed-member') {
    return { state, userId: userId ?? '', avatar, isMentor, ...fields };
  }
  if (state === 'hint-only') {
    return { state, userId: undefined, avatar, isMentor, ...fields };
  }
  return {
    state,
    userId: undefined,
    avatar: undefined,
    isMentor: false,
    ...fields,
  };
}

export function buildHeaderNavigationModel({
  identity,
  user,
  pathname = null,
  showFavorites,
  canDeleteAccount: explicitCanDeleteAccount,
  env,
}: BuildHeaderNavigationModelInput): PureHeaderNavigationModel {
  const userId = identity.userId;
  const isMentor = Boolean(identity.isMentor);
  const isHintOnly = identity.state === 'hint-only';
  const isUserUnresolved = isHintOnly || !userId;
  const isDesktopRoleNavDisabled =
    isHintOnly || (identity.state === 'confirmed-member' && !userId);

  const canDeleteAccount =
    explicitCanDeleteAccount ?? isAccountDeletionEnabled(env);
  const favoritesEnabled = showFavorites ?? isFavoritesEnabled();

  const name = identity.name ?? user?.name ?? '';
  const displayName = name || '我的個人頁面';
  const avatarSrc = normalizePresetAvatarSrc(
    identity.avatar ?? user?.avatar ?? ''
  );
  const jobTitle = identity.jobTitle ?? user?.jobTitle ?? '';
  const company = identity.company ?? user?.company ?? '';
  const personalLinks = identity.personalLinks ?? user?.personalLinks ?? [];
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

  const feedbackItem: PureHeaderExternalLinkDescriptor = {
    id: 'feedback',
    kind: 'external-link',
    label: '提供回饋',
    href: FEEDBACK_FORM_URL,
    ariaLabel: EXTERNAL_FEEDBACK_ARIA_LABEL,
    isCurrent: false,
    disabled: false,
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

  const desktopNav: PureDesktopNavModel = {
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

  const desktopGuestAuth = buildDesktopGuestAuth(pathname);

  const mobileGuestMenu: PureMobileGuestMenuModel = {
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
  };

  const commonLinkParams = {
    userId,
    isMentor,
    isUserUnresolved,
    isOnMentorReservation,
    isOnMenteeReservation,
    isOnFavorites,
    favoritesEnabled,
  };

  const desktopAccountMenu: PureDesktopAccountMenuModel = {
    shareProfile: {
      id: 'share-profile',
      intent: 'share-profile',
      kind: 'action',
      label: '分享個人頁面',
      tone: 'default',
      disabled: isUserUnresolved,
      analytics: {
        click: 'user_menu_share_profile',
        location: 'user_dropdown',
        feature: 'profile',
      },
    },
    navItems: buildAccountCommonLinks({
      location: 'user_dropdown',
      prefix: 'user_menu',
      ...commonLinkParams,
    }),
    accountActions: buildAccountActions({
      location: 'user_dropdown',
      prefix: 'user_menu',
      canDeleteAccount,
      isUserUnresolved,
    }),
  };

  const mobileAccountMenu: PureMobileAccountMenuModel = {
    shareProfile: {
      id: 'share-profile',
      intent: 'share-profile',
      kind: 'action',
      label: '分享個人頁面',
      tone: 'default',
      disabled: isUserUnresolved,
      analytics: {
        click: 'mobile_user_menu_share_profile',
        location: 'mobile_user_menu',
        feature: 'profile',
      },
    },
    navItems: [
      ...buildAccountCommonLinks({
        location: 'mobile_user_menu',
        prefix: 'mobile_user_menu',
        ...commonLinkParams,
      }),
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
    accountActions: buildAccountActions({
      location: 'mobile_user_menu',
      prefix: 'mobile_user_menu',
      canDeleteAccount,
      isUserUnresolved,
    }),
  };

  return {
    identity,
    isMentor,
    isUserUnresolved,
    canDeleteAccount,
    profileHeader,
    desktopNav,
    desktopGuestAuth,
    mobileGuestMenu,
    desktopAccountMenu,
    mobileAccountMenu,
  };
}

function bindActionDescriptor(
  action: PureHeaderActionDescriptor,
  onAction: HeaderNavigationCallbackHandlers['onAction']
): HeaderActionDescriptor {
  return {
    ...action,
    onSelect: (closeMenu?: () => void) => {
      if (action.disabled) return;
      return onAction(action.intent, closeMenu);
    },
  };
}

function bindNavItemDescriptor(
  item: PureHeaderNavItemDescriptor,
  boundFeedback: HeaderExternalLinkDescriptor
): HeaderNavItemDescriptor {
  return item.kind === 'external-link' ? boundFeedback : item;
}

export function bindHeaderNavigationCallbacks(
  model: PureHeaderNavigationModel,
  handlers: HeaderNavigationCallbackHandlers
): BoundHeaderNavigationMenus {
  const boundFeedback: HeaderExternalLinkDescriptor = {
    ...model.desktopNav.feedback,
    onClick: handlers.onFeedbackClick,
  };

  return {
    isMentor: model.isMentor,
    canDeleteAccount: model.canDeleteAccount,
    profileHeader: model.profileHeader,
    desktopNav: {
      ...model.desktopNav,
      feedback: boundFeedback,
    },
    desktopGuestAuth: model.desktopGuestAuth,
    mobileGuestMenu: {
      ...model.mobileGuestMenu,
      navItems: model.mobileGuestMenu.navItems.map((item) =>
        bindNavItemDescriptor(item, boundFeedback)
      ),
    },
    desktopAccountMenu: {
      shareProfile: bindActionDescriptor(
        model.desktopAccountMenu.shareProfile,
        handlers.onAction
      ),
      navItems: model.desktopAccountMenu.navItems,
      accountActions: model.desktopAccountMenu.accountActions.map((action) =>
        bindActionDescriptor(action, handlers.onAction)
      ),
    },
    mobileAccountMenu: {
      shareProfile: bindActionDescriptor(
        model.mobileAccountMenu.shareProfile,
        handlers.onAction
      ),
      navItems: model.mobileAccountMenu.navItems.map((item) =>
        bindNavItemDescriptor(item, boundFeedback)
      ),
      accountActions: model.mobileAccountMenu.accountActions.map((action) =>
        bindActionDescriptor(action, handlers.onAction)
      ),
    },
  };
}
