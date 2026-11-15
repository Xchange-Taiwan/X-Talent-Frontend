import { act, renderHook } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import type { Session } from 'next-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUsePathname = vi.fn<() => string>(() => '/');
vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return {
    ...navigationMockFactory(),
    usePathname: () => mockUsePathname(),
  };
});

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

const mockPostBackendLogout = vi.fn();
vi.mock('@/services/auth/authClient', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/auth/authClient')>();
  return {
    ...actual,
    authClient: {
      ...actual.authClient,
      postBackendLogout: () => mockPostBackendLogout(),
    },
  };
});

const mockTrackEvent = vi.fn();
vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    clearAnalyticsUser: vi.fn(),
    trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  };
});

import { clearAnalyticsUser } from '@/lib/analytics';
import { PENDING_AUTH_CALLBACK_URL_KEY } from '@/lib/auth/authFlowStorage';
import {
  DOM_AUTH_AVATAR_ATTR,
  DOM_AUTH_STATE_ATTR,
  SESSION_HINT_COOKIE,
} from '@/lib/auth/sessionHint';
import { scheduleReadModel } from '@/lib/mentor-schedule/scheduleReadModel';
import { reservationReadModel } from '@/lib/reservation/reservationReadModel';
import { notificationStoreManager } from '@/stores/notificationStore';
import {
  authenticatedIdentity,
  buildResolvedIdentity,
  GUEST_IDENTITY,
  UNKNOWN_IDENTITY,
} from '@/test/mocks/identity';
import { mockSignOut } from '@/test/mocks/nextAuth';

import {
  EXTERNAL_FEEDBACK_ARIA_LABEL,
  FEEDBACK_FORM_URL,
  getBecomeMentorHref,
  getNavAnalyticsAttributes,
  getProfileHref,
  useHeaderNavigation,
} from './useHeaderNavigation';

function buildUser(overrides: Partial<Session['user']> = {}): Session['user'] {
  return fromPartial({
    id: 'user-1',
    name: 'Ada Lovelace',
    isMentor: false,
    ...overrides,
  });
}

describe('useHeaderNavigation', () => {
  const originalEnv = process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue('/');
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0);
        return 0;
      }
    );
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = originalEnv;
    vi.unstubAllGlobals();
  });

  describe('pure href & analytics helpers', () => {
    it('builds profile and become-mentor hrefs consistently', () => {
      expect(getProfileHref('user-123')).toBe('/profile/user-123');
      expect(getProfileHref(undefined)).toBe('/');
      expect(getBecomeMentorHref('user-123')).toBe(
        '/profile/user-123/edit?mentor-onboarding=true'
      );
      expect(getBecomeMentorHref(undefined)).toBe('/auth/signup');
    });

    it('maps NavAnalyticsMetadata to data-analytics-* attributes including omitDestination', () => {
      expect(getNavAnalyticsAttributes(undefined)).toEqual({});
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
  });

  describe('navigation states across unknown, guest, hint-only, mentee, and mentor', () => {
    it('exposes pre-hydration candidates without disabling guest fast-path when state is unknown', () => {
      const { result } = renderHook(() =>
        useHeaderNavigation({ identity: UNKNOWN_IDENTITY })
      );

      expect(result.current.desktopNav.nonMentorRoleCandidate.href).toBe(
        '/auth/signup'
      );
      expect(result.current.desktopNav.nonMentorRoleCandidate.disabled).toBe(
        false
      );
      expect(result.current.desktopNav.mentorRoleCandidate.disabled).toBe(
        false
      );
    });

    it('exposes guest navigation with /auth/signup and external feedback aria-label', () => {
      const { result } = renderHook(() =>
        useHeaderNavigation({ identity: GUEST_IDENTITY })
      );

      expect(result.current.desktopNav.resolvedRoleItem).toMatchObject({
        id: 'become-mentor',
        label: '成為導師',
        href: '/auth/signup',
        disabled: false,
      });

      const mobileLabels = result.current.mobileGuestMenu.navItems.map(
        (item) => item.label
      );
      expect(mobileLabels).toEqual([
        '尋找導師',
        '成為導師',
        '關於 X-Talent',
        '提供回饋',
      ]);

      const feedback = result.current.desktopNav.feedback;
      expect(feedback.href).toBe(FEEDBACK_FORM_URL);
      expect(feedback.ariaLabel).toBe(EXTERNAL_FEEDBACK_ARIA_LABEL);

      act(() => {
        feedback.onClick();
      });
      expect(mockTrackEvent).toHaveBeenCalledWith({ name: 'feedback_open' });
    });

    it('disables profileHeader, shareProfile, and role links during hint-only even if userId is absent or present', () => {
      const closeMenu = vi.fn();
      const { result } = renderHook(() =>
        useHeaderNavigation({
          identity: buildResolvedIdentity({
            state: 'hint-only',
            isMentor: false,
            avatar: 'https://example.com/hint-avatar.png',
          }),
        })
      );

      expect(result.current.profileHeader.disabled).toBe(true);
      expect(result.current.profileHeader.isCurrent).toBe(false);
      expect(result.current.profileHeader.avatarSrc).toBe(
        'https://example.com/hint-avatar.png'
      );
      expect(result.current.desktopNav.resolvedRoleItem.disabled).toBe(true);
      expect(result.current.desktopAccountMenu.shareProfile.disabled).toBe(
        true
      );
      expect(result.current.mobileAccountMenu.shareProfile.disabled).toBe(true);
      expect(result.current.desktopAccountMenu.navItems[0]?.disabled).toBe(
        true
      );
      expect(result.current.mobileAccountMenu.navItems[0]?.disabled).toBe(true);

      act(() => {
        void result.current.desktopAccountMenu.shareProfile.onSelect(closeMenu);
      });
      expect(closeMenu).not.toHaveBeenCalled();
      expect(result.current.activeDialog).toBeNull();
    });

    it('exposes mentee account items with mentor-onboarding link and merged mobile general links', () => {
      const { result } = renderHook(() =>
        useHeaderNavigation({
          identity: authenticatedIdentity('mentee-1', {
            isMentor: false,
            name: 'Ada Lovelace',
            jobTitle: 'Engineer',
            company: 'Acme',
          }),
        })
      );

      expect(result.current.profileHeader).toMatchObject({
        userId: 'mentee-1',
        name: 'Ada Lovelace',
        displayName: 'Ada Lovelace',
        subtitle: 'Engineer at Acme',
        href: '/profile/mentee-1',
        disabled: false,
      });

      expect(
        result.current.desktopAccountMenu.navItems.map((i) => ({
          label: i.label,
          href: i.href,
          click: i.analytics.click,
        }))
      ).toEqual([
        {
          label: '成為導師',
          href: '/profile/mentee-1/edit?mentor-onboarding=true',
          click: 'user_menu_become_mentor',
        },
        {
          label: '我的預約',
          href: '/reservation/mentee',
          click: 'user_menu_my_reservations',
        },
        {
          label: '我的收藏',
          href: '/favorites',
          click: 'user_menu_my_favorites',
        },
      ]);

      expect(
        result.current.mobileAccountMenu.navItems.map((i) => i.label)
      ).toEqual([
        '成為導師',
        '我的預約',
        '我的收藏',
        '尋找導師',
        '關於 X-Talent',
        '提供回饋',
      ]);

      const mobileFeedback = result.current.mobileAccountMenu.navItems.find(
        (i) => i.id === 'feedback'
      );
      expect(mobileFeedback).toMatchObject({
        kind: 'external-link',
        ariaLabel: EXTERNAL_FEEDBACK_ARIA_LABEL,
      });
    });

    it('exposes mentor account items with 導師預約管理 and 我的導師頁面', () => {
      const { result } = renderHook(() =>
        useHeaderNavigation({
          identity: authenticatedIdentity('mentor-9', { isMentor: true }),
        })
      );

      expect(result.current.desktopNav.resolvedRoleItem).toMatchObject({
        id: 'my-mentor-page',
        label: '我的導師頁面',
        href: '/profile/mentor-9',
        disabled: false,
      });

      expect(result.current.desktopAccountMenu.navItems[0]).toMatchObject({
        id: 'mentor-reservations',
        label: '導師預約管理',
        href: '/reservation/mentor',
        disabled: false,
      });
    });

    it.each([
      ['Engineer', undefined, 'Engineer'],
      [undefined, 'Acme', 'Acme'],
      [undefined, undefined, ''],
    ])(
      'formats subtitle for jobTitle=%s company=%s -> %s and falls back displayName',
      (jobTitle, company, expectedSubtitle) => {
        const { result } = renderHook(() =>
          useHeaderNavigation({
            identity: authenticatedIdentity('user-1', { isMentor: false }),
            user: buildUser({ name: undefined, jobTitle, company }),
          })
        );

        expect(result.current.profileHeader.subtitle).toBe(expectedSubtitle);
        expect(result.current.profileHeader.displayName).toBe('我的個人頁面');
      }
    );
  });

  describe('aria-current (isCurrent) across routes', () => {
    it.each([
      ['/mentor-pool', 'find-mentor'],
      ['/about', 'about'],
      ['/profile/mentor-1', 'my-mentor-page'],
    ])(
      'marks %s as current in desktopNav (%s)',
      (pathname, expectedActiveId) => {
        mockUsePathname.mockReturnValue(pathname);
        const { result } = renderHook(() =>
          useHeaderNavigation({
            identity: authenticatedIdentity('mentor-1', { isMentor: true }),
          })
        );

        const items = [
          result.current.desktopNav.findMentor,
          result.current.desktopNav.resolvedRoleItem,
          result.current.desktopNav.about,
        ];
        const activeIds = items.filter((i) => i.isCurrent).map((i) => i.id);
        expect(activeIds).toEqual([expectedActiveId]);
      }
    );

    it('marks profileHeader, mentor-reservations, my-reservations, and my-favorites as current on matching routes', () => {
      mockUsePathname.mockReturnValue('/profile/mentor-1');
      const { result, rerender } = renderHook(() =>
        useHeaderNavigation({
          identity: authenticatedIdentity('mentor-1', { isMentor: true }),
        })
      );
      expect(result.current.profileHeader.isCurrent).toBe(true);

      mockUsePathname.mockReturnValue('/reservation/mentor');
      rerender();
      expect(result.current.desktopAccountMenu.navItems[0]?.isCurrent).toBe(
        true
      );
      expect(result.current.mobileAccountMenu.navItems[0]?.isCurrent).toBe(
        true
      );

      mockUsePathname.mockReturnValue('/reservation/mentee');
      rerender();
      expect(result.current.desktopAccountMenu.navItems[1]?.isCurrent).toBe(
        true
      );
      expect(result.current.mobileAccountMenu.navItems[1]?.isCurrent).toBe(
        true
      );

      mockUsePathname.mockReturnValue('/favorites');
      rerender();
      expect(result.current.desktopAccountMenu.navItems[2]?.isCurrent).toBe(
        true
      );
      expect(result.current.mobileAccountMenu.navItems[2]?.isCurrent).toBe(
        true
      );
    });
  });

  describe('canDeleteAccount & single-instance activeDialog state', () => {
    it('includes delete-account action only when NEXT_PUBLIC_CAN_DELETE_ACCOUNT is true', () => {
      process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = 'false';
      const { result: disabled } = renderHook(() =>
        useHeaderNavigation({
          identity: authenticatedIdentity('user-1', { isMentor: false }),
        })
      );
      expect(disabled.current.canDeleteAccount).toBe(false);
      expect(
        disabled.current.desktopAccountMenu.accountActions.map((a) => a.id)
      ).toEqual(['logout']);

      process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = 'true';
      const { result: enabled } = renderHook(() =>
        useHeaderNavigation({
          identity: authenticatedIdentity('user-1', { isMentor: false }),
        })
      );
      expect(enabled.current.canDeleteAccount).toBe(true);
      expect(
        enabled.current.desktopAccountMenu.accountActions.map((a) => a.id)
      ).toEqual(['logout', 'delete-account']);
      expect(
        enabled.current.mobileAccountMenu.accountActions.map((a) => a.id)
      ).toEqual(['logout', 'delete-account']);
    });

    it('closes the active menu and sets activeDialog for share-profile and delete-account', () => {
      process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = 'true';
      const closeMenu = vi.fn();
      const { result } = renderHook(() =>
        useHeaderNavigation({
          identity: authenticatedIdentity('user-1', { isMentor: false }),
        })
      );

      act(() => {
        void result.current.desktopAccountMenu.shareProfile.onSelect(closeMenu);
      });
      expect(closeMenu).toHaveBeenCalledTimes(1);
      expect(result.current.activeDialog).toBe('share-profile');

      const deleteAction =
        result.current.desktopAccountMenu.accountActions.find(
          (a) => a.id === 'delete-account'
        )!;
      act(() => {
        void deleteAction.onSelect(closeMenu);
      });
      expect(closeMenu).toHaveBeenCalledTimes(2);
      expect(result.current.activeDialog).toBe('delete-account');

      act(() => {
        result.current.setActiveDialog(null);
      });
      expect(result.current.activeDialog).toBeNull();
    });

    it('disables delete-account during hint-only and resets activeDialog across identity transitions', () => {
      process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = 'true';
      const closeMenu = vi.fn();

      const { result, rerender } = renderHook(
        ({ identity }) => useHeaderNavigation({ identity }),
        {
          initialProps: {
            identity: buildResolvedIdentity({
              state: 'hint-only',
              isMentor: false,
            }),
          },
        }
      );

      const hintDeleteAction =
        result.current.desktopAccountMenu.accountActions.find(
          (a) => a.id === 'delete-account'
        )!;
      expect(hintDeleteAction.disabled).toBe(true);
      act(() => {
        void hintDeleteAction.onSelect(closeMenu);
      });
      expect(closeMenu).not.toHaveBeenCalled();
      expect(result.current.activeDialog).toBeNull();

      rerender({
        identity: authenticatedIdentity('user-1', { isMentor: false }),
      });
      act(() => {
        void result.current.desktopAccountMenu.shareProfile.onSelect(closeMenu);
      });
      expect(result.current.activeDialog).toBe('share-profile');

      rerender({ identity: GUEST_IDENTITY });
      expect(result.current.activeDialog).toBeNull();
    });
  });

  describe('logout action', () => {
    it('clears analytics/DOM/read-model state, revokes backend session, and signs out', async () => {
      mockPostBackendLogout.mockResolvedValue(undefined);
      const closeMenu = vi.fn();

      document.cookie = `${SESSION_HINT_COOKIE}=1||https%3A%2F%2Fexample.com%2Favatar.png`;
      document.documentElement.setAttribute(DOM_AUTH_STATE_ATTR, 'mentor');
      document.documentElement.setAttribute(
        DOM_AUTH_AVATAR_ATTR,
        'https://example.com/avatar.png'
      );
      document.documentElement.style.setProperty(
        '--auth-avatar',
        'url("https://example.com/avatar.png")'
      );
      window.sessionStorage.setItem(
        PENDING_AUTH_CALLBACK_URL_KEY,
        '/reservation/mentee'
      );
      notificationStoreManager.getOrCreateState('user-1');
      notificationStoreManager.setInitialData('user-1', 4, [], null);
      reservationReadModel.set(
        { userId: 'user-1', state: 'MENTEE_UPCOMING' },
        { items: [], next_dtend: 0 }
      );
      scheduleReadModel.set({ userId: 'user-1', year: 2026, month: 11 }, []);

      const { result } = renderHook(() =>
        useHeaderNavigation({
          identity: authenticatedIdentity('user-1', { isMentor: false }),
        })
      );

      const logoutAction =
        result.current.desktopAccountMenu.accountActions.find(
          (a) => a.id === 'logout'
        )!;

      await act(async () => {
        await logoutAction.onSelect(closeMenu);
      });

      expect(closeMenu).toHaveBeenCalledOnce();
      expect(clearAnalyticsUser).toHaveBeenCalledOnce();
      expect(mockPostBackendLogout).toHaveBeenCalledOnce();
      expect(mockSignOut).toHaveBeenCalledOnce();
      expect(document.cookie).not.toContain(`${SESSION_HINT_COOKIE}=`);
      expect(
        document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)
      ).toBeNull();
      expect(
        document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)
      ).toBeNull();
      expect(
        notificationStoreManager.getOrCreateState('user-1').unreadCountState
      ).toBe(0);
      expect(
        reservationReadModel.get({
          userId: 'user-1',
          state: 'MENTEE_UPCOMING',
        })
      ).toBeUndefined();
      expect(
        scheduleReadModel.get({ userId: 'user-1', year: 2026, month: 11 })
      ).toBeUndefined();
    });

    it('still completes local signOut when backend logout rejects', async () => {
      mockPostBackendLogout.mockRejectedValue(new Error('network error'));
      const { result } = renderHook(() =>
        useHeaderNavigation({
          identity: authenticatedIdentity('user-1', { isMentor: false }),
        })
      );

      const logoutAction =
        result.current.desktopAccountMenu.accountActions.find(
          (a) => a.id === 'logout'
        )!;

      await act(async () => {
        await logoutAction.onSelect();
      });

      expect(clearAnalyticsUser).toHaveBeenCalledOnce();
      expect(mockSignOut).toHaveBeenCalledOnce();
    });
  });
});
