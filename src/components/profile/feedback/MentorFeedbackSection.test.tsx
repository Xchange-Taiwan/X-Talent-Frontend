import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/profile/feedback', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/profile/feedback')>();
  return {
    ...actual,
    fetchMentorFeedback: vi.fn(),
  };
});

import { useMentorFeedback } from '@/hooks/user/feedback/useMentorFeedback';
import { mentorFeedbackReadModel } from '@/lib/feedback/mentorFeedbackReadModel';
import { fetchMentorFeedback } from '@/services/profile/feedback';
import type { MentorFeedbackItem, MentorFeedbackPage } from '@/types/feedback';

import { MentorFeedbackSection } from './MentorFeedbackSection';
import * as stories from './MentorFeedbackSection.stories';

const mockFetchMentorFeedback = vi.mocked(fetchMentorFeedback);

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

describe('MentorFeedbackSection (#736 / #934)', () => {
  beforeEach(() => {
    mockFetchMentorFeedback.mockReset();
    mentorFeedbackReadModel.clear();
  });

  it('renders rating summary header, initial avatar, masked author, score, date, and multiline content without sort dropdown', () => {
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
    expect(screen.queryByRole('combobox', { name: '評價排序' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: '評價分頁' })).toBeNull();
  });

  it('sorts items newest-first by createdAt by default', () => {
    render(
      <MentorFeedbackSection
        items={[sampleReviews[1], sampleReviews[0]]}
        totalRatingCount={2}
        ratingAverage={8.0}
      />
    );

    const listItems = screen.getAllByRole('listitem');
    expect(listItems[0]).toHaveTextContent('陳**');
    expect(listItems[1]).toHaveTextContent('林**');
  });

  it('renders neutral empty state when totalRatingCount is 0', () => {
    render(<MentorFeedbackSection items={[]} totalRatingCount={0} />);

    expect(screen.getByText('目前還沒有評價')).toBeInTheDocument();
    expect(
      screen.getByText('完成會談後，學員的評價會顯示在這裡。')
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '評價排序' })).toBeNull();
  });

  it('shows unavailable prompt and hides empty list and pagination when totalRatingCount > 0 but items is empty (e.g. 404 fallback)', () => {
    const onRetry = vi.fn();
    render(
      <MentorFeedbackSection
        items={[]}
        totalRatingCount={12}
        ratingAverage={9.2}
        onRetry={onRetry}
      />
    );

    expect(screen.getByText('9.2')).toBeInTheDocument();
    expect(screen.getByText('12 則會談評價')).toBeInTheDocument();
    expect(
      screen.getByText('目前暫無法顯示評價內容，請稍後再試。')
    ).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '會談評價列表' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: '評價分頁' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: '評價排序' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '重新載入' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
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

  it('renders skeleton on initial page-1 load with 0 items, and dims retained items with disabled pagination instead of skeleton when navigating to page 2+ (#934)', async () => {
    let resolvePage1: ((value: MentorFeedbackPage) => void) | undefined;
    let resolvePage2: ((value: MentorFeedbackPage) => void) | undefined;

    mockFetchMentorFeedback
      .mockImplementationOnce(
        () =>
          new Promise<MentorFeedbackPage>((resolve) => {
            resolvePage1 = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<MentorFeedbackPage>((resolve) => {
            resolvePage2 = resolve;
          })
      );

    function ConnectedMentorFeedback({ mentorId }: { mentorId: number }) {
      const feedback = useMentorFeedback({ mentorId, enabled: true });
      return (
        <MentorFeedbackSection
          items={feedback.items}
          totalRatingCount={feedback.totalRatingCount ?? 0}
          ratingAverage={feedback.ratingAverage}
          page={feedback.page}
          pageSize={feedback.pageSize}
          isLoading={feedback.isLoading}
          error={feedback.error}
          onPageChange={feedback.setPage}
          onRetry={feedback.reload}
        />
      );
    }

    render(<ConnectedMentorFeedback mentorId={101} />);

    // Initial page-1 load with 0 items renders skeleton
    expect(screen.getByTestId('mentor-feedback-skeleton')).toBeInTheDocument();

    await act(async () => {
      resolvePage1?.(
        fromPartial<MentorFeedbackPage>({
          items: sampleReviews,
          totalRatingCount: 12,
          page: 1,
          pageSize: 10,
          ratingAverage: 8.5,
          completedMeetingCount: 20,
        })
      );
    });

    await waitFor(() =>
      expect(
        screen.queryByTestId('mentor-feedback-skeleton')
      ).not.toBeInTheDocument()
    );
    expect(screen.getByText('陳**')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '第 2 頁' })).toBeEnabled();

    // Clicking page 2 keeps previous items visible with opacity-60 and disables pagination controls
    fireEvent.click(screen.getByRole('button', { name: '第 2 頁' }));

    expect(
      screen.queryByTestId('mentor-feedback-skeleton')
    ).not.toBeInTheDocument();
    const list = screen.getByRole('list', { name: '會談評價列表' });
    expect(list).toHaveClass('opacity-60');
    expect(screen.getByText('陳**')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上一頁' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '第 1 頁' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '第 2 頁' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下一頁' })).toBeDisabled();

    await act(async () => {
      resolvePage2?.(
        fromPartial<MentorFeedbackPage>({
          items: [
            fromPartial<MentorFeedbackItem>({
              id: 'r3',
              authorName: '張**',
              rating: 10,
              content: '第二頁的新評價內容',
              createdAt: '2026-10-20T10:00:00Z',
            }),
          ],
          totalRatingCount: 12,
          page: 2,
          pageSize: 10,
          ratingAverage: 8.5,
          completedMeetingCount: 20,
        })
      );
    });

    await waitFor(() =>
      expect(screen.getByText('第二頁的新評價內容')).toBeInTheDocument()
    );
    expect(screen.getByRole('list', { name: '會談評價列表' })).not.toHaveClass(
      'opacity-60'
    );
    expect(screen.getByRole('button', { name: '上一頁' })).toBeEnabled();
  });

  it('exports valid Storybook stories covering loaded, loading, page-transition loading, empty, fallback-empty, error, and pagination states', () => {
    expect(stories.default.component).toBe(MentorFeedbackSection);
    expect(stories.DefaultWithReviews.args?.totalRatingCount).toBe(3);
    expect(stories.WithPaginationOverTen.args?.totalRatingCount).toBe(12);
    expect(stories.ControlledPaginationPageTwo.args?.page).toBe(2);
    expect(stories.PageTransitionLoading.args).toMatchObject({
      page: 2,
      isLoading: true,
      totalRatingCount: 12,
    });
    expect(stories.PageTransitionLoading.args?.items?.length).toBeGreaterThan(
      0
    );
    expect(stories.EmptyZeroReviews.args?.totalRatingCount).toBe(0);
    expect(stories.FallbackUnavailableWithStats.args?.totalRatingCount).toBe(
      12
    );
    expect(stories.LoadingState.args?.isLoading).toBe(true);
    expect(stories.ErrorWithRetry.args?.error).toBe(
      '載入評價時發生錯誤，請稍後再試。'
    );
  });
});
