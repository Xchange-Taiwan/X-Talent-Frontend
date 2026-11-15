import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fromPartial } from '@total-typescript/shoehorn';
import { SessionContext, type SessionContextValue } from 'next-auth/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import avatarImage from '@/assets/default-avatar.png';
import * as analyticsModule from '@/lib/analytics';
import {
  type FavoriteMentorServiceAdapter,
  favoriteMentorStore,
  resetFavoriteMentorStore,
} from '@/stores/favoriteMentorStore';
import type { MentorType } from '@/types/mentor';

import { MentorCard, type MentorCardProps } from './index';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

function buildMentorSnapshot(overrides: Partial<MentorType> = {}): MentorType {
  return fromPartial<MentorType>({
    user_id: 101,
    name: 'Zahra Mirzakhani',
    avatar: avatarImage,
    job_title: 'Senior UX Designer',
    company: 'CreativeUX Design Studio',
    years_of_experience: 'FIVE_TO_TEN',
    about: '累積超過七年的數位產品設計經驗。',
    have_topic: ['作品集健檢'],
    have_skill: ['產品設計'],
    ...overrides,
  });
}

function buildCardProps(
  overrides: Partial<MentorCardProps> = {}
): MentorCardProps {
  const snapshot = buildMentorSnapshot();
  return {
    id: 101,
    avatar: avatarImage,
    years: 'FIVE_TO_TEN',
    name: 'Zahra Mirzakhani',
    job_title: 'Senior UX Designer',
    company: 'CreativeUX Design Studio',
    about: '累積超過七年的數位產品設計經驗。',
    haveTopicLabels: ['作品集健檢', '產品設計'],
    ratingAverage: 9.6,
    completedMeetingCount: 24,
    mentorSnapshot: snapshot,
    ...overrides,
  };
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

describe('MentorCard (#757)', () => {
  const fetchMock =
    vi.fn<FavoriteMentorServiceAdapter['fetchFavoriteMentors']>();
  const addMock = vi.fn<FavoriteMentorServiceAdapter['addFavoriteMentor']>();
  const removeMock =
    vi.fn<FavoriteMentorServiceAdapter['removeFavoriteMentor']>();

  beforeEach(() => {
    resetFavoriteMentorStore();
    vi.clearAllMocks();
    fetchMock.mockResolvedValue([]);
    addMock.mockResolvedValue(undefined);
    removeMock.mockResolvedValue(undefined);
    favoriteMentorStore.setAdapter({
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
    favoriteMentorStore.seedFavorites('9001', []);

    renderWithSession(<MentorCard {...buildCardProps()} />, '9001');
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
      expect(addMock).toHaveBeenCalledWith(101);
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
      expect(removeMock).toHaveBeenCalledWith(101);
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
    favoriteMentorStore.seedFavorites('9001', [101]);

    renderWithSession(
      <MentorCard {...buildCardProps({ feature: 'favorites' })} />,
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
    expect(removeMock).toHaveBeenCalledWith(101);
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
        {...buildCardProps({
          feature: 'mentor_pool',
          analyticsLocation: 'favorites_list',
        })}
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
});
