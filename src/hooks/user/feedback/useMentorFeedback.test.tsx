import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/profile/feedback', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/profile/feedback')>();
  return {
    ...actual,
    fetchMentorFeedback: vi.fn(),
  };
});

import { mentorFeedbackReadModel } from '@/lib/feedback/mentorFeedbackReadModel';
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

describe('useMentorFeedback hook (#736 / #888)', () => {
  beforeEach(() => {
    mockFetchMentorFeedback.mockReset();
    mentorFeedbackReadModel.clear();
  });

  it('does not fetch when enabled is false (e.g. mentee profile)', () => {
    const { result } = renderHook(() =>
      useMentorFeedback({ mentorId: 101, enabled: false })
    );

    expect(mockFetchMentorFeedback).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.items).toEqual([]);
  });

  it('fetches page 1 on mount, sorts items newest-first once via mentorFeedbackReadModel, and serves cached page 1 on back-pagination without refetching', async () => {
    let resolvePage2: ((value: MentorFeedbackPage) => void) | undefined;
    mockFetchMentorFeedback
      .mockResolvedValueOnce(makePage())
      .mockImplementationOnce(
        () =>
          new Promise<MentorFeedbackPage>((resolve) => {
            resolvePage2 = resolve;
          })
      );

    const { result } = renderHook(() =>
      useMentorFeedback({ mentorId: 101, enabled: true })
    );

    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(mockFetchMentorFeedback).toHaveBeenCalledTimes(1);
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

    // Summary stats remain steady from cached page 1 while page 2 is loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasLoaded).toBe(true);
    expect(result.current.totalRatingCount).toBe(12);
    expect(result.current.ratingAverage).toBe(9.0);
    expect(result.current.completedMeetingCount).toBe(20);

    await act(async () => {
      resolvePage2?.(
        makePage({
          page: 2,
          items: [
            {
              id: '3',
              authorName: '張**',
              rating: 9,
              content: '第二頁評論',
              createdAt: '2026-10-20T10:00:00Z',
            },
          ],
        })
      );
    });

    await waitFor(() =>
      expect(mockFetchMentorFeedback).toHaveBeenCalledWith({
        mentorId: 101,
        page: 2,
        pageSize: 10,
        signal: expect.any(AbortSignal),
      })
    );
    expect(mockFetchMentorFeedback).toHaveBeenCalledTimes(2);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.items[0]?.content).toBe('第二頁評論');

    // Navigating back to page 1 hits mentorFeedbackReadModel cache synchronously
    await act(async () => {
      result.current.setPage(1);
    });
    expect(mockFetchMentorFeedback).toHaveBeenCalledTimes(2);
    expect(result.current.items.map((i) => i.authorName)).toEqual([
      '陳**',
      '林**',
    ]);
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

  it('reloads automatically when mentorFeedbackReadModel.invalidateMentor is emitted for the active mentor (#731 / #888)', async () => {
    mockFetchMentorFeedback.mockResolvedValueOnce(makePage());

    const { result } = renderHook(() =>
      useMentorFeedback({ mentorId: 101, enabled: true })
    );

    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(mockFetchMentorFeedback).toHaveBeenCalledTimes(1);

    // Unrelated mentor id should not trigger refetch
    await act(async () => {
      mentorFeedbackReadModel.invalidateMentor(999);
    });
    expect(mockFetchMentorFeedback).toHaveBeenCalledTimes(1);

    mockFetchMentorFeedback.mockResolvedValueOnce(
      makePage({
        items: [
          {
            id: '1',
            authorName: '陳**',
            rating: 10,
            content: '編輯後的評論內容',
            createdAt: '2026-10-28T10:00:00Z',
          },
        ],
        ratingAverage: 10,
      })
    );

    await act(async () => {
      mentorFeedbackReadModel.invalidateMentor(101);
    });

    await waitFor(() =>
      expect(mockFetchMentorFeedback).toHaveBeenCalledTimes(2)
    );
    expect(result.current.items[0]?.content).toBe('編輯後的評論內容');
  });
});
