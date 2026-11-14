import { render, screen, within } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { SessionContext, type SessionContextValue } from 'next-auth/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockMentors } from '@/components/mentor-pool/__mocks__/mentors.mock';
import {
  favoriteMentorStore,
  resetFavoriteMentorStore,
} from '@/stores/favoriteMentorStore';

import FavoritesPageUI from './ui';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

function renderWithSession(ui: ReactNode, userId = '9001') {
  const sessionValue = fromPartial<SessionContextValue>({
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
  });

  return render(
    <SessionContext.Provider value={sessionValue}>{ui}</SessionContext.Provider>
  );
}

describe('FavoritesPageUI', () => {
  beforeEach(() => {
    resetFavoriteMentorStore();
    favoriteMentorStore.setAdapter({
      fetchFavoriteMentors: async () => [],
      addFavoriteMentor: async () => {},
      removeFavoriteMentor: async () => {},
    });
  });

  it('renders favorited MentorCards, total count, solid bookmark state, and omits notification/email copy', () => {
    const seededMentors = [
      {
        ...mockMentors[0],
        user_id: 101,
        name: '陳怡君 Jane',
        have_topic: ['職涯諮詢', '作品集健檢'],
        have_skill: ['Figma', '職涯諮詢'],
      },
      {
        ...mockMentors[1],
        user_id: 102,
        name: '王小明 John',
        have_topic: ['前端架構設計'],
        have_skill: ['TypeScript'],
      },
    ];
    favoriteMentorStore.seedFavorites('9001', seededMentors);

    renderWithSession(
      <FavoritesPageUI
        mentors={seededMentors}
        mentorCount={seededMentors.length}
        listStatus="success"
      />
    );

    expect(
      screen.getByRole('heading', { level: 1, name: '我的收藏' })
    ).toBeInTheDocument();
    expect(screen.getByText('已收藏 2 位導師')).toBeInTheDocument();

    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(2);

    expect(
      within(cards[0]).getByRole('link', {
        name: '前往 陳怡君 Jane 的個人頁面',
      })
    ).toHaveAttribute('href', '/profile/101');

    const firstBookmark = within(cards[0]).getByRole('button', {
      name: '取消收藏 陳怡君 Jane',
    });
    expect(firstBookmark).toHaveAttribute('aria-pressed', 'true');
    expect(firstBookmark.querySelector('svg')).toHaveClass(
      'fill-current',
      'text-brand-500'
    );

    expect(within(cards[0]).getAllByText('職涯諮詢').length).toBeGreaterThan(0);
    expect(within(cards[0]).getAllByText('Figma').length).toBeGreaterThan(0);

    expect(screen.queryByText('還沒有收藏的導師')).not.toBeInTheDocument();
    expect(screen.queryByText(/新時段/)).not.toBeInTheDocument();
    expect(screen.queryByText(/通知設定/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Email/i)).not.toBeInTheDocument();
  });

  it('renders empty state with CTA linking to /mentor-pool when listStatus is empty', () => {
    favoriteMentorStore.seedFavorites('9001', []);

    renderWithSession(
      <FavoritesPageUI mentors={[]} mentorCount={0} listStatus="empty" />
    );

    expect(
      screen.getByRole('heading', { level: 1, name: '我的收藏' })
    ).toBeInTheDocument();
    expect(screen.getByText('已收藏 0 位導師')).toBeInTheDocument();
    expect(screen.getByText('還沒有收藏的導師')).toBeInTheDocument();

    const ctaLink = screen.getByRole('link', { name: '尋找導師' });
    expect(ctaLink).toHaveAttribute('href', '/mentor-pool');

    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.queryByText(/新時段/)).not.toBeInTheDocument();
    expect(screen.queryByText(/通知設定/)).not.toBeInTheDocument();
  });

  it('renders only loading spinner when listStatus is loading', () => {
    renderWithSession(
      <FavoritesPageUI mentors={[]} mentorCount={0} listStatus="loading" />
    );

    expect(
      screen.getByRole('heading', { level: 1, name: '我的收藏' })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('status').some((el) => el.textContent === '載入中')
    ).toBe(true);
    expect(screen.queryByText('已收藏 0 位導師')).not.toBeInTheDocument();
    expect(screen.queryByText('還沒有收藏的導師')).not.toBeInTheDocument();
  });
});
