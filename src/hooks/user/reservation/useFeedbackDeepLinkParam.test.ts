import { act, renderHook } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Reservation } from '@/types/reservation';

import { useFeedbackDeepLinkParam } from './useFeedbackDeepLinkParam';

const mockReplace = vi.fn();
let currentQuery = '';
let currentPathname = '/reservation/mentee';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(currentQuery),
  useRouter: () => ({
    replace: (url: string, opts?: { scroll?: boolean }) =>
      mockReplace(url, opts),
  }),
  usePathname: () => currentPathname,
}));

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

import { mockToast } from '@/test/mocks/useToast';

describe('useFeedbackDeepLinkParam (#733)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentQuery = '';
    currentPathname = '/reservation/mentee';
  });

  it('latches deepLinkDialogReservation for Mentee pending ANSWER card and strips reservationId on dismiss', () => {
    currentQuery = 'tab=history&reservationId=101';

    const pendingItem = fromPartial<Reservation>({
      id: '101',
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
    });

    const { result } = renderHook(() =>
      useFeedbackDeepLinkParam({
        userRole: 'mentee',
        history: [pendingItem],
        isHistoryLoaded: true,
        isLoadingHistory: false,
      })
    );

    expect(result.current.hasDeepLinkTarget).toBe(true);
    expect(result.current.deepLinkDialogReservation).toBe(pendingItem);
    expect(result.current.highlightedReservationId).toBe('101');
    expect(mockReplace).not.toHaveBeenCalled();

    act(() => {
      result.current.dismissDeepLinkDialog();
    });

    expect(result.current.deepLinkDialogReservation).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith(
      '/reservation/mentee?tab=history',
      { scroll: false }
    );
  });

  it('closes cleanly and strips reservationId without firing already-rated toast when feedback submission updates history before URL sync completes (#733)', () => {
    currentQuery = 'tab=history&reservationId=101';

    const pendingItem = fromPartial<Reservation>({
      id: '101',
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
    });

    const ratedAfterSubmitItem = fromPartial<Reservation>({
      id: '101',
      feedback: {
        meetingHappened: true,
        rating: {
          rating: 9,
          content: '收穫良多，謝謝導師！',
          createdAt: 1760000100,
          updatedAt: 1760000100,
          authorName: 'T***',
          isPublic: true,
        },
        nextStep: null,
      },
    });

    const { result, rerender } = renderHook(
      ({ history }) =>
        useFeedbackDeepLinkParam({
          userRole: 'mentee',
          history,
          isHistoryLoaded: true,
          isLoadingHistory: false,
        }),
      {
        initialProps: { history: [pendingItem] },
      }
    );

    expect(result.current.deepLinkDialogReservation).toBe(pendingItem);
    expect(mockToast).not.toHaveBeenCalled();

    // 1. In-place read-model update resolves while ?reservationId=101 is still in URL
    rerender({ history: [ratedAfterSubmitItem] });
    expect(mockToast).not.toHaveBeenCalled();

    // 2. MeetingFeedbackDialog finishes submission and invokes onClose -> dismissDeepLinkDialog
    act(() => {
      result.current.dismissDeepLinkDialog();
    });

    expect(result.current.deepLinkDialogReservation).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith(
      '/reservation/mentee?tab=history',
      { scroll: false }
    );
    expect(mockToast).not.toHaveBeenCalled();

    // 3. Async router.replace commits cleaned query string
    currentQuery = 'tab=history';
    rerender({ history: [ratedAfterSubmitItem] });

    expect(result.current.hasDeepLinkTarget).toBe(false);
    expect(result.current.deepLinkDialogReservation).toBeNull();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('supports first positive integer reservationId=1 without treating it as a reserved flag (#733)', () => {
    currentQuery = 'tab=history&reservationId=1';

    const firstItem = fromPartial<Reservation>({
      id: '1',
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
    });

    const { result } = renderHook(() =>
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

    act(() => {
      result.current.dismissDeepLinkDialog();
    });

    expect(result.current.deepLinkDialogReservation).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith(
      '/reservation/mentee?tab=history',
      { scroll: false }
    );
  });

  it('latches deepLinkDialogReservation for Mentee pending RATE card without misclassifying as completed (#733)', () => {
    currentQuery = 'tab=history&reservationId=105';

    const pendingRateItem = fromPartial<Reservation>({
      id: '105',
      feedback: {
        meetingHappened: true,
        rating: null,
        nextStep: 'RATE',
      },
    });

    const { result } = renderHook(() =>
      useFeedbackDeepLinkParam({
        userRole: 'mentee',
        history: [pendingRateItem],
        isHistoryLoaded: true,
        isLoadingHistory: false,
      })
    );

    expect(result.current.hasDeepLinkTarget).toBe(true);
    expect(result.current.deepLinkDialogReservation).toBe(pendingRateItem);
    expect(result.current.highlightedReservationId).toBe('105');
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('auto-expands existing feedback, shows friendly toast, and immediately strips param when Mentee already rated', () => {
    currentQuery = 'tab=history&reservationId=102';

    const ratedItem = fromPartial<Reservation>({
      id: '102',
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

    const { result } = renderHook(() =>
      useFeedbackDeepLinkParam({
        userRole: 'mentee',
        history: [ratedItem],
        isHistoryLoaded: true,
        isLoadingHistory: false,
      })
    );

    expect(result.current.deepLinkDialogReservation).toBeNull();
    expect(result.current.highlightedReservationId).toBe('102');
    expect(result.current.autoExpandedReservationId).toBe('102');
    expect(mockToast).toHaveBeenCalledWith({
      title: '您已填寫過此場會談回饋',
      description: '已為您展開先前的回饋紀錄。',
    });
    expect(mockReplace).toHaveBeenCalledWith(
      '/reservation/mentee?tab=history',
      { scroll: false }
    );
  });

  it('auto-opens Mentor confirm-session dialog when reservation_id targets a pending Mentor session (#735) and strips param on dismiss', () => {
    currentPathname = '/reservation/mentor';
    currentQuery = 'reservation_id=205';

    const pendingMentorCard = fromPartial<Reservation>({
      id: '205',
      viewerRole: 'MENTOR',
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
    });

    const { result } = renderHook(() =>
      useFeedbackDeepLinkParam({
        userRole: 'mentor',
        history: [pendingMentorCard],
        isHistoryLoaded: true,
        isLoadingHistory: false,
      })
    );

    expect(result.current.hasDeepLinkTarget).toBe(true);
    expect(result.current.deepLinkDialogReservation).toBe(pendingMentorCard);
    expect(result.current.highlightedReservationId).toBe('205');
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();

    act(() => {
      result.current.dismissDeepLinkDialog();
    });

    expect(result.current.deepLinkDialogReservation).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith(
      '/reservation/mentor?tab=history',
      { scroll: false }
    );
  });

  it('locates and highlights Mentor card without opening dialog when already answered and cleans deep-link param', () => {
    currentPathname = '/reservation/mentor';
    currentQuery = 'tab=history&reservationId=201';

    const mentorCard = fromPartial<Reservation>({
      id: '201',
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: null,
      },
    });

    const { result } = renderHook(() =>
      useFeedbackDeepLinkParam({
        userRole: 'mentor',
        history: [mentorCard],
        isHistoryLoaded: true,
        isLoadingHistory: false,
      })
    );

    expect(result.current.deepLinkDialogReservation).toBeNull();
    expect(result.current.highlightedReservationId).toBe('201');
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith(
      '/reservation/mentor?tab=history',
      { scroll: false }
    );
  });

  it('loads next page when target is not in initial history page and hasMoreHistory is true, then opens once loaded', () => {
    currentQuery = 'tab=history&reservationId=305';
    const onLoadMoreHistory = vi.fn();

    const firstPageItem = fromPartial<Reservation>({ id: '301' });
    const targetItem = fromPartial<Reservation>({
      id: '305',
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
    });

    const { result, rerender } = renderHook(
      ({ history, hasMore }) =>
        useFeedbackDeepLinkParam({
          userRole: 'mentee',
          history,
          isHistoryLoaded: true,
          isLoadingHistory: false,
          hasMoreHistory: hasMore,
          onLoadMoreHistory,
        }),
      {
        initialProps: {
          history: [firstPageItem],
          hasMore: true,
        },
      }
    );

    expect(onLoadMoreHistory).toHaveBeenCalledTimes(1);
    expect(result.current.deepLinkDialogReservation).toBeNull();

    rerender({
      history: [firstPageItem, targetItem],
      hasMore: false,
    });

    expect(result.current.deepLinkDialogReservation).toBe(targetItem);
    expect(result.current.highlightedReservationId).toBe('305');
  });

  it('shows friendly not-found toast and strips param when reservationId does not exist after history finishes loading', () => {
    currentQuery = 'reservationId=999';

    renderHook(() =>
      useFeedbackDeepLinkParam({
        userRole: 'mentee',
        history: [],
        isHistoryLoaded: true,
        isLoadingHistory: false,
        hasMoreHistory: false,
      })
    );

    expect(mockToast).toHaveBeenCalledWith({
      title: '找不到指定的會談紀錄',
      description: '請確認您登入的帳號是否正確，或於歷史紀錄列表查看。',
    });
    expect(mockReplace).toHaveBeenCalledWith(
      '/reservation/mentee?tab=history',
      { scroll: false }
    );
  });

  it('stops auto-loading after MAX_DEEP_LINK_LOAD_MORE_PAGES (3 pages) and shows not-found toast when target remains absent (#733)', () => {
    currentQuery = 'tab=history&reservationId=999';
    const onLoadMoreHistory = vi.fn();

    const p0 = fromPartial<Reservation>({ id: '301' });
    const p1 = fromPartial<Reservation>({ id: '302' });
    const p2 = fromPartial<Reservation>({ id: '303' });
    const p3 = fromPartial<Reservation>({ id: '304' });

    const { rerender } = renderHook(
      ({ history }) =>
        useFeedbackDeepLinkParam({
          userRole: 'mentee',
          history,
          isHistoryLoaded: true,
          isLoadingHistory: false,
          hasMoreHistory: true,
          onLoadMoreHistory,
        }),
      {
        initialProps: { history: [p0] },
      }
    );

    expect(onLoadMoreHistory).toHaveBeenCalledTimes(1);
    expect(mockToast).not.toHaveBeenCalled();

    rerender({ history: [p0, p1] });
    expect(onLoadMoreHistory).toHaveBeenCalledTimes(2);
    expect(mockToast).not.toHaveBeenCalled();

    rerender({ history: [p0, p1, p2] });
    expect(onLoadMoreHistory).toHaveBeenCalledTimes(3);
    expect(mockToast).not.toHaveBeenCalled();

    // After 3rd load-more completes and target is still absent, terminates pagination
    rerender({ history: [p0, p1, p2, p3] });
    expect(onLoadMoreHistory).toHaveBeenCalledTimes(3);
    expect(mockToast).toHaveBeenCalledWith({
      title: '找不到指定的會談紀錄',
      description: '請確認您登入的帳號是否正確，或於歷史紀錄列表查看。',
    });
    expect(mockReplace).toHaveBeenCalledWith(
      '/reservation/mentee?tab=history',
      { scroll: false }
    );
  });

  it('increments deepLinkTriggerSeq on repeated clicks of the same notification and resets stale focus on non-expanding, not-found, or clearDeepLinkFocus (#733)', () => {
    currentQuery = 'tab=history&reservationId=102';

    const ratedItem = fromPartial<Reservation>({
      id: '102',
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

    const absentItem = fromPartial<Reservation>({
      id: '103',
      feedback: {
        meetingHappened: false,
        rating: null,
        nextStep: null,
      },
    });

    const { result, rerender } = renderHook(() =>
      useFeedbackDeepLinkParam({
        userRole: 'mentee',
        history: [ratedItem, absentItem],
        isHistoryLoaded: true,
        isLoadingHistory: false,
      })
    );

    expect(result.current.highlightedReservationId).toBe('102');
    expect(result.current.autoExpandedReservationId).toBe('102');
    expect(result.current.deepLinkTriggerSeq).toBe(1);

    // URL stripped after initial handling; focus remains active on current tab
    currentQuery = 'tab=history';
    rerender();
    expect(result.current.highlightedReservationId).toBe('102');
    expect(result.current.autoExpandedReservationId).toBe('102');
    expect(result.current.deepLinkTriggerSeq).toBe(1);

    // User clicks the same notification (102) again -> triggerSeq increments
    currentQuery = 'tab=history&reservationId=102';
    rerender();
    expect(result.current.highlightedReservationId).toBe('102');
    expect(result.current.autoExpandedReservationId).toBe('102');
    expect(result.current.deepLinkTriggerSeq).toBe(2);

    // Clicking a non-expanding card resets stale autoExpandedReservationId
    currentQuery = 'tab=history';
    rerender();
    currentQuery = 'tab=history&reservationId=103';
    rerender();
    expect(result.current.highlightedReservationId).toBe('103');
    expect(result.current.autoExpandedReservationId).toBeNull();
    expect(result.current.deepLinkTriggerSeq).toBe(3);

    // Clicking a not-found notification clears stale highlight & auto-expand
    currentQuery = 'tab=history';
    rerender();
    currentQuery = 'tab=history&reservationId=999';
    rerender();
    expect(result.current.highlightedReservationId).toBeNull();
    expect(result.current.autoExpandedReservationId).toBeNull();

    // clearDeepLinkFocus explicitly clears focus when leaving the history tab
    currentQuery = 'tab=history';
    rerender();
    currentQuery = 'tab=history&reservationId=102';
    rerender();
    expect(result.current.highlightedReservationId).toBe('102');
    expect(result.current.autoExpandedReservationId).toBe('102');

    act(() => {
      result.current.clearDeepLinkFocus();
    });
    expect(result.current.highlightedReservationId).toBeNull();
    expect(result.current.autoExpandedReservationId).toBeNull();
  });

  it('uses single-reservation lookup fallback when target is outside loaded pages and opens dialog or switches role (#875)', async () => {
    currentQuery = 'tab=history&reservation_id=888';

    const lookupItem = fromPartial<Reservation>({
      id: '888',
      name: 'Emily Chen',
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
    });
    const lookupSingleFeedback = vi.fn().mockResolvedValueOnce({
      viewerRole: 'mentee',
      reservation: lookupItem,
    });

    const { result } = renderHook(() =>
      useFeedbackDeepLinkParam({
        userRole: 'mentee',
        myUserId: '1',
        history: [],
        isHistoryLoaded: true,
        isLoadingHistory: false,
        hasMoreHistory: false,
        lookupSingleFeedback,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(lookupSingleFeedback).toHaveBeenCalledWith({
      userId: '1',
      reservationId: '888',
      fallbackRole: 'mentee',
      signal: expect.any(AbortSignal),
    });
    expect(result.current.deepLinkDialogReservation).toBe(lookupItem);
    expect(mockToast).not.toHaveBeenCalled();

    // Unmounting while lookup is in-flight aborts signal and suppresses stale not-found toast
    currentQuery = 'tab=history&reservation_id=890';
    let capturedSignal: AbortSignal | undefined;
    let resolveInFlight: ((val: null) => void) | undefined;
    const inFlightLookup = vi.fn().mockImplementation(({ signal }) => {
      capturedSignal = signal;
      return new Promise<null>((resolve) => {
        resolveInFlight = resolve;
      });
    });

    const { unmount } = renderHook(() =>
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

    unmount();
    expect(capturedSignal?.aborted).toBe(true);

    await act(async () => {
      resolveInFlight?.(null);
      await Promise.resolve();
    });
    expect(mockToast).not.toHaveBeenCalled();

    // Cross-role redirect when lookup reveals target belongs to mentor view
    currentQuery = 'tab=history&reservation_id=889';
    const crossRoleLookup = vi.fn().mockResolvedValueOnce({
      viewerRole: 'mentor',
      reservation: fromPartial<Reservation>({ id: '889' }),
    });

    renderHook(() =>
      useFeedbackDeepLinkParam({
        userRole: 'mentee',
        myUserId: '1',
        history: [],
        isHistoryLoaded: true,
        isLoadingHistory: false,
        hasMoreHistory: false,
        lookupSingleFeedback: crossRoleLookup,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockReplace).toHaveBeenCalledWith(
      '/reservation/mentor?tab=history&reservation_id=889',
      { scroll: false }
    );
  });
});
