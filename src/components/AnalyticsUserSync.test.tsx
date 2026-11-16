import { render } from '@testing-library/react';
import { fromAny, fromPartial } from '@total-typescript/shoehorn';
import type { SessionContextValue } from 'next-auth/react';
import { useSession } from 'next-auth/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getAnalyticsUserContext,
  resetAnalyticsUserState,
  trackEvent,
} from '@/lib/analytics';

import AnalyticsUserSync from './AnalyticsUserSync';

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

const mockUseSession = vi.mocked(useSession);

describe('AnalyticsUserSync', () => {
  let mockGtag: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;

  beforeEach(() => {
    resetAnalyticsUserState();
    mockGtag = vi.fn<(...args: unknown[]) => void>();
    window.gtag = mockGtag;
    window.dataLayer = [];
    window.history.replaceState({}, '', '/mentor-pool');
    document.title = '尋找導師 | XChange Talent Pool';
  });

  afterEach(() => {
    resetAnalyticsUserState();
    delete window.gtag;
    delete window.dataLayer;
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('waits while session status is loading without prematurely emitting guest config', () => {
    mockUseSession.mockReturnValue(
      fromPartial<SessionContextValue>({
        data: null,
        status: 'loading',
      })
    );

    render(<AnalyticsUserSync gaId="G-TEST866001" />);

    expect(mockGtag).not.toHaveBeenCalled();
    expect(getAnalyticsUserContext()).toEqual({
      userId: null,
      userRole: null,
    });
  });

  it('binds internal session.user.id via gtag config on login, attaches user_id & user_role to events, and clears to null on logout without leaking PII', () => {
    mockUseSession.mockReturnValue(
      fromPartial<SessionContextValue>({
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI5OTk5OTgifQ.secretSig',
          user: {
            id: '999998',
            email: 'private.mentor@example.com',
            name: 'Alice Chen',
            isMentor: true,
          },
        },
        status: 'authenticated',
      })
    );

    const { rerender } = render(
      <React.StrictMode>
        <AnalyticsUserSync gaId="G-TEST866001" />
      </React.StrictMode>
    );

    // Deduplicated even under React.StrictMode
    expect(mockGtag).toHaveBeenCalledTimes(1);
    expect(mockGtag).toHaveBeenCalledWith('config', 'G-TEST866001', {
      send_page_view: false,
      user_id: '999998',
      user_role: 'mentor',
    });

    // Subsequent events automatically carry internal user_id & user_role
    trackEvent({
      name: 'mentor_card_click',
      feature: 'mentor_pool',
      metadata: { mentor_id: '7482008160728084' },
    });

    expect(mockGtag).toHaveBeenLastCalledWith('event', 'mentor_card_click', {
      feature: 'mentor_pool',
      mentor_id: '7482008160728084',
      user_id: '999998',
      user_role: 'mentor',
      page_location: `${window.location.origin}/mentor-pool`,
      page_title: '尋找導師 | XChange Talent Pool',
    });

    const serializedCalls = JSON.stringify(mockGtag.mock.calls);
    expect(serializedCalls).not.toContain('private.mentor@example.com');
    expect(serializedCalls).not.toContain('Alice Chen');
    expect(serializedCalls).not.toContain('secretSig');

    // Simulate logout -> unauthenticated session clears GA4 user_id to null and resets role to guest
    mockGtag.mockClear();
    mockUseSession.mockReturnValue(
      fromPartial<SessionContextValue>({
        data: null,
        status: 'unauthenticated',
      })
    );

    rerender(
      <React.StrictMode>
        <AnalyticsUserSync gaId="G-TEST866001" />
      </React.StrictMode>
    );

    expect(mockGtag).toHaveBeenCalledTimes(1);
    expect(mockGtag).toHaveBeenCalledWith('config', 'G-TEST866001', {
      send_page_view: false,
      user_id: null,
      user_role: 'guest',
    });

    trackEvent({
      name: 'mentor_card_click',
      feature: 'mentor_pool',
      metadata: { mentor_id: '7482008160728084' },
    });

    expect(mockGtag).toHaveBeenLastCalledWith('event', 'mentor_card_click', {
      feature: 'mentor_pool',
      mentor_id: '7482008160728084',
      user_role: 'guest',
      page_location: `${window.location.origin}/mentor-pool`,
      page_title: '尋找導師 | XChange Talent Pool',
    });
  });

  it('rejects malformed or PII-tainted session.user.id values (email, real name, JWT) and falls back safely to null', () => {
    for (const unsafeId of [
      'leaked.user@example.com',
      'Alice Chen',
      '王小明',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig',
      'mock-access-token',
      'undefined',
      'NaN',
    ]) {
      mockGtag.mockClear();
      resetAnalyticsUserState();
      mockUseSession.mockReturnValue(
        fromPartial<SessionContextValue>({
          data: {
            user: {
              id: unsafeId,
              isMentor: false,
            },
          },
          status: 'authenticated',
        })
      );

      const { unmount } = render(<AnalyticsUserSync gaId="G-TEST866001" />);

      expect(getAnalyticsUserContext()).toEqual({
        userId: null,
        userRole: 'guest',
      });
      expect(mockGtag).toHaveBeenCalledTimes(1);
      expect(mockGtag).toHaveBeenCalledWith('config', 'G-TEST866001', {
        send_page_view: false,
        user_id: null,
        user_role: 'guest',
      });
      expect(JSON.stringify(mockGtag.mock.calls)).not.toContain(unsafeId);
      unmount();
    }

    for (const sentinelId of ['null', '0']) {
      mockGtag.mockClear();
      resetAnalyticsUserState();
      mockUseSession.mockReturnValue(
        fromPartial<SessionContextValue>({
          data: {
            user: {
              id: sentinelId,
              isMentor: true,
            },
          },
          status: 'authenticated',
        })
      );

      const { unmount } = render(<AnalyticsUserSync gaId="G-TEST866001" />);

      expect(getAnalyticsUserContext()).toEqual({
        userId: null,
        userRole: 'guest',
      });
      expect(mockGtag).toHaveBeenCalledTimes(1);
      expect(mockGtag).toHaveBeenCalledWith('config', 'G-TEST866001', {
        send_page_view: false,
        user_id: null,
        user_role: 'guest',
      });
      unmount();
    }
  });

  it('re-syncs user_role from mentee to mentor when session isMentor updates and clears stale user.id when status is unauthenticated', () => {
    mockUseSession.mockReturnValue(
      fromPartial<SessionContextValue>({
        data: {
          user: {
            id: '777001',
            isMentor: false,
          },
        },
        status: 'authenticated',
      })
    );

    const { rerender } = render(<AnalyticsUserSync gaId="G-TEST866001" />);

    expect(mockGtag).toHaveBeenCalledTimes(1);
    expect(mockGtag).toHaveBeenLastCalledWith('config', 'G-TEST866001', {
      send_page_view: false,
      user_id: '777001',
      user_role: 'mentee',
    });

    // User completes mentor onboarding -> isMentor flips to true
    mockUseSession.mockReturnValue(
      fromPartial<SessionContextValue>({
        data: {
          user: {
            id: '777001',
            isMentor: true,
          },
        },
        status: 'authenticated',
      })
    );
    rerender(<AnalyticsUserSync gaId="G-TEST866001" />);

    expect(mockGtag).toHaveBeenCalledTimes(2);
    expect(mockGtag).toHaveBeenLastCalledWith('config', 'G-TEST866001', {
      send_page_view: false,
      user_id: '777001',
      user_role: 'mentor',
    });

    // Unauthenticated status must clear user_id even if stale session object still carries user.id
    mockUseSession.mockReturnValue(
      fromAny({
        data: {
          user: {
            id: '777001',
            isMentor: true,
          },
        },
        status: 'unauthenticated',
      })
    );
    rerender(<AnalyticsUserSync gaId="G-TEST866001" />);

    expect(getAnalyticsUserContext()).toEqual({
      userId: null,
      userRole: 'guest',
    });
    expect(mockGtag).toHaveBeenCalledTimes(3);
    expect(mockGtag).toHaveBeenLastCalledWith('config', 'G-TEST866001', {
      send_page_view: false,
      user_id: null,
      user_role: 'guest',
    });
  });

  it('clears user_id to null immediately when session has RefreshTokenError even if stale user.id is still present', () => {
    mockUseSession.mockReturnValue(
      fromPartial<SessionContextValue>({
        data: {
          error: 'RefreshTokenError',
          user: {
            id: '999998',
            isMentor: true,
          },
        },
        status: 'authenticated',
      })
    );

    render(<AnalyticsUserSync gaId="G-TEST866001" />);

    expect(getAnalyticsUserContext()).toEqual({
      userId: null,
      userRole: 'guest',
    });
    expect(mockGtag).toHaveBeenCalledTimes(1);
    expect(mockGtag).toHaveBeenCalledWith('config', 'G-TEST866001', {
      send_page_view: false,
      user_id: null,
      user_role: 'guest',
    });
  });
});
