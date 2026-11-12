import { act, renderHook, waitFor } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUsePathname = vi.fn<() => string | null>(() => '/mentor-pool');
const mockUseSearchParams = vi.fn(() => new URLSearchParams());

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}));

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

vi.mock('@/services/reservations', () => ({
  fetchPendingFeedbackReservations: vi.fn(),
  submitReservationFeedback: vi.fn(),
}));

vi.mock('@/hooks/user/user-data/userProfileDtoCache', () => ({
  clearUserProfileDtoCache: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

import { clearUserProfileDtoCache } from '@/hooks/user/user-data/userProfileDtoCache';
import { trackEvent } from '@/lib/analytics';
import { getSessionPendingFeedbackState } from '@/lib/reservation/pendingFeedbackGuard';
import {
  fetchPendingFeedbackReservations,
  submitReservationFeedback,
} from '@/services/reservations';
import { mockSession, mockUseSession } from '@/test/mocks/nextAuth';
import type { Reservation } from '@/types/reservation';

import { usePendingFeedbackQueue } from './usePendingFeedbackQueue';

const mockFetchPending = vi.mocked(fetchPendingFeedbackReservations);
const mockSubmitFeedback = vi.mocked(submitReservationFeedback);
const mockClearDtoCache = vi.mocked(clearUserProfileDtoCache);
const mockTrackEvent = vi.mocked(trackEvent);

function makeItem(
  id: string,
  dtstart: number,
  viewerRole: 'MENTEE' | 'MENTOR' = 'MENTEE'
): Reservation {
  return fromPartial<Reservation>({
    id,
    name: `Partner ${id}`,
    date: '2026/10/12',
    time: '19:00–19:30',
    dtstart,
    dtend: dtstart + 1800,
    senderUserId: viewerRole === 'MENTOR' ? 202 : 1,
    participantUserId: viewerRole === 'MENTOR' ? 1 : 303,
    viewerRole,
  });
}

describe('usePendingFeedbackQueue (#740)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mockUsePathname.mockReturnValue('/mentor-pool');
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    mockUseSession.mockReturnValue({
      data: {
        ...mockSession,
        user: {
          ...mockSession.user,
          id: '1',
          onBoarding: true,
          isMentor: false,
        },
      },
      status: 'authenticated',
      update: vi.fn(),
    });
  });

  it('fetches pending feedback on login into eligible page and skips re-fetch on subsequent SPA navigation', async () => {
    const item1 = makeItem('101', 1760000000);
    const item2 = makeItem('102', 1761000000);
    mockFetchPending.mockResolvedValueOnce([item1, item2]);

    const { result, rerender } = renderHook(() => usePendingFeedbackQueue());

    await waitFor(() => {
      expect(result.current.queueItems).toEqual([item1, item2]);
    });
    expect(mockFetchPending).toHaveBeenCalledTimes(1);

    mockUsePathname.mockReturnValue('/about');
    rerender();
    expect(mockFetchPending).toHaveBeenCalledTimes(1);
  });

  it('suppresses fetch and yields when on onboarding/reservation pages or when URL contains reservationId or feedbackReservationId', async () => {
    mockFetchPending.mockResolvedValue([makeItem('101', 1760000000)]);

    mockUsePathname.mockReturnValue('/reservation/mentee');
    const { result, rerender } = renderHook(() => usePendingFeedbackQueue());
    expect(result.current.queueItems).toBeNull();
    expect(mockFetchPending).not.toHaveBeenCalled();

    mockUsePathname.mockReturnValue('/mentor-pool');
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams('reservationId=999')
    );
    rerender();
    expect(result.current.queueItems).toBeNull();
    expect(mockFetchPending).not.toHaveBeenCalled();

    mockUseSearchParams.mockReturnValue(
      new URLSearchParams('feedbackReservationId=888')
    );
    rerender();
    expect(result.current.queueItems).toBeNull();
    expect(mockFetchPending).not.toHaveBeenCalled();

    // Once query param yields are cleared on an eligible route, fetches and opens
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    rerender();
    await waitFor(() => {
      expect(result.current.queueItems).toHaveLength(1);
    });
    expect(mockFetchPending).toHaveBeenCalledTimes(1);
  });

  it('remembers X skip/dismiss only for the current login session and re-pops unanswered items after logout + re-login', async () => {
    const item1 = makeItem('101', 1760000000, 'MENTOR');
    const item2 = makeItem('102', 1761000000, 'MENTEE');
    mockFetchPending.mockResolvedValueOnce([item1, item2]);
    mockSubmitFeedback.mockResolvedValueOnce(undefined);

    const { result, rerender } = renderHook(() => usePendingFeedbackQueue());

    await waitFor(() => {
      expect(result.current.queueItems).toEqual([item1, item2]);
    });

    // Submit item 1 (Mentor) -> resolves role='mentor'
    await act(async () => {
      await result.current.submitFeedbackItem(
        { meeting_happened: true },
        item1
      );
    });

    expect(mockSubmitFeedback).toHaveBeenCalledWith({
      reservation: item1,
      myUserId: '1',
      myRole: 'mentor',
      payload: { meeting_happened: true },
    });
    expect(mockClearDtoCache).toHaveBeenCalledWith(1, 'zh_TW');
    expect(mockClearDtoCache).toHaveBeenCalledWith(1, 'en_US');
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: 'reservation_feedback_submitted',
      feature: 'reservation',
      metadata: { meeting_happened: true },
    });

    // Skip item 2 via X and close queue
    act(() => {
      result.current.skipFeedbackItem(item2);
      result.current.dismissQueue();
    });

    expect(result.current.queueItems).toBeNull();

    // Same login session route hop -> stays dismissed
    mockUsePathname.mockReturnValue('/');
    rerender();
    expect(result.current.queueItems).toBeNull();
    expect(mockFetchPending).toHaveBeenCalledTimes(1);

    // User logs out -> clears per-login state
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: vi.fn(),
    });
    rerender();

    // User logs back in -> fetches pending-feedback again and pops remaining item2
    mockFetchPending.mockResolvedValueOnce([item2]);
    mockUseSession.mockReturnValue({
      data: {
        ...mockSession,
        user: {
          ...mockSession.user,
          id: '1',
          onBoarding: true,
          isMentor: false,
        },
      },
      status: 'authenticated',
      update: vi.fn(),
    });
    mockUsePathname.mockReturnValue('/mentor-pool');
    rerender();

    await waitFor(() => {
      expect(result.current.queueItems).toEqual([item2]);
    });
    expect(mockFetchPending).toHaveBeenCalledTimes(2);
  });

  it('invalidates counterparty mentor DTO cache on mentee happened feedback, skips DTO invalidation on mentee not-happened, and throws if session expired before submit', async () => {
    const menteeItem = makeItem('201', 1760000000, 'MENTEE');
    mockFetchPending.mockResolvedValueOnce([menteeItem]);
    mockSubmitFeedback.mockResolvedValue(undefined);

    const { result, rerender } = renderHook(() => usePendingFeedbackQueue());

    await waitFor(() => {
      expect(result.current.queueItems).toEqual([menteeItem]);
    });

    await act(async () => {
      await result.current.submitFeedbackItem(
        {
          meeting_happened: false,
          not_happened_reason: 'MENTOR_ABSENT',
        },
        menteeItem
      );
    });
    expect(mockClearDtoCache).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.submitFeedbackItem(
        {
          meeting_happened: true,
          feedback: { rating: 9, content: 'Great mentor!' },
        },
        menteeItem
      );
    });
    expect(mockClearDtoCache).toHaveBeenCalledWith(303, 'zh_TW');
    expect(mockClearDtoCache).toHaveBeenCalledWith(303, 'en_US');

    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: vi.fn(),
    });
    rerender();

    await expect(
      act(async () => {
        await result.current.submitFeedbackItem(
          { meeting_happened: true },
          menteeItem
        );
      })
    ).rejects.toThrow('[usePendingFeedbackQueue] missing current user id');
  });

  it('prunes already-submitted and skipped items when yielding to a suppressed route and returning', async () => {
    const item1 = makeItem('301', 1760000000, 'MENTOR');
    const item2 = makeItem('302', 1761000000, 'MENTOR');
    const item3 = makeItem('303', 1762000000, 'MENTOR');
    mockFetchPending.mockResolvedValueOnce([item1, item2, item3]);
    mockSubmitFeedback.mockResolvedValueOnce(undefined);

    const { result, rerender } = renderHook(() => usePendingFeedbackQueue());

    await waitFor(() => {
      expect(result.current.queueItems).toEqual([item1, item2, item3]);
    });

    await act(async () => {
      await result.current.submitFeedbackItem(
        { meeting_happened: true },
        item1
      );
      result.current.skipFeedbackItem(item2);
    });

    // Navigate to suppressed route -> hides queue and prunes completed/skipped items
    mockUsePathname.mockReturnValue('/reservation/mentor');
    rerender();
    expect(result.current.queueItems).toBeNull();

    // Return to eligible route -> only remaining item3 surfaces without re-fetching
    mockUsePathname.mockReturnValue('/mentor-pool');
    rerender();
    expect(result.current.queueItems).toEqual([item3]);
    expect(mockFetchPending).toHaveBeenCalledTimes(1);
  });

  it('recovers gracefully without writing sessionStorage when fetchPendingFeedbackReservations rejects transiently, allowing retry on page reload', async () => {
    const recoveredItem = makeItem('399', 1760000000);
    mockFetchPending
      .mockRejectedValueOnce(new Error('Unexpected network trap'))
      .mockResolvedValueOnce([recoveredItem]);

    const firstMount = renderHook(() => usePendingFeedbackQueue());

    await waitFor(() => {
      expect(mockFetchPending).toHaveBeenCalledTimes(1);
    });
    expect(firstMount.result.current.queueItems).toBeNull();
    expect(getSessionPendingFeedbackState('1')).toEqual({
      checked: false,
      dismissed: false,
      queueEmpty: false,
      submittedIds: [],
      skippedIds: [],
    });

    // SPA route change within same runtime does not hammer failed endpoint
    mockUsePathname.mockReturnValue('/about');
    firstMount.rerender();
    expect(mockFetchPending).toHaveBeenCalledTimes(1);

    // Page reload (remount) retries because sessionStorage was not poisoned
    firstMount.unmount();
    const secondMount = renderHook(() => usePendingFeedbackQueue());
    await waitFor(() => {
      expect(secondMount.result.current.queueItems).toEqual([recoveredItem]);
    });
    expect(mockFetchPending).toHaveBeenCalledTimes(2);
  });

  it('normalizes missing viewerRole on simplified items using session isMentor so UI and submitFeedbackItem share identical Mentor role', async () => {
    const itemMissingRole = fromPartial<Reservation>({
      id: '401',
      name: 'Emily Chen',
      date: '2026/10/12',
      time: '19:00–19:30',
      dtstart: 1760000000,
      dtend: 1760001800,
      senderUserId: 202,
      participantUserId: 1,
      viewerRole: undefined,
    });
    const explicitMenteeItem = makeItem('402', 1761000000, 'MENTEE');

    mockUseSession.mockReturnValue({
      data: {
        ...mockSession,
        user: {
          ...mockSession.user,
          id: '1',
          onBoarding: true,
          isMentor: true,
        },
      },
      status: 'authenticated',
      update: vi.fn(),
    });
    mockFetchPending.mockResolvedValueOnce([
      itemMissingRole,
      explicitMenteeItem,
    ]);
    mockSubmitFeedback.mockResolvedValue(undefined);

    const { result } = renderHook(() => usePendingFeedbackQueue());

    await waitFor(() => {
      expect(result.current.queueItems).toHaveLength(2);
    });

    // Missing viewerRole is normalized to 'MENTOR', while explicit 'MENTEE' is preserved!
    expect(result.current.queueItems?.[0].viewerRole).toBe('MENTOR');
    expect(result.current.queueItems?.[1].viewerRole).toBe('MENTEE');

    await act(async () => {
      await result.current.submitFeedbackItem(
        { meeting_happened: true },
        result.current.queueItems![0]
      );
    });

    expect(mockSubmitFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        myUserId: '1',
        myRole: 'mentor',
        payload: { meeting_happened: true },
      })
    );
    expect(mockClearDtoCache).toHaveBeenCalledWith(1, 'zh_TW');
    expect(mockClearDtoCache).toHaveBeenCalledWith(1, 'en_US');
  });

  it('re-fetches and preserves remaining unanswered items after a mid-queue page reload, then stops re-fetching once all items are completed', async () => {
    const item1 = makeItem('501', 1760000000, 'MENTOR');
    const item2 = makeItem('502', 1761000000, 'MENTOR');
    mockFetchPending.mockResolvedValueOnce([item1, item2]);
    mockSubmitFeedback.mockResolvedValue(undefined);

    const firstMount = renderHook(() => usePendingFeedbackQueue());

    await waitFor(() => {
      expect(firstMount.result.current.queueItems).toEqual([item1, item2]);
    });

    // Submit item1, then simulate F5 page reload before completing item2 (without clicking X)
    await act(async () => {
      await firstMount.result.current.submitFeedbackItem(
        { meeting_happened: true },
        item1
      );
    });
    firstMount.unmount();

    // Even if backend still returns [item1, item2] due to eventual consistency, item1 is filtered out and item2 surfaces!
    mockFetchPending.mockResolvedValueOnce([item1, item2]);
    const secondMount = renderHook(() => usePendingFeedbackQueue());

    await waitFor(() => {
      expect(secondMount.result.current.queueItems).toEqual([item2]);
    });
    expect(mockFetchPending).toHaveBeenCalledTimes(2);

    // Complete final item2 -> marks queueEmpty: true in sessionStorage
    await act(async () => {
      await secondMount.result.current.submitFeedbackItem(
        { meeting_happened: true },
        item2
      );
    });
    secondMount.unmount();

    // Subsequent reload in the same session does NOT re-fetch because queueEmpty is now true
    const thirdMount = renderHook(() => usePendingFeedbackQueue());
    expect(thirdMount.result.current.queueItems).toBeNull();
    expect(mockFetchPending).toHaveBeenCalledTimes(2);
  });

  it('clears previous user session state and fetches new queue when switching authenticated user.id directly', async () => {
    const user1Item = makeItem('601', 1760000000, 'MENTEE');
    const user2Item = makeItem('602', 1761000000, 'MENTOR');
    mockFetchPending
      .mockResolvedValueOnce([user1Item])
      .mockResolvedValueOnce([user2Item]);

    const { result, rerender } = renderHook(() => usePendingFeedbackQueue());

    await waitFor(() => {
      expect(result.current.queueItems).toEqual([user1Item]);
    });

    act(() => {
      result.current.dismissQueue();
    });
    expect(result.current.queueItems).toBeNull();

    // Switch directly to user '2' while staying authenticated
    mockUseSession.mockReturnValue({
      data: {
        ...mockSession,
        user: {
          ...mockSession.user,
          id: '2',
          onBoarding: true,
          isMentor: true,
        },
      },
      status: 'authenticated',
      update: vi.fn(),
    });
    rerender();

    await waitFor(() => {
      expect(result.current.queueItems).toEqual([user2Item]);
    });
    expect(mockFetchPending).toHaveBeenCalledTimes(2);
  });
});
