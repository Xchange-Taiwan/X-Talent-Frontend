import { act, render, renderHook } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

const mockTrackEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import MentorPoolSearchBar from '@/app/mentor-pool/MentorPoolSearchBar';
import PopularPositionChips from '@/app/mentor-pool/PopularPositionChips';
import * as mentorPoolQuery from '@/lib/mentor/mentorPoolQuery';
import { mockRouter, mockSearchParams } from '@/test/mocks/navigation';

import {
  resolveActiveFilterBadges,
  useMentorPoolFilters,
  useMentorPoolSearchQuery,
} from './useMentorPoolFilters';

describe('useMentorPoolFilters & useMentorPoolSearchQuery (#786, #897)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.toString.mockReturnValue('');
    mockSearchParams.get.mockReturnValue(null);
  });

  it('projects localized activeFilterBadges from single and comma-separated selectedFilters and ignores whitespace', () => {
    const badges = resolveActiveFilterBadges(
      {
        filter_industries: { name: '產業', value: 'culture_education' },
        filter_skills: {
          name: '專業能力',
          value: 'skill_typescript, unknown_code',
        },
        filter_topics: { name: '主題', value: '   ' },
      },
      {
        filter_industries: {
          name: '產業',
          options: [{ label: '文化教育', value: 'culture_education' }],
        },
        filter_skills: {
          name: '專業能力',
          options: [{ label: 'TypeScript', value: 'skill_typescript' }],
        },
        filter_topics: {
          name: '主題',
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
        value: 'skill_typescript',
        label: 'TypeScript',
      },
      {
        key: 'filter_skills',
        name: '專業能力',
        value: 'unknown_code',
        label: 'unknown_code',
      },
    ]);
  });

  it('encapsulates URL query reading/writing, single-token removal, and clearAll (clearing q, filter_*, and sort_by while preserving utm_*)', () => {
    mockSearchParams.toString.mockReturnValue(
      'utm_source=discord&q=frontend&filter_skills=skill_ts,skill_fe&filter_industries=tech&sort_by=popularity'
    );
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'utm_source') return 'discord';
      if (key === 'q') return 'frontend';
      if (key === 'filter_skills') return 'skill_ts,skill_fe';
      if (key === 'filter_industries') return 'tech';
      if (key === 'sort_by') return 'popularity';
      return null;
    });

    const { result } = renderHook(() => useMentorPoolFilters());

    expect(result.current.searchQuery).toBe('frontend');
    expect(result.current.hasConditions).toBe(true);
    expect(result.current.selectedFilters.filter_industries?.value).toBe(
      'tech'
    );
    expect('fetchConditions' in result.current).toBe(false);

    act(() => {
      result.current.setSearchQuery('backend');
    });
    expect(mockRouter.push).toHaveBeenLastCalledWith(
      '/mentor-pool?utm_source=discord&q=backend&filter_skills=skill_ts%2Cskill_fe&filter_industries=tech&sort_by=popularity'
    );

    act(() => {
      result.current.removeFilter('filter_skills', 'skill_ts');
    });
    expect(mockRouter.push).toHaveBeenLastCalledWith(
      '/mentor-pool?utm_source=discord&q=frontend&filter_skills=skill_fe&filter_industries=tech&sort_by=popularity'
    );

    act(() => {
      result.current.clearAll();
    });
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: 'mentor_pool_clear_all_filters_click',
    });
    expect(mockRouter.push).toHaveBeenLastCalledWith(
      '/mentor-pool?utm_source=discord'
    );
  });

  it('does not run parseFiltersFromParams or resolveActiveFilterBadges when rendering MentorPoolSearchBar or PopularPositionChips (#897)', () => {
    const spyParseFilters = vi.spyOn(mentorPoolQuery, 'parseFiltersFromParams');
    const spyResolveBadges = vi.spyOn(
      mentorPoolQuery,
      'resolveActiveFilterBadges'
    );

    mockSearchParams.toString.mockReturnValue(
      'q=react&filter_skills=skill_ts,skill_fe'
    );
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'react';
      if (key === 'filter_skills') return 'skill_ts,skill_fe';
      return null;
    });

    const { result } = renderHook(() => useMentorPoolSearchQuery());
    expect(result.current.searchQuery).toBe('react');

    render(React.createElement(MentorPoolSearchBar));
    render(React.createElement(PopularPositionChips));

    expect(spyParseFilters).not.toHaveBeenCalled();
    expect(spyResolveBadges).not.toHaveBeenCalled();

    spyParseFilters.mockRestore();
    spyResolveBadges.mockRestore();
  });
});
