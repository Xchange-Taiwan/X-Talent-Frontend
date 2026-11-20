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

  it('does not run projectMentorPoolDiscoveryState, parseFiltersFromParams, or resolveActiveFilterBadges when rendering MentorPoolSearchBar or PopularPositionChips (#897, #976)', () => {
    const spyProjectState = vi.spyOn(
      mentorPoolQuery,
      'projectMentorPoolDiscoveryState'
    );
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

    expect(spyProjectState).not.toHaveBeenCalled();
    expect(spyParseFilters).not.toHaveBeenCalled();
    expect(spyResolveBadges).not.toHaveBeenCalled();

    spyProjectState.mockRestore();
    spyParseFilters.mockRestore();
    spyResolveBadges.mockRestore();
  });

  it('projects canonical query, queryKey, filterOptions, activeFilterBadges, and prioritizedCardTagCodes in one pass and stabilizes query across utm_* changes (#976)', () => {
    mockSearchParams.toString.mockReturnValue(
      'utm_source=discord&q=frontend&filter_skills=skill_ts&filter_industries=tech'
    );
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'utm_source') return 'discord';
      if (key === 'q') return 'frontend';
      if (key === 'filter_skills') return 'skill_ts';
      if (key === 'filter_industries') return 'tech';
      return null;
    });

    const tagCatalog = {
      have_skill: [
        {
          subject_group: 'fe',
          subject: '前端',
          language: 'zh_TW',
          leaves: [
            {
              tag_id: 1,
              subject_group: 'skill_ts',
              subject: 'TypeScript',
              language: 'zh_TW',
            },
          ],
        },
      ],
      have_topic: [],
      industry: [{ subject_group: 'tech', subject: '科技業' }],
    };

    const { result, rerender } = renderHook(() =>
      useMentorPoolFilters({ tagCatalog })
    );

    const initialQueryRef = result.current.query;
    expect(initialQueryRef).toEqual({
      search_pattern: 'frontend',
      filter_skills: 'skill_ts',
      filter_industries: 'tech',
    });
    expect(result.current.queryKey).toBe(
      mentorPoolQuery.serializeMentorPoolQuery(initialQueryRef)
    );
    expect(Array.from(result.current.prioritizedCardTagCodes)).toEqual([
      'skill_ts',
    ]);
    expect(result.current.activeFilterBadges).toEqual([
      {
        key: 'filter_skills',
        name: '技能',
        value: 'skill_ts',
        label: 'TypeScript',
      },
      {
        key: 'filter_industries',
        name: '產業',
        value: 'tech',
        label: '科技業',
      },
    ]);

    // Simulate utm_source changing while search/filter conditions remain identical
    mockSearchParams.toString.mockReturnValue(
      'utm_source=newsletter&q=frontend&filter_skills=skill_ts&filter_industries=tech'
    );
    rerender();

    expect(result.current.query).toBe(initialQueryRef);
  });
});
