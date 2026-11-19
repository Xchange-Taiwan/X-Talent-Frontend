import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { feedbackNavigationMockFactory } =
    await import('@/test/mocks/reservationFeedbackHarness');
  return feedbackNavigationMockFactory();
});

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

import {
  createFeedbackSessionCoordinator,
  createInMemoryFeedbackSessionLookupPort,
  createInMemoryFeedbackSessionStoragePort,
} from '@/lib/reservation/feedbackSessionCoordinator';
import {
  feedbackRouteMock,
  makeFeedbackTestReservation,
  resetFeedbackHookTestState,
  setMockFeedbackQuery,
  setMockFeedbackRoute,
} from '@/test/mocks/reservationFeedbackHarness';
import { mockToast } from '@/test/mocks/useToast';

import { useFeedbackDeepLinkParam } from './useFeedbackDeepLinkParam';

function makeRatedItem(id: string) {
  return makeFeedbackTestReservation(id, {
    feedback: {
      meetingHappened: true,
      rating: {
        rating: 10,
        content: '很有收穫',
        createdAt: 1760000000,
        updatedAt: 1760000000,
        authorName: 'J***',
        isPublic: true,
      },
      nextStep: null,
    },
  });
}

describe('useFeedbackDeepLinkParam (#733 / #946)', () => {
  beforeEach(() => {
    resetFeedbackHookTestState({ pathname: '/reservation/mentee' });
  });

  it('latches deepLinkDialogReservation for Mentee pending ANSWER/RATE cards (including id=1) and strips query on dismiss', () => {
    setMockFeedbackQuery('tab=history&reservationId=1');
    const firstItem = makeFeedbackTestReservation('1');

    const { result, unmount } = renderHook(() =>
      useFeedbackDeepLinkParam({
        userRole: 'mentee',
        history: [firstItem],
        isHistoryLoaded: true,
        isLoadingHistory: false,
      })
    );

    expect(result.current.hasDeepLinkTarget).toBe(true);
    expect(result.current.deepLinkDialogReservation).toBe(firstItem);
    expect(result.current.highlightedReservationId).toBe('1');
    expect(feedbackRouteMock.replace).not.toHaveBeenCalled();

    act(() => {
      result.current.dismissDeepLinkDialog();
    });

    expect(result.current.deepLinkDialogReservation).toBeNull();
    expect(feedbackRouteMock.replace).toHaveBeenCalledWith(
      '/reservation/mentee?tab=history',
      { scroll: false }
    );
    unmount();

    // Pending RATE card also opens dialog without misclassifying as completed
    resetFeedbackHookTestState({
      pathname: '/reservation/mentee',
      query: 'tab=history&reservationId=105',
    });
    const pendingRateItem = makeFeedbackTestReservation('105', {
      feedback: {
        meetingHappened: true,
        rating: null,
        nextStep: 'RATE',
      },
    });

    const rateMount = renderHook(() =>
      useFeedbackDeepLinkParam({
        userRole: 'mentee',
        history: [pendingRateItem],
        isHistoryLoaded: true,
        isLoadingHistory: false,
      })
    );
    expect(rateMount.result.current.deepLinkDialogReservation).toBe(
      pendingRateItem
    );
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('closes cleanly without firing already-rated toast when feedback submission updates history before URL sync completes (#733)', () => {
    setMockFeedbackQuery('tab=history&reservationId=101');
    const pendingItem = makeFeedbackTestReservation('101');
    const ratedAfterSubmitItem = makeRatedItem('101');

    const { result, rerender } = renderHook(
      ({ history }) =>
        useFeedbackDeepLinkParam({
          userRole: 'mentee',
          history,
          isHistoryLoaded: true,
          isLoadingHistory: false,
        }),
      { initialProps: { history: [pendingItem] } }
    );

    expect(result.current.deepLinkDialogReservation).toBe(pendingItem);

    rerender({ history: [ratedAfterSubmitItem] });
    expect(mockToast).not.toHaveBeenCalled();

    act(() => {
      result.current.dismissDeepLinkDialog();
    });

    expect(result.current.deepLinkDialogReservation).toBeNull();
    expect(feedbackRouteMock.replace).toHaveBeenCalledWith(
      '/reservation/mentee?tab=history',
      { scroll: false }
    );
    expect(mockToast).not.toHaveBeenCalled();

    setMockFeedbackQuery('tab=history');
    rerender({ history: [ratedAfterSubmitItem] });
    expect(result.current.hasDeepLinkTarget).toBe(false);
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('handles Mentee already-rated auto-expand toast and Mentor open-dialog vs locate-card outcomes (#733 / #735)', () => {
    setMockFeedbackQuery('tab=history&reservationId=102');
    const ratedItem = makeRatedItem('102');

    const menteeMount = renderHook(() =>
      useFeedbackDeepLinkParam({
        userRole: 'mentee',
        history: [ratedItem],
        isHistoryLoaded: true,
        isLoadingHistory: false,
      })
    );
    expect(menteeMount.result.current.deepLinkDialogReservation).toBeNull();
    expect(menteeMount.result.current.highlightedReservationId).toBe('102');
    expect(menteeMount.result.current.autoExpandedReservationId).toBe('102');
    expect(mockToast).toHaveBeenCalledWith({
      title: '您已填寫過此場會談回饋',
      description: '已為您展開先前的回饋紀錄。',
    });
    expect(feedbackRouteMock.replace).toHaveBeenCalledWith(
      '/reservation/mentee?tab=history',
      { scroll: false }
    );
    menteeMount.unmount();

    // Mentor pending ANSWER card opens dialog; dismiss strips query
    resetFeedbackHookTestState({
      pathname: '/reservation/mentor',
      query: 'reservation_id=205',
    });
    const pendingMentorCard = makeFeedbackTestReservation('205', {
      viewerRole: 'MENTOR',
    });
    const mentorPending = renderHook(() =>
      useFeedbackDeepLinkParam({
        userRole: 'mentor',
        history: [pendingMentorCard],
        isHistoryLoaded: true,
        isLoadingHistory: false,
      })
    );
    expect(mentorPending.result.current.deepLinkDialogReservation).toBe(
      pendingMentorCard
    );
    act(() => {
      mentorPending.result.current.dismissDeepLinkDialog();
    });
    expect(feedbackRouteMock.replace).toHaveBeenCalledWith(
      '/reservation/mentor?tab=history',
      { scroll: false }
    );
    mentorPending.unmount();

    // Mentor settled card highlights without opening dialog
    resetFeedbackHookTestState({
      pathname: '/reservation/mentor',
      query: 'tab=history&reservationId=201',
    });
    const settledMentorCard = makeFeedbackTestReservation('201', {
      feedback: { meetingHappened: null, rating: null, nextStep: null },
    });
    const mentorSettled = renderHook(() =>
      useFeedbackDeepLinkParam({
        userRole: 'mentor',
        history: [settledMentorCard],
        isHistoryLoaded: true,
        isLoadingHistory: false,
      })
    );
    expect(mentorSettled.result.current.deepLinkDialogReservation).toBeNull();
    expect(mentorSettled.result.current.highlightedReservationId).toBe('201');
    expect(feedbackRouteMock.replace).toHaveBeenCalledWith(
      '/reservation/mentor?tab=history',
      { scroll: false }
    );
  });

  it('auto-loads up to 3 history pages before falling back to not-found toast, or opens once loaded (#733)', () => {
    setMockFeedbackQuery('tab=history&reservationId=999');
    const onLoadMoreHistory = vi.fn();
    const p0 = makeFeedbackTestReservation('301');
    const p1 = makeFeedbackTestReservation('302');
    const p2 = makeFeedbackTestReservation('303');
    const p3 = makeFeedbackTestReservation('304');

    const { rerender, unmount } = renderHook(
      ({ history }) =>
        useFeedbackDeepLinkParam({
          userRole: 'mentee',
          history,
          isHistoryLoaded: true,
          isLoadingHistory: false,
          hasMoreHistory: true,
          onLoadMoreHistory,
        }),
      { initialProps: { history: [p0] } }
    );

    expect(onLoadMoreHistory).toHaveBeenCalledTimes(1);
    rerender({ history: [p0, p1] });
    expect(onLoadMoreHistory).toHaveBeenCalledTimes(2);
    rerender({ history: [p0, p1, p2] });
    expect(onLoadMoreHistory).toHaveBeenCalledTimes(3);

    rerender({ history: [p0, p1, p2, p3] });
    expect(onLoadMoreHistory).toHaveBeenCalledTimes(3);
    expect(mockToast).toHaveBeenCalledWith({
      title: '找不到指定的會談紀錄',
      description: '請確認您登入的帳號是否正確，或於歷史紀錄列表查看。',
    });
    expect(feedbackRouteMock.replace).toHaveBeenCalledWith(
      '/reservation/mentee?tab=history',
      { scroll: false }
    );
    unmount();

    // Opens immediately once target arrives on next page
    resetFeedbackHookTestState({
      pathname: '/reservation/mentee',
      query: 'tab=history&reservationId=305',
    });
    const loadMoreForTarget = vi.fn();
    const targetItem = makeFeedbackTestReservation('305');
    const foundMount = renderHook(
      ({ history, hasMore }) =>
        useFeedbackDeepLinkParam({
          userRole: 'mentee',
          history,
          isHistoryLoaded: true,
          isLoadingHistory: false,
          hasMoreHistory: hasMore,
          onLoadMoreHistory: loadMoreForTarget,
        }),
      { initialProps: { history: [p0], hasMore: true } }
    );
    expect(loadMoreForTarget).toHaveBeenCalledTimes(1);
    foundMount.rerender({ history: [p0, targetItem], hasMore: false });
    expect(foundMount.result.current.deepLinkDialogReservation).toBe(
      targetItem
    );
  });

  it('increments deepLinkTriggerSeq on repeat clicks and resets focus on non-expanding, not-found, or clearDeepLinkFocus (#733)', () => {
    setMockFeedbackQuery('tab=history&reservationId=102');
    const ratedItem = makeRatedItem('102');
    const absentItem = makeFeedbackTestReservation('103', {
      feedback: { meetingHappened: false, rating: null, nextStep: null },
    });

    const { result, rerender } = renderHook(() =>
      useFeedbackDeepLinkParam({
        userRole: 'mentee',
        history: [ratedItem, absentItem],
        isHistoryLoaded: true,
        isLoadingHistory: false,
      })
    );

    expect(result.current.deepLinkTriggerSeq).toBe(1);

    setMockFeedbackQuery('tab=history');
    rerender();
    setMockFeedbackQuery('tab=history&reservationId=102');
    rerender();
    expect(result.current.deepLinkTriggerSeq).toBe(2);
    expect(result.current.autoExpandedReservationId).toBe('102');

    setMockFeedbackQuery('tab=history');
    rerender();
    setMockFeedbackQuery('tab=history&reservationId=103');
    rerender();
    expect(result.current.highlightedReservationId).toBe('103');
    expect(result.current.autoExpandedReservationId).toBeNull();
    expect(result.current.deepLinkTriggerSeq).toBe(3);

    setMockFeedbackQuery('tab=history');
    rerender();
    setMockFeedbackQuery('tab=history&reservationId=999');
    rerender();
    expect(result.current.highlightedReservationId).toBeNull();

    setMockFeedbackQuery('tab=history');
    rerender();
    setMockFeedbackQuery('tab=history&reservationId=102');
    rerender();
    act(() => {
      result.current.clearDeepLinkFocus();
    });
    expect(result.current.highlightedReservationId).toBeNull();
    expect(result.current.autoExpandedReservationId).toBeNull();
  });

  it('uses single-reservation lookup fallback across StrictMode, unmount abort, cross-role redirect, and 404/500 errors (#875 / #946)', async () => {
    // 1. StrictMode mount + async lookup resolves dialog cleanly
    setMockFeedbackQuery('tab=history&reservation_id=888');
    const lookupItem = makeFeedbackTestReservation('888');
    const lookupSingleFeedback = vi.fn().mockResolvedValue({
      viewerRole: 'mentee' as const,
      reservation: lookupItem,
    });

    const strictWrapper: React.FC<{ children: React.ReactNode }> = ({
      children,
    }) => React.createElement(React.StrictMode, null, children);

    const strictMount = renderHook(
      () =>
        useFeedbackDeepLinkParam({
          userRole: 'mentee',
          myUserId: '1',
          history: [],
          isHistoryLoaded: true,
          isLoadingHistory: false,
          hasMoreHistory: false,
          lookupSingleFeedback,
        }),
      { wrapper: strictWrapper }
    );

    await waitFor(() => {
      expect(strictMount.result.current.deepLinkDialogReservation).toBe(
        lookupItem
      );
    });
    expect(mockToast).not.toHaveBeenCalled();
    strictMount.unmount();

    // 2. Unmount while lookup is in-flight aborts signal and suppresses stale not-found toast
    resetFeedbackHookTestState({
      pathname: '/reservation/mentee',
      query: 'tab=history&reservation_id=890',
    });
    let capturedSignal: AbortSignal | undefined;
    let resolveInFlight: ((val: null) => void) | undefined;
    const inFlightLookup = vi.fn().mockImplementation(({ signal }) => {
      capturedSignal = signal;
      return new Promise<null>((resolve) => {
        resolveInFlight = resolve;
      });
    });

    const inFlightMount = renderHook(() =>
      useFeedbackDeepLinkParam({
        userRole: 'mentee',
        myUserId: '1',
        history: [],
        isHistoryLoaded: true,
        isLoadingHistory: false,
        hasMoreHistory: false,
        lookupSingleFeedback: inFlightLookup,
      })
    );

    inFlightMount.unmount();
    expect(capturedSignal?.aborted).toBe(true);
    await act(async () => {
      resolveInFlight?.(null);
      await Promise.resolve();
    });
    expect(mockToast).not.toHaveBeenCalled();

    // 3. Cross-role redirect when lookup reveals target belongs to mentor view
    resetFeedbackHookTestState({
      pathname: '/reservation/mentee',
      query: 'tab=history&reservation_id=889',
    });
    const crossRoleMount = renderHook(() =>
      useFeedbackDeepLinkParam({
        userRole: 'mentee',
        myUserId: '1',
        history: [],
        isHistoryLoaded: true,
        isLoadingHistory: false,
        hasMoreHistory: false,
        lookupSingleFeedback: vi.fn().mockResolvedValueOnce({
          viewerRole: 'mentor',
          reservation: makeFeedbackTestReservation('889'),
        }),
      })
    );

    await waitFor(() => {
      expect(feedbackRouteMock.replace).toHaveBeenCalledWith(
        '/reservation/mentor?tab=history&reservation_id=889',
        { scroll: false }
      );
    });
    crossRoleMount.unmount();

    // 4. 404 (null) and 500 (rejected) show friendly not-found toast and clean query
    for (const [id, lookupImpl] of [
      ['404', vi.fn().mockResolvedValueOnce(null)],
      ['500', vi.fn().mockRejectedValueOnce(new Error('500 Internal Error'))],
    ] as const) {
      resetFeedbackHookTestState({
        pathname: '/reservation/mentee',
        query: `tab=history&reservation_id=${id}`,
      });
      const errMount = renderHook(() =>
        useFeedbackDeepLinkParam({
          userRole: 'mentee',
          myUserId: '1',
          history: [],
          isHistoryLoaded: true,
          isLoadingHistory: false,
          hasMoreHistory: false,
          lookupSingleFeedback: lookupImpl,
        })
      );

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: '找不到指定的會談紀錄',
          description: '請確認您登入的帳號是否正確，或於歷史紀錄列表查看。',
        });
      });
      expect(feedbackRouteMock.replace).toHaveBeenCalledWith(
        '/reservation/mentee?tab=history',
        { scroll: false }
      );
      errMount.unmount();
    }
  });

  it('consumes seeded lookup from /reservation/history redirect without triggering pagination or duplicate fetch (#906)', async () => {
    setMockFeedbackRoute(
      '/reservation/mentee',
      'tab=history&reservation_id=777'
    );
    const seededItem = makeFeedbackTestReservation('777');
    const lookup = createInMemoryFeedbackSessionLookupPort({
      singleReservations: {
        '777': { viewerRole: 'mentee', reservation: seededItem },
      },
    });
    const coordinator = createFeedbackSessionCoordinator({
      storage: createInMemoryFeedbackSessionStoragePort(),
      lookup,
    });

    await coordinator.resolveHistoryRedirect({
      userId: 'user-1',
      fallbackRole: 'mentee',
      rawSearch: 'reservation_id=777',
    });
    expect(lookup.calls.fetchSingleReservationFeedback).toHaveLength(1);

    const onLoadMoreHistory = vi.fn();
    const extraLookup = vi.fn();

    const { result } = renderHook(() =>
      useFeedbackDeepLinkParam({
        userRole: 'mentee',
        myUserId: 'user-1',
        history: [],
        isHistoryLoaded: true,
        isLoadingHistory: false,
        hasMoreHistory: true,
        onLoadMoreHistory,
        coordinator,
        lookupSingleFeedback: extraLookup,
      })
    );

    expect(result.current.deepLinkDialogReservation).toBe(seededItem);
    expect(result.current.highlightedReservationId).toBe('777');
    expect(onLoadMoreHistory).not.toHaveBeenCalled();
    expect(extraLookup).not.toHaveBeenCalled();
    expect(lookup.calls.fetchSingleReservationFeedback).toHaveLength(1);
  });

  it('returns idle defaults without paginating, looking up, toasting, or rewriting URL when feedback flag is disabled (#913)', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_FEEDBACK', 'false');
    try {
      setMockFeedbackQuery('tab=history&reservation_id=999');
      const onLoadMoreHistory = vi.fn();
      const lookupSingleFeedback = vi.fn();

      const { result } = renderHook(() =>
        useFeedbackDeepLinkParam({
          userRole: 'mentee',
          myUserId: 'user-1',
          history: [],
          isHistoryLoaded: true,
          isLoadingHistory: false,
          hasMoreHistory: true,
          onLoadMoreHistory,
          lookupSingleFeedback,
        })
      );

      expect(result.current.hasDeepLinkTarget).toBe(false);
      expect(result.current.deepLinkDialogReservation).toBeNull();
      expect(result.current.highlightedReservationId).toBeNull();
      expect(result.current.autoExpandedReservationId).toBeNull();
      expect(onLoadMoreHistory).not.toHaveBeenCalled();
      expect(lookupSingleFeedback).not.toHaveBeenCalled();
      expect(mockToast).not.toHaveBeenCalled();
      expect(feedbackRouteMock.replace).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
