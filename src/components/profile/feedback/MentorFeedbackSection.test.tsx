import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { MentorFeedbackItem } from '@/types/feedback';

import {
  buildPaginationTokens,
  EMPTY_MENTOR_FEEDBACK_MESSAGE,
  EMPTY_MENTOR_REVIEWS_SUBTITLE,
  EMPTY_MENTOR_REVIEWS_TITLE,
  EMPTY_OWN_MENTOR_STATS_MESSAGE,
  MentorFeedbackSection,
  MentorStatsSummary,
} from './index';

const sampleItems: MentorFeedbackItem[] = [
  {
    id: '1',
    authorName: '陳**',
    authorInitial: '陳',
    rating: 9,
    content: ['第一行回饋', '第二行回饋'].join(String.fromCharCode(10)),
    createdAt: '2026-10-28T12:00:00Z',
    formattedDate: '2026/10/28',
  },
  {
    id: '2',
    authorName: '林**',
    authorInitial: '林',
    rating: 8,
    content: '',
    createdAt: '2026-10-27T12:00:00Z',
    formattedDate: '2026/10/27',
  },
];

describe('MentorStatsSummary (#736)', () => {
  it('renders rating average and completed 1-on-1 count when both exist', () => {
    render(
      <MentorStatsSummary
        ratingAverage={8.5}
        totalRatingCount={12}
        completedMeetingCount={128}
      />
    );

    expect(screen.getByText('評分')).toBeInTheDocument();
    expect(screen.getByText('8.5')).toBeInTheDocument();
    expect(screen.getByText('/ 10')).toBeInTheDocument();
    expect(screen.getByText('已完成 1-on-1')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.getByText('場')).toBeInTheDocument();
  });

  it('hides rating block when totalRatingCount is 0 while showing completed 1-on-1 count', () => {
    render(
      <MentorStatsSummary
        ratingAverage={null}
        totalRatingCount={0}
        completedMeetingCount={5}
      />
    );

    expect(screen.queryByText('評分')).not.toBeInTheDocument();
    expect(screen.queryByText('/ 10')).not.toBeInTheDocument();
    expect(screen.getByText('已完成 1-on-1')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('場')).toBeInTheDocument();
  });

  it('shows visitor prompt or role-neutral owner copy when mentor has 0 ratings and 0 completed meetings', () => {
    const { rerender } = render(
      <MentorStatsSummary
        ratingAverage={null}
        totalRatingCount={0}
        completedMeetingCount={0}
      />
    );

    expect(screen.getByText(EMPTY_MENTOR_FEEDBACK_MESSAGE)).toBeInTheDocument();

    rerender(
      <MentorStatsSummary
        ratingAverage={null}
        totalRatingCount={0}
        completedMeetingCount={0}
        isOwnMentorProfile
      />
    );

    expect(
      screen.getByText(EMPTY_OWN_MENTOR_STATS_MESSAGE)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(EMPTY_MENTOR_FEEDBACK_MESSAGE)
    ).not.toBeInTheDocument();

    rerender(
      <MentorStatsSummary
        ratingAverage={null}
        totalRatingCount={0}
        completedMeetingCount={0}
        isLoading
      />
    );

    expect(
      screen.getByRole('region', { name: '導師會談摘要' })
    ).toHaveAttribute('aria-busy', 'true');
  });
});

describe('MentorFeedbackSection (#736)', () => {
  it('renders neutral empty state title and subtitle when there are 0 reviews', () => {
    render(
      <MentorFeedbackSection
        items={[]}
        totalRatingCount={0}
        ratingAverage={null}
        page={1}
        totalPages={0}
        isLoading={false}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByText(EMPTY_MENTOR_REVIEWS_TITLE)).toBeInTheDocument();
    expect(screen.getByText(EMPTY_MENTOR_REVIEWS_SUBTITLE)).toBeInTheDocument();
    expect(
      screen.queryByText(EMPTY_MENTOR_FEEDBACK_MESSAGE)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: '評價分頁' })
    ).not.toBeInTheDocument();
  });

  it('renders review items, multiline content, and triggers pagination callbacks', () => {
    const onPageChange = vi.fn();
    render(
      <MentorFeedbackSection
        items={sampleItems}
        totalRatingCount={12}
        ratingAverage={8.5}
        page={1}
        totalPages={2}
        isLoading={false}
        onPageChange={onPageChange}
      />
    );

    expect(screen.getByText('8.5')).toBeInTheDocument();
    expect(screen.getByText('12 則會談評價')).toBeInTheDocument();
    expect(screen.getByText('陳**')).toBeInTheDocument();
    expect(screen.getByText('9 / 10')).toBeInTheDocument();
    expect(screen.getByText('2026/10/28')).toBeInTheDocument();

    const contentParagraph = screen.getByText(/第一行回饋/);
    expect(contentParagraph).toHaveClass('whitespace-pre-line', 'break-words');

    const prevButton = screen.getByRole('button', { name: '上一頁' });
    const nextButton = screen.getByRole('button', { name: '下一頁' });
    const page2Button = screen.getByRole('button', { name: '第 2 頁' });

    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeEnabled();

    fireEvent.click(nextButton);
    expect(onPageChange).toHaveBeenCalledWith(2);

    fireEvent.click(page2Button);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('renders loading skeleton and error retry states properly, preserving pagination on secondary page errors', () => {
    const onRetry = vi.fn();
    const onPageChange = vi.fn();
    const { rerender } = render(
      <MentorFeedbackSection
        items={[]}
        totalRatingCount={0}
        ratingAverage={null}
        page={1}
        totalPages={0}
        isLoading={true}
        onPageChange={onPageChange}
      />
    );

    expect(screen.getByTestId('mentor-feedback-skeleton')).toBeInTheDocument();

    rerender(
      <MentorFeedbackSection
        items={[]}
        totalRatingCount={0}
        ratingAverage={null}
        page={1}
        totalPages={0}
        isLoading={false}
        hasError={true}
        onPageChange={onPageChange}
        onRetry={onRetry}
      />
    );

    expect(
      screen.getByText('無法載入評價資料，請稍後再試')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: '評價分頁' })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新載入' }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    // Secondary page error keeps pagination accessible so user can return to page 1
    rerender(
      <MentorFeedbackSection
        items={[]}
        totalRatingCount={12}
        ratingAverage={8.5}
        page={2}
        totalPages={2}
        isLoading={false}
        hasError={true}
        onPageChange={onPageChange}
        onRetry={onRetry}
      />
    );

    expect(
      screen.getByText('無法載入評價資料，請稍後再試')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: '評價分頁' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '上一頁' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('builds compact pagination tokens with ellipses and guards out-of-range inputs', () => {
    expect(buildPaginationTokens(1, 1)).toEqual([]);
    expect(buildPaginationTokens(Number.NaN, Number.NaN)).toEqual([]);
    expect(buildPaginationTokens(2, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(buildPaginationTokens(5, 10)).toEqual([
      1,
      'ellipsis-start',
      4,
      5,
      6,
      'ellipsis-end',
      10,
    ]);
    expect(buildPaginationTokens(99, 10)).toEqual([1, 'ellipsis-start', 9, 10]);
  });
});
