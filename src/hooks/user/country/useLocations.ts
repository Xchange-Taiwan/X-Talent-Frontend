'use client';

import { useMemo } from 'react';

import { getLocations } from '@/lib/profile/locations';
import type { LocationType } from '@/types/location';

export interface UseLocationsResult {
  locations: LocationType[];
  isLoading: boolean;
  error: string | null;
}

export default function useLocations(language: string): UseLocationsResult {
  const locations = getLocations(language);

  return useMemo(
    () => ({
      locations,
      isLoading: false,
      error: null,
    }),
    [locations]
  );
}
