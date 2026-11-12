import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/apiClient')>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getUnwrapped: vi.fn(),
    },
  };
});

import { apiClient, ApiError } from '@/lib/apiClient';

import { fetchMentorFeedback, mapMentorFeedbackResponse } from './feedback';

const mockGetUnwrapped = vi.mocked(apiClient.getUnwrapped);

describe('fetchMentorFeedback service (#736 / #760)', () => {
  beforeEach(() => {
    mockGetUnwrapped.mockReset();
  });

  it('calls GET /v1/mentors/{user_id}/feedback with page=1 and maps #760 response fields', async () => {
    mockGetUnwrapped.mockResolvedValueOnce({
      total_rating_count: 12,
      rating_average: 8.5,
      completed_meeting_count: 128,
      page: 1,
      page_size: 10,
      feedbacks: [
        {
          id: 901,
          author_name: '陳**',
          rating: 9,
          content: '分享了很具體的建議，也幫助我釐清下一步的方向。',
          created_at: '2026-10-28T10:00:00Z',
        },
      ],
    });

    const result = await fetchMentorFeedback({ mentorId: 777, page: 1 });

    expect(mockGetUnwrapped).toHaveBeenCalledWith('/v1/mentors/777/feedback', {
      auth: false,
      params: { page: 1 },
      signal: undefined,
    });
    expect(result).toEqual({
      items: [
        {
          id: '901',
          authorName: '陳**',
          rating: 9,
          content: '分享了很具體的建議，也幫助我釐清下一步的方向。',
          createdAt: '2026-10-28T10:00:00Z',
        },
      ],
      totalRatingCount: 12,
      page: 1,
      pageSize: 10,
      ratingAverage: 8.5,
      completedMeetingCount: 128,
    });
  });

  it('supports legacy/compatible response keys (total, items, author_masked_name) and forwards custom page_size', async () => {
    mockGetUnwrapped.mockResolvedValueOnce({
      total: 2,
      page: 2,
      page_size: 5,
      items: [
        {
          reservation_id: 55,
          author_masked_name: '林**',
          rating: 8,
          content: '從作品集的架構到研究故事都很實用。',
          created_at: 1793100000,
        },
      ],
    });

    const result = await fetchMentorFeedback({
      mentorId: 888,
      page: 2,
      pageSize: 5,
    });

    expect(mockGetUnwrapped).toHaveBeenCalledWith('/v1/mentors/888/feedback', {
      auth: false,
      params: { page: 2, page_size: 5 },
      signal: undefined,
    });
    expect(result.totalRatingCount).toBe(2);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(5);
    expect(result.items[0]).toMatchObject({
      id: '55',
      authorName: '林**',
      rating: 8,
    });
  });

  it('gracefully falls back to empty state on 404 or null payload when backend route is not yet deployed', async () => {
    mockGetUnwrapped.mockRejectedValueOnce(new ApiError(404, 'Not Found'));

    const fallback404 = await fetchMentorFeedback({ mentorId: 999, page: 1 });
    expect(fallback404).toEqual({
      items: [],
      totalRatingCount: 0,
      page: 1,
      pageSize: 10,
      ratingAverage: null,
      completedMeetingCount: null,
      isFallbackEmpty: true,
    });

    expect(mapMentorFeedbackResponse(null, 1, 10).isFallbackEmpty).toBe(true);
  });

  it('rethrows non-404 API errors so hook can surface retryable error UI', async () => {
    mockGetUnwrapped.mockRejectedValueOnce(
      new ApiError(500, 'Internal Server Error')
    );

    await expect(
      fetchMentorFeedback({ mentorId: 999, page: 1 })
    ).rejects.toThrow('Internal Server Error');
  });
});
