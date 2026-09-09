import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/apiClient';
import type { components } from '@/types/api';
import type { MentorRequest } from '@/types/mentor';

import { fetchMentorsServer } from './mentors.server';

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

describe('fetchMentorsServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBaseUrl.value = 'https://api.example.com';
  });

  it('returns empty array and does not fetch if BASE_URL is empty', async () => {
    mockBaseUrl.value = '';
    const params = fromPartial<MentorRequest>({ limit: 10 });

    const result = await fetchMentorsServer(params);

    expect(result).toEqual([]);
    expect(mockGetUnwrapped).not.toHaveBeenCalled();
  });

  it('fetches mentors successfully and maps them', async () => {
    const rawResponse = fromPartial<
      components['schemas']['SearchMentorProfileListVO']
    >({
      mentors: [
        fromPartial<components['schemas']['SearchMentorProfileVO']>({
          user_id: 1,
          name: 'Alice Smith',
          job_title: 'Product Manager',
          company: 'Google',
        }),
      ],
    });

    mockGetUnwrapped.mockResolvedValue(rawResponse);

    const params = fromPartial<MentorRequest>({ limit: 10 });
    const result = await fetchMentorsServer(params);

    expect(mockGetUnwrapped).toHaveBeenCalledWith(
      '/v1/mentors',
      expect.objectContaining({
        params,
      })
    );
    expect(result).toHaveLength(1);
    expect(result[0].user_id).toBe(1);
    expect(result[0].name).toBe('Alice Smith');
    expect(result[0].job_title).toBe('Product Manager');
    expect(result[0].company).toBe('Google');
  });

  it('handles null/undefined response from apiClient.getUnwrapped gracefully', async () => {
    mockGetUnwrapped.mockResolvedValue(undefined);

    const params = fromPartial<MentorRequest>({ limit: 10 });
    const result = await fetchMentorsServer(params);

    expect(result).toEqual([]);
  });

  it('propagates API errors to the caller', async () => {
    const error = new Error('API failed');
    mockGetUnwrapped.mockRejectedValue(error);

    const params = fromPartial<MentorRequest>({ limit: 10 });

    await expect(fetchMentorsServer(params)).rejects.toThrow('API failed');
  });

  describe('cache behavior configuration', () => {
    it('uses next revalidate cache configuration when there are no query conditions', async () => {
      mockGetUnwrapped.mockResolvedValue(fromPartial({ mentors: [] }));

      const params = fromPartial<MentorRequest>({ limit: 10 });
      await fetchMentorsServer(params);

      expect(mockGetUnwrapped).toHaveBeenCalledWith(
        '/v1/mentors',
        expect.objectContaining({
          next: { revalidate: 86400 },
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

    it('uses no-store cache configuration when filter_skills condition is present', async () => {
      mockGetUnwrapped.mockResolvedValue(fromPartial({ mentors: [] }));

      const params = fromPartial<MentorRequest>({
        filter_skills: 'react',
        limit: 10,
      });
      await fetchMentorsServer(params);

      expect(mockGetUnwrapped).toHaveBeenCalledWith(
        '/v1/mentors',
        expect.objectContaining({
          cache: 'no-store',
        })
      );
    });

    it('uses no-store cache configuration when filter_topics condition is present', async () => {
      mockGetUnwrapped.mockResolvedValue(fromPartial({ mentors: [] }));

      const params = fromPartial<MentorRequest>({
        filter_topics: 'career',
        limit: 10,
      });
      await fetchMentorsServer(params);

      expect(mockGetUnwrapped).toHaveBeenCalledWith(
        '/v1/mentors',
        expect.objectContaining({
          cache: 'no-store',
        })
      );
    });

    it('uses no-store cache configuration when filter_industries condition is present', async () => {
      mockGetUnwrapped.mockResolvedValue(fromPartial({ mentors: [] }));

      const params = fromPartial<MentorRequest>({
        filter_industries: 'tech',
        limit: 10,
      });
      await fetchMentorsServer(params);

      expect(mockGetUnwrapped).toHaveBeenCalledWith(
        '/v1/mentors',
        expect.objectContaining({
          cache: 'no-store',
        })
      );
    });
  });
});
