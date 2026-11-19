import { act, renderHook, waitFor } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

vi.mock('@/services/search-mentor/mentors', () => ({
  fetchMentors: vi.fn(),
}));

import avatarImage from '@/assets/default-avatar.png';
import { DEFAULT_MENTOR_PAGE_LIMIT as PAGE_LIMIT } from '@/lib/mentor/mentorPoolQuery';
import {
  mentorPoolReadModel,
  UNFILTERED_MENTOR_POOL_QUERY,
} from '@/lib/mentor/mentorPoolReadModel';
import { fetchMentors } from '@/services/search-mentor/mentors';
import { mockSearchParams } from '@/test/mocks/navigation';
import { mockToast } from '@/test/mocks/useToast';
import type { MentorPage, MentorType } from '@/types/mentor';

import {
  applyMentorPage,
  type MentorPoolPageState,
  useMentorPool,
} from './useMentorPool';

const mockFetchMentors = vi.mocked(fetchMentors);

const mockInitialMentors: MentorType[] = [
  {
    user_id: 1,
    name: 'Initial Mentor',
    avatar: avatarImage,
    job_title: '',
    company: '',
    years_of_experience: '3_5',
    location: '',
    personal_statement: '',
    about: '',
    seniority_level: '',
    industry: null,
    want_position: [],
    want_skill: [],
    want_topic: [],
    have_skill: ['skill_a'],
    have_topic: ['topic_a'],
    updated_at: '2026-11-09T00:00:00Z',
  },
];

describe('useMentorPool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchMentors.mockReset();
    mentorPoolReadModel.clear();
    mockSearchParams.toString.mockReturnValue('');
    mockSearchParams.get.mockReturnValue(null);
  });

  it('initializes with raw subject_group codes intact when no filters are present', () => {
    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    expect(result.current.mentors[0].name).toBe('Initial Mentor');
    expect(result.current.mentors[0].have_topic).toEqual(['topic_a']);
    expect(result.current.mentors[0].have_skill).toEqual(['skill_a']);
    expect(result.current.mentorCount).toBe(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isNoResults).toBe(false);
  });

  it('does not mutate singleton cache during SSR render so warm Node ISR revalidations always reflect fresh initialMentors (#886)', () => {
    function SsrProbe({ mentors }: { mentors: MentorType[] }) {
      const { mentors: rendered } = useMentorPool({
        initialMentors: mentors,
        initialMentorCount: mentors.length,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      });
      return React.createElement(
        'div',
        null,
        rendered.map((m) => m.name).join(',')
      );
    }

    const firstHtml = renderToString(
      React.createElement(SsrProbe, {
        mentors: [{ ...mockInitialMentors[0], user_id: 1, name: 'SSR V1' }],
      })
    );
    expect(firstHtml).toContain('SSR V1');
    expect(
      mentorPoolReadModel.get(UNFILTERED_MENTOR_POOL_QUERY)
    ).toBeUndefined();

    // Simulate [DEPLOY-04] revalidatePath('/mentor-pool') on the SAME warm Node process
    // without clearing module singletons in between:
    const secondHtml = renderToString(
      React.createElement(SsrProbe, {
        mentors: [{ ...mockInitialMentors[0], user_id: 2, name: 'SSR V2' }],
      })
    );
    expect(secondHtml).toContain('SSR V2');
    expect(secondHtml).not.toContain('SSR V1');
    expect(
      mentorPoolReadModel.get(UNFILTERED_MENTOR_POOL_QUERY)
    ).toBeUndefined();
  });

  it('triggers a fetch when parameters are present with search conditions and preserves raw subject_group codes', async () => {
    mockSearchParams.toString.mockReturnValue('q=react');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'react';
      return null;
    });

    const fetchedMentors: MentorType[] = [
      {
        user_id: 2,
        name: 'Fetched Mentor',
        avatar: avatarImage,
        job_title: '',
        company: '',
        years_of_experience: '5_8',
        location: '',
        personal_statement: '',
        about: '',
        seniority_level: '',
        industry: null,
        want_position: [],
        want_skill: [],
        want_topic: [],
        have_skill: [],
        have_topic: ['topic_b'],
        updated_at: '2026-11-09T00:00:01Z',
      },
    ];

    let resolveFetch!: (value: MentorPage) => void;
    const fetchPromise = new Promise<MentorPage>((resolve) => {
      resolveFetch = resolve;
    });
    mockFetchMentors.mockReturnValue(fetchPromise);

    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.mentors).toEqual([]);

    await act(async () => {
      resolveFetch({ mentors: fetchedMentors, nextCursor: null });
      await fetchPromise;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.mentors[0].name).toBe('Fetched Mentor');
    expect(result.current.mentors[0].have_topic).toEqual(['topic_b']);
    expect(result.current.mentorCount).toBe(1);
  });

  it('reuses cached results across utm_* tracking params and reordered filter params without issuing duplicate fetches (#886)', async () => {
    mockSearchParams.toString.mockReturnValue(
      'utm_source=discord&filter_topics=topic_a&q=react&filter_skills=skill_a'
    );
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'utm_source') return 'discord';
      if (key === 'filter_topics') return 'topic_a';
      if (key === 'q') return 'react';
      if (key === 'filter_skills') return 'skill_a';
      return null;
    });

    mockFetchMentors.mockResolvedValueOnce({
      mentors: [{ ...mockInitialMentors[0], user_id: 77, name: 'Canonical' }],
      nextCursor: null,
    });

    const { result, rerender } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    await act(async () => {});
    expect(result.current.mentors[0].name).toBe('Canonical');
    expect(mockFetchMentors).toHaveBeenCalledTimes(1);

    // Strip utm_source and reorder filter params -> must hit canonical cache synchronously
    mockSearchParams.toString.mockReturnValue(
      'filter_skills=skill_a&q=react&filter_topics=topic_a'
    );
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'filter_skills') return 'skill_a';
      if (key === 'q') return 'react';
      if (key === 'filter_topics') return 'topic_a';
      return null;
    });
    rerender();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.mentors[0].name).toBe('Canonical');
    expect(mockFetchMentors).toHaveBeenCalledTimes(1);
  });

  it('handles API errors gracefully inside fetchMentors catch block', async () => {
    mockSearchParams.toString.mockReturnValue('q=react');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'react';
      return null;
    });

    let rejectFetch!: (reason: Error) => void;
    const fetchPromise = new Promise<MentorPage>((_, reject) => {
      rejectFetch = reject;
    });
    mockFetchMentors.mockReturnValue(fetchPromise);

    const spyConsoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      rejectFetch(new Error('Network error'));
      try {
        await fetchPromise;
      } catch {
        // ignore reject in promise chain
      }
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isNoResults).toBe(false);
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '載入失敗',
      description: '無法獲取導師，請稍後再試。',
      duration: 5000,
    });

    spyConsoleError.mockRestore();
  });

  it('gracefully handles AbortError and does not show toast', async () => {
    mockSearchParams.toString.mockReturnValue('q=react');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'react';
      return null;
    });

    let rejectFetch!: (reason: Error) => void;
    const fetchPromise = new Promise<MentorPage>((_, reject) => {
      rejectFetch = reject;
    });

    mockFetchMentors.mockReturnValueOnce(fetchPromise);

    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      rejectFetch(new DOMException('Aborted', 'AbortError'));
      try {
        await fetchPromise;
      } catch {
        // ignore reject
      }
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(true);
    expect(result.current.listStatus).toBe('error');
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('surfaces Retry UI with isLoading=false and suppresses toast when fetchMentors rejects with TimeoutError', async () => {
    mockSearchParams.toString.mockReturnValue('q=timeout');
    mockSearchParams.get.mockImplementation((key) =>
      key === 'q' ? 'timeout' : null
    );

    mockFetchMentors
      .mockRejectedValueOnce(
        new DOMException('The operation timed out.', 'TimeoutError')
      )
      .mockResolvedValueOnce({
        mentors: mockInitialMentors,
        nextCursor: null,
      });

    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    await act(async () => {});

    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(true);
    expect(result.current.listStatus).toBe('error');
    expect(mockToast).not.toHaveBeenCalled();

    await act(async () => {
      result.current.handleRetry();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(false);
    expect(result.current.listStatus).toBe('success');
    expect(result.current.mentors[0].name).toBe('Initial Mentor');
  });

  it('correctly ignores obsolete out-of-order fetch responses to prevent race conditions', async () => {
    mockSearchParams.toString.mockReturnValue('q=react');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'react';
      return null;
    });

    let resolveFetch1!: (value: MentorPage) => void;
    const fetchPromise1 = new Promise<MentorPage>((resolve) => {
      resolveFetch1 = resolve;
    });

    let resolveFetch2!: (value: MentorPage) => void;
    const fetchPromise2 = new Promise<MentorPage>((resolve) => {
      resolveFetch2 = resolve;
    });

    mockFetchMentors
      .mockReturnValueOnce(fetchPromise1)
      .mockReturnValueOnce(fetchPromise2);

    const { result, rerender } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    mockSearchParams.toString.mockReturnValue('q=nextjs');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'nextjs';
      return null;
    });
    rerender();

    await act(async () => {
      resolveFetch1({
        mentors: [{ ...mockInitialMentors[0], user_id: 99 }],
        nextCursor: null,
      });
      await fetchPromise1;
    });

    expect(result.current.mentors).toEqual([]);

    const latestMentors = [{ ...mockInitialMentors[0], user_id: 100 }];
    await act(async () => {
      resolveFetch2({ mentors: latestMentors, nextCursor: null });
      await fetchPromise2;
    });

    expect(result.current.mentors[0].user_id).toBe(100);
  });

  it('scrolls to load more, appends results, and deduplicates existing user_id items', async () => {
    const largeInitialMentors = Array.from({ length: PAGE_LIMIT }, (_, i) => ({
      ...mockInitialMentors[0],
      user_id: i + 1,
    }));

    const paginatedMentors: MentorType[] = [
      {
        ...mockInitialMentors[0],
        user_id: 5,
      },
      {
        ...mockInitialMentors[0],
        user_id: 21,
        have_topic: ['topic_b'],
      },
    ];

    mockFetchMentors.mockResolvedValue({
      mentors: paginatedMentors,
      nextCursor: null,
    });

    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: largeInitialMentors,
        initialNextCursor: 'opaque-next-cursor',
        initialMentorCount: PAGE_LIMIT,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    await act(async () => {
      await result.current.handleScrollToBottom();
    });

    expect(result.current.mentors.length).toBe(PAGE_LIMIT + 1);
    expect(result.current.mentors.find((m) => m.user_id === 21)).toBeDefined();
    expect(
      result.current.mentors.find((m) => m.user_id === 21)?.have_topic
    ).toEqual(['topic_b']);
    expect(result.current.mentorCount).toBe(PAGE_LIMIT + 1);
    expect(mockFetchMentors).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 'opaque-next-cursor' }),
      expect.any(AbortSignal)
    );
  });

  it('retains infinite scroll retry availability (hasMore) when scroll fetch fails', async () => {
    const largeInitialMentors = Array.from({ length: PAGE_LIMIT }, (_, i) => ({
      ...mockInitialMentors[0],
      user_id: i + 1,
    }));

    mockFetchMentors.mockRejectedValue(new Error('Scroll Fetch Failed'));
    const spyConsoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: largeInitialMentors,
        initialNextCursor: 'opaque-next-cursor',
        initialMentorCount: PAGE_LIMIT,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    await act(async () => {
      await result.current.handleScrollToBottom();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isNoResults).toBe(false);
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '載入失敗',
      description: '無法獲取導師，請稍後再試。',
      duration: 5000,
    });

    spyConsoleError.mockRestore();
  });

  it('directly restores initialMentors and bypasses API fetch when filters are cleared', async () => {
    mockSearchParams.toString.mockReturnValue('q=react');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'react';
      return null;
    });

    const fetchedMentors: MentorType[] = [
      {
        ...mockInitialMentors[0],
        user_id: 2,
        name: 'Filtered Mentor',
      },
    ];

    mockFetchMentors.mockResolvedValue({
      mentors: fetchedMentors,
      nextCursor: null,
    });

    const { result, rerender } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    await act(async () => {});

    expect(result.current.mentors[0].name).toBe('Filtered Mentor');
    expect(mockFetchMentors).toHaveBeenCalledTimes(1);

    mockSearchParams.toString.mockReturnValue('');
    mockSearchParams.get.mockReturnValue(null);
    mockFetchMentors.mockClear();

    rerender();

    expect(result.current.mentors[0].name).toBe('Initial Mentor');
    expect(result.current.mentors[0].have_topic).toEqual(['topic_a']);
    expect(result.current.isLoading).toBe(false);
    expect(mockFetchMentors).not.toHaveBeenCalled();
  });

  it('ignores obsolete out-of-order API errors and does not trigger toast or reset loading', async () => {
    mockSearchParams.toString.mockReturnValue('q=react');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'react';
      return null;
    });

    let rejectFetch1!: (reason: Error) => void;
    const fetchPromise1 = new Promise<MentorPage>((_, reject) => {
      rejectFetch1 = reject;
    });

    let resolveFetch2!: (value: MentorPage) => void;
    const fetchPromise2 = new Promise<MentorPage>((resolve) => {
      resolveFetch2 = resolve;
    });

    mockFetchMentors
      .mockReturnValueOnce(fetchPromise1)
      .mockReturnValueOnce(fetchPromise2);

    const spyConsoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const { result, rerender } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    mockSearchParams.toString.mockReturnValue('q=nextjs');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'nextjs';
      return null;
    });
    rerender();

    await act(async () => {
      rejectFetch1(new Error('Obsolete request failure'));
      try {
        await fetchPromise1;
      } catch {
        // ignore reject in promise chain
      }
    });

    expect(mockToast).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(true);

    const latestMentors = [{ ...mockInitialMentors[0], user_id: 100 }];
    await act(async () => {
      resolveFetch2({ mentors: latestMentors, nextCursor: null });
      await fetchPromise2;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.mentors[0].user_id).toBe(100);

    spyConsoleError.mockRestore();
  });

  it('ignores obsolete out-of-order API success and does not overwrite current state with stale results', async () => {
    mockSearchParams.toString.mockReturnValue('q=react');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'react';
      return null;
    });

    let resolveFetch1!: (value: MentorPage) => void;
    const fetchPromise1 = new Promise<MentorPage>((resolve) => {
      resolveFetch1 = resolve;
    });

    let resolveFetch2!: (value: MentorPage) => void;
    const fetchPromise2 = new Promise<MentorPage>((resolve) => {
      resolveFetch2 = resolve;
    });

    mockFetchMentors
      .mockReturnValueOnce(fetchPromise1)
      .mockReturnValueOnce(fetchPromise2);

    const { result, rerender } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    mockSearchParams.toString.mockReturnValue('q=nextjs');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'nextjs';
      return null;
    });
    rerender();

    const latestMentors = [
      { ...mockInitialMentors[0], user_id: 100, name: 'Latest Mentor' },
    ];
    await act(async () => {
      resolveFetch2({ mentors: latestMentors, nextCursor: null });
      await fetchPromise2;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.mentors[0].user_id).toBe(100);
    expect(result.current.mentors[0].name).toBe('Latest Mentor');

    const staleMentors = [
      { ...mockInitialMentors[0], user_id: 50, name: 'Stale Mentor' },
    ];
    await act(async () => {
      resolveFetch1({ mentors: staleMentors, nextCursor: null });
      await fetchPromise1;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.mentors[0].user_id).toBe(100);
    expect(result.current.mentors[0].name).toBe('Latest Mentor');
  });

  it('initializes with hasError=true when initialError is true', () => {
    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: [],
        initialMentorCount: 0,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
        initialError: true,
      })
    );

    expect(result.current.hasError).toBe(true);
    expect(result.current.mentors).toEqual([]);
  });

  it('sets hasError=true when client-side query fails and mentors list is empty', async () => {
    mockSearchParams.toString.mockReturnValue('q=react');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'react';
      return null;
    });

    let rejectFetch!: (reason: Error) => void;
    const fetchPromise = new Promise<MentorPage>((_, reject) => {
      rejectFetch = reject;
    });
    mockFetchMentors.mockReturnValue(fetchPromise);

    const spyConsoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: [],
        initialMentorCount: 0,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasError).toBe(false);

    await act(async () => {
      rejectFetch(new Error('Network error'));
      try {
        await fetchPromise;
      } catch {
        // ignore reject
      }
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(true);
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '載入失敗',
      description: '無法獲取導師，請稍後再試。',
      duration: 5000,
    });

    spyConsoleError.mockRestore();
  });

  it('clears existing mentors and sets hasError=true when changing filters fails', async () => {
    mockSearchParams.toString.mockReturnValue('');
    mockSearchParams.get.mockReturnValue(null);

    const { result, rerender } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    expect(result.current.mentors.length).toBe(1);
    expect(result.current.hasError).toBe(false);

    mockSearchParams.toString.mockReturnValue('q=react');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'react';
      return null;
    });

    mockFetchMentors.mockRejectedValueOnce(new Error('Filter Query Failed'));
    const spyConsoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    rerender();

    await act(async () => {});

    expect(result.current.isLoading).toBe(false);
    expect(result.current.mentors).toEqual([]);
    expect(result.current.hasError).toBe(true);
    expect(result.current.mentorCount).toBe(0);
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '載入失敗',
      description: '無法獲取導師，請稍後再試。',
      duration: 5000,
    });

    spyConsoleError.mockRestore();
  });

  it('does not set hasError=true when client-side scroll query fails and mentors list is not empty', async () => {
    mockSearchParams.toString.mockReturnValue('');
    mockSearchParams.get.mockReturnValue(null);

    const largeInitialMentors = Array.from({ length: PAGE_LIMIT }, (_, i) => ({
      ...mockInitialMentors[0],
      user_id: i + 1,
    }));

    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: largeInitialMentors,
        initialNextCursor: 'opaque-next-cursor',
        initialMentorCount: PAGE_LIMIT,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    expect(result.current.mentors.length).toBe(PAGE_LIMIT);
    expect(result.current.hasError).toBe(false);

    mockFetchMentors.mockRejectedValue(new Error('Scroll Fetch Failed'));
    const spyConsoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await act(async () => {
      await result.current.handleScrollToBottom();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(false);
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '載入失敗',
      description: '無法獲取導師，請稍後再試。',
      duration: 5000,
    });

    spyConsoleError.mockRestore();
  });

  it('clears hasError on successful retry', async () => {
    mockSearchParams.toString.mockReturnValue('q=react');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'react';
      return null;
    });

    mockFetchMentors.mockRejectedValueOnce(new Error('First failure'));
    const spyConsoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: [],
        initialMentorCount: 0,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    await act(async () => {});

    expect(result.current.hasError).toBe(true);
    expect(mockFetchMentors).toHaveBeenCalledTimes(1);

    let resolveRetryFetch!: (value: MentorPage) => void;
    const retryPromise = new Promise<MentorPage>((resolve) => {
      resolveRetryFetch = resolve;
    });
    mockFetchMentors.mockReturnValueOnce(retryPromise);

    await act(async () => {
      result.current.handleRetry();
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasError).toBe(false);

    await act(async () => {
      resolveRetryFetch({ mentors: mockInitialMentors, nextCursor: null });
      await retryPromise;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(false);
    expect(result.current.mentors.length).toBe(1);
    expect(mockFetchMentors).toHaveBeenCalledTimes(2);

    spyConsoleError.mockRestore();
  });

  it('triggers a fetch on retry when no parameters are present if initialError is true', async () => {
    mockSearchParams.toString.mockReturnValue('');
    mockSearchParams.get.mockReturnValue(null);

    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: [],
        initialMentorCount: 0,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
        initialError: true,
      })
    );

    expect(result.current.hasError).toBe(true);
    expect(result.current.mentors).toEqual([]);
    expect(mockFetchMentors).not.toHaveBeenCalled();

    let resolveRetryFetch!: (value: MentorPage) => void;
    const retryPromise = new Promise<MentorPage>((resolve) => {
      resolveRetryFetch = resolve;
    });
    mockFetchMentors.mockReturnValueOnce(retryPromise);

    await act(async () => {
      result.current.handleRetry();
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasError).toBe(false);

    await act(async () => {
      resolveRetryFetch({ mentors: mockInitialMentors, nextCursor: null });
      await retryPromise;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(false);
    expect(result.current.mentors.length).toBe(1);
    expect(result.current.mentors[0].name).toBe('Initial Mentor');
    expect(mockFetchMentors).toHaveBeenCalledTimes(1);
  });

  it('does not fall back to SSR error state on clearing filters if client-side fetches have been performed', async () => {
    mockSearchParams.toString.mockReturnValue('');
    mockSearchParams.get.mockReturnValue(null);

    const { result, rerender } = renderHook(() =>
      useMentorPool({
        initialMentors: [],
        initialMentorCount: 0,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
        initialError: true,
      })
    );

    expect(result.current.hasError).toBe(true);
    expect(result.current.mentors).toEqual([]);

    mockSearchParams.toString.mockReturnValue('q=react');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'react';
      return null;
    });

    const clientFetchedMentors = [
      { ...mockInitialMentors[0], name: 'Client Mentor' },
    ];
    mockFetchMentors.mockResolvedValueOnce({
      mentors: clientFetchedMentors,
      nextCursor: null,
    });

    rerender();

    await act(async () => {});

    expect(result.current.hasError).toBe(false);
    expect(result.current.mentors[0].name).toBe('Client Mentor');
    expect(mockFetchMentors).toHaveBeenCalledTimes(1);

    mockSearchParams.toString.mockReturnValue('');
    mockSearchParams.get.mockReturnValue(null);
    mockFetchMentors.mockClear();

    mockFetchMentors.mockResolvedValueOnce({
      mentors: mockInitialMentors,
      nextCursor: null,
    });

    rerender();

    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasError).toBe(false);

    await act(async () => {});

    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(false);
    expect(result.current.mentors[0].name).toBe('Initial Mentor');
    expect(mockFetchMentors).toHaveBeenCalledTimes(1);
  });

  it('preserves the resolved avatar and other fields of initial mentors without double-processing', () => {
    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    expect(result.current.mentors[0].avatar).toBe(avatarImage);
  });

  it('supports multiple rapid filter changes and triggers fetchMentors for each valid change without concurrent blocking', async () => {
    mockFetchMentors.mockResolvedValue({ mentors: [], nextCursor: null });
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'react';
      return null;
    });

    const { result, rerender } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    expect(result.current.isLoading).toBe(true);

    mockSearchParams.toString.mockReturnValue('q=vue');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'vue';
      return null;
    });
    rerender();

    await act(async () => {});

    expect(mockFetchMentors).toHaveBeenCalledTimes(2);
  });

  it('prevents concurrent loads when handleScrollToBottom is called multiple times rapidly', async () => {
    let resolveFetch: (v: MentorPage) => void = () => {};
    const fetchPromise = new Promise<MentorPage>((resolve) => {
      resolveFetch = resolve;
    });
    mockFetchMentors.mockReturnValue(fetchPromise);

    const largeInitialMentors = Array.from({ length: PAGE_LIMIT }, (_, i) => ({
      ...mockInitialMentors[0],
      user_id: i + 1,
    }));

    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: largeInitialMentors,
        initialNextCursor: 'opaque-next-cursor',
        initialMentorCount: PAGE_LIMIT,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    act(() => {
      void result.current.handleScrollToBottom();
    });

    act(() => {
      void result.current.handleScrollToBottom();
    });

    await act(async () => {
      resolveFetch({
        mentors: [
          {
            ...mockInitialMentors[0],
            user_id: 100,
          },
        ],
        nextCursor: null,
      });
    });

    expect(mockFetchMentors).toHaveBeenCalledTimes(1);
  });

  it('reuses cached paginated state when navigating back to a previously visited filter condition without mutating cache keys (#786)', async () => {
    mockSearchParams.toString.mockReturnValue('q=react');
    mockSearchParams.get.mockImplementation((key) =>
      key === 'q' ? 'react' : null
    );

    const reactMentors = [
      { ...mockInitialMentors[0], user_id: 201, name: 'React Mentor' },
    ];
    const vueMentors = [
      { ...mockInitialMentors[0], user_id: 202, name: 'Vue Mentor' },
    ];
    mockFetchMentors
      .mockResolvedValueOnce({ mentors: reactMentors, nextCursor: null })
      .mockResolvedValueOnce({ mentors: vueMentors, nextCursor: null });

    const { result, rerender } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    await act(async () => {});
    expect(result.current.mentors[0].name).toBe('React Mentor');
    expect(mockFetchMentors).toHaveBeenCalledTimes(1);

    mockSearchParams.toString.mockReturnValue('q=vue');
    mockSearchParams.get.mockImplementation((key) =>
      key === 'q' ? 'vue' : null
    );
    rerender();
    await act(async () => {});
    expect(result.current.mentors[0].name).toBe('Vue Mentor');
    expect(mockFetchMentors).toHaveBeenCalledTimes(2);

    mockSearchParams.toString.mockReturnValue('q=react');
    mockSearchParams.get.mockImplementation((key) =>
      key === 'q' ? 'react' : null
    );
    rerender();
    expect(result.current.mentors[0].name).toBe('React Mentor');
    expect(result.current.isLoading).toBe(false);
    expect(mockFetchMentors).toHaveBeenCalledTimes(2);
  });

  it('aborts an in-flight loadMore request when filter conditions change and suppresses destructive toast (#786)', async () => {
    const largeInitialMentors = Array.from({ length: PAGE_LIMIT }, (_, i) => ({
      ...mockInitialMentors[0],
      user_id: i + 1,
    }));

    let capturedSignal: AbortSignal | undefined;
    let rejectLoadMore!: (err: Error) => void;
    const loadMorePromise = new Promise<MentorPage>((_, reject) => {
      rejectLoadMore = reject;
    });

    mockFetchMentors
      .mockImplementationOnce((_params, signal) => {
        capturedSignal = signal;
        return loadMorePromise;
      })
      .mockResolvedValueOnce({
        mentors: [
          { ...mockInitialMentors[0], user_id: 301, name: 'Filtered Mentor' },
        ],
        nextCursor: null,
      });

    const { result, rerender } = renderHook(() =>
      useMentorPool({
        initialMentors: largeInitialMentors,
        initialNextCursor: 'opaque-next-cursor',
        initialMentorCount: PAGE_LIMIT,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    let scrollDonePromise!: Promise<void>;
    act(() => {
      scrollDonePromise = result.current.handleScrollToBottom();
    });

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    mockSearchParams.toString.mockReturnValue('q=filtered');
    mockSearchParams.get.mockImplementation((key) =>
      key === 'q' ? 'filtered' : null
    );
    rerender();

    expect(capturedSignal?.aborted).toBe(true);

    await act(async () => {
      rejectLoadMore(new Error('Network cancelled'));
      await scrollDonePromise.catch(() => {});
    });

    expect(mockToast).not.toHaveBeenCalled();
    expect(result.current.mentors[0].name).toBe('Filtered Mentor');
  });

  it('preserves multi-page state accumulated via loadMore when switching between filter conditions and back (#786)', async () => {
    mockSearchParams.toString.mockReturnValue('q=multi');
    mockSearchParams.get.mockImplementation((key) =>
      key === 'q' ? 'multi' : null
    );

    const page1 = Array.from({ length: PAGE_LIMIT }, (_, i) => ({
      ...mockInitialMentors[0],
      user_id: 400 + i,
      name: `Multi Page 1 #${i}`,
      updated_at: `2026-11-09T00:00:${String(i).padStart(2, '0')}Z`,
    }));
    const page2 = [
      {
        ...mockInitialMentors[0],
        user_id: 500,
        name: 'Multi Page 2 #0',
        updated_at: '2026-11-09T00:01:00Z',
      },
    ];
    const otherFilterPage = [
      {
        ...mockInitialMentors[0],
        user_id: 600,
        name: 'Other Filter Mentor',
        updated_at: '2026-11-09T00:02:00Z',
      },
    ];

    mockFetchMentors
      .mockResolvedValueOnce({ mentors: page1, nextCursor: 'opaque-page-2' })
      .mockResolvedValueOnce({ mentors: page2, nextCursor: null })
      .mockResolvedValueOnce({ mentors: otherFilterPage, nextCursor: null });

    const { result, rerender } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    await act(async () => {});
    expect(result.current.mentors.length).toBe(PAGE_LIMIT);

    await act(async () => {
      await result.current.handleScrollToBottom();
    });
    expect(result.current.mentors.length).toBe(PAGE_LIMIT + 1);
    expect(result.current.mentorCount).toBe(PAGE_LIMIT + 1);

    mockSearchParams.toString.mockReturnValue('q=other');
    mockSearchParams.get.mockImplementation((key) =>
      key === 'q' ? 'other' : null
    );
    rerender();
    await act(async () => {});
    expect(result.current.mentors.length).toBe(1);
    expect(result.current.mentors[0].name).toBe('Other Filter Mentor');
    expect(mockFetchMentors).toHaveBeenCalledTimes(3);

    mockSearchParams.toString.mockReturnValue('q=multi');
    mockSearchParams.get.mockImplementation((key) =>
      key === 'q' ? 'multi' : null
    );
    rerender();
    expect(result.current.mentors.length).toBe(PAGE_LIMIT + 1);
    expect(result.current.mentors.at(-1)?.name).toBe('Multi Page 2 #0');
    expect(result.current.mentorCount).toBe(PAGE_LIMIT + 1);
    expect(mockFetchMentors).toHaveBeenCalledTimes(3);
  });

  it('falls back to client-side fetchMentors when SSR initialMentors is empty without initialError', async () => {
    mockFetchMentors.mockResolvedValueOnce({
      mentors: mockInitialMentors,
      nextCursor: null,
    });

    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: [],
        initialMentorCount: 0,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    await act(async () => {});

    expect(mockFetchMentors).toHaveBeenCalledTimes(1);
    expect(result.current.mentors[0].name).toBe('Initial Mentor');
    expect(result.current.isLoading).toBe(false);
  });

  it('normalizes empty string initialNextCursor to null and prevents scroll fetch', async () => {
    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialNextCursor: '',
        initialMentorCount: 1,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    await act(async () => {
      await result.current.handleScrollToBottom();
    });

    expect(mockFetchMentors).not.toHaveBeenCalled();
  });

  it('sets hasMore=false in buildInitialUnfilteredState when initialMentors is empty even if initialNextCursor is non-empty', () => {
    const state = mentorPoolReadModel.buildInitialUnfilteredState({
      initialMentors: [],
      initialNextCursor: 'opaque-stale-cursor',
      initialMentorCount: 0,
      hasInitialFilters: false,
    });

    expect(state.nextCursor).toBe('opaque-stale-cursor');
    expect(state.hasMore).toBe(false);
    expect(state.isNoResults).toBe(true);
  });

  it('recovers and preserves subscription when mentorPoolReadModel.clear() runs while mounted on a filtered/sorted URL', async () => {
    mockSearchParams.toString.mockReturnValue('q=react&sort_by=popularity');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'react';
      if (key === 'sort_by') return 'popularity';
      return null;
    });

    const filteredQuery = mentorPoolReadModel.resolveQuery(
      'q=react&sort_by=popularity'
    );
    const beforeClearMentor = {
      ...mockInitialMentors[0],
      user_id: 701,
      name: 'Before Clear Filtered',
    };
    const afterClearMentor = {
      ...mockInitialMentors[0],
      user_id: 702,
      name: 'After Clear Filtered',
    };
    const appendedAfterClearMentor = {
      ...mockInitialMentors[0],
      user_id: 703,
      name: 'Page 2 After Clear Filtered',
    };

    let resolveRefetchAfterClear!: (page: MentorPage) => void;
    const refetchAfterClearPromise = new Promise<MentorPage>((resolve) => {
      resolveRefetchAfterClear = resolve;
    });

    mockFetchMentors
      .mockResolvedValueOnce({
        mentors: [beforeClearMentor],
        nextCursor: null,
      })
      .mockReturnValueOnce(refetchAfterClearPromise)
      .mockResolvedValueOnce({
        mentors: [appendedAfterClearMentor],
        nextCursor: null,
      });

    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    await act(async () => {});
    expect(result.current.isLoading).toBe(false);
    expect(result.current.mentors[0]?.name).toBe('Before Clear Filtered');
    expect(mentorPoolReadModel.get(filteredQuery)).toBeDefined();

    let syncGetAfterClear: MentorPoolPageState | undefined;
    act(() => {
      mentorPoolReadModel.clear();
      syncGetAfterClear = mentorPoolReadModel.get(filteredQuery);
    });

    expect(syncGetAfterClear).toBeUndefined();
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveRefetchAfterClear({
        mentors: [afterClearMentor],
        nextCursor: 'cursor:filtered-after-clear',
      });
      await refetchAfterClearPromise;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.listStatus).toBe('success');
    expect(result.current.mentors.map((m) => m.name)).toEqual([
      'After Clear Filtered',
    ]);

    await act(async () => {
      await result.current.handleScrollToBottom();
    });

    expect(result.current.mentors.map((m) => m.name)).toEqual([
      'After Clear Filtered',
      'Page 2 After Clear Filtered',
    ]);
  });

  it('recovers and keeps loadMore and retry working when mentorPoolReadModel.clear() runs while mounted on an unfiltered URL', async () => {
    mockSearchParams.toString.mockReturnValue('');
    mockSearchParams.get.mockReturnValue(null);

    const refreshedMentor = {
      ...mockInitialMentors[0],
      user_id: 801,
      name: 'Refreshed Unfiltered Page 1',
    };
    const pageTwoMentor = {
      ...mockInitialMentors[0],
      user_id: 802,
      name: 'Refreshed Unfiltered Page 2',
    };

    const spyConsoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    mockFetchMentors
      .mockRejectedValueOnce(new Error('Transient failure after clear'))
      .mockResolvedValueOnce({
        mentors: [refreshedMentor],
        nextCursor: 'cursor:unfiltered-2',
      })
      .mockResolvedValueOnce({
        mentors: [pageTwoMentor],
        nextCursor: null,
      });

    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialNextCursor: 'cursor:initial',
        initialMentorCount: 1,
        params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
      })
    );

    expect(result.current.mentors[0]?.name).toBe('Initial Mentor');
    expect(mentorPoolReadModel.get(UNFILTERED_MENTOR_POOL_QUERY)).toBeDefined();

    let syncGetAfterClear: MentorPoolPageState | undefined;
    await act(async () => {
      mentorPoolReadModel.clear();
      syncGetAfterClear = mentorPoolReadModel.get(UNFILTERED_MENTOR_POOL_QUERY);
    });

    expect(syncGetAfterClear).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(true);

    // Retry on the still-mounted unfiltered hook must update snapshot via preserved subscriber
    await act(async () => {
      result.current.handleRetry();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(false);
    expect(result.current.mentors.map((m) => m.name)).toEqual([
      'Refreshed Unfiltered Page 1',
    ]);

    // Infinite scroll loadMore on the still-mounted unfiltered hook must also deliver updates
    await act(async () => {
      await result.current.handleScrollToBottom();
    });

    expect(result.current.mentors.map((m) => m.name)).toEqual([
      'Refreshed Unfiltered Page 1',
      'Refreshed Unfiltered Page 2',
    ]);

    spyConsoleError.mockRestore();
  });

  it('serves stale cached mentors instead of flashing loading skeleton when TTL has expired', async () => {
    vi.useFakeTimers();
    try {
      mockSearchParams.toString.mockReturnValue('q=swr');
      mockSearchParams.get.mockImplementation((key) =>
        key === 'q' ? 'swr' : null
      );

      const staleMentor = {
        ...mockInitialMentors[0],
        user_id: 901,
        name: 'Stale SWR Mentor',
      };
      const freshMentor = {
        ...mockInitialMentors[0],
        user_id: 902,
        name: 'Fresh SWR Mentor',
      };

      mentorPoolReadModel.set(
        { search_pattern: 'swr' },
        {
          mentors: [staleMentor],
          nextCursor: null,
          hasMore: false,
          mentorCount: 1,
          isNoResults: false,
          hasError: false,
        },
        100
      );

      vi.advanceTimersByTime(500);
      expect(
        mentorPoolReadModel.get({ search_pattern: 'swr' })
      ).toBeUndefined();

      let resolveRevalidate!: (page: MentorPage) => void;
      const revalidatePromise = new Promise<MentorPage>((resolve) => {
        resolveRevalidate = resolve;
      });
      mockFetchMentors.mockReturnValueOnce(revalidatePromise);

      const renderedStatuses: string[] = [];
      const { result } = renderHook(() => {
        const hookState = useMentorPool({
          initialMentors: [],
          initialMentorCount: 0,
          params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
        });
        renderedStatuses.push(hookState.listStatus);
        return hookState;
      });

      // Must never flash 'loading' during initial synchronous render or passive mount
      expect(renderedStatuses).not.toContain('loading');
      expect(result.current.mentors.map((m) => m.name)).toEqual([
        'Stale SWR Mentor',
      ]);
      expect(result.current.listStatus).toBe('success');
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveRevalidate({ mentors: [freshMentor], nextCursor: null });
        await revalidatePromise;
      });

      expect(result.current.mentors.map((m) => m.name)).toEqual([
        'Fresh SWR Mentor',
      ]);
      expect(result.current.isLoading).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears transient SSR error and primes recovered initialMentors when ssrSeed props update on a mounted unfiltered hook', async () => {
    mockSearchParams.toString.mockReturnValue('');
    mockSearchParams.get.mockReturnValue(null);

    const recoveredMentor = {
      ...mockInitialMentors[0],
      user_id: 950,
      name: 'Recovered SSR Mentor',
    };
    const nextPageMentor = {
      ...mockInitialMentors[0],
      user_id: 951,
      name: 'Recovered Page 2 Mentor',
    };

    const { result, rerender } = renderHook(
      (props: {
        mentors: MentorType[];
        nextCursor: string | null;
        count: number;
        error: boolean;
      }) =>
        useMentorPool({
          initialMentors: props.mentors,
          initialNextCursor: props.nextCursor,
          initialMentorCount: props.count,
          initialError: props.error,
          params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
        }),
      {
        initialProps: {
          mentors: [] as MentorType[],
          nextCursor: null as string | null,
          count: 0,
          error: true,
        },
      }
    );

    expect(result.current.hasError).toBe(true);
    expect(result.current.listStatus).toBe('error');
    expect(result.current.mentors).toEqual([]);
    expect(mockFetchMentors).not.toHaveBeenCalled();

    rerender({
      mentors: [recoveredMentor],
      nextCursor: 'cursor:recovered-next',
      count: 1,
      error: false,
    });

    expect(result.current.hasError).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.listStatus).toBe('success');
    expect(result.current.mentorCount).toBe(1);
    expect(result.current.mentors.map((m) => m.name)).toEqual([
      'Recovered SSR Mentor',
    ]);
    expect(mockFetchMentors).not.toHaveBeenCalled();
    expect(
      mentorPoolReadModel.get(UNFILTERED_MENTOR_POOL_QUERY)?.mentors[0]?.name
    ).toBe('Recovered SSR Mentor');

    // Verify the primed unfiltered slot also supports pagination with the updated cursor
    mockFetchMentors.mockResolvedValueOnce({
      mentors: [nextPageMentor],
      nextCursor: null,
    });
    await act(async () => {
      await result.current.handleScrollToBottom();
    });
    expect(result.current.mentors.map((m) => m.name)).toEqual([
      'Recovered SSR Mentor',
      'Recovered Page 2 Mentor',
    ]);
  });

  it('syncs updated non-error ssrSeed props on a mounted unfiltered hook unless client pagination has already advanced the slot', async () => {
    mockSearchParams.toString.mockReturnValue('');
    mockSearchParams.get.mockReturnValue(null);

    const v1Mentor = {
      ...mockInitialMentors[0],
      user_id: 960,
      name: 'SSR V1 Mentor',
    };
    const v2Mentor = {
      ...mockInitialMentors[0],
      user_id: 961,
      name: 'SSR V2 Mentor',
    };
    const page2Mentor = {
      ...mockInitialMentors[0],
      user_id: 962,
      name: 'Client Page 2 Mentor',
    };
    const v3Mentor = {
      ...mockInitialMentors[0],
      user_id: 963,
      name: 'SSR V3 Mentor',
    };

    const { result, rerender } = renderHook(
      (props: {
        mentors: MentorType[];
        nextCursor: string | null;
        count: number;
      }) =>
        useMentorPool({
          initialMentors: props.mentors,
          initialNextCursor: props.nextCursor,
          initialMentorCount: props.count,
          params: fromPartial<ReadonlyURLSearchParams>(mockSearchParams),
        }),
      {
        initialProps: {
          mentors: [v1Mentor] as MentorType[],
          nextCursor: null as string | null,
          count: 1,
        },
      }
    );

    expect(result.current.mentors.map((m) => m.name)).toEqual([
      'SSR V1 Mentor',
    ]);

    // Server refresh updates SSR props before any client pagination -> hook updates to V2
    rerender({
      mentors: [v2Mentor],
      nextCursor: 'cursor:v2-next',
      count: 2,
    });

    expect(result.current.mentors.map((m) => m.name)).toEqual([
      'SSR V2 Mentor',
    ]);
    expect(result.current.mentorCount).toBe(2);

    // Client paginates to page 2 -> subsequent SSR prop re-renders must NOT clobber client-paginated list
    mockFetchMentors.mockResolvedValueOnce({
      mentors: [page2Mentor],
      nextCursor: null,
    });
    await act(async () => {
      await result.current.handleScrollToBottom();
    });

    expect(result.current.mentors.map((m) => m.name)).toEqual([
      'SSR V2 Mentor',
      'Client Page 2 Mentor',
    ]);

    rerender({
      mentors: [v3Mentor],
      nextCursor: null,
      count: 1,
    });

    expect(result.current.mentors.map((m) => m.name)).toEqual([
      'SSR V2 Mentor',
      'Client Page 2 Mentor',
    ]);
  });

  it('refetches live /v1/mentors on mount under React.StrictMode after mentorPoolReadModel.invalidateAfterMutation() even when initialMentors ssrSeed is stale (#974)', async () => {
    mockSearchParams.toString.mockReturnValue('');
    mockSearchParams.get.mockReturnValue(null);

    const staleMentor = {
      ...mockInitialMentors[0],
      user_id: 700,
      name: 'Existing Mentor',
    };
    const newlyOnboardedMentor = {
      ...mockInitialMentors[0],
      user_id: 701,
      name: 'Newly Promoted Mentor',
    };

    mockFetchMentors.mockImplementation((_req, signal) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve({
            mentors: [newlyOnboardedMentor, staleMentor],
            nextCursor: null,
          });
        }, 5);
        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    mentorPoolReadModel.invalidateAfterMutation();

    const { result } = renderHook(
      () =>
        useMentorPool({
          initialMentors: [staleMentor],
          initialNextCursor: null,
          initialMentorCount: 1,
          params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        }),
      { wrapper: React.StrictMode }
    );

    await waitFor(() => {
      expect(result.current.mentors.map((m) => m.name)).toEqual([
        'Newly Promoted Mentor',
        'Existing Mentor',
      ]);
    });
    mockFetchMentors.mockReset();
  });

  it('preserves pending unfiltered refresh when mounting a filtered query first after invalidateAfterMutation(), then clearing filters (#974)', async () => {
    const staleMentor = {
      ...mockInitialMentors[0],
      user_id: 710,
      name: 'Stale SSR Mentor',
    };
    const filteredMentor = {
      ...mockInitialMentors[0],
      user_id: 711,
      name: 'Filtered Mentor',
    };
    const freshUnfilteredMentor = {
      ...mockInitialMentors[0],
      user_id: 712,
      name: 'Fresh Unfiltered Mentor',
    };

    mockSearchParams.toString.mockReturnValue('q=pm');
    mockSearchParams.get.mockImplementation((key: string) =>
      key === 'q' ? 'pm' : null
    );

    mockFetchMentors
      .mockResolvedValueOnce({
        mentors: [filteredMentor],
        nextCursor: null,
      })
      .mockResolvedValueOnce({
        mentors: [freshUnfilteredMentor, staleMentor],
        nextCursor: null,
      });

    mentorPoolReadModel.invalidateAfterMutation();

    const { result, rerender } = renderHook(() =>
      useMentorPool({
        initialMentors: [staleMentor],
        initialNextCursor: null,
        initialMentorCount: 1,
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
      })
    );

    await waitFor(() => {
      expect(result.current.mentors.map((m) => m.name)).toEqual([
        'Filtered Mentor',
      ]);
    });

    // Clear filters back to unfiltered /mentor-pool -> must still fetch fresh unfiltered list
    mockSearchParams.toString.mockReturnValue('');
    mockSearchParams.get.mockReturnValue(null);
    rerender();

    await waitFor(() => {
      expect(mockFetchMentors).toHaveBeenCalledTimes(2);
      expect(result.current.mentors.map((m) => m.name)).toEqual([
        'Fresh Unfiltered Mentor',
        'Stale SSR Mentor',
      ]);
    });
  });

  it('immediately refreshes active mounted useMentorPool subscribers when invalidateAfterMutation() runs (#974)', async () => {
    mockSearchParams.toString.mockReturnValue('');
    mockSearchParams.get.mockReturnValue(null);

    const staleMentor = {
      ...mockInitialMentors[0],
      user_id: 720,
      name: 'Mounted Stale Mentor',
    };
    const updatedMentor = {
      ...mockInitialMentors[0],
      user_id: 721,
      name: 'Mounted Fresh Mentor',
    };

    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: [staleMentor],
        initialNextCursor: null,
        initialMentorCount: 1,
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
      })
    );

    expect(result.current.mentors.map((m) => m.name)).toEqual([
      'Mounted Stale Mentor',
    ]);

    mockFetchMentors.mockResolvedValueOnce({
      mentors: [updatedMentor, staleMentor],
      nextCursor: null,
    });

    await act(async () => {
      mentorPoolReadModel.invalidateAfterMutation();
    });

    await waitFor(() => {
      expect(mockFetchMentors).toHaveBeenCalledTimes(1);
      expect(result.current.mentors.map((m) => m.name)).toEqual([
        'Mounted Fresh Mentor',
        'Mounted Stale Mentor',
      ]);
    });
  });
});

describe('applyMentorPage', () => {
  const initialPageState: MentorPoolPageState = {
    mentors: [],
    nextCursor: null,
    hasMore: true,
    mentorCount: 0,
    isNoResults: false,
    hasError: false,
  };

  const sampleMentor: MentorType = {
    user_id: 10,
    name: 'Sample',
    avatar: avatarImage,
    job_title: '',
    company: '',
    years_of_experience: '',
    location: '',
    personal_statement: '',
    about: '',
    seniority_level: '',
    industry: null,
    want_position: [],
    want_skill: [],
    want_topic: [],
    have_skill: [],
    have_topic: [],
    updated_at: '2026-11-09T00:00:00Z',
  };

  it('handles replace action with non-empty page', () => {
    const action = {
      type: 'replace' as const,
      page: { mentors: [sampleMentor], nextCursor: 'opaque-next' },
    };
    const nextState = applyMentorPage(initialPageState, action);

    expect(nextState.mentors).toEqual([sampleMentor]);
    expect(nextState.nextCursor).toBe('opaque-next');
    expect(nextState.hasMore).toBe(true);
    expect(nextState.mentorCount).toBe(1);
    expect(nextState.isNoResults).toBe(false);
    expect(nextState.hasError).toBe(false);
  });

  it('handles replace action with empty page', () => {
    const action = {
      type: 'replace' as const,
      page: { mentors: [], nextCursor: null },
    };
    const nextState = applyMentorPage(initialPageState, action);

    expect(nextState.mentors).toEqual([]);
    expect(nextState.nextCursor).toBeNull();
    expect(nextState.hasMore).toBe(false);
    expect(nextState.mentorCount).toBe(0);
    expect(nextState.isNoResults).toBe(true);
    expect(nextState.hasError).toBe(false);
  });

  it('sets hasMore to false on replace when mentors is empty even if nextCursor is non-null', () => {
    const action = {
      type: 'replace' as const,
      page: { mentors: [], nextCursor: 'opaque-cursor' },
    };
    const nextState = applyMentorPage(initialPageState, action);

    expect(nextState.mentors).toEqual([]);
    expect(nextState.nextCursor).toBe('opaque-cursor');
    expect(nextState.hasMore).toBe(false);
    expect(nextState.isNoResults).toBe(true);
  });

  it('uses the server continuation token for an empty append page', () => {
    const state: MentorPoolPageState = {
      mentors: [sampleMentor],
      nextCursor: 'opaque-current',
      hasMore: true,
      mentorCount: 1,
      isNoResults: false,
      hasError: false,
    };
    const action = {
      type: 'append' as const,
      page: { mentors: [], nextCursor: null },
    };
    const nextState = applyMentorPage(state, action);

    expect(nextState.mentors).toEqual([sampleMentor]);
    expect(nextState.nextCursor).toBeNull();
    expect(nextState.hasMore).toBe(false);
    expect(nextState.mentorCount).toBe(1);
    expect(nextState.isNoResults).toBe(false);
    expect(nextState.hasError).toBe(false);
  });

  it('handles append action with non-empty page, filters duplicates, and updates count/cursor', () => {
    const state: MentorPoolPageState = {
      mentors: [sampleMentor],
      nextCursor: 'opaque-current',
      hasMore: true,
      mentorCount: 1,
      isNoResults: false,
      hasError: false,
    };

    const duplicateMentor = { ...sampleMentor };
    const newMentor = {
      ...sampleMentor,
      user_id: 11,
      updated_at: '2026-11-09T00:00:01Z',
    };

    const action = {
      type: 'append' as const,
      page: {
        mentors: [duplicateMentor, newMentor],
        nextCursor: 'opaque-next',
      },
    };
    const nextState = applyMentorPage(state, action);

    expect(nextState.mentors).toEqual([sampleMentor, newMentor]);
    expect(nextState.nextCursor).toBe('opaque-next');
    expect(nextState.mentorCount).toBe(2);
    expect(nextState.hasMore).toBe(true);
    expect(nextState.hasError).toBe(false);
  });

  it('sets hasMore to false, preserves mentors reference, and does not inflate mentorCount when append receives only duplicate mentors', () => {
    const state: MentorPoolPageState = {
      mentors: [sampleMentor],
      nextCursor: 'opaque-current',
      hasMore: true,
      mentorCount: 1,
      isNoResults: false,
      hasError: false,
    };

    const nextState = applyMentorPage(state, {
      type: 'append',
      page: {
        mentors: [{ ...sampleMentor }],
        nextCursor: 'opaque-next',
      },
    });

    expect(nextState.mentors).toBe(state.mentors);
    expect(nextState.nextCursor).toBe('opaque-next');
    expect(nextState.hasMore).toBe(false);
    expect(nextState.mentorCount).toBe(1);
    expect(nextState.hasError).toBe(false);
  });

  it('sets hasMore to false and preserves mentors reference when append receives an empty page with a non-null nextCursor', () => {
    const state: MentorPoolPageState = {
      mentors: [sampleMentor],
      nextCursor: 'opaque-current',
      hasMore: true,
      mentorCount: 1,
      isNoResults: false,
      hasError: false,
    };

    const nextState = applyMentorPage(state, {
      type: 'append',
      page: {
        mentors: [],
        nextCursor: 'opaque-next',
      },
    });

    expect(nextState.mentors).toBe(state.mentors);
    expect(nextState.nextCursor).toBe('opaque-next');
    expect(nextState.hasMore).toBe(false);
    expect(nextState.mentorCount).toBe(1);
    expect(nextState.hasError).toBe(false);
  });

  it('sets hasMore to false when append receives an unchanged nextCursor', () => {
    const state: MentorPoolPageState = {
      mentors: [sampleMentor],
      nextCursor: 'opaque-same',
      hasMore: true,
      mentorCount: 1,
      isNoResults: false,
      hasError: false,
    };

    const newMentor = {
      ...sampleMentor,
      user_id: 11,
      updated_at: '2026-11-09T00:00:01Z',
    };

    const nextState = applyMentorPage(state, {
      type: 'append',
      page: {
        mentors: [newMentor],
        nextCursor: 'opaque-same',
      },
    });

    expect(nextState.mentors).toEqual([sampleMentor, newMentor]);
    expect(nextState.nextCursor).toBe('opaque-same');
    expect(nextState.hasMore).toBe(false);
    expect(nextState.mentorCount).toBe(2);
    expect(nextState.hasError).toBe(false);
  });
});
