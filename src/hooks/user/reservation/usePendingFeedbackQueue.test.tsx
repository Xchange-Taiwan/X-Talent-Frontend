import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { feedbackNavigationMockFactory } =
    await import('@/test/mocks/reservationFeedbackHarness');
  return feedbackNavigationMockFactory();
});

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

vi.mock('@/services/reservations', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/reservations')>();
  return {
    ...actual,
    fetchPendingFeedbackReservations: vi.fn(),
    submitReservationFeedback: vi.fn(
      (params: Parameters<typeof actual.submitReservationFeedback>[0]) =>
        actual.submitReservationFeedback({
          ...params,
          transport:
            params.transport ??
            actual.createInMemoryReservationWriteTransport(),
        })
    ),
  };
});

vi.mock('@/lib/profile/profileReadModel', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/profile/profileReadModel')>();
  return {
    ...actual,
    profileReadModel: {
      ...actual.profileReadModel,
      invalidateUser: vi.fn(actual.profileReadModel.invalidateUser),
    },
  };
});

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

import { trackEvent } from '@/lib/analytics';
import { profileReadModel } from '@/lib/profile/profileReadModel';
import {
  feedbackSessionCoordinator,
  PENDING_FEEDBACK_SESSION_PREFIX,
} from '@/lib/reservation/feedbackSessionCoordinator';
import {
  fetchPendingFeedbackReservations,
  submitReservationFeedback,
} from '@/services/reservations';
import {
  makeFeedbackTestReservation,
  resetFeedbackHookTestState,
  setAuthenticatedFeedbackSession,
  setMockFeedbackPathname,
  setMockFeedbackQuery,
  setMockFeedbackRoute,
  setUnauthenticatedFeedbackSession,
} from '@/test/mocks/reservationFeedbackHarness';
import type { Reservation } from '@/types/reservation';

import { usePendingFeedbackQueue } from './usePendingFeedbackQueue';

const mockFetchPending = vi.mocked(fetchPendingFeedbackReservations);
const mockSubmitFeedback = vi.mocked(submitReservationFeedback);
const mockInvalidateProfileUser = vi.mocked(profileReadModel.invalidateUser);
const mockTrackEvent = vi.mocked(trackEvent);

function makeItem(
  id: string,
  dtstart: number,
  viewerRole: 'MENTEE' | 'MENTOR' = 'MENTEE'
): Reservation {
  return makeFeedbackTestReservation(id, {
    dtstart,
    dtend: dtstart + 1800,
    viewerRole,
  });
}

describe('usePendingFeedbackQueue (#740 / #946)', () => {
  beforeEach(() => {
    resetFeedbackHookTestState({ pathname: '/mentor-pool' });
    setAuthenticatedFeedbackSession({
      id: '1',
      onBoarding: true,
      isMentor: false,
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

    setMockFeedbackPathname('/about');
    rerender();
    expect(mockFetchPending).toHaveBeenCalledTimes(1);
  });

  it('suppresses fetch and yields on reservation pages or deep-link query params, then fetches once cleared', async () => {
    mockFetchPending.mockResolvedValue([makeItem('101', 1760000000)]);

    setMockFeedbackPathname('/reservation/mentee');
    const { result, rerender } = renderHook(() => usePendingFeedbackQueue());
    expect(result.current.queueItems).toBeNull();
    expect(mockFetchPending).not.toHaveBeenCalled();

    setMockFeedbackRoute('/mentor-pool', 'reservationId=999');
    rerender();
    expect(result.current.queueItems).toBeNull();

    setMockFeedbackQuery('feedbackReservationId=888');
    rerender();
    expect(result.current.queueItems).toBeNull();
    expect(mockFetchPending).not.toHaveBeenCalled();

    setMockFeedbackQuery('');
    rerender();
    await waitFor(() => {
      expect(result.current.queueItems).toHaveLength(1);
    });
    expect(mockFetchPending).toHaveBeenCalledTimes(1);
  });

  it('gates fetch on onBoarding===true and absence of session.error, and resets sessionStorage on /auth/signin or logout', async () => {
    const item1 = makeItem('105', 1760000000);
    mockFetchPending.mockResolvedValue([item1]);

    setAuthenticatedFeedbackSession({ onBoarding: false });
    const { result, rerender } = renderHook(() => usePendingFeedbackQueue());
    expect(result.current.queueItems).toBeNull();

    setAuthenticatedFeedbackSession({ onBoarding: undefined });
    rerender();
    expect(result.current.queueItems).toBeNull();

    setAuthenticatedFeedbackSession({
      onBoarding: true,
      error: 'RefreshTokenError',
    });
    rerender();
    expect(mockFetchPending).not.toHaveBeenCalled();

    setAuthenticatedFeedbackSession({ onBoarding: true });
    rerender();
    await waitFor(() => {
      expect(result.current.queueItems).toEqual([item1]);
    });
    expect(mockFetchPending).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.dismissQueue();
    });
    expect(feedbackSessionCoordinator.getSessionState('1').dismissed).toBe(
      true
    );

    // /auth/signin resets per-login sessionStorage state
    setMockFeedbackPathname('/auth/signin');
    rerender();
    expect(result.current.queueItems).toBeNull();
    expect(feedbackSessionCoordinator.getSessionState('1').checked).toBe(false);

    setMockFeedbackPathname('/mentor-pool');
    rerender();
    await waitFor(() => {
      expect(result.current.queueItems).toEqual([item1]);
    });
    expect(mockFetchPending).toHaveBeenCalledTimes(2);

    // Dismissing then logging out + re-logging in also re-fetches
    act(() => {
      result.current.skipFeedbackItem(item1);
      result.current.dismissQueue();
    });
    setUnauthenticatedFeedbackSession();
    rerender();
    setAuthenticatedFeedbackSession({ onBoarding: true });
    rerender();
    await waitFor(() => {
      expect(result.current.queueItems).toEqual([item1]);
    });
    expect(mockFetchPending).toHaveBeenCalledTimes(3);
  });

  it('reconciles counterparty/mentor profileReadModel caches on submitFeedbackItem and guards missing user or unresolved role', async () => {
    const menteeItem = makeItem('201', 1760000000, 'MENTEE');
    mockFetchPending.mockResolvedValueOnce([menteeItem]);

    const { result, rerender } = renderHook(() => usePendingFeedbackQueue());
    await waitFor(() => {
      expect(result.current.queueItems).toEqual([menteeItem]);
    });

    await act(async () => {
      await result.current.submitFeedbackItem(
        { meeting_happened: false, not_happened_reason: 'COUNTERPART_ABSENT' },
        menteeItem
      );
    });
    expect(mockInvalidateProfileUser).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.submitFeedbackItem(
        {
          meeting_happened: true,
          feedback: { rating: 9, content: 'Great mentor!' },
        },
        menteeItem
      );
    });
    expect(mockInvalidateProfileUser).toHaveBeenCalledWith(303);
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: 'reservation_feedback_submitted',
      feature: 'reservation',
      metadata: { meeting_happened: true },
    });

    // Mentor reporting meeting_happened: false invalidates Mentor's own profile cache
    mockInvalidateProfileUser.mockClear();
    const mentorItem = makeItem('202', 1761000000, 'MENTOR');
    await act(async () => {
      await result.current.submitFeedbackItem(
        { meeting_happened: false, not_happened_reason: 'COUNTERPART_ABSENT' },
        mentorItem
      );
    });
    expect(mockSubmitFeedback).toHaveBeenCalledWith({
      reservation: mentorItem,
      myUserId: '1',
      myRole: 'mentor',
      payload: {
        meeting_happened: false,
        not_happened_reason: 'COUNTERPART_ABSENT',
      },
    });
    expect(mockInvalidateProfileUser).toHaveBeenCalledWith(1);

    setUnauthenticatedFeedbackSession();
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

  it('waits until session.user.isMentor resolves to boolean and normalizes missing viewerRole items', async () => {
    const simplifiedItem = makeFeedbackTestReservation('801', {
      senderUserId: 202,
      participantUserId: 1,
      viewerRole: undefined,
    });
    const explicitMenteeItem = makeItem('802', 1761000000, 'MENTEE');
    mockFetchPending.mockResolvedValueOnce([
      simplifiedItem,
      explicitMenteeItem,
    ]);

    setAuthenticatedFeedbackSession({ isMentor: undefined });
    const { result, rerender } = renderHook(() => usePendingFeedbackQueue());
    expect(result.current.queueItems).toBeNull();
    expect(mockFetchPending).not.toHaveBeenCalled();

    await expect(
      act(async () => {
        await result.current.submitFeedbackItem(
          { meeting_happened: true },
          simplifiedItem
        );
      })
    ).rejects.toThrow('[usePendingFeedbackQueue] unresolved user role');

    setAuthenticatedFeedbackSession({ isMentor: true });
    rerender();

    await waitFor(() => {
      expect(result.current.queueItems).toHaveLength(2);
    });
    expect(result.current.queueItems?.[0].viewerRole).toBe('MENTOR');
    expect(result.current.queueItems?.[1].viewerRole).toBe('MENTEE');
  });

  it('prunes items submitted/skipped in-modal or via submitReservationFeedback on suppressed routes when returning', async () => {
    const item1 = makeItem('301', 1760000000, 'MENTOR');
    const item2 = makeItem('302', 1761000000, 'MENTEE');
    const item3 = makeItem('303', 1762000000, 'MENTEE');
    mockFetchPending.mockResolvedValueOnce([item1, item2, item3]);

    const { result, rerender } = renderHook(() => usePendingFeedbackQueue());
    await waitFor(() => {
      expect(result.current.queueItems).toEqual([item1, item2, item3]);
    });

    await act(async () => {
      await result.current.submitFeedbackItem(
        { meeting_happened: true },
        item1
      );
    });

    setMockFeedbackPathname('/reservation/mentee');
    rerender();
    expect(result.current.queueItems).toBeNull();

    // Submit item2 from reservation history card while suppressed
    await act(async () => {
      await submitReservationFeedback({
        reservation: item2,
        myUserId: '1',
        myRole: 'mentee',
        payload: {
          meeting_happened: true,
          feedback: { rating: 10, content: 'Great session!' },
        },
      });
    });

    setMockFeedbackPathname('/mentor-pool');
    rerender();
    expect(result.current.queueItems).toEqual([item3]);

    // Submit final item3 on suppressed route -> marks queueEmpty=true
    setMockFeedbackPathname('/reservation/mentee');
    rerender();
    await act(async () => {
      await submitReservationFeedback({
        reservation: item3,
        myUserId: '1',
        myRole: 'mentee',
        payload: {
          meeting_happened: true,
          feedback: { rating: 9, content: 'Thank you!' },
        },
      });
    });

    setMockFeedbackPathname('/mentor-pool');
    rerender();
    expect(result.current.queueItems).toBeNull();
    expect(feedbackSessionCoordinator.getSessionState('1').queueEmpty).toBe(
      true
    );
  });

  it('recovers from transient fetch failure on reload, preserves remaining items across F5 reload, and keeps dismissed=false when completed normally', async () => {
    const item1 = makeItem('501', 1760000000, 'MENTOR');
    const item2 = makeItem('502', 1761000000, 'MENTOR');
    const laterEndedItem = makeItem('503', 1762000000, 'MENTOR');

    mockFetchPending
      .mockRejectedValueOnce(new Error('Transient 503'))
      .mockResolvedValueOnce([item1, item2])
      .mockResolvedValueOnce([item1, item2])
      .mockResolvedValueOnce([laterEndedItem]);

    // 1. Transient error does not poison sessionStorage or hammer endpoint on SPA nav
    const failedMount = renderHook(() => usePendingFeedbackQueue());
    await waitFor(() => {
      expect(mockFetchPending).toHaveBeenCalledTimes(1);
    });
    expect(failedMount.result.current.queueItems).toBeNull();
    expect(feedbackSessionCoordinator.getSessionState('1').checked).toBe(false);
    setMockFeedbackPathname('/about');
    failedMount.rerender();
    expect(mockFetchPending).toHaveBeenCalledTimes(1);
    failedMount.unmount();

    // 2. Reload retries, keeps queueItems stable while presenting, and survives mid-queue F5 reload
    setMockFeedbackPathname('/mentor-pool');
    const firstMount = renderHook(() => usePendingFeedbackQueue());
    await waitFor(() => {
      expect(firstMount.result.current.queueItems).toEqual([item1, item2]);
    });

    await act(async () => {
      await firstMount.result.current.submitFeedbackItem(
        { meeting_happened: true },
        item1
      );
    });
    expect(firstMount.result.current.queueItems).toEqual([item1, item2]);
    firstMount.unmount();

    const secondMount = renderHook(() => usePendingFeedbackQueue());
    await waitFor(() => {
      expect(secondMount.result.current.queueItems).toEqual([item2]);
    });

    await act(async () => {
      await secondMount.result.current.submitFeedbackItem(
        { meeting_happened: true },
        item2
      );
    });
    act(() => {
      secondMount.result.current.dismissQueue();
    });
    expect(feedbackSessionCoordinator.getSessionState('1')).toEqual({
      checked: true,
      dismissed: false,
      queueEmpty: true,
      submittedIds: ['501', '502'],
      skippedIds: [],
    });
    secondMount.unmount();

    // 3. Subsequent reload with queueEmpty=true skips fetch; if new session ends (queueEmpty=false), dismissed=false allows prompt
    const thirdMount = renderHook(() => usePendingFeedbackQueue());
    expect(mockFetchPending).toHaveBeenCalledTimes(3);
    thirdMount.unmount();

    const current = feedbackSessionCoordinator.getSessionState('1');
    window.sessionStorage.setItem(
      `${PENDING_FEEDBACK_SESSION_PREFIX}1`,
      JSON.stringify({ ...current, queueEmpty: false })
    );
    const fourthMount = renderHook(() => usePendingFeedbackQueue());
    await waitFor(() => {
      expect(fourthMount.result.current.queueItems).toEqual([laterEndedItem]);
    });
    expect(mockFetchPending).toHaveBeenCalledTimes(4);

    // Skipping keeps queueItems stable while presented until dismissQueue marks dismissed=true
    act(() => {
      fourthMount.result.current.skipFeedbackItem(laterEndedItem);
    });
    expect(fourthMount.result.current.queueItems).toEqual([laterEndedItem]);
    act(() => {
      fourthMount.result.current.dismissQueue();
    });
    expect(fourthMount.result.current.queueItems).toBeNull();
    expect(feedbackSessionCoordinator.getSessionState('1').dismissed).toBe(
      true
    );
  });

  describe('feedback_prompt_shown & feedback_prompt_dismissed telemetry (#950)', () => {
    it('emits feedback_prompt_shown once on eligible presentation, tracks skipped_count on partial dismiss without PII, and isolates account switches', async () => {
      setMockFeedbackPathname('/auth/onboarding');
      const item1 = makeItem('981', 1760000000);
      const item2 = makeItem('982', 1761000000);
      mockFetchPending.mockResolvedValueOnce([item1, item2]);

      const { result, rerender } = renderHook(() => usePendingFeedbackQueue());
      expect(mockTrackEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ name: 'feedback_prompt_shown' })
      );

      setMockFeedbackPathname('/mentor-pool');
      rerender();

      await waitFor(() => {
        expect(result.current.queueItems).toEqual([item1, item2]);
      });
      expect(
        mockTrackEvent.mock.calls.filter(
          (c) => c[0]?.name === 'feedback_prompt_shown'
        )
      ).toEqual([
        [
          {
            name: 'feedback_prompt_shown',
            feature: 'feedback',
            metadata: { pending_count: 2 },
          },
        ],
      ]);

      mockTrackEvent.mockClear();
      await act(async () => {
        await result.current.submitFeedbackItem(
          {
            meeting_happened: true,
            feedback: { rating: 9, content: '收穫良多' },
          },
          item1
        );
      });
      act(() => {
        result.current.dismissQueue();
      });

      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'feedback_prompt_dismissed',
        feature: 'feedback',
        metadata: { skipped_count: 1 },
      });
      expect(JSON.stringify(mockTrackEvent.mock.calls)).not.toContain(
        'Partner 981'
      );
      expect(JSON.stringify(mockTrackEvent.mock.calls)).not.toContain(
        '收穫良多'
      );

      // Direct switch to user '2': full completion emits shown(1) and NO dismissed event
      const user2Item = makeItem('2001', 1762000000);
      mockFetchPending.mockResolvedValueOnce([user2Item]);
      setAuthenticatedFeedbackSession({ id: '2', isMentor: false });
      mockTrackEvent.mockClear();
      rerender();

      await waitFor(() => {
        expect(result.current.queueItems).toEqual([user2Item]);
      });
      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'feedback_prompt_shown',
        feature: 'feedback',
        metadata: { pending_count: 1 },
      });

      mockTrackEvent.mockClear();
      await act(async () => {
        await result.current.submitFeedbackItem(
          {
            meeting_happened: true,
            feedback: { rating: 10, content: '完美' },
          },
          user2Item
        );
      });
      act(() => {
        result.current.dismissQueue();
      });
      expect(mockTrackEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ name: 'feedback_prompt_dismissed' })
      );
    });
  });
});
