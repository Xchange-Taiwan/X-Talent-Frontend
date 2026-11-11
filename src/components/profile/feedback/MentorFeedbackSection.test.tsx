import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { MentorFeedbackItem } from '@/types/feedback';

import { MentorFeedbackSection } from './MentorFeedbackSection';
import * as stories from './MentorFeedbackSection.stories';

const sampleReviews: MentorFeedbackItem[] = [
  {
    id: 'r1',
    authorName: '陳**',
    rating: 9,
    content: `第一行回饋
第二行具體建議`,
    createdAt: '2026-10-28T10:00:00Z',
  },
  {
    id: 'r2',
    authorName: '林**',
    rating: 7,
    content: '幫助我釐清履歷架構。',
    createdAt: '2026-10-27T10:00:00Z',
  },
];

describe('MentorFeedbackSection (#736)', () => {
  it('renders rating summary header, initial avatar, masked author, score, date, and multiline content', () => {
    render(
      <MentorFeedbackSection
        items={sampleReviews}
        totalRatingCount={2}
        ratingAverage={8.5}
      />
    );

    expect(screen.getByText('8.5')).toBeInTheDocument();
    expect(screen.getByText('2 則會談評價')).toBeInTheDocument();
    expect(screen.getByText('陳')).toBeInTheDocument();
    expect(screen.getByText('陳**')).toBeInTheDocument();
    expect(screen.getByText('9 / 10')).toBeInTheDocument();
    expect(screen.getByText(/^2026\/10\/2[89]$/)).toBeInTheDocument();

    const multilineComment = screen.getByText(/第一行回饋/);
    expect(multilineComment).toHaveClass('whitespace-pre-line', 'break-words');
    expect(screen.queryByRole('navigation', { name: '評價分頁' })).toBeNull();
  });

  it('renders neutral empty state when totalRatingCount is 0', () => {
    render(<MentorFeedbackSection items={[]} totalRatingCount={0} />);

    expect(screen.getByText('目前還沒有評價')).toBeInTheDocument();
    expect(
      screen.getByText('完成會談後，學員的評價會顯示在這裡。')
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('評價排序')).toBeNull();
  });

  it('shows pagination only when totalRatingCount exceeds pageSize (10) and triggers onPageChange', () => {
    const onPageChange = vi.fn();
    render(
      <MentorFeedbackSection
        items={sampleReviews}
        totalRatingCount={12}
        ratingAverage={8.5}
        page={1}
        pageSize={10}
        onPageChange={onPageChange}
      />
    );

    const nav = screen.getByRole('navigation', { name: '評價分頁' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上一頁' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '第 2 頁' }));
    expect(onPageChange).toHaveBeenCalledWith(2);

    fireEvent.click(screen.getByRole('button', { name: '下一頁' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('allows changing sort option via Select control', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(
      <MentorFeedbackSection
        items={sampleReviews}
        totalRatingCount={2}
        ratingAverage={8.0}
        sortBy="newest"
        onSortChange={onSortChange}
      />
    );

    await user.click(screen.getByRole('combobox', { name: '評價排序' }));
    await user.click(screen.getByRole('option', { name: '評分由低到高' }));

    expect(onSortChange).toHaveBeenCalledWith('rating_asc');
  });

  it('renders skeleton while loading initial page and retry button on error', () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <MentorFeedbackSection items={[]} totalRatingCount={0} isLoading={true} />
    );

    expect(screen.getByTestId('mentor-feedback-skeleton')).toBeInTheDocument();

    rerender(
      <MentorFeedbackSection
        items={[]}
        totalRatingCount={0}
        isLoading={false}
        error="載入評價時發生錯誤，請稍後再試。"
        onRetry={onRetry}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '重新載入' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('exports valid Storybook stories', () => {
    expect(stories.default.component).toBe(MentorFeedbackSection);
    expect(stories.WithPaginationOverTen.args?.totalRatingCount).toBe(12);
    expect(stories.EmptyZeroReviews.args?.totalRatingCount).toBe(0);
  });
});
