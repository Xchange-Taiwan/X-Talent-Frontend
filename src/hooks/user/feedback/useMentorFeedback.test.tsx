import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/profile/feedback', () => ({
  fetchMentorFeedback: vi.fn(),
}));

import { fetchMentorFeedback } from '@/services/profile/feedback';
import type { MentorFeedbackPage } from '@/types/feedback';

import { useMentorFeedback } from './useMentorFeedback';

const mockFetchMentorFeedback = vi.mocked(fetchMentorFeedback);

function makePage(
  overrides: Partial<MentorFeedbackPage> = {}
): MentorFeedbackPage {
  return {
    items: [
      {
        id: '2',
        authorName: '林**',
        rating: 10,
        content: '非常推薦',
        createdAt: '2026-10-27T10:00:00Z',
      },
      {
        id: '1',
        authorName: '陳**',
        rating: 8,
        content: '收穫滿滿',
        createdAt: '2026-10-28T10:00:00Z',
      },
    ],
    totalRatingCount: 12,
    page: 1,
    pageSize: 10,
    ratingAverage: 9.0,
    completedMeetingCount: 20,
    ...overrides,
  };
}

describe('useMentorFeedback hook (#736)', () => {
  beforeEach(() => {
    mockFetchMentorFeedback.mockReset();
  });

  it('does not fetch when enabled is false (e.g. mentee profile)', () => {
    const { result } = renderHook(() =>
      useMentorFeedback({ mentorId: 101, enabled: false })
    );

    expect(mockFetchMentorFeedback).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.items).toEqual([]);
  });

  it('fetches page 1 on mount, sorts items newest-first by createdAt, and supports pagination', async () => {
    mockFetchMentorFeedback.mockResolvedValue(makePage());

    const { result } = renderHook(() =>
      useMentorFeedback({ mentorId: 101, enabled: true })
    );

    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(mockFetchMentorFeedback).toHaveBeenCalledWith({
      mentorId: 101,
      page: 1,
      pageSize: 10,
      signal: expect.any(AbortSignal),
    });
    expect(result.current.items.map((i) => i.authorName)).toEqual([
      '陳**',
      '林**',
    ]);

    await act(async () => {
      result.current.setPage(2);
    });

    await waitFor(() =>
      expect(mockFetchMentorFeedback).toHaveBeenCalledWith({
        mentorId: 101,
        page: 2,
        pageSize: 10,
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('surfaces error message on failure and recovers via reload()', async () => {
    mockFetchMentorFeedback.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() =>
      useMentorFeedback({ mentorId: 101, enabled: true })
    );

    await waitFor(() =>
      expect(result.current.error).toBe('載入評價時發生錯誤，請稍後再試。')
    );

    mockFetchMentorFeedback.mockResolvedValueOnce(makePage());

    await act(async () => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.totalRatingCount).toBe(12);
  });
});
