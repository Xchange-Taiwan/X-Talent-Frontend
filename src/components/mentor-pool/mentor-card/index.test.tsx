import { render, screen } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { SessionContext, type SessionContextValue } from 'next-auth/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  favoriteMentorStore,
  resetFavoriteMentorStore,
} from '@/stores/favoriteMentorStore';

import { MentorCard, type MentorCardProps } from './index';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

function renderWithSession(ui: ReactNode) {
  const sessionValue = fromPartial<SessionContextValue>({
    data: null,
    status: 'unauthenticated',
    update: async () => null,
  });

  return render(
    <SessionContext.Provider value={sessionValue}>{ui}</SessionContext.Provider>
  );
}

const baseProps: MentorCardProps = {
  id: 101,
  avatar: 'https://example.com/avatar.png',
  years: '5-8 年',
  name: '陳怡君 Jane',
  job_title: 'Senior Product Designer',
  company: 'X-Talent',
  about: '專注於產品設計與職涯指導',
  haveTopicLabels: ['作品集健檢', '職涯規劃'],
};

describe('MentorCard analytics attributes', () => {
  beforeEach(() => {
    resetFavoriteMentorStore();
    favoriteMentorStore.setAdapter({
      fetchFavoriteMentors: async () => [],
      addFavoriteMentor: async () => {},
      removeFavoriteMentor: async () => {},
    });
  });

  it('defaults data-analytics-feature to mentor_pool and data-analytics-location to mentor_pool_list', () => {
    renderWithSession(<MentorCard {...baseProps} />);

    const cardLink = screen.getByRole('link', {
      name: '前往 陳怡君 Jane 的個人頁面',
    });
    expect(cardLink).toHaveAttribute('data-analytics-feature', 'mentor_pool');
    expect(cardLink).toHaveAttribute(
      'data-analytics-location',
      'mentor_pool_list'
    );
    expect(cardLink).toHaveAttribute('data-analytics-param-mentor-id', '101');
  });

  it('derives data-analytics-location as favorites_list when feature is favorites', () => {
    renderWithSession(<MentorCard {...baseProps} feature="favorites" />);

    const cardLink = screen.getByRole('link', {
      name: '前往 陳怡君 Jane 的個人頁面',
    });
    expect(cardLink).toHaveAttribute('data-analytics-feature', 'favorites');
    expect(cardLink).toHaveAttribute(
      'data-analytics-location',
      'favorites_list'
    );
  });

  it('uses explicit analyticsLocation prop when provided', () => {
    renderWithSession(
      <MentorCard
        {...baseProps}
        feature="mentor_pool"
        analyticsLocation="favorites_list"
      />
    );

    const cardLink = screen.getByRole('link', {
      name: '前往 陳怡君 Jane 的個人頁面',
    });
    expect(cardLink).toHaveAttribute('data-analytics-feature', 'mentor_pool');
    expect(cardLink).toHaveAttribute(
      'data-analytics-location',
      'favorites_list'
    );
  });
});
