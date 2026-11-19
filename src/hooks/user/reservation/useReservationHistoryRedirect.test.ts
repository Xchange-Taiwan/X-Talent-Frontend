import { renderHook, waitFor } from '@testing-library/react';
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

import {
  createFeedbackSessionCoordinator,
  createInMemoryFeedbackSessionLookupPort,
  createInMemoryFeedbackSessionStoragePort,
} from '@/lib/reservation/feedbackSessionCoordinator';
import {
  feedbackRouteMock,
  makeFeedbackTestReservation,
  resetFeedbackHookTestState,
  setAuthenticatedFeedbackSession,
  setLoadingFeedbackSession,
  setMockFeedbackQuery,
  setUnauthenticatedFeedbackSession,
} from '@/test/mocks/reservationFeedbackHarness';

import { useReservationHistoryRedirect } from './useReservationHistoryRedirect';

describe('useReservationHistoryRedirect (#906 / #946)', () => {
  beforeEach(() => {
    resetFeedbackHookTestState({ pathname: '/reservation/history' });
  });

  it('waits while auth status is loading and redirects unauthenticated visitors to /auth/signin preserving callbackUrl', async () => {
    setMockFeedbackQuery('reservation_id=301');
    setLoadingFeedbackSession();

    const lookup = createInMemoryFeedbackSessionLookupPort();
    const coordinator = createFeedbackSessionCoordinator({
      storage: createInMemoryFeedbackSessionStoragePort(),
      lookup,
    });

    const { rerender } = renderHook(() =>
      useReservationHistoryRedirect(coordinator)
    );
    expect(feedbackRouteMock.replace).not.toHaveBeenCalled();

    setUnauthenticatedFeedbackSession();
    rerender();

    await waitFor(() => {
      expect(feedbackRouteMock.replace).toHaveBeenCalledWith(
        '/auth/signin?callbackUrl=%2Freservation%2Fhistory%3Freservation_id%3D301',
        { scroll: false }
      );
    });
    expect(lookup.calls.fetchSingleReservationFeedback).toHaveLength(0);
  });

  it('seeds lookup result into FeedbackSessionCoordinator and redirects to resolved role route without duplicate HTTP lookup', async () => {
    setMockFeedbackQuery('reservation_id=302');
    setAuthenticatedFeedbackSession({ id: '20', isMentor: false });

    const reservation = makeFeedbackTestReservation('302', {
      viewerRole: 'MENTOR',
    });
    const lookup = createInMemoryFeedbackSessionLookupPort({
      singleReservations: {
        '302': {
          viewerRole: 'mentor',
          reservation,
        },
      },
    });

    const coordinator = createFeedbackSessionCoordinator({
      storage: createInMemoryFeedbackSessionStoragePort(),
      lookup,
    });
    renderHook(() => useReservationHistoryRedirect(coordinator));

    await waitFor(() => {
      expect(feedbackRouteMock.replace).toHaveBeenCalledWith(
        '/reservation/mentor?tab=history&reservation_id=302',
        { scroll: false }
      );
    });

    const seededStep = coordinator.reconcileHistoryRoute({
      role: 'mentor',
      userId: '20',
      pathname: '/reservation/mentor',
      rawSearch: 'tab=history&reservation_id=302',
      history: [],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      hasMoreHistory: true,
    });
    expect(seededStep.state.deepLinkDialogReservation).toBe(reservation);
    expect(lookup.calls.fetchSingleReservationFeedback).toHaveLength(1);
  });

  it('falls back to session role when lookup rejects and aborts in-flight lookup on unmount', async () => {
    setMockFeedbackQuery('reservation_id=500');
    setAuthenticatedFeedbackSession({ id: '20', isMentor: true });

    const failingLookup = createInMemoryFeedbackSessionLookupPort({
      singleReservations: () => Promise.reject(new Error('Network error')),
    });
    const coordinator = createFeedbackSessionCoordinator({
      storage: createInMemoryFeedbackSessionStoragePort(),
      lookup: failingLookup,
    });
    const { unmount } = renderHook(() =>
      useReservationHistoryRedirect(coordinator)
    );

    await waitFor(() => {
      expect(feedbackRouteMock.replace).toHaveBeenCalledWith(
        '/reservation/mentor?tab=history&reservation_id=500',
        { scroll: false }
      );
    });
    unmount();

    // Unmounting mid-flight aborts signal and suppresses stale router.replace
    feedbackRouteMock.replace.mockClear();
    setMockFeedbackQuery('reservation_id=501');
    let capturedSignal: AbortSignal | undefined;
    const hangingCoordinator = createFeedbackSessionCoordinator({
      storage: createInMemoryFeedbackSessionStoragePort(),
      lookup: createInMemoryFeedbackSessionLookupPort({
        singleReservations: ({ signal }) => {
          capturedSignal = signal;
          return new Promise(() => {});
        },
      }),
    });
    const pendingMount = renderHook(() =>
      useReservationHistoryRedirect(hangingCoordinator)
    );
    pendingMount.unmount();
    expect(capturedSignal?.aborted).toBe(true);
    expect(feedbackRouteMock.replace).not.toHaveBeenCalled();
  });
});
