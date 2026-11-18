import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fromPartial } from '@total-typescript/shoehorn';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FEEDBACK_FORM_URL } from '@/constant/externalLinks';
import {
  authenticatedIdentity,
  buildResolvedIdentity,
  GUEST_IDENTITY,
  UNKNOWN_IDENTITY,
} from '@/test/mocks/identity';

import {
  bindHeaderNavigationCallbacks,
  buildDesktopGuestAuth,
  buildHeaderNavigationModel,
  EXTERNAL_FEEDBACK_ARIA_LABEL,
  getNavAnalyticsAttributes,
  type HeaderNavigationUserFallback,
} from './headerNavigationModel';

describe('headerNavigationModel', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('maintains a pure module boundary with zero React, Next, NextAuth, hook, component, or store imports', () => {
    const modelSource = readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        'headerNavigationModel.ts'
      ),
      'utf8'
    );

    const forbiddenSpecifiers = [
      'react',
      'next/navigation',
      'next-auth/react',
      'next-auth',
      '@/hooks/',
      '@/components/',
      '@/stores/',
    ];

    for (const specifier of forbiddenSpecifiers) {
      expect(modelSource).not.toMatch(
        new RegExp(`from\\s+['"]${specifier.replace('/', '\\/')}`)
      );
    }
  });

  describe('getNavAnalyticsAttributes & buildDesktopGuestAuth', () => {
    it('maps NavAnalyticsMetadata to data-analytics-* attributes including omitDestination', () => {
      expect(getNavAnalyticsAttributes(undefined)).toEqual({});
      expect(
        getNavAnalyticsAttributes({
          click: 'header_nav_about',
          location: 'header',
          feature: 'navigation',
        })
      ).toEqual({
        'data-analytics-click': 'header_nav_about',
        'data-analytics-location': 'header',
        'data-analytics-feature': 'navigation',
      });
      expect(
        getNavAnalyticsAttributes({
          click: 'user_menu_profile',
          location: 'user_dropdown',
          feature: 'navigation',
          omitDestination: true,
        })
      ).toEqual({
        'data-analytics-click': 'user_menu_profile',
        'data-analytics-location': 'user_dropdown',
        'data-analytics-feature': 'navigation',
        'data-analytics-omit-destination': 'true',
      });
    });

    it('builds desktop guest auth descriptors with active route awareness', () => {
      const idle = buildDesktopGuestAuth('/');
      expect(idle.signup).toMatchObject({
        id: 'signup',
        href: '/auth/signup',
        isCurrent: false,
        disabled: false,
      });
      expect(idle.signin).toMatchObject({
        id: 'signin',
        href: '/auth/signin',
        isCurrent: false,
        disabled: false,
      });

      expect(buildDesktopGuestAuth('/auth/signup').signup.isCurrent).toBe(true);
      expect(buildDesktopGuestAuth('/auth/signin').signin.isCurrent).toBe(true);
    });
  });

  describe('role projection, hint-only disabling, and unified getBecomeMentorHref', () => {
    it('projects pre-hydration role candidates when identity is unknown', () => {
      const model = buildHeaderNavigationModel({
        identity: UNKNOWN_IDENTITY,
        pathname: '/auth/signup',
      });

      expect(model.isUserUnresolved).toBe(true);
      expect(model.desktopNav.guestRoleCandidate).toMatchObject({
        id: 'become-mentor',
        label: '成為導師',
        href: '/auth/signup',
        isCurrent: true,
        disabled: false,
      });
      expect(model.desktopNav.menteeRoleCandidate).toMatchObject({
        id: 'become-mentor',
        label: '成為導師',
        href: '/auth/signup',
        isCurrent: false,
        disabled: true,
      });
      expect(model.desktopNav.mentorRoleCandidate).toMatchObject({
        id: 'my-mentor-page',
        label: '我的導師頁面',
        isCurrent: false,
        disabled: true,
      });
    });

    it('projects guest navigation and external feedback descriptor without callbacks', () => {
      const model = buildHeaderNavigationModel({
        identity: GUEST_IDENTITY,
        pathname: '/auth/signup',
      });

      expect(model.desktopNav.resolvedRoleItem).toMatchObject({
        id: 'become-mentor',
        href: '/auth/signup',
        isCurrent: true,
        disabled: false,
      });
      expect(model.mobileGuestMenu.navItems.map((i) => i.label)).toEqual([
        '尋找導師',
        '成為導師',
        '關於 X-Talent',
        '提供回饋',
      ]);
      expect(model.desktopNav.feedback).toEqual({
        id: 'feedback',
        kind: 'external-link',
        label: '提供回饋',
        href: FEEDBACK_FORM_URL,
        ariaLabel: EXTERNAL_FEEDBACK_ARIA_LABEL,
        isCurrent: false,
        disabled: false,
      });
    });

    it('disables userId-dependent links and actions during hint-only while keeping logout and reservations enabled', () => {
      const model = buildHeaderNavigationModel({
        identity: buildResolvedIdentity({
          state: 'hint-only',
          isMentor: false,
          avatar: 'https://example.com/hint.png',
        }),
        pathname: '/',
        env: fromPartial<NodeJS.ProcessEnv>({
          NEXT_PUBLIC_CAN_DELETE_ACCOUNT: 'true',
        }),
      });

      expect(model.profileHeader.disabled).toBe(true);
      expect(model.profileHeader.isCurrent).toBe(false);
      expect(model.profileHeader.avatarSrc).toBe(
        'https://example.com/hint.png'
      );
      expect(model.desktopNav.resolvedRoleItem.disabled).toBe(true);
      expect(model.desktopAccountMenu.shareProfile).toMatchObject({
        id: 'share-profile',
        intent: 'share-profile',
        disabled: true,
      });
      expect(model.mobileAccountMenu.shareProfile).toMatchObject({
        id: 'share-profile',
        intent: 'share-profile',
        disabled: true,
      });

      const becomeMentorDesktop = model.desktopAccountMenu.navItems[0]!;
      expect(becomeMentorDesktop).toMatchObject({
        id: 'become-mentor',
        href: '/auth/signup',
        disabled: true,
      });

      const myReservationsDesktop = model.desktopAccountMenu.navItems[1]!;
      expect(myReservationsDesktop).toMatchObject({
        id: 'my-reservations',
        href: '/reservation/mentee',
        disabled: false,
      });

      expect(model.desktopAccountMenu.accountActions).toMatchObject([
        { id: 'logout', intent: 'logout', disabled: false },
        {
          id: 'delete-account',
          intent: 'delete-account',
          tone: 'destructive',
          disabled: true,
        },
      ]);
    });

    it('unifies become-mentor href via getBecomeMentorHref(userId) across desktop nav and both account menus for mentees', () => {
      const model = buildHeaderNavigationModel({
        identity: authenticatedIdentity('mentee-42', {
          isMentor: false,
          name: 'Ada Lovelace',
          jobTitle: 'Engineer',
          company: 'Acme',
        }),
        pathname: '/',
        showFavorites: true,
      });

      const expectedHref = '/profile/mentee-42/edit?mentor-onboarding=true';
      expect(model.desktopNav.resolvedRoleItem.href).toBe(expectedHref);
      expect(model.desktopAccountMenu.navItems[0]).toMatchObject({
        id: 'become-mentor',
        href: expectedHref,
        disabled: false,
      });
      expect(model.mobileAccountMenu.navItems[0]).toMatchObject({
        id: 'become-mentor',
        href: expectedHref,
        disabled: false,
      });
    });

    it('projects mentor items and formats profileHeader fallbacks cleanly', () => {
      const fallbackUser = fromPartial<HeaderNavigationUserFallback>({
        name: undefined,
        jobTitle: 'Principal PM',
        company: undefined,
        personalLinks: [{ platform: 'github', url: 'https://github.com/ada' }],
      });

      const model = buildHeaderNavigationModel({
        identity: authenticatedIdentity('mentor-7', { isMentor: true }),
        user: fallbackUser,
        pathname: '/profile/mentor-7',
      });

      expect(model.profileHeader).toMatchObject({
        userId: 'mentor-7',
        name: '',
        displayName: '我的個人頁面',
        subtitle: 'Principal PM',
        href: '/profile/mentor-7',
        isCurrent: true,
        disabled: false,
        personalLinks: [{ platform: 'github', url: 'https://github.com/ada' }],
      });

      expect(model.desktopNav.resolvedRoleItem).toMatchObject({
        id: 'my-mentor-page',
        href: '/profile/mentor-7',
        isCurrent: true,
        disabled: false,
      });
      expect(model.desktopAccountMenu.navItems[0]).toMatchObject({
        id: 'mentor-reservations',
        href: '/reservation/mentor',
        disabled: false,
      });
    });
  });

  describe('active route matching & feature flag gating', () => {
    it.each([
      ['/mentor-pool', 'find-mentor'],
      ['/mentor-pool/frontend', 'find-mentor'],
      ['/about', 'about'],
      ['/reservation/mentor/upcoming', 'mentor-reservations'],
      ['/reservation/mentee', 'my-reservations'],
      ['/favorites', 'my-favorites'],
    ])('marks %s as current for %s', (pathname, expectedId) => {
      const model = buildHeaderNavigationModel({
        identity: authenticatedIdentity('mentor-1', { isMentor: true }),
        pathname,
        showFavorites: true,
      });

      const allLinks = [
        model.desktopNav.findMentor,
        model.desktopNav.about,
        ...model.desktopAccountMenu.navItems,
      ];
      const matching = allLinks.filter((item) => item.isCurrent);
      expect(matching.map((item) => item.id)).toContain(expectedId);
    });

    it('filters my-favorites once in the model via showFavorites override or isFavoritesEnabled()', () => {
      vi.stubEnv('NEXT_PUBLIC_ENABLE_FAVORITES', 'false');
      const envDisabled = buildHeaderNavigationModel({
        identity: authenticatedIdentity('user-1', { isMentor: false }),
        pathname: '/',
      });

      expect(
        envDisabled.desktopAccountMenu.navItems.some(
          (i) => i.id === 'my-favorites'
        )
      ).toBe(false);
      expect(
        envDisabled.mobileAccountMenu.navItems.some(
          (i) => i.id === 'my-favorites'
        )
      ).toBe(false);

      const explicitEnabled = buildHeaderNavigationModel({
        identity: authenticatedIdentity('user-1', { isMentor: false }),
        pathname: '/',
        showFavorites: true,
      });
      expect(
        explicitEnabled.desktopAccountMenu.navItems.some(
          (i) => i.id === 'my-favorites'
        )
      ).toBe(true);
      expect(
        explicitEnabled.mobileAccountMenu.navItems.some(
          (i) => i.id === 'my-favorites'
        )
      ).toBe(true);
    });

    it('enforces strict fail-closed isAccountDeletionEnabled() even in development unless NEXT_PUBLIC_CAN_DELETE_ACCOUNT is "true"', () => {
      const devUnset = buildHeaderNavigationModel({
        identity: authenticatedIdentity('user-1', { isMentor: false }),
        env: fromPartial<NodeJS.ProcessEnv>({ NODE_ENV: 'development' }),
      });
      expect(devUnset.canDeleteAccount).toBe(false);
      expect(
        devUnset.desktopAccountMenu.accountActions.map((a) => a.intent)
      ).toEqual(['logout']);

      const enabled = buildHeaderNavigationModel({
        identity: authenticatedIdentity('user-1', { isMentor: false }),
        env: fromPartial<NodeJS.ProcessEnv>({
          NODE_ENV: 'production',
          NEXT_PUBLIC_CAN_DELETE_ACCOUNT: ' true ',
        }),
      });
      expect(enabled.canDeleteAccount).toBe(true);
      expect(
        enabled.desktopAccountMenu.accountActions.map((a) => a.intent)
      ).toEqual(['logout', 'delete-account']);
      expect(
        enabled.mobileAccountMenu.accountActions.map((a) => a.intent)
      ).toEqual(['logout', 'delete-account']);
    });
  });

  describe('bindHeaderNavigationCallbacks', () => {
    it('binds action intents and external feedback callbacks while short-circuiting disabled actions', () => {
      const onFeedbackClick = vi.fn();
      const onAction = vi.fn();
      const closeMenu = vi.fn();

      const hintModel = buildHeaderNavigationModel({
        identity: buildResolvedIdentity({
          state: 'hint-only',
          isMentor: false,
        }),
        canDeleteAccount: true,
      });
      const boundHint = bindHeaderNavigationCallbacks(hintModel, {
        onFeedbackClick,
        onAction,
      });

      void boundHint.desktopAccountMenu.shareProfile.onSelect(closeMenu);
      const hintDelete = boundHint.desktopAccountMenu.accountActions.find(
        (a) => a.id === 'delete-account'
      )!;
      void hintDelete.onSelect(closeMenu);
      expect(onAction).not.toHaveBeenCalled();

      const memberModel = buildHeaderNavigationModel({
        identity: authenticatedIdentity('user-1', { isMentor: false }),
        canDeleteAccount: true,
      });
      const boundMember = bindHeaderNavigationCallbacks(memberModel, {
        onFeedbackClick,
        onAction,
      });

      boundMember.desktopNav.feedback.onClick();
      expect(onFeedbackClick).toHaveBeenCalledOnce();

      void boundMember.desktopAccountMenu.shareProfile.onSelect(closeMenu);
      expect(onAction).toHaveBeenCalledWith('share-profile', closeMenu);
    });

    it('normalizes default_1~6 preset avatar codes, trims whitespace, and preserves empty or custom URLs (#960)', () => {
      for (let i = 1; i <= 6; i += 1) {
        const presetModel = buildHeaderNavigationModel({
          identity: authenticatedIdentity('user-1', {
            isMentor: false,
            avatar: `  default_${i}  `,
          }),
        });
        expect(presetModel.profileHeader.avatarSrc).toBe(
          `/avatars/default_${i}.webp`
        );
      }

      const emptyModel = buildHeaderNavigationModel({
        identity: authenticatedIdentity('user-1', {
          isMentor: false,
          avatar: '   ',
        }),
      });
      expect(emptyModel.profileHeader.avatarSrc).toBe('');

      const fallbackUserModel = buildHeaderNavigationModel({
        identity: authenticatedIdentity('user-1', {
          isMentor: false,
          avatar: undefined,
        }),
        user: {
          name: 'Test',
          avatar: 'default_4',
        },
      });
      expect(fallbackUserModel.profileHeader.avatarSrc).toBe(
        '/avatars/default_4.webp'
      );

      const customModel = buildHeaderNavigationModel({
        identity: authenticatedIdentity('user-1', {
          isMentor: false,
          avatar: 'https://cdn.example.com/custom.png',
        }),
      });
      expect(customModel.profileHeader.avatarSrc).toBe(
        'https://cdn.example.com/custom.png'
      );
    });
  });
});
