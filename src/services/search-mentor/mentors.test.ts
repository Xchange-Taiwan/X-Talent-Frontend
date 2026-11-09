import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/apiClient';
import type { MentorListWireResponse, MentorRequest } from '@/types/mentor';

import { fetchMentors } from './mentors';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    getUnwrapped: vi.fn(),
  },
}));

describe('fetchMentors', () => {
  const mockGetUnwrapped = vi.mocked(apiClient.getUnwrapped);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls apiClient.getUnwrapped with params and signal and maps mentors with nextCursor', async () => {
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
      search_pattern: 'frontend',
      cursor: 'prev-cursor',
    };

    const result = await fetchMentors(params, controller.signal);

    expect(mockGetUnwrapped).toHaveBeenCalledWith('/v1/mentors', {
      auth: false,
      params,
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
