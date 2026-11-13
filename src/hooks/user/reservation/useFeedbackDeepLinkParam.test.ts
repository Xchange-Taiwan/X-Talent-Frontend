import { act, renderHook } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { emitFeedbackDeepLink } from '@/lib/reservation/feedbackDeepLink';
import type { Reservation } from '@/types/reservation';

import {
  useFeedbackDeepLinkParam,
  type UseFeedbackDeepLinkParamOptions,
} from './useFeedbackDeepLinkParam';

const mockGet = vi.fn<(key: string) => string | null>();

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => mockGet(key),
  }),
}));

function makeReservation(id: string): Reservation {
  return fromPartial<Reservation>({
    id,
    dtstart: 1760000000,
    dtend: 1760001800,
  });
}

describe('useFeedbackDeepLinkParam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(null);
  });

  it('returns undefined highlightedReservationId when reservationId param is missing or blank', () => {
    const onLoadMoreHistory = vi.fn();

    const { result, rerender } = renderHook(() =>
      useFeedbackDeepLinkParam({
        hasExplicitNonHistoryTab: false,
        history: [makeReservation('401')],
        isHistoryLoaded: true,
        isLoadingHistory: false,
        hasMoreHistory: true,
        isLoadingMoreHistory: false,
        nextHistoryCursor: 1760000000,
        onLoadMoreHistory,
      })
    );

    expect(result.current.highlightedReservationId).toBeUndefined();
    expect(result.current.shouldForceHistoryTab).toBe(false);
    expect(onLoadMoreHistory).not.toHaveBeenCalled();

    mockGet.mockImplementation((key) =>
      key === 'reservationId' ? '   ' : null
    );
    rerender();
    expect(result.current.highlightedReservationId).toBeUndefined();
    expect(result.current.shouldForceHistoryTab).toBe(false);
  });

  it('forces history tab when reservationId is present without explicit tab=upcoming/pending (#734)', () => {
    mockGet.mockImplementation((key) =>
      key === 'reservationId' ? ' 401 ' : null
    );
    const onLoadMoreHistory = vi.fn();

    const { result } = renderHook(() =>
      useFeedbackDeepLinkParam({
        hasExplicitNonHistoryTab: false,
        history: [makeReservation('401')],
        isHistoryLoaded: true,
        isLoadingHistory: false,
        hasMoreHistory: true,
        isLoadingMoreHistory: false,
        nextHistoryCursor: 1760000000,
        onLoadMoreHistory,
      })
    );

    expect(result.current.highlightedReservationId).toBe('401');
    expect(result.current.shouldForceHistoryTab).toBe(true);
    expect(onLoadMoreHistory).not.toHaveBeenCalled();
  });

  it('auto-loads subsequent history pages until target reservationId is found or pagination ends (#734)', () => {
    mockGet.mockImplementation((key) =>
      key === 'reservationId' ? '401' : null
    );
    const onLoadMoreHistory = vi.fn();

    const baseProps: UseFeedbackDeepLinkParamOptions = {
      hasExplicitNonHistoryTab: false,
      history: [makeReservation('410'), makeReservation('409')],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      hasMoreHistory: true,
      isLoadingMoreHistory: false,
      nextHistoryCursor: 1761000000,
      onLoadMoreHistory,
    };

    const { rerender } = renderHook(
      (props: UseFeedbackDeepLinkParamOptions) =>
        useFeedbackDeepLinkParam(props),
      { initialProps: baseProps }
    );

    // Page 1 loaded without 401 -> requests Page 2 once
    expect(onLoadMoreHistory).toHaveBeenCalledTimes(1);

    // Re-render with identical cursor before Page 2 resolves -> must not duplicate request
    rerender({ ...baseProps });
    expect(onLoadMoreHistory).toHaveBeenCalledTimes(1);

    // Page 2 resolves still without 401, with new cursor -> requests Page 3
    rerender({
      ...baseProps,
      history: [
        makeReservation('410'),
        makeReservation('409'),
        makeReservation('405'),
      ],
      nextHistoryCursor: 1760900000,
    });
    expect(onLoadMoreHistory).toHaveBeenCalledTimes(2);

    // Page 3 resolves containing target 401 -> stops loading more pages
    rerender({
      ...baseProps,
      history: [
        makeReservation('410'),
        makeReservation('409'),
        makeReservation('405'),
        makeReservation('401'),
      ],
      nextHistoryCursor: 1760800000,
    });
    expect(onLoadMoreHistory).toHaveBeenCalledTimes(2);
  });

  it('stops auto-loading when hasMoreHistory becomes false without finding target', () => {
    mockGet.mockImplementation((key) =>
      key === 'reservationId' ? '999' : null
    );
    const onLoadMoreHistory = vi.fn();

    const { rerender } = renderHook(
      (props: UseFeedbackDeepLinkParamOptions) =>
        useFeedbackDeepLinkParam(props),
      {
        initialProps: {
          hasExplicitNonHistoryTab: false,
          history: [makeReservation('410')],
          isHistoryLoaded: true,
          isLoadingHistory: false,
          hasMoreHistory: true,
          isLoadingMoreHistory: false,
          nextHistoryCursor: 1761000000,
          onLoadMoreHistory,
        },
      }
    );

    expect(onLoadMoreHistory).toHaveBeenCalledTimes(1);

    rerender({
      hasExplicitNonHistoryTab: false,
      history: [makeReservation('410'), makeReservation('409')],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      hasMoreHistory: false,
      isLoadingMoreHistory: false,
      nextHistoryCursor: 0,
      onLoadMoreHistory,
    });

    expect(onLoadMoreHistory).toHaveBeenCalledTimes(1);
  });

  it('increments highlightNonce and forces history tab when emitFeedbackDeepLink fires on the same URL', () => {
    mockGet.mockImplementation((key) =>
      key === 'reservationId' ? '401' : null
    );
    const onLoadMoreHistory = vi.fn();

    const { result } = renderHook(() =>
      useFeedbackDeepLinkParam({
        hasExplicitNonHistoryTab: true,
        history: [makeReservation('401')],
        isHistoryLoaded: true,
        isLoadingHistory: false,
        hasMoreHistory: false,
        isLoadingMoreHistory: false,
        nextHistoryCursor: 0,
        onLoadMoreHistory,
      })
    );

    expect(result.current.highlightedReservationId).toBe('401');
    expect(result.current.highlightNonce).toBe(0);
    expect(result.current.shouldForceHistoryTab).toBe(false);

    act(() => {
      emitFeedbackDeepLink('401');
    });

    expect(result.current.highlightNonce).toBe(1);
    expect(result.current.shouldForceHistoryTab).toBe(true);
  });
});
