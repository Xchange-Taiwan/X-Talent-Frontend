import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import fs from 'fs';
import { useSession } from 'next-auth/react';
import path from 'path';
import { createElement, type ReactNode, StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  decodeSessionHint,
  DOM_AUTH_AVATAR_ATTR,
  DOM_AUTH_STATE_ATTR,
  readCookie,
  SESSION_HINT_COOKIE,
} from '@/lib/auth/sessionHint';
import { encode, toWireExperiences } from '@/lib/profile/experienceCodec';
import { profileReadModel } from '@/lib/profile/profileReadModel';
import type { MentorProfileVO } from '@/types/user';

import { useResolvedIdentity } from './useResolvedIdentity';

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

const mockUseSession = vi.mocked(useSession);

function setCookie(value: string | undefined): void {
  if (value === undefined) {
    document.cookie = `${SESSION_HINT_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0`;
    return;
  }
  document.cookie = `${SESSION_HINT_COOKIE}=${value}; path=/`;
}

describe('useResolvedIdentity', () => {
  beforeEach(() => {
    profileReadModel.clear();
    mockUseSession.mockReturnValue(
      fromPartial<ReturnType<typeof useSession>>({
        data: null,
        status: 'loading',
      })
    );
  });

  afterEach(() => {
    cleanup();
    profileReadModel.clear();
    setCookie(undefined);
    document.documentElement.removeAttribute(DOM_AUTH_STATE_ATTR);
    document.documentElement.removeAttribute(DOM_AUTH_AVATAR_ATTR);
    document.documentElement.style.removeProperty('--auth-avatar');
  });

  it('resolves to guest immediately during loading when no hint cookie is present, and stays guest once unauthenticated is confirmed', async () => {
    const { result, rerender } = renderHook(() => useResolvedIdentity());

    // No hint cookie means the last middleware pass saw no valid token, so
    // treat the visitor as a guest right away instead of waiting on
    // useSession() to resolve.
    await waitFor(() => expect(result.current.state).toBe('unknown'));
    expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
      'guest'
    );

    // Once resolved to unauthenticated, stays guest
    mockUseSession.mockReturnValue(
      fromPartial<ReturnType<typeof useSession>>({
        data: null,
        status: 'unauthenticated',
      })
    );
    rerender();

    await waitFor(() => {
      expect(result.current.state).toBe('confirmed-guest');
    });
  });

  it('resolves to authenticated mentor when cookie value is "1"', async () => {
    setCookie('1');
    const { result } = renderHook(() => useResolvedIdentity());
    await waitFor(() =>
      expect(result.current).toMatchObject({
        state: 'hint-only',
        isMentor: true,
        userId: undefined,
        avatar: undefined,
      })
    );
  });

  it('resolves to authenticated non-mentor when cookie value is "0"', async () => {
    setCookie('0');
    const { result } = renderHook(() => useResolvedIdentity());
    await waitFor(() =>
      expect(result.current).toMatchObject({
        state: 'hint-only',
        isMentor: false,
      })
    );
  });

  it('preserves session-hint cookie and resolves to hint-only under React StrictMode while session is loading', async () => {
    setCookie('1|7482008160728084|https%3A%2F%2Fexample.com%2Fmentor.png');
    document.documentElement.setAttribute(DOM_AUTH_STATE_ATTR, 'mentor');

    const strictWrapper = ({ children }: { children: ReactNode }) =>
      createElement(StrictMode, null, children);

    const { result } = renderHook(() => useResolvedIdentity(), {
      wrapper: strictWrapper,
    });

    await waitFor(() =>
      expect(result.current).toMatchObject({
        state: 'hint-only',
        isMentor: true,
        userId: undefined,
        avatar: 'https://example.com/mentor.png',
      })
    );
    expect(document.cookie).toContain(
      `${SESSION_HINT_COOKIE}=1|7482008160728084|https%3A%2F%2Fexample.com%2Fmentor.png`
    );
    expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
      'mentor'
    );
    expect(document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)).toBe(
      'https://example.com/mentor.png'
    );
  });

  it('treats an unrecognized cookie value as guest', async () => {
    setCookie('garbage');
    mockUseSession.mockReturnValue(
      fromPartial<ReturnType<typeof useSession>>({
        data: null,
        status: 'unauthenticated',
      })
    );

    const { result } = renderHook(() => useResolvedIdentity());
    await waitFor(() => expect(result.current.state).toBe('confirmed-guest'));
  });

  it('clears stale mentor/mentee DOM attributes and marks guest when no cookie is present', async () => {
    mockUseSession.mockReturnValue(
      fromPartial<ReturnType<typeof useSession>>({
        data: null,
        status: 'unauthenticated',
      })
    );

    document.documentElement.setAttribute(DOM_AUTH_STATE_ATTR, 'mentor');
    document.documentElement.setAttribute(
      DOM_AUTH_AVATAR_ATTR,
      'https://example.com/avatar.png'
    );
    document.documentElement.style.setProperty(
      '--auth-avatar',
      'url("https://example.com/avatar.png")'
    );

    const { result } = renderHook(() => useResolvedIdentity());

    await waitFor(() => {
      expect(result.current.state).toBe('confirmed-guest');
      expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
        'guest'
      );
      expect(
        document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)
      ).toBeNull();
      expect(
        document.documentElement.style.getPropertyValue('--auth-avatar')
      ).toBe('');
    });
  });

  it('clears avatar attributes and CSS variables when logged in without avatar', async () => {
    document.documentElement.setAttribute(DOM_AUTH_STATE_ATTR, 'mentee');
    document.documentElement.setAttribute(
      DOM_AUTH_AVATAR_ATTR,
      'https://example.com/avatar.png'
    );
    document.documentElement.style.setProperty(
      '--auth-avatar',
      'url("https://example.com/avatar.png")'
    );

    setCookie('1');

    const { result } = renderHook(() => useResolvedIdentity());

    await waitFor(() => {
      expect(result.current).toMatchObject({
        state: 'hint-only',
        isMentor: true,
        avatar: undefined,
      });
      expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
        'mentor'
      );
      expect(
        document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)
      ).toBeNull();
      expect(
        document.documentElement.style.getPropertyValue('--auth-avatar')
      ).toBe('');
    });
  });

  it('actively syncs DOM attributes and style property when hint is resolved with avatar', async () => {
    setCookie('1||https%3A%2F%2Fexample.com%2Favatar.png');

    const { result } = renderHook(() => useResolvedIdentity());

    await waitFor(() => {
      expect(result.current).toMatchObject({
        state: 'hint-only',
        isMentor: true,
        avatar: 'https://example.com/avatar.png',
      });
      expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
        'mentor'
      );
      expect(document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)).toBe(
        'https://example.com/avatar.png'
      );
      expect(
        document.documentElement.style.getPropertyValue('--auth-avatar')
      ).toBe('url("https://example.com/avatar.png")');
    });
  });

  it('escapes double quotes in avatar URL to prevent CSS injection in style property', async () => {
    setCookie(
      '1||https%3A%2F%2Fexample.com%2Favatar.png%22%3Bbackground%3Ared'
    );

    const { result } = renderHook(() => useResolvedIdentity());

    await waitFor(() => {
      expect(result.current).toMatchObject({
        state: 'hint-only',
        isMentor: true,
        avatar: 'https://example.com/avatar.png";background:red',
      });
      expect(document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)).toBe(
        'https://example.com/avatar.png";background:red'
      );

      // Verify quotes are escaped to %22 to completely block CSS Injection breakout
      expect(
        document.documentElement.style.getPropertyValue('--auth-avatar')
      ).toBe('url("https://example.com/avatar.png%22;background:red")');
    });
  });

  it('clears stale avatar/cookie state and marks guest on unauthenticated (logout) session status', async () => {
    mockUseSession.mockReturnValue(
      fromPartial<ReturnType<typeof useSession>>({
        data: null,
        status: 'unauthenticated',
      })
    );

    setCookie('1');

    document.documentElement.setAttribute(DOM_AUTH_STATE_ATTR, 'mentor');
    document.documentElement.setAttribute(DOM_AUTH_AVATAR_ATTR, 'url');
    document.documentElement.style.setProperty('--auth-avatar', 'url("url")');

    const { result } = renderHook(() => useResolvedIdentity());

    await waitFor(() => {
      expect(result.current.state).toBe('confirmed-guest');
      expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
        'guest'
      );
      expect(
        document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)
      ).toBeNull();
      expect(
        document.documentElement.style.getPropertyValue('--auth-avatar')
      ).toBe('');
      expect(document.cookie).not.toContain(`${SESSION_HINT_COOKIE}=`);
    });
  });

  it('synchronizes DOM, style property, and session-hint cookie with real authenticated session data', async () => {
    mockUseSession.mockReturnValue(
      fromPartial<ReturnType<typeof useSession>>({
        data: {
          user: {
            id: 'user-123',
            isMentor: true,
            avatar: 'https://example.com/real-avatar.png',
          },
          expires: '2099-01-01T00:00:00.000Z',
        },
        status: 'authenticated',
      })
    );

    const { result } = renderHook(() => useResolvedIdentity());

    await waitFor(() => {
      expect(result.current).toMatchObject({
        state: 'confirmed-member',
        isMentor: true,
        avatar: 'https://example.com/real-avatar.png',
        userId: 'user-123',
      });
      expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
        'mentor'
      );
      expect(document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)).toBe(
        'https://example.com/real-avatar.png'
      );
      expect(
        document.documentElement.style.getPropertyValue('--auth-avatar')
      ).toBe('url("https://example.com/real-avatar.png")');
      expect(decodeSessionHint(readCookie(SESSION_HINT_COOKIE))).toEqual({
        isMentor: true,
        userId: 'user-123',
        avatar: 'https://example.com/real-avatar.png',
      });
    });
  });

  it('ignores unsafe avatar protocols in syncSessionHintDomAndCookie and does not write them to DOM or cookie', async () => {
    mockUseSession.mockReturnValue(
      fromPartial<ReturnType<typeof useSession>>({
        data: {
          user: {
            id: 'user-123',
            isMentor: true,
            avatar: 'javascript:alert(1)',
          },
          expires: '2099-01-01T00:00:00.000Z',
        },
        status: 'authenticated',
      })
    );

    const { result } = renderHook(() => useResolvedIdentity());

    await waitFor(() => {
      expect(result.current).toMatchObject({
        state: 'confirmed-member',
        isMentor: true,
        avatar: 'javascript:alert(1)',
        userId: 'user-123',
      });
      expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
        'mentor'
      );
      // Should NOT set the avatar attribute or styles because javascript: protocol is completely blocked!
      expect(
        document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)
      ).toBeNull();
      expect(
        document.documentElement.style.getPropertyValue('--auth-avatar')
      ).toBe('');
    });
  });

  it('gracefully handles malformed URI encoding in cookie in useResolvedIdentity without throwing', async () => {
    setCookie('1||https%3A%2F%2Fexample.com%2Finvalid%%url');

    const { result } = renderHook(() => useResolvedIdentity());

    await waitFor(() => {
      expect(result.current).toMatchObject({
        state: 'hint-only',
        isMentor: true,
        avatar: undefined,
      });
      expect(document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)).toBe(
        'mentor'
      );
      expect(
        document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)
      ).toBeNull();
    });
  });

  it('overlays active optimistic identity projection fields from profileReadModel onto the session and updates session-hint cookie (#785, #936)', async () => {
    const { experiences } = encode({
      workExperiences: [],
      educations: [],
      personalLinks: [
        { platform: 'linkedin', url: 'https://linkedin.com/in/test' },
      ],
    });

    mockUseSession.mockReturnValue(
      fromPartial<ReturnType<typeof useSession>>({
        data: {
          user: {
            id: '123',
            name: 'Old Session Name',
            isMentor: false,
            avatar: 'https://example.com/old.png',
            jobTitle: 'Old Role',
            company: 'Old Co',
          },
          expires: '2099-01-01T00:00:00.000Z',
        },
        status: 'authenticated',
      })
    );

    profileReadModel.prime(
      { userId: 123, language: 'zh_TW' },
      fromPartial<MentorProfileVO>({
        user_id: 123,
        name: 'Optimistic Mentor Name',
        avatar: 'https://example.com/new-optimistic.png',
        is_mentor: true,
        onboarding: true,
        job_title: 'Staff Engineer',
        company: 'XChange',
        experiences: toWireExperiences(experiences),
      })
    );

    const { result, rerender } = renderHook(() => useResolvedIdentity());

    await waitFor(() => {
      expect(result.current).toMatchObject({
        state: 'confirmed-member',
        userId: '123',
        name: 'Optimistic Mentor Name',
        avatar: 'https://example.com/new-optimistic.png',
        isMentor: true,
        jobTitle: 'Staff Engineer',
        company: 'XChange',
        personalLinks: [
          { platform: 'linkedin', url: 'https://linkedin.com/in/test' },
        ],
      });
      expect(decodeSessionHint(readCookie(SESSION_HINT_COOKIE))).toEqual({
        isMentor: true,
        userId: '123',
        avatar: 'https://example.com/new-optimistic.png',
      });
    });

    // Preserves resolved identity reference across re-renders when underlying DTO has not changed
    const stableRef = result.current;
    rerender();
    expect(result.current).toBe(stableRef);

    // Live-updates when a newer DTO is primed during the transition window
    act(() => {
      profileReadModel.prime(
        { userId: 123, language: 'zh_TW' },
        fromPartial<MentorProfileVO>({
          user_id: 123,
          name: 'Updated Mentor Name',
          avatar: 'https://example.com/new-optimistic-2.png',
          is_mentor: true,
          onboarding: true,
          job_title: null,
          company: null,
          experiences: [],
        })
      );
    });

    expect(result.current.name).toBe('Updated Mentor Name');
    expect(result.current.jobTitle).toBeUndefined();
    expect(result.current.company).toBeUndefined();
    expect(decodeSessionHint(readCookie(SESSION_HINT_COOKIE))).toEqual({
      isMentor: true,
      userId: '123',
      avatar: 'https://example.com/new-optimistic-2.png',
    });
  });

  it('reverts from optimistic identity back to session values once the 10-second transition window expires (#785)', () => {
    vi.useFakeTimers();
    try {
      mockUseSession.mockReturnValue(
        fromPartial<ReturnType<typeof useSession>>({
          data: {
            user: {
              id: '123',
              name: 'Session Name',
              isMentor: false,
              avatar: 'https://example.com/session.png',
            },
            expires: '2099-01-01T00:00:00.000Z',
          },
          status: 'authenticated',
        })
      );

      profileReadModel.prime(
        { userId: 123, language: 'zh_TW' },
        fromPartial<MentorProfileVO>({
          user_id: 123,
          name: 'Optimistic Name',
          avatar: 'https://example.com/optimistic.png',
          is_mentor: true,
          onboarding: true,
        })
      );

      const { result } = renderHook(() => useResolvedIdentity());
      expect(result.current.name).toBe('Optimistic Name');
      expect(result.current.avatar).toBe('https://example.com/optimistic.png');
      expect(result.current.isMentor).toBe(true);

      // Advance past the 10,000ms optimistic transition window
      act(() => {
        vi.advanceTimersByTime(10001);
      });

      expect(result.current.name).toBe('Session Name');
      expect(result.current.avatar).toBe('https://example.com/session.png');
      expect(result.current.isMentor).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reflects avatar removal (avatar: null) during the optimistic transition window without falling back to the stale session avatar (#785)', async () => {
    mockUseSession.mockReturnValue(
      fromPartial<ReturnType<typeof useSession>>({
        data: {
          user: {
            id: '123',
            name: 'Session Name',
            isMentor: false,
            avatar: 'https://example.com/old-session-avatar.png',
          },
          expires: '2099-01-01T00:00:00.000Z',
        },
        status: 'authenticated',
      })
    );

    profileReadModel.prime(
      { userId: 123, language: 'zh_TW' },
      fromPartial<MentorProfileVO>({
        user_id: 123,
        name: 'Session Name',
        avatar: null,
        is_mentor: false,
        onboarding: true,
      })
    );

    const { result } = renderHook(() => useResolvedIdentity());
    await waitFor(() => {
      expect(result.current.avatar).toBeUndefined();
      expect(decodeSessionHint(readCookie(SESSION_HINT_COOKIE))).toEqual({
        isMentor: false,
        userId: '123',
      });
    });
  });

  it('delegates DOM/cookie sync to syncSessionHintDomAndCookie and folds optimistic observation directly from profileReadModel (#936)', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, 'useResolvedIdentity.ts'),
      'utf8'
    );

    expect(source).toMatch(/syncSessionHintDomAndCookie/);
    expect(source).toMatch(/from\s+['"]@\/lib\/profile\/profileReadModel['"]/);
    expect(source).not.toMatch(/useOptimisticIdentity/);
    expect(source).not.toMatch(/userProfileDtoCache/);
    expect(source).not.toMatch(/function\s+updateAvatarStyle\b/);
    expect(source).not.toMatch(/function\s+removeAvatarStyle\b/);
    expect(source).not.toMatch(/function\s+clearAuthDOMState\b/);
  });
});
