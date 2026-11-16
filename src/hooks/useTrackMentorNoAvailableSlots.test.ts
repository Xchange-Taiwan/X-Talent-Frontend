import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { trackEvent } from '@/lib/analytics';

import {
  useTrackMentorNoAvailableSlots,
  type UseTrackMentorNoAvailableSlotsOptions,
} from './useTrackMentorNoAvailableSlots';

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

function buildBaseOptions(
  overrides: Partial<UseTrackMentorNoAvailableSlotsOptions> = {}
): UseTrackMentorNoAvailableSlotsOptions {
  return {
    isIdentityResolved: true,
    isOwnProfile: false,
    userLoading: false,
    isMentor: true,
    mentorId: 7488864558908473,
    loaded: true,
    monthLoaded: true,
    isFetching: false,
    hasError: false,
    year: 2026,
    month: 11,
    allowedDates: [],
    ...overrides,
  };
}

describe('useTrackMentorNoAvailableSlots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fire while schedule is loading, fetching, errored, unresolved, self, or non-mentor', () => {
    renderHook(() =>
      useTrackMentorNoAvailableSlots(buildBaseOptions({ monthLoaded: false }))
    );
    renderHook(() =>
      useTrackMentorNoAvailableSlots(buildBaseOptions({ isFetching: true }))
    );
    renderHook(() =>
      useTrackMentorNoAvailableSlots(buildBaseOptions({ hasError: true }))
    );
    renderHook(() =>
      useTrackMentorNoAvailableSlots(
        buildBaseOptions({ isIdentityResolved: false })
      )
    );
    renderHook(() =>
      useTrackMentorNoAvailableSlots(buildBaseOptions({ isOwnProfile: true }))
    );
    renderHook(() =>
      useTrackMentorNoAvailableSlots(buildBaseOptions({ isMentor: false }))
    );

    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('does not fire when the viewed month has at least one available date', () => {
    renderHook(() =>
      useTrackMentorNoAvailableSlots(
        buildBaseOptions({ allowedDates: ['2026-11-20'] })
      )
    );
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('fires once per mentor+month with feature="profile" and slot_count=0, and re-fires on a new empty month', () => {
    const { rerender } = renderHook(
      (props: UseTrackMentorNoAvailableSlotsOptions) =>
        useTrackMentorNoAvailableSlots(props),
      { initialProps: buildBaseOptions() }
    );

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith({
      name: 'mentor_no_available_slots',
      feature: 'profile',
      metadata: {
        mentor_id: 7488864558908473,
        slot_count: 0,
      },
    });

    // Re-rendering same month does not duplicate
    rerender(buildBaseOptions());
    expect(trackEvent).toHaveBeenCalledTimes(1);

    // Switching to December (also empty) fires once more
    rerender(buildBaseOptions({ month: 12 }));
    expect(trackEvent).toHaveBeenCalledTimes(2);
  });
});
