import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

import type { FilterOptions } from '@/components/filter/MentorFilterDropdown';
import { mockMentors } from '@/components/mentor-pool/__mocks__/mentors.mock';

import MentorPoolUI from './ui';

const mockFilterOptions: FilterOptions = {
  filter_skills: { name: '專業技能', options: [] },
  filter_topics: { name: '諮詢主題', options: [] },
  filter_industries: { name: '產業背景', options: [] },
};

const defaultProps = {
  mentors: [],
  mentorCount: 0,
  isLoading: false,
  isReplacing: false,
  listStatus: 'loading' as const,
  selectedFilters: {},
  filterOptions: mockFilterOptions,
  onFilterChange: vi.fn(),
  onRemoveFilter: vi.fn(),
  onClearAll: vi.fn(),
  onScrollToBottom: vi.fn(async () => {}),
  onRetry: vi.fn(),
};

describe('MentorPoolUI Mutual Exclusion', () => {
  it('renders ONLY the error state when hasError is true (mutually exclusive with loading/noResults)', () => {
    render(<MentorPoolUI {...defaultProps} listStatus="error" />);

    // Should render the error text "載入失敗，請重試"
    expect(screen.getByText('載入失敗，請重試')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '重新嘗試' })
    ).toBeInTheDocument();

    // Should NOT render loading spinner or "找不到符合的導師"
    expect(
      screen.queryByRole('status', { name: '載入中' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('找不到符合的導師')).not.toBeInTheDocument();
  });

  it('renders ONLY the loading state when isLoading is true (mutually exclusive with error/noResults)', () => {
    render(<MentorPoolUI {...defaultProps} listStatus="loading" />);

    // Should render loading spinner
    expect(
      screen.getAllByRole('status').some((el) => el.textContent === '載入中')
    ).toBe(true);

    // Should NOT render error or "找不到符合的導師"
    expect(screen.queryByText('載入失敗，請重試')).not.toBeInTheDocument();
    expect(screen.queryByText('找不到符合的導師')).not.toBeInTheDocument();
  });

  it('renders ONLY the no-results state when isNoResults is true (mutually exclusive with error/loading)', () => {
    render(<MentorPoolUI {...defaultProps} listStatus="empty" />);

    // Should render "找不到符合的導師"
    expect(screen.getByText('找不到符合的導師')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '清除所有條件' })
    ).toBeInTheDocument();

    // Should NOT render error or loading spinner
    expect(screen.queryByText('載入失敗，請重試')).not.toBeInTheDocument();
    expect(
      screen.queryAllByRole('status').some((el) => el.textContent === '載入中')
    ).toBe(false);
  });

  it('renders the load-more spinner inside an absolute container to prevent bottom scroll layout shifts (#851)', () => {
    render(
      <MentorPoolUI
        {...defaultProps}
        mentors={mockMentors.slice(0, 2)}
        mentorCount={2}
        listStatus="success"
        isLoading={true}
        isReplacing={false}
      />
    );

    const loadMoreContainer = screen.getByTestId('load-more-spinner');
    expect(loadMoreContainer).toHaveClass('absolute');
    expect(loadMoreContainer).toHaveClass('pointer-events-none');
  });
});

describe('MentorCardList IntersectionObserver stability (#851)', () => {
  it('does not recreate IntersectionObserver when only onScrollToBottom reference changes, and re-observes when last mentor user_id changes', () => {
    const observeSpy = vi.fn();
    const disconnectSpy = vi.fn();
    const OriginalIntersectionObserver = globalThis.IntersectionObserver;

    class MockIntersectionObserver {
      constructor(public callback: IntersectionObserverCallback) {}
      observe = observeSpy;
      disconnect = disconnectSpy;
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = '';
      thresholds = [0.5];
    }

    globalThis.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;

    try {
      const handler1 = vi.fn(async () => {});
      const handler2 = vi.fn(async () => {});

      const { rerender } = render(
        <MentorPoolUI
          {...defaultProps}
          mentors={mockMentors.slice(0, 2)}
          mentorCount={2}
          listStatus="success"
          onScrollToBottom={handler1}
        />
      );

      expect(observeSpy).toHaveBeenCalledTimes(1);

      // Rerender with a new onScrollToBottom callback reference but identical mentors
      rerender(
        <MentorPoolUI
          {...defaultProps}
          mentors={mockMentors.slice(0, 2)}
          mentorCount={2}
          listStatus="success"
          onScrollToBottom={handler2}
        />
      );

      // Must NOT disconnect and re-observe the same last card
      expect(observeSpy).toHaveBeenCalledTimes(1);

      // Rerender with a new last mentor user_id
      rerender(
        <MentorPoolUI
          {...defaultProps}
          mentors={mockMentors.slice(0, 3)}
          mentorCount={3}
          listStatus="success"
          onScrollToBottom={handler2}
        />
      );

      expect(observeSpy).toHaveBeenCalledTimes(2);
    } finally {
      globalThis.IntersectionObserver = OriginalIntersectionObserver;
    }
  });
});
