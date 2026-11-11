import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/apiClient', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/apiClient')>('@/lib/apiClient');
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getUnwrapped: vi.fn(),
    },
  };
});

import { apiClient, ApiError } from '@/lib/apiClient';

import {
  extractAuthorInitial,
  fetchMentorFeedback,
  formatFeedbackDate,
  mapMentorFeedbackPage,
} from './feedback';

const mockGetUnwrapped = vi.mocked(apiClient.getUnwrapped);

describe('mentor feedback service (#736)', () => {
  beforeEach(() => {
    mockGetUnwrapped.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats dates consistently to YYYY/MM/DD in Asia/Taipei and handles invalid values', () => {
    expect(formatFeedbackDate('2026-10-28')).toBe('2026/10/28');
    expect(formatFeedbackDate('2026/1/5')).toBe('2026/01/05');
    expect(formatFeedbackDate('2026-10-28T10:30:00Z')).toBe('2026/10/28');
    // 2026-10-27T20:00:00Z is 2026-10-28 04:00:00 in Asia/Taipei
    expect(formatFeedbackDate('2026-10-27T20:00:00Z')).toBe('2026/10/28');
    expect(formatFeedbackDate(null)).toBe('');
    expect(formatFeedbackDate('')).toBe('');
    expect(formatFeedbackDate('not-a-date')).toBe('');
  });

  it('extracts clean author initial and falls back to 匿 when empty or masked-only', () => {
    expect(extractAuthorInitial('陳**')).toBe('陳');
    expect(extractAuthorInitial('Alice')).toBe('A');
    expect(extractAuthorInitial('***')).toBe('匿');
    expect(extractAuthorInitial('  ***  ')).toBe('匿');
    expect(extractAuthorInitial('   ')).toBe('匿');
  });

  it('maps total_rating_count (and legacy total), sorts reviews newest-first, and computes totalPages', () => {
    const mapped = mapMentorFeedbackPage(
      {
        total_rating_count: 12,
        page: 1,
        page_size: 10,
        rating_average: 8.5,
        completed_meeting_count: 128,
        items: [
          {
            id: 2,
            author_name: '林**',
            rating: 8,
            content: '實際可執行的建議',
            created_at: '2026-10-27T12:00:00Z',
          },
          {
            id: 1,
            author_name: '陳**',
            rating: 9,
            content: '分享了很具體的建議',
            created_at: '2026-10-28T12:00:00Z',
          },
          {
            id: 3,
            author_name: '',
            rating: 9,
            content: null,
            created_at: '2026-10-26T12:00:00Z',
          },
        ],
      },
      1
    );

    expect(mapped.isFallback).toBe(false);
    expect(mapped.totalRatingCount).toBe(12);
    expect(mapped.page).toBe(1);
    expect(mapped.pageSize).toBe(10);
    expect(mapped.totalPages).toBe(2);
    expect(mapped.ratingAverage).toBe(8.5);
    expect(mapped.completedMeetingCount).toBe(128);
    expect(mapped.items.map((i) => i.authorName)).toEqual([
      '陳**',
      '林**',
      '匿名學員',
    ]);
    expect(mapped.items[0].formattedDate).toBe('2026/10/28');
    expect(mapped.items[2].authorInitial).toBe('匿');
    expect(mapped.items[2].content).toBe('');
  });

  it('supports legacy total and feedbacks array alias', () => {
    const mapped = mapMentorFeedbackPage({
      total: 2,
      page: 1,
      page_size: 10,
      feedbacks: [
        {
          author_name: '王**',
          rating: 10,
          content: '收穫良多',
          created_at: '2026-10-25',
        },
        {
          author_name: '李**',
          rating: 8,
          content: '很推薦',
          created_at: '2026-10-26',
        },
      ],
    });

    expect(mapped.totalRatingCount).toBe(2);
    expect(mapped.totalPages).toBe(1);
    expect(mapped.ratingAverage).toBe(9);
    expect(mapped.items.map((i) => i.authorName)).toEqual(['李**', '王**']);
  });

  it('treats null, undefined, or unrecognized payloads as fallback empty pages without crashing', () => {
    expect(mapMentorFeedbackPage(null, 1)).toMatchObject({
      items: [],
      totalRatingCount: 0,
      isFallback: true,
    });
    expect(mapMentorFeedbackPage({ mentors: [] }, 1)).toMatchObject({
      items: [],
      totalRatingCount: 0,
      isFallback: true,
    });
  });

  it('calls GET /v1/mentors/{user_id}/feedback?page=N with auth:false and falls back gracefully on 404', async () => {
    mockGetUnwrapped.mockRejectedValueOnce(
      new ApiError(404, 'Not Found', '404')
    );

    const fallback = await fetchMentorFeedback(777, 2);

    expect(mockGetUnwrapped).toHaveBeenCalledWith('/v1/mentors/777/feedback', {
      auth: false,
      params: { page: 2 },
      signal: undefined,
    });
    expect(fallback).toEqual({
      items: [],
      totalRatingCount: 0,
      page: 2,
      pageSize: 10,
      totalPages: 0,
      ratingAverage: null,
      completedMeetingCount: null,
      isFallback: true,
    });
  });

  it('rethrows non-404 API errors so hook-level retry UI can handle server failures', async () => {
    mockGetUnwrapped.mockRejectedValueOnce(
      new ApiError(500, 'Internal Error', '500')
    );

    await expect(fetchMentorFeedback(777, 1)).rejects.toThrow('Internal Error');
  });

  it('returns fallback empty page without calling API when userId is invalid or non-positive', async () => {
    const nanFallback = await fetchMentorFeedback(Number.NaN, 1);
    const zeroFallback = await fetchMentorFeedback(0, 1);

    expect(mockGetUnwrapped).not.toHaveBeenCalled();
    expect(nanFallback.isFallback).toBe(true);
    expect(zeroFallback.isFallback).toBe(true);
  });
});
