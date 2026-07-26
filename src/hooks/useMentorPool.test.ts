import { act, renderHook } from '@testing-library/react';
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

import {
  fetchMentors,
  type MentorType,
} from '@/services/search-mentor/mentors';
import { mockSearchParams } from '@/test/mocks/navigation';
import { mockToast } from '@/test/mocks/useToast';

import { useMentorPool } from './useMentorPool';

const mockFetchMentors = vi.mocked(fetchMentors);

const mockInitialMentors: MentorType[] = [
  {
    user_id: 1,
    name: 'Initial Mentor',
    avatar: '',
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
    have_skill: [],
    have_topic: [],
    updated_at: 100,
  },
];

describe('useMentorPool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.toString.mockReturnValue('');
    mockSearchParams.get.mockReturnValue(null);
  });

  it('initializes with raw initial mentors when no filters are present', () => {
    const { result } = renderHook(() =>
      useMentorPool({
        initialMentors: mockInitialMentors,
        initialCursor: '100',
        initialMentorCount: 1,
      })
    );

    expect(result.current.mentors).toEqual(mockInitialMentors);
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
        avatar: '',
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
        have_topic: [],
        updated_at: 200,
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
        initialCursor: '100',
        initialMentorCount: 1,
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
    expect(result.current.mentors).toEqual(fetchedMentors);
    expect(result.current.mentorCount).toBe(1);
  });

  it('handles API errors gracefully inside fetchMentors catch block', async () => {
    mockSearchParams.toString.mockReturnValue('q=react');
    mockSearchParams.get.mockImplementation((key) => {
      if (key === 'q') return 'react';
      return null;
    });

    let rejectFetch!: (reason: any) => void;
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
        initialCursor: '100',
        initialMentorCount: 1,
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
    });

    spyConsoleError.mockRestore();
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
        initialCursor: '100',
        initialMentorCount: 1,
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

    expect(result.current.mentors).toEqual(latestMentors);
  });
});
