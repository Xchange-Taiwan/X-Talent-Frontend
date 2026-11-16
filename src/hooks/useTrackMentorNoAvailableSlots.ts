'use client';

import { useEffect, useRef } from 'react';

import { trackEvent } from '@/lib/analytics';

export interface UseTrackMentorNoAvailableSlotsOptions {
  isIdentityResolved: boolean;
  isOwnProfile: boolean;
  userLoading: boolean;
  isMentor: boolean;
  mentorId: number;
  loaded: boolean;
  monthLoaded: boolean;
  isFetching: boolean;
  hasError: boolean;
  year: number | undefined;
  month: number | undefined;
  allowedDates: readonly string[];
}

/**
 * Fires a deduplicated `mentor_no_available_slots` GA4 / Clarity diagnostic event
 * when a visitor or mentee views a mentor's profile whose schedule for the viewed
 * month has finished loading cleanly with zero available dates.
 */
export function useTrackMentorNoAvailableSlots({
  isIdentityResolved,
  isOwnProfile,
  userLoading,
  isMentor,
  mentorId,
  loaded,
  monthLoaded,
  isFetching,
  hasError,
  year,
  month,
  allowedDates,
}: UseTrackMentorNoAvailableSlotsOptions): void {
  const trackedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isIdentityResolved || isOwnProfile) return;
    if (userLoading || !isMentor) return;
    if (!loaded || !monthLoaded || isFetching || hasError) return;
    if (
      !Number.isSafeInteger(mentorId) ||
      mentorId <= 0 ||
      typeof year !== 'number' ||
      typeof month !== 'number'
    ) {
      return;
    }

    const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;
    const hasAvailableDatesInMonth = allowedDates.some((dateKey) =>
      dateKey.startsWith(monthPrefix)
    );
    if (hasAvailableDatesInMonth) return;

    const dedupKey = `${mentorId}:${year}-${month}`;
    if (trackedKeysRef.current.has(dedupKey)) return;
    trackedKeysRef.current.add(dedupKey);

    trackEvent({
      name: 'mentor_no_available_slots',
      feature: 'profile',
      metadata: {
        mentor_id: mentorId,
        slot_count: 0,
      },
    });
  }, [
    allowedDates,
    hasError,
    isFetching,
    isIdentityResolved,
    isMentor,
    isOwnProfile,
    loaded,
    mentorId,
    month,
    monthLoaded,
    userLoading,
    year,
  ]);
}
