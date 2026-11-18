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
    expect(stories.WithLongExpandableReviews).toBeDefined();
  });

  it('hides toggle button when review content is 3 lines or fewer, and collapses/expands reviews exceeding 3 lines (#736 6.c 3-1)', () => {
    const reviewsWithMixedLengths: MentorFeedbackItem[] = [
      {
        id: 'short-3-lines',
        authorName: '王**',
        rating: 9,
        content: '第一行重點\n第二行架構\n第三行建議',
        createdAt: '2026-10-29T10:00:00Z',
      },
      {
        id: 'long-explicit-lines',
        authorName: '陳**',
        rating: 10,
        content:
          '第一行：重新整理作品集敘事方式\n第二行：檢視每個專案的問題與研究過程\n第三行：練習說明設計決策背後的原因\n第四行：列出接下來兩週可完成的三件事',
        createdAt: '2026-10-28T10:00:00Z',
      },
      {
        id: 'long-wrapped-paragraph',
        authorName: '李**',
        rating: 8,
        content:
          '這次會談讓我重新整理了作品集的敘事方式。導師先聽我分享目前求職的方向，再一起檢視每個專案的問題、研究過程與成果。最有幫助的是，我們沒有只停留在畫面的修改，而是練習如何說明設計決策背後的原因，以及自己的貢獻。會談結束前，也一起列出了接下來兩週可以完成的三件事，讓原本有點混亂的準備過程變得有方向。謝謝導師很有耐心地追問細節，也分享了與產品和工程團隊合作的實際經驗。',
        createdAt: '2026-10-27T10:00:00Z',
      },
    ];

    render(
      <MentorFeedbackSection
        items={reviewsWithMixedLengths}
        totalRatingCount={3}
        ratingAverage={9.0}
      />
    );

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(3);

    // 1. <= 3 lines: no toggle button and no truncation needed
    const shortParagraph = screen.getByText(/第一行重點/);
    expect(listItems[0].querySelector('button[aria-expanded]')).toBeNull();
    expect(shortParagraph).toBeInTheDocument();

    // 2. > 3 lines: both long items start clamped with "查看更多" (aria-expanded="false")
    const toggleButtons = screen.getAllByRole('button', { name: '查看更多' });
    expect(toggleButtons).toHaveLength(2);

    const firstLongParagraph =
      screen.getByText(/第一行：重新整理作品集敘事方式/);
    expect(firstLongParagraph).toHaveClass('line-clamp-3');
    expect(firstLongParagraph).toHaveAttribute('data-expanded', 'false');
    expect(toggleButtons[0]).toHaveAttribute('aria-expanded', 'false');
    expect(toggleButtons[0]).toHaveAttribute(
      'aria-controls',
      firstLongParagraph.id
    );

    // 3. Click first "查看更多" -> expands only that item, switches button to "收合"
    fireEvent.click(toggleButtons[0]);

    expect(firstLongParagraph).not.toHaveClass('line-clamp-3');
    expect(firstLongParagraph).toHaveAttribute('data-expanded', 'true');
    const collapseBtn = screen.getByRole('button', { name: '收合' });
    expect(collapseBtn).toHaveAttribute('aria-expanded', 'true');
    // Second long review remains collapsed
    expect(screen.getAllByRole('button', { name: '查看更多' })).toHaveLength(1);

    // 4. Click "收合" -> collapses back to 3 lines
    fireEvent.click(collapseBtn);
    expect(firstLongParagraph).toHaveClass('line-clamp-3');
    expect(firstLongParagraph).toHaveAttribute('data-expanded', 'false');
    expect(screen.queryByRole('button', { name: '收合' })).toBeNull();
    expect(screen.getAllByRole('button', { name: '查看更多' })).toHaveLength(2);
  });

  it('displays current page item range count in pagination and resets expanded reviews on page change', () => {
    const page1LongItem: MentorFeedbackItem = {
      id: 'p1-long',
      authorName: '陳**',
      rating: 9,
      content: '第一行\n第二行\n第三行\n第四行超長評價內容',
      createdAt: '2026-10-28T10:00:00Z',
    };
    const { rerender } = render(
      <MentorFeedbackSection
        items={[page1LongItem]}
        totalRatingCount={12}
        ratingAverage={8.5}
        page={1}
        pageSize={10}
        onPageChange={() => {}}
      />
    );

    expect(screen.getByText('第 1–10 則，共 12 則')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看更多' }));
    expect(screen.getByRole('button', { name: '收合' })).toBeInTheDocument();

    rerender(
      <MentorFeedbackSection
        items={[page1LongItem]}
        totalRatingCount={12}
        ratingAverage={8.5}
        page={2}
        pageSize={10}
        onPageChange={() => {}}
      />
    );

    expect(screen.getByText('第 11–12 則，共 12 則')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '收合' })).toBeNull();
    expect(
      screen.getByRole('button', { name: '查看更多' })
    ).toBeInTheDocument();
  });

  it('uses real DOM scrollHeight vs clientHeight measurement when layout geometry is available', () => {
    const originalClientHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientHeight'
    );
    const originalScrollHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollHeight'
    );

    try {
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        configurable: true,
        get() {
          return this.tagName === 'P' ? 68 : 0;
        },
      });
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
        configurable: true,
        get() {
          if (this.tagName !== 'P') return 0;
          return this.textContent?.includes('窄螢幕折成四行') ? 92 : 68;
        },
      });

      render(
        <MentorFeedbackSection
          items={[
            {
              id: 'dom-short',
              authorName: '林**',
              rating: 8,
              content: '三行內不會溢位的短文字',
              createdAt: '2026-10-28T10:00:00Z',
            },
            {
              id: 'dom-wrapped',
              authorName: '張**',
              rating: 9,
              content: '窄螢幕折成四行的評價文字',
              createdAt: '2026-10-27T10:00:00Z',
            },
          ]}
          totalRatingCount={2}
          ratingAverage={8.5}
        />
      );

      expect(screen.getAllByRole('button', { name: '查看更多' })).toHaveLength(
        1
      );
      fireEvent.click(screen.getByRole('button', { name: '查看更多' }));
      expect(screen.getByRole('button', { name: '收合' })).toBeInTheDocument();
    } finally {
      if (originalClientHeight) {
        Object.defineProperty(
          HTMLElement.prototype,
          'clientHeight',
          originalClientHeight
        );
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
      }
      if (originalScrollHeight) {
        Object.defineProperty(
          HTMLElement.prototype,
          'scrollHeight',
          originalScrollHeight
        );
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
      }
    }
  });
});
