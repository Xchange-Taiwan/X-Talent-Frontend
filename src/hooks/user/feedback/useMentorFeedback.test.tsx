import { act, renderHook, waitFor } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
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
import {
  fetchMentorFeedback,
  mapMentorFeedbackResponse,
} from '@/services/profile/feedback';
import type { MentorFeedbackPage } from '@/types/feedback';

import { useMentorFeedback } from './useMentorFeedback';

const mockFetchMentorFeedback = vi.mocked(fetchMentorFeedback);

function makePage(
  overrides: Partial<MentorFeedbackPage> = {}
): MentorFeedbackPage {
  const base = mapMentorFeedbackResponse(
    fromPartial({
      total_rating_count: 12,
      page: 1,
      page_size: 10,
      rating_average: 9.0,
      completed_meeting_count: 20,
      feedbacks: [
        {
          id: '2',
          author_name: '林**',
          rating: 10,
          content: '非常推薦',
          created_at: '2026-10-27T10:00:00Z',
        },
        {
          id: '1',
          author_name: '陳**',
          rating: 8,
          content: '收穫滿滿',
          created_at: '2026-10-28T10:00:00Z',
        },
      ],
    })
  );
  return {
    ...base,
    ...overrides,
  };
}

describe('useMentorFeedback hook (#736 / #888 / #934)', () => {
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

  it('retains previous-page items & summary while page 2 is in flight without peeking page 1, and serves cached page 1 on back-pagination (#934)', async () => {
    let resolvePage2: ((value: MentorFeedbackPage) => void) | undefined;
    const peekSpy = vi.spyOn(mentorFeedbackReadModel, 'peek');

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

    // Initial page 1 load starts with empty items so skeleton can render
    expect(result.current.isLoading).toBe(true);
    expect(result.current.items).toEqual([]);
    expect(result.current.hasLoaded).toBe(false);

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

    peekSpy.mockClear();

    await act(async () => {
      result.current.setPage(2);
    });

    // Neither useMentorFeedback nor useAsyncRead peeks page 1 during page 2 transition
    expect(peekSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 })
    );

    // Both previous-page items and mentor summary remain steady while page 2 is in flight
    expect(result.current.isLoading).toBe(true);
    expect(result.current.page).toBe(2);
    expect(result.current.hasLoaded).toBe(true);
    expect(result.current.items.map((i) => i.authorName)).toEqual([
      '陳**',
      '林**',
    ]);
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

    peekSpy.mockRestore();
  });

  it('resets to empty initial loading state when switching to a different uncached mentorId (#934)', async () => {
    mockFetchMentorFeedback
      .mockResolvedValueOnce(makePage())
      .mockImplementationOnce(() => new Promise<MentorFeedbackPage>(() => {}));

    const { result, rerender } = renderHook(
      ({ mentorId }: { mentorId: number }) =>
        useMentorFeedback({ mentorId, enabled: true }),
      { initialProps: { mentorId: 101 } }
    );

    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(result.current.items).toHaveLength(2);

    rerender({ mentorId: 202 });

    expect(result.current.page).toBe(1);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasLoaded).toBe(false);
    expect(result.current.items).toEqual([]);
    expect(result.current.totalRatingCount).toBeNull();
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
