import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fromPartial } from '@total-typescript/shoehorn';
import { SessionContext, type SessionContextValue } from 'next-auth/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockMentors } from '@/components/mentor-pool/__mocks__/mentors.mock';
import {
  favoriteMentorsReadModel,
  resetFavoriteMentorsReadModel,
} from '@/lib/favorites';

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
    resetFavoriteMentorsReadModel();
    favoriteMentorsReadModel.setTransport({
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
    favoriteMentorsReadModel.seed('9001', seededMentors);

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
    expect(cards[0]).toHaveClass('w-[334px]', 'md:w-full', 'md:max-w-[413px]');
    expect(cards[0]).not.toHaveClass('xl:w-[413px]');

    const gridContainer = cards[0].parentElement;
    expect(gridContainer).toHaveClass(
      'grid',
      'w-full',
      'grid-cols-1',
      'justify-items-center',
      'gap-6',
      'md:grid-cols-2',
      'md:justify-items-start',
      'md:gap-5',
      'lg:grid-cols-3'
    );

    const cardLink = within(cards[0]).getByRole('link', {
      name: '前往 陳怡君 Jane 的個人頁面',
    });
    expect(cardLink).toHaveAttribute('href', '/profile/101');
    expect(cardLink).toHaveAttribute('data-analytics-feature', 'favorites');
    expect(cardLink).toHaveAttribute(
      'data-analytics-location',
      'favorites_list'
    );

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
    favoriteMentorsReadModel.seed('9001', []);

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

  it('renders distinct error state with retry button and omits empty-state copy when listStatus is error', async () => {
    const user = userEvent.setup();
    const onRetryMock = vi.fn();

    renderWithSession(
      <FavoritesPageUI
        mentors={[]}
        mentorCount={0}
        listStatus="error"
        onRetry={onRetryMock}
      />
    );

    expect(
      screen.getByRole('heading', { level: 1, name: '我的收藏' })
    ).toBeInTheDocument();
    expect(screen.getByText('載入收藏清單時發生連線錯誤')).toBeInTheDocument();
    expect(screen.queryByText('已收藏 0 位導師')).not.toBeInTheDocument();
    expect(screen.queryByText('還沒有收藏的導師')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '重新載入' }));
    expect(onRetryMock).toHaveBeenCalledTimes(1);
  });

  it('projects localized tags via labelMap and guarantees non-empty fallback avatar when mentor avatar is empty (#896)', () => {
    const codeMentors = [
      {
        ...mockMentors[0],
        user_id: 201,
        name: '林冠宇 Alex',
        avatar: '',
        have_topic: ['portfolio_review'],
        have_skill: ['product_design'],
      },
    ];
    favoriteMentorsReadModel.seed('9001', codeMentors);

    renderWithSession(
      <FavoritesPageUI
        mentors={codeMentors}
        mentorCount={1}
        labelMap={
          new Map([
            ['portfolio_review', '作品集健檢'],
            ['product_design', '產品設計'],
          ])
        }
        listStatus="success"
      />
    );

    const avatarImg = screen.getByRole('img', { name: '林冠宇 Alex 的頭像' });
    expect(avatarImg.getAttribute('src')).toBeTruthy();
    expect(
      Array.from(screen.getByTestId('display-container').children).map(
        (el) => el.textContent
      )
    ).toEqual(['作品集健檢', '產品設計']);
  });
});
