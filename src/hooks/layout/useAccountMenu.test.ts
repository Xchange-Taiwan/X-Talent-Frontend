import { act, renderHook } from '@testing-library/react';
import type { Session } from 'next-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

const mockUseCurrentAvatar = vi.fn();
vi.mock('@/hooks/user/profile/useCurrentAvatar', () => ({
  useCurrentAvatar: () => mockUseCurrentAvatar(),
}));

const mockPostBackendLogout = vi.fn();
vi.mock('@/services/auth/backendLogout', () => ({
  postBackendLogout: () => mockPostBackendLogout(),
}));

import {
  DOM_AUTH_AVATAR_ATTR,
  DOM_AUTH_STATE_ATTR,
  SESSION_HINT_COOKIE,
} from '@/lib/auth/sessionHint';
import { authenticatedIdentity, GUEST_IDENTITY } from '@/test/mocks/identity';
import { mockRouter } from '@/test/mocks/navigation';
import { mockSignOut } from '@/test/mocks/nextAuth';

import { useAccountMenu } from './useAccountMenu';

function buildUser(overrides: Partial<Session['user']> = {}): Session['user'] {
  return {
    id: 'user-1',
    name: 'Ada Lovelace',
    isMentor: false,
    ...overrides,
  } as Session['user'];
}

describe('useAccountMenu', () => {
  const originalEnv = process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT;
  const closeMenu = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCurrentAvatar.mockReturnValue(null);
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

  describe('derived state', () => {
    it('exposes mentee session state', () => {
      const { result } = renderHook(() =>
        useAccountMenu({
          identity: authenticatedIdentity('user-1', { isMentor: false }),
          user: buildUser({ isMentor: false }),
          closeMenu,
        })
      );

      expect(result.current.userId).toBe('user-1');
      expect(result.current.isMentor).toBe(false);
      expect(result.current.profilePath).toBe('/profile/user-1');
    });

    it('exposes mentor session state', () => {
      const { result } = renderHook(() =>
        useAccountMenu({
          identity: authenticatedIdentity('user-1', { isMentor: true }),
          user: buildUser({ isMentor: true }),
          closeMenu,
        })
      );

      expect(result.current.isMentor).toBe(true);
    });

    it('falls back profilePath to "/" when there is no userId', () => {
      const { result } = renderHook(() =>
        useAccountMenu({
          identity: GUEST_IDENTITY,
          user: buildUser({ id: undefined }),
          closeMenu,
        })
      );

      expect(result.current.profilePath).toBe('/');
    });

    it('reads canDeleteAccount from the feature flag env var', () => {
      process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = 'true';
      const { result: enabled } = renderHook(() =>
        useAccountMenu({
          identity: authenticatedIdentity('user-1', { isMentor: false }),
          user: buildUser(),
          closeMenu,
        })
      );
      expect(enabled.current.canDeleteAccount).toBe(true);

      process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = 'false';
      const { result: disabled } = renderHook(() =>
        useAccountMenu({
          identity: authenticatedIdentity('user-1', { isMentor: false }),
          user: buildUser(),
          closeMenu,
        })
      );
      expect(disabled.current.canDeleteAccount).toBe(false);
    });

    it('reads the avatar through useCurrentAvatar, falling back to an empty string', () => {
      mockUseCurrentAvatar.mockReturnValue('https://example.com/avatar.png');
      const { result } = renderHook(() =>
        useAccountMenu({
          identity: authenticatedIdentity('user-1', { isMentor: false }),
          user: buildUser(),
          closeMenu,
        })
      );

      expect(result.current.avatarSrc).toBe('https://example.com/avatar.png');
    });

    it('defaults personalLinks to an empty array', () => {
      const { result } = renderHook(() =>
        useAccountMenu({
          identity: authenticatedIdentity('user-1', { isMentor: false }),
          user: buildUser(),
          closeMenu,
        })
      );

      expect(result.current.personalLinks).toEqual([]);
    });

    it.each([
      ['Engineer', 'Acme', 'Engineer at Acme'],
      ['Engineer', undefined, 'Engineer'],
      [undefined, 'Acme', 'Acme'],
      [undefined, undefined, ''],
    ])(
      'builds subtitle from jobTitle=%s company=%s -> %s',
      (jobTitle, company, expected) => {
        const { result } = renderHook(() =>
          useAccountMenu({
            identity: authenticatedIdentity('user-1', { isMentor: false }),
            user: buildUser({ jobTitle, company }),
            closeMenu,
          })
        );

        expect(result.current.subtitle).toBe(expected);
      }
    );
  });

  describe('handleGoProfile', () => {
    it('closes the menu and navigates to the profile path', () => {
      const { result } = renderHook(() =>
        useAccountMenu({
          identity: authenticatedIdentity('user-1', { isMentor: false }),
          user: buildUser(),
          closeMenu,
        })
      );

      act(() => {
        result.current.handleGoProfile();
      });

      expect(closeMenu).toHaveBeenCalledOnce();
      expect(mockRouter.push).toHaveBeenCalledWith('/profile/user-1');
    });
  });

  describe('handleShareProfile', () => {
    it('does nothing without a userId', () => {
      const { result } = renderHook(() =>
        useAccountMenu({
          identity: GUEST_IDENTITY,
          user: buildUser({ id: undefined }),
          closeMenu,
        })
      );

      act(() => {
        result.current.handleShareProfile();
      });

      expect(closeMenu).not.toHaveBeenCalled();
      expect(result.current.shareDialogOpen).toBe(false);
    });

    it('opens the share dialog without closing the outer menu', () => {
      const { result } = renderHook(() =>
        useAccountMenu({
          identity: authenticatedIdentity('user-1', { isMentor: false }),
          user: buildUser(),
          closeMenu,
        })
      );

      act(() => {
        result.current.handleShareProfile();
      });

      expect(closeMenu).not.toHaveBeenCalled();
      expect(result.current.shareDialogOpen).toBe(true);
    });
  });

  describe('handleAsMentor', () => {
    it('does nothing without a userId', () => {
      const { result } = renderHook(() =>
        useAccountMenu({
          identity: GUEST_IDENTITY,
          user: buildUser({ id: undefined }),
          closeMenu,
        })
      );

      act(() => {
        result.current.handleAsMentor();
      });

      expect(closeMenu).not.toHaveBeenCalled();
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('routes existing mentors to the mentor reservation management page', () => {
      const { result } = renderHook(() =>
        useAccountMenu({
          identity: authenticatedIdentity('user-1', { isMentor: true }),
          user: buildUser({ isMentor: true }),
          closeMenu,
        })
      );

      act(() => {
        result.current.handleAsMentor();
      });

      expect(closeMenu).toHaveBeenCalledOnce();
      expect(mockRouter.push).toHaveBeenCalledWith('/reservation/mentor');
    });

    it('routes mentees into mentor onboarding', () => {
      const { result } = renderHook(() =>
        useAccountMenu({
          identity: authenticatedIdentity('user-1', { isMentor: false }),
          user: buildUser({ isMentor: false }),
          closeMenu,
        })
      );

      act(() => {
        result.current.handleAsMentor();
      });

      expect(mockRouter.push).toHaveBeenCalledWith(
        '/profile/user-1/edit?mentor-onboarding=true'
      );
    });
  });

  describe('handleMyReservation', () => {
    it('closes the menu and navigates to the mentee reservation page', () => {
      const { result } = renderHook(() =>
        useAccountMenu({
          identity: authenticatedIdentity('user-1', { isMentor: false }),
          user: buildUser(),
          closeMenu,
        })
      );

      act(() => {
        result.current.handleMyReservation();
      });

      expect(closeMenu).toHaveBeenCalledOnce();
      expect(mockRouter.push).toHaveBeenCalledWith('/reservation/mentee');
    });
  });

  describe('handleDeleteAccount', () => {
    it('closes the menu and opens the delete dialog on the next animation frame', () => {
      const { result } = renderHook(() =>
        useAccountMenu({
          identity: authenticatedIdentity('user-1', { isMentor: false }),
          user: buildUser(),
          closeMenu,
        })
      );

      act(() => {
        result.current.handleDeleteAccount();
      });

      expect(closeMenu).toHaveBeenCalledOnce();
      expect(result.current.deleteDialogOpen).toBe(true);
    });
  });

  describe('handleLogout', () => {
    it('revokes the backend session before signing the user out', async () => {
      mockPostBackendLogout.mockResolvedValue(undefined);

      // Set initial values
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

      const { result } = renderHook(() =>
        useAccountMenu({
          identity: authenticatedIdentity('user-1', { isMentor: false }),
          user: buildUser(),
          closeMenu,
        })
      );

      await act(async () => {
        await result.current.handleLogout();
      });

      expect(closeMenu).toHaveBeenCalledOnce();
      expect(mockPostBackendLogout).toHaveBeenCalledOnce();
      expect(mockSignOut).toHaveBeenCalledOnce();

      // Verify they are completely cleared upon logout
      expect(document.cookie).not.toContain(`${SESSION_HINT_COOKIE}=`);
      expect(
        document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)
      ).toBeNull();
      expect(
        document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)
      ).toBeNull();
      expect(
        document.documentElement.style.getPropertyValue('--auth-avatar')
      ).toBe('');
    });

    it('still signs the user out locally when the backend revocation fails', async () => {
      mockPostBackendLogout.mockRejectedValue(new Error('network error'));

      const { result } = renderHook(() =>
        useAccountMenu({
          identity: authenticatedIdentity('user-1', { isMentor: false }),
          user: buildUser(),
          closeMenu,
        })
      );

      await act(async () => {
        await result.current.handleLogout();
      });

      expect(mockPostBackendLogout).toHaveBeenCalledOnce();
      expect(mockSignOut).toHaveBeenCalledOnce();
    });
  });

  describe('dialog state setters', () => {
    it('allows the shell to directly set shareDialogOpen', () => {
      const { result } = renderHook(() =>
        useAccountMenu({
          identity: authenticatedIdentity('user-1', { isMentor: false }),
          user: buildUser(),
          closeMenu,
        })
      );

      act(() => {
        result.current.setShareDialogOpen(true);
      });
      expect(result.current.shareDialogOpen).toBe(true);

      act(() => {
        result.current.setShareDialogOpen(false);
      });
      expect(result.current.shareDialogOpen).toBe(false);
    });

    it('allows the shell to directly set deleteDialogOpen', () => {
      const { result } = renderHook(() =>
        useAccountMenu({
          identity: authenticatedIdentity('user-1', { isMentor: false }),
          user: buildUser(),
          closeMenu,
        })
      );

      act(() => {
        result.current.setDeleteDialogOpen(true);
      });
      expect(result.current.deleteDialogOpen).toBe(true);
    });
  });
});
