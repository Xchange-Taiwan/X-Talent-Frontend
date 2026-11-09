import { act, renderHook } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

const { mentorFetchSpy } = vi.hoisted(() => ({ mentorFetchSpy: vi.fn() }));

vi.mock('@/services/search-mentor/mentors', () => ({
  fetchMentors: async (...args: unknown[]) => {
    const result = await mentorFetchSpy(...args);
    return Array.isArray(result)
      ? { mentors: result, nextCursor: null }
      : result;
  },
}));

import { PAGE_LIMIT } from '@/app/mentor-pool/constants';
import avatarImage from '@/assets/default-avatar.png';
import { mentorPoolReadManager } from '@/lib/cache/mentorPoolCache';
import { mockSearchParams } from '@/test/mocks/navigation';
import { mockToast } from '@/test/mocks/useToast';
import type { MentorType } from '@/types/mentor';

import {
  applyMentorPage,
  type MentorPoolPageState,
  useMentorPool,
} from './useMentorPool';

const mockFetchMentors = mentorFetchSpy;

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

const testLabelMap = new Map<string, string>([
  ['topic_a', 'Localized Topic A'],
  ['topic_b', 'Localized Topic B'],
  ['skill_a', 'Localized Skill A'],
  ['skill_b', 'Localized Skill B'],
]);

describe('useMentorPool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mentorFetchSpy.mockReset();
    mentorPoolReadManager.clear();
    mockSearchParams.toString.mockReturnValue('');
    mockSearchParams.get.mockReturnValue(null);
  });

  it('initializes and translates initial mentors when no filters are present', () => {
    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
      })
    );

    expect(result.current.mentors[0].name).toBe('Initial Mentor');
    expect(result.current.mentors[0].have_topic).toEqual(['Localized Topic A']);
    expect(result.current.mentors[0].have_skill).toEqual(['Localized Skill A']);
    expect(result.current.mentorCount).toBe(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isNoResults).toBe(false);
  });

  it('triggers a fetch when parameters are present with search conditions', async () => {
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

    let resolveFetch!: (value: MentorType[]) => void;
    const fetchPromise = new Promise<MentorType[]>((resolve) => {
      resolveFetch = resolve;
    });
    mockFetchMentors.mockReturnValue(fetchPromise);

    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
      })
    );

    // Should start in loading state
    expect(result.current.isLoading).toBe(true);
    expect(result.current.mentors).toEqual([]);

    await act(async () => {
      resolveFetch(fetchedMentors);
      await fetchPromise;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.mentors[0].name).toBe('Fetched Mentor');
    expect(result.current.mentors[0].have_topic).toEqual(['Localized Topic B']);
    expect(result.current.mentorCount).toBe(1);
  });

  it('handles API errors gracefully inside fetchMentors catch block', async () => {
    mockSearchParams.toString.mockReturnValue('q=react');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'react';
      return null;
    });

    let rejectFetch!: (reason: Error) => void;
    const fetchPromise = new Promise<MentorType[]>((_, reject) => {
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
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
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
    expect(result.current.isNoResults).toBe(false); // does not lock infinite scroll on error
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
    const fetchPromise = new Promise<MentorType[]>((_, reject) => {
      rejectFetch = reject;
    });

    mockFetchMentors.mockReturnValueOnce(fetchPromise);

    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
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

    expect(mockToast).not.toHaveBeenCalled();
  });

  it('correctly ignores obsolete out-of-order fetch responses to prevent race conditions', async () => {
    mockSearchParams.toString.mockReturnValue('q=react');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'react';
      return null;
    });

    let resolveFetch1!: (value: MentorType[]) => void;
    const fetchPromise1 = new Promise<MentorType[]>((resolve) => {
      resolveFetch1 = resolve;
    });

    let resolveFetch2!: (value: MentorType[]) => void;
    const fetchPromise2 = new Promise<MentorType[]>((resolve) => {
      resolveFetch2 = resolve;
    });

    // Mock first and second fetch responses
    mockFetchMentors
      .mockReturnValueOnce(fetchPromise1)
      .mockReturnValueOnce(fetchPromise2);

    const { result, rerender } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
      })
    );

    // Simulate parameters updating a second time immediately
    mockSearchParams.toString.mockReturnValue('q=nextjs');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'nextjs';
      return null;
    });
    rerender();

    // Resolve first (now obsolete) fetch
    await act(async () => {
      resolveFetch1([{ ...mockInitialMentors[0], user_id: 99 }]);
      await fetchPromise1;
    });

    // obsolete response should be ignored, mentors state remains empty/loading
    expect(result.current.mentors).toEqual([]);

    // Resolve second (latest) fetch
    const latestMentors = [{ ...mockInitialMentors[0], user_id: 100 }];
    await act(async () => {
      resolveFetch2(latestMentors);
      await fetchPromise2;
    });

    expect(result.current.mentors[0].user_id).toBe(100);
  });

  it('scrolls to load more, appends results, and deduplicates existing user_id items', async () => {
    // We want the mock initial state to think hasMore is true, so set initialMentors.length to PAGE_LIMIT
    const largeInitialMentors = Array.from({ length: PAGE_LIMIT }, (_, i) => ({
      ...mockInitialMentors[0],
      user_id: i + 1,
    }));

    const paginatedMentors: MentorType[] = [
      {
        ...mockInitialMentors[0],
        user_id: 5, // Duplicate user_id (already exists in initial)
      },
      {
        ...mockInitialMentors[0],
        user_id: 21, // New user_id
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
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
      })
    );

    await act(async () => {
      await result.current.handleScrollToBottom();
    });

    // Should filter out duplicate user_id 5, appending only user_id 21. Total mentors = PAGE_LIMIT + 1 = 10.
    expect(result.current.mentors.length).toBe(PAGE_LIMIT + 1);
    expect(result.current.mentors.find((m) => m.user_id === 21)).toBeDefined();
    expect(
      result.current.mentors.find((m) => m.user_id === 21)?.have_topic
    ).toEqual(['Localized Topic B']);
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
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
      })
    );

    await act(async () => {
      await result.current.handleScrollToBottom();
    });

    // Loading should be reset to false
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isNoResults).toBe(false); // Should NOT lock infinite scroll
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '載入失敗',
      description: '無法獲取導師，請稍後再試。',
      duration: 5000,
    });

    spyConsoleError.mockRestore();
  });

  it('directly restores initialMentors and bypasses API fetch when filters are cleared', async () => {
    // 1. Mount with parameters (filtered conditions)
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

    mockFetchMentors.mockResolvedValue(fetchedMentors);

    const { result, rerender } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
      })
    );

    // Wait for the query load to complete
    await act(async () => {});

    expect(result.current.mentors[0].name).toBe('Filtered Mentor');
    expect(mockFetchMentors).toHaveBeenCalledTimes(1);

    // 2. Clear filters (go from filtered to unfiltered)
    mockSearchParams.toString.mockReturnValue('');
    mockSearchParams.get.mockReturnValue(null);
    mockFetchMentors.mockClear();

    rerender();

    // It should synchronously restore initialMentors
    expect(result.current.mentors[0].name).toBe('Initial Mentor');
    expect(result.current.mentors[0].have_topic).toEqual(['Localized Topic A']);
    expect(result.current.isLoading).toBe(false);

    // API fetch should NOT be called during filter-clearing
    expect(mockFetchMentors).not.toHaveBeenCalled();
  });

  it('ignores obsolete out-of-order API errors and does not trigger toast or reset loading', async () => {
    mockSearchParams.toString.mockReturnValue('q=react');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'react';
      return null;
    });

    let rejectFetch1!: (reason: Error) => void;
    const fetchPromise1 = new Promise<MentorType[]>((_, reject) => {
      rejectFetch1 = reject;
    });

    let resolveFetch2!: (value: MentorType[]) => void;
    const fetchPromise2 = new Promise<MentorType[]>((resolve) => {
      resolveFetch2 = resolve;
    });

    // Mock first (failing) and second (successful) fetches
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
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
      })
    );

    // Trigger second request immediately
    mockSearchParams.toString.mockReturnValue('q=nextjs');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'nextjs';
      return null;
    });
    rerender();

    // Reject first (obsolete) fetch
    await act(async () => {
      rejectFetch1(new Error('Obsolete request failure'));
      try {
        await fetchPromise1;
      } catch {
        // ignore reject in promise chain
      }
    });

    // Error should be ignored: no toast shown, isLoading remains true
    expect(mockToast).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(true);

    // Resolve second (latest) fetch
    const latestMentors = [{ ...mockInitialMentors[0], user_id: 100 }];
    await act(async () => {
      resolveFetch2(latestMentors);
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

    let resolveFetch1!: (value: MentorType[]) => void;
    const fetchPromise1 = new Promise<MentorType[]>((resolve) => {
      resolveFetch1 = resolve;
    });

    let resolveFetch2!: (value: MentorType[]) => void;
    const fetchPromise2 = new Promise<MentorType[]>((resolve) => {
      resolveFetch2 = resolve;
    });

    // Mock first (slow) and second (fast) fetches
    mockFetchMentors
      .mockReturnValueOnce(fetchPromise1)
      .mockReturnValueOnce(fetchPromise2);

    const { result, rerender } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
      })
    );

    // Trigger second request immediately
    mockSearchParams.toString.mockReturnValue('q=nextjs');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'nextjs';
      return null;
    });
    rerender();

    // Resolve second (latest) fetch first
    const latestMentors = [
      { ...mockInitialMentors[0], user_id: 100, name: 'Latest Mentor' },
    ];
    await act(async () => {
      resolveFetch2(latestMentors);
      await fetchPromise2;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.mentors[0].user_id).toBe(100);
    expect(result.current.mentors[0].name).toBe('Latest Mentor');

    // Resolve first (stale) fetch last
    const staleMentors = [
      { ...mockInitialMentors[0], user_id: 50, name: 'Stale Mentor' },
    ];
    await act(async () => {
      resolveFetch1(staleMentors);
      await fetchPromise1;
    });

    // It should NOT overwrite the latest results
    expect(result.current.isLoading).toBe(false);
    expect(result.current.mentors[0].user_id).toBe(100);
    expect(result.current.mentors[0].name).toBe('Latest Mentor');
  });

  it('initializes with hasError=true when initialError is true', () => {
    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: [],
        initialMentorCount: 0,
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
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
    const fetchPromise = new Promise<MentorType[]>((_, reject) => {
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
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
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
    // 1. Start with initial mentors pre-loaded (unfiltered state)
    mockSearchParams.toString.mockReturnValue('');
    mockSearchParams.get.mockReturnValue(null);

    const { result, rerender } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
      })
    );

    expect(result.current.mentors.length).toBe(1);
    expect(result.current.hasError).toBe(false);

    // 2. Change filters, mock query failure
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

    // Settle the mock failure promise
    await act(async () => {});

    expect(result.current.isLoading).toBe(false);
    // CRITICAL ASSERTIONS: mentors must be empty, and hasError must be true!
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
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
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
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
      })
    );

    await act(async () => {});

    expect(result.current.hasError).toBe(true);
    expect(mockFetchMentors).toHaveBeenCalledTimes(1);

    // Use a manual pending promise for the second fetch (retry) to test transition states
    let resolveRetryFetch!: (value: MentorType[]) => void;
    const retryPromise = new Promise<MentorType[]>((resolve) => {
      resolveRetryFetch = resolve;
    });
    mockFetchMentors.mockReturnValueOnce(retryPromise);

    await act(async () => {
      result.current.handleRetry();
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasError).toBe(false);

    await act(async () => {
      resolveRetryFetch(mockInitialMentors);
      await retryPromise;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(false);
    expect(result.current.mentors.length).toBe(1);
    expect(mockFetchMentors).toHaveBeenCalledTimes(2);

    spyConsoleError.mockRestore();
  });

  it('triggers a fetch on retry when no parameters are present if initialError is true', async () => {
    // 1. Initialized with SSR error and no filters
    mockSearchParams.toString.mockReturnValue('');
    mockSearchParams.get.mockReturnValue(null);

    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: [],
        initialMentorCount: 0,
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
        initialError: true,
      })
    );

    expect(result.current.hasError).toBe(true);
    expect(result.current.mentors).toEqual([]);
    expect(mockFetchMentors).not.toHaveBeenCalled();

    // Use a manual pending promise for the retry fetch to test transition states
    let resolveRetryFetch!: (value: MentorType[]) => void;
    const retryPromise = new Promise<MentorType[]>((resolve) => {
      resolveRetryFetch = resolve;
    });
    mockFetchMentors.mockReturnValueOnce(retryPromise);

    // 2. Click retry
    await act(async () => {
      result.current.handleRetry();
    });

    // Should not early return, but instead trigger API fetch
    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasError).toBe(false);

    await act(async () => {
      resolveRetryFetch(mockInitialMentors);
      await retryPromise;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(false);
    expect(result.current.mentors.length).toBe(1);
    expect(result.current.mentors[0].name).toBe('Initial Mentor');
    expect(mockFetchMentors).toHaveBeenCalledTimes(1);
  });

  it('does not fall back to SSR error state on clearing filters if client-side fetches have been performed', async () => {
    // 1. Initialized with SSR error and no filters
    mockSearchParams.toString.mockReturnValue('');
    mockSearchParams.get.mockReturnValue(null);

    const { result, rerender } = renderHook(() =>
      useMentorPool({
        initialMentors: [],
        initialMentorCount: 0,
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
        initialError: true,
      })
    );

    expect(result.current.hasError).toBe(true);
    expect(result.current.mentors).toEqual([]);

    // 2. Simulate client-side query by adding query params
    mockSearchParams.toString.mockReturnValue('q=react');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'react';
      return null;
    });

    const clientFetchedMentors = [
      { ...mockInitialMentors[0], name: 'Client Mentor' },
    ];
    mockFetchMentors.mockResolvedValueOnce(clientFetchedMentors);

    rerender();

    // Settle the mock promise
    await act(async () => {});

    expect(result.current.hasError).toBe(false);
    expect(result.current.mentors[0].name).toBe('Client Mentor');
    expect(mockFetchMentors).toHaveBeenCalledTimes(1);

    // 3. Clear parameters (go back to empty params)
    mockSearchParams.toString.mockReturnValue('');
    mockSearchParams.get.mockReturnValue(null);
    mockFetchMentors.mockClear();

    // Since client fetch was performed, it should NOT early return to SSR error.
    // It should perform a fresh fetch client-side for unfiltered listing!
    mockFetchMentors.mockResolvedValueOnce(mockInitialMentors);

    rerender();

    // Fetching starts
    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasError).toBe(false);

    // Settle the fetch
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
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
      })
    );

    expect(result.current.mentors[0].avatar).toBe(avatarImage);
  });

  it('supports multiple rapid filter changes and triggers fetchMentors for each valid change without concurrent blocking', async () => {
    mockFetchMentors.mockResolvedValue([]);
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'react';
      return null;
    });

    const { result, rerender } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
      })
    );

    expect(result.current.isLoading).toBe(true);

    // 1. Change search params immediately (second unique filter)
    mockSearchParams.toString.mockReturnValue('q=vue');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'vue';
      return null;
    });
    rerender();

    await act(async () => {});

    // Both unique params changes should trigger fetchMentors successfully without being blocked
    expect(mockFetchMentors).toHaveBeenCalledTimes(2);
  });

  it('prevents concurrent loads when fetchMoreMentors is called multiple times rapidly due to preventConcurrent: true', async () => {
    let resolveFetch: (v: MentorType[]) => void = () => {};
    const fetchPromise = new Promise<MentorType[]>((resolve) => {
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
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
      })
    );

    act(() => {
      result.current.handleScrollToBottom();
    });

    act(() => {
      result.current.handleScrollToBottom();
    });

    await act(async () => {
      resolveFetch([
        {
          ...mockInitialMentors[0],
          user_id: 100,
        },
      ]);
    });

    // fetchMentors should ONLY be called once because the second load-more was blocked
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
      .mockResolvedValueOnce(reactMentors)
      .mockResolvedValueOnce(vueMentors);

    const { result, rerender } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialMentorCount: 1,
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
      })
    );

    await act(async () => {});
    expect(result.current.mentors[0].name).toBe('React Mentor');
    expect(mockFetchMentors).toHaveBeenCalledTimes(1);

    // Switch to q=vue
    mockSearchParams.toString.mockReturnValue('q=vue');
    mockSearchParams.get.mockImplementation((key) =>
      key === 'q' ? 'vue' : null
    );
    rerender();
    await act(async () => {});
    expect(result.current.mentors[0].name).toBe('Vue Mentor');
    expect(mockFetchMentors).toHaveBeenCalledTimes(2);

    // Switch back to q=react -> must serve cached state synchronously without a 3rd fetch!
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
    const loadMorePromise = new Promise<MentorType[]>((_, reject) => {
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
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
      })
    );

    // Start loadMore while unfiltered
    let scrollDonePromise!: Promise<void>;
    act(() => {
      scrollDonePromise = result.current.handleScrollToBottom();
    });

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    // Switch filter conditions while loadMore is still in flight
    mockSearchParams.toString.mockReturnValue('q=filtered');
    mockSearchParams.get.mockImplementation((key) =>
      key === 'q' ? 'filtered' : null
    );
    rerender();

    expect(capturedSignal?.aborted).toBe(true);

    // Reject the aborted loadMore promise and verify no error toast is triggered
    await act(async () => {
      rejectLoadMore(new Error('Network cancelled'));
      await scrollDonePromise.catch(() => {});
    });

    expect(mockToast).not.toHaveBeenCalled();
    expect(result.current.mentors[0].name).toBe('Filtered Mentor');
  });

  it('preserves multi-page state accumulated via appendPage when switching between filter conditions and back (#786)', async () => {
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
        params: mockSearchParams as unknown as ReadonlyURLSearchParams,
        labelMap: testLabelMap,
      })
    );

    await act(async () => {});
    expect(result.current.mentors.length).toBe(PAGE_LIMIT);

    // Append page 2 via infinite scroll
    await act(async () => {
      await result.current.handleScrollToBottom();
    });
    expect(result.current.mentors.length).toBe(PAGE_LIMIT + 1);
    expect(result.current.mentorCount).toBe(PAGE_LIMIT + 1);

    // Navigate to q=other
    mockSearchParams.toString.mockReturnValue('q=other');
    mockSearchParams.get.mockImplementation((key) =>
      key === 'q' ? 'other' : null
    );
    rerender();
    await act(async () => {});
    expect(result.current.mentors.length).toBe(1);
    expect(result.current.mentors[0].name).toBe('Other Filter Mentor');
    expect(mockFetchMentors).toHaveBeenCalledTimes(3);

    // Navigate back to q=multi -> all PAGE_LIMIT + 1 mentors and mentorCount are preserved without a 4th fetch
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
        labelMap: testLabelMap,
      })
    );

    await act(async () => {});

    expect(mockFetchMentors).toHaveBeenCalledTimes(1);
    expect(result.current.mentors[0].name).toBe('Initial Mentor');
    expect(result.current.isLoading).toBe(false);
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

    // Should deduplicate, adding only newMentor (user_id 11)
    expect(nextState.mentors).toEqual([sampleMentor, newMentor]);
    expect(nextState.nextCursor).toBe('opaque-next');
    expect(nextState.mentorCount).toBe(2);
    expect(nextState.hasMore).toBe(true);
    expect(nextState.hasError).toBe(false);
  });

});
