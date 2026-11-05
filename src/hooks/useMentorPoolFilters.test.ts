import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

const mockTrackEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import { mockRouter, mockSearchParams } from '@/test/mocks/navigation';

import {
  resolveActiveFilterBadges,
  useMentorPoolFilters,
} from './useMentorPoolFilters';

describe('useMentorPoolFilters (#786)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.toString.mockReturnValue('');
    mockSearchParams.get.mockReturnValue(null);
  });

  it('projects localized activeFilterBadges from selectedFilters and filterOptions', () => {
    const badges = resolveActiveFilterBadges(
      {
        filter_industries: { name: '產業', value: 'culture_education' },
        filter_skills: { name: '專業能力', value: 'unknown_code' },
      },
      {
        filter_industries: {
          name: '產業',
          options: [{ label: '文化教育', value: 'culture_education' }],
        },
        filter_skills: {
          name: '專業能力',
          options: [],
        },
      }
    );

    expect(badges).toEqual([
      {
        key: 'filter_industries',
        name: '產業',
        value: 'culture_education',
        label: '文化教育',
      },
      {
        key: 'filter_skills',
        name: '專業能力',
        value: 'unknown_code',
        label: 'unknown_code',
      },
    ]);
  });

  it('encapsulates URL query reading/writing for searchQuery, filters, removeFilter, and clearAll', () => {
    mockSearchParams.toString.mockReturnValue(
      'q=frontend&filter_industries=tech'
    );
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'frontend';
      if (key === 'filter_industries') return 'tech';
      return null;
    });

    const { result } = renderHook(() => useMentorPoolFilters());

    expect(result.current.searchQuery).toBe('frontend');
    expect(result.current.hasConditions).toBe(true);
    expect(result.current.selectedFilters.filter_industries?.value).toBe(
      'tech'
    );

    act(() => {
      result.current.setSearchQuery('backend');
    });
    expect(mockRouter.push).toHaveBeenLastCalledWith(
      '/mentor-pool?q=backend&filter_industries=tech'
    );

    act(() => {
      result.current.removeFilter('filter_industries');
    });
    expect(mockRouter.push).toHaveBeenLastCalledWith('/mentor-pool?q=frontend');

    act(() => {
      result.current.clearAll();
    });
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: 'mentor_pool_clear_all_filters_click',
    });
    expect(mockRouter.push).toHaveBeenLastCalledWith('/mentor-pool');
  });
});
