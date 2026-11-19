import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { SessionContext, type SessionContextValue } from 'next-auth/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockReplace = vi.fn();
let currentPathname = '/reservation/mentee';
let currentSearch = '';

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(currentSearch),
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
  }),
}));

import { MentorBookmarkButton } from '@/components/favorites/MentorBookmarkButton';
import { MentorSummaryBar } from '@/components/profile/feedback/MentorSummaryBar';
import { PendingFeedbackQueueLauncher } from '@/components/reservation/PendingFeedbackQueueLauncher';
import { ReservationList } from '@/components/reservation/ReservationList';
import { FEEDBACK_FORM_URL } from '@/constant/externalLinks';
import { useConsumePendingFavorite } from '@/hooks/favorites/useConsumePendingFavorite';
import { useFavoriteMentor } from '@/hooks/favorites/useFavoriteMentor';
import { useFavoriteMentors } from '@/hooks/favorites/useFavoriteMentors';
import { useHeaderNavigation } from '@/hooks/layout/useHeaderNavigation';
import { useMentorFeedback } from '@/hooks/user/feedback/useMentorFeedback';
import { useFeedbackQueueParam } from '@/hooks/user/reservation/useFeedbackQueueParam';
import { usePendingFeedbackQueue } from '@/hooks/user/reservation/usePendingFeedbackQueue';
import { useReservationHistoryRedirect } from '@/hooks/user/reservation/useReservationHistoryRedirect';
import { favoriteMentorsReadModel } from '@/lib/favorites/favoriteMentorsReadModel';
import {
  getPendingFavoriteMentorId,
  getPendingFavoriteProfilePath,
  PENDING_FAVORITE_MENTOR_STORAGE_KEY,
  savePendingFavoriteMentor,
} from '@/lib/favorites/pendingFavoriteStorage';
import { createFeedbackSessionCoordinator } from '@/lib/reservation/feedbackSessionCoordinator';
import {
  buildReservationHistoryRedirectHref,
  buildReservationHistorySignInCallbackHref,
} from '@/lib/reservation/reservationRoutes';
import {
  filterPendingFeedbackQueueItems,
  resolveHistoryFeedbackState,
} from '@/lib/reservation/resolveHistoryFeedbackState';
import { authenticatedIdentity } from '@/test/mocks/identity';
import type { Reservation } from '@/types/reservation';

function createAuthWrapper(
  userId = '42'
): React.FC<{ children: React.ReactNode }> {
  const sessionValue = fromPartial<SessionContextValue>({
    status: 'authenticated',
    data: {
      user: {
        id: userId,
        email: 'mentee@example.com',
        name: 'Test Mentee',
        onBoarding: true,
        isMentor: false,
      },
    },
    update: async () => null,
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <SessionContext.Provider value={sessionValue}>
        {children}
      </SessionContext.Provider>
    );
  };
}

function ensureStorage(name: 'localStorage' | 'sessionStorage'): Storage {
  const existing = window[name];
  if (existing && typeof existing.clear === 'function') {
    return existing;
  }
  const store = new Map<string, string>();
  const polyfill: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(window, name, {
    value: polyfill,
    configurable: true,
    writable: true,
  });
  return polyfill;
}

describe('Feature flags disabled-mode safeguards (#913)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureStorage('localStorage').clear();
    ensureStorage('sessionStorage').clear();
    currentPathname = '/reservation/mentee';
    currentSearch = '';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('purges stale pendingFavoriteStorage on read and no-ops writes when favorites are disabled', () => {
    window.localStorage.setItem(
      PENDING_FAVORITE_MENTOR_STORAGE_KEY,
      JSON.stringify({ mentorId: 101, createdAt: Date.now() })
    );

    vi.stubEnv('NEXT_PUBLIC_ENABLE_FAVORITES', 'false');

    expect(getPendingFavoriteProfilePath()).toBeNull();
    expect(
      window.localStorage.getItem(PENDING_FAVORITE_MENTOR_STORAGE_KEY)
    ).toBeNull();

    window.localStorage.setItem(
      PENDING_FAVORITE_MENTOR_STORAGE_KEY,
      JSON.stringify({ mentorId: 202, createdAt: Date.now() })
    );
    expect(getPendingFavoriteMentorId()).toBeNull();
    expect(
      window.localStorage.getItem(PENDING_FAVORITE_MENTOR_STORAGE_KEY)
    ).toBeNull();

    savePendingFavoriteMentor(303);
    expect(
      window.localStorage.getItem(PENDING_FAVORITE_MENTOR_STORAGE_KEY)
    ).toBeNull();
  });

  it('short-circuits useFavoriteMentors, useFavoriteMentor, useConsumePendingFavorite, and MentorBookmarkButton when favorites are disabled', async () => {
    const fetchSpy = vi.fn();
    const addSpy = vi.fn();
    favoriteMentorsReadModel.setTransport({
      fetchFavoriteMentors: fetchSpy,
      addFavoriteMentor: addSpy,
      removeFavoriteMentor: vi.fn(),
    });
    window.localStorage.setItem(
      PENDING_FAVORITE_MENTOR_STORAGE_KEY,
      JSON.stringify({ mentorId: 101, createdAt: Date.now() })
    );

    vi.stubEnv('NEXT_PUBLIC_ENABLE_FAVORITES', 'false');
    const wrapper = createAuthWrapper('42');

    const { result: listRes } = renderHook(() => useFavoriteMentors(), {
      wrapper,
    });
    expect(listRes.current.favoriteMentors).toEqual([]);

    const { result: itemRes } = renderHook(
      () => useFavoriteMentor({ mentorId: 101 }),
      { wrapper }
    );
    expect(itemRes.current.isFavorited).toBe(false);
    await itemRes.current.handleToggleFavorite();

    renderHook(
      () =>
        useConsumePendingFavorite({
          pageUserId: '101',
          loginUserId: '42',
          userData: fromPartial({ user_id: 101, is_mentor: true }),
          userLoading: false,
        }),
      { wrapper }
    );

    expect(
      window.localStorage.getItem(PENDING_FAVORITE_MENTOR_STORAGE_KEY)
    ).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(addSpy).not.toHaveBeenCalled();

    const { container } = render(
      React.createElement(
        wrapper,
        null,
        <MentorBookmarkButton mentorId={101} mentorName="Mentor A" />
      )
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('hides my-favorites in useHeaderNavigation while preserving external FEEDBACK_FORM_URL when favorites and feedback are disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_FAVORITES', 'false');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_FEEDBACK', 'false');

    const { result } = renderHook(() =>
      useHeaderNavigation({
        identity: authenticatedIdentity('42', {
          isMentor: false,
          name: 'Mentee User',
        }),
      })
    );

    expect(
      result.current.desktopAccountMenu.navItems.some(
        (it) => it.id === 'my-favorites'
      )
    ).toBe(false);
    expect(
      result.current.mobileAccountMenu.navItems.some(
        (it) => it.id === 'my-favorites'
      )
    ).toBe(false);
    expect(result.current.desktopNav.feedback.href).toBe(FEEDBACK_FORM_URL);
    expect(
      result.current.mobileAccountMenu.navItems.some(
        (it) => it.id === 'feedback' && it.href === FEEDBACK_FORM_URL
      )
    ).toBe(true);
  });

  it('short-circuits PendingFeedbackQueueLauncher, usePendingFeedbackQueue, useMentorFeedback, and useFeedbackQueueParam without URL rewrites when feedback is disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_FEEDBACK', 'false');
    currentSearch = 'tab=history&feedback=queue';
    const wrapper = createAuthWrapper('42');

    const { container } = render(
      React.createElement(wrapper, null, <PendingFeedbackQueueLauncher />)
    );
    expect(container).toBeEmptyDOMElement();

    const { result: pendingRes } = renderHook(() => usePendingFeedbackQueue(), {
      wrapper,
    });
    expect(pendingRes.current.queueItems).toBeNull();

    const { result: mentorFbRes } = renderHook(() =>
      useMentorFeedback({ mentorId: 101, enabled: true })
    );
    expect(mentorFbRes.current.isLoading).toBe(false);
    expect(mentorFbRes.current.items).toEqual([]);

    const { result: queueParamRes } = renderHook(() =>
      useFeedbackQueueParam({
        role: 'mentee',
        userId: '42',
        history: [
          fromPartial<Reservation>({
            id: 'r-1',
            feedback: {
              meetingHappened: null,
              rating: null,
              nextStep: 'ANSWER',
            },
          }),
        ],
        isHistoryLoaded: true,
        isLoadingHistory: false,
        isLoadingUpcoming: false,
        isLoadingPending: false,
      })
    );
    expect(queueParamRes.current.isFeedbackQueueRequested).toBe(false);
    expect(queueParamRes.current.feedbackQueueItems).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('strips feedback=queue and deep-link IDs in reservationRoutes, feedbackSessionCoordinator, and useReservationHistoryRedirect when feedback is disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_FEEDBACK', 'false');
    currentPathname = '/reservation/history';
    currentSearch =
      'reservation_id=555&reservationId=666&feedbackReservationId=777&feedback=queue&utm_source=email';

    expect(buildReservationHistoryRedirectHref('mentee', currentSearch)).toBe(
      '/reservation/mentee?tab=history&utm_source=email'
    );

    expect(buildReservationHistorySignInCallbackHref(currentSearch)).toBe(
      `/auth/signin?callbackUrl=${encodeURIComponent('/reservation/history?utm_source=email')}`
    );

    const lookupSpy = vi.fn();
    const coordinator = createFeedbackSessionCoordinator({
      lookup: { fetchSingleReservationFeedback: lookupSpy },
    });
    const resolved = await coordinator.resolveHistoryRedirect({
      userId: '42',
      fallbackRole: 'mentee',
      rawSearch: currentSearch,
      lookupSingleFeedback: lookupSpy,
    });
    expect(resolved).toEqual({
      redirectHref: '/reservation/mentee?tab=history&utm_source=email',
      resolvedRole: 'mentee',
      seeded: null,
    });
    expect(lookupSpy).not.toHaveBeenCalled();

    const wrapper = createAuthWrapper('42');
    renderHook(() => useReservationHistoryRedirect(coordinator), { wrapper });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/reservation/mentee?tab=history&utm_source=email',
        { scroll: false }
      );
    });
  });

  it('degrades resolveHistoryFeedbackState, ReservationList, and MentorSummaryBar cleanly when feedback is disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_FEEDBACK', 'false');

    const completedReservation = fromPartial<Reservation>({
      id: 'res-100',
      name: 'Mentor Jane',
      dtstart: 1700000000,
      dtend: 1700003600,
      messages: [],
      feedback: {
        meetingHappened: null,
        rating: {
          rating: 9,
          content: 'Great session!',
          isPublic: true,
        },
        nextStep: 'ANSWER',
      },
    });

    expect(filterPendingFeedbackQueueItems([completedReservation])).toEqual([]);
    expect(
      resolveHistoryFeedbackState({
        reservation: completedReservation,
        sourceRole: 'mentee',
      })
    ).toEqual({
      headerAction: { kind: 'badge', label: '已結束' },
      feedbackBlock: null,
    });

    render(
      <MentorSummaryBar
        ratingAverage={9.4}
        ratingCount={15}
        completedMeetingCount={32}
        yearsOfExperience="5~10 年"
        location="台灣"
      />
    );
    expect(screen.queryByText('評分')).not.toBeInTheDocument();
    expect(screen.getByText('32')).toBeInTheDocument();
    expect(screen.getByText('台灣')).toBeInTheDocument();

    render(
      <ReservationList
        items={[completedReservation]}
        variant="history"
        sourceRole="mentee"
        myUserId="42"
      />
    );
    expect(screen.getByText('已結束')).toBeInTheDocument();
    expect(screen.queryByText('Great session!')).not.toBeInTheDocument();
  });
});
