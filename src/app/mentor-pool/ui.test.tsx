import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

import type { FilterOptions } from '@/components/filter/MentorFilterDropdown';

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
});
