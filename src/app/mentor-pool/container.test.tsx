import { act, render } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();
let currentSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => currentSearchParams,
}));

const mockUseMentorPool = vi.fn();
vi.mock('@/hooks/useMentorPool', () => ({
  useMentorPool: (...args: unknown[]) => mockUseMentorPool(...args),
}));

const mockUseTagCatalog = vi.fn();
vi.mock('@/hooks/user/tags/useTagCatalog', () => ({
  default: (...args: unknown[]) => mockUseTagCatalog(...args),
}));

const mockTrackEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import type { SelectFilters } from '@/components/filter/MentorFilterDropdown';
import type {
  TagCatalogGroupVO,
  TagCatalogsByBucket,
} from '@/types/tagCatalog';

interface UIProps {
  filterOptions: {
    filter_skills: {
      name: string;
      options: { label: string; value: string }[];
    };
    filter_topics: {
      name: string;
      options: { label: string; value: string }[];
    };
    filter_industries: {
      name: string;
      options: { label: string; value: string }[];
    };
  };
  selectedFilters: SelectFilters;
  isReplacing: boolean;
  onFilterChange: (filters: SelectFilters) => void;
  onRemoveFilter: (key: string) => void;
  onClearAll: () => void;
}

// The real MentorFilterDropdown/UI tree is exercised by ui.test.tsx. Here we
// only care what props the container hands down, so swap the UI for a spy
// that records its props and renders a marker.
const mockMentorPoolUI = vi.fn((_props: UIProps) => (
  <div data-testid="mentor-pool-ui" />
));
vi.mock('./ui', () => ({
  default: (props: UIProps) => mockMentorPoolUI(props),
}));

import MentorPoolContainer from './container';

const EMPTY_BUCKET_CATALOG: TagCatalogsByBucket = {
  want_position: [],
  want_skill: [],
  want_topic: [],
  have_skill: [],
  have_topic: [],
  industry: [],
};

function leafGroup(
  groupSubject: string,
  leaves: { subject_group: string; subject: string }[]
): TagCatalogGroupVO {
  return {
    subject_group: `${groupSubject}_group`,
    subject: groupSubject,
    language: 'zh_TW',
    leaves: leaves.map((leaf, index) => ({
      ...leaf,
      tag_id: index,
      language: 'zh_TW',
    })),
  };
}

function renderContainer(overrides: Partial<TagCatalogsByBucket> = {}) {
  mockUseTagCatalog.mockReturnValue({
    ...EMPTY_BUCKET_CATALOG,
    ...overrides,
    isLoading: false,
    error: null,
  });
  mockUseMentorPool.mockReturnValue({
    mentors: [],
    mentorCount: 0,
    isLoading: false,
    listStatus: 'success',
    handleScrollToBottom: vi.fn(),
    handleRetry: vi.fn(),
  });

  return render(
    <MentorPoolContainer
      initialMentors={[]}
      initialMentorCount={0}
      initialTagCatalog={EMPTY_BUCKET_CATALOG}
    />
  );
}

function latestUIProps(): UIProps {
  const call = mockMentorPoolUI.mock.calls.at(-1);
  if (!call) throw new Error('MentorPoolUI was never rendered');
  return call[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  currentSearchParams = new URLSearchParams();
});

describe('MentorPoolContainer - tag catalog to filter option mapping', () => {
  it('round-trips subject_group as the option value and subject as the display label', () => {
    renderContainer({
      have_skill: [
        leafGroup('前端', [{ subject_group: 'skill_fe', subject: '前端工程' }]),
      ],
    });

    expect(latestUIProps().filterOptions.filter_skills.options).toEqual([
      { label: '前端工程', value: 'skill_fe' },
    ]);
  });

  it('drops leaves without a subject_group instead of producing an empty-value option', () => {
    renderContainer({
      have_topic: [
        leafGroup('主題', [
          { subject_group: '', subject: '缺代碼的主題' },
          { subject_group: 'topic_valid', subject: '有效主題' },
        ]),
      ],
    });

    expect(latestUIProps().filterOptions.filter_topics.options).toEqual([
      { label: '有效主題', value: 'topic_valid' },
    ]);
  });

  it('flattens skills/topics bucket groups to leaf level but keeps industry as its flat bucket', () => {
    renderContainer({
      have_skill: [
        leafGroup('前端', [{ subject_group: 'skill_fe', subject: '前端工程' }]),
      ],
      have_topic: [
        leafGroup('管理', [{ subject_group: 'topic_mgmt', subject: '管理' }]),
      ],
      industry: [{ subject_group: 'industry_tech', subject: '科技業' }],
    });

    const { filterOptions } = latestUIProps();
    // skills/topics options come from `.leaves`, not the group node itself.
    expect(filterOptions.filter_skills.options).toEqual([
      { label: '前端工程', value: 'skill_fe' },
    ]);
    expect(filterOptions.filter_topics.options).toEqual([
      { label: '管理', value: 'topic_mgmt' },
    ]);
    // industry is read directly off the flat bucket - no `.leaves` involved.
    expect(filterOptions.filter_industries.options).toEqual([
      { label: '科技業', value: 'industry_tech' },
    ]);
  });
});

describe('MentorPoolContainer - initial state wiring', () => {
  it('parses the current search params into selectedFilters for the UI', () => {
    currentSearchParams = new URLSearchParams('filter_skills=skill_fe');
    renderContainer();

    expect(latestUIProps().selectedFilters).toEqual({
      filter_skills: { name: '技能', value: 'skill_fe' },
    });
  });

  it('passes useMentorPool the raw params, initial page data, and a label map built from the tag catalog', () => {
    currentSearchParams = new URLSearchParams('filter_skills=skill_fe');
    renderContainer({
      have_skill: [
        leafGroup('前端', [{ subject_group: 'skill_fe', subject: '前端工程' }]),
      ],
    });

    const call = mockUseMentorPool.mock.calls.at(-1)?.[0];
    expect(call.params).toBe(currentSearchParams);
    expect(call.initialMentors).toEqual([]);
    expect(call.initialMentorCount).toBe(0);
    expect(call.initialError).toBeUndefined();
    expect(call.labelMap).toBeInstanceOf(Map);
    expect(call.labelMap.get('skill_fe')).toBe('前端工程');
  });

  it('does not leave isReplacing stuck true once a filter-driven transition settles', () => {
    currentSearchParams = new URLSearchParams();
    renderContainer();

    expect(latestUIProps().isReplacing).toBe(false);

    act(() => {
      latestUIProps().onFilterChange({
        filter_skills: { name: '技能', value: 'skill_fe' },
      });
    });

    // The transition here wraps a synchronous router.push with no async work,
    // so by the time it settles isReplacing must be back to false - this
    // guards against a regression that leaves the UI stuck mid-transition.
    expect(latestUIProps().isReplacing).toBe(false);
  });
});

describe('MentorPoolContainer - filter routing', () => {
  it('derives the next URL and pushes it when filters change', () => {
    currentSearchParams = new URLSearchParams('q=test');
    renderContainer();

    act(() => {
      latestUIProps().onFilterChange({
        filter_skills: { name: '技能', value: 'skill_fe' },
      });
    });

    expect(mockPush).toHaveBeenCalledWith(
      '/mentor-pool?q=test&filter_skills=skill_fe'
    );
  });

  it('derives the next URL and pushes it when a single filter is removed', () => {
    currentSearchParams = new URLSearchParams(
      'q=test&filter_skills=skill_fe&filter_topics=topic_mgmt'
    );
    renderContainer();

    act(() => {
      latestUIProps().onRemoveFilter('filter_skills');
    });

    expect(mockPush).toHaveBeenCalledWith(
      '/mentor-pool?q=test&filter_topics=topic_mgmt'
    );
  });

  it('derives the next URL and pushes it when all filters are cleared', () => {
    currentSearchParams = new URLSearchParams(
      'q=test&filter_skills=skill_fe&filter_topics=topic_mgmt&filter_industries=industry_tech'
    );
    renderContainer();

    act(() => {
      latestUIProps().onClearAll();
    });

    expect(mockPush).toHaveBeenCalledWith('/mentor-pool');
  });

  it('fires the clear-all tracking event exclusively on clear-all, not on change or single removal', () => {
    currentSearchParams = new URLSearchParams(
      'filter_skills=skill_fe&filter_topics=topic_mgmt'
    );
    renderContainer();
    const props = latestUIProps();

    act(() => {
      props.onFilterChange({
        filter_skills: { name: '技能', value: 'skill_fe' },
      });
    });
    act(() => {
      props.onRemoveFilter('filter_topics');
    });
    expect(mockTrackEvent).not.toHaveBeenCalled();

    act(() => {
      props.onClearAll();
    });
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: 'mentor_pool_clear_all_filters_click',
    });
  });
});
