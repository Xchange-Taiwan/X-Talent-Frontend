import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/profile/feedback', async () => {
  const actual = await vi.importActual<
    typeof import('@/services/profile/feedback')
  >('@/services/profile/feedback');
  return {
    ...actual,
    fetchMentorFeedback: vi.fn(),
  };
});

import { fetchMentorFeedback } from '@/services/profile/feedback';
import type { MentorFeedbackPage } from '@/types/feedback';

import { useMentorFeedback } from './useMentorFeedback';

const mockFetchMentorFeedback = vi.mocked(fetchMentorFeedback);

function makePage(page: number, totalRatingCount = 12): MentorFeedbackPage {
  return {
    items: [
      {
        id: `item-${page}-1`,
        authorName: page === 1 ? '陳**' : '黃**',
        authorInitial: page === 1 ? '陳' : '黃',
        rating: 9,
        content: `Page ${page} content`,
        createdAt: '2026-10-28',
        formattedDate: '2026/10/28',
      },
    ],
    totalRatingCount,
    page,
    pageSize: 10,
    totalPages: 2,
    ratingAverage: 8.5,
    completedMeetingCount: 128,
    isFallback: false,
  };
}

describe('useMentorFeedback (#736)', () => {
  beforeEach(() => {
    mockFetchMentorFeedback.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not fetch when enabled is false (e.g. mentee profile)', () => {
    const { result } = renderHook(() =>
      useMentorFeedback({ userId: 101, enabled: false })
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.items).toEqual([]);
    expect(mockFetchMentorFeedback).not.toHaveBeenCalled();
  });

  it('fetches page 1 on mount, paginates to page 2, and reuses cached page 1 without refetching', async () => {
    mockFetchMentorFeedback
      .mockResolvedValueOnce(makePage(1))
      .mockResolvedValueOnce(makePage(2));

    const { result } = renderHook(() =>
      useMentorFeedback({ userId: 101, enabled: true })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items[0]?.authorName).toBe('陳**');
    expect(result.current.totalPages).toBe(2);
    expect(mockFetchMentorFeedback).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setPage(2);
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.page).toBe(2);
    expect(result.current.items[0]?.authorName).toBe('黃**');
    expect(mockFetchMentorFeedback).toHaveBeenCalledTimes(2);

    // Returning to page 1 serves from cache without another network request
    act(() => {
      result.current.setPage(1);
    });

    expect(result.current.page).toBe(1);
    expect(result.current.items[0]?.authorName).toBe('陳**');
    expect(mockFetchMentorFeedback).toHaveBeenCalledTimes(2);
  });

  it('sets hasError on failure and recovers when retry() is called', async () => {
    mockFetchMentorFeedback
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce(makePage(1));

    const { result } = renderHook(() =>
      useMentorFeedback({ userId: 202, enabled: true })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasError).toBe(true);

    act(() => {
      result.current.retry();
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasError).toBe(false);
    expect(result.current.items[0]?.authorName).toBe('陳**');
  });

  it('transitions synchronously to loading when enabled flips true and clears page-2 error when returning to cached page 1', async () => {
    mockFetchMentorFeedback
      .mockResolvedValueOnce(makePage(1))
      .mockRejectedValueOnce(new Error('Page 2 timeout'));

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useMentorFeedback({ userId: 303, enabled }),
      { initialProps: { enabled: false } }
    );

    expect(result.current.isLoading).toBe(false);

    rerender({ enabled: true });
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items[0]?.authorName).toBe('陳**');

    act(() => {
      result.current.setPage(2);
    });
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasError).toBe(true);

    act(() => {
      result.current.setPage(1);
    });
    expect(result.current.hasError).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.items[0]?.authorName).toBe('陳**');
  });

  it('resets state immediately when userId changes and clears stale items when page 2 fails', async () => {
    mockFetchMentorFeedback
      .mockResolvedValueOnce(makePage(1))
      .mockRejectedValueOnce(new Error('Page 2 error'))
      .mockResolvedValueOnce({
        items: [],
        totalRatingCount: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
        ratingAverage: null,
        completedMeetingCount: 0,
        isFallback: false,
      });

    const { result, rerender } = renderHook(
      ({ userId }) => useMentorFeedback({ userId, enabled: true }),
      { initialProps: { userId: 101 } }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.totalRatingCount).toBe(12);

    // Paginate to page 2 -> fails: items cleared so error UI shows, summary counts preserved
    act(() => {
      result.current.setPage(2);
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasError).toBe(true);
    expect(result.current.items).toEqual([]);
    expect(result.current.totalRatingCount).toBe(12);

    // Switch to another mentor -> stale counts & items reset immediately
    rerender({ userId: 303 });
    expect(result.current.totalRatingCount).toBe(0);
    expect(result.current.items).toEqual([]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasError).toBe(false);
    expect(result.current.totalRatingCount).toBe(0);
  });
});
