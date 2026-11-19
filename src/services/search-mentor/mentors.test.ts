import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/apiClient';
import type { components } from '@/types/api';
import type { MentorListWireResponse, MentorRequest } from '@/types/mentor';

import {
  fetchMentors,
  fetchMentorsServer,
  MENTOR_POOL_CACHE_TAG,
} from './mentors';

const { mockBaseUrl } = vi.hoisted(() => ({
  mockBaseUrl: { value: 'https://api.example.com' },
}));

vi.mock('@/lib/apiClient', () => ({
  get BASE_URL() {
    return mockBaseUrl.value;
  },
  apiClient: {
    getUnwrapped: vi.fn(),
  },
}));

const mockGetUnwrapped = vi.mocked(apiClient.getUnwrapped);

describe('fetchMentors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBaseUrl.value = 'https://api.example.com';
  });

  it('calls apiClient.getUnwrapped with canonical snake_case params and signal and maps mentors with nextCursor', async () => {
    mockGetUnwrapped.mockResolvedValueOnce(
      fromPartial<MentorListWireResponse>({
        mentors: [
          {
            user_id: 1,
            name: 'Alice Smith',
            job_title: 'Product Manager',
            company: 'Google',
          },
          {
            user_id: 2,
            name: 'Bob Chen',
            job_title: 'Frontend Engineer',
            company: 'Meta',
          },
        ],
        next_cursor: 'opaque-cursor-1',
      })
    );

    const controller = new AbortController();
    const params: MentorRequest = {
      limit: 9,
      search_pattern: '  frontend  ',
      filter_skills: 'skill_ts, skill_react',
      cursor: 'prev-cursor',
    };

    const result = await fetchMentors(params, controller.signal);

    expect(mockGetUnwrapped).toHaveBeenCalledWith('/v1/mentors', {
      auth: false,
      params: {
        limit: 9,
        search_pattern: 'frontend',
        filter_skills: 'skill_react,skill_ts',
        cursor: 'prev-cursor',
      },
      signal: controller.signal,
    });
    expect(result.mentors).toHaveLength(2);
    expect(result.mentors[0].user_id).toBe(1);
    expect(result.mentors[0].name).toBe('Alice Smith');
    expect(result.mentors[0].job_title).toBe('Product Manager');
    expect(result.mentors[0].company).toBe('Google');
    expect(result.mentors[1].user_id).toBe(2);
    expect(result.mentors[1].name).toBe('Bob Chen');
    expect(result.nextCursor).toBe('opaque-cursor-1');
  });

  it('normalizes omitted or empty next_cursor and missing mentors to empty MentorPage', async () => {
    mockGetUnwrapped.mockResolvedValueOnce(
      fromPartial<MentorListWireResponse>({
        mentors: undefined,
        next_cursor: '',
      })
    );

    const result = await fetchMentors({ limit: 9 });

    expect(result).toEqual({
      mentors: [],
      nextCursor: null,
    });
  });
});

describe('fetchMentorsServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBaseUrl.value = 'https://api.example.com';
  });

  it('returns an empty page and does not fetch if BASE_URL is empty', async () => {
    mockBaseUrl.value = '';
    const params = fromPartial<MentorRequest>({ limit: 10 });

    const result = await fetchMentorsServer(params);

    expect(result).toEqual({ mentors: [], nextCursor: null });
    expect(mockGetUnwrapped).not.toHaveBeenCalled();
  });

  it('fetches mentors successfully via shared canonical request builder and maps them', async () => {
    const rawResponse = fromPartial<MentorListWireResponse>({
      mentors: [
        fromPartial<components['schemas']['SearchMentorProfileVO']>({
          user_id: 1,
          name: 'Alice Smith',
          job_title: 'Product Manager',
          company: 'Google',
        }),
      ],
      next_cursor: 'opaque-cursor-2',
    });

    mockGetUnwrapped.mockResolvedValue(rawResponse);

    const params = fromPartial<MentorRequest>({ limit: 10 });
    const result = await fetchMentorsServer(params);

    expect(mockGetUnwrapped).toHaveBeenCalledWith(
      '/v1/mentors',
      expect.objectContaining({
        auth: false,
        params: {
          search_pattern: '',
          limit: 10,
        },
      })
    );
    expect(result.mentors).toHaveLength(1);
    expect(result.mentors[0].user_id).toBe(1);
    expect(result.mentors[0].name).toBe('Alice Smith');
    expect(result.mentors[0].job_title).toBe('Product Manager');
    expect(result.mentors[0].company).toBe('Google');
    expect(result.nextCursor).toBe('opaque-cursor-2');
  });

  it('defaults nextCursor to null when next_cursor is omitted in wire response', async () => {
    const rawResponse = fromPartial<
      components['schemas']['SearchMentorProfileListVO']
    >({
      mentors: [],
    });

    mockGetUnwrapped.mockResolvedValue(rawResponse);

    const params = fromPartial<MentorRequest>({ limit: 10 });
    const result = await fetchMentorsServer(params);

    expect(result).toEqual({ mentors: [], nextCursor: null });
  });

  it('handles null/undefined response from apiClient.getUnwrapped gracefully', async () => {
    mockGetUnwrapped.mockResolvedValue(undefined);

    const params = fromPartial<MentorRequest>({ limit: 10 });
    const result = await fetchMentorsServer(params);

    expect(result).toEqual({ mentors: [], nextCursor: null });
  });

  it('propagates API errors to the caller', async () => {
    const error = new Error('API failed');
    mockGetUnwrapped.mockRejectedValue(error);

    const params = fromPartial<MentorRequest>({ limit: 10 });

    await expect(fetchMentorsServer(params)).rejects.toThrow('API failed');
  });

  describe('cache behavior configuration', () => {
    it('uses next revalidate cache configuration when query is unfiltered (including whitespace-only search_pattern)', async () => {
      mockGetUnwrapped.mockResolvedValue(fromPartial({ mentors: [] }));

      const params = fromPartial<MentorRequest>({
        search_pattern: '   ',
        limit: 10,
      });
      await fetchMentorsServer(params);

      expect(MENTOR_POOL_CACHE_TAG).toBe('mentor-pool');
      expect(mockGetUnwrapped).toHaveBeenCalledWith(
        '/v1/mentors',
        expect.objectContaining({
          next: { revalidate: 86400, tags: ['mentor-pool'] },
        })
      );
      expect(mockGetUnwrapped).toHaveBeenCalledWith(
        '/v1/mentors',
        expect.not.objectContaining({
          cache: 'no-store',
        })
      );
    });

    it('uses no-store cache configuration when search_pattern condition is present', async () => {
      mockGetUnwrapped.mockResolvedValue(fromPartial({ mentors: [] }));

      const params = fromPartial<MentorRequest>({
        search_pattern: 'John',
        limit: 10,
      });
      await fetchMentorsServer(params);

      expect(mockGetUnwrapped).toHaveBeenCalledWith(
        '/v1/mentors',
        expect.objectContaining({
          cache: 'no-store',
        })
      );
      expect(mockGetUnwrapped).toHaveBeenCalledWith(
        '/v1/mentors',
        expect.not.objectContaining({
          next: expect.anything(),
        })
      );
    });

    it('uses no-store cache configuration when filter_skills, filter_topics, filter_industries, sort_by, or cursor is present (#930)', async () => {
      mockGetUnwrapped.mockResolvedValue(fromPartial({ mentors: [] }));

      const conditionedCases: MentorRequest[] = [
        { filter_skills: 'react', limit: 10 },
        { filter_topics: 'career', limit: 10 },
        { filter_industries: 'tech', limit: 10 },
        { sort_by: 'popularity', limit: 10 },
        { sort_by: 'recent', limit: 10 },
        { cursor: 'opaque-cursor-2', limit: 10 },
      ];

      for (const req of conditionedCases) {
        mockGetUnwrapped.mockClear();
        await fetchMentorsServer(req);
        expect(mockGetUnwrapped).toHaveBeenCalledWith(
          '/v1/mentors',
          expect.objectContaining({
            cache: 'no-store',
          })
        );
        expect(mockGetUnwrapped).toHaveBeenCalledWith(
          '/v1/mentors',
          expect.not.objectContaining({
            next: expect.anything(),
          })
        );
      }
    });
  });
});
