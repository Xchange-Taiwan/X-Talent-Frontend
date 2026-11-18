import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fromPartial } from '@total-typescript/shoehorn';
import { SessionContext, type SessionContextValue } from 'next-auth/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import avatarImage from '@/assets/default-avatar.png';
import * as analyticsModule from '@/lib/analytics';
import {
  favoriteMentorsReadModel,
  type FavoriteMentorsTransport,
  resetFavoriteMentorsReadModel,
} from '@/lib/favorites';
import type { MentorType } from '@/types/mentor';

import { MentorCard } from './index';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

function buildMentor(overrides: Partial<MentorType> = {}): MentorType {
  return fromPartial<MentorType>({
    user_id: 101,
    name: 'Zahra Mirzakhani',
    avatar: avatarImage,
    job_title: 'Senior UX Designer',
    company: 'CreativeUX Design Studio',
    years_of_experience: 'FIVE_TO_TEN',
    about: '累積超過七年的數位產品設計經驗。',
    have_topic: ['portfolio_review'],
    have_skill: ['product_design'],
    updated_at: '2026-11-15T00:00:00Z',
    stats: {
      completed_meeting_count: 24,
      rating_count: 10,
      rating_average: 9.6,
    },
    ...overrides,
  });
}

function renderWithSession(ui: ReactNode, userId: string | null = null) {
  const contextValue = userId
    ? fromPartial<SessionContextValue>({
        data: {
          user: {
            id: userId,
            email: 'mentee@example.com',
            name: 'Mentee Viewer',
            onBoarding: true,
            isMentor: false,
          },
          accessToken: 'mock-token',
          expires: '2099-01-01T00:00:00.000Z',
        },
        status: 'authenticated',
        update: async () => null,
      })
    : fromPartial<SessionContextValue>({
        data: null,
        status: 'unauthenticated',
        update: async () => null,
      });

  return render(
    <SessionContext.Provider value={contextValue}>{ui}</SessionContext.Provider>
  );
}

describe('MentorCard (#757, #896)', () => {
  const fetchMock = vi.fn<FavoriteMentorsTransport['fetchFavoriteMentors']>();
  const addMock = vi.fn<FavoriteMentorsTransport['addFavoriteMentor']>();
  const removeMock = vi.fn<FavoriteMentorsTransport['removeFavoriteMentor']>();

  beforeEach(() => {
    resetFavoriteMentorsReadModel();
    vi.clearAllMocks();
    fetchMock.mockResolvedValue([]);
    addMock.mockResolvedValue(undefined);
    removeMock.mockResolvedValue(undefined);
    favoriteMentorsReadModel.setTransport({
      fetchFavoriteMentors: fetchMock,
      addFavoriteMentor: addMock,
      removeFavoriteMentor: removeMock,
    });
  });

  it('defaults feature to "mentor_pool" and analyticsLocation to "mentor_pool_list", and isolates bookmark mouse & keyboard Enter/Space toggles from Link bubbling', async () => {
    const user = userEvent.setup();
    const trackEventSpy = vi.spyOn(analyticsModule, 'trackEvent');
    const onLinkClick = vi.fn((event: Event) => event.preventDefault());
    const onDocumentClick = vi.fn();
    const onDocumentKeyDown = vi.fn();
    const onDocumentKeyUp = vi.fn();
    favoriteMentorsReadModel.seed('9001', []);

    renderWithSession(<MentorCard mentor={buildMentor()} />, '9001');
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onDocumentKeyDown);
    document.addEventListener('keyup', onDocumentKeyUp);

    try {
      const cardLink = screen.getByRole('link', {
        name: '前往 Zahra Mirzakhani 的個人頁面',
      });
      const bookmarkButton = screen.getByRole('button', {
        name: '收藏 Zahra Mirzakhani',
      });

      expect(cardLink).toHaveAttribute('href', '/profile/101');
      expect(cardLink).toHaveAttribute(
        'data-analytics-event',
        'mentor_card_click'
      );
      expect(cardLink).toHaveAttribute('data-analytics-feature', 'mentor_pool');
      expect(cardLink).toHaveAttribute(
        'data-analytics-location',
        'mentor_pool_list'
      );
      expect(cardLink).toHaveAttribute('data-analytics-param-mentor-id', '101');
      expect(cardLink).toHaveClass('z-10');
      expect(bookmarkButton.parentElement).toHaveClass('z-20');

      cardLink.addEventListener('click', onLinkClick);

      await user.click(bookmarkButton);

      expect(onLinkClick).not.toHaveBeenCalled();
      expect(onDocumentClick).not.toHaveBeenCalled();
      expect(addMock).toHaveBeenCalledWith(
        '9001',
        101,
        expect.any(AbortSignal)
      );
      expect(trackEventSpy).toHaveBeenCalledWith({
        name: 'mentor_bookmark_toggle',
        feature: 'mentor_pool',
        metadata: {
          mentor_id: 101,
          action: 'add',
        },
      });

      const activeBookmarkButton = screen.getByRole('button', {
        name: '取消收藏 Zahra Mirzakhani',
      });
      expect(activeBookmarkButton).toHaveFocus();
      await waitFor(() => {
        expect(activeBookmarkButton).not.toHaveAttribute('aria-busy');
      });

      await user.keyboard('{Enter}');

      expect(onLinkClick).not.toHaveBeenCalled();
      expect(onDocumentClick).not.toHaveBeenCalled();
      expect(onDocumentKeyDown).not.toHaveBeenCalled();
      expect(onDocumentKeyUp).not.toHaveBeenCalled();
      expect(removeMock).toHaveBeenCalledWith(
        '9001',
        101,
        expect.any(AbortSignal)
      );
      expect(trackEventSpy).toHaveBeenLastCalledWith({
        name: 'mentor_bookmark_toggle',
        feature: 'mentor_pool',
        metadata: {
          mentor_id: 101,
          action: 'remove',
        },
      });

      const idleBookmarkButton = screen.getByRole('button', {
        name: '收藏 Zahra Mirzakhani',
      });
      expect(idleBookmarkButton).toHaveFocus();
      await waitFor(() => {
        expect(idleBookmarkButton).not.toHaveAttribute('aria-busy');
      });

      await user.keyboard(' ');

      expect(onLinkClick).not.toHaveBeenCalled();
      expect(onDocumentClick).not.toHaveBeenCalled();
      expect(onDocumentKeyDown).not.toHaveBeenCalled();
      expect(onDocumentKeyUp).not.toHaveBeenCalled();
      expect(addMock).toHaveBeenCalledTimes(2);
      expect(trackEventSpy).toHaveBeenLastCalledWith({
        name: 'mentor_bookmark_toggle',
        feature: 'mentor_pool',
        metadata: {
          mentor_id: 101,
          action: 'add',
        },
      });

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: '取消收藏 Zahra Mirzakhani' })
        ).not.toHaveAttribute('aria-busy');
      });
    } finally {
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onDocumentKeyDown);
      document.removeEventListener('keyup', onDocumentKeyUp);
    }
  });

  it('derives data-analytics-location as "favorites_list" when feature="favorites" and forwards feature="favorites" to bookmark toggle analytics', async () => {
    const user = userEvent.setup();
    const trackEventSpy = vi.spyOn(analyticsModule, 'trackEvent');
    const onLinkClick = vi.fn((event: Event) => event.preventDefault());
    const mentor = buildMentor();
    favoriteMentorsReadModel.seed('9001', [mentor]);

    renderWithSession(
      <MentorCard mentor={mentor} feature="favorites" />,
      '9001'
    );

    const cardLink = screen.getByRole('link', {
      name: '前往 Zahra Mirzakhani 的個人頁面',
    });
    const bookmarkButton = screen.getByRole('button', {
      name: '取消收藏 Zahra Mirzakhani',
    });

    expect(cardLink).toHaveAttribute('data-analytics-feature', 'favorites');
    expect(cardLink).toHaveAttribute(
      'data-analytics-location',
      'favorites_list'
    );
    expect(
      analyticsModule.getAnalyticsClickPayloadFromElement(cardLink)
    ).toEqual({
      buttonId: 'mentor_card',
      eventName: 'mentor_card_click',
      feature: 'favorites',
      location: 'favorites_list',
      destination: '/profile/101',
      metadata: {
        mentor_id: '101',
      },
    });

    cardLink.addEventListener('click', onLinkClick);
    await user.click(bookmarkButton);

    expect(onLinkClick).not.toHaveBeenCalled();
    expect(removeMock).toHaveBeenCalledWith(
      '9001',
      101,
      expect.any(AbortSignal)
    );
    expect(trackEventSpy).toHaveBeenCalledWith({
      name: 'mentor_bookmark_toggle',
      feature: 'favorites',
      metadata: {
        mentor_id: 101,
        action: 'remove',
      },
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: '收藏 Zahra Mirzakhani' })
      ).not.toHaveAttribute('aria-busy');
    });
  });

  it('uses explicit analyticsLocation prop when provided', () => {
    renderWithSession(
      <MentorCard
        mentor={buildMentor()}
        feature="mentor_pool"
        analyticsLocation="favorites_list"
      />
    );

    const cardLink = screen.getByRole('link', {
      name: '前往 Zahra Mirzakhani 的個人頁面',
    });
    expect(cardLink).toHaveAttribute('data-analytics-feature', 'mentor_pool');
    expect(cardLink).toHaveAttribute(
      'data-analytics-location',
      'favorites_list'
    );
  });

  it('projects localized tags via labelMap + prioritizedCodes, resolves empty avatar to fallback image, and preserves raw subject_group codes on bookmark snapshot (#896)', async () => {
    const user = userEvent.setup();
    favoriteMentorsReadModel.seed('9001', []);
    const labelMap = new Map<string, string>([
      ['portfolio_review', '作品集健檢'],
      ['product_design', '產品設計'],
    ]);

    renderWithSession(
      <MentorCard
        mentor={buildMentor({
          avatar: '',
          have_topic: ['portfolio_review'],
          have_skill: ['product_design'],
          stats: {
            completed_meeting_count: 8,
            rating_count: 0,
            rating_average: 9.5,
          },
        })}
        labelMap={labelMap}
        prioritizedCodes={new Set(['product_design'])}
      />,
      '9001'
    );

    const avatarImg = screen.getByRole('img', {
      name: 'Zahra Mirzakhani 的頭像',
    });
    expect(avatarImg.getAttribute('src')).toBeTruthy();

    const displayContainer = screen.getByTestId('display-container');
    expect(
      Array.from(displayContainer.children).map((el) => el.textContent)
    ).toEqual(['產品設計', '作品集健檢']);
    expect(screen.queryByText(/\/ 10/)).not.toBeInTheDocument();
    expect(screen.getByText('已完成 8 場 1-on-1')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: '收藏 Zahra Mirzakhani' })
    );

    await waitFor(() => {
      expect(
        favoriteMentorsReadModel.getMentorState('9001', 101).isFavorited
      ).toBe(true);
    });
    expect(
      favoriteMentorsReadModel.getSnapshot('9001')?.mentors[0]
    ).toMatchObject({
      user_id: 101,
      avatar: avatarImage,
      have_topic: ['portfolio_review'],
      have_skill: ['product_design'],
    });
  });
});

describe('MentorCard feature flag overrides & env gates (#913)', () => {
  it('hides bookmark button and rating score while preserving completed meetings count when disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_FAVORITES', 'false');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_FEEDBACK', 'false');
    try {
      renderWithSession(<MentorCard mentor={buildMentor()} />, '9001');

      expect(
        screen.queryByRole('button', { name: /收藏/ })
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/\/ 10/)).not.toBeInTheDocument();
      expect(screen.getByText('已完成 24 場 1-on-1')).toBeInTheDocument();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('respects explicit showBookmark and includeRating prop overrides', () => {
    renderWithSession(
      <MentorCard
        mentor={buildMentor()}
        showBookmark={false}
        includeRating={false}
      />,
      '9001'
    );

    expect(
      screen.queryByRole('button', { name: /收藏/ })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/\/ 10/)).not.toBeInTheDocument();
    expect(screen.getByText('已完成 24 場 1-on-1')).toBeInTheDocument();
  });

  it('disables automatic viewport RSC prefetching on the mentor profile Link (#953)', async () => {
    const observeSpy = vi.fn();
    const disconnectSpy = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = observeSpy;
        unobserve = vi.fn();
        disconnect = disconnectSpy;
      }
    );

    try {
      renderWithSession(<MentorCard mentor={buildMentor()} />, '9001');
      const cardLink = screen.getByRole('link', {
        name: '前往 Zahra Mirzakhani 的個人頁面',
      });
      expect(cardLink).toHaveAttribute('href', '/profile/101');
      expect(observeSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
